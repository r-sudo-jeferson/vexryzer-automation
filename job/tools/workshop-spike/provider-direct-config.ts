import type { ProviderCandidate, ProviderId } from './provider-candidates.ts';

export interface DirectProviderConfig {
  provider: Extract<ProviderId, 'cloudflare-workers-ai' | 'groq'>;
  modelId: string;
  endpoint: string;
  apiKey: string;
  secretsToRedact: readonly string[];
}

function required(name: string, value: string | undefined): string {
  const normalized = value?.trim() ?? '';
  if (!normalized || /[\r\n\0]/.test(normalized)) throw new TypeError(`${name} is required`);
  return normalized;
}

export function resolveDirectProviderConfig(candidate: ProviderCandidate, env: NodeJS.ProcessEnv): DirectProviderConfig {
  if (candidate.provider === 'cloudflare-workers-ai') {
    const accountId = required('CLOUDFLARE_ACCOUNT_ID', env.CLOUDFLARE_ACCOUNT_ID);
    const apiKey = required('CLOUDFLARE_API_TOKEN', env.CLOUDFLARE_API_TOKEN);
    if (!/^[A-Za-z0-9_-]+$/.test(accountId)) throw new TypeError('CLOUDFLARE_ACCOUNT_ID contains unsupported characters');
    return {
      provider: 'cloudflare-workers-ai',
      modelId: candidate.modelId,
      endpoint: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`,
      apiKey,
      secretsToRedact: [accountId, apiKey],
    };
  }
  if (candidate.provider === 'groq') {
    const apiKey = required('GROQ_API_KEY', env.GROQ_API_KEY);
    return {
      provider: 'groq',
      modelId: candidate.modelId,
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey,
      secretsToRedact: [apiKey],
    };
  }
  throw new TypeError(`provider is not enabled for direct screening: ${candidate.provider}`);
}
