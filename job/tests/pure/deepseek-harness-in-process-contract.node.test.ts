import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEEPSEEK_HARNESS_IN_PROCESS_CONTRACT,
  assertDeepSeekHarnessInProcessContract,
} from '../../src/server/ai/harness/deepseek-harness-in-process-contract.ts';

test('Harness runtime is one in-process DeepSeek V4 Pro composition', () => {
  const contract = assertDeepSeekHarnessInProcessContract();

  assert.equal(contract.mode, 'in_process');
  assert.equal(contract.harnessVersion, '0.1.5-rc.1');
  assert.equal(contract.provider, 'deepseek-official');
  assert.equal(contract.model, 'deepseek-v4-pro');
  assert.equal(contract.credentialEnvName, 'DEEPSEEK_API_KEY');
  assert.equal(contract.reasoningEffort, 'high');
  assert.equal(contract.toolPresentationMode, 'native');
  assert.equal(contract.maxParallelToolCalls, 1);
  assert.equal(contract.runtimeActivation, 'NOT_VERIFIED');
});

test('Harness runtime forbids CLI/subprocess/shell/filesystem execution architecture', () => {
  const contract = DEEPSEEK_HARNESS_IN_PROCESS_CONTRACT;

  assert.equal(contract.subprocessAllowed, false);
  assert.equal(contract.cliProfileAllowed, false);
  assert.equal(contract.shellToolsAllowed, false);
  assert.equal(contract.filesystemToolsAllowed, false);
  assert.equal(contract.codeRuntimeAllowed, false);
  assert.equal(contract.attachmentsToModelAllowed, false);
  assert.equal(contract.ambientProcessEnvAllowed, false);
  assert.equal(contract.filesystemSessionPersistenceAllowed, false);
});

test('Harness runtime requires Vexryzer-owned durable persistence and canonical authority', () => {
  const contract = DEEPSEEK_HARNESS_IN_PROCESS_CONTRACT;

  assert.equal(contract.persistence, 'vexryzer_blob_cas');
  assert.equal(contract.persistenceRequiresParentLease, true);
  assert.equal(contract.canonicalAuthority, 'vexryzer_deterministic_trust_kernel');
  assert.equal(contract.harnessMemoryIsCanonical, false);
  assert.equal(contract.restartRecoveryRequired, true);
});

test('Harness package surface is exact rc.1 runtime closure without executable capability producers', () => {
  const packages = DEEPSEEK_HARNESS_IN_PROCESS_CONTRACT.packages;

  assert.deepEqual(packages, [
    '@deepseek-ai/cordis@4.0.2',
    '@deepseek-ai/schemastery@3.18.2',
    '@deepseek-ai/dsh-agent@0.1.5-rc.1',
    '@deepseek-ai/dsh-agent-loop@0.1.5-rc.1',
    '@deepseek-ai/dsh-anonymous-user-id@0.1.5-rc.1',
    '@deepseek-ai/dsh-attachment@0.1.5-rc.1',
    '@deepseek-ai/dsh-atomic-write@0.1.5-rc.1',
    '@deepseek-ai/dsh-brand@0.1.5-rc.1',
    '@deepseek-ai/dsh-credentials@0.1.5-rc.1',
    '@deepseek-ai/dsh-home-paths@0.1.5-rc.1',
    '@deepseek-ai/dsh-invariants@0.1.5-rc.1',
    '@deepseek-ai/dsh-launch-environment@0.1.5-rc.1',
    '@deepseek-ai/dsh-llm@0.1.5-rc.1',
    '@deepseek-ai/dsh-llm-deepseek@0.1.5-rc.1',
    '@deepseek-ai/dsh-scope@0.1.5-rc.1',
    '@deepseek-ai/dsh-session@0.1.5-rc.1',
    '@deepseek-ai/dsh-session-persistence@0.1.5-rc.1',
    '@deepseek-ai/dsh-session-projection@0.1.5-rc.1',
    '@deepseek-ai/dsh-system-prompt@0.1.5-rc.1',
    '@deepseek-ai/dsh-timeout@0.1.5-rc.1',
    '@deepseek-ai/dsh-tools@0.1.5-rc.1',
    '@deepseek-ai/dsh-util-values@0.1.5-rc.1',
    'eventsource-parser@3.1.0',
    'zod@4.4.3',
  ]);

  const joined = packages.join('\n');
  assert.doesNotMatch(joined, /@deepseek-ai\/dsh(?:$|@)|dsh-sdk|dsh-base|tool-bash|tool-pwsh|subprocess|terminal|sandbox|code-runtime|jobs/);
});

test('Harness package resolution cannot silently auto-install optional capability peers', () => {
  const contract = DEEPSEEK_HARNESS_IN_PROCESS_CONTRACT;

  assert.equal(contract.autoInstallPeers, false);
  assert.equal(contract.requireExactLockfile, true);
  assert.equal(contract.requireExactOverrides, true);
  assert.deepEqual(contract.intentionallyUninstalledPeers, [
    '@deepseek-ai/dsh-code-runtime',
    '@deepseek-ai/dsh-deepseek-llm-api-extensions',
    '@deepseek-ai/dsh-fs',
    '@deepseek-ai/dsh-settings',
    '@deepseek-ai/dsh-user-approval',
  ]);
});
