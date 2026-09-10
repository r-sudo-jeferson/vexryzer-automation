export interface ModelBatteryCandidate {
  readonly id: string;
  readonly label: string;
  readonly tokensPerMinute: number;
  readonly requestsPerSecond: number;
}

export const MODEL_BATTERY_INTERVAL_MS: number;
export const MODEL_CANDIDATES: readonly Readonly<ModelBatteryCandidate>[];

export function minIntervalMsForRps(requestsPerSecond: number): number;
export function validateBatteryConfiguration(): void;
export function runBattery(apiKey: string): Promise<unknown>;
