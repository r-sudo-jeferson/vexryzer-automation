import test from 'node:test';
import assert from 'node:assert/strict';
import { createReactiveExperienceState } from '../../src/experience/reactive-experience-state.ts';
import { createAgentSession, type AgentSessionRecord } from '../../src/server/session/agent-session.ts';
import type {
  AgentSessionRepository,
  SessionCompareAndSetResult,
  SessionCreateResult,
  VersionedAgentSession,
} from '../../src/server/session/session-repository.ts';
import {
  AGENT_EXECUTION_TIMEOUT_LIMITS,
  runStoredAgentTurn,
  startStoredAgentSession,
  type AgentRuntimeStaticConfig,
} from '../../src/server/session/stored-agent-turn-service.ts';

class MemoryRepository implements AgentSessionRepository {
  private readonly records = new Map<string, { record: Readonly<AgentSessionRecord>; version: number }>();
  conflictNextCompare = false;
  unavailable = false;

  async get(sessionId: string): Promise<Readonly<VersionedAgentSession> | null> {
    if (this.unavailable) throw new Error('store unavailable');
    const entry = this.records.get(sessionId);
    if (entry === undefined) return null;
    return Object.freeze({ record: entry.record, etag: `v${entry.version}` });
  }

  async create(record: Readonly<AgentSessionRecord>): Promise<SessionCreateResult> {
    if (this.unavailable) return { ok: false, code: 'STORE_UNAVAILABLE' };
    if (this.records.has(record.sessionId)) return { ok: false, code: 'ALREADY_EXISTS' };
    this.records.set(record.sessionId, { record, version: 1 });
    return { ok: true, etag: 'v1' };
  }

  async compareAndSet(
    sessionId: string,
    expectedEtag: string,
    record: Readonly<AgentSessionRecord>,
  ): Promise<SessionCompareAndSetResult> {
    if (this.unavailable) return { ok: false, code: 'STORE_UNAVAILABLE' };
    if (this.conflictNextCompare) {
      this.conflictNextCompare = false;
      return { ok: false, code: 'CONFLICT' };
    }
    const entry = this.records.get(sessionId);
    if (entry === undefined) return { ok: false, code: 'NOT_FOUND' };
    if (expectedEtag !== `v${entry.version}`) return { ok: false, code: 'CONFLICT' };
    const version = entry.version + 1;
    this.records.set(sessionId, { record, version });
    return { ok: true, etag: `v${version}` };
  }

  snapshot(sessionId: string): Readonly<AgentSessionRecord> | null {
    return this.records.get(sessionId)?.record ?? null;
  }
}

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';

function entropy(sessionId = 'session-service') {
  let lease = 0;
  return {
    sessionId: () => sessionId,
    token: () => TOKEN,
    leaseId: () => `lease-${++lease}`,
  };
}

function runtime(withRoutes = false): AgentRuntimeStaticConfig {
  return {
    executionTimeoutMs: AGENT_EXECUTION_TIMEOUT_LIMITS.maxMs,
    seller: {
      routes: withRoutes ? [{} as never] : [],
      routeBudgets: [],
      runtimeStates: [],
    } as never,
    critic: {
      routes: withRoutes ? [{} as never] : [],
      routeBudgets: [],
      runtimeStates: [],
    } as never,
  };
}

async function seeded(repository: MemoryRepository, sessionId = 'session-service') {
  const created = createAgentSession(entropy(sessionId));
  const result = await repository.create(created.record);
  assert.equal(result.ok, true);
  return created;
}

function request(sessionId: string, token = TOKEN, overrides: Record<string, unknown> = {}) {
  return {
    sessionId,
    sessionToken: token,
    requestId: 'request-one',
    expectedRevision: 0,
    text: 'Somos 3 pessoas no fechamento.',
    ...overrides,
  };
}

test('starts a server-authoritative anonymous session and never returns persisted token material', async () => {
  const repository = new MemoryRepository();
  const result = await startStoredAgentSession({ repository, entropy: entropy('session-start') });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.sessionId, 'session-start');
  assert.equal(result.sessionToken, TOKEN);
  assert.equal(result.revision, 0);

  const stored = repository.snapshot('session-start');
  assert.ok(stored);
  assert.equal(JSON.stringify(stored).includes(TOKEN), false);
  assert.equal(stored?.status, 'idle');
});

test('authentication and stale revision fail before session claim mutation', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);

  const unauthorized = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef0123456789_-'),
    runtime: runtime(),
    dependencies: { nowEpochMs: () => 1_000 },
  });
  assert.deepEqual(unauthorized, { ok: false, code: 'UNAUTHORIZED', currentRevision: null });
  assert.equal(repository.snapshot(created.record.sessionId)?.status, 'idle');

  const stale = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken, { expectedRevision: 1 }),
    runtime: runtime(),
    dependencies: { nowEpochMs: () => 1_000 },
  });
  assert.deepEqual(stale, { ok: false, code: 'STALE_REVISION', currentRevision: 0 });
  assert.equal(repository.snapshot(created.record.sessionId)?.status, 'idle');
});

test('claim CAS conflict prevents duplicated agent execution', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);
  repository.conflictNextCompare = true;
  let agentCalls = 0;

  const result = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken),
    runtime: runtime(true),
    dependencies: {
      nowEpochMs: () => 1_000,
      leaseId: () => 'lease-cas',
      runAgentLedTurn: (async () => {
        agentCalls += 1;
        throw new Error('must not execute after failed claim CAS');
      }) as never,
    },
  });

  assert.deepEqual(result, { ok: false, code: 'SESSION_CONFLICT', currentRevision: 0 });
  assert.equal(agentCalls, 0);
  assert.equal(repository.snapshot(created.record.sessionId)?.status, 'idle');
});

test('no eligible configured route uses deterministic guided recovery and preserves user input canonically', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);

  const result = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken),
    runtime: runtime(false),
    dependencies: { nowEpochMs: () => 1_000, leaseId: () => 'lease-recovery' },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.mode, 'guided_recovery');
  assert.equal(result.idempotent, false);
  assert.equal(result.state.canonicalRevision, 1);
  assert.equal(Object.hasOwn(result.state, 'canonical'), false);
  assert.deepEqual(result.state.verifiedCalculations, []);

  const stored = repository.snapshot(created.record.sessionId);
  assert.equal(stored?.canonical.latestUserIntent?.turnId, 'request-one');
  assert.equal(stored?.canonical.latestUserIntent?.text, 'Somos 3 pessoas no fechamento.');
  assert.equal(stored?.status, 'idle');
  assert.equal(stored?.lastCompletedRequest?.mode, 'guided_recovery');
  assert.equal(stored?.recentTurns.map((turn) => turn.role).join(','), 'user,assistant');
});

test('provider availability failure alone is converted to guided recovery', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);
  const result = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken),
    runtime: runtime(true),
    dependencies: {
      nowEpochMs: () => 1_000,
      leaseId: () => 'lease-provider',
      runAgentLedTurn: (async (input: { seller: { canonical: AgentSessionRecord['canonical'] }; reactiveState: AgentSessionRecord['reactiveState'] }) => ({
        ok: false,
        code: 'SELLER_FAILED',
        canonical: input.seller.canonical,
        reactiveState: input.reactiveState,
        detail: 'NO_ELIGIBLE_ROUTE',
        reviews: [],
      })) as never,
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.mode, 'guided_recovery');
  assert.equal(repository.snapshot(created.record.sessionId)?.status, 'idle');
});

for (const code of ['BLOCKED_BY_CRITIC', 'PUBLICATION_FAILED', 'CRITIC_GATE_REJECTED'] as const) {
  test(`${code} remains a failure and releases the lease without fabricating a completed response`, async () => {
    const repository = new MemoryRepository();
    const created = await seeded(repository);
    const result = await runStoredAgentTurn({
      repository,
      request: request(created.record.sessionId, created.sessionToken),
      runtime: runtime(true),
      dependencies: {
        nowEpochMs: () => 1_000,
        leaseId: () => 'lease-hard-failure',
        runAgentLedTurn: (async (input: { seller: { canonical: AgentSessionRecord['canonical'] }; reactiveState: AgentSessionRecord['reactiveState'] }) => ({
          ok: false,
          code,
          canonical: input.seller.canonical,
          reactiveState: input.reactiveState,
          detail: code,
          reviews: [],
        })) as never,
      },
    });

    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, 'AGENT_EXECUTION_FAILED');
      assert.equal(result.currentRevision, 1);
    }
    const stored = repository.snapshot(created.record.sessionId);
    assert.equal(stored?.status, 'idle');
    assert.equal(stored?.lastCompletedRequest, null);
    assert.equal(stored?.canonical.latestUserIntent?.turnId, 'request-one');
  });
}

test('unexpected agent exception releases lease but never becomes guided-recovery success', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);
  const result = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken),
    runtime: runtime(true),
    dependencies: {
      nowEpochMs: () => 1_000,
      leaseId: () => 'lease-throw',
      runAgentLedTurn: (async () => { throw new Error('unexpected'); }) as never,
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'AGENT_EXECUTION_FAILED');
  assert.equal(repository.snapshot(created.record.sessionId)?.status, 'idle');
  assert.equal(repository.snapshot(created.record.sessionId)?.lastCompletedRequest, null);
});

test('accepted agent result commits once and the exact retry returns the stored result idempotently', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);
  let calls = 0;
  const execute = (async (input: { seller: { canonical: AgentSessionRecord['canonical'] }; reactiveState: AgentSessionRecord['reactiveState'] }) => {
    calls += 1;
    return {
      ok: true,
      canonical: input.seller.canonical,
      reactiveState: createReactiveExperienceState({ basedOnRevision: input.seller.canonical.revision }),
      submission: {
        proposalId: 'proposal-one',
        proposal: {
          narration: 'Seu fechamento concentra trabalho manual recorrente.',
          intent: {
            nextQuestion: {
              text: 'Quantas conferências manuais acontecem por mês?',
            },
          },
        },
      },
      reviews: [],
      revised: false,
      sellerRouteIds: ['seller'],
      criticRouteIds: ['critic'],
      publication: {},
    };
  }) as never;

  const first = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken),
    runtime: runtime(true),
    dependencies: { nowEpochMs: () => 1_000, leaseId: () => 'lease-success', runAgentLedTurn: execute },
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.mode, 'agent');
  assert.equal(first.idempotent, false);
  assert.equal(first.state.canonicalRevision, 1);
  assert.equal(first.narration, 'Seu fechamento concentra trabalho manual recorrente.');
  assert.equal(first.nextQuestion, 'Quantas conferências manuais acontecem por mês?');

  const replay = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken, { expectedRevision: 1 }),
    runtime: runtime(true),
    dependencies: { nowEpochMs: () => 2_000, leaseId: () => 'lease-never', runAgentLedTurn: execute },
  });
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.idempotent, true);
  assert.equal(replay.narration, first.narration);
  assert.equal(replay.nextQuestion, first.nextQuestion);
  assert.equal(calls, 1);
});

test('final CAS conflict discards the local response instead of claiming success', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);
  let compareCount = 0;
  const original = repository.compareAndSet.bind(repository);
  repository.compareAndSet = async (...args) => {
    compareCount += 1;
    if (compareCount === 2) return { ok: false, code: 'CONFLICT' as const };
    return original(...args);
  };

  const result = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken),
    runtime: runtime(false),
    dependencies: { nowEpochMs: () => 1_000, leaseId: () => 'lease-final-cas' },
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'SESSION_CONFLICT');
  assert.equal(compareCount, 2);
  assert.equal(repository.snapshot(created.record.sessionId)?.status, 'processing');
});

test('invalid global agent deadline fails before claiming or mutating the stored session', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);
  const invalidRuntime: AgentRuntimeStaticConfig = {
    ...runtime(true),
    executionTimeoutMs: AGENT_EXECUTION_TIMEOUT_LIMITS.maxMs + 1,
  };

  const result = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken),
    runtime: invalidRuntime,
  });

  assert.deepEqual(result, {
    ok: false,
    code: 'AGENT_EXECUTION_FAILED',
    currentRevision: null,
  });
  assert.equal(repository.snapshot(created.record.sessionId)?.status, 'idle');
  assert.equal(repository.snapshot(created.record.sessionId)?.canonical.revision, 0);
});

test('request cancellation fails before claiming or spending provider budget', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);
  const controller = new AbortController();
  controller.abort(new DOMException('client disconnected', 'AbortError'));

  const result = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken),
    runtime: runtime(true),
    signal: controller.signal,
  });

  assert.deepEqual(result, {
    ok: false,
    code: 'AGENT_EXECUTION_FAILED',
    currentRevision: null,
  });
  assert.equal(repository.snapshot(created.record.sessionId)?.status, 'idle');
  assert.equal(repository.snapshot(created.record.sessionId)?.canonical.revision, 0);
});

test('Seller and Critic share the same bounded execution signal', async () => {
  const repository = new MemoryRepository();
  const created = await seeded(repository);
  let sellerSignal: AbortSignal | undefined;
  let criticSignal: AbortSignal | undefined;

  const result = await runStoredAgentTurn({
    repository,
    request: request(created.record.sessionId, created.sessionToken),
    runtime: runtime(true),
    dependencies: {
      nowEpochMs: () => 1_000,
      leaseId: () => 'lease-shared-signal',
      runAgentLedTurn: (async (input: {
        seller: { canonical: AgentSessionRecord['canonical']; signal?: AbortSignal };
        critic: { signal?: AbortSignal };
        reactiveState: AgentSessionRecord['reactiveState'];
      }) => {
        sellerSignal = input.seller.signal;
        criticSignal = input.critic.signal;
        return {
          ok: false,
          code: 'SELLER_FAILED',
          canonical: input.seller.canonical,
          reactiveState: input.reactiveState,
          detail: 'PROVIDER_FAILED',
          reviews: [],
        };
      }) as never,
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.mode, 'guided_recovery');
  assert.ok(sellerSignal);
  assert.equal(sellerSignal, criticSignal);
  assert.equal(sellerSignal.aborted, false);
});

