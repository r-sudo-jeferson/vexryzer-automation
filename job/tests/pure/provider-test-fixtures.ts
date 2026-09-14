import type { ProviderRouteDefinition } from '../../src/ai/providers/provider-registry.ts';

export function createVerifiedRouteFixture(
  overrides: Partial<ProviderRouteDefinition> = {},
): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    routeId: 'deepseek-flash-test',
    family: 'deepseek',
    modelId: 'deepseek-flash',
    roles: Object.freeze(['seller'] as const),
    tier: 'primary',
    enabledByDefault: true,
    credentialEnvName: 'DEEPSEEK_API_KEY',
    credentialScope: 'server',
    billingAuthorization: 'PASS',
    protocolCompatibility: 'PASS',
    sellerQuality: 'PASS',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'PASS',
    capabilities: Object.freeze({
      streaming: 'PASS',
      tools: 'PASS',
      structuredArguments: 'PASS',
    } as const),
    maxInputTokens: 16_000,
    evidence: Object.freeze({ verifiedSha: 'fixture-sha', runId: 'fixture-run' }),
    ...overrides,
  });
}
