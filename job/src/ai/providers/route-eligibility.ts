import type { ProviderRole, ProviderRouteDefinition, VerificationVerdict } from './provider-registry.ts';

export type ProviderCircuitState = 'closed' | 'degraded' | 'open';
export type ProviderQuotaState = 'available' | 'constrained' | 'exhausted';

export interface ProviderRuntimeState {
  routeId: string;
  circuit: ProviderCircuitState;
  quota: ProviderQuotaState;
}

export interface ProviderRouteRequest {
  role: ProviderRole;
  inputTokens: number;
  requiresStreaming: boolean;
  requiresTools: boolean;
  requiresStructuredArguments: boolean;
  contextLimitTokens?: number | null;
}

export const ROUTE_REJECTION_REASONS = [
  'ROUTE_DISABLED',
  'STANDBY_ROUTE',
  'CLIENT_CREDENTIAL_FORBIDDEN',
  'NO_PAYMENT_INELIGIBLE',
  'NO_PAYMENT_NOT_VERIFIED',
  'RUNTIME_ACTIVATION_FAILED',
  'RUNTIME_ACTIVATION_NOT_VERIFIED',
  'PROTOCOL_COMPATIBILITY_FAILED',
  'PROTOCOL_COMPATIBILITY_NOT_VERIFIED',
  'ROLE_UNSUPPORTED',
  'SELLER_QUALITY_FAILED',
  'SELLER_QUALITY_NOT_VERIFIED',
  'CRITIC_QUALITY_FAILED',
  'CRITIC_QUALITY_NOT_VERIFIED',
  'COMPOSER_QUALITY_FAILED',
  'COMPOSER_QUALITY_NOT_VERIFIED',
  'HARNESS_COMPATIBILITY_FAILED',
  'HARNESS_COMPATIBILITY_NOT_VERIFIED',
  'WORKSHOP_SAFETY_FAILED',
  'WORKSHOP_SAFETY_NOT_VERIFIED',
  'STREAMING_UNSUPPORTED',
  'STREAMING_NOT_VERIFIED',
  'TOOLS_UNSUPPORTED',
  'TOOLS_NOT_VERIFIED',
  'STRUCTURED_ARGUMENTS_UNSUPPORTED',
  'STRUCTURED_ARGUMENTS_NOT_VERIFIED',
  'CONTEXT_BUDGET_NOT_VERIFIED',
  'CONTEXT_EXCEEDED',
  'RUNTIME_STATE_MISSING',
  'CIRCUIT_OPEN',
  'QUOTA_EXHAUSTED',
] as const;
export type RouteRejectionReason = (typeof ROUTE_REJECTION_REASONS)[number];

export interface ProviderEligibilityResult {
  eligible: boolean;
  reasons: readonly RouteRejectionReason[];
}

function verdictReason(
  verdict: VerificationVerdict,
  fail: RouteRejectionReason,
  notVerified: RouteRejectionReason,
): RouteRejectionReason | null {
  if (verdict === 'FAIL') return fail;
  if (verdict === 'NOT_VERIFIED') return notVerified;
  return null;
}

function requiredRoleVerdict(
  verdict: VerificationVerdict,
  fail: RouteRejectionReason,
  notVerified: RouteRejectionReason,
): RouteRejectionReason | null {
  if (verdict === 'PASS') return null;
  return verdict === 'FAIL' ? fail : notVerified;
}

function qualityReason(route: Readonly<ProviderRouteDefinition>, role: ProviderRole): RouteRejectionReason | null {
  switch (role) {
    case 'seller':
      return requiredRoleVerdict(route.sellerQuality, 'SELLER_QUALITY_FAILED', 'SELLER_QUALITY_NOT_VERIFIED');
    case 'critic':
      return requiredRoleVerdict(route.criticQuality, 'CRITIC_QUALITY_FAILED', 'CRITIC_QUALITY_NOT_VERIFIED');
    case 'composer':
      return requiredRoleVerdict(route.composerQuality, 'COMPOSER_QUALITY_FAILED', 'COMPOSER_QUALITY_NOT_VERIFIED');
    case 'workshop': {
      const harness = requiredRoleVerdict(route.harnessCompatibility, 'HARNESS_COMPATIBILITY_FAILED', 'HARNESS_COMPATIBILITY_NOT_VERIFIED');
      if (harness !== null) return harness;
      return requiredRoleVerdict(route.workshopSafety, 'WORKSHOP_SAFETY_FAILED', 'WORKSHOP_SAFETY_NOT_VERIFIED');
    }
  }
}

export function evaluateRouteEligibility(
  route: Readonly<ProviderRouteDefinition>,
  request: Readonly<ProviderRouteRequest>,
  runtime: Readonly<ProviderRuntimeState> | undefined,
): ProviderEligibilityResult {
  if (!route.enabledByDefault) return { eligible: false, reasons: Object.freeze(['ROUTE_DISABLED']) };
  if (route.tier === 'standby') return { eligible: false, reasons: Object.freeze(['STANDBY_ROUTE']) };
  if (route.credentialScope !== 'server') return { eligible: false, reasons: Object.freeze(['CLIENT_CREDENTIAL_FORBIDDEN']) };

  const noPayment = verdictReason(route.noPaymentEligibility, 'NO_PAYMENT_INELIGIBLE', 'NO_PAYMENT_NOT_VERIFIED');
  if (noPayment !== null) return { eligible: false, reasons: Object.freeze([noPayment]) };
  const activation = verdictReason(route.runtimeActivation, 'RUNTIME_ACTIVATION_FAILED', 'RUNTIME_ACTIVATION_NOT_VERIFIED');
  if (activation !== null) return { eligible: false, reasons: Object.freeze([activation]) };
  const protocol = verdictReason(route.protocolCompatibility, 'PROTOCOL_COMPATIBILITY_FAILED', 'PROTOCOL_COMPATIBILITY_NOT_VERIFIED');
  if (protocol !== null) return { eligible: false, reasons: Object.freeze([protocol]) };
  if (!route.roles.includes(request.role)) return { eligible: false, reasons: Object.freeze(['ROLE_UNSUPPORTED']) };

  const quality = qualityReason(route, request.role);
  if (quality !== null) return { eligible: false, reasons: Object.freeze([quality]) };

  const reasons: RouteRejectionReason[] = [];
  const capabilityReason = (verdict: 'PASS' | 'FAIL' | 'NOT_VERIFIED', unsupported: RouteRejectionReason, notVerified: RouteRejectionReason) => {
    if (verdict === 'FAIL') reasons.push(unsupported);
    else if (verdict !== 'PASS') reasons.push(notVerified);
  };
  if (request.requiresStreaming) capabilityReason(route.capabilities.streaming, 'STREAMING_UNSUPPORTED', 'STREAMING_NOT_VERIFIED');
  if (request.requiresTools) capabilityReason(route.capabilities.tools, 'TOOLS_UNSUPPORTED', 'TOOLS_NOT_VERIFIED');
  if (request.requiresStructuredArguments) capabilityReason(route.capabilities.structuredArguments, 'STRUCTURED_ARGUMENTS_UNSUPPORTED', 'STRUCTURED_ARGUMENTS_NOT_VERIFIED');
  const contextLimit = request.contextLimitTokens === undefined ? route.maxInputTokens : request.contextLimitTokens;
  if (contextLimit === null) reasons.push('CONTEXT_BUDGET_NOT_VERIFIED');
  else if (!Number.isFinite(request.inputTokens) || request.inputTokens < 0 || request.inputTokens > contextLimit) reasons.push('CONTEXT_EXCEEDED');
  if (runtime === undefined || runtime.routeId !== route.routeId) reasons.push('RUNTIME_STATE_MISSING');
  else {
    if (runtime.circuit === 'open') reasons.push('CIRCUIT_OPEN');
    if (runtime.quota === 'exhausted') reasons.push('QUOTA_EXHAUSTED');
  }
  return { eligible: reasons.length === 0, reasons: Object.freeze(reasons) };
}