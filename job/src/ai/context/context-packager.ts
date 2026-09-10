import type {
  ArtifactRecord,
  CanonicalSalesContext,
  QuantitativeObservation,
  SalesFact,
  SalesObjection,
  VerifiedCalculation,
} from './canonical-sales-context.ts';
import type { SessionDigest } from './session-digest.ts';
import {
  availableInputTokens,
  assertProviderRouteBudget,
  measureTokens,
  type ProviderRouteBudget,
  type TokenEstimator,
} from './token-budget.ts';

export type ContextRole = 'seller' | 'critic' | 'composer' | 'workshop';
export type ContextTurnRole = 'user' | 'assistant' | 'tool';

export interface RecentContextTurn {
  id: string;
  role: ContextTurnRole;
  text: string;
  includedInDigest?: boolean;
}

export interface CurrentProcessNode {
  id: string;
  label: string;
  kind: string;
  provenance: 'user_stated' | 'ai_inferred' | 'user_confirmed';
}

export interface CurrentExperienceState {
  sceneId: string | null;
  focusedEntityIds: readonly string[];
  activeArtifactIds: readonly string[];
  processNodes?: readonly Readonly<CurrentProcessNode>[];
}

export interface ContextPackagerInput {
  role: ContextRole;
  canonical: CanonicalSalesContext;
  digest: SessionDigest | null;
  recentTurns: readonly RecentContextTurn[];
  visualState: CurrentExperienceState;
  budget: ProviderRouteBudget;
  estimateTokens: TokenEstimator;
}

export interface ContextPackMetadata {
  compaction: 'none' | 'bounded';
  attempts: 1 | 2;
  estimatedInputTokens: number;
  availableInputTokens: number;
  droppedRecentTurnIds: readonly string[];
  digestIncluded: boolean;
}

export interface ContextPack {
  schemaVersion: 1;
  role: ContextRole;
  canonicalRevision: number;
  contract: readonly string[];
  latestUserIntent: { turnId: string; text: string } | null;
  confirmedFacts: readonly Pick<SalesFact, 'id' | 'subject' | 'predicate' | 'value' | 'source' | 'status'>[];
  otherFacts: readonly Pick<SalesFact, 'id' | 'subject' | 'predicate' | 'value' | 'source' | 'status' | 'confidence'>[];
  openObjections: readonly Pick<SalesObjection, 'id' | 'kind' | 'summary' | 'status'>[];
  quantitativeEvidence: {
    observations: readonly Pick<QuantitativeObservation, 'id' | 'metric' | 'value' | 'unit' | 'period' | 'status' | 'source'>[];
    calculations: readonly Pick<VerifiedCalculation, 'id' | 'kind' | 'expression' | 'resultValue' | 'resultUnit' | 'basedOnRevision' | 'status'>[];
  };
  decisionContext: {
    primaryPain: string | null;
    desiredOutcome: string | null;
    knownConsequences: readonly string[];
    openUncertainties: readonly string[];
  };
  visualState: CurrentExperienceState;
  activeArtifacts: readonly Pick<ArtifactRecord, 'id' | 'kind' | 'title' | 'summary' | 'maturity' | 'status'>[];
  digestContinuity: { basedOnRevision: number; activeOpportunityIds: readonly string[] } | null;
  recentTurns: readonly Omit<RecentContextTurn, 'includedInDigest'>[];
  metadata: ContextPackMetadata;
}

export type ContextPackagingFailureCode =
  | 'ATTACHMENT_CONTENT_FORBIDDEN'
  | 'INVALID_CONTEXT_INPUT'
  | 'CONTEXT_BUDGET_EXCEEDED';

export type ContextPackagingResult =
  | { ok: true; pack: ContextPack }
  | {
      ok: false;
      code: ContextPackagingFailureCode;
      attempts: 1 | 2;
      estimatedInputTokens: number | null;
      availableInputTokens: number | null;
    };

const CONTRACT = Object.freeze([
  'Evidence labels remain authoritative: proposed or conflicted evidence is never treated as confirmed truth.',
  'Material arithmetic may use only application-verified calculations and provenance-bound observations.',
  'Customer attachment contents are unavailable to the model and must not be inferred.',
  'Provider-side conversation memory and conversation identifiers are non-authoritative execution details.',
  'Choose the strongest truthful next move; this context pack implies no fixed question order, sales stage, or mandatory solution class.',
] as const);

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RECENT_TURN_LIMIT = 12;
const TURN_TEXT_LIMIT = 8_000;
const VISUAL_ID_LIMIT = 32;
const VISUAL_NODE_LIMIT = 48;
const VISUAL_NODE_LABEL_LIMIT = 120;
const VISUAL_NODE_KIND_LIMIT = 48;
const RECENT_TURN_KEYS = new Set(['id', 'role', 'text', 'includedInDigest']);
const ATTACHMENT_KEY_PATTERN = /(attachment|file|document|ocr|embedding|upload|byte|blob)/i;

function validId(value: string): boolean {
  return value.length >= 1 && value.length <= 96 && SAFE_ID.test(value);
}

function uniqueBoundedIds(values: readonly string[]): readonly string[] {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (!validId(value) || seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
    if (unique.length >= VISUAL_ID_LIMIT) break;
  }
  return Object.freeze(unique);
}

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function projectProcessNodes(
  values: readonly Readonly<CurrentProcessNode>[] | undefined,
): readonly Readonly<CurrentProcessNode>[] {
  if (values === undefined) return Object.freeze([]);
  const projected: Readonly<CurrentProcessNode>[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    if (
      projected.length >= VISUAL_NODE_LIMIT
      || !validId(value.id)
      || seen.has(value.id)
      || typeof value.label !== 'string'
      || value.label.trim().length < 1
      || value.label.trim().length > VISUAL_NODE_LABEL_LIMIT
      || typeof value.kind !== 'string'
      || value.kind.trim().length < 1
      || value.kind.trim().length > VISUAL_NODE_KIND_LIMIT
      || !['user_stated', 'ai_inferred', 'user_confirmed'].includes(value.provenance)
    ) continue;
    seen.add(value.id);
    projected.push(Object.freeze({
      id: value.id,
      label: value.label.trim(),
      kind: value.kind.trim(),
      provenance: value.provenance,
    }));
  }
  return Object.freeze(projected);
}

function projectConfirmedFacts(context: CanonicalSalesContext) {
  return freezeArray(context.facts
    .filter((fact) => fact.status === 'confirmed')
    .map((fact) => Object.freeze({
      id: fact.id,
      subject: fact.subject,
      predicate: fact.predicate,
      value: fact.value,
      source: fact.source,
      status: fact.status,
    })));
}

function projectOtherFacts(context: CanonicalSalesContext) {
  return freezeArray(context.facts
    .filter((fact) => fact.status === 'proposed' || fact.status === 'conflicted')
    .map((fact) => Object.freeze({
      id: fact.id,
      subject: fact.subject,
      predicate: fact.predicate,
      value: fact.value,
      source: fact.source,
      status: fact.status,
      confidence: fact.confidence,
    })));
}

function projectOpenObjections(context: CanonicalSalesContext) {
  return freezeArray(context.objections
    .filter((objection) => objection.status !== 'resolved')
    .map((objection) => Object.freeze({
      id: objection.id,
      kind: objection.kind,
      summary: objection.summary,
      status: objection.status,
    })));
}

function projectObservations(context: CanonicalSalesContext) {
  const rank = (status: QuantitativeObservation['status']) => status === 'confirmed' ? 0 : status === 'proposed' ? 1 : 2;
  return freezeArray(context.quantitativeObservations
    .filter((observation) => observation.status !== 'superseded')
    .slice()
    .sort((left, right) => rank(left.status) - rank(right.status))
    .map((observation) => Object.freeze({
      id: observation.id,
      metric: observation.metric,
      value: observation.value,
      unit: observation.unit,
      period: observation.period,
      status: observation.status,
      source: observation.source,
    })));
}

function projectCalculations(context: CanonicalSalesContext) {
  return freezeArray(context.verifiedCalculations
    .filter((calculation) => calculation.status === 'valid')
    .map((calculation) => Object.freeze({
      id: calculation.id,
      kind: calculation.kind,
      expression: calculation.expression,
      resultValue: calculation.resultValue,
      resultUnit: calculation.resultUnit,
      basedOnRevision: calculation.basedOnRevision,
      status: calculation.status,
    })));
}

function projectActiveArtifacts(context: CanonicalSalesContext, visual: CurrentExperienceState) {
  const active = new Set(visual.activeArtifactIds);
  return freezeArray(context.artifacts
    .filter((artifact) => artifact.status !== 'invalidated' && active.has(artifact.id))
    .map((artifact) => Object.freeze({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary,
      maturity: artifact.maturity,
      status: artifact.status,
    })));
}

function prepareRecentTurns(
  turns: readonly RecentContextTurn[],
  latestIntentTurnId: string | null,
): { turns: readonly Omit<RecentContextTurn, 'includedInDigest'>[]; droppedIds: readonly string[] } | ContextPackagingResult {
  const selectedNewestFirst: Omit<RecentContextTurn, 'includedInDigest'>[] = [];
  const seen = new Set<string>();
  const dropped = new Set<string>();

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const raw = turns[index];
    if (!raw || typeof raw !== 'object') {
      return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 1, estimatedInputTokens: null, availableInputTokens: null };
    }
    for (const key of Object.keys(raw)) {
      if (ATTACHMENT_KEY_PATTERN.test(key)) {
        return { ok: false, code: 'ATTACHMENT_CONTENT_FORBIDDEN', attempts: 1, estimatedInputTokens: null, availableInputTokens: null };
      }
      if (!RECENT_TURN_KEYS.has(key)) {
        return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 1, estimatedInputTokens: null, availableInputTokens: null };
      }
    }
    if (!validId(raw.id) || !['user', 'assistant', 'tool'].includes(raw.role)) {
      return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 1, estimatedInputTokens: null, availableInputTokens: null };
    }
    const text = raw.text.trim();
    if (!text || text.length > TURN_TEXT_LIMIT) {
      return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 1, estimatedInputTokens: null, availableInputTokens: null };
    }
    if (raw.includedInDigest === true || raw.id === latestIntentTurnId || seen.has(raw.id)) {
      dropped.add(raw.id);
      continue;
    }
    seen.add(raw.id);
    if (selectedNewestFirst.length >= RECENT_TURN_LIMIT) {
      dropped.add(raw.id);
      continue;
    }
    selectedNewestFirst.push(Object.freeze({ id: raw.id, role: raw.role, text }));
  }

  selectedNewestFirst.reverse();
  return { turns: freezeArray(selectedNewestFirst), droppedIds: Object.freeze([...dropped]) };
}

interface PayloadParts {
  role: ContextRole;
  canonicalRevision: number;
  latestUserIntent: { turnId: string; text: string } | null;
  confirmedFacts: ContextPack['confirmedFacts'];
  otherFacts: ContextPack['otherFacts'];
  openObjections: ContextPack['openObjections'];
  observations: ContextPack['quantitativeEvidence']['observations'];
  calculations: ContextPack['quantitativeEvidence']['calculations'];
  decisionContext: ContextPack['decisionContext'];
  visualState: CurrentExperienceState;
  activeArtifacts: ContextPack['activeArtifacts'];
  digestContinuity: ContextPack['digestContinuity'];
  recentTurns: ContextPack['recentTurns'];
}

function buildPack(
  parts: PayloadParts,
  metadata: ContextPackMetadata,
): ContextPack {
  return Object.freeze({
    schemaVersion: 1,
    role: parts.role,
    canonicalRevision: parts.canonicalRevision,
    contract: CONTRACT,
    latestUserIntent: parts.latestUserIntent,
    confirmedFacts: parts.confirmedFacts,
    otherFacts: parts.otherFacts,
    openObjections: parts.openObjections,
    quantitativeEvidence: Object.freeze({ observations: parts.observations, calculations: parts.calculations }),
    decisionContext: Object.freeze(parts.decisionContext),
    visualState: Object.freeze({
      sceneId: parts.visualState.sceneId,
      focusedEntityIds: freezeArray(parts.visualState.focusedEntityIds),
      activeArtifactIds: freezeArray(parts.visualState.activeArtifactIds),
      processNodes: projectProcessNodes(parts.visualState.processNodes),
    }),
    activeArtifacts: parts.activeArtifacts,
    digestContinuity: parts.digestContinuity,
    recentTurns: parts.recentTurns,
    metadata: Object.freeze(metadata),
  });
}

function payloadForMeasurement(pack: ContextPack): Omit<ContextPack, 'metadata'> {
  const { metadata: _metadata, ...payload } = pack;
  return payload;
}

export function packageContext(input: ContextPackagerInput): ContextPackagingResult {
  let limit: number;
  try {
    assertProviderRouteBudget(input.budget);
    limit = availableInputTokens(input.budget);
  } catch {
    return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 1, estimatedInputTokens: null, availableInputTokens: null };
  }

  if (!['seller', 'critic', 'composer', 'workshop'].includes(input.role)) {
    return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 1, estimatedInputTokens: null, availableInputTokens: limit };
  }
  if (!Number.isInteger(input.canonical.revision) || input.canonical.revision < 0) {
    return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 1, estimatedInputTokens: null, availableInputTokens: limit };
  }
  if (input.digest !== null && input.digest.basedOnRevision > input.canonical.revision) {
    return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 1, estimatedInputTokens: null, availableInputTokens: limit };
  }

  const recent = prepareRecentTurns(input.recentTurns, input.canonical.latestUserIntent?.turnId ?? null);
  if ('ok' in recent) return recent;

  const visualState: CurrentExperienceState = Object.freeze({
    sceneId: input.visualState.sceneId,
    focusedEntityIds: uniqueBoundedIds(input.visualState.focusedEntityIds),
    activeArtifactIds: uniqueBoundedIds(input.visualState.activeArtifactIds),
    processNodes: projectProcessNodes(input.visualState.processNodes),
  });

  const baseParts: PayloadParts = {
    role: input.role,
    canonicalRevision: input.canonical.revision,
    latestUserIntent: input.canonical.latestUserIntent === null ? null : Object.freeze({ ...input.canonical.latestUserIntent }),
    confirmedFacts: projectConfirmedFacts(input.canonical),
    otherFacts: projectOtherFacts(input.canonical),
    openObjections: projectOpenObjections(input.canonical),
    observations: projectObservations(input.canonical),
    calculations: projectCalculations(input.canonical),
    decisionContext: Object.freeze({
      primaryPain: input.canonical.primaryPain,
      desiredOutcome: input.canonical.desiredOutcome,
      knownConsequences: freezeArray(input.canonical.knownConsequences),
      openUncertainties: freezeArray(input.canonical.openUncertainties),
    }),
    visualState,
    activeArtifacts: projectActiveArtifacts(input.canonical, visualState),
    digestContinuity: input.digest === null || input.digest.basedOnRevision !== input.canonical.revision ? null : Object.freeze({
      basedOnRevision: input.digest.basedOnRevision,
      activeOpportunityIds: freezeArray(input.canonical.opportunities
        .filter((opportunity) => opportunity.status !== 'invalidated')
        .map((opportunity) => opportunity.id)),
    }),
    recentTurns: recent.turns,
  };

  const firstMetadata: ContextPackMetadata = {
    compaction: 'none',
    attempts: 1,
    estimatedInputTokens: 0,
    availableInputTokens: limit,
    droppedRecentTurnIds: recent.droppedIds,
    digestIncluded: baseParts.digestContinuity !== null,
  };
  let first = buildPack(baseParts, firstMetadata);
  let firstMeasurement;
  try {
    firstMeasurement = measureTokens(payloadForMeasurement(first), limit, input.estimateTokens);
  } catch {
    return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 1, estimatedInputTokens: null, availableInputTokens: limit };
  }
  first = buildPack(baseParts, Object.freeze({ ...firstMetadata, estimatedInputTokens: firstMeasurement.estimatedTokens }));
  if (firstMeasurement.fits) return { ok: true, pack: first };

  const compactDroppedIds = new Set(recent.droppedIds);
  for (const turn of recent.turns) compactDroppedIds.add(turn.id);
  const compactParts: PayloadParts = {
    ...baseParts,
    otherFacts: Object.freeze([]),
    decisionContext: Object.freeze({
      primaryPain: baseParts.decisionContext.primaryPain,
      desiredOutcome: baseParts.decisionContext.desiredOutcome,
      knownConsequences: Object.freeze([]),
      openUncertainties: Object.freeze([]),
    }),
    visualState: Object.freeze({
      sceneId: baseParts.visualState.sceneId,
      focusedEntityIds: Object.freeze([]),
      activeArtifactIds: baseParts.visualState.activeArtifactIds,
      ...(baseParts.visualState.processNodes === undefined
        ? {}
        : { processNodes: baseParts.visualState.processNodes }),
    }),
    activeArtifacts: Object.freeze([]),
    digestContinuity: null,
    recentTurns: Object.freeze([]),
  };
  const compactMetadata: ContextPackMetadata = {
    compaction: 'bounded',
    attempts: 2,
    estimatedInputTokens: 0,
    availableInputTokens: limit,
    droppedRecentTurnIds: Object.freeze([...compactDroppedIds]),
    digestIncluded: false,
  };
  let compact = buildPack(compactParts, compactMetadata);
  let compactMeasurement;
  try {
    compactMeasurement = measureTokens(payloadForMeasurement(compact), limit, input.estimateTokens);
  } catch {
    return { ok: false, code: 'INVALID_CONTEXT_INPUT', attempts: 2, estimatedInputTokens: null, availableInputTokens: limit };
  }
  compact = buildPack(compactParts, Object.freeze({ ...compactMetadata, estimatedInputTokens: compactMeasurement.estimatedTokens }));
  if (compactMeasurement.fits) return { ok: true, pack: compact };

  return {
    ok: false,
    code: 'CONTEXT_BUDGET_EXCEEDED',
    attempts: 2,
    estimatedInputTokens: compactMeasurement.estimatedTokens,
    availableInputTokens: limit,
  };
}
