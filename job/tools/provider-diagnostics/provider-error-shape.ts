export interface SafeProviderErrorShape {
  topLevelKeys: readonly string[];
  errorKeys: readonly string[];
  errorType: string | null;
  errorCode: string | null;
  errorStatus: number | null;
  hasMessage: boolean;
  hasFailedGeneration: boolean;
  failedGenerationKeys: readonly string[];
}

const SAFE_KEY = /^[A-Za-z0-9_.:-]{1,64}$/;
const SAFE_TOKEN = /^[A-Za-z0-9_.:-]{1,64}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeKeys(value: Record<string, unknown>): readonly string[] {
  return Object.freeze(Object.keys(value).filter((key) => SAFE_KEY.test(key)).sort());
}

function safeToken(value: unknown): string | null {
  if (typeof value === 'string' && SAFE_TOKEN.test(value)) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

export function extractSafeProviderErrorShape(value: unknown): Readonly<SafeProviderErrorShape> | null {
  if (!isRecord(value) || !Object.hasOwn(value, 'error')) return null;
  const error = value['error'];
  if (!isRecord(error)) {
    return Object.freeze({
      topLevelKeys: safeKeys(value),
      errorKeys: Object.freeze([]),
      errorType: null,
      errorCode: null,
      errorStatus: null,
      hasMessage: false,
      hasFailedGeneration: false,
      failedGenerationKeys: Object.freeze([]),
    });
  }
  const failedGeneration = error['failed_generation'];
  return Object.freeze({
    topLevelKeys: safeKeys(value),
    errorKeys: safeKeys(error),
    errorType: safeToken(error['type']),
    errorCode: safeToken(error['code']),
    errorStatus: typeof error['status'] === 'number' && Number.isInteger(error['status']) ? error['status'] : null,
    hasMessage: Object.hasOwn(error, 'message'),
    hasFailedGeneration: Object.hasOwn(error, 'failed_generation'),
    failedGenerationKeys: isRecord(failedGeneration) ? safeKeys(failedGeneration) : Object.freeze([]),
  });
}
