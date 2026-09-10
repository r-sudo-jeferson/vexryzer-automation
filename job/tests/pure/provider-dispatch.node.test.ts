import test from 'node:test';
import assert from 'node:assert/strict';
import { createVerifiedRouteFixture } from './provider-test-fixtures.ts';
import { createProviderDispatchEnvelope } from '../../src/ai/providers/provider-dispatch.ts';
import { selectProviderRoute } from '../../src/ai/providers/provider-router.ts';

const DEFAULT_REQUIREMENTS = Object.freeze({
  inputTokens: 100,
  requiresStreaming: true,
  requiresTools: true,
  requiresStructuredArguments: true,
} as const);

test('dispatch envelope binds route to canonical revision and full context without provider memory authority', () => {
  const route = createVerifiedRouteFixture({ routeId: 'cloudflare-primary', family: 'cloudflare_workers_ai', tier: 'primary' });
  const pack = { schemaVersion: 1, canonicalRevision: 44, marker: 'full-pack' } as const;
  const result = createProviderDispatchEnvelope({
    decision: { route, role: 'seller', canonicalRevision: 44, contextMode: 'full', fallbackReason: null, requirements: DEFAULT_REQUIREMENTS },
    fullContext: pack,
    emergencyCapsule: { schemaVersion: 1, canonicalRevision: 44, marker: 'capsule' },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.envelope.context, pack);
  assert.equal(result.envelope.canonicalRevision, 44);
  assert.equal(result.envelope.contextMode, 'full');
  assert.equal('providerConversationId' in result.envelope, false);
});

test('fallback dispatch uses emergency capsule derived from the same canonical revision', () => {
  const route = createVerifiedRouteFixture({ routeId: 'groq-fallback', family: 'groq', tier: 'independent_fallback' });
  const capsule = { schemaVersion: 1, canonicalRevision: 44, marker: 'capsule' } as const;
  const result = createProviderDispatchEnvelope({
    decision: { route, role: 'seller', canonicalRevision: 44, contextMode: 'emergency_capsule', fallbackReason: 'PRIMARY_UNAVAILABLE', requirements: DEFAULT_REQUIREMENTS },
    fullContext: { schemaVersion: 1, canonicalRevision: 44, marker: 'full-pack' },
    emergencyCapsule: capsule,
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.envelope.context, capsule);
  assert.equal(result.envelope.contextMode, 'emergency_capsule');
});

test('dispatch rejects stale or mismatched canonical context before provider call', () => {
  const route = createVerifiedRouteFixture({ routeId: 'groq-fallback', family: 'groq', tier: 'independent_fallback' });
  const result = createProviderDispatchEnvelope({
    decision: { route, role: 'seller', canonicalRevision: 45, contextMode: 'emergency_capsule', fallbackReason: 'PRIMARY_UNAVAILABLE', requirements: DEFAULT_REQUIREMENTS },
    fullContext: { schemaVersion: 1, canonicalRevision: 44 },
    emergencyCapsule: { schemaVersion: 1, canonicalRevision: 44 },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'CANONICAL_REVISION_MISMATCH');
});

test('dispatch refuses a client-scoped credential even if a malformed caller bypassed normal route selection', () => {
  const route = createVerifiedRouteFixture({ routeId: 'client-bypass', credentialScope: 'client' });
  const result = createProviderDispatchEnvelope({
    decision: { route, role: 'seller', canonicalRevision: 1, contextMode: 'full', fallbackReason: null, requirements: DEFAULT_REQUIREMENTS },
    fullContext: { schemaVersion: 1, canonicalRevision: 1 },
    emergencyCapsule: { schemaVersion: 1, canonicalRevision: 1 },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'CLIENT_CREDENTIAL_FORBIDDEN');
});

test('dispatch defense-in-depth refuses seller-quality bypass and disabled routes', () => {
  for (const route of [
    createVerifiedRouteFixture({ routeId: 'seller-quality-bypass', sellerQuality: 'NOT_VERIFIED' }),
    createVerifiedRouteFixture({ routeId: 'disabled-bypass', enabledByDefault: false }),
  ]) {
    const result = createProviderDispatchEnvelope({
      decision: { route, role: 'seller', canonicalRevision: 1, contextMode: 'full', fallbackReason: null, requirements: DEFAULT_REQUIREMENTS },
      fullContext: { schemaVersion: 1, canonicalRevision: 1 },
      emergencyCapsule: { schemaVersion: 1, canonicalRevision: 1 },
    });
    assert.equal(result.ok, false);
    if (result.ok) continue;
    assert.equal(result.code, 'ROUTE_NOT_ACTIVE');
  }
});

test('dispatch defense-in-depth refuses Workshop before both harness compatibility and Workshop safety pass', () => {
  const route = createVerifiedRouteFixture({
    routeId: 'workshop-bypass', roles: ['workshop'], sellerQuality: 'NOT_APPLICABLE', harnessCompatibility: 'PASS', workshopSafety: 'NOT_VERIFIED',
  });
  const result = createProviderDispatchEnvelope({
    decision: { route, role: 'workshop', canonicalRevision: 1, contextMode: 'emergency_capsule', fallbackReason: 'PRIMARY_UNAVAILABLE', requirements: DEFAULT_REQUIREMENTS },
    fullContext: { schemaVersion: 1, canonicalRevision: 1 },
    emergencyCapsule: { schemaVersion: 1, canonicalRevision: 1 },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'ROUTE_NOT_ACTIVE');
});

test('dispatch revalidates the selected capability and context budget snapshot before adapter execution', () => {
  const route = createVerifiedRouteFixture({
    routeId: 'fabricated-capability-bypass',
    capabilities: { streaming: 'NOT_VERIFIED', tools: 'NOT_VERIFIED', structuredArguments: 'NOT_VERIFIED' },
    maxInputTokens: null,
    emergencyInputTokens: null,
  });
  const result = createProviderDispatchEnvelope({
    decision: {
      route,
      role: 'seller',
      canonicalRevision: 1,
      contextMode: 'full',
      fallbackReason: null,
      requirements: {
        inputTokens: 100,
        requiresStreaming: true,
        requiresTools: true,
        requiresStructuredArguments: true,
      },
    },
    fullContext: { schemaVersion: 1, canonicalRevision: 1 },
    emergencyCapsule: { schemaVersion: 1, canonicalRevision: 1 },
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'ROUTE_NOT_ACTIVE');
});

test('dispatch rejects forged tier/context-mode or fallback-reason combinations', () => {
  const primary = createVerifiedRouteFixture({ routeId: 'primary-mode-bypass', tier: 'primary' });
  const fallback = createVerifiedRouteFixture({ routeId: 'fallback-mode-bypass', tier: 'independent_fallback', family: 'groq' });
  const requirements = { inputTokens: 100, requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true } as const;

  const primaryEmergency = createProviderDispatchEnvelope({
    decision: { route: primary, role: 'seller', canonicalRevision: 1, contextMode: 'emergency_capsule', fallbackReason: 'PRIMARY_UNAVAILABLE', requirements },
    fullContext: { schemaVersion: 1, canonicalRevision: 1 },
    emergencyCapsule: { schemaVersion: 1, canonicalRevision: 1 },
  });
  assert.equal(primaryEmergency.ok, false);

  const fallbackFull = createProviderDispatchEnvelope({
    decision: { route: fallback, role: 'seller', canonicalRevision: 1, contextMode: 'full', fallbackReason: null, requirements },
    fullContext: { schemaVersion: 1, canonicalRevision: 1 },
    emergencyCapsule: { schemaVersion: 1, canonicalRevision: 1 },
  });
  assert.equal(fallbackFull.ok, false);
});

test('dispatch requires only the context selected by contextMode', () => {
  const primaryRoute = createVerifiedRouteFixture({ routeId: 'primary-selected-context', tier: 'primary' });
  const primaryDecision = selectProviderRoute([primaryRoute], {
    role: 'seller', canonicalRevision: 31, fullContextInputTokens: 200, emergencyCapsuleInputTokens: 100,
    requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, [{ routeId: primaryRoute.routeId, circuit: 'closed', quota: 'available' }]);
  assert.equal(primaryDecision.ok, true);
  if (!primaryDecision.ok) return;

  const primary = createProviderDispatchEnvelope({
    decision: primaryDecision,
    fullContext: { schemaVersion: 1, canonicalRevision: 31, payload: 'full' },
  });
  assert.equal(primary.ok, true);
  if (primary.ok) assert.equal(primary.envelope.contextMode, 'full');

  const fallbackRoute = createVerifiedRouteFixture({ routeId: 'fallback-selected-context', tier: 'independent_fallback' });
  const blockedPrimary = createVerifiedRouteFixture({ routeId: 'blocked-primary', tier: 'primary', runtimeActivation: 'FAIL' });
  const fallbackDecision = selectProviderRoute([blockedPrimary, fallbackRoute], {
    role: 'seller', canonicalRevision: 32, fullContextInputTokens: 200, emergencyCapsuleInputTokens: 100,
    requiresStreaming: true, requiresTools: true, requiresStructuredArguments: true,
  }, [
    { routeId: blockedPrimary.routeId, circuit: 'closed', quota: 'available' },
    { routeId: fallbackRoute.routeId, circuit: 'closed', quota: 'available' },
  ]);
  assert.equal(fallbackDecision.ok, true);
  if (!fallbackDecision.ok) return;

  const fallback = createProviderDispatchEnvelope({
    decision: fallbackDecision,
    emergencyCapsule: { schemaVersion: 1, canonicalRevision: 32, payload: 'emergency' },
  });
  assert.equal(fallback.ok, true);
  if (fallback.ok) assert.equal(fallback.envelope.contextMode, 'emergency_capsule');
});
