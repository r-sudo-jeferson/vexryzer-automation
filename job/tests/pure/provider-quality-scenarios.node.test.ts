import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTING_PROVIDER_QUALITY_SCENARIOS } from '../../tools/provider-quality/accounting-scenarios.ts';

const REQUIRED_SCENARIO_IDS = Object.freeze([
  'closing-pressure',
  'reconciliation-quantified',
  'document-collection',
  'import-reclassification',
  'portfolio-visibility',
  'training-consistency',
  'already-does-it-objection',
  'no-software-fit',
  'reconciliation-manual',
  'payroll-fiscal-handoff',
  'price-before-discovery',
  'change-complexity',
  'import-bi-training-composition',
] as const);

test('S002 provider quality battery preserves the complete 13-scenario authorized matrix', () => {
  assert.equal(ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.length, 13);
  assert.deepEqual(
    ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.map((scenario) => scenario.id),
    REQUIRED_SCENARIO_IDS,
  );
  assert.equal(new Set(REQUIRED_SCENARIO_IDS).size, REQUIRED_SCENARIO_IDS.length);
});

test('multi-capability fixture requires import, BI and training together rather than accepting a single classifier output', () => {
  const scenario = ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.find((item) => item.id === 'import-bi-training-composition');
  assert.ok(scenario);
  assert.deepEqual(
    scenario.requiredCapabilities,
    ['data_import_transform', 'bi_decision_intelligence', 'training_enablement'],
  );
});
