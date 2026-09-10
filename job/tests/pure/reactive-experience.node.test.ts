import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createReactiveExperienceState,
  interruptExperienceChoreography,
  projectExperienceProposal,
  reconcileReactiveExperience,
} from '../../src/experience/experience-projector.ts';
import type { ExperienceProposal } from '../../src/experience/experience-proposal.ts';

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

function proposal(overrides: Partial<ExperienceProposal> = {}): ExperienceProposal {
  const base: ExperienceProposal = {
    schemaVersion: 1,
    baseRevision: 7,
    narration: 'A capacidade perdida agora está visível.',
    intent: {
      schemaVersion: 1,
      objective: 'Expor capacidade.',
      rationale: 'Há evidência quantitativa.',
      capabilities: ['bi_decision_intelligence'],
      actions: [],
      quantitativeOpportunities: [],
      artifactIntents: [],
      nextQuestion: null,
    },
    factProposals: [], correctionProposals: [], processMutations: [], sceneProposal: null,
    artifactProposals: [], criticRequired: true,
  };
  return { ...base, ...overrides };
}

test('accepts a turn with no question and no visual change without inventing one', () => {
  const state = createReactiveExperienceState({ basedOnRevision: 7 });
  const result = projectExperienceProposal(state, proposal(), canonical());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.projectionRevision, 0);
  assert.equal(result.state.scene.composition, 'stable');
  assert.deepEqual(result.state.actions, []);
});

test('commits multiple coordinated semantic effects atomically in one projection revision', () => {
  const state = createReactiveExperienceState({ basedOnRevision: 7 });
  const result = projectExperienceProposal(state, proposal({
    intent: {
      ...proposal().intent,
      actions: [
        { id: 'action-focus', kind: 'focus', targetId: 'closing', reason: 'Evidenciar gargalo.' },
        { id: 'action-note', kind: 'annotate', targetId: 'closing', text: '44 h/mês comprometidas.', evidenceIds: ['calc-1'] },
        { id: 'action-quant', kind: 'quantify', calculationId: 'calc-1', targetId: 'closing', reason: 'Tornar capacidade concreta.' },
      ],
    },
    sceneProposal: { composition: 'focus', focusIds: ['closing'], comparisonIds: [], announcement: 'Capacidade comprometida em destaque.' },
    artifactProposals: [{ id: 'artifact-1', kind: 'bi_dashboard', title: 'Painel de capacidade', summary: 'Visão conceitual da capacidade consumida.', evidenceIds: ['calc-1'], status: 'conceptual' }],
  }), canonical());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.state.projectionRevision, 1);
  assert.equal(result.state.actions.length, 3);
  assert.equal(result.state.artifacts.length, 1);
  assert.deepEqual(result.state.scene.focusIds, ['closing']);
  assert.deepEqual(result.state.choreography.cameraTargetIds, ['closing']);
});

test('rejects an invalid semantic effect without partially committing its preceding effects', () => {
  const state = createReactiveExperienceState({ basedOnRevision: 7 });
  const result = projectExperienceProposal(state, proposal({
    intent: {
      ...proposal().intent,
      actions: [
        { id: 'action-focus', kind: 'focus', targetId: 'closing', reason: 'Evidenciar gargalo.' },
        { id: 'action-quant', kind: 'quantify', calculationId: 'calc-missing', targetId: 'closing', reason: 'Inválido.' },
      ],
    },
  }), canonical());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'INVALID_CALCULATION_REFERENCE');
  assert.equal(result.state, state);
  assert.deepEqual(state.actions, []);
  assert.equal(state.projectionRevision, 0);
});

test('deduplicates an equivalent semantic intent even when narration changes', () => {
  const firstProposal = proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-focus', kind: 'focus', targetId: 'closing', reason: 'Evidenciar gargalo.' }] },
    sceneProposal: { composition: 'focus', focusIds: ['closing'], comparisonIds: [], announcement: null },
  });
  const initial = createReactiveExperienceState({ basedOnRevision: 7 });
  const first = projectExperienceProposal(initial, firstProposal, canonical());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = projectExperienceProposal(first.state, { ...firstProposal, narration: 'Texto diferente em streaming consolidado.' }, canonical());
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.deduplicated, true);
  assert.equal(second.state, first.state);
  assert.equal(second.state.projectionRevision, 1);
  assert.equal(second.state.choreography.generation, 1);
});

test('rejects stale scene/proposal revision before any projection', () => {
  const state = createReactiveExperienceState({ basedOnRevision: 7 });
  const result = projectExperienceProposal(state, proposal({ baseRevision: 6 }), canonical(7));
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'STALE_REVISION');
  assert.equal(result.state, state);
});

test('canonical correction invalidates an already displayed calculation instead of leaving stale numeric truth active', () => {
  const initial = createReactiveExperienceState({ basedOnRevision: 7 });
  const projected = projectExperienceProposal(initial, proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-quant', kind: 'quantify', calculationId: 'calc-1', targetId: null, reason: 'Mostrar capacidade.' }] },
  }), canonical());
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  assert.equal(projected.state.actions[0]?.status, 'active');

  const reconciled = reconcileReactiveExperience(projected.state, canonical(8, 'invalidated'));
  assert.equal(reconciled.basedOnRevision, 8);
  assert.equal(reconciled.actions[0]?.status, 'invalidated');
  assert.equal(reconciled.actions[0]?.invalidatedReason, 'canonical-calculation-invalidated');
});

test('correction proposals remain non-authoritative pending suggestions and invalidate after the user changes canonical truth', () => {
  const confirmedFact = {
    id: 'fact-old',
    subject: 'fechamento',
    predicate: 'leva',
    value: '5 dias',
    status: 'confirmed' as const,
    source: 'user' as const,
    confidence: 1,
    supportingTurnIds: ['turn-7'],
    confirmedByTurnId: 'turn-7',
  };
  const before = { ...canonical(), facts: [confirmedFact] } as const;
  const initial = createReactiveExperienceState({ basedOnRevision: 7 });
  const correctionProposal = proposal({
    correctionProposals: [{
      id: 'correction-1',
      targetEvidenceId: 'fact-old',
      reason: 'O usuário indicou que o ciclo parece ter mudado.',
      replacementValue: '3 dias',
      supportingTurnIds: ['turn-7'],
    }],
  });

  const projected = projectExperienceProposal(initial, correctionProposal, before);
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  assert.equal(projected.state.correctionSuggestions.length, 1);
  assert.equal(projected.state.correctionSuggestions[0]?.status, 'pending');
  assert.equal(projected.state.correctionSuggestions[0]?.correction.replacementValue, '3 dias');
  assert.equal(before.facts[0]?.value, '5 dias');
  assert.equal(before.facts[0]?.status, 'confirmed');

  const replay = projectExperienceProposal(projected.state, {
    ...correctionProposal,
    correctionProposals: [{
      ...correctionProposal.correctionProposals[0]!,
      id: 'correction-equivalent-id',
    }],
  }, before);
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.state.correctionSuggestions.length, 1);

  const afterUserCorrection = {
    ...canonical(8),
    facts: [{ ...confirmedFact, status: 'superseded' as const }],
  } as const;
  const reconciled = reconcileReactiveExperience(projected.state, afterUserCorrection);
  assert.equal(reconciled.basedOnRevision, 8);
  assert.equal(reconciled.correctionSuggestions[0]?.status, 'invalidated');
  assert.equal(reconciled.correctionSuggestions[0]?.invalidatedReason, 'canonical-evidence-invalidated');
});

test('correction proposals cannot target calculations, artifacts, missing ids, or superseded evidence', async (t) => {
  const base = createReactiveExperienceState({ basedOnRevision: 7 });
  const correction = {
    id: 'correction-invalid',
    reason: 'Tentativa inválida.',
    replacementValue: 10,
    supportingTurnIds: ['turn-7'],
  };

  for (const targetEvidenceId of ['calc-1', 'artifact-1', 'missing']) {
    await t.test(targetEvidenceId, () => {
      const result = projectExperienceProposal(base, proposal({
        correctionProposals: [{ ...correction, targetEvidenceId }],
      }), canonical());
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.code, 'INVALID_CORRECTION_REFERENCE');
      assert.equal(result.state, base);
    });
  }

  const superseded = {
    ...canonical(),
    facts: [{
      id: 'fact-superseded',
      subject: 'fechamento',
      predicate: 'leva',
      value: '5 dias',
      status: 'superseded' as const,
      source: 'user' as const,
      confidence: 1,
      supportingTurnIds: ['turn-7'],
      confirmedByTurnId: 'turn-7',
    }],
  } as const;
  const stale = projectExperienceProposal(base, proposal({
    correctionProposals: [{ ...correction, targetEvidenceId: 'fact-superseded' }],
  }), superseded);
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, 'INVALID_CORRECTION_REFERENCE');
});

test('user interaction interrupts non-essential camera choreography and equivalent replay cannot restart it', () => {
  const p = proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-focus', kind: 'focus', targetId: 'closing', reason: 'Foco útil.' }] },
    sceneProposal: { composition: 'focus', focusIds: ['closing'], comparisonIds: [], announcement: null },
  });
  const projected = projectExperienceProposal(createReactiveExperienceState({ basedOnRevision: 7 }), p, canonical());
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  const interrupted = interruptExperienceChoreography(projected.state);
  assert.equal(interrupted.choreography.interrupted, true);
  assert.deepEqual(interrupted.choreography.cameraTargetIds, []);

  const replay = projectExperienceProposal(interrupted, { ...p, narration: 'Outro fragmento textual.' }, canonical());
  assert.equal(replay.ok, true);
  if (!replay.ok) return;
  assert.equal(replay.deduplicated, true);
  assert.equal(replay.state.choreography.interrupted, true);
  assert.deepEqual(replay.state.choreography.cameraTargetIds, []);
});

test('a distinct accepted semantic proposal may create a new choreography generation after interruption', () => {
  const p1 = proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-focus', kind: 'focus', targetId: 'closing', reason: 'Foco útil.' }] },
    sceneProposal: { composition: 'focus', focusIds: ['closing'], comparisonIds: [], announcement: null },
  });
  const first = projectExperienceProposal(createReactiveExperienceState({ basedOnRevision: 7 }), p1, canonical());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const interrupted = interruptExperienceChoreography(first.state);
  const p2 = proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-focus-2', kind: 'focus', targetId: 'reconciliation', reason: 'Novo foco.' }] },
    sceneProposal: { composition: 'focus', focusIds: ['reconciliation'], comparisonIds: [], announcement: null },
  });
  const second = projectExperienceProposal(interrupted, p2, canonical());
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.deduplicated, false);
  assert.equal(second.state.choreography.generation, 2);
  assert.equal(second.state.choreography.interrupted, false);
  assert.deepEqual(second.state.choreography.cameraTargetIds, ['reconciliation']);
});

test('a new visual turn preserves previously displayed verified calculations and artifacts unless explicitly invalidated', () => {
  const initial = createReactiveExperienceState({ basedOnRevision: 7 });
  const first = projectExperienceProposal(initial, proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-quant', kind: 'quantify', calculationId: 'calc-1', targetId: 'closing', reason: 'Mostrar capacidade.' }] },
    artifactProposals: [{ id: 'artifact-1', kind: 'bi_dashboard', title: 'Painel de capacidade', summary: 'Visão conceitual.', evidenceIds: ['calc-1'], status: 'conceptual' }],
  }), canonical());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = projectExperienceProposal(first.state, proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-focus-new', kind: 'focus', targetId: 'reconciliation', reason: 'Novo foco.' }] },
    sceneProposal: { composition: 'focus', focusIds: ['reconciliation'], comparisonIds: [], announcement: null },
  }), canonical());
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.state.actions.some((item) => item.action.kind === 'quantify' && item.action.calculationId === 'calc-1'), true);
  assert.equal(second.state.actions.some((item) => item.action.kind === 'focus' && item.action.targetId === 'reconciliation'), true);
  assert.equal(second.state.artifacts.some((item) => item.id === 'artifact-1'), true);
});

test('equivalent visual intent deduplicates even when model-only ids and nonvisual reasons change', () => {
  const first = projectExperienceProposal(createReactiveExperienceState({ basedOnRevision: 7 }), proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-a', kind: 'focus', targetId: 'closing', reason: 'Razão A.' }] },
  }), canonical());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = projectExperienceProposal(first.state, proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-b', kind: 'focus', targetId: 'closing', reason: 'Razão B.' }] },
  }), canonical());
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.deduplicated, true);
  assert.equal(second.state, first.state);
});

test('annotation or announcement changes do not restart camera choreography when camera targets are unchanged', () => {
  const first = projectExperienceProposal(createReactiveExperienceState({ basedOnRevision: 7 }), proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-focus', kind: 'focus', targetId: 'closing', reason: 'Foco.' }] },
    sceneProposal: { composition: 'focus', focusIds: ['closing'], comparisonIds: [], announcement: 'Primeiro anúncio.' },
  }), canonical());
  assert.equal(first.ok, true);
  if (!first.ok) return;
  const second = projectExperienceProposal(first.state, proposal({
    intent: { ...proposal().intent, actions: [
      { id: 'action-focus-2', kind: 'focus', targetId: 'closing', reason: 'Mesmo foco.' },
      { id: 'action-note', kind: 'annotate', targetId: 'closing', text: 'Novo insight visual.', evidenceIds: ['calc-1'] },
    ] },
    sceneProposal: { composition: 'focus', focusIds: ['closing'], comparisonIds: [], announcement: 'Anúncio atualizado.' },
  }), canonical());
  assert.equal(second.ok, true);
  if (!second.ok) return;
  assert.equal(second.state.projectionRevision, 2);
  assert.equal(second.state.choreography.generation, 1);
});

test('unknown evidence and dangling artifact-intent references reject atomically', async (t) => {
  await t.test('unknown evidence', () => {
    const state = createReactiveExperienceState({ basedOnRevision: 7 });
    const result = projectExperienceProposal(state, proposal({
      artifactProposals: [{ id: 'artifact-1', kind: 'bi_dashboard', title: 'Painel', summary: 'Conceito.', evidenceIds: ['evidence-missing'], status: 'conceptual' }],
    }), canonical());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'UNKNOWN_EVIDENCE_REFERENCE');
    assert.equal(result.state, state);
  });
  await t.test('dangling artifact intent', () => {
    const state = createReactiveExperienceState({ basedOnRevision: 7 });
    const result = projectExperienceProposal(state, proposal({
      intent: { ...proposal().intent, actions: [{ id: 'action-demo', kind: 'demonstrate', artifactIntentId: 'artifact-intent-missing', reason: 'Demonstrar.' }] },
    }), canonical());
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.code, 'INVALID_ARTIFACT_REFERENCE');
    assert.equal(result.state, state);
  });
});

test('projection state is bounded across a long session instead of growing without limit', () => {
  let state = createReactiveExperienceState({ basedOnRevision: 7 });
  for (let i = 0; i < 64; i += 1) {
    const result = projectExperienceProposal(state, proposal({
      intent: { ...proposal().intent, actions: [{ id: `action-${i}`, kind: 'annotate', targetId: `node-${i}`, text: `Insight ${i}`, evidenceIds: [] }] },
    }), canonical());
    assert.equal(result.ok, true, `projection ${i}`);
    if (!result.ok) return;
    state = result.state;
  }
  assert.equal(state.actions.length, 64);
  const overflow = projectExperienceProposal(state, proposal({
    intent: { ...proposal().intent, actions: [{ id: 'action-overflow', kind: 'annotate', targetId: 'node-overflow', text: 'Overflow', evidenceIds: [] }] },
  }), canonical());
  assert.equal(overflow.ok, false);
  if (overflow.ok) return;
  assert.equal(overflow.code, 'PROJECTION_CAPACITY_EXCEEDED');
  assert.equal(overflow.state.actions.length, 64);
});

test('remove_element compacts contradictory process overlays and a later upsert can intentionally restore the element', () => {
  const initial = createReactiveExperienceState({ basedOnRevision: 7 });
  const first = projectExperienceProposal(initial, proposal({
    processMutations: [
      { id: 'mut-node', kind: 'upsert_node', nodeId: 'node-a', label: 'Conferência', summary: 'Etapa manual.', evidenceIds: [] },
      { id: 'mut-rel', kind: 'upsert_relationship', relationshipId: 'rel-a', sourceNodeId: 'node-a', targetNodeId: 'node-b', label: 'Entrega', evidenceIds: [] },
      { id: 'mut-state', kind: 'set_node_state', nodeId: 'node-a', state: 'active', reason: 'Confirmado.' },
    ],
  }), canonical());
  assert.equal(first.ok, true);
  if (!first.ok) return;

  const removed = projectExperienceProposal(first.state, proposal({
    processMutations: [{ id: 'mut-remove', kind: 'remove_element', targetId: 'node-a', reason: 'Correção do usuário.' }],
  }), canonical());
  assert.equal(removed.ok, true);
  if (!removed.ok) return;
  assert.equal(removed.state.processMutations.some((item) => item.mutation.kind === 'upsert_node' && item.mutation.nodeId === 'node-a'), false);
  assert.equal(removed.state.processMutations.some((item) => item.mutation.kind === 'set_node_state' && item.mutation.nodeId === 'node-a'), false);
  assert.equal(removed.state.processMutations.some((item) => item.mutation.kind === 'upsert_relationship' && (item.mutation.sourceNodeId === 'node-a' || item.mutation.targetNodeId === 'node-a')), false);
  assert.equal(removed.state.processMutations.some((item) => item.mutation.kind === 'remove_element' && item.mutation.targetId === 'node-a'), true);

  const restored = projectExperienceProposal(removed.state, proposal({
    processMutations: [{ id: 'mut-restore', kind: 'upsert_node', nodeId: 'node-a', label: 'Conferência revisada', summary: 'Etapa restaurada.', evidenceIds: [] }],
  }), canonical());
  assert.equal(restored.ok, true);
  if (!restored.ok) return;
  assert.equal(restored.state.processMutations.some((item) => item.mutation.kind === 'remove_element' && item.mutation.targetId === 'node-a'), false);
  assert.equal(restored.state.processMutations.some((item) => item.mutation.kind === 'upsert_node' && item.mutation.nodeId === 'node-a'), true);
});
