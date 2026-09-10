import { resolve, sep } from 'node:path';

export const HARNESS_CANDIDATE_VERSION = '0.1.2-rc.1' as const;
export const DEFAULT_MISTRAL_PROVIDER_ROUTE = 'mistral' as const;
export const DEFAULT_MISTRAL_MODEL_ID = 'mistral-medium-latest' as const;
export const DEFAULT_MISTRAL_BASE_URL = 'https://api.mistral.ai/v1' as const;

export function resolveHarnessCandidateVersion(value: string | undefined): string {
  const version = value?.trim() || HARNESS_CANDIDATE_VERSION;
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z][0-9A-Za-z.-]*)?$/.test(version)) {
    throw new TypeError(`Harness version must be an exact semver; got ${version}`);
  }
  return version;
}

export interface SpikeRuntimeVersions {
  nodeVersion: string;
  pnpmVersion: string;
}

export function assertSpikeNodeVersion(nodeVersion: string): void {
  const nodeMajor = Number.parseInt(nodeVersion.replace(/^v/, '').split('.')[0] ?? '', 10);
  if (nodeMajor !== 24) throw new Error(`Workshop compatibility spike requires Node 24; got ${nodeVersion}`);
}

export function assertSpikePnpmVersion(pnpmVersion: string): void {
  if (pnpmVersion.trim() !== '11.25.0') {
    throw new Error(`Workshop compatibility spike requires pnpm 11.25.0; got ${pnpmVersion}`);
  }
}

export function assertSpikeRuntimeVersions(versions: SpikeRuntimeVersions): void {
  assertSpikeNodeVersion(versions.nodeVersion);
  assertSpikePnpmVersion(versions.pnpmVersion);
}

export interface SpikeInputs {
  providerRoute: string;
  modelId: string;
  baseUrl: string;
  mistralApiKey: string;
}

export interface HarnessEnvironmentOptions {
  dshHome: string;
  mistralApiKey: string;
}

export interface MistralRouteConfig extends Omit<SpikeInputs, 'mistralApiKey'> {
  timeoutMs?: number;
  streamIdleTimeoutMs?: number;
}

const SAFE_PARENT_ENV_KEYS = [
  'PATH',
  'HOME',
  'USERPROFILE',
  'TMPDIR',
  'TMP',
  'TEMP',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'SystemRoot',
  'ComSpec',
  'PATHEXT',
] as const;

export function validateSpikeInputs(inputs: SpikeInputs): void {
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(inputs.providerRoute)) {
    throw new TypeError('providerRoute must be a lowercase safe route id');
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(inputs.modelId)) {
    throw new TypeError('modelId contains unsupported characters');
  }
  let url: URL;
  try {
    url = new URL(inputs.baseUrl);
  } catch {
    throw new TypeError('baseUrl must be a valid HTTPS URL');
  }
  if (url.protocol !== 'https:') throw new TypeError('baseUrl must use HTTPS');
  if (url.username || url.password) throw new TypeError('baseUrl must not contain credentials');
  if (!inputs.mistralApiKey.trim()) throw new TypeError('MISTRAL_API_KEY is required');
  if (/\s/.test(inputs.mistralApiKey)) throw new TypeError('MISTRAL_API_KEY must not contain whitespace');
}

export function buildPackageInstallEnv(parentEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of SAFE_PARENT_ENV_KEYS) {
    const value = parentEnv[key];
    if (value) env[key] = value;
  }
  env.CI = 'true';
  env.PNPM_CONFIG_AUTO_INSTALL_PEERS = 'true';
  return env;
}

export function buildScrubbedHarnessEnv(
  parentEnv: NodeJS.ProcessEnv,
  options: HarnessEnvironmentOptions,
): NodeJS.ProcessEnv {
  const env = buildPackageInstallEnv(parentEnv);
  env.DSH_HOME = options.dshHome;
  env.MISTRAL_API_KEY = options.mistralApiKey;
  return env;
}

function validateOptionalTimeout(name: string, value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) {
    throw new TypeError(`${name} must be a positive safe integer no greater than 2147483647`);
  }
}

export function renderMistralSettingsYaml(input: MistralRouteConfig): string {
  validateSpikeInputs({ ...input, mistralApiKey: 'redacted-validation-key' });
  validateOptionalTimeout('timeoutMs', input.timeoutMs);
  validateOptionalTimeout('streamIdleTimeoutMs', input.streamIdleTimeoutMs);
  return [
    'llm-pi-ai:',
    '  providers:',
    `    ${input.providerRoute}:`,
    '      displayName: Mistral',
    '      apiKeyEnv: MISTRAL_API_KEY',
    '      api: openai-completions',
    `      baseURL: ${input.baseUrl}`,
    ...(input.timeoutMs === undefined ? [] : [`      timeoutMs: ${input.timeoutMs}`]),
    ...(input.streamIdleTimeoutMs === undefined ? [] : [`      streamIdleTimeoutMs: ${input.streamIdleTimeoutMs}`]),
    '      compat:',
    '        supportsDeveloperRole: false',
    '        maxTokensField: max_tokens',
    '      models:',
    `        - id: ${input.modelId}`,
    '',
  ].join('\n');
}

export function resolveDshBinFromPackageManifest(manifest: unknown, packageDir: string): string {
  if (typeof manifest !== 'object' || manifest === null || Array.isArray(manifest)) {
    throw new TypeError('dsh package manifest must be an object');
  }
  const bin = (manifest as { bin?: unknown }).bin;
  const relativeBin = typeof bin === 'string'
    ? bin
    : typeof bin === 'object' && bin !== null && !Array.isArray(bin)
      ? (bin as Record<string, unknown>).dsh
      : undefined;
  if (typeof relativeBin !== 'string' || !relativeBin.trim()) {
    throw new TypeError('dsh package manifest must declare bin.dsh');
  }
  const root = resolve(packageDir);
  const target = resolve(root, relativeBin);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new TypeError('dsh package bin must resolve inside the package directory');
  }
  return target;
}
