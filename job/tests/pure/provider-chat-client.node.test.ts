import test from 'node:test';
import assert from 'node:assert/strict';
import { consumeProviderChatSseResponse } from '../../src/server/ai/providers/provider-chat-client.ts';

test('consumes a real Response body stream into bounded text/tool-call completion', async () => {
  const response = new Response([
    'data: {"id":"x","choices":[{"index":0,"delta":{"content":"Convicção."},"finish_reason":null}]}\n\n',
    'data: {"id":"x","choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"submit_seller_proposal","arguments":"{\\"payload\\":\\"ok\\"}"}}]},"finish_reason":"tool_calls"}]}\n\n',
    'data: [DONE]\n\n',
  ].join(''), { headers: { 'Content-Type': 'text/event-stream; charset=utf-8' } });

  const result = await consumeProviderChatSseResponse(response);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.completion.content, 'Convicção.');
  assert.equal(result.completion.finishReason, 'tool_calls');
  assert.equal(result.completion.toolCalls[0]?.function.name, 'submit_seller_proposal');
});

test('HTTP errors are classified without reading or returning provider error body', async () => {
  const secretBody = '{"error":"customer prompt leaked here"}';
  const result = await consumeProviderChatSseResponse(new Response(secretBody, {
    status: 429,
    headers: { 'Content-Type': 'application/json', 'retry-after': '3' },
  }), Date.parse('2026-09-10T16:00:00Z'));
  assert.deepEqual(result, {
    ok: false,
    class: 'rate_limit',
    status: 429,
    retryAfterMs: 3000,
  });
  assert.equal(JSON.stringify(result).includes('customer prompt'), false);
});

test('successful response must be SSE and terminate with DONE', async () => {
  const nonSse = await consumeProviderChatSseResponse(new Response('{}', {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  }));
  assert.deepEqual(nonSse, { ok: false, class: 'malformed', status: 200, retryAfterMs: null, malformedDetail: 'non_sse' });

  const missingDone = await consumeProviderChatSseResponse(new Response(
    'data: {"choices":[{"index":0,"delta":{"content":"partial"},"finish_reason":"stop"}]}\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  ));
  assert.deepEqual(missingDone, { ok: false, class: 'malformed', status: 200, retryAfterMs: null, malformedDetail: 'missing_done' });
});

test('malformed provider chunks fail closed as malformed without exposing payload content', async () => {
  const result = await consumeProviderChatSseResponse(new Response(
    'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"x","type":"function","function":{"name":"../unsafe","arguments":"{}"}}]},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  ));
  assert.deepEqual(result, { ok: false, class: 'malformed', status: 200, retryAfterMs: null, malformedDetail: 'completion_assembly' });
});

test('malformed SSE framing is classified separately from invalid assembled completion', async () => {
  const result = await consumeProviderChatSseResponse(new Response(
    'data: {not-json}\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  ));
  assert.deepEqual(result, {
    ok: false,
    class: 'malformed',
    status: 200,
    retryAfterMs: null,
    malformedDetail: 'sse_decode',
    sseDecodeDetail: 'malformed_json',
  });
  assert.equal(JSON.stringify(result).includes('{not-json}'), false);
});

test('mid-stream transport failure is classified as network rather than malformed provider output', async () => {
  const encoder = new TextEncoder();
  let pulls = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1;
      if (pulls === 1) {
        controller.enqueue(encoder.encode(
          'data: {"choices":[{"index":0,"delta":{"content":"partial"},"finish_reason":null}]}\n\n',
        ));
        return;
      }
      controller.error(new Error('transport failed'));
    },
  });
  const result = await consumeProviderChatSseResponse(new Response(body, {
    status: 200,
    headers: { 'Content-Type': 'text/event-stream' },
  }));
  assert.deepEqual(result, { ok: false, class: 'network', status: 200, retryAfterMs: null });
});


test('stream chunk structural failure carries only a bounded diagnostic code', async () => {
  const result = await consumeProviderChatSseResponse(new Response(
    'data: {"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"id":"call-1","type":"function","function":{"name":"capture_signal","arguments":{"value":"private-value"}}}]},"finish_reason":"tool_calls"}]}\n\ndata: [DONE]\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  ));
  assert.deepEqual(result, {
    ok: false,
    class: 'malformed',
    status: 200,
    retryAfterMs: null,
    malformedDetail: 'stream_chunk',
    streamChunkDetail: 'tool_arguments',
  });
  assert.equal(JSON.stringify(result).includes('private-value'), false);
});


test('provider in-stream error envelopes fail closed with bounded classification and no payload leak', async () => {
  const result = await consumeProviderChatSseResponse(new Response(
    'data: {"error":{"message":"private-provider-detail","code":"rate_limit"}}\n\ndata: [DONE]\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  ));
  assert.deepEqual(result, {
    ok: false,
    class: 'malformed',
    status: 200,
    retryAfterMs: null,
    malformedDetail: 'stream_chunk',
    streamChunkDetail: 'provider_error_event',
  });
  assert.equal(JSON.stringify(result).includes('private-provider-detail'), false);
  assert.equal(JSON.stringify(result).includes('rate_limit'), false);
});

test('missing, mistyped and non-object choices are distinguished without exposing event content', async () => {
  const cases = [
    ['data: {"usage":{"private":"x"}}\n\n', 'choices_missing'],
    ['data: {"choices":"private"}\n\n', 'choices_type'],
    ['data: ["private"]\n\n', 'chunk_non_object'],
  ] as const;
  for (const [frame, expected] of cases) {
    const result = await consumeProviderChatSseResponse(new Response(
      frame + 'data: [DONE]\n\n',
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    ));
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.malformedDetail, 'stream_chunk');
    assert.equal(result.streamChunkDetail, expected);
    assert.equal(JSON.stringify(result).includes('private'), false);
  }
});

test('standard SSE metadata fields are accepted but never become application authority', async () => {
  const result = await consumeProviderChatSseResponse(new Response(
    'event: private-event-name\nid: provider-event-42\nretry: 5000\ndata: {"choices":[]}\n\ndata: [DONE]\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  ));
  assert.deepEqual(result, {
    ok: true,
    completion: {
      content: '',
      toolCalls: [],
      finishReason: null,
    },
  });
  assert.equal(JSON.stringify(result).includes('private-event-name'), false);
  assert.equal(JSON.stringify(result).includes('provider-event-42'), false);
  assert.equal(JSON.stringify(result).includes('5000'), false);
});

test('non-standard SSE fields still fail closed with bounded shape-only diagnostics', async () => {
  const result = await consumeProviderChatSseResponse(new Response(
    'private-field: private-value\ndata: {"choices":[]}\n\ndata: [DONE]\n\n',
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  ));
  assert.deepEqual(result, {
    ok: false,
    class: 'malformed',
    status: 200,
    retryAfterMs: null,
    malformedDetail: 'sse_decode',
    sseDecodeDetail: 'unsupported_field',
  });
  assert.equal(JSON.stringify(result).includes('private-value'), false);
});
