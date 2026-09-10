import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertMinimalHarnessContinuationSurface,
  assertMinimalHarnessRequestSurface,
  inspectHarnessEvents,
  hasToolRoundTrip,
  hasStreamingChunks,
} from '../../tools/workshop-spike/harness-evidence.ts';

const events = [
  { type: 'turn/start', seq: 1, time: 1, data: { turn: 1 } },
  { type: 'step/start', seq: 2, time: 2, data: { turn: 1, step: 1 } },
  { type: 'request/header', seq: 3, time: 3, data: { header: { system: 'bounded-system', tools: [{ name: 'bash' }] }, reason: 'initial' } },
  { type: 'assistant/chunk', seq: 4, time: 4, data: { turn: 1, step: 1, chunk: { type: 'text-delta', text: 'a' } } },
  { type: 'assistant/chunk', seq: 5, time: 5, data: { turn: 1, step: 1, chunk: { type: 'text-delta', text: 'b' } } },
  { type: 'tool/call', seq: 6, time: 6, data: { turn: 1, step: 1, callId: 'call-1', name: 'bash', arguments: '{"command":"printf probe"}' } },
  { type: 'tool/result', seq: 7, time: 7, data: { turn: 1, step: 1, message: { toolCallId: 'call-1', content: [{ type: 'text', text: 'probe' }] } } },
  { type: 'assistant/message', seq: 8, time: 8, data: { turn: 1, step: 1, message: { content: [] }, usage: { inputTokens: 1200, outputTokens: 50, cacheReadTokens: 100, cacheWriteTokens: 25 } } },
  { type: 'assistant/attempt', seq: 9, time: 9, data: { turn: 1, step: 1, stream: [] } },
  { type: 'step/end', seq: 10, time: 10, data: { turn: 1, step: 1 } },
  { type: 'turn/end', seq: 11, time: 11, data: { turn: 1, reason: { kind: 'completed' } } },
] as const;

test('extracts only bounded evidence from Harness session events', () => {
  assert.deepEqual(inspectHarnessEvents(events), {
    assistantChunkCount: 2,
    assistantMessageCount: 1,
    assistantAttemptCount: 1,
    stepStartCount: 1,
    stepEndCount: 1,
    requestHeaderCount: 1,
    toolCallCount: 1,
    toolResultCount: 1,
    toolErrorCount: 0,
    toolErrorCodes: [],
    turnErrorCodes: [],
    turnErrorStatuses: [],
    reportedInputTokens: 1200,
    reportedOutputTokens: 50,
    reportedCacheReadTokens: 100,
    reportedCacheWriteTokens: 25,
    maxSystemPromptChars: 'bounded-system'.length,
    maxToolSchemaCount: 1,
    structuredToolArguments: true,
    turnCompleted: true,
    turnEndReasons: ['completed'],
    toolNames: ['bash'],
  });
  assert.equal(JSON.stringify(inspectHarnessEvents(events)).includes('bounded-system'), false);
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

test('reports tool failure codes without exposing result content', () => {
  const failed = [
    { type: 'tool/call', data: { callId: 'call-9', name: 'bash', arguments: '{"command":"probe"}' } },
    {
      type: 'tool/result',
      data: {
        message: { toolCallId: 'call-9', content: [{ type: 'text', text: 'sensitive-result' }] },
        error: { name: 'ToolExecutionError', code: 'PERMISSION_DENIED' },
      },
    },
    { type: 'turn/end', data: { reason: { kind: 'error' } } },
  ];
  const evidence = inspectHarnessEvents(failed);
  assert.equal(evidence.toolErrorCount, 1);
  assert.deepEqual(evidence.toolErrorCodes, ['PERMISSION_DENIED']);
  assert.deepEqual(evidence.turnEndReasons, ['error']);
  assert.equal(JSON.stringify(evidence).includes('sensitive-result'), false);
});

test('reports bounded turn failure facts without exposing provider error text', () => {
  const failed = [
    { type: 'assistant/chunk', data: { chunk: { type: 'text-delta', text: 'partial' } } },
    {
      type: 'turn/end',
      data: {
        reason: {
          kind: 'error',
          error: {
            message: 'sensitive provider detail',
            code: 'INVALID_REQUEST',
            status: 400,
            requestId: 'req-private',
          },
        },
      },
    },
  ];
  const evidence = inspectHarnessEvents(failed);
  assert.deepEqual(evidence.turnErrorCodes, ['INVALID_REQUEST']);
  assert.deepEqual(evidence.turnErrorStatuses, [400]);
  assert.equal(JSON.stringify(evidence).includes('sensitive provider detail'), false);
  assert.equal(JSON.stringify(evidence).includes('req-private'), false);
});

test('reports bounded request pressure and provider token usage without exposing prompt text', () => {
  const pressure = [
    { type: 'step/start', data: { turn: 1, step: 1 } },
    { type: 'request/header', data: { header: { system: 'private-system-prompt', tools: [{ name: 'a' }, { name: 'b' }] }, reason: 'initial' } },
    { type: 'assistant/message', data: { turn: 1, step: 1, message: { content: [] }, usage: { inputTokens: 1234, outputTokens: 56, cacheReadTokens: 78, cacheWriteTokens: 9 } } },
    { type: 'step/end', data: { turn: 1, step: 1 } },
  ];
  const evidence = inspectHarnessEvents(pressure);
  assert.equal(evidence.stepStartCount, 1);
  assert.equal(evidence.stepEndCount, 1);
  assert.equal(evidence.requestHeaderCount, 1);
  assert.equal(evidence.assistantMessageCount, 1);
  assert.equal(evidence.reportedInputTokens, 1234);
  assert.equal(evidence.reportedOutputTokens, 56);
  assert.equal(evidence.reportedCacheReadTokens, 78);
  assert.equal(evidence.reportedCacheWriteTokens, 9);
  assert.equal(evidence.maxSystemPromptChars, 'private-system-prompt'.length);
  assert.equal(evidence.maxToolSchemaCount, 2);
  assert.equal(JSON.stringify(evidence).includes('private-system-prompt'), false);
});

test('accepts the official sdk-minimal two-tool request surface', () => {
  const minimal = inspectHarnessEvents([
    { type: 'request/header', data: { header: { system: 'small', tools: [{ name: 'bash' }, { name: 'str_replace_editor' }] } } },
  ]);
  assert.doesNotThrow(() => assertMinimalHarnessRequestSurface(minimal));
});

test('accepts an append-only continuation that inherits the prior minimal request header', () => {
  const prior = inspectHarnessEvents([
    { type: 'request/header', data: { header: { system: 'small', tools: [{ name: 'bash' }, { name: 'str_replace_editor' }] }, reason: 'initial' } },
  ]);
  const continuation = inspectHarnessEvents([
    { type: 'turn/start', data: { turn: 2 } },
    { type: 'step/start', data: { turn: 2, step: 1 } },
    { type: 'tool/call', data: { turn: 2, step: 1, callId: 'call-2', name: 'str_replace_editor', arguments: '{"command":"view","path":"/tmp/probe"}' } },
    { type: 'tool/result', data: { turn: 2, step: 1, message: { toolCallId: 'call-2' } } },
    { type: 'turn/end', data: { turn: 2, reason: { kind: 'completed' } } },
  ]);
  assert.equal(continuation.requestHeaderCount, 0);
  assert.doesNotThrow(() => assertMinimalHarnessContinuationSurface(prior, continuation));
});

test('validates a continuation request header when the Harness emits one', () => {
  const prior = inspectHarnessEvents([
    { type: 'request/header', data: { header: { tools: [{ name: 'bash' }, { name: 'str_replace_editor' }] }, reason: 'initial' } },
  ]);
  const changedToFull = inspectHarnessEvents([
    { type: 'request/header', data: { header: { tools: Array.from({ length: 26 }, () => ({})) }, reason: 'change' } },
  ]);
  assert.throws(
    () => assertMinimalHarnessContinuationSurface(prior, changedToFull),
    /expected exactly 2 tool schemas/,
  );
});

test('rejects inherited continuation if the prior request surface was not minimal', () => {
  const priorFull = inspectHarnessEvents([
    { type: 'request/header', data: { header: { tools: Array.from({ length: 26 }, () => ({})) }, reason: 'initial' } },
  ]);
  const continuation = inspectHarnessEvents([]);
  assert.throws(
    () => assertMinimalHarnessContinuationSurface(priorFull, continuation),
    /expected exactly 2 tool schemas/,
  );
});

test('rejects a full-sdk request surface before provider evidence can be accepted', () => {
  const full = inspectHarnessEvents([
    { type: 'request/header', data: { header: { system: 'large', tools: Array.from({ length: 26 }, () => ({})) } } },
  ]);
  assert.throws(
    () => assertMinimalHarnessRequestSurface(full),
    /expected exactly 2 tool schemas/,
  );
});
