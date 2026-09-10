import {
  CRITIC_FINDING_CODES,
  validateCriticReview,
  type CriticReview,
  type CriticReviewValidation,
} from '../../../ai/critic/critic-contract.ts';
import type { AssembledToolCall } from '../providers/chat-sse.ts';
import type { LocalFunctionTool } from '../providers/openai-chat-wire.ts';

export const CRITIC_TOOL_NAME = 'submit_critic_review' as const;

export type CriticWireToolResult =
  | { ok: true; toolCallId: string; review: Readonly<CriticReview> }
  | {
      ok: false;
      code: 'UNKNOWN_TOOL' | 'INVALID_ARGUMENTS' | 'STALE_REVIEW' | 'INVALID_REVIEW';
      validation?: Extract<CriticReviewValidation, { ok: false }>;
    };

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_TOOL_ARGUMENT_BYTES = 256_000;

const idSchema = Object.freeze({
  type: 'string',
  pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$',
  minLength: 1,
  maxLength: 96,
});

const findingSchema = Object.freeze({
  type: 'object',
  additionalProperties: false,
  properties: Object.freeze({
    id: idSchema,
    code: Object.freeze({ type: 'string', enum: CRITIC_FINDING_CODES }),
    severity: Object.freeze({ type: 'string', enum: Object.freeze(['revise', 'block']) }),
    summary: Object.freeze({ type: 'string', minLength: 1, maxLength: 800 }),
    evidenceIds: Object.freeze({
      type: 'array',
      maxItems: 16,
      uniqueItems: true,
      items: idSchema,
    }),
  }),
  required: Object.freeze(['id', 'code', 'severity', 'summary', 'evidenceIds']),
});

const submitCriticReviewTool: LocalFunctionTool = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: CRITIC_TOOL_NAME,
    description: 'Submit an independent Critic verdict bound to the exact Seller proposal and canonical revision. Evaluate truth, safety and execution integrity; novelty or deviation from a sales script is not a finding.',
    parameters: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        review: Object.freeze({
          type: 'object',
          additionalProperties: false,
          properties: Object.freeze({
            schemaVersion: Object.freeze({ type: 'integer', enum: Object.freeze([1]) }),
            proposalId: idSchema,
            basedOnRevision: Object.freeze({ type: 'integer', minimum: 0 }),
            verdict: Object.freeze({ type: 'string', enum: Object.freeze(['PASS', 'REVISE', 'BLOCK']) }),
            findings: Object.freeze({
              type: 'array',
              maxItems: 8,
              items: findingSchema,
            }),
          }),
          required: Object.freeze(['schemaVersion', 'proposalId', 'basedOnRevision', 'verdict', 'findings']),
        }),
      }),
      required: Object.freeze(['review']),
    }),
  }),
});

export const CRITIC_LOCAL_TOOLS: readonly LocalFunctionTool[] = Object.freeze([submitCriticReviewTool]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKey(value: Record<string, unknown>, key: string): boolean {
  const keys = Object.keys(value);
  return keys.length === 1 && keys[0] === key;
}

function validExpectedBinding(proposalId: string, revision: number): boolean {
  return proposalId.length >= 1
    && proposalId.length <= 96
    && SAFE_ID.test(proposalId)
    && Number.isInteger(revision)
    && revision >= 0;
}

function parseArguments(call: Readonly<AssembledToolCall>): Record<string, unknown> | null {
  if (new TextEncoder().encode(call.function.arguments).byteLength > MAX_TOOL_ARGUMENT_BYTES) return null;
  try {
    const parsed = JSON.parse(call.function.arguments) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function parseCriticReviewToolCall(
  call: Readonly<AssembledToolCall>,
  expectedProposalId: string,
  expectedRevision: number,
): CriticWireToolResult {
  if (!validExpectedBinding(expectedProposalId, expectedRevision)) return { ok: false, code: 'INVALID_ARGUMENTS' };
  if (call.function.name !== CRITIC_TOOL_NAME) return { ok: false, code: 'UNKNOWN_TOOL' };

  const args = parseArguments(call);
  if (args === null || !hasOnlyKey(args, 'review')) return { ok: false, code: 'INVALID_ARGUMENTS' };

  const validation = validateCriticReview(args['review'], {
    expectedProposalId,
    expectedRevision,
  });
  if (!validation.ok) {
    return validation.code === 'STALE_VERDICT'
      ? { ok: false, code: 'STALE_REVIEW', validation }
      : { ok: false, code: 'INVALID_REVIEW', validation };
  }

  return {
    ok: true,
    toolCallId: call.id,
    review: validation.review,
  };
}
