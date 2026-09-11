export const DEEPSEEK_HARNESS_RUNTIME_CONFIG = Object.freeze({
  harnessVersion: '0.1.5-rc.1',
  profile: 'sdk-minimal',
  provider: 'deepseek-official',
  model: 'deepseek-v4-pro',
  reasoningEffort: 'high',
  patchRelativePath: 'config/deepseek-harness/vexryzer-visitor.cordis.patch.yml',
  initializeTimeoutMs: 5_000,
  requestTimeoutMs: 34_000,
  shutdownTimeoutMs: 500,
  disposeEofGraceMs: 1_500,
  disposeGraceMs: 1_000,
  outerExecutionTimeoutMs: 45_000,
} as const);

export type DeepSeekHarnessRuntimeConfig = typeof DEEPSEEK_HARNESS_RUNTIME_CONFIG;

export const DEEPSEEK_HARNESS_CHILD_ENV_KEYS = Object.freeze([
  'DEEPSEEK_API_KEY',
] as const);

export type DeepSeekHarnessChildEnv = Readonly<Record<
  (typeof DEEPSEEK_HARNESS_CHILD_ENV_KEYS)[number],
  string
>>;

const CONTROL = /[\u0000-\u001F\u007F]/;

export function assertDeepSeekHarnessRuntimeConfig(
  config: Readonly<DeepSeekHarnessRuntimeConfig> = DEEPSEEK_HARNESS_RUNTIME_CONFIG,
): Readonly<DeepSeekHarnessRuntimeConfig> {
  if (config.harnessVersion !== '0.1.5-rc.1'
    || config.profile !== 'sdk-minimal'
    || config.provider !== 'deepseek-official'
    || config.model !== 'deepseek-v4-pro'
    || config.reasoningEffort !== 'high'
    || config.patchRelativePath !== 'config/deepseek-harness/vexryzer-visitor.cordis.patch.yml') {
    throw new Error('DEEPSEEK_HARNESS_RUNTIME_IDENTITY_INVALID');
  }

  const bounded = [
    config.initializeTimeoutMs,
    config.requestTimeoutMs,
    config.shutdownTimeoutMs,
    config.disposeEofGraceMs,
    config.disposeGraceMs,
    config.outerExecutionTimeoutMs,
  ];
  if (bounded.some((value) => !Number.isSafeInteger(value) || value <= 0)) {
    throw new Error('DEEPSEEK_HARNESS_RUNTIME_TIMEOUT_INVALID');
  }

  // close() may consume shutdown + EOF grace + two termination confirmation
  // windows (SIGTERM then SIGKILL). Keep one request lifecycle below the
  // application-owned outer execution deadline.
  const worstCaseLifecycleMs = config.initializeTimeoutMs
    + config.requestTimeoutMs
    + config.shutdownTimeoutMs
    + config.disposeEofGraceMs
    + (2 * config.disposeGraceMs);
  if (worstCaseLifecycleMs >= config.outerExecutionTimeoutMs) {
    throw new Error('DEEPSEEK_HARNESS_RUNTIME_DEADLINE_OVERCOMMITTED');
  }

  return config;
}

export function createDeepSeekHarnessChildEnv(apiKey: string): DeepSeekHarnessChildEnv {
  if (
    typeof apiKey !== 'string'
    || apiKey.length < 1
    || apiKey.length > 512
    || apiKey.trim() !== apiKey
    || CONTROL.test(apiKey)
  ) {
    throw new TypeError('invalid DeepSeek credential material');
  }

  return Object.freeze({
    DEEPSEEK_API_KEY: apiKey,
  });
}
