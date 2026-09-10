import test from 'node:test';
import assert from 'node:assert/strict';
import { PERFORMANCE_BUDGETS, classifyPerformanceSample } from '../../src/performance/budgets.ts';

test('performance budgets encode the S001 contract thresholds', () => {
  assert.equal(PERFORMANCE_BUDGETS.lcpMs, 2500);
  assert.equal(PERFORMANCE_BUDGETS.inpMs, 200);
  assert.equal(PERFORMANCE_BUDGETS.cls, 0.1);
});

test('sample classification fails any exceeded contract threshold', () => {
  assert.equal(classifyPerformanceSample({ lcpMs: 2200, inpMs: 150, cls: 0.05 }).ok, true);
  assert.equal(classifyPerformanceSample({ lcpMs: 2600, inpMs: 150, cls: 0.05 }).ok, false);
  assert.equal(classifyPerformanceSample({ lcpMs: 2200, inpMs: 230, cls: 0.05 }).ok, false);
  assert.equal(classifyPerformanceSample({ lcpMs: 2200, inpMs: 150, cls: 0.12 }).ok, false);
});
