import type {
  ArtifactRecord,
  CanonicalSalesContext,
  QuantitativeObservation,
  SalesFact,
  SalesObjection,
  VerifiedCalculation,
} from './canonical-sales-context.ts';
import type { CurrentExperienceState } from './context-packager.ts';
import {
  assertProviderRouteBudget,
  measureTokens,
  type ProviderRouteBudget,
  type TokenEstimator,
} from './token-budget.ts';

export interface EmergencyContinuationCapsule {
  schemaVersion: 1;
  canonicalRevision: number;
  contract: readonly string[];
  latestUserIntent: { turnId: string; text: string } | null;
  confirmedFacts: readonly Pick<SalesFact, 'id' | 'subject' | 'predicate' | 'value' | 'source' | 'status'>[];
  openObjections: readonly Pick<SalesObjection, 'id' | 'kind' | 'summary' | 'status'>[];
  quantitativeEvidence: {
    observations: readonly Pick<QuantitativeObservation, 'id' | 'metric' | 'value' | 'unit' | 'period' | 'status' | 'source'>[];
    calculations: readonly Pick<VerifiedCalculation, 'id' | 'kind' | 'expression' | 'resultValue' | 'resultUnit' | 'basedOnRevision' | 'status'>[];
  };
  sceneId: string | null;
  activeArtifactIds: readonly string[];
  activeArtifacts: readonly Pick<ArtifactRecord, 'id' | 'kind' | 'title' | 'summary' | 'maturity' | 'status'>[];
  estimatedInputTokens: number;
}

export type EmergencyCapsuleResult =
  | { ok: true; capsule: EmergencyContinuationCapsule }
  | { ok: false; code: 'INVALID_CONTEXT_INPUT' | 'EMERGENCY_BUDGET_EXCEEDED'; estimatedInputTokens: number | null; limitTokens: number | null };

const EMERGENCY_CONTRACT = Object.freeze([
  'Continue from Vexryzer canonical truth; provider memory is non-authoritative.',
  'Do not upgrade proposed or conflicted evidence into confirmed truth.',
  'Use only verified quantitative evidence for material numeric claims.',
  'Attachment contents are unavailable.',
  'Choose the strongest truthful next move without assuming a fixed sales sequence.',
] as const);

function freezeArray<T>(values: readonly T[]): readonly T[] {
  return Object.freeze([...values]);
}

function buildPayload(canonical: CanonicalSalesContext, visualState: CurrentExperienceState) {
  const confirmedFacts = canonical.facts
    .filter((fact) => fact.status === 'confirmed')
    .map((fact) => Object.freeze({
      id: fact.id,
      subject: fact.subject,
      predicate: fact.predicate,
      value: fact.value,
      source: fact.source,
      status: fact.status,
    }));
  const objections = canonical.objections
    .filter((objection) => objection.status !== 'resolved')
    .map((objection) => Object.freeze({ id: objection.id, kind: objection.kind, summary: objection.summary, status: objection.status }));
  const observations = canonical.quantitativeObservations
    .filter((observation) => observation.status === 'confirmed')
    .map((observation) => Object.freeze({
      id: observation.id,
      metric: observation.metric,
      value: observation.value,
      unit: observation.unit,
      period: observation.period,
      status: observation.status,
      source: observation.source,
    }));
  const calculations = canonical.verifiedCalculations
    .filter((calculation) => calculation.status === 'valid')
    .map((calculation) => Object.freeze({
      id: calculation.id,
      kind: calculation.kind,
      expression: calculation.expression,
      resultValue: calculation.resultValue,
      resultUnit: calculation.resultUnit,
      basedOnRevision: calculation.basedOnRevision,
      status: calculation.status,
    }));
  const activeArtifactIds = visualState.activeArtifactIds.slice(0, 32);
  const activeArtifactSet = new Set(activeArtifactIds);
  const activeArtifacts = canonical.artifacts
    .filter((artifact) => artifact.status !== 'invalidated' && activeArtifactSet.has(artifact.id))
    .slice(0, 32)
    .map((artifact) => Object.freeze({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary,
      maturity: artifact.maturity,
      status: artifact.status,
    }));

  return Object.freeze({
    schemaVersion: 1 as const,
    canonicalRevision: canonical.revision,
    contract: EMERGENCY_CONTRACT,
    latestUserIntent: canonical.latestUserIntent === null ? null : Object.freeze({ ...canonical.latestUserIntent }),
    confirmedFacts: freezeArray(confirmedFacts),
    openObjections: freezeArray(objections),
    quantitativeEvidence: Object.freeze({ observations: freezeArray(observations), calculations: freezeArray(calculations) }),
    sceneId: visualState.sceneId,
    activeArtifactIds: freezeArray(activeArtifactIds),
    activeArtifacts: freezeArray(activeArtifacts),
  });
}

export function buildEmergencyContinuationCapsule(input: {
  canonical: CanonicalSalesContext;
  visualState: CurrentExperienceState;
  budget: ProviderRouteBudget;
  estimateTokens: TokenEstimator;
}): EmergencyCapsuleResult {
  try {
    assertProviderRouteBudget(input.budget);
  } catch {
    return { ok: false, code: 'INVALID_CONTEXT_INPUT', estimatedInputTokens: null, limitTokens: null };
  }
  if (!Number.isInteger(input.canonical.revision) || input.canonical.revision < 0) {
    return { ok: false, code: 'INVALID_CONTEXT_INPUT', estimatedInputTokens: null, limitTokens: input.budget.emergencyInputTokens };
  }

  const payload = buildPayload(input.canonical, input.visualState);
  let measurement;
  try {
    measurement = measureTokens(payload, input.budget.emergencyInputTokens, input.estimateTokens);
  } catch {
    return { ok: false, code: 'INVALID_CONTEXT_INPUT', estimatedInputTokens: null, limitTokens: input.budget.emergencyInputTokens };
  }
  if (!measurement.fits) {
    return {
      ok: false,
      code: 'EMERGENCY_BUDGET_EXCEEDED',
      estimatedInputTokens: measurement.estimatedTokens,
      limitTokens: measurement.limitTokens,
    };
  }

  return {
    ok: true,
    capsule: Object.freeze({ ...payload, estimatedInputTokens: measurement.estimatedTokens }),
  };
}
