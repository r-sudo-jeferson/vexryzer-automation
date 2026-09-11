import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTHORIZED_PROVIDER_CANDIDATES } from '../../src/ai/providers/provider-registry.ts';
import { selectProviderRoute } from '../../src/ai/providers/provider-router.ts';

const JOB_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REPO_ROOT = join(JOB_ROOT, '..');

const FORBIDDEN_ACTIVE_AI_IDENTIFIERS = Object.freeze([
  'cloudflare_workers_ai',
  'cloudflare workers ai',
  'groq',
  'openrouter',
  'mistral',
  'opencode',
  'openhands',
  'gpt-oss',
  'deepseek-v4-flash',
  'deepseek-chat',
  'deepseek-reasoner',
]);

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...await sourceFiles(path));
      continue;
    }
    if (/\.(?:ts|tsx|mts|mjs|js|json|yml|yaml|toml)$/.test(entry.name)) files.push(path);
  }
  return files;
}

test('active AI registry has exactly one DeepSeek V4 Pro route and one credential', () => {
  assert.equal(AUTHORIZED_PROVIDER_CANDIDATES.length, 1);
  const [route] = AUTHORIZED_PROVIDER_CANDIDATES;
  assert.ok(route);
  assert.equal(route.family, 'deepseek');
  assert.equal(route.modelId, 'deepseek-v4-pro');
  assert.equal(route.credentialEnvName, 'DEEPSEEK_API_KEY');
  assert.equal(route.tier, 'primary');
  assert.equal(route.enabledByDefault, true);
  assert.equal(route.credentialScope, 'server');
});

test('unavailable DeepSeek fails closed instead of selecting another LLM', () => {
  const route = AUTHORIZED_PROVIDER_CANDIDATES[0];
  assert.ok(route);
  const result = selectProviderRoute(
    AUTHORIZED_PROVIDER_CANDIDATES,
    {
      role: 'seller',
      canonicalRevision: 1,
      fullContextInputTokens: 100,
      emergencyCapsuleInputTokens: 100,
      requiresStreaming: true,
      requiresTools: true,
      requiresStructuredArguments: true,
    },
    [{ routeId: route.routeId, circuit: 'open', quota: 'available' }],
  );
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.recovery, 'deterministic_guided_discovery');
});

test('active runtime, tools and workflows contain no alternative AI provider/model/harness identifiers', async () => {
  const roots = [
    join(JOB_ROOT, 'src'),
    join(JOB_ROOT, 'tools'),
    join(REPO_ROOT, '.github', 'workflows'),
  ];
  const violations: string[] = [];

  for (const root of roots) {
    for (const path of await sourceFiles(root)) {
      const text = (await readFile(path, 'utf8')).toLowerCase();
      const matched = FORBIDDEN_ACTIVE_AI_IDENTIFIERS.filter((value) => text.includes(value));
      if (matched.length > 0) {
        violations.push(`${relative(REPO_ROOT, path)}: ${matched.join(', ')}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});
