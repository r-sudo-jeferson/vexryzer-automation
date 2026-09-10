import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNTING_PROVIDER_QUALITY_SCENARIOS,
  PROVIDER_CONTINUITY_QUALITY_SCENARIOS,
  S002_REQUIRED_PROVIDER_QUALITY_MATRIX,
} from '../../tools/provider-quality/accounting-scenarios.ts';

const REQUIRED_SCENARIOS = Object.freeze([
  [1, 'vague-operational-pain', 'vague operational pain'],
  [2, 'detailed-process-upfront', 'detailed process supplied upfront'],
  [3, 'skeptical-visitor', 'skeptical visitor'],
  [4, 'direct-price-question', 'direct price question'],
  [5, 'repeated-manual-reconciliation', 'repeated manual reconciliation'],
  [6, 'explicit-ai-agent-request', 'user asks specifically for AI agent'],
  [7, 'training-process-better-than-software', 'training/process improvement is a better fit than software'],
  [8, 'corrected-earlier-fact', 'user corrects an earlier fact'],
  [9, 'material-contradiction', 'material contradiction'],
  [10, 'trust-feasibility-objection', 'explicit objection about trust/feasibility'],
  [11, 'free-implementation-recipe', 'user wants free implementation recipe'],
  [12, 'provider-fallback-mid-conversation', 'provider fallback mid-conversation'],
  [13, 'all-provider-failure-and-later-recovery', 'all-provider failure and later recovery'],
] as const);

test('S002 provider-quality matrix exactly binds all 13 normative scenarios in authorized order', () => {
  assert.equal(S002_REQUIRED_PROVIDER_QUALITY_MATRIX.length, 13);
  assert.deepEqual(
    S002_REQUIRED_PROVIDER_QUALITY_MATRIX.map((item) => [
      item.contractOrdinal,
      item.id,
      item.contractRequirement,
    ]),
    REQUIRED_SCENARIOS,
  );
  assert.equal(new Set(S002_REQUIRED_PROVIDER_QUALITY_MATRIX.map((item) => item.id)).size, 13);
  assert.deepEqual(
    S002_REQUIRED_PROVIDER_QUALITY_MATRIX.map((item) => item.contractOrdinal),
    Array.from({ length: 13 }, (_, index) => index + 1),
  );
});

test('only the first eleven scenarios are isolated Seller-quality cases; 12-13 remain continuity/recovery gates', () => {
  assert.equal(ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.length, 11);
  assert.deepEqual(
    ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.map((item) => item.contractOrdinal),
    Array.from({ length: 11 }, (_, index) => index + 1),
  );
  assert.deepEqual(
    PROVIDER_CONTINUITY_QUALITY_SCENARIOS.map((item) => [item.contractOrdinal, item.id]),
    [
      [12, 'provider-fallback-mid-conversation'],
      [13, 'all-provider-failure-and-later-recovery'],
    ],
  );
  assert.equal(ACCOUNTING_PROVIDER_QUALITY_SCENARIOS[7]?.setup, 'corrected_fact');
  assert.equal(ACCOUNTING_PROVIDER_QUALITY_SCENARIOS[8]?.setup, 'material_contradiction');
});

test('detailed-process fixture preserves composable import + BI + training coverage rather than reducing to one classifier', () => {
  const scenario = ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.find((item) => item.id === 'detailed-process-upfront');
  assert.ok(scenario);
  assert.deepEqual(
    scenario.requiredCapabilities,
    ['data_import_transform', 'bi_decision_intelligence', 'training_enablement'],
  );
});

test('quantified reconciliation remains a deterministic-calculation requirement inside the normative matrix', () => {
  const scenario = ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.find((item) => item.id === 'repeated-manual-reconciliation');
  assert.ok(scenario);
  assert.equal(scenario.quantitativeExpectation, 'verified_calculation');
});
