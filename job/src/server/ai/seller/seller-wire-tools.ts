import type { CalculationRequest } from '../../../ai/quant/quantity-types.ts';
import type { AssembledToolCall } from '../providers/chat-sse.ts';
import type { LocalFunctionTool } from '../providers/openai-chat-wire.ts';

export const SELLER_TOOL_NAMES = ['request_calculations', 'submit_seller_submission'] as const;
export type SellerToolName = (typeof SELLER_TOOL_NAMES)[number];

export type SellerWireToolResult =
  | { ok: true; kind: 'calculation_requests'; toolCallId: string; requests: readonly Readonly<CalculationRequest>[] }
  | { ok: true; kind: 'seller_submission'; toolCallId: string; submission: Readonly<Record<string, unknown>> }
  | {
      ok: false;
      code:
        | 'UNKNOWN_TOOL'
        | 'INVALID_ARGUMENTS'
        | 'STALE_REVISION'
        | 'DUPLICATE_ID'
        | 'LIMIT_EXCEEDED';
    };

type SellerWireFailure = Extract<SellerWireToolResult, { ok: false }>;

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_CALCULATION_REQUESTS = 8;
const MAX_TOOL_ARGUMENT_BYTES = 1_000_000;

const idSchema = Object.freeze({
  type: 'string',
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  minLength: 1,
  maxLength: 96,
});

const baseProperties = Object.freeze({
  id: idSchema,
  baseRevision: Object.freeze({ type: 'integer', minimum: 0 }),
});

function calculationSchema(
  kind: CalculationRequest['kind'],
  requiredIds: readonly string[],
): Readonly<Record<string, unknown>> {
  const properties: Record<string, unknown> = {
    ...baseProperties,
    kind: Object.freeze({ type: 'string', enum: Object.freeze([kind]) }),
  };
  for (const id of requiredIds) properties[id] = idSchema;
  return Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze(properties),
    required: Object.freeze(['id', 'kind', 'baseRevision', ...requiredIds]),
  });
}

const calculationRequestSchema = Object.freeze({
  oneOf: Object.freeze([
    calculationSchema('monthly_capacity', [
      'peopleObservationId',
      'minutesPerPersonPerDayObservationId',
      'workingDaysPerMonthObservationId',
    ]),
    calculationSchema('monthly_workload', [
      'occurrencesPerMonthObservationId',
      'minutesPerOccurrenceObservationId',
    ]),
    calculationSchema('monthly_cost', [
      'monthlyHoursObservationId',
      'hourlyCostObservationId',
    ]),
    calculationSchema('rework_volume', [
      'volumeObservationId',
      'reworkRateObservationId',
    ]),
  ]),
});

const requestCalculationsTool: LocalFunctionTool = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'request_calculations',
    description: 'Request application-owned deterministic arithmetic from canonical observations. Never provide a result value.',
    parameters: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        requests: Object.freeze({
          type: 'array',
          minItems: 1,
          maxItems: MAX_CALCULATION_REQUESTS,
          items: calculationRequestSchema,
        }),
      }),
      required: Object.freeze(['requests']),
    }),
  }),
});

const submitSellerTool: LocalFunctionTool = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'submit_seller_submission',
    description: 'Submit the final SellerSubmission candidate after all deterministic calculations have been requested and committed. Pending calculation requests are forbidden in the final submission; the application will independently validate every nested field and hard block.',
    parameters: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        submission: Object.freeze({
          type: 'object',
          additionalProperties: false,
          properties: Object.freeze({
            schemaVersion: Object.freeze({ type: 'integer', enum: Object.freeze([1]) }),
            proposalId: idSchema,
            proposal: Object.freeze({ type: 'object' }),
            materialClaims: Object.freeze({ type: 'array' }),
            calculationRequests: Object.freeze({ type: 'array', maxItems: 0 }),
          }),
          required: Object.freeze([
            'schemaVersion',
            'proposalId',
            'proposal',
            'materialClaims',
            'calculationRequests',
          ]),
        }),
      }),
      required: Object.freeze(['submission']),
    }),
  }),
});

export const SELLER_LOCAL_TOOLS: readonly LocalFunctionTool[] = Object.freeze([
  requestCalculationsTool,
  submitSellerTool,
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 96 && SAFE_ID.test(value);
}

const CALCULATION_KEYS: Readonly<Record<CalculationRequest['kind'], readonly string[]>> = Object.freeze({
  monthly_capacity: Object.freeze([
    'id', 'kind', 'baseRevision',
    'peopleObservationId', 'minutesPerPersonPerDayObservationId', 'workingDaysPerMonthObservationId',
  ]),
  monthly_workload: Object.freeze([
    'id', 'kind', 'baseRevision',
    'occurrencesPerMonthObservationId', 'minutesPerOccurrenceObservationId',
  ]),
  monthly_cost: Object.freeze([
    'id', 'kind', 'baseRevision',
    'monthlyHoursObservationId', 'hourlyCostObservationId',
  ]),
  rework_volume: Object.freeze([
    'id', 'kind', 'baseRevision',
    'volumeObservationId', 'reworkRateObservationId',
  ]),
});

function parseCalculationRequest(
  value: unknown,
  expectedRevision: number,
): SellerWireFailure | { ok: true; request: Readonly<CalculationRequest> } {
  if (!isRecord(value) || typeof value['kind'] !== 'string') return { ok: false, code: 'INVALID_ARGUMENTS' };
  const kind = value['kind'];
  if (!Object.hasOwn(CALCULATION_KEYS, kind)) return { ok: false, code: 'INVALID_ARGUMENTS' };
  const requestKind = kind as CalculationRequest['kind'];
  const keys = CALCULATION_KEYS[requestKind];
  if (!hasOnlyKeys(value, keys) || !keys.every((key) => Object.hasOwn(value, key))) {
    return { ok: false, code: 'INVALID_ARGUMENTS' };
  }
  if (!safeId(value['id'])) return { ok: false, code: 'INVALID_ARGUMENTS' };
  if (value['baseRevision'] !== expectedRevision) return { ok: false, code: 'STALE_REVISION' };
  for (const key of keys) {
    if (key === 'id' || key === 'kind' || key === 'baseRevision') continue;
    if (!safeId(value[key])) return { ok: false, code: 'INVALID_ARGUMENTS' };
  }
  return { ok: true, request: Object.freeze({ ...value }) as unknown as Readonly<CalculationRequest> };
}

function parseArgumentsJson(call: Readonly<AssembledToolCall>): Record<string, unknown> | null {
  if (new TextEncoder().encode(call.function.arguments).byteLength > MAX_TOOL_ARGUMENT_BYTES) return null;
  try {
    const parsed = JSON.parse(call.function.arguments) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseSellerToolCall(
  call: Readonly<AssembledToolCall>,
  expectedRevision: number,
): SellerWireToolResult {
  if (!Number.isInteger(expectedRevision) || expectedRevision < 0) return { ok: false, code: 'INVALID_ARGUMENTS' };
  const args = parseArgumentsJson(call);
  if (args === null) return { ok: false, code: 'INVALID_ARGUMENTS' };

  if (call.function.name === 'request_calculations') {
    if (!hasOnlyKeys(args, ['requests']) || !Array.isArray(args['requests'])) return { ok: false, code: 'INVALID_ARGUMENTS' };
    const rawRequests = args['requests'];
    if (rawRequests.length < 1 || rawRequests.length > MAX_CALCULATION_REQUESTS) return { ok: false, code: 'LIMIT_EXCEEDED' };
    const requests: Readonly<CalculationRequest>[] = [];
    const ids = new Set<string>();
    for (const raw of rawRequests) {
      const parsed = parseCalculationRequest(raw, expectedRevision);
      if (!parsed.ok) return parsed;
      if (ids.has(parsed.request.id)) return { ok: false, code: 'DUPLICATE_ID' };
      ids.add(parsed.request.id);
      requests.push(parsed.request);
    }
    return {
      ok: true,
      kind: 'calculation_requests',
      toolCallId: call.id,
      requests: Object.freeze(requests),
    };
  }

  if (call.function.name === 'submit_seller_submission') {
    if (!hasOnlyKeys(args, ['submission']) || !isRecord(args['submission'])) return { ok: false, code: 'INVALID_ARGUMENTS' };
    const submission = args['submission'];
    const topKeys = ['schemaVersion', 'proposalId', 'proposal', 'materialClaims', 'calculationRequests'] as const;
    if (!hasOnlyKeys(submission, topKeys) || !topKeys.every((key) => Object.hasOwn(submission, key))) {
      return { ok: false, code: 'INVALID_ARGUMENTS' };
    }
    if (submission['schemaVersion'] !== 1 || !safeId(submission['proposalId']) || !isRecord(submission['proposal'])) {
      return { ok: false, code: 'INVALID_ARGUMENTS' };
    }
    if (submission['proposal']['baseRevision'] !== expectedRevision) return { ok: false, code: 'STALE_REVISION' };
    if (!Array.isArray(submission['materialClaims']) || !Array.isArray(submission['calculationRequests'])) {
      return { ok: false, code: 'INVALID_ARGUMENTS' };
    }
    if (submission['calculationRequests'].length !== 0) {
      return { ok: false, code: 'INVALID_ARGUMENTS' };
    }
    return {
      ok: true,
      kind: 'seller_submission',
      toolCallId: call.id,
      submission: Object.freeze({ ...submission }),
    };
  }

  return { ok: false, code: 'UNKNOWN_TOOL' };
}
