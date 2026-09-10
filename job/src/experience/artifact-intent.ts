export const ARTIFACT_KINDS = [
  'operational_object',
  'data_import_preview',
  'presentation',
  'bi_dashboard',
  'training_module',
  'workflow_concept',
  'prototype',
] as const;

export type ArtifactKind = (typeof ARTIFACT_KINDS)[number];

export const ARTIFACT_AUDIENCES = ['owner', 'manager', 'operator', 'client', 'mixed'] as const;
export type ArtifactAudience = (typeof ARTIFACT_AUDIENCES)[number];

export interface ArtifactIntent {
  id?: string;
  kind: ArtifactKind;
  objective: string;
  evidenceIds: readonly string[];
  audience: ArtifactAudience;
  desiredImpact: string;
  workshopRequired: boolean;
}

export type ArtifactIntentValidationErrorCode =
  | 'INVALID_SHAPE'
  | 'INVALID_VALUE'
  | 'LIMIT_EXCEEDED'
  | 'EXECUTABLE_SURFACE';

export type ArtifactIntentValidationResult =
  | { ok: true; value: Readonly<ArtifactIntent> }
  | { ok: false; code: ArtifactIntentValidationErrorCode; path: string };

type ValidationFailure = Extract<ArtifactIntentValidationResult, { ok: false }>;
type ParseResult<T> = { ok: true; value: T } | ValidationFailure;

const SAFE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const EXECUTABLE_TEXT_PATTERN = /(?:<\/?script\b|javascript\s*:|data\s*:\s*text\/html|import\s*\(|require\s*\(|<\s*[A-Z][A-Za-z0-9]*(?:\s|\/?>))/i;
const ARTIFACT_KEYS = new Set(['id', 'kind', 'objective', 'evidenceIds', 'audience', 'desiredImpact', 'workshopRequired']);
const MAX_EVIDENCE_IDS = 32;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeId(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= 96 && SAFE_ID_PATTERN.test(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
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

function parseEvidenceIds(value: unknown, path: string): ParseResult<readonly string[]> {
  if (!Array.isArray(value)) return { ok: false, code: 'INVALID_SHAPE', path };
  if (value.length > MAX_EVIDENCE_IDS) return { ok: false, code: 'LIMIT_EXCEEDED', path };
  if (!value.every(safeId)) return { ok: false, code: 'INVALID_VALUE', path };
  if (new Set(value).size !== value.length) return { ok: false, code: 'INVALID_VALUE', path };
  return { ok: true, value: Object.freeze([...value]) };
}

export function validateArtifactIntent(value: unknown): ArtifactIntentValidationResult {
  if (!isRecord(value) || !hasOnlyKeys(value, ARTIFACT_KEYS)) {
    return { ok: false, code: 'INVALID_SHAPE', path: 'artifactIntent' };
  }

  const id = value['id'];
  if (id !== undefined && !safeId(id)) return { ok: false, code: 'INVALID_VALUE', path: 'artifactIntent.id' };

  const kind = value['kind'];
  if (!(ARTIFACT_KINDS as readonly unknown[]).includes(kind)) {
    return { ok: false, code: 'INVALID_VALUE', path: 'artifactIntent.kind' };
  }

  const objective = parseText(value['objective'], 'artifactIntent.objective', 600);
  if (!objective.ok) return objective;

  const evidenceIds = parseEvidenceIds(value['evidenceIds'], 'artifactIntent.evidenceIds');
  if (!evidenceIds.ok) return evidenceIds;

  const audience = value['audience'];
  if (!(ARTIFACT_AUDIENCES as readonly unknown[]).includes(audience)) {
    return { ok: false, code: 'INVALID_VALUE', path: 'artifactIntent.audience' };
  }

  const desiredImpact = parseText(value['desiredImpact'], 'artifactIntent.desiredImpact', 600);
  if (!desiredImpact.ok) return desiredImpact;

  const workshopRequired = value['workshopRequired'];
  if (typeof workshopRequired !== 'boolean') {
    return { ok: false, code: 'INVALID_VALUE', path: 'artifactIntent.workshopRequired' };
  }

  const normalized: ArtifactIntent = {
    ...(id === undefined ? {} : { id }),
    kind: kind as ArtifactKind,
    objective: objective.value,
    evidenceIds: evidenceIds.value,
    audience: audience as ArtifactAudience,
    desiredImpact: desiredImpact.value,
    workshopRequired,
  };
  return { ok: true, value: Object.freeze(normalized) };
}

export function createArtifactIntent(value: ArtifactIntent): Readonly<ArtifactIntent> {
  const result = validateArtifactIntent(value);
  if (!result.ok) throw new TypeError(`${result.code}:${result.path}`);
  return result.value;
}
