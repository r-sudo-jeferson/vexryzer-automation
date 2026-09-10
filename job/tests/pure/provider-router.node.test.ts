import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORIZED_PROVIDER_CANDIDATES } from '../../src/ai/providers/provider-registry.ts';
import { createVerifiedRouteFixture } from './provider-test-fixtures.ts';
import { evaluateRouteEligibility } from '../../src/ai/providers/route-eligibility.ts';
import { selectProviderRoute } from '../../src/ai/providers/provider-router.ts';

function runtime(routeId: string, overrides: Record<string, unknown> = {}) {
  return {
    routeId,
    circuit: 'closed',
    quota: 'available',
    ...overrides,
  } as const;
}

test('authorized candidate registry is fail-closed and does not manufacture provider PASS from documentation', () => {
  assert.ok(AUTHORIZED_PROVIDER_CANDIDATES.length >= 6);
  for (const route of AUTHORIZED_PROVIDER_CANDIDATES) {
    assert.notEqual(route.noPaymentEligibility, 'PASS');
    assert.notEqual(route.runtimeActivation, 'PASS');
  }
  const workshop = AUTHORIZED_PROVIDER_CANDIDATES.find((route) => route.routeId === 'groq-gpt-oss-120b-workshop');
  assert.ok(workshop);
  assert.equal(workshop.harnessCompatibility, 'PASS');
  assert.equal(workshop.runtimeActivation, 'NOT_VERIFIED');
  assert.equal(workshop.enabledByDefault, false);
});

test('protocol compatibility alone cannot make a Seller route eligible without seller-quality PASS', () => {
  const route = createVerifiedRouteFixture({
    routeId: 'seller-quality-missing',
    family: 'cloudflare_workers_ai',
    modelId: '@cf/example/seller',
    roles: ['seller'],
    tier: 'primary',
    sellerQuality: 'NOT_VERIFIED',
  });
  const result = evaluateRouteEligibility(route, {
    role: 'seller', inputTokens: 2_000, requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, runtime(route.routeId));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes('SELLER_QUALITY_NOT_VERIFIED'));
});

test('no-payment and runtime activation are hard fail-closed gates', () => {
  const unpaid = createVerifiedRouteFixture({ routeId: 'paid-route', noPaymentEligibility: 'FAIL' });
  const notActivated = createVerifiedRouteFixture({ routeId: 'not-activated', runtimeActivation: 'NOT_VERIFIED' });
  const request = { role: 'seller', inputTokens: 100, requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true } as const;
  assert.deepEqual(evaluateRouteEligibility(unpaid, request, runtime(unpaid.routeId)).reasons, ['NO_PAYMENT_INELIGIBLE']);
  assert.deepEqual(evaluateRouteEligibility(notActivated, request, runtime(notActivated.routeId)).reasons, ['RUNTIME_ACTIVATION_NOT_VERIFIED']);
});

test('server-only credential scope is mandatory for active routes', () => {
  const route = createVerifiedRouteFixture({ routeId: 'client-secret', credentialScope: 'client' });
  const result = evaluateRouteEligibility(route, {
    role: 'seller', inputTokens: 100, requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, runtime(route.routeId));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes('CLIENT_CREDENTIAL_FORBIDDEN'));
});

test('router prefers eligible Cloudflare primary, then independent Groq fallback, and records fallback reason', () => {
  const primary = createVerifiedRouteFixture({
    routeId: 'cloudflare-primary', family: 'cloudflare_workers_ai', modelId: '@cf/example/primary', roles: ['seller'], tier: 'primary',
  });
  const groq = createVerifiedRouteFixture({
    routeId: 'groq-fallback', family: 'groq', modelId: 'openai/gpt-oss-120b', roles: ['seller'], tier: 'independent_fallback',
  });
  const request = {
    role: 'seller', canonicalRevision: 31, fullContextInputTokens: 4_000, emergencyCapsuleInputTokens: 1_000,
    requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  } as const;

  const primaryDecision = selectProviderRoute([primary, groq], request, [runtime(primary.routeId), runtime(groq.routeId)]);
  assert.equal(primaryDecision.ok, true);
  if (!primaryDecision.ok) return;
  assert.equal(primaryDecision.route.routeId, primary.routeId);
  assert.equal(primaryDecision.contextMode, 'full');
  assert.equal(primaryDecision.fallbackReason, null);
  assert.equal(primaryDecision.canonicalRevision, 31);

  const fallbackDecision = selectProviderRoute([primary, groq], request, [runtime(primary.routeId, { circuit: 'open' }), runtime(groq.routeId)]);
  assert.equal(fallbackDecision.ok, true);
  if (!fallbackDecision.ok) return;
  assert.equal(fallbackDecision.route.routeId, groq.routeId);
  assert.equal(fallbackDecision.contextMode, 'emergency_capsule');
  assert.equal(fallbackDecision.fallbackReason, 'PRIMARY_UNAVAILABLE');
});

test('router never uses standby Mistral or disabled emergency route as an implicit fallback', () => {
  const standby = createVerifiedRouteFixture({ routeId: 'mistral-standby', family: 'mistral', tier: 'standby', roles: ['seller'] });
  const emergencyDisabled = createVerifiedRouteFixture({
    routeId: 'openrouter-emergency', family: 'openrouter', tier: 'emergency', roles: ['seller'], enabledByDefault: false,
  });
  const result = selectProviderRoute([standby, emergencyDisabled], {
    role: 'seller', canonicalRevision: 2, fullContextInputTokens: 100, emergencyCapsuleInputTokens: 80,
    requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, [runtime(standby.routeId), runtime(emergencyDisabled.routeId)]);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.recovery, 'deterministic_guided_discovery');
  assert.ok(result.rejections.some((item) => item.routeId === standby.routeId && item.reasons.includes('STANDBY_ROUTE')));
  assert.ok(result.rejections.some((item) => item.routeId === emergencyDisabled.routeId && item.reasons.includes('ROUTE_DISABLED')));
});

test('context overflow on primary may select an eligible fallback only when the emergency capsule fits', () => {
  const primary = createVerifiedRouteFixture({
    routeId: 'small-primary', tier: 'primary', family: 'cloudflare_workers_ai', maxInputTokens: 2_000, emergencyInputTokens: 700,
  });
  const fallback = createVerifiedRouteFixture({
    routeId: 'groq-small', tier: 'independent_fallback', family: 'groq', maxInputTokens: 1_500, emergencyInputTokens: 900,
  });
  const result = selectProviderRoute([primary, fallback], {
    role: 'seller', canonicalRevision: 9, fullContextInputTokens: 3_000, emergencyCapsuleInputTokens: 800,
    requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, [runtime(primary.routeId), runtime(fallback.routeId)]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.route.routeId, fallback.routeId);
  assert.equal(result.contextMode, 'emergency_capsule');
  assert.equal(result.fallbackReason, 'PRIMARY_CONTEXT_EXCEEDED');
});

test('workshop role requires workshop compatibility and explicit runtime activation independent from normal Seller routing', () => {
  const route = createVerifiedRouteFixture({
    routeId: 'workshop-not-gated', roles: ['workshop'], tier: 'independent_fallback', sellerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'PASS', workshopSafety: 'NOT_VERIFIED', runtimeActivation: 'PASS',
  });
  const result = evaluateRouteEligibility(route, {
    role: 'workshop', inputTokens: 500, requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, runtime(route.routeId));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes('WORKSHOP_SAFETY_NOT_VERIFIED'));
});

test('runtime circuit and quota failures are bounded route rejections rather than blind retry signals', () => {
  const route = createVerifiedRouteFixture({ routeId: 'runtime-route' });
  const request = { role: 'seller', inputTokens: 100, requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true } as const;
  const open = evaluateRouteEligibility(route, request, runtime(route.routeId, { circuit: 'open' }));
  assert.ok(open.reasons.includes('CIRCUIT_OPEN'));
  const exhausted = evaluateRouteEligibility(route, request, runtime(route.routeId, { quota: 'exhausted' }));
  assert.ok(exhausted.reasons.includes('QUOTA_EXHAUSTED'));
});

test('route selection is deterministic and never depends on provider-side conversation identifiers', () => {
  const route = createVerifiedRouteFixture({ routeId: 'deterministic-route' });
  const result = selectProviderRoute([route], {
    role: 'seller', canonicalRevision: 5, fullContextInputTokens: 100, emergencyCapsuleInputTokens: 80,
    requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, [runtime(route.routeId)]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const serialized = JSON.stringify(result).toLowerCase();
  for (const forbidden of ['conversationid', 'conversation_id', 'threadid', 'thread_id', 'providersession', 'provider_session']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('role quality marked NOT_APPLICABLE never becomes an accidental PASS for a role the route claims to support', () => {
  const seller = createVerifiedRouteFixture({ routeId: 'seller-na', roles: ['seller'], sellerQuality: 'NOT_APPLICABLE' });
  const workshop = createVerifiedRouteFixture({
    routeId: 'workshop-na', roles: ['workshop'], sellerQuality: 'NOT_APPLICABLE', harnessCompatibility: 'NOT_APPLICABLE', workshopSafety: 'NOT_APPLICABLE',
  });
  const sellerResult = evaluateRouteEligibility(seller, {
    role: 'seller', inputTokens: 100, requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, runtime(seller.routeId));
  assert.equal(sellerResult.eligible, false);
  assert.ok(sellerResult.reasons.includes('SELLER_QUALITY_NOT_VERIFIED'));
  const workshopResult = evaluateRouteEligibility(workshop, {
    role: 'workshop', inputTokens: 100, requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, runtime(workshop.routeId));
  assert.equal(workshopResult.eligible, false);
  assert.ok(workshopResult.reasons.includes('HARNESS_COMPATIBILITY_NOT_VERIFIED'));
});

test('authorized candidates encode unknown budgets/capabilities as NOT_VERIFIED rather than fake numeric or boolean support', () => {
  for (const route of AUTHORIZED_PROVIDER_CANDIDATES) {
    assert.equal(route.maxInputTokens, null);
    assert.equal(route.emergencyInputTokens, null);
    assert.equal(route.capabilities.streaming, 'NOT_VERIFIED');
    assert.equal(route.capabilities.tools, 'NOT_VERIFIED');
    assert.equal(route.capabilities.structuredArguments, 'NOT_VERIFIED');
  }
});

test('historical Workshop PASS is bound to exact harness identity and exact evidence tuple', () => {
  const workshop = AUTHORIZED_PROVIDER_CANDIDATES.find((route) => route.routeId === 'groq-gpt-oss-120b-workshop');
  assert.ok(workshop);
  assert.equal(workshop.workshopHarness, 'OpenCode@1.18.30');
  assert.equal(workshop.modelId, 'openai/gpt-oss-120b');
  assert.equal(workshop.evidence?.verifiedSha, 'e8f627947dd0223dbf7237aa64d54687aab86c72');
  assert.equal(workshop.evidence?.runId, '34483101166');
  const mistral = AUTHORIZED_PROVIDER_CANDIDATES.find((route) => route.routeId === 'mistral-standby');
  assert.equal(mistral?.modelId, 'ministral-14b-2512');
});

test('duplicate route ids or duplicate runtime states are rejected instead of resolved by list/map order', () => {
  const one = createVerifiedRouteFixture({ routeId: 'duplicate-route', priority: 1 });
  const two = createVerifiedRouteFixture({ routeId: 'duplicate-route', priority: 2 });
  const request = {
    role: 'seller', canonicalRevision: 1, fullContextInputTokens: 100, emergencyCapsuleInputTokens: 80,
    requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  } as const;
  const duplicateRoutes = selectProviderRoute([one, two], request, [runtime(one.routeId)]);
  assert.equal(duplicateRoutes.ok, false);
  if (!duplicateRoutes.ok) assert.equal(duplicateRoutes.code, 'INVALID_ROUTE_REQUEST');

  const duplicateRuntime = selectProviderRoute([one], request, [runtime(one.routeId), runtime(one.routeId, { quota: 'constrained' })]);
  assert.equal(duplicateRuntime.ok, false);
  if (!duplicateRuntime.ok) assert.equal(duplicateRuntime.code, 'INVALID_ROUTE_REQUEST');
});