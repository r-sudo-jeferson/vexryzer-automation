import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderDispatchEnvelope } from '../../src/ai/providers/provider-dispatch.ts';
import { selectProviderRoute } from '../../src/ai/providers/provider-router.ts';
import { createVerifiedRouteFixture } from './provider-test-fixtures.ts';

const REQUIREMENTS = Object.freeze({
  inputTokens: 100,
  requiresStreaming: true,
  requiresTools: true,
  requiresStructuredArguments: true,
});

function decision(route = createVerifiedRouteFixture(), revision = 44) {
  return {
    route,
    role: 'seller' as const,
    canonicalRevision: revision,
    contextMode: 'full' as const,
    fallbackReason: null,
    requirements: REQUIREMENTS,
  };
}

test('dispatch binds exact DeepSeek identity to canonical full context', () => {
  const route = createVerifiedRouteFixture();
  const context = { schemaVersion: 1, canonicalRevision: 44, marker: 'full-pack' } as const;
  const result = createProviderDispatchEnvelope({ decision: decision(route), fullContext: context });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.envelope.providerFamily, 'deepseek');
  assert.equal(result.envelope.modelId, 'deepseek-v4-pro');
  assert.equal(result.envelope.credentialEnvName, 'DEEPSEEK_API_KEY');
  assert.equal(result.envelope.context, context);
  assert.equal(result.envelope.contextMode, 'full');
  assert.equal(result.envelope.fallbackReason, null);
});

test('dispatch rejects stale canonical context', () => {
  const result = createProviderDispatchEnvelope({
    decision: decision(createVerifiedRouteFixture(), 45),
    fullContext: { schemaVersion: 1, canonicalRevision: 44 },
  });
  assert.deepEqual(result, { ok: false, code: 'CANONICAL_REVISION_MISMATCH' });
});

test('dispatch rejects billing, technical, quality, capability and client-secret bypasses', () => {
  const routes = [
    createVerifiedRouteFixture({ billingAuthorization: 'NOT_VERIFIED' }),
    createVerifiedRouteFixture({ protocolCompatibility: 'NOT_VERIFIED' }),
    createVerifiedRouteFixture({ runtimeActivation: 'NOT_VERIFIED' }),
    createVerifiedRouteFixture({ sellerQuality: 'NOT_VERIFIED' }),
    createVerifiedRouteFixture({
      capabilities: { streaming: 'NOT_VERIFIED', tools: 'PASS', structuredArguments: 'PASS' },
    }),
    createVerifiedRouteFixture({ credentialScope: 'client' }),
  ];
  for (const route of routes) {
    const result = createProviderDispatchEnvelope({
      decision: decision(route),
      fullContext: { schemaVersion: 1, canonicalRevision: 44 },
    });
    assert.equal(result.ok, false, route.routeId);
  }
});

test('router decision and dispatch never create an emergency model context', () => {
  const route = createVerifiedRouteFixture();
  const selected = selectProviderRoute([route], {
    role: 'seller',
    canonicalRevision: 31,
    fullContextInputTokens: 100,
    emergencyCapsuleInputTokens: 0,
    requiresStreaming: true,
    requiresTools: true,
    requiresStructuredArguments: true,
  }, [{ routeId: route.routeId, circuit: 'closed', quota: 'available' }]);
  assert.equal(selected.ok, true);
  if (!selected.ok) return;

  const result = createProviderDispatchEnvelope({
    decision: selected,
    fullContext: { schemaVersion: 1, canonicalRevision: 31 },
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.envelope.contextMode, 'full');
  assert.equal(result.envelope.fallbackReason, null);
});
