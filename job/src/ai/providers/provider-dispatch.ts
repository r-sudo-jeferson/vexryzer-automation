import type { ProviderRouteDecision } from './provider-router.ts';

export interface CanonicalDispatchContext {
  schemaVersion: 1;
  canonicalRevision: number;
}

export interface ProviderDispatchEnvelope<TContext extends CanonicalDispatchContext = CanonicalDispatchContext> {
  schemaVersion: 1;
  routeId: string;
  providerFamily: ProviderRouteDecision['route']['family'];
  modelId: string;
  role: ProviderRouteDecision['role'];
  canonicalRevision: number;
  contextMode: ProviderRouteDecision['contextMode'];
  fallbackReason: ProviderRouteDecision['fallbackReason'];
  credentialEnvName: string;
  context: TContext;
}

export type ProviderDispatchResult<TContext extends CanonicalDispatchContext = CanonicalDispatchContext> =
  | { ok: true; envelope: Readonly<ProviderDispatchEnvelope<TContext>> }
  | {
      ok: false;
      code:
        | 'CLIENT_CREDENTIAL_FORBIDDEN'
        | 'ROUTE_NOT_ACTIVE'
        | 'SELECTED_CONTEXT_MISSING'
        | 'CANONICAL_REVISION_MISMATCH';
    };

function routeHasRequiredRoleQuality(decision: Readonly<ProviderRouteDecision>): boolean {
  const route = decision.route;
  switch (decision.role) {
    case 'seller': return route.sellerQuality === 'PASS';
    case 'critic': return route.criticQuality === 'PASS';
    case 'composer': return route.composerQuality === 'PASS';
    case 'workshop':
      return route.harnessCompatibility === 'PASS' && route.workshopSafety === 'PASS';
  }
}

function routeIsStaticallyDispatchable(decision: Readonly<ProviderRouteDecision>): boolean {
  const route = decision.route;
  if (
    route.family !== 'deepseek'
    || route.modelId !== 'deepseek-v4-pro'
    || route.credentialEnvName !== 'DEEPSEEK_API_KEY'
    || route.tier !== 'primary'
    || decision.contextMode !== 'full'
    || decision.fallbackReason !== null
  ) return false;

  const requirements = decision.requirements;
  if (
    !requirements
    || !Number.isFinite(requirements.inputTokens)
    || requirements.inputTokens < 0
    || typeof requirements.requiresStreaming !== 'boolean'
    || typeof requirements.requiresTools !== 'boolean'
    || typeof requirements.requiresStructuredArguments !== 'boolean'
  ) return false;

  if (route.maxInputTokens === null || requirements.inputTokens > route.maxInputTokens) return false;
  if (requirements.requiresStreaming && route.capabilities.streaming !== 'PASS') return false;
  if (requirements.requiresTools && route.capabilities.tools !== 'PASS') return false;
  if (
    requirements.requiresStructuredArguments
    && route.capabilities.structuredArguments !== 'PASS'
  ) return false;

  return route.enabledByDefault
    && route.credentialScope === 'server'
    && route.billingAuthorization === 'PASS'
    && route.protocolCompatibility === 'PASS'
    && route.runtimeActivation === 'PASS'
    && route.roles.includes(decision.role)
    && routeHasRequiredRoleQuality(decision);
}

export function createProviderDispatchEnvelope<
  TFull extends CanonicalDispatchContext,
  TEmergency extends CanonicalDispatchContext,
>(input: {
  decision: Readonly<ProviderRouteDecision>;
  fullContext?: TFull;
  emergencyCapsule?: TEmergency;
}): ProviderDispatchResult<TFull | TEmergency> {
  const route = input.decision.route;
  if (route.credentialScope !== 'server') {
    return { ok: false, code: 'CLIENT_CREDENTIAL_FORBIDDEN' };
  }
  if (!routeIsStaticallyDispatchable(input.decision)) {
    return { ok: false, code: 'ROUTE_NOT_ACTIVE' };
  }

  const context = input.fullContext;
  if (context === undefined) return { ok: false, code: 'SELECTED_CONTEXT_MISSING' };
  if (context.canonicalRevision !== input.decision.canonicalRevision) {
    return { ok: false, code: 'CANONICAL_REVISION_MISMATCH' };
  }

  return {
    ok: true,
    envelope: Object.freeze({
      schemaVersion: 1,
      routeId: route.routeId,
      providerFamily: route.family,
      modelId: route.modelId,
      role: input.decision.role,
      canonicalRevision: input.decision.canonicalRevision,
      contextMode: 'full',
      fallbackReason: null,
      credentialEnvName: route.credentialEnvName,
      context,
    }),
  };
}
