import { CAPABILITY_KINDS } from '../../../ai/context/canonical-sales-context.ts';
import type { CalculationRequest } from '../../../ai/quant/quantity-types.ts';
import {
  USER_OBSERVATION_KINDS,
  type UserObservationKind,
} from '../../../ai/context/user-evidence-ingestion.ts';
import {
  AGENT_INTENT_LIMITS,
  EXPERIENCE_ACTION_KINDS,
  QUANTITATIVE_OPPORTUNITY_KINDS,
} from '../../../experience/agent-intent.ts';
import {
  ARTIFACT_AUDIENCES,
  ARTIFACT_KINDS,
} from '../../../experience/artifact-intent.ts';
import { EXPERIENCE_PROPOSAL_LIMITS } from '../../../experience/experience-validation.ts';
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
});

const calculationRequestSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  description: 'Required by kind: monthly_capacity=peopleObservationId+minutesPerPersonPerDayObservationId+workingDaysPerMonthObservationId; monthly_workload=occurrencesPerMonthObservationId+minutesPerOccurrenceObservationId; monthly_cost=monthlyHoursObservationId+hourlyCostObservationId; rework_volume=volumeObservationId+reworkRateObservationId.',
  properties: Object.freeze({
    kind: Object.freeze({ type: 'string', enum: Object.freeze(['monthly_capacity', 'monthly_workload', 'monthly_cost', 'rework_volume']) }),
    peopleObservationId: idSchema,
    minutesPerPersonPerDayObservationId: idSchema,
    workingDaysPerMonthObservationId: idSchema,
    occurrencesPerMonthObservationId: idSchema,
    minutesPerOccurrenceObservationId: idSchema,
    monthlyHoursObservationId: idSchema,
    hourlyCostObservationId: idSchema,
    volumeObservationId: idSchema,
    reworkRateObservationId: idSchema,
  }),
  required: Object.freeze(['kind']),
});

const userObservationSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    kind: Object.freeze({
      type: 'string',
      enum: Object.freeze([...USER_OBSERVATION_KINDS]),
      description: 'Choose only the semantic kind literally supported by the copied quote. occurrences_per_month requires occurrence+month markers; minutes_per_occurrence requires minute+occurrence; people_count requires people marker; all other kinds follow their literal unit/period names.',
    }),
    quote: Object.freeze({
      type: 'string',
      description: 'Copy one exact contiguous substring from the current authoritative user turn. Never paraphrase, normalize, translate, combine distant fragments, or invent a number.',
    }),
    value: Object.freeze({
      type: 'number',
      description: 'Use exactly the numeric value present in quote.',
    }),
  }),
  required: Object.freeze(['kind', 'quote', 'value']),
});

const captureUserObservationsTool: LocalFunctionTool = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'capture_user_observations',
    description: 'Capture only numeric evidence that is explicitly present as digits/numeric notation in the current authoritative user turn. If the current turn has no explicit numeric token, do not call this tool. quote must be an exact contiguous substring copied verbatim from that turn and must contain the value plus the semantic unit/period markers required by kind; never paraphrase or infer a number. The application binds authority metadata.',
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
    description: 'Request deterministic arithmetic from canonical observation ids; the application owns the result and authority metadata.',
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

const nonEmptyTextSchema = (_maxLength: number, description?: string): Readonly<Record<string, unknown>> => Object.freeze({
  type: 'string',
  ...(description === undefined ? {} : { description }),
});

const idArraySchema = (
  _maxItems: number,
  _minItems = 0,
): Readonly<Record<string, unknown>> => Object.freeze({
  type: 'array',
  items: idSchema,
});

const primitiveSchema = Object.freeze({
  oneOf: Object.freeze([
    Object.freeze({ type: 'string' }),
    Object.freeze({ type: 'number' }),
    Object.freeze({ type: 'boolean' }),
  ]),
});

function closedObjectSchema(
  properties: Readonly<Record<string, unknown>>,
  required: readonly string[],
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    type: 'object',
    additionalProperties: false,
    properties: Object.freeze({ ...properties }),
    required: Object.freeze([...required]),
  });
}

const experienceActionSchema = closedObjectSchema({
  kind: Object.freeze({ type: 'string', enum: Object.freeze([...EXPERIENCE_ACTION_KINDS]) }),
  id: idSchema,
  targetId: Object.freeze({ oneOf: Object.freeze([idSchema, Object.freeze({ type: 'null' })]) }),
  targetIds: idArraySchema(AGENT_INTENT_LIMITS.actionTargetIds),
  reason: nonEmptyTextSchema(600),
  text: nonEmptyTextSchema(1000),
  evidenceIds: idArraySchema(AGENT_INTENT_LIMITS.evidenceIds),
  groupId: idSchema,
  memberIds: idArraySchema(AGENT_INTENT_LIMITS.actionTargetIds),
  label: nonEmptyTextSchema(200),
  calculationId: idSchema,
  artifactIntentId: idSchema,
  sourceId: idSchema,
}, ['id', 'kind']);

const experienceActionSchemaWithContract = Object.freeze({
  ...experienceActionSchema,
  description: 'Emit only fields allowed by kind: focus/reveal=id+kind+targetId+reason; compare/de_emphasize=id+kind+targetIds+reason; annotate=id+kind+targetId+text+evidenceIds; group=id+kind+groupId+memberIds+label; quantify=id+kind+calculationId+targetId+reason; demonstrate/stage_artifact/request_workshop=id+kind+artifactIntentId+reason; explain_relationship=id+kind+sourceId+targetId+text. Never mix fields from different kinds.',
});

const quantitativeOpportunitySchema = closedObjectSchema({
  id: idSchema,
  kind: Object.freeze({ type: 'string', enum: Object.freeze([...QUANTITATIVE_OPPORTUNITY_KINDS]) }),
  objective: nonEmptyTextSchema(600),
  evidenceIds: idArraySchema(AGENT_INTENT_LIMITS.evidenceIds),
  missingInputs: Object.freeze({
    type: 'array',
    maxItems: AGENT_INTENT_LIMITS.missingInputs,
    uniqueItems: true,
    items: nonEmptyTextSchema(200),
  }),
}, ['id', 'kind', 'objective', 'evidenceIds', 'missingInputs']);

const artifactIntentSchema = closedObjectSchema({
  id: idSchema,
  kind: Object.freeze({ type: 'string', enum: Object.freeze([...ARTIFACT_KINDS]) }),
  objective: nonEmptyTextSchema(600),
  evidenceIds: idArraySchema(32),
  audience: Object.freeze({ type: 'string', enum: Object.freeze([...ARTIFACT_AUDIENCES]) }),
  desiredImpact: nonEmptyTextSchema(600),
  workshopRequired: Object.freeze({ type: 'boolean' }),
}, ['kind', 'objective', 'evidenceIds', 'audience', 'desiredImpact', 'workshopRequired']);

const nextQuestionSchema = Object.freeze({
  oneOf: Object.freeze([
    closedObjectSchema({
      text: nonEmptyTextSchema(800),
      objective: nonEmptyTextSchema(400),
      evidenceIds: idArraySchema(AGENT_INTENT_LIMITS.evidenceIds),
    }, ['text']),
    Object.freeze({ type: 'null' }),
  ]),
});

const agentIntentSchema = closedObjectSchema({
  schemaVersion: Object.freeze({ type: 'integer', enum: Object.freeze([1]) }),
  objective: nonEmptyTextSchema(1200),
  rationale: nonEmptyTextSchema(2000),
  capabilities: Object.freeze({
    type: 'array',
    uniqueItems: true,
    items: Object.freeze({ type: 'string', enum: Object.freeze([...CAPABILITY_KINDS]) }),
  }),
  actions: Object.freeze({
    type: 'array',
    maxItems: AGENT_INTENT_LIMITS.actions,
    items: experienceActionSchemaWithContract,
  }),
  quantitativeOpportunities: Object.freeze({
    type: 'array',
    maxItems: AGENT_INTENT_LIMITS.quantitativeOpportunities,
    items: quantitativeOpportunitySchema,
  }),
  artifactIntents: Object.freeze({
    type: 'array',
    maxItems: AGENT_INTENT_LIMITS.artifactIntents,
    items: artifactIntentSchema,
  }),
  nextQuestion: nextQuestionSchema,
}, [
  'schemaVersion',
  'objective',
  'rationale',
  'capabilities',
  'actions',
  'quantitativeOpportunities',
  'artifactIntents',
  'nextQuestion',
]);

const factProposalSchema = closedObjectSchema({
  id: idSchema,
  subject: nonEmptyTextSchema(200),
  predicate: nonEmptyTextSchema(200),
  value: primitiveSchema,
  source: Object.freeze({
    type: 'string',
    enum: Object.freeze(['inference']),
    description: 'Only inference; provenance is application-owned.',
  }),
  supportingTurnIds: idArraySchema(EXPERIENCE_PROPOSAL_LIMITS.evidenceIds),
}, ['id', 'subject', 'predicate', 'value', 'source', 'supportingTurnIds']);

const correctionProposalSchema = closedObjectSchema({
  id: idSchema,
  targetEvidenceId: idSchema,
  reason: nonEmptyTextSchema(800),
  replacementValue: primitiveSchema,
  supportingTurnIds: idArraySchema(EXPERIENCE_PROPOSAL_LIMITS.evidenceIds),
}, ['id', 'targetEvidenceId', 'reason', 'replacementValue', 'supportingTurnIds']);

const processMutationSchema = closedObjectSchema({
  id: idSchema,
  kind: Object.freeze({ type: 'string', enum: Object.freeze(['upsert_node', 'upsert_relationship', 'remove_element', 'set_node_state']) }),
  nodeId: idSchema,
  label: nonEmptyTextSchema(EXPERIENCE_PROPOSAL_LIMITS.processNodeLabel),
  summary: nonEmptyTextSchema(EXPERIENCE_PROPOSAL_LIMITS.processNodeSummary),
  evidenceIds: idArraySchema(EXPERIENCE_PROPOSAL_LIMITS.evidenceIds),
  relationshipId: idSchema,
  sourceNodeId: idSchema,
  targetNodeId: idSchema,
  targetId: idSchema,
  reason: nonEmptyTextSchema(600),
  state: Object.freeze({ type: 'string', enum: Object.freeze(['active', 'hypothesis', 'invalidated']) }),
}, ['id', 'kind']);

const processMutationSchemaWithContract = Object.freeze({
  ...processMutationSchema,
  description: 'Emit only fields allowed by kind: upsert_node=id+kind+nodeId+label+summary+evidenceIds; upsert_relationship=id+kind+relationshipId+sourceNodeId+targetNodeId+label+evidenceIds; remove_element=id+kind+targetId+reason; set_node_state=id+kind+nodeId+state+reason. Never mix fields from different kinds.',
});

const sceneProposalSchema = Object.freeze({
  oneOf: Object.freeze([
    closedObjectSchema({
      composition: Object.freeze({
        type: 'string',
        enum: Object.freeze(['stable', 'focus', 'compare', 'overview', 'artifact']),
      }),
      focusIds: idArraySchema(EXPERIENCE_PROPOSAL_LIMITS.sceneIds),
      comparisonIds: idArraySchema(EXPERIENCE_PROPOSAL_LIMITS.sceneIds),
      announcement: Object.freeze({
        oneOf: Object.freeze([nonEmptyTextSchema(600), Object.freeze({ type: 'null' })]),
      }),
    }, ['composition', 'focusIds', 'comparisonIds', 'announcement']),
    Object.freeze({ type: 'null' }),
  ]),
});

const artifactProposalSchema = closedObjectSchema({
  id: idSchema,
  kind: Object.freeze({ type: 'string', enum: Object.freeze([...ARTIFACT_KINDS]) }),
  title: nonEmptyTextSchema(240),
  summary: nonEmptyTextSchema(1200),
  evidenceIds: idArraySchema(EXPERIENCE_PROPOSAL_LIMITS.evidenceIds),
  status: Object.freeze({ type: 'string', enum: Object.freeze(['conceptual', 'prototype']) }),
}, ['id', 'kind', 'title', 'summary', 'evidenceIds', 'status']);

const modelFacingProposalSchema = closedObjectSchema({
  schemaVersion: Object.freeze({ type: 'integer', enum: Object.freeze([1]) }),
  narration: nonEmptyTextSchema(EXPERIENCE_PROPOSAL_LIMITS.narration),
  intent: agentIntentSchema,
  factProposals: Object.freeze({
    type: 'array',
    maxItems: EXPERIENCE_PROPOSAL_LIMITS.factProposals,
    items: factProposalSchema,
  }),
  correctionProposals: Object.freeze({
    type: 'array',
    maxItems: EXPERIENCE_PROPOSAL_LIMITS.correctionProposals,
    items: correctionProposalSchema,
  }),
  processMutations: Object.freeze({
    type: 'array',
    maxItems: EXPERIENCE_PROPOSAL_LIMITS.processMutations,
    items: processMutationSchemaWithContract,
  }),
  sceneProposal: sceneProposalSchema,
  artifactProposals: Object.freeze({
    type: 'array',
    maxItems: EXPERIENCE_PROPOSAL_LIMITS.artifactProposals,
    items: artifactProposalSchema,
  }),
  criticRequired: Object.freeze({
    type: 'boolean',
    enum: Object.freeze([true]),
    description: 'Every Seller submission requires independent Critic review.',
  }),
}, [
  'schemaVersion',
  'narration',
  'intent',
  'factProposals',
  'correctionProposals',
  'processMutations',
  'sceneProposal',
  'artifactProposals',
  'criticRequired',
]);

const safeMaterialClaimSchema = closedObjectSchema({
  id: idSchema,
  kind: Object.freeze({ type: 'string', enum: Object.freeze(['verified_numeric', 'qualitative', 'feasibility', 'artifact_readiness']) }),
  text: nonEmptyTextSchema(1200),
  calculationId: idSchema,
  evidenceIds: idArraySchema(32),
  state: Object.freeze({ type: 'string', enum: Object.freeze(['unknown', 'conditional']) }),
  artifactId: idSchema,
  readiness: Object.freeze({ type: 'string', enum: Object.freeze(['conceptual', 'prototype']) }),
}, ['id', 'kind', 'text']);

const safeMaterialClaimSchemaWithContract = Object.freeze({
  ...safeMaterialClaimSchema,
  description: 'Required fields by kind: verified_numeric=id+kind+text+calculationId; qualitative=id+kind+text+evidenceIds; feasibility=id+kind+text+state+evidenceIds; artifact_readiness=id+kind+text+artifactId+readiness. Never emit fields from another kind.',
});

const submitSellerTool: LocalFunctionTool = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'submit_seller_submission',
    description: 'Submit the complete structured SellerSubmission. Omit server-owned proposal.baseRevision; only exposed non-authoritative claim kinds are allowed.',
    parameters: closedObjectSchema({
      submission: closedObjectSchema({
        schemaVersion: Object.freeze({ type: 'integer', enum: Object.freeze([1]) }),
        proposalId: idSchema,
        proposal: modelFacingProposalSchema,
        materialClaims: Object.freeze({
          type: 'array',
          maxItems: 20,
          items: safeMaterialClaimSchemaWithContract,
        }),
        calculationRequests: Object.freeze({
          type: 'array',
          maxItems: 0,
        }),
      }, [
        'schemaVersion',
        'proposalId',
        'proposal',
        'materialClaims',
        'calculationRequests',
      ]),
    }, ['submission']),
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
