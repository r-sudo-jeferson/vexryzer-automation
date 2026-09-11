import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PROFILE_PATH = fileURLToPath(
  new URL('../../config/deepseek-harness/vexryzer-visitor.cordis.patch.yml', import.meta.url),
);

const DISABLED_ROWS = Object.freeze([
  'sandbox',
  'sandbox-policy',
  'subprocess',
  'pty',
  'terminal-bash',
  'terminal-pwsh',
  'jobs',
  'persistent-bash',
  'persistent-pwsh',
  'session-log-deepseek',
  'plugin-package-inventory-deepseek',
]);

test('Vexryzer Harness overlay pins one DeepSeek model and bounded provider policy', async () => {
  const source = await readFile(PROFILE_PATH, 'utf8');

  assert.match(source, /^- id: llm-deepseek$/m);
  assert.match(source, /^    apiKeyEnv: DEEPSEEK_API_KEY$/m);
  assert.match(source, /^    baseURL: https:\/\/api\.deepseek\.com$/m);
  assert.match(source, /^    thinking: enabled$/m);
  assert.match(source, /^    reasoningEffort: high$/m);
  assert.match(source, /^    streamIdleTimeoutMs: 12000$/m);
  assert.match(source, /^      maxRetries: 1$/m);
  assert.match(source, /^        jitterRatio: 0$/m);

  const modelIds = [...source.matchAll(/^\s+- id: (deepseek-[a-z0-9-]+)$/gm)].map((match) => match[1]);
  assert.deepEqual(modelIds, ['deepseek-v4-pro']);
  assert.doesNotMatch(source, /danger-full-access/i);
});

test('Vexryzer Harness overlay disables every sdk-minimal visitor execution surface', async () => {
  const source = await readFile(PROFILE_PATH, 'utf8');

  for (const id of DISABLED_ROWS) {
    const pattern = new RegExp('(?:^|\\n)- id: ' + id + '\\n  disabled: true(?:\\n|$)');
    assert.match(source, pattern, id);
  }

  assert.doesNotMatch(source, /- id: (?:persistent-bash|persistent-pwsh|subprocess|jobs)\n  disabled: false/);
});

test('Vexryzer Harness overlay replaces coding-agent persona with Trust-Kernel subordination', async () => {
  const source = await readFile(PROFILE_PATH, 'utf8');

  assert.match(source, /^- id: system-prompt$/m);
  assert.match(source, /^    includeHarnessIdentity: false$/m);
  assert.match(source, /^    includeRuntimeContext: false$/m);
  assert.match(source, /deterministic calculations/);
  assert.match(source, /canonical-truth authority/);
  assert.doesNotMatch(source, /software engineer assistant/i);
  assert.doesNotMatch(source, /coding agent/i);
});
