import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SELLER_LOCAL_TOOLS,
  parseSellerToolCall,
} from '../../src/server/ai/seller/seller-wire-tools.ts';

function tool(name: string, args: unknown) {
  return {
    id: 'call-1',
    type: 'function' as const,
    function: { name, arguments: JSON.stringify(args) },
  };
}

test('Seller exposes three closed local tools without model-owned trust metadata in observation/calculation schemas', () => {
  assert.deepEqual(SELLER_LOCAL_TOOLS.map((item) => item.function.name), [
    'capture_user_observations',
    'request_calculations',
    'submit_seller_submission',
  ]);
  for (const item of SELLER_LOCAL_TOOLS) {
    assert.equal(item.function.parameters.type, 'object');
    assert.equal(item.function.parameters.additionalProperties, false);
  }
  const observation = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'capture_user_observations')!;
  const calculation = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'request_calculations')!;
  for (const serialized of [JSON.stringify(observation), JSON.stringify(calculation)]) {
    assert.equal(serialized.includes('"baseRevision"'), false);
    assert.equal(serialized.includes('"turnId"'), false);
    assert.equal(serialized.includes('"source"'), false);
    assert.equal(serialized.includes('"resultValue"'), false);
  }
});

test('observation tool accepts only semantic kind, exact evidence quote and value', () => {
  const result = parseSellerToolCall(tool('capture_user_observations', {
    observations: [
      { kind: 'people_count', quote: 'somos 3 pessoas', value: 3 },
      { kind: 'minutes_per_person_per_day', quote: '40 minutos por pessoa por dia', value: 40 },
    ],
  }), 12);
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== 'user_observation_requests') return;
  assert.deepEqual(result.requests, [
    { kind: 'people_count', quote: 'somos 3 pessoas', value: 3 },
    { kind: 'minutes_per_person_per_day', quote: '40 minutos por pessoa por dia', value: 40 },
  ]);
});

test('observation tool rejects model-authored revision, ids, turn binding, provenance, units and duplicated semantic requests', () => {
  const authorityFields = ['id', 'baseRevision', 'turnId', 'source', 'unit', 'period'];
  for (const field of authorityFields) {
    const result = parseSellerToolCall(tool('capture_user_observations', {
      observations: [{ kind: 'people_count', quote: 'somos 3 pessoas', value: 3, [field]: field === 'baseRevision' ? 12 : 'forged' }],
    }), 12);
    assert.equal(result.ok, false, field);
  }
  const duplicate = parseSellerToolCall(tool('capture_user_observations', {
    observations: [
      { kind: 'people_count', quote: 'somos 3 pessoas', value: 3 },
      { kind: 'people_count', quote: 'somos 3 pessoas', value: 3 },
    ],
  }), 12);
  assert.deepEqual(duplicate, { ok: false, code: 'DUPLICATE_REQUEST' });
});

test('calculation tool accepts only semantic calculation kind and canonical observation references', () => {
  const result = parseSellerToolCall(tool('request_calculations', {
    requests: [{
      kind: 'monthly_capacity',
      peopleObservationId: 'obs-people',
      minutesPerPersonPerDayObservationId: 'obs-minutes',
      workingDaysPerMonthObservationId: 'obs-days',
    }],
  }), 12);
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== 'calculation_requests') return;
  assert.deepEqual(result.requests, [{
    kind: 'monthly_capacity',
    peopleObservationId: 'obs-people',
    minutesPerPersonPerDayObservationId: 'obs-minutes',
    workingDaysPerMonthObservationId: 'obs-days',
  }]);
});

test('calculation tool rejects model-authored id, revision, result and duplicate semantic requests', () => {
  for (const extra of [
    { id: 'calc-forged' },
    { baseRevision: 12 },
    { resultValue: 999 },
  ]) {
    const result = parseSellerToolCall(tool('request_calculations', {
      requests: [{
        kind: 'monthly_workload',
        occurrencesPerMonthObservationId: 'obs-occ',
        minutesPerOccurrenceObservationId: 'obs-min',
        ...extra,
      }],
    }), 12);
    assert.equal(result.ok, false);
  }
  const request = {
    kind: 'monthly_workload',
    occurrencesPerMonthObservationId: 'obs-occ',
    minutesPerOccurrenceObservationId: 'obs-min',
  };
  assert.deepEqual(parseSellerToolCall(tool('request_calculations', { requests: [request, request] }), 12), {
    ok: false,
    code: 'DUPLICATE_REQUEST',
  });
});

test('submission proposal revision is server-bound even when omitted or stale in model output', () => {
  for (const proposal of [
    { schemaVersion: 1, narration: 'x' },
    { schemaVersion: 1, baseRevision: 3, narration: 'x' },
  ]) {
    const result = parseSellerToolCall(tool('submit_seller_submission', {
      submission: {
        schemaVersion: 1,
        proposalId: 'proposal-1',
        proposal,
        materialClaims: [],
        calculationRequests: [],
      },
    }), 12);
    assert.equal(result.ok, true);
    if (!result.ok || result.kind !== 'seller_submission') continue;
    const normalized = result.submission['proposal'] as Record<string, unknown>;
    assert.equal(normalized['baseRevision'], 12);
  }
});

test('submission still rejects pending calculations, unknown wrapper fields and unknown tools fail-closed', () => {
  const pending = parseSellerToolCall(tool('submit_seller_submission', {
    submission: {
      schemaVersion: 1,
      proposalId: 'proposal-1',
      proposal: {},
      materialClaims: [],
      calculationRequests: [{ kind: 'monthly_workload' }],
    },
  }), 12);
  assert.equal(pending.ok, false);

  const extra = parseSellerToolCall(tool('submit_seller_submission', {
    submission: {
      schemaVersion: 1,
      proposalId: 'proposal-1',
      proposal: {},
      materialClaims: [],
      calculationRequests: [],
    },
    executable: 'nope',
  }), 12);
  assert.equal(extra.ok, false);
  assert.equal(parseSellerToolCall(tool('browser_search', {}), 12).ok, false);
});
