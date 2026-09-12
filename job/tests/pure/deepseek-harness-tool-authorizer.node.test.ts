import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimAgentSession,
  createAgentSession,
  type AgentSessionRecord,
} from '../../src/server/session/agent-session.ts';
import {
  authorizeDeepSeekHarnessTool,
  type DeepSeekHarnessToolAuthorizationDependencies,
  type DeepSeekHarnessToolAuthorizationInput,
} from '../../src/server/ai/harness/deepseek-harness-tool-authorizer.ts';

function entropy(sessionId = 'session-harness-tool') {
  return {
    sessionId: () => sessionId,
    token: () => 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-',
    leaseId: () => 'lease-harness-tool',
  };
}

function processingSession(): Readonly<AgentSessionRecord> {
  const created = createAgentSession(entropy());
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

function authority(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-harness-tool',
    leaseId: 'lease-one',
    requestId: 'request-one',
    canonicalRevision: 0,
    nowEpochMs: 2_000,
    ...overrides,
  };
}

function sellerInput(
  overrides: Partial<DeepSeekHarnessToolAuthorizationInput> = {},
): DeepSeekHarnessToolAuthorizationInput {
  return {
    role: 'seller',
    callId: 'tool-call-one',
    toolName: 'request_calculations',
    arguments: {
      requests: [{
        kind: 'monthly_workload',
        occurrencesPerMonthObservationId: 'obs-one',
        minutesPerOccurrenceObservationId: 'obs-two',
      }],
    },
    authority: authority(),
    session: processingSession(),
    ...overrides,
  };
}

function parserSpies() {
  const calls = { seller: 0, critic: 0 };
  const dependencies: DeepSeekHarnessToolAuthorizationDependencies = {
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

test('Seller receives only semantic arguments while runtime authority stays out of model data', () => {
  const input = sellerInput();
  const result = authorizeDeepSeekHarnessTool(input);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.authorized.role, 'seller');
  if (result.authorized.role !== 'seller') return;
  assert.equal(result.authorized.parsed.kind, 'calculation_requests');
  assert.equal(result.authorized.parsed.toolCallId, 'tool-call-one');
  assert.equal(result.authorized.authority.canonicalRevision, 0);
  assert.equal(Object.hasOwn(input.arguments as object, 'sessionId'), false);
  assert.equal(Object.hasOwn(input.arguments as object, 'leaseId'), false);
  assert.equal(Object.hasOwn(input.arguments as object, 'canonicalRevision'), false);
});

test('session, lease, request and revision authority mismatches fail before parser execution', () => {
  const attacks = [
    ['SESSION_MISMATCH', authority({ sessionId: 'other-session' })],
    ['LEASE_MISMATCH', authority({ leaseId: 'other-lease' })],
    ['REQUEST_MISMATCH', authority({ requestId: 'other-request' })],
    ['STALE_REVISION', authority({ canonicalRevision: 1 })],
  ] as const;

  for (const [expectedCode, attackedAuthority] of attacks) {
    const { calls, dependencies } = parserSpies();
    const result = authorizeDeepSeekHarnessTool(sellerInput({
      authority: attackedAuthority,
      dependencies,
    }));
    assert.equal(result.ok, false, expectedCode);
    if (!result.ok) assert.equal(result.code, expectedCode);
    assert.deepEqual(calls, { seller: 0, critic: 0 }, expectedCode);
  }
});

test('idle and expired sessions fail before parser execution', () => {
  const idle = createAgentSession(entropy()).record;
  {
    const { calls, dependencies } = parserSpies();
    const result = authorizeDeepSeekHarnessTool(sellerInput({
      session: idle,
      dependencies,
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'LEASE_MISMATCH');
    assert.deepEqual(calls, { seller: 0, critic: 0 });
  }

  {
    const session = processingSession();
    assert.ok(session.lease);
    const { calls, dependencies } = parserSpies();
    const result = authorizeDeepSeekHarnessTool(sellerInput({
      session,
      authority: authority({ nowEpochMs: session.lease.expiresAtEpochMs }),
      dependencies,
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'LEASE_EXPIRED');
    assert.deepEqual(calls, { seller: 0, critic: 0 });
  }
});

test('cancellation and deadline abort before parser execution', () => {
  for (const [reason, code] of [
    [new DOMException('client disconnected', 'AbortError'), 'CANCELLED'],
    [new DOMException('deadline reached', 'TimeoutError'), 'DEADLINE_EXCEEDED'],
  ] as const) {
    const controller = new AbortController();
    controller.abort(reason);
    const { calls, dependencies } = parserSpies();
    const result = authorizeDeepSeekHarnessTool(sellerInput({
      signal: controller.signal,
      dependencies,
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, code);
    assert.deepEqual(calls, { seller: 0, critic: 0 });
  }
});

test('unknown or cross-role tools are denied before parser execution', () => {
  for (const [role, toolName] of [
    ['seller', 'submit_critic_review'],
    ['critic', 'request_calculations'],
    ['seller', 'unregistered_semantic_tool'],
  ] as const) {
    const { calls, dependencies } = parserSpies();
    const result = authorizeDeepSeekHarnessTool(sellerInput({
      role,
      toolName,
      dependencies,
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'UNAUTHORIZED_TOOL');
    assert.deepEqual(calls, { seller: 0, critic: 0 });
  }
});

test('tool argument bytes and call identity are bounded before parser execution', () => {
  {
    const { calls, dependencies } = parserSpies();
    const result = authorizeDeepSeekHarnessTool(sellerInput({
      callId: 'x'.repeat(257),
      dependencies,
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'INVALID_CALL_ID');
    assert.deepEqual(calls, { seller: 0, critic: 0 });
  }

  {
    const { calls, dependencies } = parserSpies();
    const result = authorizeDeepSeekHarnessTool(sellerInput({
      arguments: { requests: ['x'.repeat(1_000_001)] },
      dependencies,
    }));
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.code, 'ARGUMENT_LIMIT_EXCEEDED');
    assert.deepEqual(calls, { seller: 0, critic: 0 });
  }
});

test('Critic requires trusted proposal binding and existing deterministic parser validation', () => {
  const session = processingSession();
  const value = {
    review: {
      schemaVersion: 1,
      proposalId: 'proposal-one',
      basedOnRevision: 0,
      verdict: 'PASS',
      findings: [],
    },
  };

  const missing = authorizeDeepSeekHarnessTool({
    role: 'critic',
    callId: 'tool-call-critic',
    toolName: 'submit_critic_review',
    arguments: value,
    authority: authority(),
    session,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, 'MISSING_CRITIC_PROPOSAL_BINDING');

  const valid = authorizeDeepSeekHarnessTool({
    role: 'critic',
    callId: 'tool-call-critic',
    toolName: 'submit_critic_review',
    arguments: value,
    authority: authority(),
    expectedCriticProposalId: 'proposal-one',
    session,
  });
  assert.equal(valid.ok, true);
  if (!valid.ok || valid.authorized.role !== 'critic') return;
  assert.equal(valid.authorized.parsed.review.proposalId, 'proposal-one');
  assert.equal(valid.authorized.parsed.review.verdict, 'PASS');
});
