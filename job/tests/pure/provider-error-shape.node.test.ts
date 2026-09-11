import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSafeProviderErrorShape } from '../../tools/provider-diagnostics/provider-error-shape.ts';

test('extracts only bounded provider error metadata and never emits message or failed-generation values', () => {
  const secret = 'customer-private-payload-123';
  const result = extractSafeProviderErrorShape({
    id: 'evt-1',
    error: {
      message: secret,
      type: 'invalid_request_error',
      code: 'tool_use_failed',
      status: 400,
      failed_generation: {
        reason: 'Tool call arguments are invalid',
        attempted_arguments: secret,
        tool_call_id: 'call-private',
      },
    },
  });
  assert.deepEqual(result, {
    topLevelKeys: ['error', 'id'],
    errorKeys: ['code', 'failed_generation', 'message', 'status', 'type'],
    errorType: 'invalid_request_error',
    errorCode: 'tool_use_failed',
    errorStatus: 400,
    hasMessage: true,
    hasFailedGeneration: true,
    failedGenerationKeys: ['attempted_arguments', 'reason', 'tool_call_id'],
  });
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(JSON.stringify(result).includes('call-private'), false);
  assert.equal(JSON.stringify(result).includes('Tool call arguments are invalid'), false);
});

test('rejects unsafe token values while retaining harmless shape evidence', () => {
  const result = extractSafeProviderErrorShape({
    error: {
      type: 'invalid request with spaces and private text',
      code: '../unsafe/private',
      message: 'private',
    },
  });
  assert.deepEqual(result, {
    topLevelKeys: ['error'],
    errorKeys: ['code', 'message', 'type'],
    errorType: null,
    errorCode: null,
    errorStatus: null,
    hasMessage: true,
    hasFailedGeneration: false,
    failedGenerationKeys: [],
  });
});

test('non-error provider chunks produce no diagnostic', () => {
  assert.equal(extractSafeProviderErrorShape({ choices: [] }), null);
  assert.equal(extractSafeProviderErrorShape(null), null);
});
