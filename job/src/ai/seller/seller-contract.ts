import type { CanonicalSalesContext } from '../context/canonical-sales-context.ts';
import type { CalculationRequest } from '../quant/quantity-types.ts';
import { evaluateHardBlocks, type HardBlockFinding } from '../critic/hard-blocks.ts';
import { validateExperienceProposal } from '../../experience/experience-validation.ts';
import type { ExperienceProposal } from '../../experience/experience-proposal.ts';

export const SELLER_MATERIAL_CLAIM_KINDS = [
  'verified_numeric', 'qualitative', 'feasibility', 'price', 'discount', 'attachment_access', 'secret_access', 'tool_escalation', 'artifact_readiness',
] as const;
export type SellerMaterialClaimKind = (typeof SELLER_MATERIAL_CLAIM_KINDS)[number];

interface SellerClaimBase { id: string; kind: SellerMaterialClaimKind; text: string }
export type SellerMaterialClaim =
  | (SellerClaimBase & { kind: 'verified_numeric'; calculationId: string })
  | (SellerClaimBase & { kind: 'qualitative'; evidenceIds: readonly string[] })
  | (SellerClaimBase & { kind: 'feasibility'; state: 'unknown' | 'conditional' | 'confirmed'; evidenceIds: readonly string[] })
  | (SellerClaimBase & { kind: 'price' | 'discount' | 'attachment_access' | 'secret_access' | 'tool_escalation' })
  | (SellerClaimBase & { kind: 'artifact_readiness'; artifactId: string; readiness: 'conceptual' | 'prototype' | 'production' });

export interface SellerSubmission {
  schemaVersion: 1;
  proposalId: string;
  proposal: Readonly<ExperienceProposal>;
  materialClaims: readonly Readonly<SellerMaterialClaim>[];
  calculationRequests: readonly Readonly<CalculationRequest>[];
}

export interface SellerValidationOptions {
  canonical: CanonicalSalesContext;
}

export type SellerSubmissionValidation =
  | { ok: true; submission: Readonly<SellerSubmission> }
  | { ok: false; code: 'INVALID_SHAPE' | 'INVALID_VALUE' | 'DUPLICATE_ID' | 'LIMIT_EXCEEDED' | 'PROPOSAL_INVALID'; path: string }
  | { ok: false; code: 'HARD_BLOCK'; path: string; finding: HardBlockFinding };

type SellerValidationFailure = Extract<SellerSubmissionValidation, { ok: false }>;

const SAFE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const ROOT_KEYS = new Set(['schemaVersion', 'proposalId', 'proposal', 'materialClaims', 'calculationRequests']);
const CLAIM_KEYS: Readonly<Record<SellerMaterialClaimKind, ReadonlySet<string>>> = {
  verified_numeric: new Set(['id', 'kind', 'text', 'calculationId']),
  qualitative: new Set(['id', 'kind', 'text', 'evidenceIds']),
  feasibility: new Set(['id', 'kind', 'text', 'state', 'evidenceIds']),
  price: new Set(['id', 'kind', 'text']),
  discount: new Set(['id', 'kind', 'text']),
  attachment_access: new Set(['id', 'kind', 'text']),
  secret_access: new Set(['id', 'kind', 'text']),
  tool_escalation: new Set(['id', 'kind', 'text']),
  artifact_readiness: new Set(['id', 'kind', 'text', 'artifactId', 'readiness']),
};
const CALCULATION_KEYS: Readonly<Record<CalculationRequest['kind'], ReadonlySet<string>>> = {
  monthly_capacity: new Set(['id', 'kind', 'baseRevision', 'peopleObservationId', 'minutesPerPersonPerDayObservationId', 'workingDaysPerMonthObservationId']),
  monthly_workload: new Set(['id', 'kind', 'baseRevision', 'occurrencesPerMonthObservationId', 'minutesPerOccurrenceObservationId']),
  monthly_cost: new Set(['id', 'kind', 'baseRevision', 'monthlyHoursObservationId', 'hourlyCostObservationId']),
  rework_volume: new Set(['id', 'kind', 'baseRevision', 'volumeObservationId', 'reworkRateObservationId']),
};
const CLAIM_LIMIT = 20;
const CALCULATION_REQUEST_LIMIT = 8;
const EVIDENCE_ID_LIMIT = 32;

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
function hasOnlyKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean { return Object.keys(value).every((key) => keys.has(key)); }
function safeId(value: unknown): value is string { return typeof value === 'string' && value.length >= 1 && value.length <= 96 && SAFE_ID_PATTERN.test(value); }
function boundedText(value: unknown, max = 1200): value is string { return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max && !CONTROL_CHARACTER_PATTERN.test(value); }
function parseIdArray(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || value.length > EVIDENCE_ID_LIMIT || !value.every(safeId) || new Set(value).size !== value.length) return null;
  return Object.freeze([...value]);
}

function parseClaim(value: unknown, index: number): SellerValidationFailure | { ok: true; claim: Readonly<SellerMaterialClaim> } {
  const path = `materialClaims[${index}]`;
  if (!isRecord(value)) return { ok: false, code: 'INVALID_SHAPE', path };
  const kind = value['kind'];
  if (typeof kind !== 'string' || !(SELLER_MATERIAL_CLAIM_KINDS as readonly string[]).includes(kind)) return { ok: false, code: 'INVALID_VALUE', path: `${path}.kind` };
  const claimKind = kind as SellerMaterialClaimKind;
  if (!hasOnlyKeys(value, CLAIM_KEYS[claimKind])) return { ok: false, code: 'INVALID_SHAPE', path };
  if (!safeId(value['id'])) return { ok: false, code: 'INVALID_VALUE', path: `${path}.id` };
  if (!boundedText(value['text'])) return { ok: false, code: 'INVALID_VALUE', path: `${path}.text` };
  const base = { id: value['id'], kind: claimKind, text: value['text'].trim() };

  switch (claimKind) {
    case 'verified_numeric':
      if (!safeId(value['calculationId'])) return { ok: false, code: 'INVALID_VALUE', path: `${path}.calculationId` };
      return { ok: true, claim: Object.freeze({ ...base, kind: claimKind, calculationId: value['calculationId'] }) };
    case 'qualitative': {
      const evidenceIds = parseIdArray(value['evidenceIds']);
      if (evidenceIds === null) return { ok: false, code: 'INVALID_VALUE', path: `${path}.evidenceIds` };
      return { ok: true, claim: Object.freeze({ ...base, kind: claimKind, evidenceIds }) };
    }
    case 'feasibility': {
      const state = value['state'];
      if (state !== 'unknown' && state !== 'conditional' && state !== 'confirmed') return { ok: false, code: 'INVALID_VALUE', path: `${path}.state` };
      const evidenceIds = parseIdArray(value['evidenceIds']);
      if (evidenceIds === null) return { ok: false, code: 'INVALID_VALUE', path: `${path}.evidenceIds` };
      return { ok: true, claim: Object.freeze({ ...base, kind: claimKind, state, evidenceIds }) };
    }
    case 'artifact_readiness': {
      if (!safeId(value['artifactId'])) return { ok: false, code: 'INVALID_VALUE', path: `${path}.artifactId` };
      const readiness = value['readiness'];
      if (readiness !== 'conceptual' && readiness !== 'prototype' && readiness !== 'production') return { ok: false, code: 'INVALID_VALUE', path: `${path}.readiness` };
      return { ok: true, claim: Object.freeze({ ...base, kind: claimKind, artifactId: value['artifactId'], readiness }) };
    }
    case 'price':
    case 'discount':
    case 'attachment_access':
    case 'secret_access':
    case 'tool_escalation':
      return { ok: true, claim: Object.freeze({ ...base, kind: claimKind }) };
  }
}

function parseCalculationRequest(value: unknown, index: number, revision: number): SellerValidationFailure | { ok: true; request: Readonly<CalculationRequest> } {
  const path = `calculationRequests[${index}]`;
  if (!isRecord(value)) return { ok: false, code: 'INVALID_SHAPE', path };
  const kind = value['kind'];
  if (typeof kind !== 'string' || !Object.hasOwn(CALCULATION_KEYS, kind)) return { ok: false, code: 'INVALID_VALUE', path: `${path}.kind` };
  const requestKind = kind as CalculationRequest['kind'];
  if (!hasOnlyKeys(value, CALCULATION_KEYS[requestKind])) return { ok: false, code: 'INVALID_SHAPE', path };
  if (!safeId(value['id'])) return { ok: false, code: 'INVALID_VALUE', path: `${path}.id` };
  if (value['baseRevision'] !== revision) return { ok: false, code: 'INVALID_VALUE', path: `${path}.baseRevision` };
  for (const [key, raw] of Object.entries(value)) {
    if (key === 'id' || key === 'kind' || key === 'baseRevision') continue;
    if (!safeId(raw)) return { ok: false, code: 'INVALID_VALUE', path: `${path}.${key}` };
  }
  return { ok: true, request: Object.freeze({ ...value }) as unknown as Readonly<CalculationRequest> };
}

export function validateSellerSubmission(value: unknown, options: SellerValidationOptions): SellerSubmissionValidation {
  if (!isRecord(value) || !hasOnlyKeys(value, ROOT_KEYS)) return { ok: false, code: 'INVALID_SHAPE', path: 'sellerSubmission' };
  if (value['schemaVersion'] !== 1) return { ok: false, code: 'INVALID_VALUE', path: 'sellerSubmission.schemaVersion' };
  if (!safeId(value['proposalId'])) return { ok: false, code: 'INVALID_VALUE', path: 'sellerSubmission.proposalId' };

  const proposalResult = validateExperienceProposal(value['proposal'], { expectedBaseRevision: options.canonical.revision });
  if (!proposalResult.ok) return { ok: false, code: 'PROPOSAL_INVALID', path: proposalResult.path };
  // Every SellerSubmission is customer-facing material: narration/question text alone can
  // influence the visitor even when no visual mutation is proposed. The model may request
  // stricter review, but it can never disable the independent Critic gate.
  if (proposalResult.proposal.criticRequired !== true) {
    return { ok: false, code: 'INVALID_VALUE', path: 'sellerSubmission.proposal.criticRequired' };
  }

  const rawClaims = value['materialClaims'];
  if (!Array.isArray(rawClaims)) return { ok: false, code: 'INVALID_SHAPE', path: 'materialClaims' };
  if (rawClaims.length > CLAIM_LIMIT) return { ok: false, code: 'LIMIT_EXCEEDED', path: 'materialClaims' };
  const materialClaims: Readonly<SellerMaterialClaim>[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < rawClaims.length; i += 1) {
    const parsed = parseClaim(rawClaims[i], i);
    if (!parsed.ok) return parsed;
    if (ids.has(parsed.claim.id)) return { ok: false, code: 'DUPLICATE_ID', path: `materialClaims[${i}].id` };
    ids.add(parsed.claim.id);
    materialClaims.push(parsed.claim);
  }

  const rawRequests = value['calculationRequests'];
  if (!Array.isArray(rawRequests)) return { ok: false, code: 'INVALID_SHAPE', path: 'calculationRequests' };
  if (rawRequests.length > CALCULATION_REQUEST_LIMIT) return { ok: false, code: 'LIMIT_EXCEEDED', path: 'calculationRequests' };
  const calculationRequests: Readonly<CalculationRequest>[] = [];
  for (let i = 0; i < rawRequests.length; i += 1) {
    const parsed = parseCalculationRequest(rawRequests[i], i, options.canonical.revision);
    if (!parsed.ok) return parsed;
    if (ids.has(parsed.request.id)) return { ok: false, code: 'DUPLICATE_ID', path: `calculationRequests[${i}].id` };
    ids.add(parsed.request.id);
    calculationRequests.push(parsed.request);
  }

  const hardBlocks = evaluateHardBlocks({
    proposal: proposalResult.proposal,
    materialClaims,
    canonical: options.canonical,
  });
  const firstBlock = hardBlocks[0];
  if (firstBlock !== undefined) return { ok: false, code: 'HARD_BLOCK', path: firstBlock.path, finding: firstBlock };

  return {
    ok: true,
    submission: Object.freeze({
      schemaVersion: 1,
      proposalId: value['proposalId'],
      proposal: proposalResult.proposal,
      materialClaims: Object.freeze(materialClaims),
      calculationRequests: Object.freeze(calculationRequests),
    }),
  };
}
