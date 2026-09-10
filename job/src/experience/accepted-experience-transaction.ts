import type {
  ArtifactRecord,
  CanonicalSalesContext,
  OpportunityRecord,
  SalesFact,
} from '../ai/context/canonical-sales-context.ts';
import {
  applyContextMutation,
  type ContextMutationResult,
} from '../ai/context/context-reducer.ts';
import {
  validateCriticReview,
  type CriticReview,
  type CriticReviewValidation,
} from '../ai/critic/critic-contract.ts';
import {
  validateSellerSubmission,
  type SellerSubmission,
  type SellerSubmissionValidation,
} from '../ai/seller/seller-contract.ts';
import {
  projectExperienceProposal,
  reconcileReactiveExperience,
  type ExperienceProjectionResult,
} from './experience-projector.ts';
import type { ReactiveExperienceState } from './reactive-experience-state.ts';

export interface AcceptedExperienceTransactionDependencies {
  validateSellerSubmission: typeof validateSellerSubmission;
  validateCriticReview: typeof validateCriticReview;
  projectExperienceProposal: typeof projectExperienceProposal;
  reconcileReactiveExperience: typeof reconcileReactiveExperience;
  applyContextMutation: typeof applyContextMutation;
}

export interface AcceptedExperienceSurfaceGuardResult {
  ok: boolean;
  code?: string;
  path?: string;
}

export type AcceptedExperienceSurfaceGuard = (input: {
  canonical: CanonicalSalesContext;
  reactiveState: Readonly<ReactiveExperienceState>;
}) => Readonly<AcceptedExperienceSurfaceGuardResult>;

export interface AcceptedExperienceTransactionInput {
  canonical: CanonicalSalesContext;
  reactiveState: Readonly<ReactiveExperienceState>;
  submission: Readonly<SellerSubmission>;
  review: Readonly<CriticReview>;
  surfaceGuard: AcceptedExperienceSurfaceGuard;
  dependencies?: Partial<AcceptedExperienceTransactionDependencies>;
}

export type AcceptedExperienceTransactionResult =
  | {
      ok: true;
      canonical: CanonicalSalesContext;
      reactiveState: Readonly<ReactiveExperienceState>;
      canonicalChanged: boolean;
      deduplicated: boolean;
    }
  | {
      ok: false;
      code:
        | 'SELLER_SUBMISSION_REJECTED'
        | 'CRITIC_REVIEW_REJECTED'
        | 'CRITIC_NOT_PASS'
        | 'PROJECTION_REJECTED'
        | 'CANONICAL_COMMIT_REJECTED'
        | 'RECONCILE_REJECTED'
        | 'SURFACE_REJECTED';
      canonical: CanonicalSalesContext;
      reactiveState: Readonly<ReactiveExperienceState>;
      detail: string;
    };

const DEFAULT_DEPENDENCIES: AcceptedExperienceTransactionDependencies = Object.freeze({
  validateSellerSubmission,
  validateCriticReview,
  projectExperienceProposal,
  reconcileReactiveExperience,
  applyContextMutation,
});

function sellerFailureDetail(
  result: Extract<SellerSubmissionValidation, { ok: false }>,
): string {
  return result.code + ':' + result.path;
}

function criticFailureDetail(
  result: Extract<CriticReviewValidation, { ok: false }>,
): string {
  return result.code + ':' + result.path;
}

function projectionFailureDetail(
  result: Extract<ExperienceProjectionResult, { ok: false }>,
): string {
  return result.code + ':' + result.path;
}

function canonicalFacts(submission: Readonly<SellerSubmission>): readonly SalesFact[] {
  return Object.freeze(submission.proposal.factProposals.map((fact) => Object.freeze({
    id: fact.id,
    subject: fact.subject,
    predicate: fact.predicate,
    value: fact.value,
    status: 'proposed' as const,
    source: 'inference' as const,
    confidence: null,
    supportingTurnIds: Object.freeze([...fact.supportingTurnIds]),
    confirmedByTurnId: null,
  })));
}

function canonicalOpportunities(
  submission: Readonly<SellerSubmission>,
): readonly OpportunityRecord[] {
  return Object.freeze(submission.proposal.intent.quantitativeOpportunities.map((item) => Object.freeze({
    id: item.id,
    summary: item.objective,
    capabilities: Object.freeze([...submission.proposal.intent.capabilities]),
    evidenceIds: Object.freeze([...item.evidenceIds]),
    status: 'surfaced' as const,
    invalidatedAtRevision: null,
  })));
}

function canonicalArtifacts(
  submission: Readonly<SellerSubmission>,
): readonly ArtifactRecord[] {
  return Object.freeze(submission.proposal.artifactProposals.map((item) => Object.freeze({
    id: item.id,
    kind: item.kind,
    title: item.title,
    summary: item.summary,
    maturity: item.status,
    evidenceIds: Object.freeze([...item.evidenceIds]),
    status: 'proposed' as const,
    invalidatedAtRevision: null,
  })));
}

function canonicalCommit(
  canonical: CanonicalSalesContext,
  submission: Readonly<SellerSubmission>,
  dependencies: AcceptedExperienceTransactionDependencies,
): ContextMutationResult | null {
  const facts = canonicalFacts(submission);
  const opportunities = canonicalOpportunities(submission);
  const artifacts = canonicalArtifacts(submission);
  if (facts.length + opportunities.length + artifacts.length === 0) return null;

  return dependencies.applyContextMutation(canonical, {
    baseRevision: canonical.revision,
    actor: 'model',
    mutation: {
      type: 'COMMIT_MODEL_PROPOSAL',
      facts,
      opportunities,
      artifacts,
    },
  });
}

export function commitCriticApprovedExperience(
  input: AcceptedExperienceTransactionInput,
): AcceptedExperienceTransactionResult {
  const dependencies: AcceptedExperienceTransactionDependencies = Object.freeze({
    ...DEFAULT_DEPENDENCIES,
    ...input.dependencies,
  });

  const seller = dependencies.validateSellerSubmission(input.submission, {
    canonical: input.canonical,
  });
  if (!seller.ok) {
    return {
      ok: false,
      code: 'SELLER_SUBMISSION_REJECTED',
      canonical: input.canonical,
      reactiveState: input.reactiveState,
      detail: sellerFailureDetail(seller),
    };
  }

  const critic = dependencies.validateCriticReview(input.review, {
    expectedProposalId: seller.submission.proposalId,
    expectedRevision: input.canonical.revision,
  });
  if (!critic.ok) {
    return {
      ok: false,
      code: 'CRITIC_REVIEW_REJECTED',
      canonical: input.canonical,
      reactiveState: input.reactiveState,
      detail: criticFailureDetail(critic),
    };
  }
  if (critic.review.verdict !== 'PASS') {
    return {
      ok: false,
      code: 'CRITIC_NOT_PASS',
      canonical: input.canonical,
      reactiveState: input.reactiveState,
      detail: critic.review.verdict,
    };
  }

  const projected = dependencies.projectExperienceProposal(
    input.reactiveState,
    seller.submission.proposal,
    input.canonical,
  );
  if (!projected.ok) {
    return {
      ok: false,
      code: 'PROJECTION_REJECTED',
      canonical: input.canonical,
      reactiveState: input.reactiveState,
      detail: projectionFailureDetail(projected),
    };
  }

  const committed = canonicalCommit(
    input.canonical,
    seller.submission,
    dependencies,
  );
  if (committed !== null && !committed.ok) {
    return {
      ok: false,
      code: 'CANONICAL_COMMIT_REJECTED',
      canonical: input.canonical,
      reactiveState: input.reactiveState,
      detail: committed.code,
    };
  }

  const canonical = committed === null ? input.canonical : committed.context;
  let reactiveState: Readonly<ReactiveExperienceState>;
  try {
    reactiveState = dependencies.reconcileReactiveExperience(projected.state, canonical);
  } catch {
    return {
      ok: false,
      code: 'RECONCILE_REJECTED',
      canonical: input.canonical,
      reactiveState: input.reactiveState,
      detail: 'REACTIVE_CANONICAL_RECONCILIATION_FAILED',
    };
  }

  let surface;
  try {
    surface = input.surfaceGuard({ canonical, reactiveState });
  } catch {
    return {
      ok: false,
      code: 'SURFACE_REJECTED',
      canonical: input.canonical,
      reactiveState: input.reactiveState,
      detail: 'SURFACE_GUARD_THROW',
    };
  }
  if (!surface.ok) {
    return {
      ok: false,
      code: 'SURFACE_REJECTED',
      canonical: input.canonical,
      reactiveState: input.reactiveState,
      detail: (surface.code ?? 'SURFACE_REJECTED') + ':' + (surface.path ?? 'surface'),
    };
  }

  return {
    ok: true,
    canonical,
    reactiveState,
    canonicalChanged: committed !== null,
    deduplicated: projected.deduplicated,
  };
}
