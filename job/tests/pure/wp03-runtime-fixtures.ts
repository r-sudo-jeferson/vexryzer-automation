import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import type { CriticReview } from '../../src/ai/critic/critic-contract.ts';
import type { SellerSubmission } from '../../src/ai/seller/seller-contract.ts';
import { createReactiveExperienceState } from '../../src/experience/experience-projector.ts';
import type {
  AgentLedTurnRuntimeInput,
} from '../../src/server/ai/agent/agent-led-turn-runtime.ts';
import type { SellerTurnRuntimeInput } from '../../src/server/ai/seller/seller-turn-runtime.ts';

function canonical(): CanonicalSalesContext {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: 'session-agent-led',
    revision: 7,
    turnIds: Object.freeze(['turn-1']),
    facts: Object.freeze([]),
    primaryPain: null,
    desiredOutcome: null,
    knownConsequences: Object.freeze([]),
    objections: Object.freeze([]),
    quantitativeObservations: Object.freeze([]),
    verifiedCalculations: Object.freeze([]),
    openUncertainties: Object.freeze([]),
    opportunities: Object.freeze([]),
    artifacts: Object.freeze([]),
    currentSceneId: null,
    latestUserIntent: Object.freeze({ turnId: 'turn-1', text: 'Quero reduzir retrabalho.' }),
  });
}

export function runtimeSubmission(): Readonly<SellerSubmission> {
  return Object.freeze({
    schemaVersion: 1,
    proposalId: 'proposal-1',
    proposal: Object.freeze({
      schemaVersion: 1,
      baseRevision: 7,
      narration: 'Hipótese operacional.',
      intent: Object.freeze({
        schemaVersion: 1,
        objective: 'Evidenciar o gargalo.',
        rationale: 'A hipótese precisa de validação.',
        capabilities: Object.freeze([]),
        actions: Object.freeze([]),
        quantitativeOpportunities: Object.freeze([]),
        artifactIntents: Object.freeze([]),
        nextQuestion: null,
      }),
      factProposals: Object.freeze([]),
      correctionProposals: Object.freeze([]),
      processMutations: Object.freeze([]),
      sceneProposal: null,
      artifactProposals: Object.freeze([]),
      criticRequired: true,
    }),
    materialClaims: Object.freeze([]),
    calculationRequests: Object.freeze([]),
  });
}

export function review(): Readonly<CriticReview> {
  return Object.freeze({
    schemaVersion: 1,
    proposalId: 'proposal-1',
    basedOnRevision: 7,
    verdict: 'PASS' as const,
    findings: Object.freeze([]),
  });
}

export function baseInput(): AgentLedTurnRuntimeInput {
  const state = canonical();
  return {
    seller: {
      canonical: state,
      digest: null,
      recentTurns: Object.freeze([]),
      visualState: Object.freeze({
        sceneId: null,
        focusedEntityIds: Object.freeze([]),
        activeArtifactIds: Object.freeze([]),
      }),
      routes: Object.freeze([]),
      routeBudgets: Object.freeze([]),
      runtimeStates: Object.freeze([]),
      estimateTokens: () => 0,
      resolveCredential: () => null,
      serverConfig: Object.freeze({}),
      timeoutMs: 10_000,
    } as SellerTurnRuntimeInput,
    critic: {
      routes: Object.freeze([]),
      routeBudgets: Object.freeze([]),
      runtimeStates: Object.freeze([]),
      estimateTokens: () => 0,
      resolveCredential: () => null,
      serverConfig: Object.freeze({}),
      timeoutMs: 10_000,
    },
    reactiveState: createReactiveExperienceState({ basedOnRevision: 7 }),
    surfaceGuard: () => ({ ok: true }),
  };
}
