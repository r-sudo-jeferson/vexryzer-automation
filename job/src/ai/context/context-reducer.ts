import {
  CAPABILITY_KINDS,
  assertBoundedText,
  assertSafeDomainId,
  freezeCalculation,
  freezeCanonicalSalesContext,
  freezeFact,
  freezeObservation,
  type ArtifactRecord,
  type CanonicalSalesContext,
  type OpportunityRecord,
  type QuantitativeObservation,
  type SalesFact,
  type SalesObjection,
  type VerifiedCalculation,
} from './canonical-sales-context.ts';

export type MutationActor = 'user' | 'model' | 'system';

export type ContextMutation =
  | { type: 'COMMIT_MODEL_PROPOSAL'; facts: readonly SalesFact[]; opportunities: readonly OpportunityRecord[]; artifacts: readonly ArtifactRecord[] }
  | { type: 'ADD_FACT'; fact: SalesFact }
  | { type: 'CONFIRM_FACT'; factId: string; turnId: string }
  | { type: 'CORRECT_FACT'; factId: string; turnId: string; replacement: SalesFact }
  | { type: 'ADD_OBSERVATION'; observation: QuantitativeObservation }
  | { type: 'CONFIRM_OBSERVATION'; observationId: string; turnId: string }
  | { type: 'CORRECT_OBSERVATION'; observationId: string; turnId: string; replacement: QuantitativeObservation }
  | { type: 'ADD_CALCULATION'; calculation: VerifiedCalculation }
  | { type: 'ADD_CALCULATIONS'; calculations: readonly VerifiedCalculation[] }
  | { type: 'ADD_OPPORTUNITY'; opportunity: OpportunityRecord }
  | { type: 'ADD_OBJECTION'; objection: SalesObjection }
  | { type: 'SET_LATEST_USER_INTENT'; turnId: string; intent: string };

export interface ContextMutationEnvelope {
  baseRevision: number;
  actor: MutationActor;
  mutation: ContextMutation;
}

export type ContextMutationRejectionCode =
  | 'STALE_REVISION'
  | 'AUTHORITY_VIOLATION'
  | 'DUPLICATE_ID'
  | 'NOT_FOUND'
  | 'INVALID_MUTATION';

export type ContextMutationResult =
  | { ok: true; context: CanonicalSalesContext }
  | { ok: false; code: ContextMutationRejectionCode; revision: number };

function reject(context: CanonicalSalesContext, code: ContextMutationRejectionCode): ContextMutationResult {
  return { ok: false, code, revision: context.revision };
}

function idExists(context: CanonicalSalesContext, id: string): boolean {
  return context.facts.some((item) => item.id === id)
    || context.quantitativeObservations.some((item) => item.id === id)
    || context.verifiedCalculations.some((item) => item.id === id)
    || context.opportunities.some((item) => item.id === id)
    || context.objections.some((item) => item.id === id)
    || context.artifacts.some((item) => item.id === id);
}

function appendTurnId(turnIds: readonly string[], turnId: string): readonly string[] {
  return turnIds.includes(turnId) ? turnIds : [...turnIds, turnId];
}

function validateFactAuthority(actor: MutationActor, fact: SalesFact): boolean {
  if (actor === 'model') {
    return fact.source === 'inference' && fact.status === 'proposed' && fact.confirmedByTurnId === null;
  }
  if (actor === 'user') {
    return fact.source === 'user' && (fact.status === 'proposed' || fact.status === 'confirmed');
  }
  return fact.source === 'system';
}

function validateObservationAuthority(actor: MutationActor, observation: QuantitativeObservation): boolean {
  if (actor === 'model') {
    return observation.source === 'inference' && observation.status === 'proposed' && observation.confirmedByTurnId === null;
  }
  if (actor === 'user') {
    return observation.source === 'user' && (observation.status === 'proposed' || observation.status === 'confirmed');
  }
  return observation.source === 'system';
}

function confirmFact(fact: SalesFact, turnId: string): SalesFact {
  return freezeFact({
    ...fact,
    status: 'confirmed',
    confirmedByTurnId: turnId,
    supportingTurnIds: fact.supportingTurnIds.includes(turnId)
      ? fact.supportingTurnIds
      : [...fact.supportingTurnIds, turnId],
  });
}

function confirmObservation(observation: QuantitativeObservation, turnId: string): QuantitativeObservation {
  return freezeObservation({
    ...observation,
    status: 'confirmed',
    confirmedByTurnId: turnId,
    supportingTurnIds: observation.supportingTurnIds.includes(turnId)
      ? observation.supportingTurnIds
      : [...observation.supportingTurnIds, turnId],
  });
}

function withRevision(context: CanonicalSalesContext, patch: Partial<CanonicalSalesContext>): CanonicalSalesContext {
  return freezeCanonicalSalesContext({ ...context, ...patch, revision: context.revision + 1 });
}

export function applyContextMutation(
  context: CanonicalSalesContext,
  envelope: ContextMutationEnvelope,
): ContextMutationResult {
  if (envelope.baseRevision !== context.revision) return reject(context, 'STALE_REVISION');

  try {
    const mutation = envelope.mutation;
    switch (mutation.type) {
      case 'COMMIT_MODEL_PROPOSAL': {
        if (envelope.actor !== 'model') return reject(context, 'AUTHORITY_VIOLATION');
        if (
          mutation.facts.length > 16
          || mutation.opportunities.length > 8
          || mutation.artifacts.length > 8
          || mutation.facts.length + mutation.opportunities.length + mutation.artifacts.length < 1
        ) return reject(context, 'INVALID_MUTATION');

        const batchIds = new Set<string>();
        const facts: SalesFact[] = [];
        for (const raw of mutation.facts) {
          const fact = freezeFact(raw);
          if (!validateFactAuthority('model', fact) || fact.confidence !== null) {
            return reject(context, 'AUTHORITY_VIOLATION');
          }
          if (idExists(context, fact.id) || batchIds.has(fact.id)) return reject(context, 'DUPLICATE_ID');
          batchIds.add(fact.id);
          facts.push(fact);
        }

        const knownEvidence = new Set<string>();
        for (const item of context.facts) if (item.status !== 'superseded') knownEvidence.add(item.id);
        for (const item of context.quantitativeObservations) if (item.status !== 'superseded') knownEvidence.add(item.id);
        for (const item of context.verifiedCalculations) if (item.status === 'valid') knownEvidence.add(item.id);
        for (const item of context.opportunities) if (item.status !== 'invalidated') knownEvidence.add(item.id);
        for (const item of context.artifacts) if (item.status !== 'invalidated') knownEvidence.add(item.id);
        for (const fact of facts) knownEvidence.add(fact.id);

        const opportunities: OpportunityRecord[] = [];
        for (const raw of mutation.opportunities) {
          assertSafeDomainId('opportunity.id', raw.id);
          if (idExists(context, raw.id) || batchIds.has(raw.id)) return reject(context, 'DUPLICATE_ID');
          if (raw.status !== 'surfaced' || raw.invalidatedAtRevision !== null) return reject(context, 'INVALID_MUTATION');
          if (raw.evidenceIds.some((id) => !knownEvidence.has(id))) return reject(context, 'INVALID_MUTATION');
          batchIds.add(raw.id);
          opportunities.push(Object.freeze({
            ...raw,
            capabilities: Object.freeze([...raw.capabilities]),
            evidenceIds: Object.freeze([...raw.evidenceIds]),
          }));
        }

        const artifacts: ArtifactRecord[] = [];
        for (const raw of mutation.artifacts) {
          assertSafeDomainId('artifact.id', raw.id);
          if (idExists(context, raw.id) || batchIds.has(raw.id)) return reject(context, 'DUPLICATE_ID');
          if (raw.status !== 'proposed' || raw.invalidatedAtRevision !== null) return reject(context, 'INVALID_MUTATION');
          if (raw.evidenceIds.some((id) => !knownEvidence.has(id))) return reject(context, 'INVALID_MUTATION');
          batchIds.add(raw.id);
          artifacts.push(Object.freeze({ ...raw, evidenceIds: Object.freeze([...raw.evidenceIds]) }));
        }

        return {
          ok: true,
          context: freezeCanonicalSalesContext({
            ...context,
            revision: context.revision + 1,
            facts: [...context.facts, ...facts],
            opportunities: [...context.opportunities, ...opportunities],
            artifacts: [...context.artifacts, ...artifacts],
          }),
        };
      }

      case 'ADD_FACT': {
        const fact = freezeFact(mutation.fact);
        if (!validateFactAuthority(envelope.actor, fact)) return reject(context, 'AUTHORITY_VIOLATION');
        if (idExists(context, fact.id)) return reject(context, 'DUPLICATE_ID');
        return { ok: true, context: withRevision(context, { facts: [...context.facts, fact] }) };
      }

      case 'CONFIRM_FACT': {
        if (envelope.actor !== 'user') return reject(context, 'AUTHORITY_VIOLATION');
        assertSafeDomainId('factId', mutation.factId);
        assertSafeDomainId('turnId', mutation.turnId);
        const index = context.facts.findIndex((item) => item.id === mutation.factId);
        if (index < 0) return reject(context, 'NOT_FOUND');
        const target = context.facts[index]!;
        if (target.status === 'superseded') return reject(context, 'INVALID_MUTATION');
        const facts = [...context.facts];
        facts[index] = confirmFact(target, mutation.turnId);
        return {
          ok: true,
          context: withRevision(context, { facts, turnIds: appendTurnId(context.turnIds, mutation.turnId) }),
        };
      }

      case 'CORRECT_FACT': {
        if (envelope.actor !== 'user') return reject(context, 'AUTHORITY_VIOLATION');
        assertSafeDomainId('factId', mutation.factId);
        assertSafeDomainId('turnId', mutation.turnId);
        const index = context.facts.findIndex((item) => item.id === mutation.factId);
        if (index < 0) return reject(context, 'NOT_FOUND');
        if (idExists(context, mutation.replacement.id)) return reject(context, 'DUPLICATE_ID');
        if (mutation.replacement.source !== 'user' || mutation.replacement.status !== 'confirmed') {
          return reject(context, 'AUTHORITY_VIOLATION');
        }
        const replacement = freezeFact({ ...mutation.replacement, confirmedByTurnId: mutation.turnId });
        const facts = context.facts.map((fact, i) => i === index ? freezeFact({ ...fact, status: 'superseded' }) : fact);
        facts.push(replacement);
        const nextRevision = context.revision + 1;
        const invalidEvidence = new Set([mutation.factId]);
        const opportunities = context.opportunities.map((opportunity) =>
          opportunity.evidenceIds.some((id) => invalidEvidence.has(id))
            ? { ...opportunity, status: 'invalidated' as const, invalidatedAtRevision: nextRevision }
            : opportunity,
        );
        return {
          ok: true,
          context: withRevision(context, {
            facts,
            opportunities,
            turnIds: appendTurnId(context.turnIds, mutation.turnId),
          }),
        };
      }

      case 'ADD_OBSERVATION': {
        const observation = freezeObservation(mutation.observation);
        if (!validateObservationAuthority(envelope.actor, observation)) return reject(context, 'AUTHORITY_VIOLATION');
        if (idExists(context, observation.id)) return reject(context, 'DUPLICATE_ID');
        return { ok: true, context: withRevision(context, { quantitativeObservations: [...context.quantitativeObservations, observation] }) };
      }

      case 'CONFIRM_OBSERVATION': {
        if (envelope.actor !== 'user') return reject(context, 'AUTHORITY_VIOLATION');
        assertSafeDomainId('observationId', mutation.observationId);
        assertSafeDomainId('turnId', mutation.turnId);
        const index = context.quantitativeObservations.findIndex((item) => item.id === mutation.observationId);
        if (index < 0) return reject(context, 'NOT_FOUND');
        const target = context.quantitativeObservations[index]!;
        if (target.status === 'superseded') return reject(context, 'INVALID_MUTATION');
        const observations = [...context.quantitativeObservations];
        observations[index] = confirmObservation(target, mutation.turnId);
        return {
          ok: true,
          context: withRevision(context, {
            quantitativeObservations: observations,
            turnIds: appendTurnId(context.turnIds, mutation.turnId),
          }),
        };
      }

      case 'CORRECT_OBSERVATION': {
        if (envelope.actor !== 'user') return reject(context, 'AUTHORITY_VIOLATION');
        assertSafeDomainId('observationId', mutation.observationId);
        assertSafeDomainId('turnId', mutation.turnId);
        const index = context.quantitativeObservations.findIndex((item) => item.id === mutation.observationId);
        if (index < 0) return reject(context, 'NOT_FOUND');
        if (idExists(context, mutation.replacement.id)) return reject(context, 'DUPLICATE_ID');
        if (mutation.replacement.source !== 'user' || mutation.replacement.status !== 'confirmed') {
          return reject(context, 'AUTHORITY_VIOLATION');
        }
        const replacement = freezeObservation({ ...mutation.replacement, confirmedByTurnId: mutation.turnId });
        const observations = context.quantitativeObservations.map((observation, i) =>
          i === index ? freezeObservation({ ...observation, status: 'superseded' }) : observation,
        );
        observations.push(replacement);

        const nextRevision = context.revision + 1;
        const invalidatedCalculationIds = new Set<string>();
        const calculations = context.verifiedCalculations.map((calculation) => {
          if (!calculation.inputObservationIds.includes(mutation.observationId) || calculation.status === 'invalidated') {
            return calculation;
          }
          invalidatedCalculationIds.add(calculation.id);
          return freezeCalculation({ ...calculation, status: 'invalidated', invalidatedAtRevision: nextRevision });
        });
        const invalidEvidence = new Set<string>([mutation.observationId, ...invalidatedCalculationIds]);
        const opportunities = context.opportunities.map((opportunity) =>
          opportunity.status !== 'invalidated' && opportunity.evidenceIds.some((id) => invalidEvidence.has(id))
            ? { ...opportunity, status: 'invalidated' as const, invalidatedAtRevision: nextRevision }
            : opportunity,
        );

        return {
          ok: true,
          context: withRevision(context, {
            quantitativeObservations: observations,
            verifiedCalculations: calculations,
            opportunities,
            turnIds: appendTurnId(context.turnIds, mutation.turnId),
          }),
        };
      }

      case 'ADD_CALCULATION': {
        if (envelope.actor !== 'system' || mutation.calculation.computedBy !== 'application') {
          return reject(context, 'AUTHORITY_VIOLATION');
        }
        if (idExists(context, mutation.calculation.id)) return reject(context, 'DUPLICATE_ID');
        const calculation = freezeCalculation(mutation.calculation);
        if (calculation.basedOnRevision !== context.revision || calculation.status !== 'valid' || calculation.invalidatedAtRevision !== null) {
          return reject(context, 'INVALID_MUTATION');
        }
        const inputs = calculation.inputObservationIds.map((id) => context.quantitativeObservations.find((item) => item.id === id));
        if (inputs.some((item) => item === undefined || item.status !== 'confirmed')) return reject(context, 'INVALID_MUTATION');
        return { ok: true, context: withRevision(context, { verifiedCalculations: [...context.verifiedCalculations, calculation] }) };
      }

      case 'ADD_CALCULATIONS': {
        if (envelope.actor !== 'system') return reject(context, 'AUTHORITY_VIOLATION');
        if (!Array.isArray(mutation.calculations) || mutation.calculations.length < 1 || mutation.calculations.length > 8) {
          return reject(context, 'INVALID_MUTATION');
        }

        const batchIds = new Set<string>();
        const calculations: VerifiedCalculation[] = [];
        for (const raw of mutation.calculations) {
          if (raw.computedBy !== 'application') return reject(context, 'AUTHORITY_VIOLATION');
          if (idExists(context, raw.id) || batchIds.has(raw.id)) return reject(context, 'DUPLICATE_ID');
          const calculation = freezeCalculation(raw);
          if (
            calculation.basedOnRevision !== context.revision
            || calculation.status !== 'valid'
            || calculation.invalidatedAtRevision !== null
          ) return reject(context, 'INVALID_MUTATION');
          const inputs = calculation.inputObservationIds.map((id) =>
            context.quantitativeObservations.find((item) => item.id === id));
          if (inputs.some((item) => item === undefined || item.status !== 'confirmed')) {
            return reject(context, 'INVALID_MUTATION');
          }
          batchIds.add(calculation.id);
          calculations.push(calculation);
        }

        return {
          ok: true,
          context: withRevision(context, {
            verifiedCalculations: [...context.verifiedCalculations, ...calculations],
          }),
        };
      }

      case 'ADD_OPPORTUNITY': {
        if (envelope.actor === 'user') return reject(context, 'AUTHORITY_VIOLATION');
        if (idExists(context, mutation.opportunity.id)) return reject(context, 'DUPLICATE_ID');
        assertSafeDomainId('opportunity.id', mutation.opportunity.id);
        assertBoundedText('opportunity.summary', mutation.opportunity.summary, 1000);
        if (new Set(mutation.opportunity.capabilities).size !== mutation.opportunity.capabilities.length) return reject(context, 'INVALID_MUTATION');
        if (mutation.opportunity.capabilities.some((item) => !(CAPABILITY_KINDS as readonly string[]).includes(item))) return reject(context, 'INVALID_MUTATION');
        if (mutation.opportunity.evidenceIds.some((id) => !idExists(context, id))) return reject(context, 'INVALID_MUTATION');
        if (mutation.opportunity.invalidatedAtRevision !== null) return reject(context, 'INVALID_MUTATION');
        const opportunity = Object.freeze({
          ...mutation.opportunity,
          capabilities: Object.freeze([...mutation.opportunity.capabilities]),
          evidenceIds: Object.freeze([...mutation.opportunity.evidenceIds]),
        });
        return { ok: true, context: withRevision(context, { opportunities: [...context.opportunities, opportunity] }) };
      }

      case 'ADD_OBJECTION': {
        if (idExists(context, mutation.objection.id)) return reject(context, 'DUPLICATE_ID');
        assertSafeDomainId('objection.id', mutation.objection.id);
        assertBoundedText('objection.summary', mutation.objection.summary, 1000);
        for (const id of mutation.objection.supportingTurnIds) assertSafeDomainId('objection.turnId', id);
        const objection = Object.freeze({ ...mutation.objection, supportingTurnIds: Object.freeze([...mutation.objection.supportingTurnIds]) });
        return { ok: true, context: withRevision(context, { objections: [...context.objections, objection] }) };
      }

      case 'SET_LATEST_USER_INTENT': {
        if (envelope.actor !== 'user') return reject(context, 'AUTHORITY_VIOLATION');
        assertSafeDomainId('turnId', mutation.turnId);
        assertBoundedText('intent', mutation.intent, 4000);
        return {
          ok: true,
          context: withRevision(context, {
            latestUserIntent: { turnId: mutation.turnId, text: mutation.intent.trim() },
            turnIds: appendTurnId(context.turnIds, mutation.turnId),
          }),
        };
      }
    }
  } catch {
    return reject(context, 'INVALID_MUTATION');
  }
}
