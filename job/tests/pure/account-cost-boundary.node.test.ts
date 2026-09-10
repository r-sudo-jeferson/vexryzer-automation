import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateCloudflarePaymentMethodsResponse,
  evaluateCloudflareSubscriptionsResponses,
} from '../../tools/provider-quality/account-cost-boundary.ts';

function envelope(result: unknown[], totalCount: number, page = 1, perPage = 50) {
  return {
    success: true,
    errors: [],
    messages: [],
    result,
    result_info: {
      page,
      per_page: perPage,
      count: result.length,
      total_count: totalCount,
    },
  };
}

test('Cloudflare account evidence passes only for an exact zero payment-method count', () => {
  const evidence = evaluateCloudflarePaymentMethodsResponse(envelope([], 0));
  assert.deepEqual(evidence, {
    pass: true,
    valid: true,
    noRegisteredPaymentMethod: true,
    paymentMethodCount: 0,
    code: 'PASS',
  });
});

test('Cloudflare account evidence fails closed when any payment method is registered without inspecting PII fields', () => {
  const evidence = evaluateCloudflarePaymentMethodsResponse(envelope([
    {
      id: 'opaque-method',
      first_name: 'must-not-be-consumed',
      last_four: '1234',
      payment_email: 'must-not-be-consumed@example.invalid',
    },
  ], 1));
  assert.equal(evidence.valid, true);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.noRegisteredPaymentMethod, false);
  assert.equal(evidence.paymentMethodCount, 1);
  assert.equal(evidence.code, 'PAYMENT_METHOD_PRESENT');
});

test('Cloudflare payment-method evidence rejects missing pagination proof instead of inferring zero', () => {
  const evidence = evaluateCloudflarePaymentMethodsResponse({
    success: true,
    result: [],
  });
  assert.equal(evidence.valid, false);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.code, 'INVALID_RESULT_INFO');
});

test('Cloudflare payment-method evidence rejects contradictory pagination metadata', () => {
  const evidence = evaluateCloudflarePaymentMethodsResponse(envelope([{}], 0));
  assert.equal(evidence.valid, false);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.code, 'INCONSISTENT_COUNT');
});

test('Cloudflare subscription evidence accepts only complete zero-priced free active subscriptions', () => {
  const evidence = evaluateCloudflareSubscriptionsResponses([
    envelope([
      { state: 'Provisioned', price: 0, rate_plan: { id: 'free' } },
      { state: 'Paid', price: 0, rate_plan: { id: 'partners_free' } },
      { state: 'Cancelled', price: 20, rate_plan: { id: 'pro' } },
    ], 3),
  ]);
  assert.deepEqual(evidence, {
    pass: true,
    valid: true,
    noPaidSubscription: true,
    subscriptionCount: 3,
    activeSubscriptionCount: 2,
    code: 'PASS',
  });
});

test('Cloudflare subscription evidence rejects an active priced subscription', () => {
  const evidence = evaluateCloudflareSubscriptionsResponses([
    envelope([
      { state: 'Paid', price: 20, rate_plan: { id: 'pro' } },
    ], 1),
  ]);
  assert.equal(evidence.valid, true);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.noPaidSubscription, false);
  assert.equal(evidence.code, 'PAID_SUBSCRIPTION_PRESENT');
});

test('Cloudflare subscription evidence rejects active non-free plans even when price is reported as zero', () => {
  const evidence = evaluateCloudflareSubscriptionsResponses([
    envelope([
      { state: 'Trial', price: 0, rate_plan: { id: 'business' } },
    ], 1),
  ]);
  assert.equal(evidence.valid, true);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.code, 'PAID_SUBSCRIPTION_PRESENT');
});

test('Cloudflare subscription evidence fails closed when active billing fields are missing', () => {
  const evidence = evaluateCloudflareSubscriptionsResponses([
    envelope([
      { state: 'Provisioned', rate_plan: { id: 'free' } },
    ], 1),
  ]);
  assert.equal(evidence.valid, false);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.code, 'UNVERIFIABLE_ACTIVE_SUBSCRIPTION');
});

test('Cloudflare subscription evidence requires a complete consistent page set', () => {
  const first = envelope(
    Array.from({ length: 50 }, () => ({ state: 'Cancelled' })),
    51,
    1,
    50,
  );
  const evidence = evaluateCloudflareSubscriptionsResponses([first]);
  assert.equal(evidence.valid, false);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.subscriptionCount, 51);
  assert.equal(evidence.code, 'INCOMPLETE_PAGINATION');
});

test('Cloudflare subscription evidence rejects pagination drift between pages', () => {
  const evidence = evaluateCloudflareSubscriptionsResponses([
    envelope([{ state: 'Cancelled' }], 2, 1, 1),
    envelope([{ state: 'Cancelled' }], 3, 2, 1),
  ]);
  assert.equal(evidence.valid, false);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.code, 'INCONSISTENT_PAGINATION');
});
