import type { ProviderRouteDefinition } from '../../src/ai/providers/provider-registry.ts';

export function createVerifiedRouteFixture(
  overrides: Partial<ProviderRouteDefinition> = {},
): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    routeId: 'deepseek-v4-pro-test',
    family: 'deepseek',
    modelId: 'deepseek-v4-pro',
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
    emergencyInputTokens: 4_000,
    evidence: Object.freeze({ verifiedSha: 'fixture-sha', runId: 'fixture-run' }),
    ...overrides,
  });
}
