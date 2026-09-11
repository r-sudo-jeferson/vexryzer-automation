export const DEEPSEEK_HARNESS_IN_PROCESS_CONTRACT = Object.freeze({
  mode: 'in_process',
  harnessVersion: '0.1.5-rc.1',
  provider: 'deepseek-official',
  model: 'deepseek-v4-pro',
  credentialEnvName: 'DEEPSEEK_API_KEY',
  reasoningEffort: 'high',
  toolPresentationMode: 'native',
  maxParallelToolCalls: 1,
  runtimeActivation: 'NOT_VERIFIED',

  subprocessAllowed: false,
  cliProfileAllowed: false,
  shellToolsAllowed: false,
  filesystemToolsAllowed: false,
  codeRuntimeAllowed: false,
  attachmentsToModelAllowed: false,
  ambientProcessEnvAllowed: false,
  filesystemSessionPersistenceAllowed: false,

  persistence: 'vexryzer_blob_cas',
  persistenceRequiresParentLease: true,
  canonicalAuthority: 'vexryzer_deterministic_trust_kernel',
  harnessMemoryIsCanonical: false,
  restartRecoveryRequired: true,

  autoInstallPeers: false,
  requireExactLockfile: true,
  requireExactOverrides: true,

  packages: Object.freeze([
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
  ] as const),

  intentionallyUninstalledPeers: Object.freeze([
    '@deepseek-ai/dsh-code-runtime',
    '@deepseek-ai/dsh-deepseek-llm-api-extensions',
    '@deepseek-ai/dsh-fs',
    '@deepseek-ai/dsh-settings',
    '@deepseek-ai/dsh-user-approval',
  ] as const),
} as const);

export type DeepSeekHarnessInProcessContract = typeof DEEPSEEK_HARNESS_IN_PROCESS_CONTRACT;

const EXACT_HARNESS_VERSION = '0.1.5-rc.1';
const EXACT_PACKAGE_PATTERN = /^(?:@deepseek-ai\/[a-z0-9-]+|eventsource-parser|zod)@[0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.-]+)?$/;
const FORBIDDEN_PACKAGE_PATTERN = /(?:^|\/)dsh(?:$|@)|dsh-sdk|dsh-base|tool-bash|tool-pwsh|subprocess|terminal|sandbox|code-runtime|jobs/;

export function assertDeepSeekHarnessInProcessContract(
  contract: Readonly<DeepSeekHarnessInProcessContract> = DEEPSEEK_HARNESS_IN_PROCESS_CONTRACT,
): Readonly<DeepSeekHarnessInProcessContract> {
  if (contract.mode !== 'in_process'
    || contract.harnessVersion !== EXACT_HARNESS_VERSION
    || contract.provider !== 'deepseek-official'
    || contract.model !== 'deepseek-v4-pro'
    || contract.credentialEnvName !== 'DEEPSEEK_API_KEY'
    || contract.reasoningEffort !== 'high'
    || contract.toolPresentationMode !== 'native'
    || contract.maxParallelToolCalls !== 1
    || contract.runtimeActivation !== 'NOT_VERIFIED') {
    throw new Error('DEEPSEEK_HARNESS_IN_PROCESS_IDENTITY_INVALID');
  }

  if (contract.subprocessAllowed
    || contract.cliProfileAllowed
    || contract.shellToolsAllowed
    || contract.filesystemToolsAllowed
    || contract.codeRuntimeAllowed
    || contract.attachmentsToModelAllowed
    || contract.ambientProcessEnvAllowed
    || contract.filesystemSessionPersistenceAllowed) {
    throw new Error('DEEPSEEK_HARNESS_IN_PROCESS_CAPABILITY_BOUNDARY_INVALID');
  }

  if (contract.persistence !== 'vexryzer_blob_cas'
    || !contract.persistenceRequiresParentLease
    || contract.canonicalAuthority !== 'vexryzer_deterministic_trust_kernel'
    || contract.harnessMemoryIsCanonical
    || !contract.restartRecoveryRequired) {
    throw new Error('DEEPSEEK_HARNESS_IN_PROCESS_AUTHORITY_INVALID');
  }

  if (contract.autoInstallPeers
    || !contract.requireExactLockfile
    || !contract.requireExactOverrides) {
    throw new Error('DEEPSEEK_HARNESS_IN_PROCESS_RESOLUTION_POLICY_INVALID');
  }

  if (new Set(contract.packages).size !== contract.packages.length
    || new Set(contract.intentionallyUninstalledPeers).size !== contract.intentionallyUninstalledPeers.length) {
    throw new Error('DEEPSEEK_HARNESS_IN_PROCESS_DUPLICATE_PACKAGE');
  }

  for (const packageTuple of contract.packages) {
    if (!EXACT_PACKAGE_PATTERN.test(packageTuple) || FORBIDDEN_PACKAGE_PATTERN.test(packageTuple)) {
      throw new Error('DEEPSEEK_HARNESS_IN_PROCESS_PACKAGE_SURFACE_INVALID');
    }
    if (packageTuple.startsWith('@deepseek-ai/dsh-')
      && !packageTuple.endsWith('@' + EXACT_HARNESS_VERSION)) {
      throw new Error('DEEPSEEK_HARNESS_IN_PROCESS_VERSION_DRIFT');
    }
  }

  for (const peer of contract.intentionallyUninstalledPeers) {
    if (!peer.startsWith('@deepseek-ai/dsh-')) {
      throw new Error('DEEPSEEK_HARNESS_IN_PROCESS_PEER_POLICY_INVALID');
    }
    if (contract.packages.some((tuple) => tuple.startsWith(peer + '@'))) {
      throw new Error('DEEPSEEK_HARNESS_IN_PROCESS_PEER_POLICY_CONFLICT');
    }
  }

  return contract;
}
