export const CRITIC_FINDING_CODES = [
  'UNSUPPORTED_CLAIM',
  'PROVENANCE_RISK',
  'NUMERIC_INTEGRITY',
  'USER_INTENT_MISMATCH',
  'MANIPULATION_RISK',
  'ACCESSIBILITY_RISK',
  'EXECUTION_SAFETY',
  'ARTIFACT_TRUTH',
  'SECRET_OR_TOOL_ESCALATION',
] as const;
export type CriticFindingCode = (typeof CRITIC_FINDING_CODES)[number];
export type CriticVerdict = 'PASS' | 'REVISE' | 'BLOCK';
export type CriticFindingSeverity = 'revise' | 'block';

export interface CriticFinding {
  id: string;
  code: CriticFindingCode;
  severity: CriticFindingSeverity;
  summary: string;
  evidenceIds: readonly string[];
}

export interface CriticReview {
  schemaVersion: 1;
  proposalId: string;
  basedOnRevision: number;
  verdict: CriticVerdict;
  findings: readonly Readonly<CriticFinding>[];
}

export interface CriticReviewValidationOptions {
  expectedProposalId?: string;
  expectedRevision?: number;
}

export type CriticReviewValidation =
  | { ok: true; review: Readonly<CriticReview> }
  | { ok: false; code: 'INVALID_SHAPE' | 'INVALID_VALUE' | 'DUPLICATE_ID' | 'LIMIT_EXCEEDED' | 'UNSUPPORTED_FINDING' | 'INCONSISTENT_VERDICT' | 'STALE_VERDICT'; path: string };

export interface CriticCycleState {
  rootProposalId: string;
  currentProposalId: string;
  basedOnRevision: number;
  reviseCount: 0 | 1;
  awaitingRevision: boolean;
}

export type CriticGateResult =
  | { ok: true; action: 'COMMIT'; evaluatedProposalId: string; evaluatedRevision: number; state: Readonly<CriticCycleState> }
  | { ok: true; action: 'BLOCK'; state: Readonly<CriticCycleState> }
  | { ok: true; action: 'REVISE'; state: Readonly<CriticCycleState> }
  | { ok: false; code: 'STALE_VERDICT' | 'REVISE_LIMIT_REACHED' | 'REVISION_PENDING' };

export type CriticRebindResult =
  | { ok: true; state: Readonly<CriticCycleState> }
  | { ok: false; code: 'NO_REVISION_PENDING' | 'INVALID_REVISED_PROPOSAL' };

const SAFE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ROOT_KEYS = new Set(['schemaVersion', 'proposalId', 'basedOnRevision', 'verdict', 'findings']);
const FINDING_KEYS = new Set(['id', 'code', 'severity', 'summary', 'evidenceIds']);
const MAX_FINDINGS = 8;
const MAX_EVIDENCE_IDS = 16;

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function hasOnlyKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean { return Object.keys(value).every((key) => keys.has(key)); }
function safeId(value: unknown): value is string { return typeof value === 'string' && value.length >= 1 && value.length <= 96 && SAFE_ID_PATTERN.test(value); }
function boundedText(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 800 && !CONTROL_CHARACTER_PATTERN.test(value); }

function expectedVerdict(findings: readonly Readonly<CriticFinding>[]): CriticVerdict {
  if (findings.some((item) => item.severity === 'block')) return 'BLOCK';
  return findings.length > 0 ? 'REVISE' : 'PASS';
}

export function validateCriticReview(value: unknown, options: CriticReviewValidationOptions = {}): CriticReviewValidation {
  if (!isRecord(value) || !hasOnlyKeys(value, ROOT_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path: 'criticReview' };
  if (value['schemaVersion'] !== 1) return { ok: false, code: 'INVALID_VALUE', path: 'criticReview.schemaVersion' };
  if (!safeId(value['proposalId'])) return { ok: false, code: 'INVALID_VALUE', path: 'criticReview.proposalId' };
  if (!Number.isInteger(value['basedOnRevision']) || (value['basedOnRevision'] as number) < 0) return { ok: false, code: 'INVALID_VALUE', path: 'criticReview.basedOnRevision' };
  if (options.expectedProposalId !== undefined && value['proposalId'] !== options.expectedProposalId) return { ok: false, code: 'STALE_VERDICT', path: 'criticReview.proposalId' };
  if (options.expectedRevision !== undefined && value['basedOnRevision'] !== options.expectedRevision) return { ok: false, code: 'STALE_VERDICT', path: 'criticReview.basedOnRevision' };
  const verdict = value['verdict'];
  if (verdict !== 'PASS' && verdict !== 'REVISE' && verdict !== 'BLOCK') return { ok: false, code: 'INVALID_VALUE', path: 'criticReview.verdict' };
  const rawFindings = value['findings'];
  if (!Array.isArray(rawFindings)) return { ok: false, code: 'INVALID_SHAPE', path: 'criticReview.findings' };
  if (rawFindings.length > MAX_FINDINGS) return { ok: false, code: 'LIMIT_EXCEEDED', path: 'criticReview.findings' };

  const ids = new Set<string>();
  const findings: Readonly<CriticFinding>[] = [];
  for (let i = 0; i < rawFindings.length; i += 1) {
    const raw = rawFindings[i];
    const path = `criticReview.findings[${i}]`;
    if (!isRecord(raw) || !hasOnlyKeys(raw, FINDING_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path };
    if (!safeId(raw['id'])) return { ok: false, code: 'INVALID_VALUE', path: `${path}.id` };
    if (ids.has(raw['id'])) return { ok: false, code: 'DUPLICATE_ID', path: `${path}.id` };
    ids.add(raw['id']);
    const code = raw['code'];
    if (typeof code !== 'string' || !(CRITIC_FINDING_CODES as readonly string[]).includes(code)) return { ok: false, code: 'UNSUPPORTED_FINDING', path: `${path}.code` };
    const severity = raw['severity'];
    if (severity !== 'revise' && severity !== 'block') return { ok: false, code: 'INVALID_VALUE', path: `${path}.severity` };
    if (!boundedText(raw['summary'])) return { ok: false, code: 'INVALID_VALUE', path: `${path}.summary` };
    const evidenceIds = raw['evidenceIds'];
    if (!Array.isArray(evidenceIds) || evidenceIds.length > MAX_EVIDENCE_IDS || !evidenceIds.every(safeId) || new Set(evidenceIds).size !== evidenceIds.length) {
      return { ok: false, code: 'INVALID_VALUE', path: `${path}.evidenceIds` };
    }
    findings.push(Object.freeze({ id: raw['id'], code: code as CriticFindingCode, severity, summary: raw['summary'].trim(), evidenceIds: Object.freeze([...evidenceIds]) }));
  }

  if (verdict !== expectedVerdict(findings)) return { ok: false, code: 'INCONSISTENT_VERDICT', path: 'criticReview.verdict' };
  return { ok: true, review: Object.freeze({ schemaVersion: 1, proposalId: value['proposalId'], basedOnRevision: value['basedOnRevision'] as number, verdict, findings: Object.freeze(findings) }) };
}

export function createCriticCycleState(input: { proposalId: string; basedOnRevision: number }): Readonly<CriticCycleState> {
  if (!safeId(input.proposalId) || !Number.isInteger(input.basedOnRevision) || input.basedOnRevision < 0) throw new TypeError('invalid critic cycle seed');
  return Object.freeze({ rootProposalId: input.proposalId, currentProposalId: input.proposalId, basedOnRevision: input.basedOnRevision, reviseCount: 0, awaitingRevision: false });
}

export function bindRevisedProposal(state: Readonly<CriticCycleState>, input: { proposalId: string; basedOnRevision: number }): CriticRebindResult {
  if (!state.awaitingRevision) return { ok: false, code: 'NO_REVISION_PENDING' };
  if (!safeId(input.proposalId) || input.proposalId === state.currentProposalId || input.basedOnRevision !== state.basedOnRevision) return { ok: false, code: 'INVALID_REVISED_PROPOSAL' };
  return { ok: true, state: Object.freeze({ ...state, currentProposalId: input.proposalId, awaitingRevision: false }) };
}

export function applyCriticReview(
  state: Readonly<CriticCycleState>,
  review: Readonly<CriticReview>,
  current: { currentProposalId: string; currentRevision: number },
): CriticGateResult {
  if (state.awaitingRevision) return { ok: false, code: 'REVISION_PENDING' };
  if (
    current.currentProposalId !== state.currentProposalId ||
    current.currentRevision !== state.basedOnRevision ||
    review.proposalId !== state.currentProposalId ||
    review.basedOnRevision !== state.basedOnRevision
  ) return { ok: false, code: 'STALE_VERDICT' };

  if (review.verdict === 'PASS') return { ok: true, action: 'COMMIT', evaluatedProposalId: review.proposalId, evaluatedRevision: review.basedOnRevision, state };
  if (review.verdict === 'BLOCK') return { ok: true, action: 'BLOCK', state };
  if (state.reviseCount >= 1) return { ok: false, code: 'REVISE_LIMIT_REACHED' };
  return { ok: true, action: 'REVISE', state: Object.freeze({ ...state, reviseCount: 1, awaitingRevision: true }) };
}
