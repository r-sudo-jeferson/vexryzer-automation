import type { ProviderRole, ProviderRouteDefinition, ProviderRouteTier } from './provider-registry.ts';
import {
  evaluateRouteEligibility,
  type ProviderRuntimeState,
  type RouteRejectionReason,
} from './route-eligibility.ts';

export type ProviderContextMode = 'full' | 'emergency_capsule';
export type ProviderFallbackReason = 'PRIMARY_UNAVAILABLE' | 'PRIMARY_CONTEXT_EXCEEDED';

export interface ProviderRouteTokenUsage {
  routeId: string;
  fullContextInputTokens: number;
  emergencyCapsuleInputTokens: number;
}

export interface ProviderSelectionRequest {
  role: ProviderRole;
  canonicalRevision: number;
  fullContextInputTokens: number;
  emergencyCapsuleInputTokens: number;
  requiresStreaming: boolean;
  requiresTools: boolean;
  requiresStructuredArguments: boolean;
  routeTokenUsage?: readonly Readonly<ProviderRouteTokenUsage>[];
}

export interface ProviderRouteRejection {
  routeId: string;
  reasons: readonly RouteRejectionReason[];
}

export interface ProviderRouteRequirements {
  inputTokens: number;
  requiresStreaming: boolean;
  requiresTools: boolean;
  requiresStructuredArguments: boolean;
}

export interface ProviderRouteDecision {
  route: Readonly<ProviderRouteDefinition>;
  role: ProviderRole;
  canonicalRevision: number;
  contextMode: ProviderContextMode;
  fallbackReason: ProviderFallbackReason | null;
  requirements: Readonly<ProviderRouteRequirements>;
}

export type ProviderSelectionResult =
  | ({ ok: true } & ProviderRouteDecision)
  | {
      ok: false;
      code: 'INVALID_ROUTE_REQUEST' | 'NO_ELIGIBLE_ROUTE';
      recovery: 'deterministic_guided_discovery';
      rejections: readonly Readonly<ProviderRouteRejection>[];
    };

const TIER_RANK: Readonly<Record<ProviderRouteTier, number>> = Object.freeze({
  primary: 0,
  independent_fallback: 1,
  emergency: 2,
  standby: 3,
});

function contextModeFor(route: Readonly<ProviderRouteDefinition>): ProviderContextMode {
  return route.tier === 'primary' ? 'full' : 'emergency_capsule';
}

function routeSort(left: Readonly<ProviderRouteDefinition>, right: Readonly<ProviderRouteDefinition>): number {
  const tier = TIER_RANK[left.tier] - TIER_RANK[right.tier];
  if (tier !== 0) return tier;
  const priority = (left.priority ?? 100) - (right.priority ?? 100);
  if (priority !== 0) return priority;
  return left.routeId.localeCompare(right.routeId);
}

export function selectProviderRoute(
  routes: readonly Readonly<ProviderRouteDefinition>[],
  request: Readonly<ProviderSelectionRequest>,
  runtimeStates: readonly Readonly<ProviderRuntimeState>[],
): ProviderSelectionResult {
  if (
    !Number.isInteger(request.canonicalRevision) || request.canonicalRevision < 0 ||
    !Number.isFinite(request.fullContextInputTokens) || request.fullContextInputTokens < 0 ||
    !Number.isFinite(request.emergencyCapsuleInputTokens) || request.emergencyCapsuleInputTokens < 0
  ) {
    return { ok: false, code: 'INVALID_ROUTE_REQUEST', recovery: 'deterministic_guided_discovery', rejections: Object.freeze([]) };
  }

  if (new Set(routes.map((route) => route.routeId)).size !== routes.length || new Set(runtimeStates.map((state) => state.routeId)).size !== runtimeStates.length) {
    return { ok: false, code: 'INVALID_ROUTE_REQUEST', recovery: 'deterministic_guided_discovery', rejections: Object.freeze([]) };
  }

  let tokenUsageByRoute: ReadonlyMap<string, Readonly<ProviderRouteTokenUsage>> | null = null;
  if (request.routeTokenUsage !== undefined) {
    if (
      request.routeTokenUsage.length !== routes.length
      || new Set(request.routeTokenUsage.map((usage) => usage.routeId)).size !== request.routeTokenUsage.length
    ) {
      return { ok: false, code: 'INVALID_ROUTE_REQUEST', recovery: 'deterministic_guided_discovery', rejections: Object.freeze([]) };
    }
    const routeIds = new Set(routes.map((route) => route.routeId));
    for (const usage of request.routeTokenUsage) {
      if (
        !routeIds.has(usage.routeId)
        || !Number.isFinite(usage.fullContextInputTokens)
        || usage.fullContextInputTokens < 0
        || !Number.isFinite(usage.emergencyCapsuleInputTokens)
        || usage.emergencyCapsuleInputTokens < 0
      ) {
        return { ok: false, code: 'INVALID_ROUTE_REQUEST', recovery: 'deterministic_guided_discovery', rejections: Object.freeze([]) };
      }
    }
    tokenUsageByRoute = new Map(request.routeTokenUsage.map((usage) => [usage.routeId, usage] as const));
  }

  const runtimeByRoute = new Map(runtimeStates.map((state) => [state.routeId, state] as const));
  const ordered = [...routes].sort(routeSort);
  const rejections: ProviderRouteRejection[] = [];
  const primaryRejections: ProviderRouteRejection[] = [];

  for (const route of ordered) {
    const contextMode = contextModeFor(route);
    const routeUsage = tokenUsageByRoute?.get(route.routeId);
    const inputTokens = contextMode === 'full'
      ? routeUsage?.fullContextInputTokens ?? request.fullContextInputTokens
      : routeUsage?.emergencyCapsuleInputTokens ?? request.emergencyCapsuleInputTokens;
    const limitTokens = contextMode === 'full' ? route.maxInputTokens : route.emergencyInputTokens;
    const eligibility = evaluateRouteEligibility(route, {
      role: request.role,
      inputTokens,
      contextLimitTokens: limitTokens,
      requiresStreaming: request.requiresStreaming,
      requiresTools: request.requiresTools,
      requiresStructuredArguments: request.requiresStructuredArguments,
    }, runtimeByRoute.get(route.routeId));

    if (!eligibility.eligible) {
      const rejection = Object.freeze({ routeId: route.routeId, reasons: eligibility.reasons });
      rejections.push(rejection);
      if (route.tier === 'primary') primaryRejections.push(rejection);
      continue;
    }

    let fallbackReason: ProviderFallbackReason | null = null;
    if (route.tier !== 'primary') {
      const primaryContextOnly = primaryRejections.length > 0 && primaryRejections.every((item) =>
        item.reasons.length === 1 && item.reasons[0] === 'CONTEXT_EXCEEDED');
      fallbackReason = primaryContextOnly ? 'PRIMARY_CONTEXT_EXCEEDED' : 'PRIMARY_UNAVAILABLE';
    }
    return {
      ok: true,
      route,
      role: request.role,
      canonicalRevision: request.canonicalRevision,
      contextMode,
      fallbackReason,
      requirements: Object.freeze({
        inputTokens,
        requiresStreaming: request.requiresStreaming,
        requiresTools: request.requiresTools,
        requiresStructuredArguments: request.requiresStructuredArguments,
      }),
    };
  }

  return {
    ok: false,
    code: 'NO_ELIGIBLE_ROUTE',
    recovery: 'deterministic_guided_discovery',
    rejections: Object.freeze(rejections),
  };
}
