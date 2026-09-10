import test from 'node:test';
import assert from 'node:assert/strict';
import { packageContext } from '../../src/ai/context/context-packager.ts';

const canonical = {
  schemaVersion: 1 as const,
  sessionId: 'session-401',
  revision: 7,
  turnIds: ['turn-1', 'turn-2', 'turn-3'],
  facts: [
    { id: 'fact-confirmed', subject: 'fechamento', predicate: 'leva', value: '5 dias', status: 'confirmed', source: 'user', confidence: 1, supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1' },
    { id: 'fact-proposed', subject: 'retrabalho', predicate: 'parece', value: 'alto', status: 'proposed', source: 'inference', confidence: 0.6, supportingTurnIds: ['turn-2'], confirmedByTurnId: null },
  ],
  primaryPain: 'fechamento comprimido',
  desiredOutcome: 'liberar capacidade consultiva',
  knownConsequences: ['horas concentradas no fim do mês'],
  objections: [
    { id: 'objection-price', kind: 'price', summary: 'receio de custo', status: 'open', supportingTurnIds: ['turn-2'] },
  ],
  quantitativeObservations: [
    { id: 'obs-minutes', metric: 'tempo diário', value: 40, unit: 'minute', period: 'day', status: 'confirmed', source: 'user', supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1' },
  ],
  verifiedCalculations: [
    { id: 'calc-hours', kind: 'time_cost', inputObservationIds: ['obs-minutes'], expression: '40 min/day × 22 days', resultValue: 14.6666667, resultUnit: 'hour/month', computedBy: 'application', basedOnRevision: 7, status: 'valid', invalidatedAtRevision: null },
  ],
  openUncertainties: ['volume mensal exato'],
  opportunities: [],
  artifacts: [{ id: 'artifact-1', kind: 'bi_dashboard', title: 'Painel de fechamento', summary: 'Visão operacional conceitual do fechamento.', maturity: 'conceptual', evidenceIds: ['fact-confirmed'], status: 'revealed', invalidatedAtRevision: null }],
  currentSceneId: 'scene-closing',
  latestUserIntent: { turnId: 'turn-3', text: 'Quero reduzir o fechamento sem contratar mais gente.' },
} as const;

const digest = {
  schemaVersion: 1 as const,
  basedOnRevision: 7,
  facts: [
    { id: 'fact-confirmed', status: 'confirmed', source: 'user', subject: 'fechamento', predicate: 'leva', value: '5 dias' },
    { id: 'fact-proposed', status: 'proposed', source: 'inference', subject: 'retrabalho', predicate: 'parece', value: 'alto' },
  ],
  quantitativeObservations: [{ id: 'obs-minutes', metric: 'tempo diário', value: 40, unit: 'minute', period: 'day', status: 'confirmed', source: 'user' }],
  validCalculationIds: ['calc-hours'],
  openObjections: [{ id: 'objection-price', kind: 'price', summary: 'receio de custo' }],
  activeOpportunityIds: [],
  openUncertainties: ['volume mensal exato'],
  latestUserIntent: { turnId: 'turn-3', text: 'Quero reduzir o fechamento sem contratar mais gente.' },
} as const;

const visualState = {
  sceneId: 'scene-closing',
  focusedEntityIds: ['fact-confirmed'],
  activeArtifactIds: ['artifact-1'],
  processNodes: [{
    id: 'manual-review',
    label: 'Conferência manual',
    kind: 'manual_action',
    provenance: 'user_confirmed',
  }, {
    id: 'rework-loop',
    label: 'Retrabalho',
    kind: 'evidence',
    provenance: 'ai_inferred',
  }],
} as const;

const generousBudget = { maxInputTokens: 10_000, reservedOutputTokens: 2_000, emergencyInputTokens: 2_000 } as const;
const charEstimator = (value: unknown) => JSON.stringify(value).length;

function baseInput() {
  return {
    role: 'seller' as const,
    canonical,
    digest,
    recentTurns: [
      { id: 'turn-1', role: 'user' as const, text: 'O fechamento leva cinco dias.', includedInDigest: true },
      { id: 'turn-2', role: 'assistant' as const, text: 'Há um custo de capacidade que vale quantificar.', includedInDigest: true },
      { id: 'turn-3', role: 'user' as const, text: canonical.latestUserIntent.text },
      { id: 'turn-4', role: 'assistant' as const, text: 'Podemos tornar a capacidade visível.' },
      { id: 'turn-4', role: 'assistant' as const, text: 'duplicado não deve sobreviver' },
    ],
    visualState,
    budget: generousBudget,
    estimateTokens: charEstimator,
  };
}

test('prioritizes latest intent, confirmed truth, objections and quantitative evidence before old prose', () => {
  const input = baseInput();
  const calls: unknown[] = [];
  const result = packageContext({
    ...input,
    recentTurns: [
      ...input.recentTurns,
      { id: 'turn-old', role: 'assistant' as const, text: 'x'.repeat(4000) },
    ],
    budget: { maxInputTokens: 2800, reservedOutputTokens: 500, emergencyInputTokens: 1500 },
    estimateTokens(value: unknown) {
      calls.push(value);
      return JSON.stringify(value).length;
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pack.metadata.compaction, 'bounded');
  assert.equal(result.pack.metadata.attempts, 2);
  assert.equal(result.pack.latestUserIntent?.text, canonical.latestUserIntent.text);
  assert.equal(result.pack.confirmedFacts.some((item: { id: string }) => item.id === 'fact-confirmed'), true);
  assert.equal(result.pack.openObjections.some((item: { id: string }) => item.id === 'objection-price'), true);
  assert.equal(result.pack.quantitativeEvidence.observations.some((item: { id: string }) => item.id === 'obs-minutes'), true);
  assert.equal(result.pack.quantitativeEvidence.calculations.some((item: { id: string }) => item.id === 'calc-hours'), true);
  assert.equal(result.pack.activeArtifacts[0]?.maturity, 'conceptual');
  assert.equal(result.pack.activeArtifacts[0]?.summary, 'Visão operacional conceitual do fechamento.');
  assert.deepEqual(result.pack.visualState.processNodes?.map((item) => item.id), ['manual-review', 'rework-loop']);
  assert.equal(result.pack.visualState.processNodes?.[0]?.provenance, 'user_confirmed');
  assert.equal(result.pack.recentTurns.some((item: { id: string }) => item.id === 'turn-old'), false);
  assert.equal(calls.length, 2);
});

test('deduplicates recent turns and excludes digest-covered/latest-intent raw history', () => {
  const result = packageContext(baseInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(result.pack.recentTurns.map((item: { id: string }) => item.id), ['turn-4']);
  assert.equal(result.pack.metadata.droppedRecentTurnIds.includes('turn-1'), true);
  assert.equal(result.pack.metadata.droppedRecentTurnIds.includes('turn-2'), true);
  assert.equal(result.pack.metadata.droppedRecentTurnIds.includes('turn-3'), true);
});

test('rejects attachment-bearing recent-turn shapes rather than silently packaging attachment content', () => {
  const input = baseInput();
  const result = packageContext({
    ...input,
    recentTurns: [
      { id: 'turn-5', role: 'user', text: 'Enviei o arquivo.', attachmentContent: 'SEGREDO-DO-ARQUIVO' } as never,
    ],
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'ATTACHMENT_CONTENT_FORBIDDEN');
  assert.equal(JSON.stringify(result).includes('SEGREDO-DO-ARQUIVO'), false);
});

test('does not reconstruct a sales funnel or provider-side memory authority', () => {
  const result = packageContext(baseInput());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const serialized = JSON.stringify(result.pack);
  for (const forbidden of ['preferredSolutionKind', 'salesStage', 'questionSequence', 'providerConversationId', 'conversationId']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(result.pack.contract.some((line: string) => line.includes('strongest truthful next move')), true);
});

test('performs at most one bounded recompaction attempt before returning overflow', () => {
  let calls = 0;
  const result = packageContext({
    ...baseInput(),
    estimateTokens() {
      calls += 1;
      return 99_999;
    },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'CONTEXT_BUDGET_EXCEEDED');
  assert.equal(result.attempts, 2);
  assert.equal(calls, 2);
});

test('stale digest cannot reintroduce continuity state over a newer canonical revision', () => {
  const input = baseInput();
  const result = packageContext({
    ...input,
    digest: {
      ...digest,
      basedOnRevision: canonical.revision - 1,
      activeOpportunityIds: ['old-opportunity'],
    },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.pack.digestContinuity, null);
  assert.equal(JSON.stringify(result.pack).includes('old-opportunity'), false);
});
