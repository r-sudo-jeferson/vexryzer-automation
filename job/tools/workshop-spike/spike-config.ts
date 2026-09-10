export const HARNESS_CANDIDATE_VERSION = '0.1.2-rc.1' as const;
export const DEFAULT_MISTRAL_PROVIDER_ROUTE = 'mistral' as const;
export const DEFAULT_MISTRAL_MODEL_ID = 'mistral-medium-latest' as const;
export const DEFAULT_MISTRAL_BASE_URL = 'https://api.mistral.ai/v1' as const;

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

export function renderMistralSettingsYaml(input: Omit<SpikeInputs, 'mistralApiKey'>): string {
  validateSpikeInputs({ ...input, mistralApiKey: 'redacted-validation-key' });
  return [
    'llm-pi-ai:',
    '  providers:',
    `    ${input.providerRoute}:`,
    '      displayName: Mistral',
    '      apiKeyEnv: MISTRAL_API_KEY',
    '      api: openai-completions',
    `      baseURL: ${input.baseUrl}`,
    '      compat:',
    '        supportsDeveloperRole: false',
    '        maxTokensField: max_tokens',
    '      models:',
    `        - id: ${input.modelId}`,
    '',
  ].join('\n');
}
