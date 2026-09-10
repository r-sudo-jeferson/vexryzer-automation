export type ProviderId = 'cloudflare-workers-ai' | 'groq' | 'openrouter' | 'mistral';
export type ProviderRole = 'seller' | 'critic' | 'composer' | 'workshop_code';

export interface ProviderCandidate {
  provider: ProviderId;
  modelId: string;
  roles: readonly ProviderRole[];
  credentialRefs: readonly string[];
  noPaymentRequired: true;
  optional: boolean;
}

export const providerCandidates = [
  {
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/zai-org/glm-4.7-flash',
    roles: ['seller', 'composer'],
    credentialRefs: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
    noPaymentRequired: true,
    optional: false,
  },
  {
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/google/gemma-4-26b-a4b-it',
    roles: ['critic'],
    credentialRefs: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
    noPaymentRequired: true,
    optional: false,
  },
  {
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/openai/gpt-oss-120b',
    roles: ['workshop_code'],
    credentialRefs: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
    noPaymentRequired: true,
    optional: false,
  },
  {
    provider: 'cloudflare-workers-ai',
    modelId: '@cf/nvidia/nemotron-3-120b-a12b',
    roles: ['seller', 'critic'],
    credentialRefs: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'],
    noPaymentRequired: true,
    optional: false,
  },
  {
    provider: 'groq',
    modelId: 'openai/gpt-oss-120b',
    roles: ['seller', 'critic', 'workshop_code'],
    credentialRefs: ['GROQ_API_KEY'],
    noPaymentRequired: true,
    optional: false,
  },
] as const satisfies readonly ProviderCandidate[];

export const standbyProviders = ['mistral'] as const satisfies readonly ProviderId[];
export const optionalEmergencyProviders = ['openrouter'] as const satisfies readonly ProviderId[];

const SAFE_MODEL_ID = /^[A-Za-z0-9@][A-Za-z0-9@._:/-]*$/;
const SAFE_CREDENTIAL_REF = /^[A-Z][A-Z0-9_]*$/;

export function assertProviderCandidateRegistry(
  candidates: readonly ProviderCandidate[] = providerCandidates,
): void {
  const identities = new Set<string>();
  for (const candidate of candidates) {
    if (!SAFE_MODEL_ID.test(candidate.modelId) || candidate.modelId.includes('..')) {
      throw new TypeError(`unsafe model id: ${candidate.modelId}`);
    }
    if (/-latest(?:$|[/:])/i.test(candidate.modelId)) {
      throw new TypeError(`moving model aliases are forbidden: ${candidate.modelId}`);
    }
    if (candidate.noPaymentRequired !== true) {
      throw new TypeError(`payment-required route is forbidden: ${candidate.provider}/${candidate.modelId}`);
    }
    if (candidate.roles.length === 0) {
      throw new TypeError(`candidate has no authorized role: ${candidate.provider}/${candidate.modelId}`);
    }
    if (candidate.credentialRefs.length === 0 || candidate.credentialRefs.some((ref) => !SAFE_CREDENTIAL_REF.test(ref))) {
      throw new TypeError(`invalid credential reference for ${candidate.provider}/${candidate.modelId}`);
    }
    if (candidate.provider === 'mistral' || candidate.provider === 'openrouter') {
      throw new TypeError(`standby/optional provider cannot be active candidate: ${candidate.provider}`);
    }
    const identity = `${candidate.provider}\u0000${candidate.modelId}`;
    if (identities.has(identity)) throw new TypeError(`duplicate provider candidate: ${candidate.provider}/${candidate.modelId}`);
    identities.add(identity);
  }
}

export function candidatesForRole(role: ProviderRole): readonly ProviderCandidate[] {
  return providerCandidates.filter((candidate) => candidate.roles.includes(role as never));
}
