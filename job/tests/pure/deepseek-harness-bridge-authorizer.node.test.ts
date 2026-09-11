import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimAgentSession,
  createAgentSession,
  type AgentSessionRecord,
} from '../../src/server/session/agent-session.ts';
import {
  authorizeDeepSeekHarnessBridgeTool,
  type DeepSeekHarnessBridgeAuthorizationDependencies,
} from '../../src/server/ai/harness/deepseek-harness-bridge-authorizer.ts';
import { deriveDeepSeekHarnessSessionId } from '../../src/server/ai/harness/deepseek-harness-bridge-protocol.ts';

function entropy(sessionId = 'session-bridge') {
  return {
    sessionId: () => sessionId,
    token: () => 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-',
    leaseId: () => 'unused-lease',
  };
}

function processingSession(sessionId = 'session-bridge'): Readonly<AgentSessionRecord> {
  const created = createAgentSession(entropy(sessionId));
  const claimed = claimAgentSession(created.record, {
    requestId: 'request-one',
    expectedRevision: 0,
    nowEpochMs: 1_000,
  }, {
    leaseId: () => 'lease-one',
  });
  if (!claimed.ok || claimed.idempotent) throw new Error('failed to seed processing session');
  return claimed.record;
}

function sellerRequest(overrides: Record<string, unknown> = {}) {
  const sessionId = typeof overrides['sessionId'] === 'string'
    ? overrides['sessionId']
    : 'session-bridge';
  return {
    schemaVersion: 1,
    bridgeRequestId: 'bridge-one',
    sessionId,
    harnessSessionId: deriveDeepSeekHarnessSessionId(sessionId, 'seller'),
    leaseId: 'lease-one',
    requestId: 'request-one',
    canonicalRevision: 0,
    role: 'seller',
    toolName: 'request_calculations',
    args: {
      requests: [{
        kind: 'monthly_workload',
        occurrencesPerMonthObservationId: 'obs-one',
        minutesPerOccurrenceObservationId: 'obs-two',
      }],
    },
    ...overrides,
  };
}

function criticRequest(overrides: Record<string, unknown> = {}) {
  const sessionId = typeof overrides['sessionId'] === 'string'
    ? overrides['sessionId']
    : 'session-bridge';
  return {
    schemaVersion: 1,
    bridgeRequestId: 'bridge-critic',
    sessionId,
    harnessSessionId: deriveDeepSeekHarnessSessionId(sessionId, 'critic'),
    leaseId: 'lease-one',
    requestId: 'request-one',
    canonicalRevision: 0,
    role: 'critic',
    toolName: 'submit_critic_review',
    args: {
      review: {
        schemaVersion: 1,
        proposalId: 'proposal-one',
        basedOnRevision: 0,
        verdict: 'PASS',
        findings: [],
      },
    },
    ...overrides,
  };
}

function parserSpies() {
  const calls = { seller: 0, critic: 0 };
  const dependencies: DeepSeekHarnessBridgeAuthorizationDependencies = {
    parseSellerToolCall: ((..._args: unknown[]) => {
      calls.seller += 1;
      return { ok: false, code: 'INVALID_ARGUMENTS' };
    }) as never,
    parseCriticReviewToolCall: ((..._args: unknown[]) => {
      calls.critic += 1;
      return { ok: false, code: 'INVALID_ARGUMENTS' };
    }) as never,
  };
  return { calls, dependencies };
}

test('authorized Seller bridge call reaches the existing deterministic parser only after session authority passes', () => {
  const session = processingSession();
  const result = authorizeDeepSeekHarnessBridgeTool({
    value: sellerRequest(),
    session,
    nowEpochMs: 2_000,
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.authorized.role, 'seller');
  if (result.authorized.role !== 'seller') return;
  assert.equal(result.authorized.parsed.kind, 'calculation_requests');
  assert.equal(result.authorized.parsed.toolCallId, 'bridge-one');
  assert.equal(result.authorized.parsed.requests.length, 1);
  assert.equal(session.canonical.revision, 0);
});

test('idle session fails closed before any Seller or Critic parser runs', () => {
  const created = createAgentSession(entropy());
  const { calls, dependencies } = parserSpies();
  const result = authorizeDeepSeekHarnessBridgeTool({
    value: sellerRequest(),
    session: created.record,
    nowEpochMs: 2_000,
    dependencies,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.stage, 'authority');
  if (result.stage === 'authority') assert.equal(result.response.code, 'LEASE_MISMATCH');
  assert.deepEqual(calls, { seller: 0, critic: 0 });
});

test('session, lease, request and revision mismatches fail before parser execution', () => {
  const session = processingSession();
  const attacks = [
    {
      name: 'session',
      value: sellerRequest(),
      actualSession: processingSession('other-session'),
      code: 'SESSION_MISMATCH',
    },
    {
      name: 'lease',
      value: sellerRequest({ leaseId: 'lease-other' }),
      actualSession: session,
      code: 'LEASE_MISMATCH',
    },
    {
      name: 'request',
      value: sellerRequest({ requestId: 'request-other' }),
      actualSession: session,
      code: 'REQUEST_MISMATCH',
    },
    {
      name: 'revision',
      value: sellerRequest({ canonicalRevision: 1 }),
      actualSession: session,
      code: 'STALE_REVISION',
    },
  ] as const;

  for (const attack of attacks) {
    const { calls, dependencies } = parserSpies();
    const result = authorizeDeepSeekHarnessBridgeTool({
      value: attack.value,
      session: attack.actualSession,
      nowEpochMs: 2_000,
      dependencies,
    });
    assert.equal(result.ok, false, attack.name);
    if (result.ok) continue;
    assert.equal(result.stage, 'authority', attack.name);
    if (result.stage === 'authority') assert.equal(result.response.code, attack.code, attack.name);
    assert.deepEqual(calls, { seller: 0, critic: 0 }, attack.name);
  }
});

test('expired lease fails before parser execution', () => {
  const session = processingSession();
  assert.ok(session.lease);
  const { calls, dependencies } = parserSpies();
  const result = authorizeDeepSeekHarnessBridgeTool({
    value: sellerRequest(),
    session,
    nowEpochMs: session.lease.expiresAtEpochMs,
    dependencies,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.stage, 'authority');
  if (result.stage === 'authority') assert.equal(result.response.code, 'LEASE_EXPIRED');
  assert.deepEqual(calls, { seller: 0, critic: 0 });
});

test('client cancellation and global deadline fail before parser execution', () => {
  const session = processingSession();

  for (const [reason, expected] of [
    [new DOMException('client disconnected', 'AbortError'), 'CANCELLED'],
    [new DOMException('deadline reached', 'TimeoutError'), 'DEADLINE_EXCEEDED'],
  ] as const) {
    const controller = new AbortController();
    controller.abort(reason);
    const { calls, dependencies } = parserSpies();
    const result = authorizeDeepSeekHarnessBridgeTool({
      value: sellerRequest(),
      session,
      nowEpochMs: 2_000,
      signal: controller.signal,
      dependencies,
    });
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.stage, 'authority');
    if (result.stage === 'authority') assert.equal(result.response.code, expected);
    assert.deepEqual(calls, { seller: 0, critic: 0 });
  }
});

test('protocol-invalid request never reaches the authority or parser stages', () => {
  const session = processingSession();
  const { calls, dependencies } = parserSpies();
  const result = authorizeDeepSeekHarnessBridgeTool({
    value: { ...sellerRequest(), extra: true },
    session,
    nowEpochMs: 2_000,
    dependencies,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.stage, 'protocol');
  assert.deepEqual(calls, { seller: 0, critic: 0 });
});

test('tool-level validation remains delegated to existing Seller parser after authority succeeds', () => {
  const session = processingSession();
  const result = authorizeDeepSeekHarnessBridgeTool({
    value: sellerRequest({ args: { requests: [] } }),
    session,
    nowEpochMs: 2_000,
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.stage, 'tool');
  if (result.stage !== 'tool') return;
  assert.equal(result.parserCode, 'LIMIT_EXCEEDED');
  assert.equal(result.response.code, 'INVALID_ARGUMENTS');
  assert.equal(session.canonical.revision, 0);
});

test('Critic bridge requires exact proposal binding and preserves Critic validation', () => {
  const session = processingSession();

  const missing = authorizeDeepSeekHarnessBridgeTool({
    value: criticRequest(),
    session,
    nowEpochMs: 2_000,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok && missing.stage === 'tool') {
    assert.equal(missing.parserCode, 'MISSING_CRITIC_PROPOSAL_BINDING');
    assert.equal(missing.response.code, 'EXECUTION_REJECTED');
  }

  const stale = authorizeDeepSeekHarnessBridgeTool({
    value: criticRequest(),
    session,
    nowEpochMs: 2_000,
    expectedCriticProposalId: 'proposal-other',
  });
  assert.equal(stale.ok, false);
  if (!stale.ok && stale.stage === 'tool') {
    assert.equal(stale.parserCode, 'STALE_REVIEW');
    assert.equal(stale.response.code, 'INVALID_ARGUMENTS');
  }

  const valid = authorizeDeepSeekHarnessBridgeTool({
    value: criticRequest(),
    session,
    nowEpochMs: 2_000,
    expectedCriticProposalId: 'proposal-one',
  });
  assert.equal(valid.ok, true);
  if (!valid.ok) return;
  assert.equal(valid.authorized.role, 'critic');
  if (valid.authorized.role !== 'critic') return;
  assert.equal(valid.authorized.parsed.review.verdict, 'PASS');
  assert.equal(valid.authorized.parsed.review.proposalId, 'proposal-one');
});
