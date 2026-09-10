import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAgentSession,
  freezeAgentSessionRecord,
  type AgentSessionRecord,
} from '../../src/server/session/agent-session.ts';
import type {
  AgentSessionRepository,
  SessionCompareAndSetResult,
  SessionCreateResult,
  VersionedAgentSession,
} from '../../src/server/session/session-repository.ts';
import {
  freezeReactiveExperienceState,
  createReactiveExperienceState,
} from '../../src/experience/reactive-experience-state.ts';
import {
  runStoredUserCorrection,
} from '../../src/server/session/stored-user-correction-service.ts';
import { applyContextMutation } from '../../src/ai/context/context-reducer.ts';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';

class MemoryRepository implements AgentSessionRepository {
  private readonly records = new Map<string, { record: Readonly<AgentSessionRecord>; version: number }>();
  conflictNextCompare = false;

  async get(sessionId: string): Promise<Readonly<VersionedAgentSession> | null> {
    const entry = this.records.get(sessionId);
    return entry === undefined ? null : { record: entry.record, etag: `v${entry.version}` };
  }

  async create(record: Readonly<AgentSessionRecord>): Promise<SessionCreateResult> {
    if (this.records.has(record.sessionId)) return { ok: false, code: 'ALREADY_EXISTS' };
    this.records.set(record.sessionId, { record, version: 1 });
    return { ok: true, etag: 'v1' };
  }

  async compareAndSet(
    sessionId: string,
    expectedEtag: string,
    record: Readonly<AgentSessionRecord>,
  ): Promise<SessionCompareAndSetResult> {
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

function seededRecord(kind: 'fact' | 'observation'): Readonly<AgentSessionRecord> {
  const created = createAgentSession({
    sessionId: () => 'session-correction',
    token: () => TOKEN,
    leaseId: () => 'unused',
  });
  const baseReactive = createReactiveExperienceState({ basedOnRevision: 1 });
  const correction = Object.freeze({
    id: 'correction-one',
    targetEvidenceId: kind === 'fact' ? 'fact-old' : 'obs-old',
    reason: 'O valor informado precisa ser atualizado.',
    replacementValue: kind === 'fact' ? '3 dias' : 30,
    supportingTurnIds: Object.freeze(['turn-one']),
  });
  const reactiveState = freezeReactiveExperienceState({
    ...baseReactive,
    basedOnRevision: 1,
    correctionSuggestions: [Object.freeze({
      sourceCorrectionId: 'correction-one',
      correction,
      status: 'pending' as const,
      invalidatedReason: null,
    })],
  });

  const canonical = kind === 'fact'
    ? {
        ...created.record.canonical,
        revision: 1,
        turnIds: Object.freeze(['turn-one']),
        facts: Object.freeze([Object.freeze({
          id: 'fact-old',
          subject: 'fechamento',
          predicate: 'leva',
          value: '5 dias',
          status: 'confirmed' as const,
          source: 'user' as const,
          confidence: 1,
          supportingTurnIds: Object.freeze(['turn-one']),
          confirmedByTurnId: 'turn-one',
        })]),
      }
    : {
        ...created.record.canonical,
        revision: 1,
        turnIds: Object.freeze(['turn-one']),
        quantitativeObservations: Object.freeze([Object.freeze({
          id: 'obs-old',
          metric: 'minutos por ocorrência',
          value: 45,
          unit: 'minute' as const,
          period: 'event' as const,
          status: 'confirmed' as const,
          source: 'user' as const,
          supportingTurnIds: Object.freeze(['turn-one']),
          confirmedByTurnId: 'turn-one',
        })]),
        verifiedCalculations: Object.freeze([Object.freeze({
          id: 'calc-old',
          kind: 'time_cost' as const,
          inputObservationIds: Object.freeze(['obs-old']),
          expression: '45 * 20 / 60',
          resultValue: 15,
          resultUnit: 'hour/month',
          computedBy: 'application' as const,
          basedOnRevision: 1,
          status: 'valid' as const,
          invalidatedAtRevision: null,
        })]),
      };

  return freezeAgentSessionRecord({
    ...created.record,
    canonical,
    reactiveState,
  });
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-correction',
    sessionToken: TOKEN,
    requestId: 'correction-request-one',
    expectedRevision: 1,
    correctionId: 'correction-one',
    ...overrides,
  };
}

test('explicit user click corrects a fact by preserving canonical semantics and only applying the reviewed replacement value', async () => {
  const repository = new MemoryRepository();
  await repository.create(seededRecord('fact'));

  const result = await runStoredUserCorrection({
    repository,
    request: request(),
    dependencies: { nowEpochMs: () => 1_000, leaseId: () => 'lease-correction' },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.idempotent, false);
  assert.equal(result.state.canonicalRevision, 2);
  assert.equal(Object.hasOwn(result.state, 'canonical'), false);
  const stored = repository.snapshot('session-correction')!;
  assert.equal(stored.status, 'idle');
  assert.equal(stored.canonical.facts.find((item) => item.id === 'fact-old')?.status, 'superseded');
  const replacement = stored.canonical.facts.find((item) => item.id !== 'fact-old')!;
  assert.equal(replacement.subject, 'fechamento');
  assert.equal(replacement.predicate, 'leva');
  assert.equal(replacement.value, '3 dias');
  assert.equal(replacement.source, 'user');
  assert.equal(replacement.status, 'confirmed');
  assert.equal(replacement.confirmedByTurnId, 'correction-request-one');
  assert.equal(stored.reactiveState.correctionSuggestions[0]?.status, 'invalidated');
});

test('observation correction preserves metric/unit/period and invalidates calculations based on superseded evidence', async () => {
  const repository = new MemoryRepository();
  await repository.create(seededRecord('observation'));

  const result = await runStoredUserCorrection({
    repository,
    request: request(),
    dependencies: { nowEpochMs: () => 1_000, leaseId: () => 'lease-observation' },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const stored = repository.snapshot('session-correction')!;
  const replacement = stored.canonical.quantitativeObservations.find((item) => item.id !== 'obs-old')!;
  assert.equal(replacement.metric, 'minutos por ocorrência');
  assert.equal(replacement.unit, 'minute');
  assert.equal(replacement.period, 'event');
  assert.equal(replacement.value, 30);
  assert.equal(replacement.source, 'user');
  assert.equal(stored.canonical.verifiedCalculations[0]?.status, 'invalidated');
  assert.equal(stored.canonical.verifiedCalculations[0]?.invalidatedAtRevision, 2);
  assert.equal(result.state.verifiedCalculations[0]?.status, 'invalidated');
});

test('exact correction retry is idempotent even when the client still carries the pre-commit revision', async () => {
  const repository = new MemoryRepository();
  await repository.create(seededRecord('fact'));
  const dependencies = { nowEpochMs: () => 1_000, leaseId: () => 'lease-idempotent' };

  const first = await runStoredUserCorrection({ repository, request: request(), dependencies });
  assert.equal(first.ok, true);
  const second = await runStoredUserCorrection({ repository, request: request(), dependencies });
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.idempotent, true);
  assert.equal(second.state.canonicalRevision, 2);
  assert.equal(repository.snapshot('session-correction')?.canonical.revision, 2);
});

test('request cannot inject replacement, target, source or unit through the internal service boundary', async () => {
  const repository = new MemoryRepository();
  await repository.create(seededRecord('fact'));
  const result = await runStoredUserCorrection({
    repository,
    request: request({
      replacementValue: '1 dia',
      targetEvidenceId: 'fact-other',
      source: 'user',
      unit: 'hour',
    }) as never,
    dependencies: { nowEpochMs: () => 1_000, leaseId: () => 'lease-forged' },
  });
  assert.deepEqual(result, { ok: false, code: 'INVALID_REQUEST', currentRevision: null });
  assert.equal(repository.snapshot('session-correction')?.canonical.revision, 1);
});

test('missing or already invalidated suggestion cannot mutate canonical truth', async (t) => {
  for (const correctionId of ['missing-correction', 'correction-one']) {
    await t.test(correctionId, async () => {
      const repository = new MemoryRepository();
      let record = seededRecord('fact');
      if (correctionId === 'correction-one') {
        record = freezeAgentSessionRecord({
          ...record,
          reactiveState: freezeReactiveExperienceState({
            ...record.reactiveState,
            correctionSuggestions: record.reactiveState.correctionSuggestions.map((item) => Object.freeze({
              ...item,
              status: 'invalidated' as const,
              invalidatedReason: 'canonical-evidence-invalidated' as const,
            })),
          }),
        });
      }
      await repository.create(record);
      const result = await runStoredUserCorrection({
        repository,
        request: request({ correctionId }),
        dependencies: { nowEpochMs: () => 1_000, leaseId: () => 'lease-not-pending' },
      });
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, 'CORRECTION_NOT_PENDING');
      assert.equal(repository.snapshot('session-correction')?.canonical.revision, 1);
      assert.equal(repository.snapshot('session-correction')?.status, 'idle');
    });
  }
});

test('claim CAS conflict prevents correction mutation entirely', async () => {
  const repository = new MemoryRepository();
  await repository.create(seededRecord('fact'));
  repository.conflictNextCompare = true;
  let mutationCalls = 0;

  const result = await runStoredUserCorrection({
    repository,
    request: request(),
    dependencies: {
      nowEpochMs: () => 1_000,
      leaseId: () => 'lease-conflict',
      applyContextMutation: ((...args: Parameters<typeof applyContextMutation>) => {
        mutationCalls += 1;
        throw new Error(String(args.length));
      }) as never,
    },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'SESSION_CONFLICT');
  assert.equal(mutationCalls, 0);
  assert.equal(repository.snapshot('session-correction')?.canonical.revision, 1);
});

test('non-numeric reviewed replacement cannot correct a quantitative observation', async () => {
  const repository = new MemoryRepository();
  const base = seededRecord('observation');
  await repository.create(freezeAgentSessionRecord({
    ...base,
    reactiveState: freezeReactiveExperienceState({
      ...base.reactiveState,
      correctionSuggestions: base.reactiveState.correctionSuggestions.map((item) => Object.freeze({
        ...item,
        correction: Object.freeze({ ...item.correction, replacementValue: 'trinta' }),
      })),
    }),
  }));

  const result = await runStoredUserCorrection({
    repository,
    request: request(),
    dependencies: { nowEpochMs: () => 1_000, leaseId: () => 'lease-invalid-value' },
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'CORRECTION_VALUE_INVALID');
  assert.equal(repository.snapshot('session-correction')?.canonical.revision, 1);
});
