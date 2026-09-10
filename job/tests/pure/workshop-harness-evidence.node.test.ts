import assert from 'node:assert/strict';
import test from 'node:test';
import {
  inspectHarnessEvents,
  hasToolRoundTrip,
  hasStreamingChunks,
} from '../../tools/workshop-spike/harness-evidence.ts';

const events = [
  { type: 'turn/start', seq: 1, time: 1, data: { turn: 1 } },
  { type: 'assistant/chunk', seq: 2, time: 2, data: { turn: 1, step: 1, chunk: { type: 'text-delta', text: 'a' } } },
  { type: 'assistant/chunk', seq: 3, time: 3, data: { turn: 1, step: 1, chunk: { type: 'text-delta', text: 'b' } } },
  { type: 'tool/call', seq: 4, time: 4, data: { turn: 1, step: 1, callId: 'call-1', name: 'bash', arguments: '{"command":"printf probe"}' } },
  { type: 'tool/result', seq: 5, time: 5, data: { turn: 1, step: 1, message: { toolCallId: 'call-1', content: [{ type: 'text', text: 'probe' }] } } },
  { type: 'turn/end', seq: 6, time: 6, data: { turn: 1, reason: { kind: 'completed' } } },
] as const;

test('extracts only bounded evidence from Harness session events', () => {
  assert.deepEqual(inspectHarnessEvents(events), {
    assistantChunkCount: 2,
    toolCallCount: 1,
    toolResultCount: 1,
    structuredToolArguments: true,
    turnCompleted: true,
    toolNames: ['bash'],
  });
});

test('detects streaming and a complete tool round trip', () => {
  assert.equal(hasStreamingChunks(events), true);
  assert.equal(hasToolRoundTrip(events), true);
});

test('rejects malformed JSON tool arguments as structured evidence', () => {
  const malformed = events.map((event) => event.type === 'tool/call'
    ? { ...event, data: { ...event.data, arguments: '{bad' } }
    : event);
  assert.equal(inspectHarnessEvents(malformed).structuredToolArguments, false);
});

test('does not infer a tool round trip from unrelated tool counts', () => {
  const unrelated = [
    { type: 'tool/call', data: { callId: 'call-1', name: 'bash', arguments: '{}' } },
    { type: 'tool/result', data: { message: { toolCallId: 'call-2' } } },
  ];
  assert.equal(hasToolRoundTrip(unrelated), false);
});
