import type { ProviderId } from './provider-candidates.ts';

export type ProviderErrorClass = 'NONE' | 'AUTH' | 'RATE_LIMIT' | 'CAPACITY' | 'TIMEOUT' | 'PROTOCOL' | 'UNKNOWN';

export interface ProviderScreenResult {
  provider: ProviderId;
  modelId: string;
  authenticated: boolean;
  streaming: boolean;
  toolCall: boolean;
  toolReplay: boolean;
  errorClass: ProviderErrorClass;
}

export function classifyProviderFailure(status: number | undefined): ProviderErrorClass {
  if (status === undefined) return 'UNKNOWN';
  if (status >= 200 && status < 300) return 'NONE';
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 429) return 'RATE_LIMIT';
  if (status === 408 || status === 504) return 'TIMEOUT';
  if (status >= 500 && status <= 599) return 'CAPACITY';
  if (status >= 400 && status <= 499) return 'PROTOCOL';
  return 'UNKNOWN';
}

export function sanitizeProviderDiagnostic(message: string, secrets: readonly (string | undefined)[]): string {
  let sanitized = message.replace(/[\r\n\t]+/g, ' ').trim();
  for (const secret of secrets) {
    const value = secret?.trim();
    if (value) sanitized = sanitized.split(value).join('[REDACTED]');
  }
  sanitized = sanitized
    .replace(/(Authorization\s*:\s*(?:Bearer\s+)?)[^\s;,]+/gi, '$1[REDACTED]')
    .replace(/((?:API_KEY|API_TOKEN)\s*[=:]\s*)[^\s;,]+/gi, '$1[REDACTED]');
  return sanitized.slice(-600);
}

export function summarizeProviderScreen(input: {
  provider: ProviderId;
  modelId: string;
  authenticated: boolean;
  streaming: boolean;
  toolCall: boolean;
  toolReplay: boolean;
  status?: number;
}): ProviderScreenResult {
  return {
    provider: input.provider,
    modelId: input.modelId,
    authenticated: input.authenticated,
    streaming: input.streaming,
    toolCall: input.toolCall,
    toolReplay: input.toolReplay,
    errorClass: input.status === undefined && input.authenticated && input.streaming && input.toolCall && input.toolReplay
      ? 'NONE'
      : classifyProviderFailure(input.status),
  };
}
