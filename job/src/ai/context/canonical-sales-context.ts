export const CAPABILITY_KINDS = [
  'operational_artifact',
  'data_import_transform',
  'presentation',
  'bi_decision_intelligence',
  'training_enablement',
  'automation_integration',
  'internal_tool',
  'ai_agentic',
  'process_data_improvement',
] as const;

export type CapabilityKind = (typeof CAPABILITY_KINDS)[number];
export const EVIDENCE_STATUSES = ['proposed', 'confirmed', 'conflicted', 'superseded'] as const;
export const EVIDENCE_SOURCES = ['user', 'inference', 'system'] as const;
export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];
export type EvidenceSource = (typeof EVIDENCE_SOURCES)[number];
export const QUANTITATIVE_UNITS = [
  'occurrence', 'minute', 'hour', 'day', 'client', 'person', 'document', 'entry', 'currency', 'percent', 'other',
] as const;
export const QUANTITATIVE_PERIODS = ['event', 'hour', 'day', 'week', 'month', 'quarter', 'year'] as const;
export const OBJECTION_KINDS = ['price', 'trust', 'feasibility', 'timing', 'change', 'security', 'other'] as const;
export const OBJECTION_STATUSES = ['open', 'addressed', 'resolved'] as const;
export const CALCULATION_KINDS = ['time_cost', 'capacity', 'volume', 'rework', 'delay', 'custom'] as const;
export const CALCULATION_STATUSES = ['valid', 'invalidated'] as const;
export const OPPORTUNITY_STATUSES = ['surfaced', 'active', 'invalidated'] as const;
export const ARTIFACT_KINDS = [
  'operational_object', 'data_import_preview', 'presentation', 'bi_dashboard', 'training_module', 'workflow_concept', 'prototype',
] as const;
export const ARTIFACT_STATUSES = ['proposed', 'staged', 'revealed', 'invalidated'] as const;
export type QuantitativeUnit = (typeof QUANTITATIVE_UNITS)[number];
export type QuantitativePeriod = (typeof QUANTITATIVE_PERIODS)[number] | null;

export interface SalesFact {
  id: string;
  subject: string;
  predicate: string;
  value: string | number | boolean;
  status: EvidenceStatus;
  source: EvidenceSource;
  confidence: number | null;
  supportingTurnIds: readonly string[];
  confirmedByTurnId: string | null;
}

export interface SalesObjection {
  id: string;
  kind: 'price' | 'trust' | 'feasibility' | 'timing' | 'change' | 'security' | 'other';
  summary: string;
  status: 'open' | 'addressed' | 'resolved';
  supportingTurnIds: readonly string[];
}

export interface QuantitativeObservation {
  id: string;
  metric: string;
  value: number;
  unit: QuantitativeUnit;
  period: QuantitativePeriod;
  status: EvidenceStatus;
  source: EvidenceSource;
  supportingTurnIds: readonly string[];
  confirmedByTurnId: string | null;
}

export interface VerifiedCalculation {
  id: string;
  kind: 'time_cost' | 'capacity' | 'volume' | 'rework' | 'delay' | 'custom';
  inputObservationIds: readonly string[];
  expression: string;
  resultValue: number;
  resultUnit: string;
  computedBy: 'application';
  basedOnRevision: number;
  status: 'valid' | 'invalidated';
  invalidatedAtRevision: number | null;
}

export interface OpportunityRecord {
  id: string;
  summary: string;
  capabilities: readonly CapabilityKind[];
  evidenceIds: readonly string[];
  status: 'surfaced' | 'active' | 'invalidated';
  invalidatedAtRevision: number | null;
}

export interface ArtifactRecord {
  id: string;
  kind:
    | 'operational_object'
    | 'data_import_preview'
    | 'presentation'
    | 'bi_dashboard'
    | 'training_module'
    | 'workflow_concept'
    | 'prototype';
  title: string;
  evidenceIds: readonly string[];
  status: 'proposed' | 'staged' | 'revealed' | 'invalidated';
  invalidatedAtRevision: number | null;
}

export interface LatestUserIntent {
  turnId: string;
  text: string;
}

export interface CanonicalSalesContext {
  schemaVersion: 1;
  sessionId: string;
  revision: number;
  turnIds: readonly string[];
  facts: readonly SalesFact[];
  primaryPain: string | null;
  desiredOutcome: string | null;
  knownConsequences: readonly string[];
  objections: readonly SalesObjection[];
  quantitativeObservations: readonly QuantitativeObservation[];
  verifiedCalculations: readonly VerifiedCalculation[];
  openUncertainties: readonly string[];
  opportunities: readonly OpportunityRecord[];
  artifacts: readonly ArtifactRecord[];
  currentSceneId: string | null;
  latestUserIntent: LatestUserIntent | null;
}

export const CANONICAL_CONTEXT_KEYS = [
  'schemaVersion',
  'sessionId',
  'revision',
  'turnIds',
  'facts',
  'primaryPain',
  'desiredOutcome',
  'knownConsequences',
  'objections',
  'quantitativeObservations',
  'verifiedCalculations',
  'openUncertainties',
  'opportunities',
  'artifacts',
  'currentSceneId',
  'latestUserIntent',
] as const satisfies readonly (keyof CanonicalSalesContext)[];

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function isSafeDomainId(value: string): boolean {
  return value.length >= 1 && value.length <= 96 && ID_PATTERN.test(value);
}

export function assertSafeDomainId(name: string, value: string): void {
  if (!isSafeDomainId(value)) throw new TypeError(`${name} must be a safe bounded id`);
}

export function assertBoundedText(name: string, value: string, maxLength = 1000): void {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength || CONTROL_CHARACTER_PATTERN.test(value)) {
    throw new TypeError(`${name} must be non-empty bounded text`);
  }
}

export function assertConfidence(value: number | null): void {
  if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) {
    throw new TypeError('confidence must be null or within 0..1');
  }
}

function freezeStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

export function freezeFact(fact: SalesFact): SalesFact {
  assertSafeDomainId('fact.id', fact.id);
  if (!(EVIDENCE_STATUSES as readonly string[]).includes(fact.status)) throw new TypeError('fact.status is invalid');
  if (!(EVIDENCE_SOURCES as readonly string[]).includes(fact.source)) throw new TypeError('fact.source is invalid');
  assertBoundedText('fact.subject', fact.subject, 160);
  assertBoundedText('fact.predicate', fact.predicate, 160);
  if (typeof fact.value === 'string') assertBoundedText('fact.value', fact.value, 1000);
  if (typeof fact.value === 'number' && !Number.isFinite(fact.value)) throw new TypeError('fact.value must be finite');
  assertConfidence(fact.confidence);
  for (const turnId of fact.supportingTurnIds) assertSafeDomainId('fact.supportingTurnId', turnId);
  if (fact.confirmedByTurnId !== null) assertSafeDomainId('fact.confirmedByTurnId', fact.confirmedByTurnId);
  return Object.freeze({ ...fact, supportingTurnIds: freezeStrings(fact.supportingTurnIds) });
}

export function freezeObservation(observation: QuantitativeObservation): QuantitativeObservation {
  assertSafeDomainId('observation.id', observation.id);
  if (!(QUANTITATIVE_UNITS as readonly string[]).includes(observation.unit)) throw new TypeError('observation.unit is invalid');
  if (observation.period !== null && !(QUANTITATIVE_PERIODS as readonly string[]).includes(observation.period)) throw new TypeError('observation.period is invalid');
  if (!(EVIDENCE_STATUSES as readonly string[]).includes(observation.status)) throw new TypeError('observation.status is invalid');
  if (!(EVIDENCE_SOURCES as readonly string[]).includes(observation.source)) throw new TypeError('observation.source is invalid');
  assertBoundedText('observation.metric', observation.metric, 200);
  if (!Number.isFinite(observation.value)) throw new TypeError('observation.value must be finite');
  for (const turnId of observation.supportingTurnIds) assertSafeDomainId('observation.supportingTurnId', turnId);
  if (observation.confirmedByTurnId !== null) assertSafeDomainId('observation.confirmedByTurnId', observation.confirmedByTurnId);
  return Object.freeze({ ...observation, supportingTurnIds: freezeStrings(observation.supportingTurnIds) });
}

export function freezeCalculation(calculation: VerifiedCalculation): VerifiedCalculation {
  assertSafeDomainId('calculation.id', calculation.id);
  if (!(CALCULATION_KINDS as readonly string[]).includes(calculation.kind)) throw new TypeError('calculation.kind is invalid');
  if (calculation.computedBy !== 'application') throw new TypeError('calculation.computedBy is invalid');
  if (!(CALCULATION_STATUSES as readonly string[]).includes(calculation.status)) throw new TypeError('calculation.status is invalid');
  if (!calculation.inputObservationIds.length) throw new TypeError('calculation requires input observations');
  for (const id of calculation.inputObservationIds) assertSafeDomainId('calculation.inputObservationId', id);
  assertBoundedText('calculation.expression', calculation.expression, 500);
  assertBoundedText('calculation.resultUnit', calculation.resultUnit, 80);
  if (!Number.isFinite(calculation.resultValue)) throw new TypeError('calculation.resultValue must be finite');
  if (!Number.isInteger(calculation.basedOnRevision) || calculation.basedOnRevision < 0) throw new TypeError('calculation.basedOnRevision must be a non-negative integer');
  if (calculation.invalidatedAtRevision !== null && (!Number.isInteger(calculation.invalidatedAtRevision) || calculation.invalidatedAtRevision < 0)) {
    throw new TypeError('calculation.invalidatedAtRevision must be null or a non-negative integer');
  }
  if (calculation.status === 'valid' && calculation.invalidatedAtRevision !== null) throw new TypeError('valid calculation cannot have invalidatedAtRevision');
  if (calculation.status === 'invalidated' && calculation.invalidatedAtRevision === null) throw new TypeError('invalidated calculation requires invalidatedAtRevision');
  return Object.freeze({ ...calculation, inputObservationIds: freezeStrings(calculation.inputObservationIds) });
}

function freezeOpportunity(opportunity: OpportunityRecord): OpportunityRecord {
  assertSafeDomainId('opportunity.id', opportunity.id);
  if (!(OPPORTUNITY_STATUSES as readonly string[]).includes(opportunity.status)) throw new TypeError('opportunity.status is invalid');
  if (opportunity.status === 'invalidated' && opportunity.invalidatedAtRevision === null) throw new TypeError('invalidated opportunity requires invalidatedAtRevision');
  if (opportunity.status !== 'invalidated' && opportunity.invalidatedAtRevision !== null) throw new TypeError('active opportunity cannot have invalidatedAtRevision');
  assertBoundedText('opportunity.summary', opportunity.summary, 1000);
  if (new Set(opportunity.capabilities).size !== opportunity.capabilities.length) throw new TypeError('opportunity capabilities must be unique');
  for (const capability of opportunity.capabilities) {
    if (!(CAPABILITY_KINDS as readonly string[]).includes(capability)) throw new TypeError(`unsupported capability: ${capability}`);
  }
  for (const id of opportunity.evidenceIds) assertSafeDomainId('opportunity.evidenceId', id);
  return Object.freeze({
    ...opportunity,
    capabilities: Object.freeze([...opportunity.capabilities]),
    evidenceIds: freezeStrings(opportunity.evidenceIds),
  });
}

function freezeObjection(objection: SalesObjection): SalesObjection {
  assertSafeDomainId('objection.id', objection.id);
  if (!(OBJECTION_KINDS as readonly string[]).includes(objection.kind)) throw new TypeError('objection.kind is invalid');
  if (!(OBJECTION_STATUSES as readonly string[]).includes(objection.status)) throw new TypeError('objection.status is invalid');
  assertBoundedText('objection.summary', objection.summary, 1000);
  for (const id of objection.supportingTurnIds) assertSafeDomainId('objection.supportingTurnId', id);
  return Object.freeze({ ...objection, supportingTurnIds: freezeStrings(objection.supportingTurnIds) });
}

function freezeArtifact(artifact: ArtifactRecord): ArtifactRecord {
  assertSafeDomainId('artifact.id', artifact.id);
  if (!(ARTIFACT_KINDS as readonly string[]).includes(artifact.kind)) throw new TypeError('artifact.kind is invalid');
  if (!(ARTIFACT_STATUSES as readonly string[]).includes(artifact.status)) throw new TypeError('artifact.status is invalid');
  if (artifact.status === 'invalidated' && artifact.invalidatedAtRevision === null) throw new TypeError('invalidated artifact requires invalidatedAtRevision');
  if (artifact.status !== 'invalidated' && artifact.invalidatedAtRevision !== null) throw new TypeError('active artifact cannot have invalidatedAtRevision');
  assertBoundedText('artifact.title', artifact.title, 300);
  for (const id of artifact.evidenceIds) assertSafeDomainId('artifact.evidenceId', id);
  return Object.freeze({ ...artifact, evidenceIds: freezeStrings(artifact.evidenceIds) });
}

export function freezeCanonicalSalesContext(context: CanonicalSalesContext): CanonicalSalesContext {
  assertSafeDomainId('sessionId', context.sessionId);
  if (!Number.isInteger(context.revision) || context.revision < 0) throw new TypeError('revision must be a non-negative integer');
  for (const id of context.turnIds) assertSafeDomainId('turnId', id);
  if (context.primaryPain !== null) assertBoundedText('primaryPain', context.primaryPain, 2000);
  if (context.desiredOutcome !== null) assertBoundedText('desiredOutcome', context.desiredOutcome, 2000);
  for (const item of context.knownConsequences) assertBoundedText('knownConsequence', item, 1000);
  for (const item of context.openUncertainties) assertBoundedText('openUncertainty', item, 1000);
  if (context.currentSceneId !== null) assertSafeDomainId('currentSceneId', context.currentSceneId);
  if (context.latestUserIntent !== null) {
    assertSafeDomainId('latestUserIntent.turnId', context.latestUserIntent.turnId);
    assertBoundedText('latestUserIntent.text', context.latestUserIntent.text, 4000);
  }

  return Object.freeze({
    ...context,
    turnIds: freezeStrings(context.turnIds),
    facts: Object.freeze(context.facts.map(freezeFact)),
    knownConsequences: freezeStrings(context.knownConsequences),
    objections: Object.freeze(context.objections.map(freezeObjection)),
    quantitativeObservations: Object.freeze(context.quantitativeObservations.map(freezeObservation)),
    verifiedCalculations: Object.freeze(context.verifiedCalculations.map(freezeCalculation)),
    openUncertainties: freezeStrings(context.openUncertainties),
    opportunities: Object.freeze(context.opportunities.map(freezeOpportunity)),
    artifacts: Object.freeze(context.artifacts.map(freezeArtifact)),
    latestUserIntent: context.latestUserIntent === null ? null : Object.freeze({ ...context.latestUserIntent }),
  });
}

export function createCanonicalSalesContext(input: { sessionId: string }): CanonicalSalesContext {
  assertSafeDomainId('sessionId', input.sessionId);
  return freezeCanonicalSalesContext({
    schemaVersion: 1,
    sessionId: input.sessionId,
    revision: 0,
    turnIds: [],
    facts: [],
    primaryPain: null,
    desiredOutcome: null,
    knownConsequences: [],
    objections: [],
    quantitativeObservations: [],
    verifiedCalculations: [],
    openUncertainties: [],
    opportunities: [],
    artifacts: [],
    currentSceneId: null,
    latestUserIntent: null,
  });
}
