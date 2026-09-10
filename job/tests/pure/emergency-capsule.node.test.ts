import test from 'node:test';
import assert from 'node:assert/strict';

const canonical = {
  schemaVersion: 1 as const,
  sessionId: 'session-402',
  revision: 9,
  turnIds: ['turn-9'],
  facts: [{ id: 'fact-clients', subject: 'carteira', predicate: 'clientes', value: 180, status: 'confirmed', source: 'user', confidence: 1, supportingTurnIds: ['turn-9'], confirmedByTurnId: 'turn-9' }],
  primaryPain: 'retrabalho mensal',
  desiredOutcome: 'ganhar capacidade',
  knownConsequences: [],
  objections: [{ id: 'obj-change', kind: 'change', summary: 'equipe sem tempo para mudança', status: 'open', supportingTurnIds: ['turn-9'] }],
  quantitativeObservations: [{ id: 'obs-clients', metric: 'clientes', value: 180, unit: 'client', period: null, status: 'confirmed', source: 'user', supportingTurnIds: ['turn-9'], confirmedByTurnId: 'turn-9' }],
  verifiedCalculations: [],
  openUncertainties: [],
  opportunities: [],
  artifacts: [{
    id: 'artifact-fallback',
    kind: 'prototype',
    title: 'Portal demonstrativo',
    summary: 'Protótipo não produtivo para reduzir incerteza.',
    maturity: 'prototype',
    evidenceIds: ['fact-clients'],
    status: 'revealed',
    invalidatedAtRevision: null,
  }],
  currentSceneId: 'scene-portfolio',
  latestUserIntent: { turnId: 'turn-9', text: 'Mostre o impacto sem depender da memória do provedor.' },
} as const;

const visualState = { sceneId: 'scene-portfolio', focusedEntityIds: ['fact-clients'], activeArtifactIds: ['artifact-fallback'] } as const;

test('emergency capsule module exposes the fallback boundary', async () => {
  let moduleValue: Record<string, unknown> | null = null;
  try {
    moduleValue = await import('../../src/ai/context/emergency-capsule.ts');
  } catch {
    moduleValue = null;
  }
  assert.equal(typeof moduleValue?.buildEmergencyContinuationCapsule, 'function');
});

test('Groq-style emergency switch rebuilds from canonical truth and stays inside the injected emergency budget', async () => {
  const { buildEmergencyContinuationCapsule } = await import('../../src/ai/context/emergency-capsule.ts');
  const budget = { maxInputTokens: 8000, reservedOutputTokens: 2000, emergencyInputTokens: 1800 } as const;
  const estimateTokens = (value: unknown) => JSON.stringify(value).length;
  const result = buildEmergencyContinuationCapsule({ canonical, visualState, budget, estimateTokens });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.capsule.canonicalRevision, canonical.revision);
  assert.equal(result.capsule.confirmedFacts[0]?.id, 'fact-clients');
  assert.equal(result.capsule.latestUserIntent?.text, canonical.latestUserIntent.text);
  assert.equal(result.capsule.activeArtifacts[0]?.id, 'artifact-fallback');
  assert.equal(result.capsule.activeArtifacts[0]?.maturity, 'prototype');
  assert.equal(result.capsule.activeArtifacts[0]?.status, 'revealed');
  assert.equal(result.capsule.estimatedInputTokens <= budget.emergencyInputTokens, true);
  const serialized = JSON.stringify(result.capsule);
  assert.equal(serialized.includes('providerConversationId'), false);
  assert.equal(serialized.includes('conversationId'), false);
});
