import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUTHORIZED_PROVIDER_CANDIDATES } from '../../src/ai/providers/provider-registry.ts';
import { selectProviderRoute } from '../../src/ai/providers/provider-router.ts';

const JOB_ROOT = fileURLToPath(new URL('../..', import.meta.url));
const REPO_ROOT = join(JOB_ROOT, '..');

const FORBIDDEN_PROVIDER_IDENTITIES = Object.freeze([
  'openai',
  'mistral',
  'groq',
  'anthropic',
  'claude',
  'gemini',
  'llama',
  'qwen',
  'cerebras',
  'openrouter',
  'cohere',
  'together',
  'fireworks',
  'ollama',
]);

const FORBIDDEN_ROUTING_SHAPES = Object.freeze([
  'independent_fallback',
  'fallbackreason',
  'contextmode',
  'emergencycapsuleinputtokens',
  'emergency_llm',
  'emergency_model',
  'emergency_provider',
  'emergency_route',
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
  assert.equal(route.billingAuthorization, 'PASS');
  assert.equal(route.workshopHarness, 'DeepSeek-Harness@0.1.5-rc.1');
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

test('active AI surfaces expose no second provider identity, model id, LLM credential or fallback-only route shape', async () => {
  const roots = [
    join(JOB_ROOT, 'src', 'ai'),
    join(JOB_ROOT, 'src', 'server', 'ai'),
    join(JOB_ROOT, 'tools'),
  ];
  const violations: string[] = [];

  const allowedModels = new Set(['deepseek-v4-pro']);
  const allowedFamilies = new Set(['deepseek']);
  const allowedCredentials = new Set(['DEEPSEEK_API_KEY']);
  const allowedHarnesses = new Set(['DeepSeek-Harness@0.1.5-rc.1']);

  for (const root of roots) {
    for (const path of await sourceFiles(root)) {
      const repoPath = relative(REPO_ROOT, path);
      const normalizedPath = repoPath.toLowerCase();
      const source = await readFile(path, 'utf8');
      const normalizedSource = source.toLowerCase();

      for (const identity of FORBIDDEN_PROVIDER_IDENTITIES) {
        if (normalizedPath.includes(identity)) {
          violations.push(`${repoPath} forbidden-provider-path=${identity}`);
        }
        if (normalizedSource.includes(identity)) {
          violations.push(`${repoPath} forbidden-provider-source=${identity}`);
        }
      }

      for (const shape of FORBIDDEN_ROUTING_SHAPES) {
        if (normalizedSource.includes(shape)) {
          violations.push(`${repoPath} forbidden-routing-shape=${shape}`);
        }
      }

      for (const match of source.matchAll(/modelId\s*:\s*['"]([^'"]+)['"]/g)) {
        if (!allowedModels.has(match[1]!)) violations.push(`${repoPath} model=${match[1]}`);
      }
      for (const match of source.matchAll(/family\s*:\s*['"]([^'"]+)['"]/g)) {
        if (!allowedFamilies.has(match[1]!)) violations.push(`${repoPath} family=${match[1]}`);
      }
      for (const match of source.matchAll(/credentialEnvName\s*:\s*['"]([^'"]+)['"]/g)) {
        if (!allowedCredentials.has(match[1]!)) {
          violations.push(`${repoPath} credential=${match[1]}`);
        }
      }
      for (const match of source.matchAll(/workshopHarness\s*:\s*['"]([^'"]+)['"]/g)) {
        if (!allowedHarnesses.has(match[1]!)) {
          violations.push(`${repoPath} harness=${match[1]}`);
        }
      }
    }
  }

  assert.deepEqual(violations, []);
});
