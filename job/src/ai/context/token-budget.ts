export interface ProviderRouteBudget {
  maxInputTokens: number;
  reservedOutputTokens: number;
  emergencyInputTokens: number;
}

export type TokenEstimator = (value: unknown) => number;

export interface TokenMeasurement {
  estimatedTokens: number;
  limitTokens: number;
  fits: boolean;
}

function assertPositiveInteger(name: string, value: number): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
}

export function assertProviderRouteBudget(budget: ProviderRouteBudget): void {
  assertPositiveInteger('maxInputTokens', budget.maxInputTokens);
  if (!Number.isInteger(budget.reservedOutputTokens) || budget.reservedOutputTokens < 0) {
    throw new TypeError('reservedOutputTokens must be a non-negative integer');
  }
  assertPositiveInteger('emergencyInputTokens', budget.emergencyInputTokens);
  if (budget.reservedOutputTokens >= budget.maxInputTokens) {
    throw new TypeError('reservedOutputTokens must leave positive input capacity');
  }
  if (budget.emergencyInputTokens > budget.maxInputTokens - budget.reservedOutputTokens) {
    throw new TypeError('emergencyInputTokens cannot exceed normal available input capacity');
  }
}

export function availableInputTokens(budget: ProviderRouteBudget): number {
  assertProviderRouteBudget(budget);
  return budget.maxInputTokens - budget.reservedOutputTokens;
}

export function measureTokens(
  value: unknown,
  limitTokens: number,
  estimateTokens: TokenEstimator,
): TokenMeasurement {
  assertPositiveInteger('limitTokens', limitTokens);
  const estimatedTokens = estimateTokens(value);
  if (!Number.isFinite(estimatedTokens) || !Number.isInteger(estimatedTokens) || estimatedTokens < 0) {
    throw new TypeError('token estimator must return a non-negative integer');
  }
  return Object.freeze({ estimatedTokens, limitTokens, fits: estimatedTokens <= limitTokens });
}
