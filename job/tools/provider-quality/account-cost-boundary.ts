export type CloudflarePaymentMethodEvidenceCode =
  | 'PASS'
  | 'INVALID_ENVELOPE'
  | 'INVALID_RESULT_INFO'
  | 'INCONSISTENT_COUNT'
  | 'PAYMENT_METHOD_PRESENT';

export interface CloudflarePaymentMethodEvidence {
  pass: boolean;
  valid: boolean;
  noRegisteredPaymentMethod: boolean;
  paymentMethodCount: number | null;
  code: CloudflarePaymentMethodEvidenceCode;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number' && value >= 0;
}

/**
 * Evaluates only the bounded facts needed by the S002 zero-payment gate.
 *
 * Deliberately ignores payment-method fields such as names, addresses, card
 * fragments and gateway metadata. Callers must never persist or emit the raw
 * Cloudflare billing response.
 */
export function evaluateCloudflarePaymentMethodsResponse(
  value: unknown,
): Readonly<CloudflarePaymentMethodEvidence> {
  if (
    !isRecord(value)
    || value['success'] !== true
    || !Array.isArray(value['result'])
  ) {
    return Object.freeze({
      pass: false,
      valid: false,
      noRegisteredPaymentMethod: false,
      paymentMethodCount: null,
      code: 'INVALID_ENVELOPE' as const,
    });
  }

  const resultInfo = value['result_info'];
  if (!isRecord(resultInfo) || !nonNegativeInteger(resultInfo['total_count'])) {
    return Object.freeze({
      pass: false,
      valid: false,
      noRegisteredPaymentMethod: false,
      paymentMethodCount: null,
      code: 'INVALID_RESULT_INFO' as const,
    });
  }

  const totalCount = resultInfo['total_count'];
  if (totalCount < value['result'].length) {
    return Object.freeze({
      pass: false,
      valid: false,
      noRegisteredPaymentMethod: false,
      paymentMethodCount: null,
      code: 'INCONSISTENT_COUNT' as const,
    });
  }

  const noRegisteredPaymentMethod = totalCount === 0 && value['result'].length === 0;
  return Object.freeze({
    pass: noRegisteredPaymentMethod,
    valid: true,
    noRegisteredPaymentMethod,
    paymentMethodCount: totalCount,
    code: noRegisteredPaymentMethod ? 'PASS' as const : 'PAYMENT_METHOD_PRESENT' as const,
  });
}
