import { validateAgentIntent } from './agent-intent.ts';
import { ARTIFACT_KINDS } from './artifact-intent.ts';
import type {
  ArtifactProposal,
  CorrectionProposal,
  ExperienceProposal,
  ExperienceSceneProposal,
  FactProposal,
  ProcessMutationProposal,
} from './experience-proposal.ts';

export const EXPERIENCE_PROPOSAL_LIMITS = Object.freeze({
  narration: 4000,
  factProposals: 16,
  correctionProposals: 8,
  processMutations: 16,
  artifactProposals: 8,
  evidenceIds: 32,
  sceneIds: 16,
});

export type ExperienceProposalValidationErrorCode =
  | 'INVALID_SHAPE'
  | 'INVALID_VALUE'
  | 'DUPLICATE_ID'
  | 'LIMIT_EXCEEDED'
  | 'UNSUPPORTED_ACTION'
  | 'EXECUTABLE_SURFACE'
  | 'STALE_REVISION';

export type ExperienceProposalValidationResult =
  | { ok: true; proposal: Readonly<ExperienceProposal> }
  | { ok: false; code: ExperienceProposalValidationErrorCode; path: string };

export interface ExperienceValidationOptions {
  expectedBaseRevision?: number;
}

type ValidationFailure = Extract<ExperienceProposalValidationResult, { ok: false }>;
type ParseResult<T> = { ok: true; value: T } | ValidationFailure;

const SAFE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const EXECUTABLE_TEXT_PATTERN = /(?:<\/?script\b|javascript\s*:|data\s*:\s*text\/html|import\s*\(|require\s*\(|<\s*[A-Z][A-Za-z0-9]*(?:\s|\/?>))/i;
const FORBIDDEN_EXECUTABLE_KEYS = new Set([
  'html', 'rawHtml', 'dangerouslySetInnerHTML', 'jsx', 'tsx', 'script', 'javascript', 'css', 'style', 'styles',
  'component', 'componentPath', 'module', 'modulePath', 'import', 'require', 'handler', 'callback', 'code',
  'url', 'href', 'src', 'endpoint', 'command', 'shell', 'x', 'y', 'zoom', 'viewport', 'position', 'coordinates',
]);
const ROOT_KEYS = new Set([
  'schemaVersion', 'baseRevision', 'narration', 'intent', 'factProposals', 'correctionProposals', 'processMutations', 'sceneProposal', 'artifactProposals', 'criticRequired',
]);
const FACT_KEYS = new Set(['id', 'subject', 'predicate', 'value', 'source', 'supportingTurnIds']);
const CORRECTION_KEYS = new Set(['id', 'targetEvidenceId', 'reason', 'replacementValue', 'supportingTurnIds']);
const PROCESS_KEYS: Readonly<Record<ProcessMutationProposal['kind'], ReadonlySet<string>>> = {
  upsert_node: new Set(['id', 'kind', 'nodeId', 'label', 'summary', 'evidenceIds']),
  upsert_relationship: new Set(['id', 'kind', 'relationshipId', 'sourceNodeId', 'targetNodeId', 'label', 'evidenceIds']),
  remove_element: new Set(['id', 'kind', 'targetId', 'reason']),
  set_node_state: new Set(['id', 'kind', 'nodeId', 'state', 'reason']),
};
const SCENE_KEYS = new Set(['composition', 'focusIds', 'comparisonIds', 'announcement']);
const ARTIFACT_PROPOSAL_KEYS = new Set(['id', 'kind', 'title', 'summary', 'evidenceIds', 'status']);
const PROCESS_KINDS = ['upsert_node', 'upsert_relationship', 'remove_element', 'set_node_state'] as const;
const SCENE_COMPOSITIONS = ['stable', 'focus', 'compare', 'overview', 'artifact'] as const;
const PROCESS_NODE_STATES = ['active', 'hypothesis', 'invalidated'] as const;
const ARTIFACT_STATUSES = ['conceptual', 'prototype'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function findForbiddenKey(value: unknown, path = 'proposal'): string | null {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const found = findForbiddenKey(value[i], `${path}[${i}]`);
      if (found !== null) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_EXECUTABLE_KEYS.has(key)) return `${path}.${key}`;
    const found = findForbiddenKey(nested, `${path}.${key}`);
    if (found !== null) return found;
  }
  return null;
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 96 && SAFE_ID_PATTERN.test(value);
}

function parseId(value: unknown, path: string): ParseResult<string> {
  return safeId(value) ? { ok: true, value } : { ok: false, code: 'INVALID_VALUE', path };
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

function parseIdArray(value: unknown, path: string, maxLength: number, minLength = 0): ParseResult<readonly string[]> {
  if (!Array.isArray(value)) return { ok: false, code: 'INVALID_SHAPE', path };
  if (value.length < minLength || value.length > maxLength) return { ok: false, code: 'LIMIT_EXCEEDED', path };
  if (!value.every(safeId)) return { ok: false, code: 'INVALID_VALUE', path };
  if (new Set(value).size !== value.length) return { ok: false, code: 'DUPLICATE_ID', path };
  return { ok: true, value: Object.freeze([...value]) };
}

function parsePrimitive(value: unknown, path: string): ParseResult<string | number | boolean> {
  if (typeof value === 'string') return parseText(value, path, 1000);
  if (typeof value === 'number' && Number.isFinite(value)) return { ok: true, value };
  if (typeof value === 'boolean') return { ok: true, value };
  return { ok: false, code: 'INVALID_VALUE', path };
}

function parseFact(value: unknown, index: number): ParseResult<Readonly<FactProposal>> {
  const path = `proposal.factProposals[${index}]`;
  if (!isRecord(value) || !hasOnlyKeys(value, FACT_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path };
  const id = parseId(value['id'], `${path}.id`); if (!id.ok) return id;
  const subject = parseText(value['subject'], `${path}.subject`, 200); if (!subject.ok) return subject;
  const predicate = parseText(value['predicate'], `${path}.predicate`, 200); if (!predicate.ok) return predicate;
  const factValue = parsePrimitive(value['value'], `${path}.value`); if (!factValue.ok) return factValue;
  const source = value['source'];
  if (source !== 'user' && source !== 'inference' && source !== 'system') return { ok: false, code: 'INVALID_VALUE', path: `${path}.source` };
  const turns = parseIdArray(value['supportingTurnIds'], `${path}.supportingTurnIds`, EXPERIENCE_PROPOSAL_LIMITS.evidenceIds); if (!turns.ok) return turns;
  return { ok: true, value: Object.freeze({ id: id.value, subject: subject.value, predicate: predicate.value, value: factValue.value, source, supportingTurnIds: turns.value }) };
}

function parseCorrection(value: unknown, index: number): ParseResult<Readonly<CorrectionProposal>> {
  const path = `proposal.correctionProposals[${index}]`;
  if (!isRecord(value) || !hasOnlyKeys(value, CORRECTION_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path };
  const id = parseId(value['id'], `${path}.id`); if (!id.ok) return id;
  const targetEvidenceId = parseId(value['targetEvidenceId'], `${path}.targetEvidenceId`); if (!targetEvidenceId.ok) return targetEvidenceId;
  const reason = parseText(value['reason'], `${path}.reason`, 800); if (!reason.ok) return reason;
  const replacementValue = parsePrimitive(value['replacementValue'], `${path}.replacementValue`); if (!replacementValue.ok) return replacementValue;
  const turns = parseIdArray(value['supportingTurnIds'], `${path}.supportingTurnIds`, EXPERIENCE_PROPOSAL_LIMITS.evidenceIds); if (!turns.ok) return turns;
  return { ok: true, value: Object.freeze({ id: id.value, targetEvidenceId: targetEvidenceId.value, reason: reason.value, replacementValue: replacementValue.value, supportingTurnIds: turns.value }) };
}

function parseProcessMutation(value: unknown, index: number): ParseResult<Readonly<ProcessMutationProposal>> {
  const path = `proposal.processMutations[${index}]`;
  if (!isRecord(value)) return { ok: false, code: 'INVALID_SHAPE', path };
  const rawKind = value['kind'];
  if (typeof rawKind !== 'string' || !(PROCESS_KINDS as readonly string[]).includes(rawKind)) return { ok: false, code: 'INVALID_SHAPE', path: `${path}.kind` };
  const kind = rawKind as ProcessMutationProposal['kind'];
  if (!hasOnlyKeys(value, PROCESS_KEYS[kind])) return { ok: false, code: 'INVALID_SHAPE', path };
  const id = parseId(value['id'], `${path}.id`); if (!id.ok) return id;

  switch (kind) {
    case 'upsert_node': {
      const nodeId = parseId(value['nodeId'], `${path}.nodeId`); if (!nodeId.ok) return nodeId;
      const label = parseText(value['label'], `${path}.label`, 200); if (!label.ok) return label;
      const summary = parseText(value['summary'], `${path}.summary`, 1000); if (!summary.ok) return summary;
      const evidenceIds = parseIdArray(value['evidenceIds'], `${path}.evidenceIds`, EXPERIENCE_PROPOSAL_LIMITS.evidenceIds); if (!evidenceIds.ok) return evidenceIds;
      return { ok: true, value: Object.freeze({ id: id.value, kind, nodeId: nodeId.value, label: label.value, summary: summary.value, evidenceIds: evidenceIds.value }) };
    }
    case 'upsert_relationship': {
      const relationshipId = parseId(value['relationshipId'], `${path}.relationshipId`); if (!relationshipId.ok) return relationshipId;
      const sourceNodeId = parseId(value['sourceNodeId'], `${path}.sourceNodeId`); if (!sourceNodeId.ok) return sourceNodeId;
      const targetNodeId = parseId(value['targetNodeId'], `${path}.targetNodeId`); if (!targetNodeId.ok) return targetNodeId;
      const label = parseText(value['label'], `${path}.label`, 200); if (!label.ok) return label;
      const evidenceIds = parseIdArray(value['evidenceIds'], `${path}.evidenceIds`, EXPERIENCE_PROPOSAL_LIMITS.evidenceIds); if (!evidenceIds.ok) return evidenceIds;
      return { ok: true, value: Object.freeze({ id: id.value, kind, relationshipId: relationshipId.value, sourceNodeId: sourceNodeId.value, targetNodeId: targetNodeId.value, label: label.value, evidenceIds: evidenceIds.value }) };
    }
    case 'remove_element': {
      const targetId = parseId(value['targetId'], `${path}.targetId`); if (!targetId.ok) return targetId;
      const reason = parseText(value['reason'], `${path}.reason`, 600); if (!reason.ok) return reason;
      return { ok: true, value: Object.freeze({ id: id.value, kind, targetId: targetId.value, reason: reason.value }) };
    }
    case 'set_node_state': {
      const nodeId = parseId(value['nodeId'], `${path}.nodeId`); if (!nodeId.ok) return nodeId;
      const state = value['state'];
      if (!(PROCESS_NODE_STATES as readonly unknown[]).includes(state)) return { ok: false, code: 'INVALID_VALUE', path: `${path}.state` };
      const reason = parseText(value['reason'], `${path}.reason`, 600); if (!reason.ok) return reason;
      return { ok: true, value: Object.freeze({ id: id.value, kind, nodeId: nodeId.value, state: state as 'active' | 'hypothesis' | 'invalidated', reason: reason.value }) };
    }
  }
}

function parseScene(value: unknown): ParseResult<Readonly<ExperienceSceneProposal> | null> {
  if (value === null) return { ok: true, value: null };
  const path = 'proposal.sceneProposal';
  if (!isRecord(value) || !hasOnlyKeys(value, SCENE_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path };
  const composition = value['composition'];
  if (!(SCENE_COMPOSITIONS as readonly unknown[]).includes(composition)) return { ok: false, code: 'INVALID_VALUE', path: `${path}.composition` };
  const focusIds = parseIdArray(value['focusIds'], `${path}.focusIds`, EXPERIENCE_PROPOSAL_LIMITS.sceneIds); if (!focusIds.ok) return focusIds;
  const comparisonIds = parseIdArray(value['comparisonIds'], `${path}.comparisonIds`, EXPERIENCE_PROPOSAL_LIMITS.sceneIds); if (!comparisonIds.ok) return comparisonIds;
  const rawAnnouncement = value['announcement'];
  let announcement: string | null = null;
  if (rawAnnouncement !== null) {
    const parsed = parseText(rawAnnouncement, `${path}.announcement`, 600); if (!parsed.ok) return parsed;
    announcement = parsed.value;
  }
  return { ok: true, value: Object.freeze({ composition: composition as ExperienceSceneProposal['composition'], focusIds: focusIds.value, comparisonIds: comparisonIds.value, announcement }) };
}

function parseArtifactProposal(value: unknown, index: number): ParseResult<Readonly<ArtifactProposal>> {
  const path = `proposal.artifactProposals[${index}]`;
  if (!isRecord(value) || !hasOnlyKeys(value, ARTIFACT_PROPOSAL_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path };
  const id = parseId(value['id'], `${path}.id`); if (!id.ok) return id;
  const kind = value['kind'];
  if (!(ARTIFACT_KINDS as readonly unknown[]).includes(kind)) return { ok: false, code: 'INVALID_VALUE', path: `${path}.kind` };
  const title = parseText(value['title'], `${path}.title`, 240); if (!title.ok) return title;
  const summary = parseText(value['summary'], `${path}.summary`, 1200); if (!summary.ok) return summary;
  const evidenceIds = parseIdArray(value['evidenceIds'], `${path}.evidenceIds`, EXPERIENCE_PROPOSAL_LIMITS.evidenceIds); if (!evidenceIds.ok) return evidenceIds;
  const status = value['status'];
  if (!(ARTIFACT_STATUSES as readonly unknown[]).includes(status)) return { ok: false, code: 'INVALID_VALUE', path: `${path}.status` };
  return { ok: true, value: Object.freeze({ id: id.value, kind: kind as ArtifactProposal['kind'], title: title.value, summary: summary.value, evidenceIds: evidenceIds.value, status: status as ArtifactProposal['status'] }) };
}

function parseCollection<T extends { id: string }>(
  value: unknown,
  path: string,
  limit: number,
  parser: (entry: unknown, index: number) => ParseResult<Readonly<T>>,
): ParseResult<readonly Readonly<T>[]> {
  if (!Array.isArray(value)) return { ok: false, code: 'INVALID_SHAPE', path };
  if (value.length > limit) return { ok: false, code: 'LIMIT_EXCEEDED', path };
  const output: Readonly<T>[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < value.length; i += 1) {
    const parsed = parser(value[i], i);
    if (!parsed.ok) return parsed;
    if (ids.has(parsed.value.id)) return { ok: false, code: 'DUPLICATE_ID', path: `${path}[${i}].id` };
    ids.add(parsed.value.id);
    output.push(parsed.value);
  }
  return { ok: true, value: Object.freeze(output) };
}

function addGlobalId(ids: Set<string>, id: string, path: string): ValidationFailure | null {
  if (ids.has(id)) return { ok: false, code: 'DUPLICATE_ID', path };
  ids.add(id);
  return null;
}

export function validateExperienceProposal(value: unknown, options: ExperienceValidationOptions = {}): ExperienceProposalValidationResult {
  const forbiddenPath = findForbiddenKey(value);
  if (forbiddenPath !== null) return { ok: false, code: 'EXECUTABLE_SURFACE', path: forbiddenPath };
  if (!isRecord(value) || !hasOnlyKeys(value, ROOT_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path: 'proposal' };
  if (value['schemaVersion'] !== 1) return { ok: false, code: 'INVALID_VALUE', path: 'proposal.schemaVersion' };

  const baseRevision = value['baseRevision'];
  if (!Number.isInteger(baseRevision) || (baseRevision as number) < 0) return { ok: false, code: 'INVALID_VALUE', path: 'proposal.baseRevision' };
  if (options.expectedBaseRevision !== undefined && baseRevision !== options.expectedBaseRevision) {
    return { ok: false, code: 'STALE_REVISION', path: 'proposal.baseRevision' };
  }

  const narration = parseText(value['narration'], 'proposal.narration', EXPERIENCE_PROPOSAL_LIMITS.narration);
  if (!narration.ok) return narration;

  const intent = validateAgentIntent(value['intent']);
  if (!intent.ok) return { ok: false, code: intent.code, path: `proposal.${intent.path}` };

  const factProposals = parseCollection<FactProposal>(value['factProposals'], 'proposal.factProposals', EXPERIENCE_PROPOSAL_LIMITS.factProposals, parseFact);
  if (!factProposals.ok) return factProposals;
  const correctionProposals = parseCollection<CorrectionProposal>(value['correctionProposals'], 'proposal.correctionProposals', EXPERIENCE_PROPOSAL_LIMITS.correctionProposals, parseCorrection);
  if (!correctionProposals.ok) return correctionProposals;
  const processMutations = parseCollection<ProcessMutationProposal>(value['processMutations'], 'proposal.processMutations', EXPERIENCE_PROPOSAL_LIMITS.processMutations, parseProcessMutation);
  if (!processMutations.ok) return processMutations;
  const sceneProposal = parseScene(value['sceneProposal']);
  if (!sceneProposal.ok) return sceneProposal;
  const artifactProposals = parseCollection<ArtifactProposal>(value['artifactProposals'], 'proposal.artifactProposals', EXPERIENCE_PROPOSAL_LIMITS.artifactProposals, parseArtifactProposal);
  if (!artifactProposals.ok) return artifactProposals;

  const criticRequired = value['criticRequired'];
  if (typeof criticRequired !== 'boolean') return { ok: false, code: 'INVALID_VALUE', path: 'proposal.criticRequired' };

  const globalIds = new Set<string>();
  for (let i = 0; i < intent.value.actions.length; i += 1) {
    const item = intent.value.actions[i]; if (item === undefined) continue;
    const duplicate = addGlobalId(globalIds, item.id, `proposal.intent.actions[${i}].id`); if (duplicate) return duplicate;
  }
  for (let i = 0; i < intent.value.quantitativeOpportunities.length; i += 1) {
    const item = intent.value.quantitativeOpportunities[i]; if (item === undefined) continue;
    const duplicate = addGlobalId(globalIds, item.id, `proposal.intent.quantitativeOpportunities[${i}].id`); if (duplicate) return duplicate;
  }
  for (let i = 0; i < intent.value.artifactIntents.length; i += 1) {
    const item = intent.value.artifactIntents[i]; if (item?.id === undefined) continue;
    const duplicate = addGlobalId(globalIds, item.id, `proposal.intent.artifactIntents[${i}].id`); if (duplicate) return duplicate;
  }
  for (const [path, collection] of [
    ['proposal.factProposals', factProposals.value],
    ['proposal.correctionProposals', correctionProposals.value],
    ['proposal.processMutations', processMutations.value],
    ['proposal.artifactProposals', artifactProposals.value],
  ] as const) {
    for (let i = 0; i < collection.length; i += 1) {
      const item = collection[i]; if (item === undefined) continue;
      const duplicate = addGlobalId(globalIds, item.id, `${path}[${i}].id`); if (duplicate) return duplicate;
    }
  }

  return {
    ok: true,
    proposal: Object.freeze({
      schemaVersion: 1,
      baseRevision: baseRevision as number,
      narration: narration.value,
      intent: intent.value,
      factProposals: factProposals.value,
      correctionProposals: correctionProposals.value,
      processMutations: processMutations.value,
      sceneProposal: sceneProposal.value,
      artifactProposals: artifactProposals.value,
      criticRequired,
    }),
  };
}

export function assertValidExperienceProposal(value: unknown, options: ExperienceValidationOptions = {}): Readonly<ExperienceProposal> {
  const result = validateExperienceProposal(value, options);
  if (!result.ok) throw new TypeError(`${result.code}:${result.path}`);
  return result.proposal;
}
