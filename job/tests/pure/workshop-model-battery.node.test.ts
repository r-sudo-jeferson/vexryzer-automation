import assert from 'node:assert/strict';
import test from 'node:test';
import {
  minIntervalMsForRps,
  MODEL_BATTERY_INTERVAL_MS,
  MODEL_CANDIDATES,
  validateBatteryConfiguration,
} from '../../tools/workshop-spike/run-mistral-model-battery.mjs';

test('tests GLM 5.2 first and only pinned candidate ids', () => {
  assert.equal(MODEL_CANDIDATES[0]?.id, 'zai-glm-5-2');
  assert.deepEqual(
    MODEL_CANDIDATES.map((candidate) => candidate.id),
    [
      'zai-glm-5-2',
      'mistral-medium-3-5',
      'mistral-small-2603',
      'mistral-large-2512',
      'ministral-14b-2512',
      'ministral-8b-2512',
      'ministral-3b-2512',
      'codestral-2508',
    ],
  );
  assert.equal(MODEL_CANDIDATES.some((candidate) => candidate.id.endsWith('-latest')), false);
  assert.doesNotThrow(() => validateBatteryConfiguration());
});

test('serializes requests slower than the strictest candidate RPS limit', () => {
  assert.equal(minIntervalMsForRps(0.5), 2_000);
  assert.equal(minIntervalMsForRps(1), 1_000);
  assert.ok(MODEL_BATTERY_INTERVAL_MS > minIntervalMsForRps(0.5));
  for (const candidate of MODEL_CANDIDATES) {
    assert.ok(MODEL_BATTERY_INTERVAL_MS >= minIntervalMsForRps(candidate.requestsPerSecond));
  }
});

test('captures the organization limits supplied for every tested candidate', () => {
  const limits = Object.fromEntries(
    MODEL_CANDIDATES.map((candidate) => [candidate.id, [candidate.tokensPerMinute, candidate.requestsPerSecond]]),
  );
  assert.deepEqual(limits['zai-glm-5-2'], [20_000, 1]);
  assert.deepEqual(limits['mistral-medium-3-5'], [20_000, 1]);
  assert.deepEqual(limits['mistral-small-2603'], [20_000, 1]);
  assert.deepEqual(limits['mistral-large-2512'], [250_000, 1]);
  assert.deepEqual(limits['ministral-14b-2512'], [937_500, 0.5]);
  assert.deepEqual(limits['ministral-8b-2512'], [625_000, 3.13]);
  assert.deepEqual(limits['ministral-3b-2512'], [1_300_000, 12.5]);
  assert.deepEqual(limits['codestral-2508'], [625_000, 2.08]);
});
