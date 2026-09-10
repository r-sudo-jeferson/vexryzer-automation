export type CloudflarePaymentMethodEvidenceCode =
  | 'PASS'
  | 'INVALID_ENVELOPE'
  | 'INVALID_RESULT_INFO'
  | 'INCONSISTENT_COUNT'
  | 'PAYMENT_METHOD_PRESENT';

export type CloudflareSubscriptionEvidenceCode =
  | 'PASS'
  | 'INVALID_ENVELOPE'
  | 'INVALID_RESULT_INFO'
  | 'INCONSISTENT_PAGINATION'
  | 'INCOMPLETE_PAGINATION'
  | 'UNVERIFIABLE_ACTIVE_SUBSCRIPTION'
  | 'PAID_SUBSCRIPTION_PRESENT';

export interface CloudflarePaymentMethodEvidence {
  pass: boolean;
  valid: boolean;
  noRegisteredPaymentMethod: boolean;
  paymentMethodCount: number | null;
  code: CloudflarePaymentMethodEvidenceCode;
}

export interface CloudflareSubscriptionEvidence {
  pass: boolean;
  valid: boolean;
  noPaidSubscription: boolean;
  subscriptionCount: number | null;
  activeSubscriptionCount: number | null;
  code: CloudflareSubscriptionEvidenceCode;
}

interface PaginationInfo {
  page: number;
  perPage: number;
  count: number;
  totalCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function positiveInteger(value: unknown): value is number {
  return nonNegativeInteger(value) && value > 0;
}

function parsePagination(value: unknown): PaginationInfo | null {
  if (!isRecord(value)) return null;
  const page = value['page'];
  const perPage = value['per_page'];
  const count = value['count'];
  const totalCount = value['total_count'];
  if (
    !positiveInteger(page)
    || !positiveInteger(perPage)
    || !nonNegativeInteger(count)
    || !nonNegativeInteger(totalCount)
  ) {
    return null;
  }
  return { page, perPage, count, totalCount };
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

  const pagination = parsePagination(value['result_info']);
  if (pagination === null) {
    return Object.freeze({
      pass: false,
      valid: false,
      noRegisteredPaymentMethod: false,
      paymentMethodCount: null,
      code: 'INVALID_RESULT_INFO' as const,
    });
  }

  if (
    pagination.count !== value['result'].length
    || pagination.totalCount < pagination.count
  ) {
    return Object.freeze({
      pass: false,
      valid: false,
      noRegisteredPaymentMethod: false,
      paymentMethodCount: null,
      code: 'INCONSISTENT_COUNT' as const,
    });
  }

  const noRegisteredPaymentMethod = pagination.totalCount === 0 && pagination.count === 0;
  return Object.freeze({
    pass: noRegisteredPaymentMethod,
    valid: true,
    noRegisteredPaymentMethod,
    paymentMethodCount: pagination.totalCount,
    code: noRegisteredPaymentMethod ? 'PASS' as const : 'PAYMENT_METHOD_PRESENT' as const,
  });
}

function activeSubscriptionState(value: unknown): boolean | null {
  if (value === 'Cancelled' || value === 'Failed' || value === 'Expired') return false;
  if (value === 'Trial' || value === 'Provisioned' || value === 'Paid' || value === 'AwaitingPayment') {
    return true;
  }
  return null;
}

function verifiedFreeActiveSubscription(value: unknown): boolean | null {
  if (!isRecord(value)) return null;
  const active = activeSubscriptionState(value['state']);
  if (active === null) return null;
  if (!active) return true;

  const price = value['price'];
  const ratePlan = value['rate_plan'];
  if (
    typeof price !== 'number'
    || !Number.isFinite(price)
    || price < 0
    || !isRecord(ratePlan)
    || typeof ratePlan['id'] !== 'string'
  ) {
    return null;
  }
  return price === 0 && (ratePlan['id'] === 'free' || ratePlan['id'] === 'partners_free');
}

/**
 * Requires a complete, internally consistent page set. Active subscriptions
 * pass only when Cloudflare explicitly reports a zero price and a free rate
 * plan. Missing/unknown fields remain NOT_VERIFIED rather than being inferred.
 */
export function evaluateCloudflareSubscriptionsResponses(
  pages: readonly unknown[],
): Readonly<CloudflareSubscriptionEvidence> {
  if (pages.length === 0) {
    return Object.freeze({
      pass: false,
      valid: false,
      noPaidSubscription: false,
      subscriptionCount: null,
      activeSubscriptionCount: null,
      code: 'INVALID_ENVELOPE' as const,
    });
  }

  let expectedTotal: number | null = null;
  let expectedPerPage: number | null = null;
  let totalObserved = 0;
  let activeCount = 0;
  let paidDetected = false;

  for (let index = 0; index < pages.length; index += 1) {
    const pageValue = pages[index];
    if (
      !isRecord(pageValue)
      || pageValue['success'] !== true
      || !Array.isArray(pageValue['result'])
    ) {
      return Object.freeze({
        pass: false,
        valid: false,
        noPaidSubscription: false,
        subscriptionCount: null,
        activeSubscriptionCount: null,
        code: 'INVALID_ENVELOPE' as const,
      });
    }

    const pagination = parsePagination(pageValue['result_info']);
    if (pagination === null) {
      return Object.freeze({
        pass: false,
        valid: false,
        noPaidSubscription: false,
        subscriptionCount: null,
        activeSubscriptionCount: null,
        code: 'INVALID_RESULT_INFO' as const,
      });
    }

    if (
      pagination.page !== index + 1
      || pagination.count !== pageValue['result'].length
      || pagination.totalCount < pagination.count
      || (expectedTotal !== null && pagination.totalCount !== expectedTotal)
      || (expectedPerPage !== null && pagination.perPage !== expectedPerPage)
    ) {
      return Object.freeze({
        pass: false,
        valid: false,
        noPaidSubscription: false,
        subscriptionCount: null,
        activeSubscriptionCount: null,
        code: 'INCONSISTENT_PAGINATION' as const,
      });
    }

    expectedTotal ??= pagination.totalCount;
    expectedPerPage ??= pagination.perPage;
    totalObserved += pageValue['result'].length;

    for (const subscription of pageValue['result']) {
      if (!isRecord(subscription)) {
        return Object.freeze({
          pass: false,
          valid: false,
          noPaidSubscription: false,
          subscriptionCount: null,
          activeSubscriptionCount: null,
          code: 'UNVERIFIABLE_ACTIVE_SUBSCRIPTION' as const,
        });
      }
      const active = activeSubscriptionState(subscription['state']);
      if (active === null) {
        return Object.freeze({
          pass: false,
          valid: false,
          noPaidSubscription: false,
          subscriptionCount: null,
          activeSubscriptionCount: null,
          code: 'UNVERIFIABLE_ACTIVE_SUBSCRIPTION' as const,
        });
      }
      if (!active) continue;
      activeCount += 1;
      const free = verifiedFreeActiveSubscription(subscription);
      if (free === null) {
        return Object.freeze({
          pass: false,
          valid: false,
          noPaidSubscription: false,
          subscriptionCount: null,
          activeSubscriptionCount: null,
          code: 'UNVERIFIABLE_ACTIVE_SUBSCRIPTION' as const,
        });
      }
      if (!free) paidDetected = true;
    }
  }

  if (expectedTotal === null || totalObserved !== expectedTotal) {
    return Object.freeze({
      pass: false,
      valid: false,
      noPaidSubscription: false,
      subscriptionCount: expectedTotal,
      activeSubscriptionCount: activeCount,
      code: 'INCOMPLETE_PAGINATION' as const,
    });
  }

  return Object.freeze({
    pass: !paidDetected,
    valid: true,
    noPaidSubscription: !paidDetected,
    subscriptionCount: expectedTotal,
    activeSubscriptionCount: activeCount,
    code: paidDetected ? 'PAID_SUBSCRIPTION_PRESENT' as const : 'PASS' as const,
  });
}
