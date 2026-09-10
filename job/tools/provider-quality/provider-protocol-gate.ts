export interface ProviderProtocolScreenRecord {
  provider: string;
  modelId: string;
  authenticated: boolean;
  streaming: boolean;
  toolCall: boolean;
  toolReplay: boolean;
  errorClass: string;
}

export interface RequiredProviderProtocol {
  provider: 'cloudflare-workers-ai' | 'groq';
  modelId: string;
  role: 'seller' | 'critic' | 'fallback';
}

export const REQUIRED_S002_PROVIDER_PROTOCOLS: readonly Readonly<RequiredProviderProtocol>[] = Object.freeze([
  Object.freeze({ provider: 'cloudflare-workers-ai', modelId: '@cf/zai-org/glm-4.7-flash', role: 'seller' }),
  Object.freeze({ provider: 'cloudflare-workers-ai', modelId: '@cf/google/gemma-4-26b-a4b-it', role: 'critic' }),
  Object.freeze({ provider: 'groq', modelId: 'openai/gpt-oss-120b', role: 'fallback' }),
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validScreenRecord(value: unknown): value is ProviderProtocolScreenRecord {
  if (!isRecord(value)) return false;
  return typeof value['provider'] === 'string'
    && typeof value['modelId'] === 'string'
    && typeof value['authenticated'] === 'boolean'
    && typeof value['streaming'] === 'boolean'
    && typeof value['toolCall'] === 'boolean'
    && typeof value['toolReplay'] === 'boolean'
    && typeof value['errorClass'] === 'string';
}

export function evaluateRequiredProviderProtocols(value: unknown) {
  if (!isRecord(value) || value['schemaVersion'] !== 1 || value['status'] !== 'complete' || !Array.isArray(value['results'])) {
    return Object.freeze({ pass: false, code: 'INVALID_SCREEN_EVIDENCE' as const, routes: Object.freeze([]) });
  }
  const records = value['results'].filter(validScreenRecord);
  const routes = REQUIRED_S002_PROVIDER_PROTOCOLS.map((required) => {
    const matches = records.filter((record) => record.provider === required.provider && record.modelId === required.modelId);
    const record = matches.length === 1 ? matches[0] : undefined;
    const pass = record !== undefined
      && record.authenticated
      && record.streaming
      && record.toolCall
      && record.toolReplay
      && record.errorClass === 'NONE';
    return Object.freeze({
      provider: required.provider,
      modelId: required.modelId,
      role: required.role,
      pass,
      ...(record === undefined ? { code: matches.length === 0 ? 'MISSING' : 'DUPLICATE' } : {
        code: pass ? 'PASS' : 'PROTOCOL_FAILED',
        errorClass: record.errorClass,
      }),
    });
  });
  return Object.freeze({
    pass: routes.every((route) => route.pass),
    code: routes.every((route) => route.pass) ? 'PASS' as const : 'REQUIRED_ROUTE_FAILED' as const,
    routes: Object.freeze(routes),
  });
}
