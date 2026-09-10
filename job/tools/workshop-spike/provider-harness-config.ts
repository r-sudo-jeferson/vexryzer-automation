import { buildPackageInstallEnv, HARNESS_SPIKE_PROFILE } from './spike-config.ts';

export const PROVIDER_SPIKE_MAX_RETRIES = 1 as const;
export const PROVIDER_RETRY_INITIAL_DELAY_MS = 2_500 as const;
export const PROVIDER_RETRY_MAX_DELAY_MS = 5_000 as const;
export const PROVIDER_RETRY_JITTER_RATIO = 0.1 as const;

const PROVIDER_TRANSIENT_FAILURE_CODES = ['RATE_LIMIT', 'SERVER', 'TIMEOUT', 'TRANSPORT'] as const;
const SAFE_PROVIDER_ROUTE = /^[a-z0-9][a-z0-9._-]*$/;
const SAFE_MODEL_ID = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]*$/;
const SAFE_CREDENTIAL_REF = /^[A-Z][A-Z0-9_]*$/;
const SAFE_ENV_REF = SAFE_CREDENTIAL_REF;

export interface ProviderHarnessInput {
  providerRoute: string;
  modelId: string;
  credentialRef: string;
  credentialValue: string;
  displayName: string;
  baseURL: string;
  providerEnv: Readonly<Record<string, string>>;
}

export interface ProviderPatchInput extends Omit<ProviderHarnessInput, 'credentialValue' | 'providerEnv'> {
  timeoutMs?: number;
  streamIdleTimeoutMs?: number;
}

export interface ProviderHarnessSdkOptionsInput {
  workspace: string;
  dshHome: string;
  patchPath: string;
  maxTokens: number;
  input: ProviderHarnessInput;
}

export interface ProviderHarnessSdkOptions {
  profile: typeof HARNESS_SPIKE_PROFILE;
  patches: string[];
  dshHome: string;
  processCwd: string;
  env: NodeJS.ProcessEnv;
  initializeTimeoutMs: number;
  shutdownTimeoutMs: number;
  disposeEofGraceMs: number;
  disposeGraceMs: number;
  cwd: string;
  provider: string;
  model: string;
  maxTokens: number;
}

function quoteYaml(value: string): string {
  return JSON.stringify(value);
}

function validateOptionalTimeout(name: string, value: number | undefined): void {
  if (value === undefined) return;
  if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) {
    throw new TypeError(`${name} must be a positive safe integer no greater than 2147483647`);
  }
}

function requireAbsoluteLikePath(name: string, value: string): void {
  if (!value.trim()) throw new TypeError(`${name} must not be empty`);
  if (value.includes('\0')) throw new TypeError(`${name} must not contain NUL`);
}

function validateProviderPatchInput(input: ProviderPatchInput): void {
  if (!SAFE_PROVIDER_ROUTE.test(input.providerRoute)) throw new TypeError('providerRoute must be a lowercase safe route id');
  if (!SAFE_MODEL_ID.test(input.modelId) || input.modelId.includes('..')) throw new TypeError('modelId contains unsupported characters');
  if (/-latest(?:$|[/:])/i.test(input.modelId)) throw new TypeError('modelId must not use a moving latest alias');
  if (!SAFE_CREDENTIAL_REF.test(input.credentialRef)) throw new TypeError('credentialRef must be an uppercase environment reference');
  if (!input.displayName.trim() || /[\r\n]/.test(input.displayName)) throw new TypeError('displayName must be a single non-empty line');
  if (!/^https:\/\//.test(input.baseURL) || /[\r\n]/.test(input.baseURL)) throw new TypeError('baseURL must be an https URL');
  validateOptionalTimeout('timeoutMs', input.timeoutMs);
  validateOptionalTimeout('streamIdleTimeoutMs', input.streamIdleTimeoutMs);
}

export function validateProviderHarnessInput(input: ProviderHarnessInput): void {
  validateProviderPatchInput(input);
  if (!input.credentialValue.trim() || /\s/.test(input.credentialValue)) throw new TypeError(`${input.credentialRef} credential is required and must not contain whitespace`);
  for (const [name, value] of Object.entries(input.providerEnv)) {
    if (!SAFE_ENV_REF.test(name)) throw new TypeError(`providerEnv key is unsafe: ${name}`);
    if (!value.trim() || /[\r\n\0]/.test(value)) throw new TypeError(`providerEnv value is invalid for ${name}`);
    if (name === input.credentialRef) throw new TypeError(`providerEnv must not duplicate credentialRef ${name}`);
  }
}

export function buildProviderHarnessEnv(
  parentEnv: NodeJS.ProcessEnv,
  options: { dshHome: string; credentialRef: string; credentialValue: string; providerEnv: Readonly<Record<string, string>> },
): NodeJS.ProcessEnv {
  requireAbsoluteLikePath('dshHome', options.dshHome);
  if (!SAFE_CREDENTIAL_REF.test(options.credentialRef)) throw new TypeError('credentialRef must be an uppercase environment reference');
  if (!options.credentialValue.trim() || /\s/.test(options.credentialValue)) throw new TypeError(`${options.credentialRef} credential is required and must not contain whitespace`);
  const env = buildPackageInstallEnv(parentEnv);
  env.DSH_HOME = options.dshHome;
  env[options.credentialRef] = options.credentialValue;
  for (const [name, value] of Object.entries(options.providerEnv)) {
    if (!SAFE_ENV_REF.test(name)) throw new TypeError(`providerEnv key is unsafe: ${name}`);
    if (!value.trim() || /[\r\n\0]/.test(value)) throw new TypeError(`providerEnv value is invalid for ${name}`);
    if (name === options.credentialRef) throw new TypeError(`providerEnv must not duplicate credentialRef ${name}`);
    env[name] = value;
  }
  return env;
}

function renderRetryPolicyLines(disableRetries: boolean, indent: string): string[] {
  const child = `${indent}  `;
  const grandchild = `${child}  `;
  return [
    `${indent}retryPolicy:`,
    `${child}mode: normal`,
    `${child}maxRetries: ${disableRetries ? 0 : PROVIDER_SPIKE_MAX_RETRIES}`,
    `${child}retryableCodes:`,
    ...PROVIDER_TRANSIENT_FAILURE_CODES.map((code) => `${grandchild}- ${code}`),
    `${child}backoff:`,
    `${grandchild}initialDelayMs: ${PROVIDER_RETRY_INITIAL_DELAY_MS}`,
    `${grandchild}maxDelayMs: ${PROVIDER_RETRY_MAX_DELAY_MS}`,
    `${grandchild}jitterRatio: ${PROVIDER_RETRY_JITTER_RATIO}`,
  ];
}

export function renderProviderMinimalProfilePatchYaml(input: ProviderPatchInput): string {
  validateProviderPatchInput(input);
  const timeoutProbe = input.timeoutMs !== undefined || input.streamIdleTimeoutMs !== undefined;
  return [
    '- id: llm-deepseek',
    '  disabled: true',
    '- insert:',
    '    - id: llm-pi-ai',
    "      name: '@deepseek-ai/dsh-llm-pi-ai'",
    '      config:',
    '        providers:',
    `          ${input.providerRoute}:`,
    `            displayName: ${quoteYaml(input.displayName)}`,
    `            apiKeyEnv: ${quoteYaml(input.credentialRef)}`,
    `            baseURL: ${quoteYaml(input.baseURL)}`,
    ...(input.timeoutMs === undefined ? [] : [`            timeoutMs: ${input.timeoutMs}`]),
    ...(input.streamIdleTimeoutMs === undefined ? [] : [`            streamIdleTimeoutMs: ${input.streamIdleTimeoutMs}`]),
    ...renderRetryPolicyLines(timeoutProbe, '            '),
    '            models:',
    `              - id: ${quoteYaml(input.modelId)}`,
    '',
  ].join('\n');
}

export function buildProviderHarnessSdkOptions(
  parentEnv: NodeJS.ProcessEnv,
  options: ProviderHarnessSdkOptionsInput,
): ProviderHarnessSdkOptions {
  validateProviderHarnessInput(options.input);
  requireAbsoluteLikePath('workspace', options.workspace);
  requireAbsoluteLikePath('dshHome', options.dshHome);
  requireAbsoluteLikePath('patchPath', options.patchPath);
  if (!Number.isSafeInteger(options.maxTokens) || options.maxTokens <= 0) throw new TypeError('maxTokens must be a positive safe integer');
  return {
    profile: HARNESS_SPIKE_PROFILE,
    patches: [options.patchPath],
    dshHome: options.dshHome,
    processCwd: options.workspace,
    env: buildProviderHarnessEnv(parentEnv, {
      dshHome: options.dshHome,
      credentialRef: options.input.credentialRef,
      credentialValue: options.input.credentialValue,
      providerEnv: options.input.providerEnv,
    }),
    initializeTimeoutMs: 10_000,
    shutdownTimeoutMs: 1_000,
    disposeEofGraceMs: 6_000,
    disposeGraceMs: 3_000,
    cwd: options.workspace,
    provider: options.input.providerRoute,
    model: options.input.modelId,
    maxTokens: options.maxTokens,
  };
}

export function sanitizeHarnessProviderDiagnostic(message: string, values: readonly (string | undefined)[]): string {
  let sanitized = message.replace(/[\r\n\t]+/g, ' ').trim();
  for (const raw of values) {
    const value = raw?.trim();
    if (value) sanitized = sanitized.split(value).join('[REDACTED]');
  }
  sanitized = sanitized.replace(/((?:API_KEY|API_TOKEN)\s*[=:]\s*)\S+/gi, '$1[REDACTED]');
  return sanitized.slice(-800);
}
