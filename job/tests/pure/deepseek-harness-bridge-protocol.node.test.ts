import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEEPSEEK_HARNESS_BRIDGE_LIMITS,
  deriveDeepSeekHarnessSessionId,
  validateDeepSeekHarnessBridgeRequest,
  validateDeepSeekHarnessBridgeResponse,
} from '../../src/server/ai/harness/deepseek-harness-bridge-protocol.ts';

const sessionId = 'session-bridge';
const sellerHarnessSessionId = deriveDeepSeekHarnessSessionId(sessionId, 'seller');

function sellerRequest(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    bridgeRequestId: 'bridge-one',
    sessionId,
    harnessSessionId: sellerHarnessSessionId,
    leaseId: 'lease-one',
    requestId: 'request-one',
    canonicalRevision: 7,
    role: 'seller',
    toolName: 'request_calculations',
    args: { requests: [] },
    ...overrides,
  };
}

test('Harness session binding is deterministic, bounded and isolated by role', () => {
  const seller = deriveDeepSeekHarnessSessionId(sessionId, 'seller');
  const sellerAgain = deriveDeepSeekHarnessSessionId(sessionId, 'seller');
  const critic = deriveDeepSeekHarnessSessionId(sessionId, 'critic');

  assert.equal(seller, sellerAgain);
  assert.notEqual(seller, critic);
  assert.match(seller, /^vxa-seller-[a-f0-9]{40}$/);
  assert.match(critic, /^vxa-critic-[a-f0-9]{40}$/);
  assert.ok(seller.length <= DEEPSEEK_HARNESS_BRIDGE_LIMITS.idLength);
  assert.throws(() => deriveDeepSeekHarnessSessionId('not valid', 'seller'), /invalid Vexryzer session id/);
});

test('valid Seller bridge request preserves only bounded protocol fields', () => {
  const result = validateDeepSeekHarnessBridgeRequest(sellerRequest());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.request.role, 'seller');
  assert.equal(result.request.toolName, 'request_calculations');
  assert.equal(result.request.canonicalRevision, 7);
  assert.deepEqual(result.request.args, { requests: [] });
  assert.equal(Object.isFrozen(result.request), true);
  assert.equal(Object.isFrozen(result.request.args), true);
});

test('bridge rejects cross-role tool use and mismatched Harness session binding', () => {
  assert.deepEqual(
    validateDeepSeekHarnessBridgeRequest(sellerRequest({
      role: 'critic',
      harnessSessionId: deriveDeepSeekHarnessSessionId(sessionId, 'critic'),
    })),
    { ok: false, code: 'UNAUTHORIZED_TOOL', path: 'request.toolName' },
  );

  assert.deepEqual(
    validateDeepSeekHarnessBridgeRequest(sellerRequest({
      harnessSessionId: deriveDeepSeekHarnessSessionId('other-session', 'seller'),
    })),
    { ok: false, code: 'INVALID_HARNESS_SESSION', path: 'request.harnessSessionId' },
  );
});

test('bridge rejects protocol extras and tool-argument envelope extras before execution', () => {
  assert.deepEqual(
    validateDeepSeekHarnessBridgeRequest({
      ...sellerRequest(),
      extraAuthority: 'not-allowed',
    }),
    { ok: false, code: 'INVALID_SHAPE', path: 'request' },
  );

  assert.deepEqual(
    validateDeepSeekHarnessBridgeRequest(sellerRequest({
      args: { requests: [], extraAuthority: true },
    })),
    { ok: false, code: 'INVALID_SHAPE', path: 'request.args' },
  );
});

test('bridge rejects malformed ids, stale-shaped revisions and non-JSON values', () => {
  assert.deepEqual(
    validateDeepSeekHarnessBridgeRequest(sellerRequest({ leaseId: '../lease' })),
    { ok: false, code: 'INVALID_ID', path: 'request.leaseId' },
  );

  assert.deepEqual(
    validateDeepSeekHarnessBridgeRequest(sellerRequest({ canonicalRevision: -1 })),
    { ok: false, code: 'INVALID_REVISION', path: 'request.canonicalRevision' },
  );

  assert.deepEqual(
    validateDeepSeekHarnessBridgeRequest(sellerRequest({
      args: { requests: [Number.NaN] },
    })),
    { ok: false, code: 'INVALID_JSON', path: 'request.args.requests[0]' },
  );
});

test('bridge enforces argument byte and nesting budgets', () => {
  assert.deepEqual(
    validateDeepSeekHarnessBridgeRequest(sellerRequest({
      args: { requests: ['x'.repeat(DEEPSEEK_HARNESS_BRIDGE_LIMITS.argumentBytes)] },
    })),
    { ok: false, code: 'LIMIT_EXCEEDED', path: 'request.args' },
  );

  let nested: unknown = 'leaf';
  for (let index = 0; index < DEEPSEEK_HARNESS_BRIDGE_LIMITS.jsonDepth + 2; index += 1) {
    nested = [nested];
  }
  const nestedResult = validateDeepSeekHarnessBridgeRequest(sellerRequest({
    args: { requests: nested },
  }));
  assert.equal(nestedResult.ok, false);
  if (!nestedResult.ok) assert.equal(nestedResult.code, 'LIMIT_EXCEEDED');
});

test('bridge response accepts bounded deterministic result and stable error only', () => {
  const success = validateDeepSeekHarnessBridgeResponse({
    schemaVersion: 1,
    bridgeRequestId: 'bridge-one',
    toolName: 'request_calculations',
    ok: true,
    canonicalRevision: 8,
    result: { calculations: [{ id: 'calc-one', value: 12 }] },
  });
  assert.equal(success.ok, true);

  const failure = validateDeepSeekHarnessBridgeResponse({
    schemaVersion: 1,
    bridgeRequestId: 'bridge-one',
    toolName: 'request_calculations',
    ok: false,
    canonicalRevision: 7,
    code: 'STALE_REVISION',
  });
  assert.equal(failure.ok, true);

  assert.deepEqual(
    validateDeepSeekHarnessBridgeResponse({
      schemaVersion: 1,
      bridgeRequestId: 'bridge-one',
      toolName: 'request_calculations',
      ok: false,
      canonicalRevision: 7,
      code: 'RAW_PROVIDER_FAILURE',
    }),
    { ok: false, code: 'INVALID_SHAPE', path: 'response.code' },
  );
});
