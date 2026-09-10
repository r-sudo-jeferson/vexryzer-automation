import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SELLER_LOCAL_TOOLS,
  parseSellerToolCall,
} from '../../src/server/ai/seller/seller-wire-tools.ts';

test('Seller exposes exactly two application-owned local tools with closed root schemas', () => {
  assert.deepEqual(SELLER_LOCAL_TOOLS.map((tool) => tool.function.name), [
    'request_calculations',
    'submit_seller_submission',
  ]);
  for (const tool of SELLER_LOCAL_TOOLS) {
    assert.equal(tool.type, 'function');
    assert.equal(tool.function.parameters.type, 'object');
    assert.equal(tool.function.parameters.additionalProperties, false);
  }
  const serialized = JSON.stringify(SELLER_LOCAL_TOOLS).toLowerCase();
  assert.equal(serialized.includes('browser_search'), false);
  assert.equal(serialized.includes('code_interpreter'), false);
  assert.equal(serialized.includes('mcp'), false);
});

test('parses a bounded batch of calculation requests against the exact canonical revision', () => {
  const result = parseSellerToolCall({
    id: 'call-1',
    type: 'function',
    function: {
      name: 'request_calculations',
      arguments: JSON.stringify({
        requests: [
          {
            id: 'calc-1',
            kind: 'monthly_capacity',
            baseRevision: 12,
            peopleObservationId: 'obs-people',
            minutesPerPersonPerDayObservationId: 'obs-minutes',
            workingDaysPerMonthObservationId: 'obs-days',
          },
          {
            id: 'calc-2',
            kind: 'rework_volume',
            baseRevision: 12,
            volumeObservationId: 'obs-volume',
            reworkRateObservationId: 'obs-rate',
          },
        ],
      }),
    },
  }, 12);
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== 'calculation_requests') return;
  assert.equal(result.requests.length, 2);
  assert.equal(result.requests[0]?.baseRevision, 12);
});

test('rejects stale, duplicate or extra-field calculation requests before deterministic engine execution', () => {
  const cases = [
    {
      requests: [{
        id: 'calc-1', kind: 'monthly_workload', baseRevision: 11,
        occurrencesPerMonthObservationId: 'obs-occ', minutesPerOccurrenceObservationId: 'obs-min',
      }],
    },
    {
      requests: [
        {
          id: 'calc-1', kind: 'monthly_workload', baseRevision: 12,
          occurrencesPerMonthObservationId: 'obs-occ', minutesPerOccurrenceObservationId: 'obs-min',
        },
        {
          id: 'calc-1', kind: 'monthly_workload', baseRevision: 12,
          occurrencesPerMonthObservationId: 'obs-occ-2', minutesPerOccurrenceObservationId: 'obs-min-2',
        },
      ],
    },
    {
      requests: [{
        id: 'calc-1', kind: 'monthly_cost', baseRevision: 12,
        monthlyHoursObservationId: 'obs-hours', hourlyCostObservationId: 'obs-cost',
        resultValue: 999,
      }],
    },
  ];

  for (const args of cases) {
    const result = parseSellerToolCall({
      id: 'call-x', type: 'function',
      function: { name: 'request_calculations', arguments: JSON.stringify(args) },
    }, 12);
    assert.equal(result.ok, false);
  }
});

test('submission tool preserves raw submission for canonical Seller validator but pre-binds revision and top-level shape', () => {
  const rawSubmission = {
    schemaVersion: 1,
    proposalId: 'proposal-1',
    proposal: { schemaVersion: 1, baseRevision: 12 },
    materialClaims: [],
    calculationRequests: [],
  };
  const result = parseSellerToolCall({
    id: 'call-submit',
    type: 'function',
    function: {
      name: 'submit_seller_submission',
      arguments: JSON.stringify({ submission: rawSubmission }),
    },
  }, 12);
  assert.equal(result.ok, true);
  if (!result.ok || result.kind !== 'seller_submission') return;
  assert.deepEqual(result.submission, rawSubmission);
});

test('submission tool rejects pending calculations so deterministic arithmetic cannot bypass the calculation round-trip', () => {
  const result = parseSellerToolCall({
    id: 'call-submit',
    type: 'function',
    function: {
      name: 'submit_seller_submission',
      arguments: JSON.stringify({
        submission: {
          schemaVersion: 1,
          proposalId: 'proposal-1',
          proposal: { schemaVersion: 1, baseRevision: 12 },
          materialClaims: [],
          calculationRequests: [{
            id: 'calc-pending',
            kind: 'monthly_workload',
            baseRevision: 12,
            occurrencesPerMonthObservationId: 'obs-occ',
            minutesPerOccurrenceObservationId: 'obs-min',
          }],
        },
      }),
    },
  }, 12);
  assert.equal(result.ok, false);
});

test('submission tool rejects stale revision, unknown root keys and unknown tool names', () => {
  const stale = parseSellerToolCall({
    id: 'call-submit',
    type: 'function',
    function: {
      name: 'submit_seller_submission',
      arguments: JSON.stringify({
        submission: {
          schemaVersion: 1,
          proposalId: 'proposal-1',
          proposal: { schemaVersion: 1, baseRevision: 11 },
          materialClaims: [],
          calculationRequests: [],
        },
      }),
    },
  }, 12);
  assert.equal(stale.ok, false);

  const extra = parseSellerToolCall({
    id: 'call-submit',
    type: 'function',
    function: {
      name: 'submit_seller_submission',
      arguments: JSON.stringify({ submission: {}, executable: 'nope' }),
    },
  }, 12);
  assert.equal(extra.ok, false);

  const unknown = parseSellerToolCall({
    id: 'call-unknown',
    type: 'function',
    function: { name: 'browser_search', arguments: '{}' },
  }, 12);
  assert.equal(unknown.ok, false);
});
