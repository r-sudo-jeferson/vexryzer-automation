import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOpenAiSse,
  type StructuredToolCall,
} from '../../tools/workshop-spike/provider-screen-protocol.ts';
import {
  buildReplayRequest,
  buildStreamRequest,
  buildToolRequest,
} from '../../tools/workshop-spike/provider-screen-request.ts';

const call: StructuredToolCall = {
  id: 'call-1',
  name: 'capture_signal',
  argumentsJson: '{"value":"marker"}',
  arguments: { value: 'marker' },
};

test('Groq protocol probes suppress emitted reasoning while Cloudflare requests stay on the common subset', () => {
  const groqStream = buildStreamRequest('openai/gpt-oss-120b', 'marker', 'groq');
  const groqTool = buildToolRequest('openai/gpt-oss-120b', 'marker', 'groq');
  const groqReplay = buildReplayRequest('openai/gpt-oss-120b', call, 'marker', 'groq');
  assert.equal(groqStream.include_reasoning, false);
  assert.equal(groqTool.include_reasoning, false);
  assert.equal(groqReplay.include_reasoning, false);

  const cloudflareStream = buildStreamRequest('@cf/zai-org/glm-4.7-flash', 'marker', 'cloudflare-workers-ai');
  assert.equal('include_reasoning' in cloudflareStream, false);
});

test('SSE protocol evidence distinguishes reasoning chunks from user-visible content without exposing reasoning text', () => {
  const parsed = parseOpenAiSse([
    'data: {"choices":[{"delta":{"reasoning":"private-analysis"}}]}',
    'data: {"choices":[{"delta":{"content":"marker"}}]}',
    'data: [DONE]',
    '',
  ].join('\n'));
  assert.deepEqual(parsed, {
    eventCount: 2,
    contentChunkCount: 1,
    reasoningChunkCount: 1,
    text: 'marker',
    done: true,
  });
  assert.equal(JSON.stringify(parsed).includes('private-analysis'), false);
});
