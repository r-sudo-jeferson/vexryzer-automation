import type { CanonicalSalesContext } from '../context/canonical-sales-context.ts';

export type QuantitativeClaim =
  | { kind: 'verified_result'; calculationId: string }
  | { kind: 'savings'; calculationId: string }
  | { kind: 'roi'; calculationId: string }
  | { kind: 'payback'; calculationId: string }
  | { kind: 'productivity_gain'; calculationId: string };

export type QuantitativeClaimValidation =
  | { ok: true }
  | { ok: false; code: 'CALCULATION_NOT_FOUND' | 'INVALIDATED_CALCULATION' | 'UNSUPPORTED_CLAIM' };

export function validateQuantitativeClaim(
  context: CanonicalSalesContext,
  claim: QuantitativeClaim,
): QuantitativeClaimValidation {
  const calculation = context.verifiedCalculations.find((item) => item.id === claim.calculationId);
  if (calculation === undefined) return { ok: false, code: 'CALCULATION_NOT_FOUND' };
  if (calculation.status !== 'valid') return { ok: false, code: 'INVALIDATED_CALCULATION' };
  if (claim.kind !== 'verified_result') return { ok: false, code: 'UNSUPPORTED_CLAIM' };
  return { ok: true };
}
