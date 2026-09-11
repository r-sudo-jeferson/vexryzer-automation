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

function syntheticTool(name: string, parameters: Readonly<Record<string, unknown>>): LocalFunctionTool {
  return Object.freeze({
    type: 'function' as const,
    function: Object.freeze({
      name,
      description: 'Exercise one synthetic schema dimension.',
      parameters,
    }),
  });
}

function buildDeepSchema(levels: number): Readonly<Record<string, unknown>> {
  let nested: Readonly<Record<string, unknown>> = Object.freeze({ type: 'string' });
  for (let index = 0; index < levels; index += 1) {
    nested = Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({ value: nested }),
      required: Object.freeze(['value']),
    });
  }
  return nested;
}

const deepSimpleControlTool = syntheticTool('capture_deep_signal', buildDeepSchema(7));

const wideProperties = Object.freeze(Object.fromEntries(
  Array.from({ length: 125 }, (_, index) => [`value_${String(index).padStart(3, '0')}`, Object.freeze({ type: 'string' })]),
));
const wideSimpleControlTool = syntheticTool('capture_wide_signal', Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: wideProperties,
  required: Object.freeze(Object.keys(wideProperties)),
}));

export interface SellerSchemaDiagnosticCase {
  id: string;
  tools: readonly LocalFunctionTool[];
}

type SchemaTransform = 'without_one_of' | 'without_descriptions' | 'without_unique_items';

function transformSchema(value: unknown, option: SchemaTransform): unknown {
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
    if (option === 'without_unique_items' && key === 'uniqueItems') continue;
    transformed[key] = transformSchema(nested, option);
  }
  return Object.freeze(transformed);
}

function transformTool(tool: LocalFunctionTool, option: SchemaTransform): LocalFunctionTool {
  const transformed = transformSchema(tool.function.parameters, option);
  if (typeof transformed !== 'object' || transformed === null || Array.isArray(transformed)) {
    throw new TypeError('diagnostic tool transform failed');
  }
  const parameters = transformed as Readonly<Record<string, unknown>>;
  return Object.freeze({
    type: 'function' as const,
    function: Object.freeze({
      name: tool.function.name,
      description: tool.function.description,
      parameters,
    }),
  });
}

function schemaObject(value: unknown, path: string): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`${path} must be a schema object`);
  }
  return value as Readonly<Record<string, unknown>>;
}

function selectClosedProperties(
  schema: Readonly<Record<string, unknown>>,
  selectedNames: readonly string[],
): Readonly<Record<string, unknown>> {
  const properties = schemaObject(schema['properties'], 'properties');
  const selected = Object.fromEntries(selectedNames.map((name) => {
    if (!(name in properties)) throw new TypeError(`missing diagnostic property: ${name}`);
    return [name, properties[name]];
  }));
  const required = Array.isArray(schema['required'])
    ? schema['required'].filter((name): name is string => typeof name === 'string' && selectedNames.includes(name))
    : [];
  return Object.freeze({
    ...schema,
    properties: Object.freeze(selected),
    required: Object.freeze(required),
  });
}

function buildSubmitSubsetTool(
  submit: LocalFunctionTool,
  submissionFields: readonly string[],
  proposalFields?: readonly string[],
  intentFields?: readonly string[],
): LocalFunctionTool {
  const parameters = schemaObject(submit.function.parameters, 'parameters');
  const parameterProperties = schemaObject(parameters['properties'], 'parameters.properties');
  let submission = schemaObject(parameterProperties['submission'], 'submission');
  if (proposalFields !== undefined) {
    const submissionProperties = schemaObject(submission['properties'], 'submission.properties');
    let proposal = schemaObject(submissionProperties['proposal'], 'proposal');
    if (intentFields !== undefined) {
      const proposalProperties = schemaObject(proposal['properties'], 'proposal.properties');
      const intent = selectClosedProperties(
        schemaObject(proposalProperties['intent'], 'intent'),
        intentFields,
      );
      proposal = Object.freeze({
        ...proposal,
        properties: Object.freeze({ ...proposalProperties, intent }),
      });
    }
    proposal = selectClosedProperties(proposal, proposalFields);
    submission = Object.freeze({
      ...submission,
      properties: Object.freeze({ ...submissionProperties, proposal }),
    });
  }
  submission = selectClosedProperties(submission, submissionFields);
  return Object.freeze({
    type: 'function' as const,
    function: Object.freeze({
      name: submit.function.name,
      description: submit.function.description,
      parameters: Object.freeze({
        ...parameters,
        properties: Object.freeze({ submission }),
        required: Object.freeze(['submission']),
      }),
    }),
  });
}

export function buildSellerSchemaDiagnosticCases(): readonly Readonly<SellerSchemaDiagnosticCase>[] {
  const capture = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'capture_user_observations');
  const calculation = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'request_calculations');
  const submit = SELLER_LOCAL_TOOLS.find((item) => item.function.name === 'submit_seller_submission');
  if (capture === undefined || calculation === undefined || submit === undefined) {
    throw new TypeError('complete Seller tool set is required for schema diagnostics');
  }
  const submitSchemaBytes = new TextEncoder().encode(JSON.stringify([submit])).byteLength;
  const paddedSimpleControlTool = syntheticTool('capture_padded_signal', Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze({
      value: Object.freeze({
        type: 'string',
        description: 'x'.repeat(Math.min(48_000, Math.max(7_000, submitSchemaBytes + 1_024))),
      }),
    }),
    required: Object.freeze(['value']),
  }));
  const envelopeOnly = buildSubmitSubsetTool(submit, ['schemaVersion', 'proposalId']);
  const intentOnly = buildSubmitSubsetTool(
    submit,
    ['schemaVersion', 'proposalId', 'proposal'],
    ['schemaVersion', 'narration', 'intent', 'criticRequired'],
  );
  const intentSubset = (intentFields: readonly string[]) => buildSubmitSubsetTool(
    submit,
    ['schemaVersion', 'proposalId', 'proposal'],
    ['schemaVersion', 'narration', 'intent', 'criticRequired'],
    intentFields,
  );
  const capabilitiesOnly = intentSubset(['schemaVersion', 'capabilities']);
  const actionsOnly = intentSubset(['schemaVersion', 'actions']);
  const quantitativeOnly = intentSubset(['schemaVersion', 'quantitativeOpportunities']);
  const artifactsOnly = intentSubset(['schemaVersion', 'artifactIntents']);
  const questionOnly = intentSubset(['schemaVersion', 'nextQuestion']);
  const recordsOnly = buildSubmitSubsetTool(
    submit,
    ['schemaVersion', 'proposalId', 'proposal'],
    [
      'schemaVersion',
      'narration',
      'factProposals',
      'correctionProposals',
      'processMutations',
      'sceneProposal',
      'artifactProposals',
      'criticRequired',
    ],
  );
  const materialOnly = buildSubmitSubsetTool(
    submit,
    ['schemaVersion', 'proposalId', 'materialClaims', 'calculationRequests'],
  );
  return Object.freeze([
    Object.freeze({ id: 'simple-control', tools: Object.freeze([simpleControlTool]) }),
    Object.freeze({ id: 'padded-simple-control', tools: Object.freeze([paddedSimpleControlTool]) }),
    Object.freeze({ id: 'deep-simple-control', tools: Object.freeze([deepSimpleControlTool]) }),
    Object.freeze({ id: 'wide-simple-control', tools: Object.freeze([wideSimpleControlTool]) }),
    Object.freeze({ id: 'capture-calculation-only', tools: Object.freeze([capture, calculation]) }),
    Object.freeze({ id: 'submit-envelope-only', tools: Object.freeze([envelopeOnly]) }),
    Object.freeze({ id: 'submit-intent-only', tools: Object.freeze([intentOnly]) }),
    Object.freeze({ id: 'submit-intent-scalars-only', tools: Object.freeze([intentSubset(['schemaVersion', 'objective', 'rationale'])]) }),
    Object.freeze({ id: 'submit-intent-capabilities-only', tools: Object.freeze([capabilitiesOnly]) }),
    Object.freeze({ id: 'submit-intent-capabilities-without-unique-items', tools: Object.freeze([transformTool(capabilitiesOnly, 'without_unique_items')]) }),
    Object.freeze({ id: 'submit-intent-actions-only', tools: Object.freeze([actionsOnly]) }),
    Object.freeze({ id: 'submit-intent-quantitative-only', tools: Object.freeze([quantitativeOnly]) }),
    Object.freeze({ id: 'submit-intent-quantitative-without-unique-items', tools: Object.freeze([transformTool(quantitativeOnly, 'without_unique_items')]) }),
    Object.freeze({ id: 'submit-intent-artifacts-only', tools: Object.freeze([artifactsOnly]) }),
    Object.freeze({ id: 'submit-intent-question-only', tools: Object.freeze([questionOnly]) }),
    Object.freeze({ id: 'submit-records-only', tools: Object.freeze([recordsOnly]) }),
    Object.freeze({ id: 'submit-material-only', tools: Object.freeze([materialOnly]) }),
    Object.freeze({ id: 'submit-only-complete', tools: Object.freeze([submit]) }),
    Object.freeze({ id: 'submit-without-one-of', tools: Object.freeze([transformTool(submit, 'without_one_of')]) }),
    Object.freeze({ id: 'submit-without-descriptions', tools: Object.freeze([transformTool(submit, 'without_descriptions')]) }),
    Object.freeze({ id: 'submit-without-unique-items', tools: Object.freeze([transformTool(submit, 'without_unique_items')]) }),
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

export function inferSellerSchemaRootCause(
  results: readonly Readonly<{ id: string; accepted: boolean }>[],
): string {
  const byId = new Map(results.map((item) => [item.id, item.accepted] as const));
  const accepted = (id: string) => byId.get(id) === true;
  const rejected = (id: string) => byId.get(id) === false;
  if (!accepted('simple-control')) return 'NOT_ISOLATED';
  if (accepted('submit-only-complete') && rejected('complete-tools')) {
    return 'COMPLETE_TOOL_COMPOSITION_REJECTED';
  }
  if (!rejected('submit-only-complete')) return 'NOT_ISOLATED';
  if (accepted('submit-without-one-of')) return 'ONE_OF_UNSUPPORTED_IN_SUBMIT_SCHEMA';
  if (accepted('submit-without-descriptions')) return 'DESCRIPTION_REJECTED_IN_SUBMIT_SCHEMA';
  if (accepted('submit-without-unique-items')) return 'UNIQUE_ITEMS_UNSUPPORTED_IN_SUBMIT_SCHEMA';

  const padded = accepted('padded-simple-control');
  const deep = accepted('deep-simple-control');
  const wide = accepted('wide-simple-control');
  const envelope = accepted('submit-envelope-only');
  const intent = accepted('submit-intent-only');
  const records = accepted('submit-records-only');
  const material = accepted('submit-material-only');
  if (!padded && deep && wide && envelope && intent && records && material) return 'SCHEMA_BYTE_SIZE_LIMIT';
  if (padded && !deep && wide && envelope && intent && records && material) return 'SCHEMA_DEPTH_LIMIT';
  if (padded && deep && !wide && envelope && intent && records && material) return 'SCHEMA_PROPERTY_WIDTH_LIMIT';
  if (padded && deep && wide && envelope && !intent && records && material) {
    const intentBranches = [
      ['submit-intent-scalars-only', 'INTENT_SCALARS_BRANCH_REJECTED'],
      ['submit-intent-capabilities-only', 'INTENT_CAPABILITIES_BRANCH_REJECTED'],
      ['submit-intent-actions-only', 'INTENT_ACTIONS_BRANCH_REJECTED'],
      ['submit-intent-quantitative-only', 'INTENT_QUANTITATIVE_BRANCH_REJECTED'],
      ['submit-intent-artifacts-only', 'INTENT_ARTIFACTS_BRANCH_REJECTED'],
      ['submit-intent-question-only', 'INTENT_QUESTION_BRANCH_REJECTED'],
    ] as const;
    const observed = intentBranches.filter(([id]) => byId.has(id));
    const failures = observed.filter(([id]) => rejected(id));
    if (observed.length === intentBranches.length && failures.length === 1 && observed.every(([id]) => (
      accepted(id) || rejected(id)
    ))) return failures[0]![1];
    return 'INTENT_BRANCH_REJECTED';
  }
  if (padded && deep && wide && envelope && intent && !records && material) return 'PROPOSAL_RECORD_BRANCH_REJECTED';
  if (padded && deep && wide && envelope && intent && records && !material) return 'MATERIAL_CLAIMS_BRANCH_REJECTED';
  if (padded && deep && wide && envelope && intent && records && material) {
    return 'COMBINED_SUBMIT_SCHEMA_COMPLEXITY_LIMIT';
  }
  return 'NOT_ISOLATED';
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

  const rootCause = inferSellerSchemaRootCause(results);

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
