import type { CalculationRequest } from '../../../ai/quant/quantity-types.ts';
import {
  USER_OBSERVATION_KINDS,
  type UserObservationKind,
} from '../../../ai/context/user-evidence-ingestion.ts';
import type { AssembledToolCall } from '../providers/chat-sse.ts';
import type { LocalFunctionTool } from '../providers/openai-chat-wire.ts';

export const SELLER_TOOL_NAMES = ['capture_user_observations', 'request_calculations', 'submit_seller_submission'] as const;
export type SellerToolName = (typeof SELLER_TOOL_NAMES)[number];

export interface SellerUserObservationIntent {
  kind: UserObservationKind;
  quote: string;
  value: number;
}

export type SellerCalculationIntent =
  | {
      kind: 'monthly_capacity';
      peopleObservationId: string;
      minutesPerPersonPerDayObservationId: string;
      workingDaysPerMonthObservationId: string;
    }
  | {
      kind: 'monthly_workload';
      occurrencesPerMonthObservationId: string;
      minutesPerOccurrenceObservationId: string;
    }
  | {
      kind: 'monthly_cost';
      monthlyHoursObservationId: string;
      hourlyCostObservationId: string;
    }
  | {
      kind: 'rework_volume';
      volumeObservationId: string;
      reworkRateObservationId: string;
    };

export type SellerWireToolResult =
  | { ok: true; kind: 'user_observation_requests'; toolCallId: string; requests: readonly Readonly<SellerUserObservationIntent>[] }
  | { ok: true; kind: 'calculation_requests'; toolCallId: string; requests: readonly Readonly<SellerCalculationIntent>[] }
  | { ok: true; kind: 'seller_submission'; toolCallId: string; submission: Readonly<Record<string, unknown>> }
  | {
      ok: false;
      code:
        | 'UNKNOWN_TOOL'
        | 'INVALID_ARGUMENTS'
        | 'DUPLICATE_REQUEST'
        | 'LIMIT_EXCEEDED';
    };

type SellerWireFailure = Extract<SellerWireToolResult, { ok: false }>;

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_USER_OBSERVATIONS = 8;
const MAX_CALCULATION_REQUESTS = 8;
const MAX_TOOL_ARGUMENT_BYTES = 1_000_000;

const idSchema = Object.freeze({
  type: 'string',
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  minLength: 1,
  maxLength: 96,
});

function calculationSchema(
  kind: CalculationRequest['kind'],
  requiredIds: readonly string[],
): Readonly<Record<string, unknown>> {
  const properties: Record<string, unknown> = {
    kind: Object.freeze({ type: 'string', enum: Object.freeze([kind]) }),
  };
  for (const id of requiredIds) properties[id] = idSchema;
  return Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze(properties),
    required: Object.freeze(['kind', ...requiredIds]),
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

const userObservationSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    kind: Object.freeze({ type: 'string', enum: Object.freeze([...USER_OBSERVATION_KINDS]) }),
    quote: Object.freeze({ type: 'string', minLength: 1, maxLength: 500 }),
    value: Object.freeze({ type: 'number', minimum: 0 }),
  }),
  required: Object.freeze(['kind', 'quote', 'value']),
});

const captureUserObservationsTool: LocalFunctionTool = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'capture_user_observations',
    description: 'Select numeric evidence explicitly present in the current authoritative user turn. Supply only semantic kind, exact quote and value. The application binds request id, canonical revision, authoritative turn, provenance, unit and period.',
    parameters: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        observations: Object.freeze({
          type: 'array',
          minItems: 1,
          maxItems: MAX_USER_OBSERVATIONS,
          items: userObservationSchema,
        }),
      }),
      required: Object.freeze(['observations']),
    }),
  }),
});

const requestCalculationsTool: LocalFunctionTool = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'request_calculations',
    description: 'Request application-owned deterministic arithmetic using canonical observation ids. Supply only calculation kind and observation references. The application binds calculation id and canonical revision and never accepts a model-authored result.',
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
    description: 'Submit the final SellerSubmission candidate after all deterministic calculations have been committed. The application binds proposal.baseRevision to the current canonical revision. Pending calculation requests are forbidden and every nested field is independently validated.',
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
  captureUserObservationsTool,
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

const USER_OBSERVATION_KEYS = Object.freeze(['kind', 'quote', 'value'] as const);

function parseUserObservationIntent(
  value: unknown,
): SellerWireFailure | { ok: true; request: Readonly<SellerUserObservationIntent> } {
  if (!isRecord(value) || !hasOnlyKeys(value, USER_OBSERVATION_KEYS)
    || !USER_OBSERVATION_KEYS.every((key) => Object.hasOwn(value, key))) {
    return { ok: false, code: 'INVALID_ARGUMENTS' };
  }
  if (typeof value['kind'] !== 'string'
    || !(USER_OBSERVATION_KINDS as readonly string[]).includes(value['kind'])) {
    return { ok: false, code: 'INVALID_ARGUMENTS' };
  }
  if (typeof value['quote'] !== 'string' || value['quote'].trim().length < 1 || value['quote'].length > 500) {
    return { ok: false, code: 'INVALID_ARGUMENTS' };
  }
  if (typeof value['value'] !== 'number' || !Number.isFinite(value['value']) || value['value'] < 0) {
    return { ok: false, code: 'INVALID_ARGUMENTS' };
  }
  return {
    ok: true,
    request: Object.freeze({
      kind: value['kind'] as UserObservationKind,
      quote: value['quote'],
      value: value['value'],
    }),
  };
}

const CALCULATION_KEYS: Readonly<Record<CalculationRequest['kind'], readonly string[]>> = Object.freeze({
  monthly_capacity: Object.freeze([
    'kind', 'peopleObservationId', 'minutesPerPersonPerDayObservationId', 'workingDaysPerMonthObservationId',
  ]),
  monthly_workload: Object.freeze([
    'kind', 'occurrencesPerMonthObservationId', 'minutesPerOccurrenceObservationId',
  ]),
  monthly_cost: Object.freeze([
    'kind', 'monthlyHoursObservationId', 'hourlyCostObservationId',
  ]),
  rework_volume: Object.freeze([
    'kind', 'volumeObservationId', 'reworkRateObservationId',
  ]),
});

function parseCalculationIntent(
  value: unknown,
): SellerWireFailure | { ok: true; request: Readonly<SellerCalculationIntent> } {
  if (!isRecord(value) || typeof value['kind'] !== 'string') return { ok: false, code: 'INVALID_ARGUMENTS' };
  const kind = value['kind'];
  if (!Object.hasOwn(CALCULATION_KEYS, kind)) return { ok: false, code: 'INVALID_ARGUMENTS' };
  const requestKind = kind as CalculationRequest['kind'];
  const keys = CALCULATION_KEYS[requestKind];
  if (!hasOnlyKeys(value, keys) || !keys.every((key) => Object.hasOwn(value, key))) {
    return { ok: false, code: 'INVALID_ARGUMENTS' };
  }
  for (const key of keys) {
    if (key === 'kind') continue;
    if (!safeId(value[key])) return { ok: false, code: 'INVALID_ARGUMENTS' };
  }
  return { ok: true, request: Object.freeze({ ...value }) as unknown as Readonly<SellerCalculationIntent> };
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

  if (call.function.name === 'capture_user_observations') {
    if (!hasOnlyKeys(args, ['observations']) || !Array.isArray(args['observations'])) {
      return { ok: false, code: 'INVALID_ARGUMENTS' };
    }
    const rawRequests = args['observations'];
    if (rawRequests.length < 1 || rawRequests.length > MAX_USER_OBSERVATIONS) {
      return { ok: false, code: 'LIMIT_EXCEEDED' };
    }
    const requests: Readonly<SellerUserObservationIntent>[] = [];
    const signatures = new Set<string>();
    for (const raw of rawRequests) {
      const parsed = parseUserObservationIntent(raw);
      if (!parsed.ok) return parsed;
      const signature = JSON.stringify(parsed.request);
      if (signatures.has(signature)) return { ok: false, code: 'DUPLICATE_REQUEST' };
      signatures.add(signature);
      requests.push(parsed.request);
    }
    return {
      ok: true,
      kind: 'user_observation_requests',
      toolCallId: call.id,
      requests: Object.freeze(requests),
    };
  }

  if (call.function.name === 'request_calculations') {
    if (!hasOnlyKeys(args, ['requests']) || !Array.isArray(args['requests'])) return { ok: false, code: 'INVALID_ARGUMENTS' };
    const rawRequests = args['requests'];
    if (rawRequests.length < 1 || rawRequests.length > MAX_CALCULATION_REQUESTS) return { ok: false, code: 'LIMIT_EXCEEDED' };
    const requests: Readonly<SellerCalculationIntent>[] = [];
    const signatures = new Set<string>();
    for (const raw of rawRequests) {
      const parsed = parseCalculationIntent(raw);
      if (!parsed.ok) return parsed;
      const signature = JSON.stringify(parsed.request);
      if (signatures.has(signature)) return { ok: false, code: 'DUPLICATE_REQUEST' };
      signatures.add(signature);
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
    if (!Array.isArray(submission['materialClaims']) || !Array.isArray(submission['calculationRequests'])) {
      return { ok: false, code: 'INVALID_ARGUMENTS' };
    }
    if (submission['calculationRequests'].length !== 0) {
      return { ok: false, code: 'INVALID_ARGUMENTS' };
    }
    const proposal = Object.freeze({
      ...submission['proposal'],
      baseRevision: expectedRevision,
    });
    return {
      ok: true,
      kind: 'seller_submission',
      toolCallId: call.id,
      submission: Object.freeze({ ...submission, proposal }),
    };
  }

  return { ok: false, code: 'UNKNOWN_TOOL' };
}
