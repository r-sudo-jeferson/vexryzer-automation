import { evaluateCloudflarePaymentMethodsResponse } from './account-cost-boundary.ts';

const MAX_RESPONSE_BYTES = 64 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value || /[\r\n\0]/.test(value)) throw new TypeError('required environment is unavailable');
  return value;
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
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_RESPONSE_BYTES) {
    throw new RangeError('response exceeds bounded evidence size');
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
}

async function main(): Promise<void> {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  const token = requiredEnv('CLOUDFLARE_API_TOKEN');
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(accountId)) {
    throw new TypeError('Cloudflare account identifier is malformed');
  }

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/payment-methods?page=1&per_page=1`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: Object.freeze({
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      status: 'fail',
      candidateSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
      provider: 'cloudflare-workers-ai',
      accountScoped: true,
      endpointAccess: false,
      noRegisteredPaymentMethod: null,
      code: classifyHttpStatus(response.status),
      httpStatus: response.status,
    }, null, 2)}\n`);
    process.exitCode = 1;
    return;
  }

  const evidence = evaluateCloudflarePaymentMethodsResponse(await boundedJson(response));
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: evidence.pass ? 'pass' : 'fail',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
    provider: 'cloudflare-workers-ai',
    accountScoped: true,
    endpointAccess: true,
    noRegisteredPaymentMethod: evidence.valid ? evidence.noRegisteredPaymentMethod : null,
    registeredPaymentMethodDetected: evidence.valid ? !evidence.noRegisteredPaymentMethod : null,
    code: evidence.code,
  }, null, 2)}\n`);
  if (!evidence.pass) process.exitCode = 1;
}

main().catch(() => {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'error',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
    provider: 'cloudflare-workers-ai',
    accountScoped: true,
    endpointAccess: false,
    noRegisteredPaymentMethod: null,
    code: 'ACCOUNT_COST_PROBE_ERROR',
  }, null, 2)}\n`);
  process.exitCode = 1;
});
