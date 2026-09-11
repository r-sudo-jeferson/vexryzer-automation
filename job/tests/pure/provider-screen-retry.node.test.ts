import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PROVIDER_SCREEN_CAPACITY_RETRY_LIMIT,
  shouldRetryProviderScreenStatus,
} from '../../tools/workshop-spike/provider-screen-retry.ts';

test('provider screen permits exactly one retry for transient capacity and nothing else', () => {
  assert.equal(PROVIDER_SCREEN_CAPACITY_RETRY_LIMIT, 1);
  assert.equal(shouldRetryProviderScreenStatus(500, 0), true);
  assert.equal(shouldRetryProviderScreenStatus(503, 0), true);
  assert.equal(shouldRetryProviderScreenStatus(599, 0), true);

  assert.equal(shouldRetryProviderScreenStatus(500, 1), false);
  assert.equal(shouldRetryProviderScreenStatus(504, 0), false);
  assert.equal(shouldRetryProviderScreenStatus(429, 0), false);
  assert.equal(shouldRetryProviderScreenStatus(403, 0), false);
  assert.equal(shouldRetryProviderScreenStatus(400, 0), false);
  assert.equal(shouldRetryProviderScreenStatus(200, 0), false);
  assert.equal(shouldRetryProviderScreenStatus(500, -1), false);
});
