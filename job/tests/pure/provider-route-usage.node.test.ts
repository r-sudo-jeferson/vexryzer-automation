import test from 'node:test';
import assert from 'node:assert/strict';
import { selectProviderRoute } from '../../src/ai/providers/provider-router.ts';
import { createVerifiedRouteFixture } from './provider-test-fixtures.ts';

function runtime(routeId: string) {
  return { routeId, circuit: 'closed', quota: 'available' } as const;
}

const BASE_REQUEST = Object.freeze({
  role: 'seller' as const,
  canonicalRevision: 9,
  fullContextInputTokens: 900,
  requiresStreaming: true,
  requiresTools: true,
  requiresStructuredArguments: true,
});

test('single-route packed token usage binds the exact DeepSeek input measurement', () => {
  const route = createVerifiedRouteFixture({ maxInputTokens: 1_000 });
  const result = selectProviderRoute([route], {
    ...BASE_REQUEST,
    routeTokenUsage: [{
      routeId: route.routeId,
      fullContextInputTokens: 875,
    }],
  }, [runtime(route.routeId)]);

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.route.routeId, route.routeId);
  assert.equal(result.requirements.inputTokens, 875);
  assert.equal('contextMode' in result, false);
  assert.equal('fallbackReason' in result, false);
});

test('single-route token usage is fail-closed on wrong route or invalid measurement', async (t) => {
  const route = createVerifiedRouteFixture();
  const cases = [
    ['missing', []],
    ['wrong-route', [{
      routeId: 'other-route',
      fullContextInputTokens: 700,
    }]],
    ['negative', [{
      routeId: route.routeId,
      fullContextInputTokens: -1,
    }]],
    ['nan', [{
      routeId: route.routeId,
      fullContextInputTokens: Number.NaN,
    }]],
    ['plural', [
      {
        routeId: route.routeId,
        fullContextInputTokens: 700,
      },
      {
        routeId: route.routeId,
        fullContextInputTokens: 700,
      },
    ]],
  ] as const;

  for (const [name, routeTokenUsage] of cases) {
    await t.test(name, () => {
      const result = selectProviderRoute([route], { ...BASE_REQUEST, routeTokenUsage }, [runtime(route.routeId)]);
      assert.deepEqual(result, {
        ok: false,
        code: 'INVALID_ROUTE_REQUEST',
        recovery: 'deterministic_guided_discovery',
        rejections: [],
      });
    });
  }
});

test('context overflow never selects a second model', () => {
  const route = createVerifiedRouteFixture({ maxInputTokens: 1_000 });
  const result = selectProviderRoute([route], {
    ...BASE_REQUEST,
    fullContextInputTokens: 1_500,
    routeTokenUsage: [{
      routeId: route.routeId,
      fullContextInputTokens: 1_500,
    }],
  }, [runtime(route.routeId)]);

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'NO_ELIGIBLE_ROUTE');
  assert.equal(result.recovery, 'deterministic_guided_discovery');
  assert.ok(result.rejections[0]?.reasons.includes('CONTEXT_EXCEEDED'));
});
