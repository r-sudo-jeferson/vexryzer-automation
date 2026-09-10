import test from 'node:test';
import assert from 'node:assert/strict';
import { freezeCanonicalSalesContext, type CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import { applyContextMutation } from '../../src/ai/context/context-reducer.ts';
import { computeVerifiedCalculation } from '../../src/ai/quant/calculation-engine.ts';
import type { CalculationRequest } from '../../src/ai/quant/quantity-types.ts';

function context(): CanonicalSalesContext {
  return freezeCanonicalSalesContext({
    schemaVersion: 1,
    sessionId: 'session-batch',
    revision: 7,
    turnIds: ['turn-7'],
    facts: [],
    primaryPain: 'retrabalho no fechamento',
    desiredOutcome: 'recuperar capacidade',
    knownConsequences: [],
    objections: [],
    quantitativeObservations: [
      { id: 'obs-occurrences', metric: 'ocorrencias', value: 120, unit: 'occurrence', period: 'month', status: 'confirmed', source: 'user', supportingTurnIds: ['turn-7'], confirmedByTurnId: 'turn-7' },
      { id: 'obs-minutes', metric: 'minutos por ocorrencia', value: 15, unit: 'minute', period: 'event', status: 'confirmed', source: 'user', supportingTurnIds: ['turn-7'], confirmedByTurnId: 'turn-7' },
      { id: 'obs-documents', metric: 'documentos', value: 400, unit: 'document', period: 'month', status: 'confirmed', source: 'user', supportingTurnIds: ['turn-7'], confirmedByTurnId: 'turn-7' },
      { id: 'obs-rework-rate', metric: 'taxa de retrabalho', value: 10, unit: 'percent', period: null, status: 'confirmed', source: 'user', supportingTurnIds: ['turn-7'], confirmedByTurnId: 'turn-7' },
    ],
    verifiedCalculations: [],
    openUncertainties: [],
    opportunities: [],
    artifacts: [],
    currentSceneId: null,
    latestUserIntent: { turnId: 'turn-7', text: 'Quero entender o custo do retrabalho.' },
  });
}

const requests: readonly CalculationRequest[] = [
  { id: 'calc-workload', kind: 'monthly_workload', baseRevision: 7, occurrencesPerMonthObservationId: 'obs-occurrences', minutesPerOccurrenceObservationId: 'obs-minutes' },
  { id: 'calc-rework', kind: 'rework_volume', baseRevision: 7, volumeObservationId: 'obs-documents', reworkRateObservationId: 'obs-rework-rate' },
];

function calculations(base: CanonicalSalesContext) {
  return requests.map((request) => {
    const result = computeVerifiedCalculation(base, request);
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(result.code);
    return result.calculation;
  });
}

test('commits sibling application calculations atomically at one canonical revision', () => {
  const base = context();
  const batch = calculations(base);
  const result = applyContextMutation(base, {
    baseRevision: 7,
    actor: 'system',
    mutation: { type: 'ADD_CALCULATIONS', calculations: batch },
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.context.revision, 8);
  assert.deepEqual(result.context.verifiedCalculations.map((item) => item.id), ['calc-workload', 'calc-rework']);
  assert.deepEqual(result.context.verifiedCalculations.map((item) => item.basedOnRevision), [7, 7]);
});

test('batch is all-or-nothing when a sibling calculation id collides with canonical state', () => {
  const base0 = context();
  const first = calculations(base0)[0]!;
  const seeded = freezeCanonicalSalesContext({ ...base0, verifiedCalculations: [first] });
  const batch = calculations(seeded);

  const result = applyContextMutation(seeded, {
    baseRevision: 7,
    actor: 'system',
    mutation: { type: 'ADD_CALCULATIONS', calculations: batch },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'DUPLICATE_ID');
  assert.equal(seeded.revision, 7);
  assert.equal(seeded.verifiedCalculations.length, 1);
});

test('batch rejects forged/non-application siblings without committing valid siblings', () => {
  const base = context();
  const batch = calculations(base);
  const forged = { ...batch[1]!, computedBy: 'model' };

  const result = applyContextMutation(base, {
    baseRevision: 7,
    actor: 'system',
    mutation: { type: 'ADD_CALCULATIONS', calculations: [batch[0]!, forged] as unknown as typeof batch },
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'AUTHORITY_VIOLATION');
  assert.equal(base.verifiedCalculations.length, 0);
});

test('batch rejects duplicate sibling ids before mutating canonical state', () => {
  const base = context();
  const first = calculations(base)[0]!;
  const duplicate = { ...calculations(base)[1]!, id: first.id };
  const result = applyContextMutation(base, {
    baseRevision: 7,
    actor: 'system',
    mutation: { type: 'ADD_CALCULATIONS', calculations: [first, duplicate] },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'DUPLICATE_ID');
  assert.equal(base.verifiedCalculations.length, 0);
});

test('batch rejects empty and oversized arrays without revision change', () => {
  const base = context();
  for (const list of [[], Array.from({ length: 9 }, (_, index) => ({ ...calculations(base)[0]!, id: `calc-${index}` }))]) {
    const result = applyContextMutation(base, {
      baseRevision: 7,
      actor: 'system',
      mutation: { type: 'ADD_CALCULATIONS', calculations: list },
    });
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.code, 'INVALID_MUTATION');
    assert.equal(result.revision, 7);
  }
});

test('batch rejects a sibling calculated from a different canonical revision', () => {
  const base = context();
  const batch = calculations(base);
  const stale = { ...batch[1]!, basedOnRevision: 6 };
  const result = applyContextMutation(base, {
    baseRevision: 7,
    actor: 'system',
    mutation: { type: 'ADD_CALCULATIONS', calculations: [batch[0]!, stale] },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'INVALID_MUTATION');
  assert.equal(base.verifiedCalculations.length, 0);
});
