import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import type { CriticReview } from '../../src/ai/critic/critic-contract.ts';
import type { SellerSubmission } from '../../src/ai/seller/seller-contract.ts';
import { createReactiveExperienceState } from '../../src/experience/experience-projector.ts';
import {
  runAgentLedTurn,
  type AgentLedTurnRuntimeInput,
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

function submission(id: string): Readonly<SellerSubmission> {
  return Object.freeze({
    schemaVersion: 1,
    proposalId: id,
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

function review(proposalId: string, verdict: CriticReview['verdict']): Readonly<CriticReview> {
  const findings = verdict === 'PASS'
    ? Object.freeze([])
    : Object.freeze([Object.freeze({
        id: 'finding-' + verdict.toLowerCase(),
        code: 'USER_INTENT_MISMATCH' as const,
        severity: verdict === 'BLOCK' ? 'block' as const : 'revise' as const,
        summary: 'A proposta precisa de correção.',
        evidenceIds: Object.freeze([]),
      })]);
  return Object.freeze({
    schemaVersion: 1,
    proposalId,
    basedOnRevision: 7,
    verdict,
    findings,
  });
}

function baseInput(): AgentLedTurnRuntimeInput {
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
  };
}

function sellerOk(id: string) {
  return {
    ok: true as const,
    canonical: canonical(),
    submission: submission(id),
    routeId: 'seller-route',
    providerRounds: 1,
    providerCalls: 1,
  };
}

function criticOk(id: string, verdict: CriticReview['verdict']) {
  return {
    ok: true as const,
    review: review(id, verdict),
    routeId: 'critic-route',
    providerCalls: 1,
  };
}

test('first Critic PASS publishes exactly once without a revision round', async () => {
  const input = baseInput();
  let sellerCalls = 0;
  let criticCalls = 0;
  let publicationCalls = 0;
  input.dependencies = {
    runSellerTurn: (async () => {
      sellerCalls += 1;
      return sellerOk('proposal-1');
    }) as never,
    runCriticTurn: (async () => {
      criticCalls += 1;
      return criticOk('proposal-1', 'PASS');
    }) as never,
    commitCriticApprovedExperience: ((publishInput: { submission: Readonly<SellerSubmission> }) => {
      publicationCalls += 1;
      assert.equal(publishInput.submission.proposalId, 'proposal-1');
      return {
        ok: true,
        canonical: canonical(),
        reactiveState: input.reactiveState,
        canonicalChanged: false,
        deduplicated: false,
      };
    }) as never,
  };

  const result = await runAgentLedTurn(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.revised, false);
  assert.equal(result.reviews.length, 1);
  assert.equal(sellerCalls, 1);
  assert.equal(criticCalls, 1);
  assert.equal(publicationCalls, 1);
});

test('Critic BLOCK never reaches publication', async () => {
  const input = baseInput();
  let publicationCalls = 0;
  input.dependencies = {
    runSellerTurn: (async () => sellerOk('proposal-1')) as never,
    runCriticTurn: (async () => criticOk('proposal-1', 'BLOCK')) as never,
    commitCriticApprovedExperience: (() => {
      publicationCalls += 1;
      throw new Error('publication must not run');
    }) as never,
  };

  const result = await runAgentLedTurn(input);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'BLOCKED_BY_CRITIC');
  assert.equal(publicationCalls, 0);
  assert.equal(result.reactiveState, input.reactiveState);
});

test('one REVISE round returns structured feedback to Seller and publishes only the revised PASS', async () => {
  const input = baseInput();
  let sellerCalls = 0;
  let criticCalls = 0;
  let publicationCalls = 0;
  input.dependencies = {
    runSellerTurn: (async (sellerInput: SellerTurnRuntimeInput) => {
      sellerCalls += 1;
      if (sellerCalls === 1) return sellerOk('proposal-1');
      assert.equal(sellerInput.canonical.revision, 7);
      assert.equal(sellerInput.revisionRequest?.rootProposalId, 'proposal-1');
      assert.equal(sellerInput.revisionRequest?.previousProposalId, 'proposal-1');
      assert.equal(sellerInput.revisionRequest?.review.verdict, 'REVISE');
      return sellerOk('proposal-2');
    }) as never,
    runCriticTurn: (async (criticInput: { submission: Readonly<SellerSubmission> }) => {
      criticCalls += 1;
      return criticCalls === 1
        ? criticOk('proposal-1', 'REVISE')
        : criticOk(criticInput.submission.proposalId, 'PASS');
    }) as never,
    commitCriticApprovedExperience: ((publishInput: { submission: Readonly<SellerSubmission> }) => {
      publicationCalls += 1;
      assert.equal(publishInput.submission.proposalId, 'proposal-2');
      return {
        ok: true,
        canonical: canonical(),
        reactiveState: input.reactiveState,
        canonicalChanged: false,
        deduplicated: false,
      };
    }) as never,
  };

  const result = await runAgentLedTurn(input);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.revised, true);
  assert.equal(result.submission.proposalId, 'proposal-2');
  assert.deepEqual(result.reviews.map((item) => item.verdict), ['REVISE', 'PASS']);
  assert.equal(sellerCalls, 2);
  assert.equal(criticCalls, 2);
  assert.equal(publicationCalls, 1);
});

test('a second REVISE hits the bounded limit and never publishes', async () => {
  const input = baseInput();
  let sellerCalls = 0;
  let criticCalls = 0;
  let publicationCalls = 0;
  input.dependencies = {
    runSellerTurn: (async () => {
      sellerCalls += 1;
      return sellerOk(sellerCalls === 1 ? 'proposal-1' : 'proposal-2');
    }) as never,
    runCriticTurn: (async (criticInput: { submission: Readonly<SellerSubmission> }) => {
      criticCalls += 1;
      return criticOk(criticInput.submission.proposalId, 'REVISE');
    }) as never,
    commitCriticApprovedExperience: (() => {
      publicationCalls += 1;
      throw new Error('publication must not run');
    }) as never,
  };

  const result = await runAgentLedTurn(input);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'REVISE_LIMIT_REACHED');
  assert.equal(result.reviews.length, 2);
  assert.equal(sellerCalls, 2);
  assert.equal(criticCalls, 2);
  assert.equal(publicationCalls, 0);
});

test('reused proposal id fails rebind even if an injected Seller stub violates its own runtime contract', async () => {
  const input = baseInput();
  let sellerCalls = 0;
  let publicationCalls = 0;
  input.dependencies = {
    runSellerTurn: (async () => {
      sellerCalls += 1;
      return sellerOk('proposal-1');
    }) as never,
    runCriticTurn: (async () => criticOk('proposal-1', 'REVISE')) as never,
    commitCriticApprovedExperience: (() => {
      publicationCalls += 1;
      throw new Error('publication must not run');
    }) as never,
  };

  const result = await runAgentLedTurn(input);
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'REVISION_REBIND_FAILED');
  assert.equal(result.detail, 'INVALID_REVISED_PROPOSAL');
  assert.equal(sellerCalls, 2);
  assert.equal(publicationCalls, 0);
});
