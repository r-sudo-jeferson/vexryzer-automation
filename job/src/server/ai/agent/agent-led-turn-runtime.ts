import type { CanonicalSalesContext } from '../../../ai/context/canonical-sales-context.ts';
import {
  applyCriticReview,
  bindRevisedProposal,
  createCriticCycleState,
  type CriticReview,
  type CriticCycleState,
} from '../../../ai/critic/critic-contract.ts';
import type { SellerSubmission } from '../../../ai/seller/seller-contract.ts';
import {
  commitCriticApprovedExperience,
  type AcceptedExperienceTransactionResult,
} from '../../../experience/accepted-experience-transaction.ts';
import type { ReactiveExperienceState } from '../../../experience/reactive-experience-state.ts';
import {
  runCriticTurn,
  type CriticTurnRuntimeInput,
  type CriticTurnRuntimeResult,
} from '../critic/critic-turn-runtime.ts';
import {
  runSellerTurn,
  type SellerTurnRuntimeInput,
  type SellerTurnRuntimeResult,
} from '../seller/seller-turn-runtime.ts';

export type AgentLedCriticRuntimeConfig = Omit<
  CriticTurnRuntimeInput,
  'canonical' | 'submission' | 'digest' | 'recentTurns' | 'visualState'
>;

export interface AgentLedTurnRuntimeDependencies {
  runSellerTurn: typeof runSellerTurn;
  runCriticTurn: typeof runCriticTurn;
  createCriticCycleState: typeof createCriticCycleState;
  applyCriticReview: typeof applyCriticReview;
  bindRevisedProposal: typeof bindRevisedProposal;
  commitCriticApprovedExperience: typeof commitCriticApprovedExperience;
}

export interface AgentLedTurnRuntimeInput {
  seller: SellerTurnRuntimeInput;
  critic: AgentLedCriticRuntimeConfig;
  reactiveState: Readonly<ReactiveExperienceState>;
  dependencies?: Partial<AgentLedTurnRuntimeDependencies>;
}

export type AgentLedTurnRuntimeResult =
  | {
      ok: true;
      canonical: CanonicalSalesContext;
      reactiveState: Readonly<ReactiveExperienceState>;
      submission: Readonly<SellerSubmission>;
      reviews: readonly Readonly<CriticReview>[];
      revised: boolean;
      sellerRouteIds: readonly string[];
      criticRouteIds: readonly string[];
      publication: Extract<AcceptedExperienceTransactionResult, { ok: true }>;
    }
  | {
      ok: false;
      code:
        | 'SELLER_FAILED'
        | 'CRITIC_FAILED'
        | 'BLOCKED_BY_CRITIC'
        | 'REVISION_REBIND_FAILED'
        | 'REVISE_LIMIT_REACHED'
        | 'CRITIC_GATE_REJECTED'
        | 'PUBLICATION_FAILED';
      canonical: CanonicalSalesContext;
      reactiveState: Readonly<ReactiveExperienceState>;
      detail: string;
      reviews: readonly Readonly<CriticReview>[];
    };

const DEFAULT_DEPENDENCIES: AgentLedTurnRuntimeDependencies = Object.freeze({
  runSellerTurn,
  runCriticTurn,
  createCriticCycleState,
  applyCriticReview,
  bindRevisedProposal,
  commitCriticApprovedExperience,
});

function failureCode(result: { code: string }): string {
  return result.code;
}

function criticInput(
  input: AgentLedTurnRuntimeInput,
  canonical: CanonicalSalesContext,
  submission: Readonly<SellerSubmission>,
): CriticTurnRuntimeInput {
  return {
    ...input.critic,
    canonical,
    submission,
    digest: input.seller.digest,
    recentTurns: input.seller.recentTurns,
    visualState: input.seller.visualState,
  };
}

async function evaluateCritic(
  input: AgentLedTurnRuntimeInput,
  canonical: CanonicalSalesContext,
  submission: Readonly<SellerSubmission>,
  dependencies: AgentLedTurnRuntimeDependencies,
): Promise<CriticTurnRuntimeResult> {
  return dependencies.runCriticTurn(criticInput(input, canonical, submission));
}

function gateReview(
  cycle: Readonly<CriticCycleState>,
  review: Readonly<CriticReview>,
  submission: Readonly<SellerSubmission>,
  canonical: CanonicalSalesContext,
  dependencies: AgentLedTurnRuntimeDependencies,
) {
  return dependencies.applyCriticReview(cycle, review, {
    currentProposalId: submission.proposalId,
    currentRevision: canonical.revision,
  });
}

function publish(
  input: AgentLedTurnRuntimeInput,
  canonical: CanonicalSalesContext,
  submission: Readonly<SellerSubmission>,
  review: Readonly<CriticReview>,
  reviews: readonly Readonly<CriticReview>[],
  sellerRouteIds: readonly string[],
  criticRouteIds: readonly string[],
  revised: boolean,
  dependencies: AgentLedTurnRuntimeDependencies,
): AgentLedTurnRuntimeResult {
  const publication = dependencies.commitCriticApprovedExperience({
    canonical,
    reactiveState: input.reactiveState,
    submission,
    review,
  });
  if (!publication.ok) {
    return {
      ok: false,
      code: 'PUBLICATION_FAILED',
      canonical,
      reactiveState: input.reactiveState,
      detail: publication.code + ':' + publication.detail,
      reviews,
    };
  }
  return {
    ok: true,
    canonical: publication.canonical,
    reactiveState: publication.reactiveState,
    submission,
    reviews,
    revised,
    sellerRouteIds: Object.freeze([...sellerRouteIds]),
    criticRouteIds: Object.freeze([...criticRouteIds]),
    publication,
  };
}

export async function runAgentLedTurn(
  input: AgentLedTurnRuntimeInput,
): Promise<AgentLedTurnRuntimeResult> {
  const dependencies: AgentLedTurnRuntimeDependencies = Object.freeze({
    ...DEFAULT_DEPENDENCIES,
    ...input.dependencies,
  });

  const firstSeller = await dependencies.runSellerTurn(input.seller);
  if (!firstSeller.ok) {
    return {
      ok: false,
      code: 'SELLER_FAILED',
      canonical: firstSeller.canonical,
      reactiveState: input.reactiveState,
      detail: failureCode(firstSeller),
      reviews: Object.freeze([]),
    };
  }

  let canonical = firstSeller.canonical;
  let submission = firstSeller.submission;
  const sellerRouteIds = [firstSeller.routeId];
  const criticRouteIds: string[] = [];
  const reviews: Readonly<CriticReview>[] = [];
  let cycle = dependencies.createCriticCycleState({
    proposalId: submission.proposalId,
    basedOnRevision: canonical.revision,
  });

  const firstCritic = await evaluateCritic(input, canonical, submission, dependencies);
  if (!firstCritic.ok) {
    return {
      ok: false,
      code: 'CRITIC_FAILED',
      canonical,
      reactiveState: input.reactiveState,
      detail: failureCode(firstCritic),
      reviews: Object.freeze(reviews),
    };
  }
  criticRouteIds.push(firstCritic.routeId);
  reviews.push(firstCritic.review);

  const firstGate = gateReview(cycle, firstCritic.review, submission, canonical, dependencies);
  if (!firstGate.ok) {
    return {
      ok: false,
      code: 'CRITIC_GATE_REJECTED',
      canonical,
      reactiveState: input.reactiveState,
      detail: firstGate.code,
      reviews: Object.freeze([...reviews]),
    };
  }
  cycle = firstGate.state;

  if (firstGate.action === 'BLOCK') {
    return {
      ok: false,
      code: 'BLOCKED_BY_CRITIC',
      canonical,
      reactiveState: input.reactiveState,
      detail: 'BLOCK',
      reviews: Object.freeze([...reviews]),
    };
  }
  if (firstGate.action === 'COMMIT') {
    return publish(
      input,
      canonical,
      submission,
      firstCritic.review,
      Object.freeze([...reviews]),
      sellerRouteIds,
      criticRouteIds,
      false,
      dependencies,
    );
  }

  const revisedSellerInput: SellerTurnRuntimeInput = {
    ...input.seller,
    canonical,
    revisionRequest: Object.freeze({
      rootProposalId: cycle.rootProposalId,
      previousProposalId: cycle.currentProposalId,
      review: firstCritic.review,
    }),
  };
  const revisedSeller = await dependencies.runSellerTurn(revisedSellerInput);
  if (!revisedSeller.ok) {
    return {
      ok: false,
      code: 'SELLER_FAILED',
      canonical: revisedSeller.canonical,
      reactiveState: input.reactiveState,
      detail: failureCode(revisedSeller),
      reviews: Object.freeze([...reviews]),
    };
  }
  canonical = revisedSeller.canonical;
  submission = revisedSeller.submission;
  sellerRouteIds.push(revisedSeller.routeId);

  const rebound = dependencies.bindRevisedProposal(cycle, {
    proposalId: submission.proposalId,
    basedOnRevision: canonical.revision,
  });
  if (!rebound.ok) {
    return {
      ok: false,
      code: 'REVISION_REBIND_FAILED',
      canonical,
      reactiveState: input.reactiveState,
      detail: rebound.code,
      reviews: Object.freeze([...reviews]),
    };
  }
  cycle = rebound.state;

  const secondCritic = await evaluateCritic(input, canonical, submission, dependencies);
  if (!secondCritic.ok) {
    return {
      ok: false,
      code: 'CRITIC_FAILED',
      canonical,
      reactiveState: input.reactiveState,
      detail: failureCode(secondCritic),
      reviews: Object.freeze([...reviews]),
    };
  }
  criticRouteIds.push(secondCritic.routeId);
  reviews.push(secondCritic.review);

  const secondGate = gateReview(cycle, secondCritic.review, submission, canonical, dependencies);
  if (!secondGate.ok) {
    return {
      ok: false,
      code: secondGate.code === 'REVISE_LIMIT_REACHED'
        ? 'REVISE_LIMIT_REACHED'
        : 'CRITIC_GATE_REJECTED',
      canonical,
      reactiveState: input.reactiveState,
      detail: secondGate.code,
      reviews: Object.freeze([...reviews]),
    };
  }
  if (secondGate.action === 'BLOCK') {
    return {
      ok: false,
      code: 'BLOCKED_BY_CRITIC',
      canonical,
      reactiveState: input.reactiveState,
      detail: 'BLOCK',
      reviews: Object.freeze([...reviews]),
    };
  }
  if (secondGate.action !== 'COMMIT') {
    return {
      ok: false,
      code: 'REVISE_LIMIT_REACHED',
      canonical,
      reactiveState: input.reactiveState,
      detail: 'REVISE_LIMIT_REACHED',
      reviews: Object.freeze([...reviews]),
    };
  }

  return publish(
    input,
    canonical,
    submission,
    secondCritic.review,
    Object.freeze([...reviews]),
    sellerRouteIds,
    criticRouteIds,
    true,
    dependencies,
  );
}
