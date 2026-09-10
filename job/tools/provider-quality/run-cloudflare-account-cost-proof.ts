import {
  evaluateCloudflarePaymentMethodsResponse,
  evaluateCloudflareSubscriptionsResponses,
} from './account-cost-boundary.ts';

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const SUBSCRIPTIONS_PER_PAGE = 50;
const MAX_SUBSCRIPTION_PAGES = 20;

interface HttpProbe {
  ok: boolean;
  endpointAccess: boolean;
  code: string;
  httpStatus: number | null;
  body: unknown | null;
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value || /[\r\n\0]/.test(value)) throw new TypeError('required environment is unavailable');
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function classifyHttpStatus(status: number): string {
  if (status === 401) return 'AUTHENTICATION_FAILED';
  if (status === 403) return 'BILLING_READ_PERMISSION_REQUIRED';
  if (status === 429) return 'RATE_LIMITED';
  if (status >= 500) return 'PROVIDER_UNAVAILABLE';
  return 'HTTP_REJECTED';
}

async function boundedJson(response: Response): Promise<unknown> {
  const contentLength = response.headers.get('content-length');
  if (contentLength !== null) {
    const parsed = Number(contentLength);
    if (Number.isFinite(parsed) && parsed > MAX_RESPONSE_BYTES) {
      throw new RangeError('response exceeds bounded evidence size');
    }
  }
  if (response.body === null) throw new TypeError('response body is unavailable');

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const chunk = await reader.read();
    if (chunk.done) break;
    totalBytes += chunk.value.byteLength;
    if (totalBytes > MAX_RESPONSE_BYTES) {
      await reader.cancel();
      throw new RangeError('response exceeds bounded evidence size');
    }
    chunks.push(chunk.value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

async function requestJson(url: string, token: string): Promise<HttpProbe> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: Object.freeze({
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return {
      ok: false,
      endpointAccess: false,
      code: 'NETWORK_OR_TIMEOUT',
      httpStatus: null,
      body: null,
    };
  }

  if (!response.ok) {
    return {
      ok: false,
      endpointAccess: false,
      code: classifyHttpStatus(response.status),
      httpStatus: response.status,
      body: null,
    };
  }

  try {
    return {
      ok: true,
      endpointAccess: true,
      code: 'PASS',
      httpStatus: response.status,
      body: await boundedJson(response),
    };
  } catch {
    return {
      ok: false,
      endpointAccess: true,
      code: 'INVALID_OR_OVERSIZED_RESPONSE',
      httpStatus: response.status,
      body: null,
    };
  }
}

function subscriptionPagination(value: unknown): { totalCount: number; perPage: number } | null {
  if (!isRecord(value) || !isRecord(value['result_info'])) return null;
  const totalCount = value['result_info']['total_count'];
  const perPage = value['result_info']['per_page'];
  if (!nonNegativeInteger(totalCount) || !positiveInteger(perPage)) return null;
  return { totalCount, perPage };
}

async function paymentMethodProof(
  accountId: string,
  token: string,
): Promise<Readonly<Record<string, unknown>>> {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/payment-methods?page=1&per_page=50`;
  const probe = await requestJson(endpoint, token);
  if (!probe.ok || probe.body === null) {
    return Object.freeze({
      pass: false,
      endpointAccess: probe.endpointAccess,
      noRegisteredPaymentMethod: null,
      registeredPaymentMethodDetected: null,
      code: probe.code,
      httpStatus: probe.httpStatus,
    });
  }

  const evidence = evaluateCloudflarePaymentMethodsResponse(probe.body);
  return Object.freeze({
    pass: evidence.pass,
    endpointAccess: true,
    noRegisteredPaymentMethod: evidence.valid ? evidence.noRegisteredPaymentMethod : null,
    registeredPaymentMethodDetected: evidence.valid ? !evidence.noRegisteredPaymentMethod : null,
    code: evidence.code,
    httpStatus: probe.httpStatus,
  });
}

async function subscriptionProof(
  accountId: string,
  token: string,
): Promise<Readonly<Record<string, unknown>>> {
  const base = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/subscriptions`;
  const firstProbe = await requestJson(`${base}?page=1&per_page=${SUBSCRIPTIONS_PER_PAGE}`, token);
  if (!firstProbe.ok || firstProbe.body === null) {
    return Object.freeze({
      pass: false,
      endpointAccess: firstProbe.endpointAccess,
      noPaidSubscription: null,
      paidSubscriptionDetected: null,
      code: firstProbe.code,
      httpStatus: firstProbe.httpStatus,
    });
  }

  const pagination = subscriptionPagination(firstProbe.body);
  if (pagination === null) {
    return Object.freeze({
      pass: false,
      endpointAccess: true,
      noPaidSubscription: null,
      paidSubscriptionDetected: null,
      code: 'INVALID_RESULT_INFO',
      httpStatus: firstProbe.httpStatus,
    });
  }

  const pageCount = Math.max(1, Math.ceil(pagination.totalCount / pagination.perPage));
  if (pageCount > MAX_SUBSCRIPTION_PAGES) {
    return Object.freeze({
      pass: false,
      endpointAccess: true,
      noPaidSubscription: null,
      paidSubscriptionDetected: null,
      code: 'SUBSCRIPTION_PAGE_LIMIT_EXCEEDED',
      httpStatus: firstProbe.httpStatus,
    });
  }

  const pages: unknown[] = [firstProbe.body];
  for (let page = 2; page <= pageCount; page += 1) {
    const probe = await requestJson(`${base}?page=${page}&per_page=${pagination.perPage}`, token);
    if (!probe.ok || probe.body === null) {
      return Object.freeze({
        pass: false,
        endpointAccess: probe.endpointAccess,
        noPaidSubscription: null,
        paidSubscriptionDetected: null,
        code: probe.code,
        httpStatus: probe.httpStatus,
      });
    }
    pages.push(probe.body);
  }

  const evidence = evaluateCloudflareSubscriptionsResponses(pages);
  return Object.freeze({
    pass: evidence.pass,
    endpointAccess: true,
    noPaidSubscription: evidence.valid ? evidence.noPaidSubscription : null,
    paidSubscriptionDetected: evidence.valid ? !evidence.noPaidSubscription : null,
    code: evidence.code,
    httpStatus: firstProbe.httpStatus,
  });
}

async function main(): Promise<void> {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  const token = requiredEnv('CLOUDFLARE_API_TOKEN');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(accountId)) {
    throw new TypeError('Cloudflare account identifier is malformed');
  }

  const [paymentMethods, subscriptions] = await Promise.all([
    paymentMethodProof(accountId, token),
    subscriptionProof(accountId, token),
  ]);
  const pass = paymentMethods['pass'] === true && subscriptions['pass'] === true;

  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: pass ? 'pass' : 'fail',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
    provider: 'cloudflare-workers-ai',
    accountScoped: true,
    billingReadAccessible: paymentMethods['endpointAccess'] === true
      && subscriptions['endpointAccess'] === true,
    noRegisteredPaymentMethod: paymentMethods['noRegisteredPaymentMethod'] ?? null,
    registeredPaymentMethodDetected: paymentMethods['registeredPaymentMethodDetected'] ?? null,
    noPaidSubscription: subscriptions['noPaidSubscription'] ?? null,
    paidSubscriptionDetected: subscriptions['paidSubscriptionDetected'] ?? null,
    paymentMethodProofCode: paymentMethods['code'],
    subscriptionProofCode: subscriptions['code'],
  }, null, 2)}\n`);
  if (!pass) process.exitCode = 1;
}

main().catch(() => {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'error',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
    provider: 'cloudflare-workers-ai',
    accountScoped: true,
    billingReadAccessible: false,
    noRegisteredPaymentMethod: null,
    registeredPaymentMethodDetected: null,
    noPaidSubscription: null,
    paidSubscriptionDetected: null,
    paymentMethodProofCode: 'ACCOUNT_COST_PROBE_ERROR',
    subscriptionProofCode: 'ACCOUNT_COST_PROBE_ERROR',
  }, null, 2)}\n`);
  process.exitCode = 1;
});
