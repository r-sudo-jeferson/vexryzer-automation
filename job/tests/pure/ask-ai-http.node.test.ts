import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimAgentSession,
  createAgentSession,
  type AgentSessionRecord,
} from '../../src/server/session/agent-session.ts';
import type {
  AgentSessionRepository,
  SessionCompareAndSetResult,
  SessionCreateResult,
  VersionedAgentSession,
} from '../../src/server/session/session-repository.ts';
import {
  handleAskAiCorrection,
  handleAskAiSessionStart,
  handleAskAiTurn,
} from '../../src/server/session/ask-ai-http.ts';
import type { AgentRuntimeStaticConfig } from '../../src/server/session/stored-agent-turn-service.ts';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';
const ORIGIN = 'https://vexryzer.example';

class MemoryRepository implements AgentSessionRepository {
  private readonly records = new Map<string, { record: Readonly<AgentSessionRecord>; version: number }>();
  conflictNextCompare = false;
  unavailable = false;
  creates = 0;

  async get(sessionId: string): Promise<Readonly<VersionedAgentSession> | null> {
    if (this.unavailable) throw new Error('store unavailable');
    const entry = this.records.get(sessionId);
    return entry === undefined ? null : { record: entry.record, etag: `v${entry.version}` };
  }

  async create(record: Readonly<AgentSessionRecord>): Promise<SessionCreateResult> {
    this.creates += 1;
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

  snapshot(sessionId: string) {
    return this.records.get(sessionId)?.record ?? null;
  }
}

function entropy(sessionId = 'session-http') {
  return {
    sessionId: () => sessionId,
    token: () => TOKEN,
    leaseId: () => 'lease-http',
  };
}

function runtime(withRoutes = false): AgentRuntimeStaticConfig {
  return {
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

function startRequest(headers: HeadersInit = {}) {
  return new Request(`${ORIGIN}/api/ask-ai/session`, {
    method: 'POST',
    headers: { origin: ORIGIN, ...headers },
  });
}

function turnRequest(
  body: Record<string, unknown>,
  token = TOKEN,
  headers: HeadersInit = {},
) {
  return new Request(`${ORIGIN}/api/ask-ai`, {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function validTurn(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-http',
    requestId: 'request-one',
    expectedRevision: 0,
    text: 'Somos 3 pessoas no fechamento.',
    ...overrides,
  };
}

test('session start is same-origin POST, no-store, and returns the bearer capability exactly once', async () => {
  const repository = new MemoryRepository();
  const response = await handleAskAiSessionStart(startRequest(), {
    repository,
    runtime: runtime(),
    entropy: entropy(),
  });

  assert.equal(response.status, 201);
  assert.match(response.headers.get('content-type') ?? '', /^application\/json/);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  assert.equal(response.headers.get('pragma'), 'no-cache');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const body = await response.json() as Record<string, unknown>;
  assert.deepEqual(body, {
    ok: true,
    sessionId: 'session-http',
    sessionToken: TOKEN,
    revision: 0,
  });
  assert.equal(JSON.stringify(repository.snapshot('session-http')).includes(TOKEN), false);
});

test('cross-site session creation is rejected before touching persistence', async () => {
  const repository = new MemoryRepository();
  const response = await handleAskAiSessionStart(startRequest({
    origin: 'https://attacker.example',
    'sec-fetch-site': 'cross-site',
  }), {
    repository,
    runtime: runtime(),
    entropy: entropy(),
  });

  assert.equal(response.status, 403);
  assert.equal(repository.creates, 0);
});

test('turn boundary rejects wrong method, media type, bearer and browser-authored Canon', async (t) => {
  const repository = new MemoryRepository();

  await t.test('method', async () => {
    const response = await handleAskAiTurn(new Request(`${ORIGIN}/api/ask-ai`, {
      method: 'GET',
      headers: { origin: ORIGIN },
    }), { repository, runtime: runtime() });
    assert.equal(response.status, 405);
    assert.equal(response.headers.get('allow'), 'POST');
  });

  await t.test('media type', async () => {
    const response = await handleAskAiTurn(new Request(`${ORIGIN}/api/ask-ai`, {
      method: 'POST',
      headers: { origin: ORIGIN, authorization: `Bearer ${TOKEN}` },
      body: JSON.stringify(validTurn()),
    }), { repository, runtime: runtime() });
    assert.equal(response.status, 415);
  });

  await t.test('bearer', async () => {
    const response = await handleAskAiTurn(turnRequest(validTurn(), 'short'), {
      repository,
      runtime: runtime(),
    });
    assert.equal(response.status, 401);
    assert.match(response.headers.get('www-authenticate') ?? '', /^Bearer /);
  });

  await t.test('forged Canon', async () => {
    const response = await handleAskAiTurn(turnRequest({
      ...validTurn(),
      canonical: { revision: 999, facts: [{ source: 'user', status: 'confirmed' }] },
    }), {
      repository,
      runtime: runtime(),
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { code: string };
    assert.equal(body.code, 'INVALID_REQUEST');
  });
});

test('body size is bounded before JSON/service execution', async () => {
  const repository = new MemoryRepository();
  const response = await handleAskAiTurn(turnRequest(validTurn(), TOKEN, {
    'content-length': '20000',
  }), {
    repository,
    runtime: runtime(),
  });
  assert.equal(response.status, 413);
});

test('guided recovery response contains only minimal public render state and persists authoritative input server-side', async () => {
  const repository = new MemoryRepository();
  const created = createAgentSession(entropy());
  assert.equal((await repository.create(created.record)).ok, true);

  const response = await handleAskAiTurn(turnRequest(validTurn()), {
    repository,
    runtime: runtime(false),
    turnDependencies: {
      nowEpochMs: () => 1_000,
      leaseId: () => 'lease-recovery',
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store, max-age=0');
  const body = await response.json() as {
    ok: boolean;
    mode: string;
    state: Record<string, unknown> & { canonicalRevision: number };
  };
  assert.equal(body.ok, true);
  assert.equal(body.mode, 'guided_recovery');
  assert.equal(body.state.canonicalRevision, 1);
  assert.equal(Object.hasOwn(body.state, 'canonical'), false);
  assert.equal(Object.hasOwn(body.state, 'verifiedCalculations'), true);

  const stored = repository.snapshot('session-http');
  assert.equal(stored?.canonical.latestUserIntent?.text, 'Somos 3 pessoas no fechamento.');
  assert.equal(stored?.status, 'idle');
});

test('stale revision and claim CAS conflicts surface as 409 without agent execution', async (t) => {
  await t.test('stale', async () => {
    const repository = new MemoryRepository();
    const created = createAgentSession(entropy());
    await repository.create(created.record);

    const response = await handleAskAiTurn(turnRequest(validTurn({ expectedRevision: 1 })), {
      repository,
      runtime: runtime(),
      turnDependencies: { nowEpochMs: () => 1_000 },
    });
    assert.equal(response.status, 409);
    const body = await response.json() as { code: string; currentRevision: number };
    assert.equal(body.code, 'STALE_REVISION');
    assert.equal(body.currentRevision, 0);
  });

  await t.test('cas conflict', async () => {
    const repository = new MemoryRepository();
    const created = createAgentSession(entropy());
    await repository.create(created.record);
    repository.conflictNextCompare = true;
    let agentCalls = 0;

    const response = await handleAskAiTurn(turnRequest(validTurn()), {
      repository,
      runtime: runtime(true),
      turnDependencies: {
        nowEpochMs: () => 1_000,
        leaseId: () => 'lease-conflict',
        runAgentLedTurn: (async () => {
          agentCalls += 1;
          throw new Error('must not execute');
        }) as never,
      },
    });
    assert.equal(response.status, 409);
    assert.equal(agentCalls, 0);
  });
});

test('active lease maps to bounded busy response with Retry-After', async () => {
  const repository = new MemoryRepository();
  const created = createAgentSession(entropy());
  const claimed = claimAgentSession(created.record, {
    requestId: 'request-active',
    expectedRevision: 0,
    nowEpochMs: 1_000,
  }, { leaseId: () => 'lease-active' });
  if (!claimed.ok || claimed.idempotent) throw new Error('expected claimed fixture');
  await repository.create(claimed.record);

  const response = await handleAskAiTurn(turnRequest(validTurn()), {
    repository,
    runtime: runtime(),
    turnDependencies: { nowEpochMs: () => 2_000 },
  });
  assert.equal(response.status, 409);
  assert.equal(response.headers.get('retry-after'), '1');
  const body = await response.json() as { code: string };
  assert.equal(body.code, 'SESSION_BUSY');
});

test('Critic/publication failure is 502 and never masquerades as guided recovery', async () => {
  const repository = new MemoryRepository();
  const created = createAgentSession(entropy());
  await repository.create(created.record);

  const response = await handleAskAiTurn(turnRequest(validTurn()), {
    repository,
    runtime: runtime(true),
    turnDependencies: {
      nowEpochMs: () => 1_000,
      leaseId: () => 'lease-block',
      runAgentLedTurn: (async (input: { seller: { canonical: AgentSessionRecord['canonical'] }; reactiveState: AgentSessionRecord['reactiveState'] }) => ({
        ok: false,
        code: 'BLOCKED_BY_CRITIC',
        canonical: input.seller.canonical,
        reactiveState: input.reactiveState,
        detail: 'BLOCK',
        reviews: [],
      })) as never,
    },
  });

  assert.equal(response.status, 502);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.code, 'AGENT_EXECUTION_FAILED');
  assert.equal(Object.hasOwn(body, 'detail'), false);
  assert.equal(repository.snapshot('session-http')?.status, 'idle');
  assert.equal(repository.snapshot('session-http')?.lastCompletedRequest, null);
});

test('correction HTTP accepts only a persisted suggestion id and rejects browser-authored replacement semantics', async () => {
  const repository = new MemoryRepository();
  const created = createAgentSession(entropy());
  const reactiveState = {
    ...created.record.reactiveState,
    basedOnRevision: 1,
    correctionSuggestions: [{
      sourceCorrectionId: 'correction-one',
      correction: {
        id: 'correction-one',
        targetEvidenceId: 'fact-old',
        reason: 'Atualizar o prazo.',
        replacementValue: '3 dias',
        supportingTurnIds: ['turn-one'],
      },
      status: 'pending' as const,
      invalidatedReason: null,
    }],
  };
  await repository.create({
    ...created.record,
    canonical: {
      ...created.record.canonical,
      revision: 1,
      turnIds: ['turn-one'],
      facts: [{
        id: 'fact-old',
        subject: 'fechamento',
        predicate: 'leva',
        value: '5 dias',
        status: 'confirmed',
        source: 'user',
        confidence: 1,
        supportingTurnIds: ['turn-one'],
        confirmedByTurnId: 'turn-one',
      }],
    },
    reactiveState,
  } as never);

  const accepted = await handleAskAiCorrection(turnRequest({
    sessionId: 'session-http',
    requestId: 'correction-request',
    expectedRevision: 1,
    correctionId: 'correction-one',
  }), {
    repository,
    runtime: runtime(),
    correctionDependencies: { nowEpochMs: () => 1_000, leaseId: () => 'lease-correction' },
  });
  assert.equal(accepted.status, 200);
  const acceptedBody = await accepted.json() as { ok: boolean; state: { canonicalRevision: number } };
  assert.equal(acceptedBody.ok, true);
  assert.equal(acceptedBody.state.canonicalRevision, 2);

  const injected = await handleAskAiCorrection(turnRequest({
    sessionId: 'session-http',
    requestId: 'correction-forged',
    expectedRevision: 2,
    correctionId: 'correction-one',
    replacementValue: '1 dia',
    targetEvidenceId: 'fact-other',
    source: 'system',
    unit: 'hour',
  }), {
    repository,
    runtime: runtime(),
  });
  assert.equal(injected.status, 400);
  const injectedBody = await injected.json() as { code: string };
  assert.equal(injectedBody.code, 'INVALID_REQUEST');
});

test('correction HTTP maps stale/conflict/busy and never leaks correction internals', async () => {
  const repository = new MemoryRepository();
  const created = createAgentSession(entropy());
  await repository.create(created.record);

  const response = await handleAskAiCorrection(turnRequest({
    sessionId: 'session-http',
    requestId: 'correction-stale',
    expectedRevision: 1,
    correctionId: 'correction-one',
  }), {
    repository,
    runtime: runtime(),
    correctionDependencies: { nowEpochMs: () => 1_000 },
  });
  assert.equal(response.status, 409);
  const body = await response.json() as Record<string, unknown>;
  assert.equal(body.code, 'STALE_REVISION');
  assert.deepEqual(Object.keys(body).sort(), ['code', 'currentRevision', 'ok']);
});

test('store unavailability is 503 and no provider details leak', async () => {
  const repository = new MemoryRepository();
  repository.unavailable = true;
  const start = await handleAskAiSessionStart(startRequest(), {
    repository,
    runtime: runtime(),
    entropy: entropy(),
  });
  assert.equal(start.status, 503);
  assert.equal(start.headers.get('retry-after'), '2');
});
