import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProviderRoute } from '../../src/ai/providers/provider-router.ts';
import { createVerifiedRouteFixture } from './provider-test-fixtures.ts';

function runtime(routeId: string) {
  return { routeId, circuit: 'closed', quota: 'available' } as const;
}

test('route-specific packed token usage preserves an eligible compacted primary', () => {
  const compactPrimary = createVerifiedRouteFixture({
    routeId: 'compact-primary',
    tier: 'primary',
    priority: 1,
    maxInputTokens: 1_000,
    emergencyInputTokens: 400,
  });
  const roomyPrimary = createVerifiedRouteFixture({
    routeId: 'roomy-primary',
    tier: 'primary',
    priority: 2,
    maxInputTokens: 2_000,
    emergencyInputTokens: 800,
  });

  const result = selectProviderRoute([compactPrimary, roomyPrimary], {
    role: 'seller',
    canonicalRevision: 9,
    fullContextInputTokens: 1_500,
    emergencyCapsuleInputTokens: 300,
    requiresStreaming: true,
    requiresTools: true,
    requiresStructuredArguments: true,
    routeTokenUsage: [
      { routeId: 'compact-primary', fullContextInputTokens: 900, emergencyCapsuleInputTokens: 300 },
      { routeId: 'roomy-primary', fullContextInputTokens: 1_500, emergencyCapsuleInputTokens: 300 },
    ],
  } as Parameters<typeof selectProviderRoute>[1], [runtime(compactPrimary.routeId), runtime(roomyPrimary.routeId)]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.route.routeId, 'compact-primary');
  assert.equal(result.requirements.inputTokens, 900);
});

test('route-specific usage is fail-closed on duplicate, missing, unknown, or invalid measurements', async (t) => {
  const first = createVerifiedRouteFixture({ routeId: 'route-a', tier: 'primary', priority: 1 });
  const second = createVerifiedRouteFixture({ routeId: 'route-b', tier: 'independent_fallback', priority: 1 });
  const states = [runtime(first.routeId), runtime(second.routeId)];
  const base = {
    role: 'seller' as const,
    canonicalRevision: 4,
    fullContextInputTokens: 800,
    emergencyCapsuleInputTokens: 300,
    requiresStreaming: true,
    requiresTools: true,
    requiresStructuredArguments: true,
  };

  const cases = [
    ['duplicate', [
      { routeId: 'route-a', fullContextInputTokens: 700, emergencyCapsuleInputTokens: 250 },
      { routeId: 'route-a', fullContextInputTokens: 700, emergencyCapsuleInputTokens: 250 },
    ]],
    ['missing', [
      { routeId: 'route-a', fullContextInputTokens: 700, emergencyCapsuleInputTokens: 250 },
    ]],
    ['unknown', [
      { routeId: 'route-a', fullContextInputTokens: 700, emergencyCapsuleInputTokens: 250 },
      { routeId: 'route-c', fullContextInputTokens: 700, emergencyCapsuleInputTokens: 250 },
    ]],
    ['negative', [
      { routeId: 'route-a', fullContextInputTokens: -1, emergencyCapsuleInputTokens: 250 },
      { routeId: 'route-b', fullContextInputTokens: 700, emergencyCapsuleInputTokens: 250 },
    ]],
    ['nan', [
      { routeId: 'route-a', fullContextInputTokens: Number.NaN, emergencyCapsuleInputTokens: 250 },
      { routeId: 'route-b', fullContextInputTokens: 700, emergencyCapsuleInputTokens: 250 },
    ]],
  ] as const;

  for (const [name, routeTokenUsage] of cases) {
    await t.test(name, () => {
      const result = selectProviderRoute([first, second], { ...base, routeTokenUsage }, states);
      assert.deepEqual(result, {
        ok: false,
        code: 'INVALID_ROUTE_REQUEST',
        recovery: 'deterministic_guided_discovery',
        rejections: [],
      });
    });
  }
});

test('independent fallback uses its own emergency-capsule measurement and keeps context fallback semantics', () => {
  const primary = createVerifiedRouteFixture({
    routeId: 'primary-small', tier: 'primary', priority: 1, maxInputTokens: 1_000, emergencyInputTokens: 400,
  });
  const fallback = createVerifiedRouteFixture({
    routeId: 'fallback-groq', tier: 'independent_fallback', priority: 1, maxInputTokens: 2_000, emergencyInputTokens: 600,
  });

  const result = selectProviderRoute([primary, fallback], {
    role: 'seller',
    canonicalRevision: 12,
    fullContextInputTokens: 1_500,
    emergencyCapsuleInputTokens: 900,
    requiresStreaming: true,
    requiresTools: true,
    requiresStructuredArguments: true,
    routeTokenUsage: [
      { routeId: primary.routeId, fullContextInputTokens: 1_200, emergencyCapsuleInputTokens: 300 },
      { routeId: fallback.routeId, fullContextInputTokens: 1_100, emergencyCapsuleInputTokens: 350 },
    ],
  }, [runtime(primary.routeId), runtime(fallback.routeId)]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.route.routeId, fallback.routeId);
  assert.equal(result.contextMode, 'emergency_capsule');
  assert.equal(result.requirements.inputTokens, 350);
  assert.equal(result.fallbackReason, 'PRIMARY_CONTEXT_EXCEEDED');
});
