import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import type { CriticReview } from '../../src/ai/critic/critic-contract.ts';
import type { SellerSubmission } from '../../src/ai/seller/seller-contract.ts';

export function canonical(calculationStatus: 'valid' | 'invalidated' = 'valid'): CanonicalSalesContext {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: 'session-publish',
    revision: 4,
    turnIds: Object.freeze(['turn-1']),
    facts: Object.freeze([]),
    primaryPain: 'retrabalho no fechamento',
    desiredOutcome: 'liberar capacidade',
    knownConsequences: Object.freeze([]),
    objections: Object.freeze([]),
    quantitativeObservations: Object.freeze([]),
    verifiedCalculations: Object.freeze([Object.freeze({
      id: 'calc-1',
      kind: 'capacity',
      inputObservationIds: Object.freeze(['obs-1']),
      expression: '1',
      resultValue: 44,
      resultUnit: 'hour/month',
      computedBy: 'application',
      basedOnRevision: 4,
      status: calculationStatus,
      invalidatedAtRevision: calculationStatus === 'invalidated' ? 4 : null,
    })]),
    openUncertainties: Object.freeze([]),
    opportunities: Object.freeze([]),
    artifacts: Object.freeze([]),
    currentSceneId: null,
    latestUserIntent: Object.freeze({
      turnId: 'turn-1',
      text: 'Quero reduzir retrabalho.',
    }),
  });
}

export function submission(
  variant: 'ok' | 'quantify-invalidated' | 'stale' = 'ok',
): Readonly<SellerSubmission> {
  const actions = variant === 'quantify-invalidated'
    ? Object.freeze([Object.freeze({
        id: 'act-quant',
        kind: 'quantify' as const,
        calculationId: 'calc-1',
        targetId: null,
        reason: 'Mostrar a capacidade invalidada.',
      })])
    : Object.freeze([]);
  return Object.freeze({
    schemaVersion: 1,
    proposalId: 'proposal-publish',
    proposal: Object.freeze({
      schemaVersion: 1,
      baseRevision: variant === 'stale' ? 3 : 4,
      narration: 'O retrabalho pode ser tornado visível sem presumir economia.',
      intent: Object.freeze({
        schemaVersion: 1,
        objective: 'Expor o gargalo com evidência.',
        rationale: 'A hipótese é útil para orientar a próxima decisão.',
        capabilities: Object.freeze([
          'process_data_improvement',
          'bi_decision_intelligence',
        ] as const),
        actions,
        quantitativeOpportunities: Object.freeze([Object.freeze({
          id: 'opp-new',
          kind: 'other' as const,
          objective: 'Medir o impacto do retrabalho.',
          evidenceIds: Object.freeze(['fact-new']),
          missingInputs: Object.freeze([]),
        })]),
        artifactIntents: Object.freeze([]),
        nextQuestion: null,
      }),
      factProposals: Object.freeze([Object.freeze({
        id: 'fact-new',
        subject: 'fechamento',
        predicate: 'pode-conter',
        value: 'retrabalho',
        source: 'inference' as const,
        supportingTurnIds: Object.freeze(['turn-1']),
      })]),
      correctionProposals: Object.freeze([]),
      processMutations: Object.freeze([Object.freeze({
        id: 'mutation-new',
        kind: 'upsert_node' as const,
        nodeId: 'node-retrabalho',
        label: 'Retrabalho',
        summary: 'Hipótese operacional a validar.',
        evidenceIds: Object.freeze(['fact-new']),
      })]),
      sceneProposal: Object.freeze({
        composition: 'focus' as const,
        focusIds: Object.freeze(['node-retrabalho']),
        comparisonIds: Object.freeze([]),
        announcement: 'Hipótese de retrabalho em foco.',
      }),
      artifactProposals: Object.freeze([Object.freeze({
        id: 'artifact-new',
        kind: 'bi_dashboard' as const,
        title: 'Mapa de retrabalho',
        summary: 'Visão conceitual apoiada na hipótese explicitada.',
        evidenceIds: Object.freeze(['fact-new']),
        status: 'conceptual' as const,
      })]),
      criticRequired: true,
    }),
    materialClaims: Object.freeze([]),
    calculationRequests: Object.freeze([]),
  });
}

export function review(): Readonly<CriticReview> {
  return Object.freeze({
    schemaVersion: 1,
    proposalId: 'proposal-publish',
    basedOnRevision: 4,
    verdict: 'PASS' as const,
    findings: Object.freeze([]),
  });
}
