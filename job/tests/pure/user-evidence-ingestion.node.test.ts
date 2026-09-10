import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanonicalSalesContext, type CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import { applyContextMutation } from '../../src/ai/context/context-reducer.ts';
import {
  captureQuotedUserObservations,
  type QuotedUserObservationRequest,
} from '../../src/ai/context/user-evidence-ingestion.ts';

function canonical(text: string): CanonicalSalesContext {
  const base = createCanonicalSalesContext({ sessionId: 'session-user-evidence' });
  const result = applyContextMutation(base, {
    baseRevision: 0,
    actor: 'user',
    mutation: { type: 'SET_LATEST_USER_INTENT', turnId: 'turn-user-1', intent: text },
  });
  if (!result.ok) throw new Error(result.code);
  return result.context;
}

function request(overrides: Partial<QuotedUserObservationRequest> = {}): QuotedUserObservationRequest {
  return {
    id: 'obs-people',
    kind: 'people_count',
    baseRevision: 1,
    turnId: 'turn-user-1',
    quote: 'somos 3 pessoas',
    value: 3,
    ...overrides,
  };
}

test('captures only a numeric observation explicitly quoted from the authoritative current user turn', () => {
  const context = canonical('No fechamento somos 3 pessoas e gastamos 40 minutos por pessoa por dia.');
  const result = captureQuotedUserObservations(context, [
    request(),
    request({
      id: 'obs-minutes',
      kind: 'minutes_per_person_per_day',
      quote: '40 minutos por pessoa por dia',
      value: 40,
    }),
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.observations.length, 2);
  assert.deepEqual(result.observations.map((item) => ({
    id: item.id,
    value: item.value,
    unit: item.unit,
    period: item.period,
    source: item.source,
    status: item.status,
    confirmedByTurnId: item.confirmedByTurnId,
  })), [
    { id: 'obs-people', value: 3, unit: 'person', period: null, source: 'user', status: 'confirmed', confirmedByTurnId: 'turn-user-1' },
    { id: 'obs-minutes', value: 40, unit: 'minute', period: 'day', source: 'user', status: 'confirmed', confirmedByTurnId: 'turn-user-1' },
  ]);
});

test('supports conservative Brazilian numeric notation without treating the model value as authority', () => {
  const context = canonical('Processamos 1.500 documentos por mês e cerca de 7,5% voltam para retrabalho.');
  const result = captureQuotedUserObservations(context, [
    request({
      id: 'obs-documents',
      kind: 'monthly_document_volume',
      quote: '1.500 documentos por mês',
      value: 1500,
    }),
    request({
      id: 'obs-rework',
      kind: 'rework_rate_percent',
      quote: '7,5% voltam para retrabalho',
      value: 7.5,
    }),
  ]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.observations[0]?.value, 1500);
  assert.equal(result.observations[1]?.value, 7.5);
});

test('rejects hallucinated value, semantic relabeling, wrong turn, stale revision and non-literal quote', async (t) => {
  const context = canonical('Somos 3 pessoas e trabalhamos 22 dias no mês.');

  const cases: Array<[string, QuotedUserObservationRequest, string]> = [
    ['hallucinated value', request({ value: 30 }), 'VALUE_NOT_IN_QUOTE'],
    ['semantic relabeling', request({ kind: 'monthly_client_volume' }), 'SEMANTIC_MARKER_MISMATCH'],
    ['wrong turn', request({ turnId: 'turn-other' }), 'TURN_MISMATCH'],
    ['stale revision', request({ baseRevision: 0 }), 'STALE_REVISION'],
    ['invented quote', request({ quote: 'somos 30 pessoas', value: 30 }), 'QUOTE_NOT_FOUND'],
  ];

  for (const [name, candidate, code] of cases) {
    await t.test(name, () => {
      const result = captureQuotedUserObservations(context, [candidate]);
      assert.equal(result.ok, false);
      if (!result.ok) assert.equal(result.code, code);
    });
  }
});

test('one invalid sibling rejects the entire capture batch and returns no partial observations', () => {
  const context = canonical('Somos 3 pessoas e trabalhamos 22 dias no mês.');
  const result = captureQuotedUserObservations(context, [
    request(),
    request({
      id: 'obs-days',
      kind: 'working_days_per_month',
      quote: '22 dias no mês',
      value: 99,
    }),
  ]);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, 'VALUE_NOT_IN_QUOTE');
    assert.equal(Object.hasOwn(result, 'observations'), false);
  }
});

test('count-like semantics reject fractional values and bounded percent/day semantics reject impossible values', () => {
  const people = canonical('Somos 3,5 pessoas.');
  const fractional = captureQuotedUserObservations(people, [
    request({ quote: '3,5 pessoas', value: 3.5 }),
  ]);
  assert.equal(fractional.ok, false);
  if (!fractional.ok) assert.equal(fractional.code, 'INVALID_REQUEST');

  const days = canonical('Trabalhamos 40 dias no mês.');
  const impossibleDays = captureQuotedUserObservations(days, [
    request({ id: 'obs-days', kind: 'working_days_per_month', quote: '40 dias no mês', value: 40 }),
  ]);
  assert.equal(impossibleDays.ok, false);
  if (!impossibleDays.ok) assert.equal(impossibleDays.code, 'INVALID_REQUEST');

  const percent = canonical('O retrabalho é de 120%.');
  const impossiblePercent = captureQuotedUserObservations(percent, [
    request({ id: 'obs-rate', kind: 'rework_rate_percent', quote: '120%', value: 120 }),
  ]);
  assert.equal(impossiblePercent.ok, false);
  if (!impossiblePercent.ok) assert.equal(impossiblePercent.code, 'INVALID_REQUEST');
});
