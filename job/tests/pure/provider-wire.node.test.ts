import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerifiedRouteFixture } from './provider-test-fixtures.ts';
import {
  buildProviderChatEndpoint,
  buildProviderChatBody,
  buildServerChatHttpRequest,
  type LocalFunctionTool,
} from '../../src/server/ai/providers/openai-chat-wire.ts';
import { createChatSseDecoder, createChatStreamAccumulator } from '../../src/server/ai/providers/chat-sse.ts';
import { classifyHttpFailure, classifyTransportFailure } from '../../src/server/ai/providers/provider-http-errors.ts';

const accountId = '0123456789abcdef0123456789abcdef';
const tools: readonly LocalFunctionTool[] = [{
  type: 'function',
  function: {
    name: 'submit_seller_proposal',
    description: 'Submit one validated seller proposal candidate.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: { payload: { type: 'string' } },
      required: ['payload'],
    },
  },
}];

test('builds exact Cloudflare and Groq chat-completions endpoints without model ids in URL', () => {
  const cloudflare = createVerifiedRouteFixture({
    routeId: 'cf-route', family: 'cloudflare_workers_ai', modelId: '@cf/zai-org/glm-4.7-flash',
  });
  const groq = createVerifiedRouteFixture({
    routeId: 'groq-route', family: 'groq', modelId: 'openai/gpt-oss-120b', tier: 'independent_fallback',
  });
  assert.equal(
    buildProviderChatEndpoint(cloudflare, { cloudflareAccountId: accountId }),
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
  );
  assert.equal(buildProviderChatEndpoint(groq, {}), 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(buildProviderChatEndpoint(cloudflare, { cloudflareAccountId: accountId }).includes('@cf/'), false);
});

test('rejects missing/unsafe Cloudflare account id and unsupported inactive provider families', () => {
  const cf = createVerifiedRouteFixture({ family: 'cloudflare_workers_ai' });
  assert.throws(() => buildProviderChatEndpoint(cf, {}), /cloudflareAccountId/);
  assert.throws(() => buildProviderChatEndpoint(cf, { cloudflareAccountId: '../escape' }), /cloudflareAccountId/);
  const mistral = createVerifiedRouteFixture({ family: 'mistral', tier: 'standby' });
  assert.throws(() => buildProviderChatEndpoint(mistral, {}), /unsupported provider family/);
});

test('chat body uses common streaming local-tool subset and contains no provider-memory or structured-output escape hatch', () => {
  const route = createVerifiedRouteFixture({ modelId: 'openai/gpt-oss-120b', family: 'groq', tier: 'independent_fallback' });
  const body = buildProviderChatBody({
    route,
    messages: [{ role: 'system', content: 'contract' }, { role: 'user', content: 'latest intent' }],
    tools,
  });
  assert.equal(body.model, 'openai/gpt-oss-120b');
  assert.equal(body.stream, true);
  assert.equal(body.tool_choice, 'auto');
  assert.deepEqual(body.tools, tools);
  const serialized = JSON.stringify(body).toLowerCase();
  for (const forbidden of [
    'conversation_id', 'conversationid', 'thread_id', 'threadid', 'previous_response_id',
    'response_format', 'disable_tool_validation', 'browser_search', 'code_interpreter',
  ]) assert.equal(serialized.includes(forbidden), false, forbidden);
});

test('wire rejects built-in/remote tools and executable provider-defined tool names', () => {
  const route = createVerifiedRouteFixture();
  assert.throws(() => buildProviderChatBody({
    route, messages: [{ role: 'user', content: 'hello' }],
    tools: [{ type: 'browser_search' } as unknown as LocalFunctionTool],
  }), /local function tool/);
  assert.throws(() => buildProviderChatBody({
    route, messages: [{ role: 'user', content: 'hello' }],
    tools: [{
      type: 'function',
      function: { name: '../escape', description: 'x', parameters: { type: 'object' } },
    }],
  }), /tool name/);
});

test('server HTTP descriptor confines token to Authorization header and never serializes it into body or URL', () => {
  const route = createVerifiedRouteFixture({ family: 'groq', modelId: 'openai/gpt-oss-120b', tier: 'independent_fallback' });
  const token = 'test-token-not-a-credential';
  const descriptor = buildServerChatHttpRequest({
    route, serverConfig: {}, apiToken: token,
    messages: [{ role: 'user', content: 'hello' }], tools,
  });
  assert.equal(descriptor.method, 'POST');
  assert.equal(descriptor.headers.get('Authorization'), `Bearer ${token}`);
  assert.equal(descriptor.headers.get('Content-Type'), 'application/json');
  assert.equal(descriptor.headers.get('Accept'), 'text/event-stream');
  assert.equal(descriptor.url.includes(token), false);
  assert.equal(descriptor.body.includes(token), false);
});

test('incremental SSE decoder handles CRLF, fragmented frames and DONE without losing UTF-8 boundaries', () => {
  const decoder = createChatSseDecoder();
  const encoder = new TextEncoder();
  const text = [
    'data: {"id":"x","choices":[{"index":0,"delta":{"content":"Olá "},"finish_reason":null}]}\r\n\r\n',
    'data: {"id":"x","choices":[{"index":0,"delta":{"content":"mundo"},"finish_reason":null}]}\n\n',
    'data: [DONE]\n\n',
  ].join('');
  const bytes = encoder.encode(text);
  const utf8Index = bytes.findIndex((value) => value >= 0x80);
  const events = [
    ...decoder.push(bytes.slice(0, utf8Index + 1)),
    ...decoder.push(bytes.slice(utf8Index + 1, utf8Index + 7)),
    ...decoder.push(bytes.slice(utf8Index + 7)),
    ...decoder.finish(),
  ];
  assert.equal(events.filter((event) => event.type === 'chunk').length, 2);
  assert.equal(events.at(-1)?.type, 'done');
});

test('stream accumulator assembles fragmented content and tool call arguments by tool index', () => {
  const accumulator = createChatStreamAccumulator();
  accumulator.accept({
    id: 'x',
    choices: [{
      index: 0, delta: {
        content: 'Antes. ',
        tool_calls: [{
          index: 0, id: 'call-1', type: 'function',
          function: { name: 'submit_seller_', arguments: '{"payload":"{' },
        }],
      }, finish_reason: null,
    }],
  });
  accumulator.accept({
    id: 'x',
    choices: [{
      index: 0, delta: {
        content: 'Depois.',
        tool_calls: [{ index: 0, function: { name: 'proposal', arguments: '\\"schemaVersion\\":1}"}' } }],
      }, finish_reason: 'tool_calls',
    }],
  });
  const result = accumulator.finish();
  assert.equal(result.content, 'Antes. Depois.');
  assert.deepEqual(result.toolCalls, [{
    id: 'call-1', type: 'function',
    function: { name: 'submit_seller_proposal', arguments: '{"payload":"{\\"schemaVersion\\":1}"}' },
  }]);
  assert.equal(result.finishReason, 'tool_calls');
});

test('SSE decoder fails closed on malformed JSON, unexpected fields or oversized unframed input', () => {
  const malformed = createChatSseDecoder();
  assert.throws(() => malformed.push('data: {not-json}\n\n'), /malformed sse json/);
  const unexpected = createChatSseDecoder();
  assert.throws(() => unexpected.push('event: evil\ndata: {"choices":[]}\n\n'), /unsupported sse field/);
  const huge = createChatSseDecoder({ maxBufferedBytes: 32 });
  assert.throws(() => huge.push('data: ' + 'x'.repeat(40)), /sse buffer limit/);
});

test('HTTP failure classifier maps access, quota, capacity and client errors with bounded retry-after parsing', () => {
  const now = Date.parse('2026-09-10T16:00:00Z');
  assert.deepEqual(classifyHttpFailure(401, new Headers(), now), { class: 'access', retryAfterMs: null });
  assert.deepEqual(classifyHttpFailure(403, new Headers(), now), { class: 'access', retryAfterMs: null });
  assert.deepEqual(classifyHttpFailure(429, new Headers({ 'retry-after': '2' }), now), { class: 'rate_limit', retryAfterMs: 2000 });
  assert.deepEqual(classifyHttpFailure(503, new Headers(), now), { class: 'capacity', retryAfterMs: null });
  assert.deepEqual(classifyHttpFailure(400, new Headers(), now), { class: 'client', retryAfterMs: null });
});

test('transport classifier distinguishes cancellation/timeout from network failures without leaking error text', () => {
  assert.deepEqual(classifyTransportFailure({ aborted: true, timeoutTriggered: true }), { class: 'timeout' });
  assert.deepEqual(classifyTransportFailure({ aborted: true, timeoutTriggered: false }), { class: 'cancelled' });
  assert.deepEqual(classifyTransportFailure({ aborted: false, timeoutTriggered: false }), { class: 'network' });
});

test('DONE is terminal even when malicious data follows in the same network chunk', () => {
  const decoder = createChatSseDecoder();
  assert.throws(() => decoder.push([
    'data: [DONE]\n\n',
    'data: {"choices":[{"index":0,"delta":{"content":"late"},"finish_reason":null}]}\n\n',
  ].join('')), /after done/);
});

test('stream accumulator rejects unsafe tool names and non-object JSON arguments at finalization', () => {
  const unsafe = createChatStreamAccumulator();
  unsafe.accept({
    choices: [{ index: 0, delta: { tool_calls: [{
      index: 0, id: 'call-1', type: 'function', function: { name: '../escape', arguments: '{}' },
    }] }, finish_reason: 'tool_calls' }],
  });
  assert.throws(() => unsafe.finish(), /tool call name/);

  const malformed = createChatStreamAccumulator();
  malformed.accept({
    choices: [{ index: 0, delta: { tool_calls: [{
      index: 0, id: 'call-2', type: 'function', function: { name: 'submit_seller_proposal', arguments: '[]' },
    }] }, finish_reason: 'tool_calls' }],
  });
  assert.throws(() => malformed.finish(), /arguments must be a json object/);
});
