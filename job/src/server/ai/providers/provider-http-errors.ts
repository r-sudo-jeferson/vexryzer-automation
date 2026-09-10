export type ProviderHttpFailureClass = 'access' | 'rate_limit' | 'capacity' | 'client' | 'unknown';
export type ProviderTransportFailureClass = 'timeout' | 'cancelled' | 'network';

export interface ProviderHttpFailure {
  class: ProviderHttpFailureClass;
  retryAfterMs: number | null;
}

const MAX_RETRY_AFTER_MS = 5 * 60_000;

function parseRetryAfter(value: string | null, nowMs: number): number | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) {
    const milliseconds = Number(trimmed) * 1_000;
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return null;
    return Math.min(Math.ceil(milliseconds), MAX_RETRY_AFTER_MS);
  }
  const date = Date.parse(trimmed);
  if (!Number.isFinite(date)) return null;
  return Math.min(Math.max(0, date - nowMs), MAX_RETRY_AFTER_MS);
}

export function classifyHttpFailure(status: number, headers: Headers, nowMs = Date.now()): ProviderHttpFailure {
  const retryAfterMs = status === 429 || status >= 500 ? parseRetryAfter(headers.get('retry-after'), nowMs) : null;
  if (status === 401 || status === 403) return { class: 'access', retryAfterMs: null };
  if (status === 429) return { class: 'rate_limit', retryAfterMs };
  if (status >= 500 && status <= 599) return { class: 'capacity', retryAfterMs };
  if (status >= 400 && status <= 499) return { class: 'client', retryAfterMs: null };
  return { class: 'unknown', retryAfterMs: null };
}

export function classifyTransportFailure(input: {
  aborted: boolean;
  timeoutTriggered: boolean;
}): { class: ProviderTransportFailureClass } {
  if (input.aborted) return { class: input.timeoutTriggered ? 'timeout' : 'cancelled' };
  return { class: 'network' };
}
