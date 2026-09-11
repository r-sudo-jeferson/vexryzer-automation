import type { ProviderRole, ProviderRouteDefinition } from './provider-registry.ts';
import {
  evaluateRouteEligibility,
  type ProviderRuntimeState,
  type RouteRejectionReason,
} from './route-eligibility.ts';

export interface ProviderRouteTokenUsage {
  routeId: string;
  fullContextInputTokens: number;
}

export interface ProviderSelectionRequest {
  role: ProviderRole;
  canonicalRevision: number;
  fullContextInputTokens: number;
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

function isAuthorizedDeepSeekIdentity(route: Readonly<ProviderRouteDefinition>): boolean {
  return route.family === 'deepseek'
    && route.modelId === 'deepseek-v4-pro'
    && route.credentialEnvName === 'DEEPSEEK_API_KEY'
    && route.credentialScope === 'server'
    && route.tier === 'primary';
}

function validRequestNumbers(request: Readonly<ProviderSelectionRequest>): boolean {
  return Number.isInteger(request.canonicalRevision)
    && request.canonicalRevision >= 0
    && Number.isFinite(request.fullContextInputTokens)
    && request.fullContextInputTokens >= 0;
}

/**
 * Select the one authorized DeepSeek route.
 *
 * S002 intentionally has no LLM fallback. Any route plurality, alternate tier,
 * alternate model identity or malformed runtime snapshot fails closed into
 * deterministic guided recovery.
 */
export function selectProviderRoute(
  routes: readonly Readonly<ProviderRouteDefinition>[],
  request: Readonly<ProviderSelectionRequest>,
  runtimeStates: readonly Readonly<ProviderRuntimeState>[],
): ProviderSelectionResult {
  if (!validRequestNumbers(request) || routes.length !== 1 || runtimeStates.length !== 1) {
    return {
      ok: false,
      code: 'INVALID_ROUTE_REQUEST',
      recovery: 'deterministic_guided_discovery',
      rejections: Object.freeze([]),
    };
  }

  const route = routes[0]!;
  const runtime = runtimeStates[0]!;
  if (!isAuthorizedDeepSeekIdentity(route) || runtime.routeId !== route.routeId) {
    return {
      ok: false,
      code: 'INVALID_ROUTE_REQUEST',
      recovery: 'deterministic_guided_discovery',
      rejections: Object.freeze([]),
    };
  }

  let inputTokens = request.fullContextInputTokens;
  if (request.routeTokenUsage !== undefined) {
    if (
      request.routeTokenUsage.length !== 1
      || request.routeTokenUsage[0]?.routeId !== route.routeId
      || !Number.isFinite(request.routeTokenUsage[0].fullContextInputTokens)
      || request.routeTokenUsage[0].fullContextInputTokens < 0
    ) {
      return {
        ok: false,
        code: 'INVALID_ROUTE_REQUEST',
        recovery: 'deterministic_guided_discovery',
        rejections: Object.freeze([]),
      };
    }
    inputTokens = request.routeTokenUsage[0].fullContextInputTokens;
  }

  const eligibility = evaluateRouteEligibility(route, {
    role: request.role,
    inputTokens,
    contextLimitTokens: route.maxInputTokens,
    requiresStreaming: request.requiresStreaming,
    requiresTools: request.requiresTools,
    requiresStructuredArguments: request.requiresStructuredArguments,
  }, runtime);

  if (!eligibility.eligible) {
    return {
      ok: false,
      code: 'NO_ELIGIBLE_ROUTE',
      recovery: 'deterministic_guided_discovery',
      rejections: Object.freeze([
        Object.freeze({ routeId: route.routeId, reasons: eligibility.reasons }),
      ]),
    };
  }

  return {
    ok: true,
    route,
    role: request.role,
    canonicalRevision: request.canonicalRevision,
    requirements: Object.freeze({
      inputTokens,
      requiresStreaming: request.requiresStreaming,
      requiresTools: request.requiresTools,
      requiresStructuredArguments: request.requiresStructuredArguments,
    }),
  };
}
