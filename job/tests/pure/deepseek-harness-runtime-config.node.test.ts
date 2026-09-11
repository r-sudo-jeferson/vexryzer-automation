import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEEPSEEK_HARNESS_CHILD_ENV_KEYS,
  DEEPSEEK_HARNESS_RUNTIME_CONFIG,
  assertDeepSeekHarnessRuntimeConfig,
  createDeepSeekHarnessChildEnv,
} from '../../src/server/ai/harness/deepseek-harness-runtime-config.ts';

test('Harness launch identity is exact and lifecycle stays below the application deadline', () => {
  const config = assertDeepSeekHarnessRuntimeConfig();

  assert.equal(config.harnessVersion, '0.1.5-rc.1');
  assert.equal(config.profile, 'sdk-minimal');
  assert.equal(config.provider, 'deepseek-official');
  assert.equal(config.model, 'deepseek-v4-pro');
  assert.equal(config.reasoningEffort, 'high');
  assert.equal(config.patchRelativePath, 'config/deepseek-harness/vexryzer-visitor.cordis.patch.yml');

  const worstCaseLifecycleMs = config.initializeTimeoutMs
    + config.requestTimeoutMs
    + config.shutdownTimeoutMs
    + config.disposeEofGraceMs
    + (2 * config.disposeGraceMs);
  assert.ok(worstCaseLifecycleMs < config.outerExecutionTimeoutMs);
  assert.equal(config.outerExecutionTimeoutMs, 45_000);
});

test('Harness launch rejects identity drift and deadline overcommit', () => {
  assert.throws(
    () => assertDeepSeekHarnessRuntimeConfig({
      ...DEEPSEEK_HARNESS_RUNTIME_CONFIG,
      model: 'deepseek-v4-flash',
    } as never),
    /DEEPSEEK_HARNESS_RUNTIME_IDENTITY_INVALID/,
  );

  assert.throws(
    () => assertDeepSeekHarnessRuntimeConfig({
      ...DEEPSEEK_HARNESS_RUNTIME_CONFIG,
      requestTimeoutMs: 44_000,
    } as never),
    /DEEPSEEK_HARNESS_RUNTIME_DEADLINE_OVERCOMMITTED/,
  );
});

test('Harness child environment contains only the DeepSeek server credential', () => {
  const material = 'test-key-material-not-a-real-secret';
  const env = createDeepSeekHarnessChildEnv(material);

  assert.deepEqual(DEEPSEEK_HARNESS_CHILD_ENV_KEYS, ['DEEPSEEK_API_KEY']);
  assert.deepEqual(Object.keys(env), ['DEEPSEEK_API_KEY']);
  assert.equal(env.DEEPSEEK_API_KEY, material);
  assert.equal(Object.isFrozen(env), true);
});

test('Harness child environment rejects malformed credential material', () => {
  for (const value of ['', ' leading', 'trailing ', 'line\nbreak']) {
    assert.throws(() => createDeepSeekHarnessChildEnv(value), /invalid DeepSeek credential material/);
  }
});
