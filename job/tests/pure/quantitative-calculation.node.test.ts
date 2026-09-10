import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import { applyContextMutation } from '../../src/ai/context/context-reducer.ts';
import { computeVerifiedCalculation } from '../../src/ai/quant/calculation-engine.ts';
import { validateQuantitativeClaim } from '../../src/ai/quant/calculation-validation.ts';

function accept(context: ReturnType<typeof createCanonicalSalesContext>, envelope: Parameters<typeof applyContextMutation>[1]) {
  const result = applyContextMutation(context, envelope);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  return result.context;
}

function capacityFixture() {
  let context = createCanonicalSalesContext({ sessionId: 'session-quant-1' });
  context = accept(context, { baseRevision: 0, actor: 'user', mutation: { type: 'ADD_OBSERVATION', observation: {
    id: 'obs-people', metric: 'pessoas envolvidas', value: 3, unit: 'person', period: null,
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1',
  } } });
  context = accept(context, { baseRevision: 1, actor: 'user', mutation: { type: 'ADD_OBSERVATION', observation: {
    id: 'obs-minutes-day', metric: 'minutos por pessoa por dia', value: 40, unit: 'minute', period: 'day',
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-2'], confirmedByTurnId: 'turn-2',
  } } });
  context = accept(context, { baseRevision: 2, actor: 'user', mutation: { type: 'ADD_OBSERVATION', observation: {
    id: 'obs-days-month', metric: 'dias de trabalho no mes', value: 22, unit: 'day', period: 'month',
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-3'], confirmedByTurnId: 'turn-3',
  } } });
  return context;
}

test('computes accounting-office monthly capacity from canonical confirmed inputs', () => {
  const context = capacityFixture();
  const result = computeVerifiedCalculation(context, {
    id: 'calc-capacity-month',
    baseRevision: 3,
    kind: 'monthly_capacity',
    peopleObservationId: 'obs-people',
    minutesPerPersonPerDayObservationId: 'obs-minutes-day',
    workingDaysPerMonthObservationId: 'obs-days-month',
  });

  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(result.code);
  assert.equal(result.calculation.resultValue, 44);
  assert.equal(result.calculation.resultUnit, 'hour/month');
  assert.equal(result.calculation.computedBy, 'application');
  assert.equal(result.calculation.basedOnRevision, 3);
  assert.deepEqual(result.calculation.inputObservationIds, ['obs-people', 'obs-minutes-day', 'obs-days-month']);
});

test('rejects stale revision, missing input, unconfirmed evidence and unit mismatch', () => {
  const context = capacityFixture();
  assert.deepEqual(computeVerifiedCalculation(context, {
    id: 'calc-stale', baseRevision: 2, kind: 'monthly_capacity', peopleObservationId: 'obs-people',
    minutesPerPersonPerDayObservationId: 'obs-minutes-day', workingDaysPerMonthObservationId: 'obs-days-month',
  }), { ok: false, code: 'STALE_REVISION' });

  assert.deepEqual(computeVerifiedCalculation(context, {
    id: 'calc-missing', baseRevision: 3, kind: 'monthly_capacity', peopleObservationId: 'obs-missing',
    minutesPerPersonPerDayObservationId: 'obs-minutes-day', workingDaysPerMonthObservationId: 'obs-days-month',
  }), { ok: false, code: 'OBSERVATION_NOT_FOUND' });

  let proposed = createCanonicalSalesContext({ sessionId: 'session-quant-2' });
  proposed = accept(proposed, { baseRevision: 0, actor: 'model', mutation: { type: 'ADD_OBSERVATION', observation: {
    id: 'obs-people', metric: 'pessoas envolvidas', value: 3, unit: 'person', period: null,
    status: 'proposed', source: 'inference', supportingTurnIds: ['turn-1'], confirmedByTurnId: null,
  } } });
  proposed = accept(proposed, { baseRevision: 1, actor: 'user', mutation: { type: 'ADD_OBSERVATION', observation: {
    id: 'obs-minutes-day', metric: 'minutos por pessoa por dia', value: 40, unit: 'minute', period: 'day',
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-2'], confirmedByTurnId: 'turn-2',
  } } });
  proposed = accept(proposed, { baseRevision: 2, actor: 'user', mutation: { type: 'ADD_OBSERVATION', observation: {
    id: 'obs-days-month', metric: 'dias de trabalho no mes', value: 22, unit: 'day', period: 'month',
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-3'], confirmedByTurnId: 'turn-3',
  } } });
  assert.deepEqual(computeVerifiedCalculation(proposed, {
    id: 'calc-unverified', baseRevision: 3, kind: 'monthly_capacity', peopleObservationId: 'obs-people',
    minutesPerPersonPerDayObservationId: 'obs-minutes-day', workingDaysPerMonthObservationId: 'obs-days-month',
  }), { ok: false, code: 'UNVERIFIED_INPUT' });

  let mismatch = createCanonicalSalesContext({ sessionId: 'session-quant-3' });
  mismatch = accept(mismatch, { baseRevision: 0, actor: 'user', mutation: { type: 'ADD_OBSERVATION', observation: {
    id: 'obs-people', metric: 'clientes', value: 3, unit: 'client', period: null,
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-1'], confirmedByTurnId: 'turn-1',
  } } });
  mismatch = accept(mismatch, { baseRevision: 1, actor: 'user', mutation: { type: 'ADD_OBSERVATION', observation: {
    id: 'obs-minutes-day', metric: 'minutos', value: 40, unit: 'minute', period: 'day',
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-2'], confirmedByTurnId: 'turn-2',
  } } });
  mismatch = accept(mismatch, { baseRevision: 2, actor: 'user', mutation: { type: 'ADD_OBSERVATION', observation: {
    id: 'obs-days-month', metric: 'dias', value: 22, unit: 'day', period: 'month',
    status: 'confirmed', source: 'user', supportingTurnIds: ['turn-3'], confirmedByTurnId: 'turn-3',
  } } });
  assert.deepEqual(computeVerifiedCalculation(mismatch, {
    id: 'calc-unit', baseRevision: 3, kind: 'monthly_capacity', peopleObservationId: 'obs-people',
    minutesPerPersonPerDayObservationId: 'obs-minutes-day', workingDaysPerMonthObservationId: 'obs-days-month',
  }), { ok: false, code: 'UNIT_MISMATCH' });
});

test('commercial derived claims remain blocked unless a dedicated deterministic calculation supports them', () => {
  const context = capacityFixture();
  const computed = computeVerifiedCalculation(context, {
    id: 'calc-capacity-month', baseRevision: 3, kind: 'monthly_capacity', peopleObservationId: 'obs-people',
    minutesPerPersonPerDayObservationId: 'obs-minutes-day', workingDaysPerMonthObservationId: 'obs-days-month',
  });
  assert.equal(computed.ok, true);
  if (!computed.ok) throw new Error(computed.code);
  const stored = accept(context, { baseRevision: 3, actor: 'system', mutation: { type: 'ADD_CALCULATION', calculation: computed.calculation } });

  assert.deepEqual(validateQuantitativeClaim(stored, { kind: 'verified_result', calculationId: 'calc-capacity-month' }), { ok: true });
  assert.deepEqual(validateQuantitativeClaim(stored, { kind: 'savings', calculationId: 'calc-capacity-month' }), { ok: false, code: 'UNSUPPORTED_CLAIM' });
  assert.deepEqual(validateQuantitativeClaim(stored, { kind: 'roi', calculationId: 'calc-capacity-month' }), { ok: false, code: 'UNSUPPORTED_CLAIM' });
  assert.deepEqual(validateQuantitativeClaim(stored, { kind: 'payback', calculationId: 'calc-capacity-month' }), { ok: false, code: 'UNSUPPORTED_CLAIM' });
});
