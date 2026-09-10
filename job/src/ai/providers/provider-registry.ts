export const PROVIDER_FAMILIES = ['cloudflare_workers_ai', 'groq', 'openrouter', 'mistral'] as const;
export type ProviderFamily = (typeof PROVIDER_FAMILIES)[number];

export const PROVIDER_ROLES = ['seller', 'critic', 'composer', 'workshop'] as const;
export type ProviderRole = (typeof PROVIDER_ROLES)[number];

export const PROVIDER_ROUTE_TIERS = ['primary', 'independent_fallback', 'emergency', 'standby'] as const;
export type ProviderRouteTier = (typeof PROVIDER_ROUTE_TIERS)[number];

export type VerificationVerdict = 'PASS' | 'FAIL' | 'NOT_VERIFIED' | 'NOT_APPLICABLE';
export type CredentialScope = 'server' | 'client';

export type CapabilityVerdict = 'PASS' | 'FAIL' | 'NOT_VERIFIED';

export interface ProviderRouteCapabilities {
  streaming: CapabilityVerdict;
  tools: CapabilityVerdict;
  structuredArguments: CapabilityVerdict;
}

export interface ProviderEvidenceReference {
  verifiedSha: string;
  runId: string;
}

export interface ProviderRouteDefinition {
  routeId: string;
  family: ProviderFamily;
  modelId: string;
  roles: readonly ProviderRole[];
  tier: ProviderRouteTier;
  priority?: number;
  enabledByDefault: boolean;
  credentialEnvName: string;
  credentialScope: CredentialScope;
  noPaymentEligibility: Exclude<VerificationVerdict, 'NOT_APPLICABLE'>;
  protocolCompatibility: Exclude<VerificationVerdict, 'NOT_APPLICABLE'>;
  sellerQuality: VerificationVerdict;
  criticQuality: VerificationVerdict;
  composerQuality: VerificationVerdict;
  harnessCompatibility: VerificationVerdict;
  workshopSafety: VerificationVerdict;
  workshopHarness: string | null;
  runtimeActivation: Exclude<VerificationVerdict, 'NOT_APPLICABLE'>;
  capabilities: Readonly<ProviderRouteCapabilities>;
  maxInputTokens: number | null;
  emergencyInputTokens: number | null;
  evidence: Readonly<ProviderEvidenceReference> | null;
}

function freezeRoute(route: ProviderRouteDefinition): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    ...route,
    roles: Object.freeze([...route.roles]),
    capabilities: Object.freeze({ ...route.capabilities }),
    evidence: route.evidence === null ? null : Object.freeze({ ...route.evidence }),
  });
}

const UNKNOWN_CAPABILITIES = Object.freeze({
  streaming: 'NOT_VERIFIED',
  tools: 'NOT_VERIFIED',
  structuredArguments: 'NOT_VERIFIED',
} as const);

/**
 * Authorized candidates are deliberately fail-closed. Candidate authorization is not live compatibility evidence.
 * OpenRouter is omitted until an exact pinned :free model is separately configured and verified.
 */
export const AUTHORIZED_PROVIDER_CANDIDATES: readonly Readonly<ProviderRouteDefinition>[] = Object.freeze([
  freezeRoute({
    routeId: 'cloudflare-glm-4-7-flash-seller',
    family: 'cloudflare_workers_ai',
    modelId: '@cf/zai-org/glm-4.7-flash',
    roles: ['seller', 'composer'],
    tier: 'primary',
    priority: 10,
    enabledByDefault: true,
    credentialEnvName: 'CLOUDFLARE_API_TOKEN',
    credentialScope: 'server',
    noPaymentEligibility: 'NOT_VERIFIED',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_VERIFIED',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_VERIFIED',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'NOT_VERIFIED',
    capabilities: UNKNOWN_CAPABILITIES,
    maxInputTokens: null,
    emergencyInputTokens: null,
    evidence: null,
  }),
  freezeRoute({
    routeId: 'cloudflare-gemma-4-26b-critic',
    family: 'cloudflare_workers_ai',
    modelId: '@cf/google/gemma-4-26b-a4b-it',
    roles: ['critic'],
    tier: 'primary',
    priority: 20,
    enabledByDefault: true,
    credentialEnvName: 'CLOUDFLARE_API_TOKEN',
    credentialScope: 'server',
    noPaymentEligibility: 'NOT_VERIFIED',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_APPLICABLE',
    criticQuality: 'NOT_VERIFIED',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'NOT_VERIFIED',
    capabilities: UNKNOWN_CAPABILITIES,
    maxInputTokens: null,
    emergencyInputTokens: null,
    evidence: null,
  }),
  freezeRoute({
    routeId: 'cloudflare-gpt-oss-120b-workshop',
    family: 'cloudflare_workers_ai',
    modelId: '@cf/openai/gpt-oss-120b',
    roles: ['workshop'],
    tier: 'primary',
    priority: 30,
    enabledByDefault: false,
    credentialEnvName: 'CLOUDFLARE_API_TOKEN',
    credentialScope: 'server',
    noPaymentEligibility: 'NOT_VERIFIED',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_APPLICABLE',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'FAIL',
    workshopSafety: 'NOT_VERIFIED',
    workshopHarness: null,
    runtimeActivation: 'NOT_VERIFIED',
    capabilities: UNKNOWN_CAPABILITIES,
    maxInputTokens: null,
    emergencyInputTokens: null,
    evidence: null,
  }),
  freezeRoute({
    routeId: 'cloudflare-nemotron-120b-seller',
    family: 'cloudflare_workers_ai',
    modelId: '@cf/nvidia/nemotron-3-120b-a12b',
    roles: ['seller'],
    tier: 'primary',
    priority: 40,
    enabledByDefault: true,
    credentialEnvName: 'CLOUDFLARE_API_TOKEN',
    credentialScope: 'server',
    noPaymentEligibility: 'NOT_VERIFIED',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_VERIFIED',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'NOT_VERIFIED',
    capabilities: UNKNOWN_CAPABILITIES,
    maxInputTokens: null,
    emergencyInputTokens: null,
    evidence: null,
  }),
  freezeRoute({
    routeId: 'groq-gpt-oss-120b-seller',
    family: 'groq',
    modelId: 'openai/gpt-oss-120b',
    roles: ['seller'],
    tier: 'independent_fallback',
    priority: 10,
    enabledByDefault: true,
    credentialEnvName: 'GROQ_API_KEY',
    credentialScope: 'server',
    noPaymentEligibility: 'NOT_VERIFIED',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_VERIFIED',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'NOT_VERIFIED',
    capabilities: UNKNOWN_CAPABILITIES,
    maxInputTokens: null,
    emergencyInputTokens: null,
    evidence: null,
  }),
  freezeRoute({
    routeId: 'groq-gpt-oss-120b-workshop',
    family: 'groq',
    modelId: 'openai/gpt-oss-120b',
    roles: ['workshop'],
    tier: 'independent_fallback',
    priority: 20,
    enabledByDefault: false,
    credentialEnvName: 'GROQ_API_KEY',
    credentialScope: 'server',
    noPaymentEligibility: 'NOT_VERIFIED',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_APPLICABLE',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'PASS',
    workshopSafety: 'NOT_VERIFIED',
    workshopHarness: 'OpenCode@1.18.30',
    runtimeActivation: 'NOT_VERIFIED',
    capabilities: UNKNOWN_CAPABILITIES,
    maxInputTokens: null,
    emergencyInputTokens: null,
    evidence: Object.freeze({
      verifiedSha: 'e8f627947dd0223dbf7237aa64d54687aab86c72',
      runId: '34483101166',
    }),
  }),
  freezeRoute({
    routeId: 'mistral-standby',
    family: 'mistral',
    modelId: 'ministral-14b-2512',
    roles: ['seller'],
    tier: 'standby',
    priority: 10,
    enabledByDefault: false,
    credentialEnvName: 'MISTRAL_API_KEY',
    credentialScope: 'server',
    noPaymentEligibility: 'NOT_VERIFIED',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_VERIFIED',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'NOT_VERIFIED',
    capabilities: UNKNOWN_CAPABILITIES,
    maxInputTokens: null,
    emergencyInputTokens: null,
    evidence: null,
  }),
]);