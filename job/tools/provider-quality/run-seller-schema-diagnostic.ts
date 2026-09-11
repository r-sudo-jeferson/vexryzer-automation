import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ProviderRouteDefinition } from '../../src/ai/providers/provider-registry.ts';
import {
  buildServerChatHttpRequest,
  type LocalFunctionTool,
} from '../../src/server/ai/providers/openai-chat-wire.ts';
import { SELLER_LOCAL_TOOLS } from '../../src/server/ai/seller/seller-wire-tools.ts';

const MAX_ERROR_BODY_BYTES = 16_384;
const REQUEST_TIMEOUT_MS = 30_000;
const REQUEST_START_SPACING_MS = 3_000;

const simpleControlTool: LocalFunctionTool = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'capture_signal',
    description: 'Capture one diagnostic signal.',
    parameters: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({ value: Object.freeze({ type: 'string' }) }),
      required: Object.freeze(['value']),
    }),
  }),
});

export interface SellerSchemaDiagnosticCase {
  id: string;
  tools: readonly LocalFunctionTool[];
}

function transformSchema(value: unknown, option: 'without_one_of' | 'without_descriptions'): unknown {
  if (Array.isArray(value)) return Object.freeze(value.map((item) => transformSchema(item, option)));
  if (typeof value !== 'object' || value === null) return value;
  const source = value as Readonly<Record<string, unknown>>;
  if (option === 'without_one_of' && Array.isArray(source['oneOf'])) {
    const preferred = source['oneOf'].find((item) => (
      typeof item === 'object'
      && item !== null
      && !Array.isArray(item)
      && (item as Record<string, unknown>)['type'] !== 'null'
    ));
    return transformSchema(preferred ?? source['oneOf'][0] ?? {}, option);
  }
  const transformed: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(source)) {
    if (option === 'without_descriptions' && key === 'description') continue;
    transformed[key] = transformSchema(nested, option);
  }
  return Object.freeze(transformed);
}

function transformTool(tool: LocalFunctionTool, option: 'without_one_of' | 'without_descriptions'): LocalFunctionTool {
  const transformed = transformSchema(tool, option);
  if (typeof transformed !== 'object' || transformed === null || Array.isArray(transformed)) {
    throw new TypeError('diagnostic tool transform failed');
  }
  return transformed as LocalFunctionTool;
}

export function buildSellerSchemaDiagnosticCases(): readonly Readonly<SellerSchemaDiagnosticCase>[] {
  const capture = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'capture_user_observations');
  const calculation = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'request_calculations');
  const submit = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'submit_seller_submission');
  if (capture === undefined || calculation === undefined || submit === undefined) {
    throw new TypeError('complete Seller tool set is required for schema diagnostics');
  }
  return Object.freeze([
    Object.freeze({ id: 'simple-control', tools: Object.freeze([simpleControlTool]) }),
    Object.freeze({ id: 'capture-calculation-only', tools: Object.freeze([capture, calculation]) }),
    Object.freeze({ id: 'submit-only-complete', tools: Object.freeze([submit]) }),
    Object.freeze({ id: 'submit-without-one-of', tools: Object.freeze([transformTool(submit, 'without_one_of')]) }),
    Object.freeze({ id: 'submit-without-descriptions', tools: Object.freeze([transformTool(submit, 'without_descriptions')]) }),
    Object.freeze({ id: 'complete-tools', tools: SELLER_LOCAL_TOOLS }),
  ]);
}

const ERROR_SIGNALS = Object.freeze([
  ['invalid', /\binvalid\b/i],
  ['one_of', /\bone[_\s-]?of\b/i],
  ['schema', /\bschema\b/i],
  ['tools', /\btools?\b/i],
  ['unsupported', /\b(?:unsupported|not\s+supported)\b/i],
  ['additional_properties', /\badditional[_\s-]?properties\b/i],
  ['context', /\bcontext\b/i],
  ['description', /\bdescription\b/i],
  ['enum', /\benum\b/i],
  ['max_items', /\bmax[_\s-]?items\b/i],
  ['properties', /\bproperties\b/i],
  ['required', /\brequired\b/i],
  ['token', /\btokens?\b/i],
  ['too_large', /\btoo[_\s-]?(?:large|long|many)\b/i],
  ['type', /\btype\b/i],
] as const);

function collectErrorCodes(value: unknown, output = new Set<string>()): ReadonlySet<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectErrorCodes(item, output);
    return output;
  }
  if (typeof value !== 'object' || value === null) return output;
  for (const [key, nested] of Object.entries(value)) {
    if (key === 'code' && (typeof nested === 'string' || typeof nested === 'number')) {
      const code = String(nested);
      if (/^[A-Za-z0-9_.:-]{1,64}$/.test(code)) output.add(code);
    } else {
      collectErrorCodes(nested, output);
    }
  }
  return output;
}

export function classifyProviderSchemaError(body: string) {
  const encoded = new TextEncoder().encode(body);
  const boundedBytes = encoded.slice(0, MAX_ERROR_BODY_BYTES);
  const bounded = new TextDecoder('utf-8', { fatal: false }).decode(boundedBytes);
  let parsed: unknown = null;
  let jsonObject = false;
  try {
    parsed = JSON.parse(bounded) as unknown;
    jsonObject = typeof parsed === 'object' && parsed !== null;
  } catch {
    parsed = null;
  }
  return Object.freeze({
    responseBytes: encoded.byteLength,
    truncated: encoded.byteLength > MAX_ERROR_BODY_BYTES,
    jsonObject,
    errorCodes: Object.freeze([...collectErrorCodes(parsed)].sort()),
    signals: Object.freeze(ERROR_SIGNALS.filter(([, pattern]) => pattern.test(bounded)).map(([name]) => name)),
  });
}

async function readBoundedBody(response: Response): Promise<string> {
  if (response.body === null) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total <= MAX_ERROR_BODY_BYTES) {
    const next = await reader.read();
    if (next.done) break;
    const chunk = next.value;
    chunks.push(chunk);
    total += chunk.byteLength;
    if (total > MAX_ERROR_BODY_BYTES) {
      await reader.cancel();
      break;
    }
  }
  const bounded = new Uint8Array(Math.min(total, MAX_ERROR_BODY_BYTES));
  let offset = 0;
  for (const chunk of chunks) {
    const remaining = bounded.byteLength - offset;
    if (remaining <= 0) break;
    const slice = chunk.subarray(0, remaining);
    bounded.set(slice, offset);
    offset += slice.byteLength;
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(bounded);
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value || /[\r\n\0]/.test(value)) throw new TypeError(`${name} is required`);
  return value;
}

function diagnosticRoute(): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    routeId: 'diagnostic-cloudflare-glm-seller',
    family: 'cloudflare_workers_ai',
    modelId: '@cf/zai-org/glm-4.7-flash',
    roles: Object.freeze(['seller' as const]),
    tier: 'primary',
    enabledByDefault: false,
    credentialEnvName: 'CLOUDFLARE_API_TOKEN',
    credentialScope: 'server',
    noPaymentEligibility: 'NOT_VERIFIED',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_VERIFIED',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'NOT_VERIFIED',
    capabilities: Object.freeze({ streaming: 'NOT_VERIFIED', tools: 'NOT_VERIFIED', structuredArguments: 'NOT_VERIFIED' }),
    maxInputTokens: null,
    emergencyInputTokens: null,
    evidence: null,
  });
}

function countSchemaKey(value: unknown, key: string): number {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countSchemaKey(item, key), 0);
  if (typeof value !== 'object' || value === null) return 0;
  return Object.entries(value).reduce(
    (sum, [nestedKey, nested]) => sum + (nestedKey === key ? 1 : 0) + countSchemaKey(nested, key),
    0,
  );
}

async function runDiagnostic() {
  const accountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  const token = requiredEnv('CLOUDFLARE_API_TOKEN');
  const route = diagnosticRoute();
  const results = [];
  let previousStart = 0;

  for (const item of buildSellerSchemaDiagnosticCases()) {
    const waitMs = REQUEST_START_SPACING_MS - (Date.now() - previousStart);
    if (waitMs > 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, waitMs));
    previousStart = Date.now();
    const request = buildServerChatHttpRequest({
      route,
      serverConfig: Object.freeze({ cloudflareAccountId: accountId }),
      apiToken: token,
      messages: Object.freeze([
        Object.freeze({ role: 'system' as const, content: 'Call one available local function exactly once and emit no free text.' }),
        Object.freeze({ role: 'user' as const, content: 'Exercise the available local function with the smallest schema-valid arguments.' }),
      ]),
      tools: item.tools,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: controller.signal,
      });
      if (response.ok) {
        await response.body?.cancel();
        results.push(Object.freeze({
          id: item.id,
          accepted: true,
          httpStatus: response.status,
          toolCount: item.tools.length,
          schemaBytes: new TextEncoder().encode(JSON.stringify(item.tools)).byteLength,
          oneOfCount: countSchemaKey(item.tools, 'oneOf'),
          descriptionCount: countSchemaKey(item.tools, 'description'),
        }));
      } else {
        const body = await readBoundedBody(response);
        results.push(Object.freeze({
          id: item.id,
          accepted: false,
          httpStatus: response.status,
          toolCount: item.tools.length,
          schemaBytes: new TextEncoder().encode(JSON.stringify(item.tools)).byteLength,
          oneOfCount: countSchemaKey(item.tools, 'oneOf'),
          descriptionCount: countSchemaKey(item.tools, 'description'),
          error: classifyProviderSchemaError(body),
        }));
      }
    } catch (error) {
      results.push(Object.freeze({
        id: item.id,
        accepted: false,
        httpStatus: null,
        toolCount: item.tools.length,
        schemaBytes: new TextEncoder().encode(JSON.stringify(item.tools)).byteLength,
        oneOfCount: countSchemaKey(item.tools, 'oneOf'),
        descriptionCount: countSchemaKey(item.tools, 'description'),
        transportClass: error instanceof DOMException && error.name === 'AbortError' ? 'timeout' : 'network',
      }));
    } finally {
      clearTimeout(timeout);
    }
  }

  const byId = new Map(results.map((item) => [item.id, item] as const));
  const rootCause = byId.get('simple-control')?.accepted === true
    && byId.get('capture-calculation-only')?.accepted === true
    && byId.get('submit-only-complete')?.accepted === false
    && byId.get('submit-without-one-of')?.accepted === true
    ? 'ONE_OF_UNSUPPORTED_IN_SUBMIT_SCHEMA'
    : byId.get('simple-control')?.accepted === true
      && byId.get('submit-only-complete')?.accepted === false
      && byId.get('submit-without-descriptions')?.accepted === true
      ? 'DESCRIPTION_REJECTED_IN_SUBMIT_SCHEMA'
      : byId.get('submit-only-complete')?.accepted === true
        && byId.get('complete-tools')?.accepted === false
        ? 'COMPLETE_TOOL_COMPOSITION_REJECTED'
        : 'NOT_ISOLATED';

  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'complete',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-diagnostic',
    rawProviderPayloadsEmitted: false,
    rootCause,
    results,
  }, null, 2)}\n`);
}

const invokedPath = process.argv[1] === undefined ? null : pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  runDiagnostic().catch((error) => {
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      status: 'error',
      candidateSha: process.env.GITHUB_SHA?.trim() || 'local-diagnostic',
      errorClass: error instanceof Error ? error.name : 'UnknownError',
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}
