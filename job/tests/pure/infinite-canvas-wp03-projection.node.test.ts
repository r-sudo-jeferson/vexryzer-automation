import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCanvasTelemetryRecorder,
} from '../../src/experience/canvas-telemetry.ts';
import {
  commitCriticApprovedExperience,
} from '../../src/experience/accepted-experience-transaction.ts';
import {
  createReactiveExperienceState,
  projectExperienceProposal,
} from '../../src/experience/experience-projector.ts';
import type { ExperienceProposal } from '../../src/experience/experience-proposal.ts';
import {
  canonical as txCanonical,
  review as txReview,
  submission as txSubmission,
} from './wp03-transaction-fixtures.ts';
import { runAgentLedTurn } from '../../src/server/ai/agent/agent-led-turn-runtime.ts';
import {
  baseInput as runtimeBaseInput,
  review as runtimeReview,
  runtimeSubmission,
} from './wp03-runtime-fixtures.ts';
import {
  deriveVisualChoreographyOutcome,
  packageContext,
} from '../../src/ai/context/context-packager.ts';
import {
  createAgentSession,
  type AgentSessionRecord,
} from '../../src/server/session/agent-session.ts';
import type {
  AgentSessionRepository,
  SessionCompareAndSetResult,
  SessionCreateResult,
  VersionedAgentSession,
} from '../../src/server/session/session-repository.ts';
import { runStoredAgentTurn } from '../../src/server/session/stored-agent-turn-service.ts';

const WP03_TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';

class WP03MemoryRepository implements AgentSessionRepository {
  private readonly records = new Map<string, { record: Readonly<AgentSessionRecord>; version: number }>();

  async get(sessionId: string): Promise<Readonly<VersionedAgentSession> | null> {
    const entry = this.records.get(sessionId);
    if (entry === undefined) return null;
    return Object.freeze({ record: entry.record, etag: `v${entry.version}` });
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
    const entry = this.records.get(sessionId);
    if (entry === undefined) return { ok: false, code: 'NOT_FOUND' };
    if (expectedEtag !== `v${entry.version}`) return { ok: false, code: 'CONFLICT' };
    const version = entry.version + 1;
    this.records.set(sessionId, { record, version });
    return { ok: true, etag: `v${version}` };
  }
}

function canonical(revision = 7, calculationStatus: 'valid' | 'invalidated' = 'valid') {
  return {
    schemaVersion: 1,
    sessionId: 'session-701',
    revision,
    turnIds: ['turn-7'],
    facts: [],
    primaryPain: null,
    desiredOutcome: null,
    knownConsequences: [],
    objections: [],
    quantitativeObservations: [],
    verifiedCalculations: [{
      id: 'calc-1', kind: 'capacity', inputObservationIds: ['obs-1'], expression: '1', resultValue: 44,
      resultUnit: 'hour/month', computedBy: 'application', basedOnRevision: 7,
      status: calculationStatus, invalidatedAtRevision: calculationStatus === 'invalidated' ? revision : null,
    }],
    openUncertainties: [], opportunities: [], artifacts: [], currentSceneId: null,
    latestUserIntent: { turnId: 'turn-7', text: 'Quero enxergar a capacidade perdida.' },
  } as const;
}

function visualProposal(): ExperienceProposal {
  return {
    schemaVersion: 1,
    baseRevision: 7,
    narration: 'A capacidade perdida agora está visível.',
    intent: {
      schemaVersion: 1,
      objective: 'Expor capacidade.',
      rationale: 'Há evidência quantitativa.',
      capabilities: ['bi_decision_intelligence'],
      actions: [
        { id: 'action-focus', kind: 'focus', targetId: 'closing', reason: 'Evidenciar gargalo.' },
      ],
      quantitativeOpportunities: [],
      artifactIntents: [],
      nextQuestion: null,
    },
    factProposals: [], correctionProposals: [], processMutations: [],
    sceneProposal: { composition: 'focus', focusIds: ['closing'], comparisonIds: [], announcement: 'Foco.' },
    artifactProposals: [], criticRequired: true,
  };
}

function noopProposal(): ExperienceProposal {
  return { ...visualProposal(), intent: { ...visualProposal().intent, actions: [] }, sceneProposal: null };
}

test('WP03 projector emits one exact event per outcome without changing the result', () => {
  const fresh = () => createReactiveExperienceState({ basedOnRevision: 7 });

  const acceptedRecorder = createCanvasTelemetryRecorder();
  const accepted = projectExperienceProposal(fresh(), visualProposal(), canonical(), acceptedRecorder);
  assert.equal(accepted.ok, true);
  assert.deepEqual(acceptedRecorder.snapshot(), [{ kind: 'intent-accepted', revision: 7 }]);

  const noopRecorder = createCanvasTelemetryRecorder();
  const noop = projectExperienceProposal(fresh(), noopProposal(), canonical(), noopRecorder);
  assert.equal(noop.ok, true);
  assert.deepEqual(noopRecorder.snapshot(), [{ kind: 'no-op', deduplicated: false, revision: 7 }]);

  const staleRecorder = createCanvasTelemetryRecorder();
  const stale = projectExperienceProposal(fresh(), { ...visualProposal(), baseRevision: 6 }, canonical(), staleRecorder);
  assert.deepEqual(stale.ok ? null : stale.code, 'STALE_REVISION');
  assert.deepEqual(staleRecorder.snapshot(), [{ kind: 'stale-revision', revision: 6 }]);

  const rollbackRecorder = createCanvasTelemetryRecorder();
  const rollback = projectExperienceProposal(fresh(), visualProposal(), canonical(6), rollbackRecorder);
  assert.deepEqual(rollback.ok ? null : rollback.code, 'REVISION_ROLLBACK');
  assert.deepEqual(rollbackRecorder.snapshot(), [{ kind: 'stale-revision', revision: 6 }]);

  const invalidCalcRecorder = createCanvasTelemetryRecorder();
  const invalidCalc = projectExperienceProposal(fresh(), {
    ...visualProposal(),
    intent: {
      ...visualProposal().intent,
      actions: [{ id: 'action-quant', kind: 'quantify', calculationId: 'calc-missing', targetId: null, reason: 'Inválido.' }],
    },
  }, canonical(), invalidCalcRecorder);
  assert.deepEqual(invalidCalc.ok ? null : invalidCalc.code, 'INVALID_CALCULATION_REFERENCE');
  assert.deepEqual(invalidCalcRecorder.snapshot(), [
    { kind: 'intent-rejected', rejectionCode: 'missing-evidence', revision: 7 },
  ]);

  const unknownEvidenceRecorder = createCanvasTelemetryRecorder();
  const unknownEvidence = projectExperienceProposal(fresh(), {
    ...noopProposal(),
    artifactProposals: [{ id: 'artifact-1', kind: 'bi_dashboard', title: 'Painel', summary: 'Conceito.', evidenceIds: ['evidence-missing'], status: 'conceptual' }],
  }, canonical(), unknownEvidenceRecorder);
  assert.deepEqual(unknownEvidence.ok ? null : unknownEvidence.code, 'UNKNOWN_EVIDENCE_REFERENCE');
  assert.deepEqual(unknownEvidenceRecorder.snapshot(), [
    { kind: 'intent-rejected', rejectionCode: 'missing-evidence', revision: 7 },
  ]);
});

test('WP03 deduplicated replay emits no-op with deduplicated true and advances nothing', () => {
  const initial = createReactiveExperienceState({ basedOnRevision: 7 });
  const firstRecorder = createCanvasTelemetryRecorder();
  const first = projectExperienceProposal(initial, visualProposal(), canonical(), firstRecorder);
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.state.projectionRevision, 1);

  const replayRecorder = createCanvasTelemetryRecorder();
  const replay = projectExperienceProposal(first.state, visualProposal(), canonical(), replayRecorder);
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.state.projectionRevision, 1);
  assert.equal(replay.state, first.state);
  assert.deepEqual(replayRecorder.snapshot(), [{ kind: 'no-op', deduplicated: true, revision: 7 }]);
});

test('WP03 capacity guard emits nothing and keeps the taxonomy honest', () => {
  let state = createReactiveExperienceState({ basedOnRevision: 7 });
  for (let i = 0; i < 64; i += 1) {
    const result = projectExperienceProposal(state, {
      ...noopProposal(),
      intent: {
        ...noopProposal().intent,
        actions: [{ id: `action-${i}`, kind: 'annotate', targetId: `node-${i}`, text: `Insight ${i}`, evidenceIds: [] }],
      },
    }, canonical());
    assert.equal(result.ok, true);
    if (!result.ok) return;
    state = result.state;
  }
  const recorder = createCanvasTelemetryRecorder();
  const overflow = projectExperienceProposal(state, {
    ...noopProposal(),
    intent: {
      ...noopProposal().intent,
      actions: [{ id: 'action-overflow', kind: 'annotate', targetId: 'node-overflow', text: 'Overflow', evidenceIds: [] }],
    },
  }, canonical(), recorder);
  assert.deepEqual(overflow.ok ? null : overflow.code, 'PROJECTION_CAPACITY_EXCEEDED');
  assert.deepEqual(recorder.snapshot(), []);
});

test('WP03 emission never alters results and projectionRevision increments exactly once per accepted turn', () => {
  const withRecorder = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }), visualProposal(), canonical(), createCanvasTelemetryRecorder(),
  );
  const withoutRecorder = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }), visualProposal(), canonical(),
  );
  assert.deepEqual(withRecorder, withoutRecorder);

  const before = JSON.stringify(canonical());
  const state0 = createReactiveExperienceState({ basedOnRevision: 7 });
  const first = projectExperienceProposal(state0, visualProposal(), canonical());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.state.projectionRevision, 1);
  assert.equal(JSON.stringify(canonical()), before);

  const secondProposal = {
    ...visualProposal(),
    narration: 'Segunda leitura com novo foco.',
    intent: {
      ...visualProposal().intent,
      actions: [{ id: 'action-focus-2', kind: 'focus', targetId: 'reconciliation', reason: 'Novo foco.' }],
    },
    sceneProposal: { composition: 'focus', focusIds: ['reconciliation'], comparisonIds: [], announcement: null },
  } as ExperienceProposal;
  const second = projectExperienceProposal(first.state, secondProposal, canonical());
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.state.projectionRevision, 2);
  assert.equal(second.state.basedOnRevision, 7);
  assert.equal(JSON.stringify(canonical()), before);
});

test('WP03 transaction snapshots carry the projection outcome on every path', () => {
  const success = commitCriticApprovedExperience({
    canonical: txCanonical(),
    reactiveState: createReactiveExperienceState({ basedOnRevision: 4 }),
    submission: txSubmission(),
    review: txReview(),
    surfaceGuard: () => ({ ok: true }),
  });
  assert.equal(success.ok, true);
  if (!success.ok) return;
  assert.deepEqual(success.telemetry, [{ kind: 'intent-accepted', revision: 4 }]);

  const rejected = commitCriticApprovedExperience({
    canonical: txCanonical('invalidated'),
    reactiveState: createReactiveExperienceState({ basedOnRevision: 4 }),
    submission: txSubmission('quantify-invalidated'),
    review: txReview(),
    surfaceGuard: () => ({ ok: true }),
  });
  assert.deepEqual(rejected.ok ? null : rejected.code, 'PROJECTION_REJECTED');
  if (rejected.ok) return;
  assert.deepEqual(rejected.telemetry, [{ kind: 'intent-rejected', rejectionCode: 'missing-evidence', revision: 4 }]);

  const sellerRejected = commitCriticApprovedExperience({
    canonical: txCanonical(),
    reactiveState: createReactiveExperienceState({ basedOnRevision: 4 }),
    submission: txSubmission('stale'),
    review: txReview(),
    surfaceGuard: () => ({ ok: true }),
  });
  assert.deepEqual(sellerRejected.ok ? null : sellerRejected.code, 'SELLER_SUBMISSION_REJECTED');
  if (sellerRejected.ok) return;
  assert.deepEqual(sellerRejected.telemetry, []);

  const shared = createCanvasTelemetryRecorder();
  assert.equal(shared.record({ kind: 'catalog-miss', count: 1 }), true);
  const sharedResult = commitCriticApprovedExperience({
    canonical: txCanonical(),
    reactiveState: createReactiveExperienceState({ basedOnRevision: 4 }),
    submission: txSubmission(),
    review: txReview(),
    surfaceGuard: () => ({ ok: true }),
    telemetry: shared,
  });
  assert.equal(sharedResult.ok, true);
  if (!sharedResult.ok) return;
  assert.deepEqual(sharedResult.telemetry, [
    { kind: 'catalog-miss', count: 1 },
    { kind: 'intent-accepted', revision: 4 },
  ]);
});

test('WP03 turn runtime surfaces projection telemetry on publication failure', async () => {
  const base = runtimeBaseInput();

  const withTelemetry = await runAgentLedTurn({
    ...base,
    dependencies: {
      runSellerTurn: (async () => ({
        ok: true as const,
        canonical: base.seller.canonical,
        submission: runtimeSubmission(),
        routeId: 'seller-route',
        providerRounds: 1,
        providerCalls: 1,
      })) as never,
      runCriticTurn: (async () => ({
        ok: true as const,
        review: runtimeReview(),
        routeId: 'critic-route',
        providerCalls: 1,
      })) as never,
      commitCriticApprovedExperience: (() => ({
        ok: false,
        code: 'PROJECTION_REJECTED',
        canonical: base.seller.canonical,
        reactiveState: base.reactiveState,
        detail: 'STALE_REVISION:proposal.baseRevision',
        telemetry: [{ kind: 'stale-revision', revision: 6 }],
      })) as never,
    },
  });
  assert.equal(withTelemetry.ok, false);
  if (withTelemetry.ok) return;
  assert.equal(withTelemetry.code, 'PUBLICATION_FAILED');
  assert.deepEqual(withTelemetry.telemetry, [{ kind: 'stale-revision', revision: 6 }]);

  const legacyDouble = await runAgentLedTurn({
    ...base,
    dependencies: {
      runSellerTurn: (async () => ({
        ok: true as const,
        canonical: base.seller.canonical,
        submission: runtimeSubmission(),
        routeId: 'seller-route',
        providerRounds: 1,
        providerCalls: 1,
      })) as never,
      runCriticTurn: (async () => ({
        ok: true as const,
        review: runtimeReview(),
        routeId: 'critic-route',
        providerCalls: 1,
      })) as never,
      commitCriticApprovedExperience: (() => ({
        ok: false,
        code: 'PROJECTION_REJECTED',
        canonical: base.seller.canonical,
        reactiveState: base.reactiveState,
        detail: 'STALE_REVISION:proposal.baseRevision',
      })) as never,
    },
  });
  assert.equal(legacyDouble.ok, false);
  if (legacyDouble.ok) return;
  assert.deepEqual(legacyDouble.telemetry, []);
});

test('WP03 choreography outcome derives truthfully from reactive state alone', () => {
  assert.equal(
    deriveVisualChoreographyOutcome({ interrupted: false, intentKey: null, cameraTargetIds: [] }),
    'idle',
  );
  assert.equal(
    deriveVisualChoreographyOutcome({ interrupted: false, intentKey: 'key-1', cameraTargetIds: ['node-a'] }),
    'directed',
  );
  assert.equal(
    deriveVisualChoreographyOutcome({ interrupted: true, intentKey: 'key-1', cameraTargetIds: ['node-a'] }),
    'interrupted',
  );
  assert.equal(
    deriveVisualChoreographyOutcome({ interrupted: false, intentKey: 'key-1', cameraTargetIds: [] }),
    'idle',
  );
});

test('WP03 packager carries bounded visual enums, drops forged values, and keeps them through compaction', () => {
  const packable = packageContext({
    role: 'seller',
    canonical: canonical(),
    digest: null,
    recentTurns: [],
    visualState: {
      sceneId: 'scene-1',
      focusedEntityIds: ['node-a'],
      activeArtifactIds: [],
      processNodes: [],
      sceneComposition: 'compare',
      choreographyOutcome: 'directed',
    },
    budget: { maxInputTokens: 10_000, reservedOutputTokens: 2_000 },
    estimateTokens: (value: unknown) => JSON.stringify(value).length,
  });
  assert.equal(packable.ok, true);
  if (!packable.ok) return;
  assert.equal(packable.pack.visualState.sceneComposition, 'compare');
  assert.equal(packable.pack.visualState.choreographyOutcome, 'directed');

  const forged = packageContext({
    role: 'seller',
    canonical: canonical(),
    digest: null,
    recentTurns: [],
    visualState: {
      sceneId: 'scene-1',
      focusedEntityIds: ['node-a'],
      activeArtifactIds: [],
      processNodes: [],
      sceneComposition: 'cinematic',
      choreographyOutcome: 'flying',
    } as never,
    budget: { maxInputTokens: 10_000, reservedOutputTokens: 2_000 },
    estimateTokens: (value: unknown) => JSON.stringify(value).length,
  });
  assert.equal(forged.ok, true);
  if (!forged.ok) return;
  assert.equal(forged.pack.visualState.sceneComposition, undefined);
  assert.equal(forged.pack.visualState.choreographyOutcome, undefined);

  const compacted = packageContext({
    role: 'seller',
    canonical: canonical(),
    digest: null,
    recentTurns: [
      { id: 'turn-old', role: 'assistant', text: 'x'.repeat(4000) },
      { id: 'turn-7', role: 'user', text: 'Quero enxergar a capacidade perdida.' },
    ],
    visualState: {
      sceneId: 'scene-1',
      focusedEntityIds: ['node-a'],
      activeArtifactIds: [],
      processNodes: [],
      sceneComposition: 'compare',
      choreographyOutcome: 'directed',
    },
    budget: { maxInputTokens: 2800, reservedOutputTokens: 500 },
    estimateTokens: (value: unknown) => JSON.stringify(value).length,
  });
  assert.equal(compacted.ok, true);
  if (!compacted.ok) return;
  assert.equal(compacted.pack.metadata.compaction, 'bounded');
  assert.equal(compacted.pack.visualState.sceneComposition, 'compare');
  assert.equal(compacted.pack.visualState.choreographyOutcome, 'directed');
});

test('WP03 visual enums participate in token accounting without raw viewport material', () => {
  const base = {
    role: 'seller' as const,
    canonical: canonical(),
    digest: null,
    recentTurns: [],
    visualState: {
      sceneId: 'scene-1',
      focusedEntityIds: ['node-a'],
      activeArtifactIds: [],
      processNodes: [],
    },
    budget: { maxInputTokens: 10_000, reservedOutputTokens: 2_000 },
    estimateTokens: (value: unknown) => JSON.stringify(value).length,
  };
  const without = packageContext(base);
  const withEnums = packageContext({
    ...base,
    visualState: { ...base.visualState, sceneComposition: 'overview', choreographyOutcome: 'idle' } as never,
  });
  assert.equal(without.ok, true);
  assert.equal(withEnums.ok, true);
  if (!without.ok || !withEnums.ok) return;
  assert.ok(withEnums.pack.metadata.estimatedInputTokens > without.pack.metadata.estimatedInputTokens);
  assert.ok(!JSON.stringify(withEnums.pack.visualState).includes('viewport'));
});

test('WP03 server turn wires derived visual enums into the seller context on the real path', async () => {
  const repository = new WP03MemoryRepository();
  const created = createAgentSession({ sessionId: () => 'session-wp03', token: () => WP03_TOKEN, leaseId: () => 'lease-1' });
  assert.equal((await repository.create(created.record)).ok, true);

  let captured: unknown;
  await runStoredAgentTurn({
    repository,
    request: {
      sessionId: 'session-wp03',
      sessionToken: created.sessionToken,
      requestId: 'request-one',
      expectedRevision: 0,
      text: 'Somos 3 pessoas no fechamento.',
    },
    runtime: {
      executionTimeoutMs: 45_000,
      seller: { routes: [{}], routeBudgets: [], runtimeStates: [] } as never,
      critic: { routes: [{}], routeBudgets: [], runtimeStates: [] } as never,
    },
    dependencies: {
      nowEpochMs: () => 1_000,
      leaseId: () => 'lease-turn',
      runAgentLedTurn: (async (input: { seller: { visualState: unknown } }) => {
        captured = input.seller.visualState;
        return {
          ok: false,
          code: 'SELLER_FAILED',
          canonical: canonical(),
          reactiveState: createReactiveExperienceState({ basedOnRevision: 0 }),
          detail: 'NO_ELIGIBLE_ROUTE',
          reviews: [],
        };
      }) as never,
    },
  });

  assert.deepEqual(captured, {
    sceneId: null,
    sceneComposition: 'stable',
    choreographyOutcome: 'idle',
    focusedEntityIds: [],
    activeArtifactIds: [],
    processNodes: [],
  });
});
