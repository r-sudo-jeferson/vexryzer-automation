import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEEPSEEK_HARNESS_OFFICIAL_CONTRACT,
  assertDeepSeekHarnessOfficialContract,
} from '../../src/server/ai/harness/deepseek-harness-official-contract.ts';

test('Harness runtime is the official DeepSeek TypeScript SDK on exact rc.1 launcher surface', () => {
  const contract = assertDeepSeekHarnessOfficialContract();

  assert.equal(contract.mode, 'official_sdk_subprocess');
  assert.equal(contract.harnessVersion, '0.1.5-rc.1');
  assert.equal(contract.provider, 'deepseek-official');
  assert.equal(contract.model, 'deepseek-v4-pro');
  assert.equal(contract.credentialEnvName, 'DEEPSEEK_API_KEY');
  assert.equal(contract.launcherProfile, 'sdk');
  assert.equal(contract.runtimeActivation, 'NOT_VERIFIED');
  assert.deepEqual(contract.officialPackages, [
    '@deepseek-ai/dsh@0.1.5-rc.1',
    '@deepseek-ai/dsh-sdk-client@0.1.5-rc.1',
    '@deepseek-ai/dsh-sdk-protocol@0.1.5-rc.1',
  ]);
});
test('SDK subprocess is required but receives only an explicit replacement environment', () => {
  const contract = DEEPSEEK_HARNESS_OFFICIAL_CONTRACT;

  assert.equal(contract.subprocessRequired, true);
  assert.equal(contract.ambientProcessEnvAllowed, false);
  assert.equal(contract.explicitReplacementEnvRequired, true);
  assert.equal(contract.shellToolsAllowed, false);
  assert.equal(contract.filesystemToolsAllowed, false);
  assert.equal(contract.codeRuntimeAllowed, false);
  assert.equal(contract.attachmentsToModelAllowed, false);
});

test('Harness memory remains subordinate to Vexryzer durable authority', () => {
  const contract = DEEPSEEK_HARNESS_OFFICIAL_CONTRACT;

  assert.equal(contract.persistence, 'vexryzer_blob_cas');
  assert.equal(contract.persistenceRequiresParentLease, true);
  assert.equal(contract.canonicalAuthority, 'vexryzer_deterministic_trust_kernel');
  assert.equal(contract.harnessMemoryIsCanonical, false);
  assert.equal(contract.restartRecoveryRequired, true);
});
test('installed direct packages prove official DeepSeek provenance and exact direct versions', () => {
  const packageJson = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
    dependencies?: Record<string, string>;
  };
  for (const tuple of DEEPSEEK_HARNESS_OFFICIAL_CONTRACT.officialPackages) {
    const split = tuple.lastIndexOf('@');
    const name = tuple.slice(0, split);
    const version = tuple.slice(split + 1);
    assert.equal(packageJson.dependencies?.[name], version);
  }

  for (const name of ['dsh', 'dsh-sdk-client', 'dsh-sdk-protocol']) {
    const manifest = JSON.parse(readFileSync(
      new URL(`../../node_modules/@deepseek-ai/${name}/package.json`, import.meta.url),
      'utf8',
    )) as { name: string; version: string; repository?: { url?: string } };
    assert.equal(manifest.name, `@deepseek-ai/${name}`);
    assert.equal(manifest.version, '0.1.5-rc.1');
    assert.equal(manifest.repository?.url, 'git+https://github.com/deepseek-ai/deepseek-harness.git');
  }
});
