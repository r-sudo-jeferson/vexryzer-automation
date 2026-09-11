export const PROVIDER_FAMILIES = ['deepseek'] as const;
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
  billingAuthorization: Exclude<VerificationVerdict, 'NOT_APPLICABLE'>;
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
 * Founder-authorized single AI route.
 *
 * Billing authorization records only the explicit Founder authorization to use
 * the existing prepaid DeepSeek balance. It is not protocol, quality, Harness
 * or runtime evidence. Every technical field remains fail-closed until the
 * exact candidate tuple is verified.
 */
export const AUTHORIZED_PROVIDER_CANDIDATES: readonly Readonly<ProviderRouteDefinition>[] = Object.freeze([
  freezeRoute({
    routeId: 'deepseek-v4-pro-agent',
    family: 'deepseek',
    modelId: 'deepseek-v4-pro',
    roles: ['seller', 'critic', 'composer', 'workshop'],
    tier: 'primary',
    priority: 1,
    enabledByDefault: true,
    credentialEnvName: 'DEEPSEEK_API_KEY',
    credentialScope: 'server',
    billingAuthorization: 'PASS',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_VERIFIED',
    criticQuality: 'NOT_VERIFIED',
    composerQuality: 'NOT_VERIFIED',
    harnessCompatibility: 'NOT_VERIFIED',
    workshopSafety: 'NOT_VERIFIED',
    workshopHarness: 'DeepSeek-Harness@0.1.5-rc.2',
    runtimeActivation: 'NOT_VERIFIED',
    capabilities: UNKNOWN_CAPABILITIES,
    maxInputTokens: null,
    emergencyInputTokens: null,
    evidence: null,
  }),
]);
