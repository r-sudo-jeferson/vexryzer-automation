import type {
  CanonicalSalesContext,
  EvidenceSource,
  EvidenceStatus,
  QuantitativePeriod,
  QuantitativeUnit,
} from './canonical-sales-context.ts';

export interface SessionDigestFact {
  id: string;
  status: EvidenceStatus;
  source: EvidenceSource;
  subject: string;
  predicate: string;
  value: string | number | boolean;
}

export interface SessionDigestObservation {
  id: string;
  metric: string;
  value: number;
  unit: QuantitativeUnit;
  period: QuantitativePeriod;
  status: EvidenceStatus;
  source: EvidenceSource;
}

export interface SessionDigest {
  schemaVersion: 1;
  basedOnRevision: number;
  facts: readonly SessionDigestFact[];
  quantitativeObservations: readonly SessionDigestObservation[];
  validCalculationIds: readonly string[];
  openObjections: readonly { id: string; kind: string; summary: string }[];
  activeOpportunityIds: readonly string[];
  openUncertainties: readonly string[];
  latestUserIntent: { turnId: string; text: string } | null;
}

export function createSessionDigest(context: CanonicalSalesContext): SessionDigest {
  const digest: SessionDigest = {
    schemaVersion: 1,
    basedOnRevision: context.revision,
    facts: context.facts
      .filter((fact) => fact.status !== 'superseded')
      .map((fact) => Object.freeze({
        id: fact.id,
        status: fact.status,
        source: fact.source,
        subject: fact.subject,
        predicate: fact.predicate,
        value: fact.value,
      })),
    quantitativeObservations: context.quantitativeObservations
      .filter((observation) => observation.status !== 'superseded')
      .map((observation) => Object.freeze({
        id: observation.id,
        metric: observation.metric,
        value: observation.value,
        unit: observation.unit,
        period: observation.period,
        status: observation.status,
        source: observation.source,
      })),
    validCalculationIds: context.verifiedCalculations.filter((item) => item.status === 'valid').map((item) => item.id),
    openObjections: context.objections
      .filter((objection) => objection.status === 'open')
      .map((objection) => Object.freeze({ id: objection.id, kind: objection.kind, summary: objection.summary })),
    activeOpportunityIds: context.opportunities.filter((item) => item.status !== 'invalidated').map((item) => item.id),
    openUncertainties: [...context.openUncertainties],
    latestUserIntent: context.latestUserIntent === null ? null : Object.freeze({ ...context.latestUserIntent }),
  };

  return Object.freeze({
    ...digest,
    facts: Object.freeze([...digest.facts]),
    quantitativeObservations: Object.freeze([...digest.quantitativeObservations]),
    validCalculationIds: Object.freeze([...digest.validCalculationIds]),
    openObjections: Object.freeze([...digest.openObjections]),
    activeOpportunityIds: Object.freeze([...digest.activeOpportunityIds]),
    openUncertainties: Object.freeze([...digest.openUncertainties]),
  });
}
