import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCloudflarePaymentMethodsResponse } from '../../tools/provider-quality/account-cost-boundary.ts';

function envelope(result: unknown[], totalCount: number) {
  return {
    success: true,
    errors: [],
    messages: [],
    result,
    result_info: {
      page: 1,
      per_page: 1,
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

test('Cloudflare account evidence rejects missing pagination proof instead of inferring zero from an empty first page', () => {
  const evidence = evaluateCloudflarePaymentMethodsResponse({
    success: true,
    result: [],
  });
  assert.equal(evidence.valid, false);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.code, 'INVALID_RESULT_INFO');
});

test('Cloudflare account evidence rejects contradictory pagination metadata', () => {
  const evidence = evaluateCloudflarePaymentMethodsResponse(envelope([{}], 0));
  assert.equal(evidence.valid, false);
  assert.equal(evidence.pass, false);
  assert.equal(evidence.code, 'INCONSISTENT_COUNT');
});
