export interface WorkshopProviderCompatibility {
  harnessVersion: string;
  providerRoute: string;
  modelId: string;
  streaming: boolean;
  toolCalls: boolean;
  multiTurnToolReplay: boolean;
  structuredArguments: boolean;
  timeoutMapped: boolean;
  restartSafe: boolean;
}

const REQUIRED_CAPABILITIES = [
  'streaming',
  'toolCalls',
  'multiTurnToolReplay',
  'structuredArguments',
  'timeoutMapped',
  'restartSafe',
] as const satisfies readonly (keyof WorkshopProviderCompatibility)[];

type RequiredCapability = (typeof REQUIRED_CAPABILITIES)[number];

export function assertWorkshopProviderCompatibility(
  result: WorkshopProviderCompatibility,
): asserts result is WorkshopProviderCompatibility {
  if (!result.harnessVersion.trim()) throw new TypeError('harnessVersion is required');
  if (!result.providerRoute.trim()) throw new TypeError('providerRoute is required');
  if (!result.modelId.trim()) throw new TypeError('modelId is required');

  for (const capability of REQUIRED_CAPABILITIES) {
    if (result[capability] !== true) {
      throw new Error(`Workshop provider compatibility failed: ${capability}`);
    }
  }
}

export function summarizeWorkshopProviderCompatibility(result: WorkshopProviderCompatibility): {
  harnessVersion: string;
  providerRoute: string;
  modelId: string;
  compatible: true;
  verifiedCapabilities: RequiredCapability[];
} {
  assertWorkshopProviderCompatibility(result);
  return {
    harnessVersion: result.harnessVersion,
    providerRoute: result.providerRoute,
    modelId: result.modelId,
    compatible: true,
    verifiedCapabilities: [...REQUIRED_CAPABILITIES],
  };
}
