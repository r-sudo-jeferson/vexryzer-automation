import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimAgentSession,
  completeAgentSession,
  createAgentSession,
  digestSessionToken,
  sessionTokenMatches,
} from '../../src/server/session/agent-session.ts';

const entropy = {
  sessionId: () => 'session-test',
  token: () => 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-',
  leaseId: () => 'lease-one',
};

test('creates anonymous session with only a digest persisted and verifies the bearer token in constant-time path', () => {
  const created = createAgentSession(entropy);
  assert.equal(created.record.sessionId, 'session-test');
  assert.equal(created.record.canonical.revision, 0);
  assert.equal(created.record.reactiveState.basedOnRevision, 0);
  assert.notEqual(created.record.sessionTokenDigest, created.sessionToken);
  assert.equal(created.record.sessionTokenDigest, digestSessionToken(created.sessionToken));
  assert.equal(sessionTokenMatches(created.sessionToken, created.record.sessionTokenDigest), true);
  assert.equal(sessionTokenMatches('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123456789_-', created.record.sessionTokenDigest), false);
  assert.equal(JSON.stringify(created.record).includes(created.sessionToken), false);
});

test('claim is revision-bound and active lease blocks a concurrent request', () => {
  const created = createAgentSession(entropy);
  const stale = claimAgentSession(created.record, {
    requestId: 'request-stale',
    expectedRevision: 1,
    nowEpochMs: 1_000,
  }, entropy);
  assert.deepEqual(stale, { ok: false, code: 'STALE_REVISION' });

  const claimed = claimAgentSession(created.record, {
    requestId: 'request-one',
    expectedRevision: 0,
    nowEpochMs: 1_000,
  }, entropy);
  assert.equal(claimed.ok, true);
  if (!claimed.ok || claimed.idempotent) return;
  assert.equal(claimed.record.status, 'processing');
  assert.equal(claimed.record.lease?.leaseId, 'lease-one');

  const busy = claimAgentSession(claimed.record, {
    requestId: 'request-two',
    expectedRevision: 0,
    nowEpochMs: 2_000,
  }, { leaseId: () => 'lease-two' });
  assert.deepEqual(busy, { ok: false, code: 'SESSION_BUSY' });
});

test('expired lease can be stolen but the old lease can no longer complete the session', () => {
  const created = createAgentSession(entropy);
  const first = claimAgentSession(created.record, {
    requestId: 'request-one',
    expectedRevision: 0,
    nowEpochMs: 1_000,
  }, entropy);
  if (!first.ok || first.idempotent) throw new Error('expected first claim');

  const second = claimAgentSession(first.record, {
    requestId: 'request-two',
    expectedRevision: 0,
    nowEpochMs: 61_001,
  }, { leaseId: () => 'lease-two' });
  assert.equal(second.ok, true);
  if (!second.ok || second.idempotent) return;
  assert.equal(second.record.lease?.leaseId, 'lease-two');
  assert.equal(second.record.lease?.requestId, 'request-two');

  assert.throws(() => completeAgentSession(second.record, {
    leaseId: 'lease-one',
    canonical: second.record.canonical,
    reactiveState: second.record.reactiveState,
    recentTurns: second.record.recentTurns,
    completed: {
      requestId: 'request-two',
      inputRevision: 0,
      resultRevision: 0,
      mode: 'guided_recovery',
      narration: 'Recuperação segura.',
      nextQuestion: null,
    },
  }), /does not own/);
});

test('completed request becomes idempotent only while it remains the latest committed result', () => {
  const created = createAgentSession(entropy);
  const claimed = claimAgentSession(created.record, {
    requestId: 'request-one',
    expectedRevision: 0,
    nowEpochMs: 1_000,
  }, entropy);
  if (!claimed.ok || claimed.idempotent || claimed.record.lease === null) throw new Error('expected claim');

  const completed = completeAgentSession(claimed.record, {
    leaseId: claimed.record.lease.leaseId,
    canonical: claimed.record.canonical,
    reactiveState: claimed.record.reactiveState,
    recentTurns: [{ id: 'turn-one', role: 'user', text: 'Meu processo atual.' }],
    completed: {
      requestId: 'request-one',
      inputRevision: 0,
      resultRevision: 0,
      mode: 'guided_recovery',
      narration: 'Seu contexto foi preservado.',
      nextQuestion: 'Qual rotina mais consome tempo?',
    },
  });

  const replay = claimAgentSession(completed, {
    requestId: 'request-one',
    expectedRevision: 0,
    nowEpochMs: 2_000,
  }, { leaseId: () => 'must-not-run' });
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.idempotent, true);
  if (replay.idempotent) {
    assert.equal(replay.completed.narration, 'Seu contexto foi preservado.');
    assert.equal(replay.record, completed);
  }
});

test('record completion rejects request mismatch and keeps bounded immutable recent turns', () => {
  const created = createAgentSession(entropy);
  const claimed = claimAgentSession(created.record, {
    requestId: 'request-one',
    expectedRevision: 0,
    nowEpochMs: 1_000,
  }, entropy);
  if (!claimed.ok || claimed.idempotent || claimed.record.lease === null) throw new Error('expected claim');

  assert.throws(() => completeAgentSession(claimed.record, {
    leaseId: claimed.record.lease.leaseId,
    canonical: claimed.record.canonical,
    reactiveState: claimed.record.reactiveState,
    recentTurns: [],
    completed: {
      requestId: 'request-other',
      inputRevision: 0,
      resultRevision: 0,
      mode: 'agent',
      narration: 'Não pode completar.',
      nextQuestion: null,
    },
  }), /does not match lease/);
});
