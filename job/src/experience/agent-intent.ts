import { CAPABILITY_KINDS } from '../ai/context/canonical-sales-context.ts';
import type { CapabilityKind } from '../ai/context/canonical-sales-context.ts';
import { validateArtifactIntent } from './artifact-intent.ts';
import type { ArtifactIntent } from './artifact-intent.ts';

export { CAPABILITY_KINDS };
export type { CapabilityKind };

export const EXPERIENCE_ACTION_KINDS = [
  'focus',
  'compare',
  'annotate',
  'reveal',
  'group',
  'de_emphasize',
  'quantify',
  'demonstrate',
  'explain_relationship',
  'stage_artifact',
  'request_workshop',
] as const;
export type ExperienceActionKind = (typeof EXPERIENCE_ACTION_KINDS)[number];

export type ExperienceAction =
  | { id: string; kind: 'focus'; targetId: string; reason: string }
  | { id: string; kind: 'compare'; targetIds: readonly string[]; reason: string }
  | { id: string; kind: 'annotate'; targetId: string; text: string; evidenceIds: readonly string[] }
  | { id: string; kind: 'reveal'; targetId: string; reason: string }
  | { id: string; kind: 'group'; groupId: string; memberIds: readonly string[]; label: string }
  | { id: string; kind: 'de_emphasize'; targetIds: readonly string[]; reason: string }
  | { id: string; kind: 'quantify'; calculationId: string; targetId: string | null; reason: string }
  | { id: string; kind: 'demonstrate'; artifactIntentId: string; reason: string }
  | { id: string; kind: 'explain_relationship'; sourceId: string; targetId: string; text: string }
  | { id: string; kind: 'stage_artifact'; artifactIntentId: string; reason: string }
  | { id: string; kind: 'request_workshop'; artifactIntentId: string; reason: string };

export const QUANTITATIVE_OPPORTUNITY_KINDS = [
  'monthly_capacity',
  'monthly_workload',
  'monthly_cost',
  'rework_volume',
  'other',
] as const;
export type QuantitativeOpportunityKind = (typeof QUANTITATIVE_OPPORTUNITY_KINDS)[number];

export interface QuantitativeOpportunity {
  id: string;
  kind: QuantitativeOpportunityKind;
  objective: string;
  evidenceIds: readonly string[];
  missingInputs: readonly string[];
}

export interface NextQuestion {
  text: string;
  objective?: string;
  evidenceIds?: readonly string[];
}

export interface AgentIntent {
  schemaVersion: 1;
  objective: string;
  rationale: string;
  capabilities: readonly CapabilityKind[];
  actions: readonly ExperienceAction[];
  quantitativeOpportunities: readonly QuantitativeOpportunity[];
  artifactIntents: readonly ArtifactIntent[];
  nextQuestion: NextQuestion | null;
}

export const AGENT_INTENT_LIMITS = Object.freeze({
  actions: 12,
  quantitativeOpportunities: 8,
  artifactIntents: 6,
  actionTargetIds: 12,
  evidenceIds: 32,
  missingInputs: 12,
});

export type AgentIntentValidationErrorCode =
  | 'INVALID_SHAPE'
  | 'INVALID_VALUE'
  | 'DUPLICATE_ID'
  | 'LIMIT_EXCEEDED'
  | 'UNSUPPORTED_ACTION'
  | 'EXECUTABLE_SURFACE';

export type AgentIntentValidationResult =
  | { ok: true; value: Readonly<AgentIntent> }
  | { ok: false; code: AgentIntentValidationErrorCode; path: string };

type ValidationFailure = Extract<AgentIntentValidationResult, { ok: false }>;
type ParseResult<T> = { ok: true; value: T } | ValidationFailure;

const SAFE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const EXECUTABLE_TEXT_PATTERN = /(?:<\/?script\b|javascript\s*:|data\s*:\s*text\/html|import\s*\(|require\s*\(|<\s*[A-Z][A-Za-z0-9]*(?:\s|\/?>))/i;
const AGENT_INTENT_KEYS = new Set([
  'schemaVersion', 'objective', 'rationale', 'capabilities', 'actions', 'quantitativeOpportunities', 'artifactIntents', 'nextQuestion',
]);
const NEXT_QUESTION_KEYS = new Set(['text', 'objective', 'evidenceIds']);
const QUANT_OPPORTUNITY_KEYS = new Set(['id', 'kind', 'objective', 'evidenceIds', 'missingInputs']);

const ACTION_KEYS: Readonly<Record<ExperienceActionKind, ReadonlySet<string>>> = {
  focus: new Set(['id', 'kind', 'targetId', 'reason']),
  compare: new Set(['id', 'kind', 'targetIds', 'reason']),
  annotate: new Set(['id', 'kind', 'targetId', 'text', 'evidenceIds']),
  reveal: new Set(['id', 'kind', 'targetId', 'reason']),
  group: new Set(['id', 'kind', 'groupId', 'memberIds', 'label']),
  de_emphasize: new Set(['id', 'kind', 'targetIds', 'reason']),
  quantify: new Set(['id', 'kind', 'calculationId', 'targetId', 'reason']),
  demonstrate: new Set(['id', 'kind', 'artifactIntentId', 'reason']),
  explain_relationship: new Set(['id', 'kind', 'sourceId', 'targetId', 'text']),
  stage_artifact: new Set(['id', 'kind', 'artifactIntentId', 'reason']),
  request_workshop: new Set(['id', 'kind', 'artifactIntentId', 'reason']),
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 96 && SAFE_ID_PATTERN.test(value);
}

function parseText(value: unknown, path: string, maxLength: number): ParseResult<string> {
  if (typeof value !== 'string') return { ok: false, code: 'INVALID_VALUE', path };
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || CONTROL_CHARACTER_PATTERN.test(value)) {
    return { ok: false, code: 'INVALID_VALUE', path };
  }
  if (EXECUTABLE_TEXT_PATTERN.test(value)) return { ok: false, code: 'EXECUTABLE_SURFACE', path };
  return { ok: true, value: trimmed };
}

function parseId(value: unknown, path: string): ParseResult<string> {
  return safeId(value) ? { ok: true, value } : { ok: false, code: 'INVALID_VALUE', path };
}

function parseIdArray(value: unknown, path: string, maxLength: number, minLength = 0): ParseResult<readonly string[]> {
  if (!Array.isArray(value)) return { ok: false, code: 'INVALID_SHAPE', path };
  if (value.length < minLength || value.length > maxLength) return { ok: false, code: 'LIMIT_EXCEEDED', path };
  if (!value.every(safeId)) return { ok: false, code: 'INVALID_VALUE', path };
  if (new Set(value).size !== value.length) return { ok: false, code: 'DUPLICATE_ID', path };
  return { ok: true, value: Object.freeze([...value]) };
}

function parseAction(value: unknown, index: number): ParseResult<Readonly<ExperienceAction>> {
  const path = `agentIntent.actions[${index}]`;
  if (!isRecord(value)) return { ok: false, code: 'INVALID_SHAPE', path };
  const rawKind = value['kind'];
  if (typeof rawKind !== 'string') return { ok: false, code: 'INVALID_SHAPE', path: `${path}.kind` };
  if (!(EXPERIENCE_ACTION_KINDS as readonly string[]).includes(rawKind)) {
    return { ok: false, code: 'UNSUPPORTED_ACTION', path: `${path}.kind` };
  }
  const kind = rawKind as ExperienceActionKind;
  if (!hasOnlyKeys(value, ACTION_KEYS[kind])) return { ok: false, code: 'INVALID_SHAPE', path };

  const id = parseId(value['id'], `${path}.id`);
  if (!id.ok) return id;

  switch (kind) {
    case 'focus':
    case 'reveal': {
      const targetId = parseId(value['targetId'], `${path}.targetId`);
      if (!targetId.ok) return targetId;
      const reason = parseText(value['reason'], `${path}.reason`, 600);
      if (!reason.ok) return reason;
      return { ok: true, value: Object.freeze({ id: id.value, kind, targetId: targetId.value, reason: reason.value }) };
    }
    case 'compare':
    case 'de_emphasize': {
      const targetIds = parseIdArray(value['targetIds'], `${path}.targetIds`, AGENT_INTENT_LIMITS.actionTargetIds, kind === 'compare' ? 2 : 1);
      if (!targetIds.ok) return targetIds;
      const reason = parseText(value['reason'], `${path}.reason`, 600);
      if (!reason.ok) return reason;
      return { ok: true, value: Object.freeze({ id: id.value, kind, targetIds: targetIds.value, reason: reason.value }) };
    }
    case 'annotate': {
      const targetId = parseId(value['targetId'], `${path}.targetId`);
      if (!targetId.ok) return targetId;
      const text = parseText(value['text'], `${path}.text`, 1000);
      if (!text.ok) return text;
      const evidenceIds = parseIdArray(value['evidenceIds'], `${path}.evidenceIds`, AGENT_INTENT_LIMITS.evidenceIds);
      if (!evidenceIds.ok) return evidenceIds;
      return { ok: true, value: Object.freeze({ id: id.value, kind, targetId: targetId.value, text: text.value, evidenceIds: evidenceIds.value }) };
    }
    case 'group': {
      const groupId = parseId(value['groupId'], `${path}.groupId`);
      if (!groupId.ok) return groupId;
      const memberIds = parseIdArray(value['memberIds'], `${path}.memberIds`, AGENT_INTENT_LIMITS.actionTargetIds, 2);
      if (!memberIds.ok) return memberIds;
      const label = parseText(value['label'], `${path}.label`, 200);
      if (!label.ok) return label;
      return { ok: true, value: Object.freeze({ id: id.value, kind, groupId: groupId.value, memberIds: memberIds.value, label: label.value }) };
    }
    case 'quantify': {
      const calculationId = parseId(value['calculationId'], `${path}.calculationId`);
      if (!calculationId.ok) return calculationId;
      const rawTargetId = value['targetId'];
      if (rawTargetId !== null && !safeId(rawTargetId)) return { ok: false, code: 'INVALID_VALUE', path: `${path}.targetId` };
      const reason = parseText(value['reason'], `${path}.reason`, 600);
      if (!reason.ok) return reason;
      return { ok: true, value: Object.freeze({ id: id.value, kind, calculationId: calculationId.value, targetId: rawTargetId, reason: reason.value }) };
    }
    case 'demonstrate':
    case 'stage_artifact':
    case 'request_workshop': {
      const artifactIntentId = parseId(value['artifactIntentId'], `${path}.artifactIntentId`);
      if (!artifactIntentId.ok) return artifactIntentId;
      const reason = parseText(value['reason'], `${path}.reason`, 600);
      if (!reason.ok) return reason;
      return { ok: true, value: Object.freeze({ id: id.value, kind, artifactIntentId: artifactIntentId.value, reason: reason.value }) };
    }
    case 'explain_relationship': {
      const sourceId = parseId(value['sourceId'], `${path}.sourceId`);
      if (!sourceId.ok) return sourceId;
      const targetId = parseId(value['targetId'], `${path}.targetId`);
      if (!targetId.ok) return targetId;
      const text = parseText(value['text'], `${path}.text`, 1000);
      if (!text.ok) return text;
      return { ok: true, value: Object.freeze({ id: id.value, kind, sourceId: sourceId.value, targetId: targetId.value, text: text.value }) };
    }
  }
}

function parseQuantitativeOpportunity(value: unknown, index: number): ParseResult<Readonly<QuantitativeOpportunity>> {
  const path = `agentIntent.quantitativeOpportunities[${index}]`;
  if (!isRecord(value) || !hasOnlyKeys(value, QUANT_OPPORTUNITY_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path };

  const id = parseId(value['id'], `${path}.id`);
  if (!id.ok) return id;

  const kind = value['kind'];
  if (!(QUANTITATIVE_OPPORTUNITY_KINDS as readonly unknown[]).includes(kind)) {
    return { ok: false, code: 'INVALID_VALUE', path: `${path}.kind` };
  }

  const objective = parseText(value['objective'], `${path}.objective`, 600);
  if (!objective.ok) return objective;

  const evidenceIds = parseIdArray(value['evidenceIds'], `${path}.evidenceIds`, AGENT_INTENT_LIMITS.evidenceIds);
  if (!evidenceIds.ok) return evidenceIds;

  const rawMissingInputs = value['missingInputs'];
  if (!Array.isArray(rawMissingInputs)) return { ok: false, code: 'INVALID_SHAPE', path: `${path}.missingInputs` };
  if (rawMissingInputs.length > AGENT_INTENT_LIMITS.missingInputs) return { ok: false, code: 'LIMIT_EXCEEDED', path: `${path}.missingInputs` };
  const missingInputs: string[] = [];
  for (let i = 0; i < rawMissingInputs.length; i += 1) {
    const item = parseText(rawMissingInputs[i], `${path}.missingInputs[${i}]`, 200);
    if (!item.ok) return item;
    missingInputs.push(item.value);
  }
  if (new Set(missingInputs).size !== missingInputs.length) return { ok: false, code: 'INVALID_VALUE', path: `${path}.missingInputs` };

  return {
    ok: true,
    value: Object.freeze({
      id: id.value,
      kind: kind as QuantitativeOpportunityKind,
      objective: objective.value,
      evidenceIds: evidenceIds.value,
      missingInputs: Object.freeze(missingInputs),
    }),
  };
}

function parseNextQuestion(value: unknown): ParseResult<Readonly<NextQuestion> | null> {
  if (value === null) return { ok: true, value: null };
  const path = 'agentIntent.nextQuestion';
  if (!isRecord(value) || !hasOnlyKeys(value, NEXT_QUESTION_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path };

  const text = parseText(value['text'], `${path}.text`, 800);
  if (!text.ok) return text;

  const rawObjective = value['objective'];
  let objective: string | undefined;
  if (rawObjective !== undefined) {
    const parsed = parseText(rawObjective, `${path}.objective`, 400);
    if (!parsed.ok) return parsed;
    objective = parsed.value;
  }

  const rawEvidenceIds = value['evidenceIds'];
  let evidenceIds: readonly string[] | undefined;
  if (rawEvidenceIds !== undefined) {
    const parsed = parseIdArray(rawEvidenceIds, `${path}.evidenceIds`, AGENT_INTENT_LIMITS.evidenceIds);
    if (!parsed.ok) return parsed;
    evidenceIds = parsed.value;
  }

  const normalized: NextQuestion = {
    text: text.value,
    ...(objective === undefined ? {} : { objective }),
    ...(evidenceIds === undefined ? {} : { evidenceIds }),
  };
  return { ok: true, value: Object.freeze(normalized) };
}

export function validateAgentIntent(value: unknown): AgentIntentValidationResult {
  if (!isRecord(value) || !hasOnlyKeys(value, AGENT_INTENT_KEYS)) {
    return { ok: false, code: 'INVALID_SHAPE', path: 'agentIntent' };
  }
  if (value['schemaVersion'] !== 1) return { ok: false, code: 'INVALID_VALUE', path: 'agentIntent.schemaVersion' };

  const objective = parseText(value['objective'], 'agentIntent.objective', 1200);
  if (!objective.ok) return objective;
  const rationale = parseText(value['rationale'], 'agentIntent.rationale', 2000);
  if (!rationale.ok) return rationale;

  const rawCapabilities = value['capabilities'];
  if (!Array.isArray(rawCapabilities)) return { ok: false, code: 'INVALID_SHAPE', path: 'agentIntent.capabilities' };
  if (!rawCapabilities.every((item) => (CAPABILITY_KINDS as readonly unknown[]).includes(item))) {
    return { ok: false, code: 'INVALID_VALUE', path: 'agentIntent.capabilities' };
  }
  if (new Set(rawCapabilities).size !== rawCapabilities.length) return { ok: false, code: 'DUPLICATE_ID', path: 'agentIntent.capabilities' };
  const capabilities = Object.freeze([...rawCapabilities]) as readonly CapabilityKind[];

  const rawActions = value['actions'];
  if (!Array.isArray(rawActions)) return { ok: false, code: 'INVALID_SHAPE', path: 'agentIntent.actions' };
  if (rawActions.length > AGENT_INTENT_LIMITS.actions) return { ok: false, code: 'LIMIT_EXCEEDED', path: 'agentIntent.actions' };
  const actions: Readonly<ExperienceAction>[] = [];
  const actionIds = new Set<string>();
  for (let i = 0; i < rawActions.length; i += 1) {
    const parsed = parseAction(rawActions[i], i);
    if (!parsed.ok) return parsed;
    if (actionIds.has(parsed.value.id)) return { ok: false, code: 'DUPLICATE_ID', path: `agentIntent.actions[${i}].id` };
    actionIds.add(parsed.value.id);
    actions.push(parsed.value);
  }

  const rawOpportunities = value['quantitativeOpportunities'];
  if (!Array.isArray(rawOpportunities)) return { ok: false, code: 'INVALID_SHAPE', path: 'agentIntent.quantitativeOpportunities' };
  if (rawOpportunities.length > AGENT_INTENT_LIMITS.quantitativeOpportunities) {
    return { ok: false, code: 'LIMIT_EXCEEDED', path: 'agentIntent.quantitativeOpportunities' };
  }
  const quantitativeOpportunities: Readonly<QuantitativeOpportunity>[] = [];
  const opportunityIds = new Set<string>();
  for (let i = 0; i < rawOpportunities.length; i += 1) {
    const parsed = parseQuantitativeOpportunity(rawOpportunities[i], i);
    if (!parsed.ok) return parsed;
    if (opportunityIds.has(parsed.value.id)) return { ok: false, code: 'DUPLICATE_ID', path: `agentIntent.quantitativeOpportunities[${i}].id` };
    opportunityIds.add(parsed.value.id);
    quantitativeOpportunities.push(parsed.value);
  }

  const rawArtifactIntents = value['artifactIntents'];
  if (!Array.isArray(rawArtifactIntents)) return { ok: false, code: 'INVALID_SHAPE', path: 'agentIntent.artifactIntents' };
  if (rawArtifactIntents.length > AGENT_INTENT_LIMITS.artifactIntents) return { ok: false, code: 'LIMIT_EXCEEDED', path: 'agentIntent.artifactIntents' };
  const artifactIntents: Readonly<ArtifactIntent>[] = [];
  const artifactIntentIds = new Set<string>();
  for (let i = 0; i < rawArtifactIntents.length; i += 1) {
    const parsed = validateArtifactIntent(rawArtifactIntents[i]);
    if (!parsed.ok) return { ok: false, code: parsed.code, path: `agentIntent.artifactIntents[${i}].${parsed.path}` };
    if (parsed.value.id !== undefined) {
      if (artifactIntentIds.has(parsed.value.id)) return { ok: false, code: 'DUPLICATE_ID', path: `agentIntent.artifactIntents[${i}].id` };
      artifactIntentIds.add(parsed.value.id);
    }
    artifactIntents.push(parsed.value);
  }

  for (let i = 0; i < actions.length; i += 1) {
    const action = actions[i];
    if (action === undefined) continue;
    if (action.kind === 'demonstrate' || action.kind === 'stage_artifact' || action.kind === 'request_workshop') {
      if (!artifactIntentIds.has(action.artifactIntentId)) {
        return { ok: false, code: 'INVALID_VALUE', path: `agentIntent.actions[${i}].artifactIntentId` };
      }
    }
  }

  const nextQuestion = parseNextQuestion(value['nextQuestion']);
  if (!nextQuestion.ok) return nextQuestion;

  return {
    ok: true,
    value: Object.freeze({
      schemaVersion: 1,
      objective: objective.value,
      rationale: rationale.value,
      capabilities,
      actions: Object.freeze(actions),
      quantitativeOpportunities: Object.freeze(quantitativeOpportunities),
      artifactIntents: Object.freeze(artifactIntents),
      nextQuestion: nextQuestion.value,
    }),
  };
}

export function assertValidAgentIntent(value: unknown): Readonly<AgentIntent> {
  const result = validateAgentIntent(value);
  if (!result.ok) throw new TypeError(`${result.code}:${result.path}`);
  return result.value;
}
