export const DEEPSEEK_HARNESS_OFFICIAL_CONTRACT = Object.freeze({
  mode: 'official_sdk_subprocess',
  harnessVersion: '0.1.5-rc.1',
  provider: 'deepseek-official',
  model: 'deepseek-v4-pro',
  credentialEnvName: 'DEEPSEEK_API_KEY',
  reasoningEffort: 'high',
  toolPresentationMode: 'native',
  maxParallelToolCalls: 1,
  launcherProfile: 'sdk',
  runtimeActivation: 'NOT_VERIFIED',

  subprocessRequired: true,
  ambientProcessEnvAllowed: false,
  explicitReplacementEnvRequired: true,
  shellToolsAllowed: false,
  filesystemToolsAllowed: false,
  codeRuntimeAllowed: false,
  attachmentsToModelAllowed: false,
  filesystemSessionPersistenceAllowed: false,

  persistence: 'vexryzer_blob_cas',
  persistenceRequiresParentLease: true,
  canonicalAuthority: 'vexryzer_deterministic_trust_kernel',
  harnessMemoryIsCanonical: false,
  restartRecoveryRequired: true,
  requireFrozenLockfile: true,
  resolvedClosureMustMatchLockfile: true,
  autoInstallPeers: false,

  officialPackages: Object.freeze([
    '@deepseek-ai/dsh@0.1.5-rc.1',
    '@deepseek-ai/dsh-sdk-client@0.1.5-rc.1',
    '@deepseek-ai/dsh-sdk-protocol@0.1.5-rc.1',
  ] as const),
} as const);

export type DeepSeekHarnessOfficialContract = typeof DEEPSEEK_HARNESS_OFFICIAL_CONTRACT;

const EXACT_HARNESS_VERSION = '0.1.5-rc.1';
const EXACT_OFFICIAL_PACKAGES = Object.freeze([
  '@deepseek-ai/dsh@0.1.5-rc.1',
  '@deepseek-ai/dsh-sdk-client@0.1.5-rc.1',
  '@deepseek-ai/dsh-sdk-protocol@0.1.5-rc.1',
] as const);

export function assertDeepSeekHarnessOfficialContract(
  contract: Readonly<DeepSeekHarnessOfficialContract> = DEEPSEEK_HARNESS_OFFICIAL_CONTRACT,
): Readonly<DeepSeekHarnessOfficialContract> {
  if (contract.mode !== 'official_sdk_subprocess'
    || contract.harnessVersion !== EXACT_HARNESS_VERSION
    || contract.provider !== 'deepseek-official'
    || contract.model !== 'deepseek-v4-pro'
    || contract.credentialEnvName !== 'DEEPSEEK_API_KEY'
    || contract.reasoningEffort !== 'high'
    || contract.toolPresentationMode !== 'native'
    || contract.maxParallelToolCalls !== 1
    || contract.launcherProfile !== 'sdk'
    || contract.runtimeActivation !== 'NOT_VERIFIED') {
    throw new Error('DEEPSEEK_HARNESS_OFFICIAL_IDENTITY_INVALID');
  }
  if (!contract.subprocessRequired
    || contract.ambientProcessEnvAllowed
    || !contract.explicitReplacementEnvRequired
    || contract.shellToolsAllowed
    || contract.filesystemToolsAllowed
    || contract.codeRuntimeAllowed
    || contract.attachmentsToModelAllowed
    || contract.filesystemSessionPersistenceAllowed) {
    throw new Error('DEEPSEEK_HARNESS_OFFICIAL_CAPABILITY_BOUNDARY_INVALID');
  }

  if (contract.persistence !== 'vexryzer_blob_cas'
    || !contract.persistenceRequiresParentLease
    || contract.canonicalAuthority !== 'vexryzer_deterministic_trust_kernel'
    || contract.harnessMemoryIsCanonical
    || !contract.restartRecoveryRequired) {
    throw new Error('DEEPSEEK_HARNESS_OFFICIAL_AUTHORITY_INVALID');
  }

  if (!contract.requireFrozenLockfile
    || !contract.resolvedClosureMustMatchLockfile
    || contract.autoInstallPeers) {
    throw new Error('DEEPSEEK_HARNESS_OFFICIAL_RESOLUTION_POLICY_INVALID');
  }

  if (contract.officialPackages.length !== EXACT_OFFICIAL_PACKAGES.length
    || contract.officialPackages.some((value, index) => value !== EXACT_OFFICIAL_PACKAGES[index])) {
    throw new Error('DEEPSEEK_HARNESS_OFFICIAL_PACKAGE_SURFACE_INVALID');
  }

  return contract;
}
