import test from 'node:test';
import assert from 'node:assert/strict';
import { AUTHORIZED_PROVIDER_CANDIDATES, PROVIDER_ROUTE_TIERS } from '../../src/ai/providers/provider-registry.ts';
import { evaluateRouteEligibility } from '../../src/ai/providers/route-eligibility.ts';
import { selectProviderRoute } from '../../src/ai/providers/provider-router.ts';
import { createVerifiedRouteFixture } from './provider-test-fixtures.ts';

function runtime(routeId: string, overrides: Record<string, unknown> = {}) {
  return { routeId, circuit: 'closed', quota: 'available', ...overrides } as const;
}

const REQUEST = Object.freeze({
  role: 'seller' as const,
  canonicalRevision: 7,
  fullContextInputTokens: 500,
  requiresStreaming: true,
  requiresTools: true,
  requiresStructuredArguments: true,
});

test('route taxonomy exposes only primary and the authorized registry has exactly one fail-closed DeepSeek V4 Pro route', () => {
  assert.deepEqual(PROVIDER_ROUTE_TIERS, ['primary']);
  assert.equal(AUTHORIZED_PROVIDER_CANDIDATES.length, 1);
  const route = AUTHORIZED_PROVIDER_CANDIDATES[0]!;
  assert.equal(route.family, 'deepseek');
  assert.equal(route.modelId, 'deepseek-v4-pro');
  assert.equal(route.credentialEnvName, 'DEEPSEEK_API_KEY');
  assert.equal(route.tier, 'primary');
  assert.equal(route.billingAuthorization, 'PASS');
  assert.equal(route.protocolCompatibility, 'NOT_VERIFIED');
  assert.equal(route.runtimeActivation, 'NOT_VERIFIED');
  assert.equal(route.harnessCompatibility, 'NOT_VERIFIED');
  assert.equal(route.workshopHarness, 'DeepSeek-Harness@0.1.5-rc.1');
});

test('Founder prepaid billing authorization is mandatory but never substitutes technical verification', () => {
  const billingBlocked = createVerifiedRouteFixture({ billingAuthorization: 'NOT_VERIFIED' });
  const technicalBlocked = createVerifiedRouteFixture({ protocolCompatibility: 'NOT_VERIFIED' });
  const request = {
    role: 'seller',
    inputTokens: 100,
    requiresStreaming: true,
    requiresTools: true,
    requiresStructuredArguments: true,
  } as const;

  assert.deepEqual(
    evaluateRouteEligibility(billingBlocked, request, runtime(billingBlocked.routeId)).reasons,
    ['BILLING_AUTHORIZATION_NOT_VERIFIED'],
  );
  assert.deepEqual(
    evaluateRouteEligibility(technicalBlocked, request, runtime(technicalBlocked.routeId)).reasons,
    ['PROTOCOL_COMPATIBILITY_NOT_VERIFIED'],
  );
});

test('single verified DeepSeek route is selected with full canonical context only', () => {
  const route = createVerifiedRouteFixture();
  const result = selectProviderRoute([route], REQUEST, [runtime(route.routeId)]);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.route.routeId, route.routeId);
  assert.equal(result.contextMode, 'full');
  assert.equal(result.fallbackReason, null);
  assert.equal(result.canonicalRevision, 7);
});

test('route plurality is invalid configuration rather than fallback capacity', () => {
  const one = createVerifiedRouteFixture({ routeId: 'deepseek-one' });
  const two = createVerifiedRouteFixture({ routeId: 'deepseek-two' });
  const result = selectProviderRoute([one, two], REQUEST, [runtime(one.routeId), runtime(two.routeId)]);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'INVALID_ROUTE_REQUEST');
  assert.equal(result.recovery, 'deterministic_guided_discovery');
});

test('unavailable DeepSeek fails closed into deterministic guided recovery', () => {
  const route = createVerifiedRouteFixture();
  for (const state of [
    runtime(route.routeId, { circuit: 'open' }),
    runtime(route.routeId, { quota: 'exhausted' }),
  ]) {
    const result = selectProviderRoute([route], REQUEST, [state]);
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.code, 'NO_ELIGIBLE_ROUTE');
    assert.equal(result.recovery, 'deterministic_guided_discovery');
  }
});

test('role-quality, server-secret and context gates remain fail closed', () => {
  const request = {
    role: 'seller',
    inputTokens: 100,
    requiresStreaming: true,
    requiresTools: true,
    requiresStructuredArguments: true,
  } as const;

  const quality = createVerifiedRouteFixture({ sellerQuality: 'NOT_VERIFIED' });
  assert.ok(
    evaluateRouteEligibility(quality, request, runtime(quality.routeId)).reasons.includes(
      'SELLER_QUALITY_NOT_VERIFIED',
    ),
  );

  const clientSecret = createVerifiedRouteFixture({ credentialScope: 'client' });
  assert.deepEqual(
    evaluateRouteEligibility(clientSecret, request, runtime(clientSecret.routeId)).reasons,
    ['CLIENT_CREDENTIAL_FORBIDDEN'],
  );

  const overflow = createVerifiedRouteFixture({ maxInputTokens: 99 });
  assert.ok(
    evaluateRouteEligibility(overflow, request, runtime(overflow.routeId)).reasons.includes(
      'CONTEXT_EXCEEDED',
    ),
  );
});

test('Workshop role requires exact Harness compatibility and Workshop safety', () => {
  const route = createVerifiedRouteFixture({
    roles: ['workshop'],
    sellerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'PASS',
    workshopSafety: 'NOT_VERIFIED',
  });
  const result = evaluateRouteEligibility(route, {
    role: 'workshop',
    inputTokens: 100,
    requiresStreaming: true,
    requiresTools: true,
    requiresStructuredArguments: true,
  }, runtime(route.routeId));
  assert.equal(result.eligible, false);
  assert.ok(result.reasons.includes('WORKSHOP_SAFETY_NOT_VERIFIED'));
});
