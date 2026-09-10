import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import type { CriticReview } from '../../src/ai/critic/critic-contract.ts';
import type { SellerSubmission } from '../../src/ai/seller/seller-contract.ts';
import {
  commitCriticApprovedExperience,
} from '../../src/experience/accepted-experience-transaction.ts';
import {
  createReactiveExperienceState,
} from '../../src/experience/experience-projector.ts';

function canonical(revision = 4): CanonicalSalesContext {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: 'session-publish',
    revision,
    turnIds: Object.freeze(['turn-1']),
    facts: Object.freeze([]),
    primaryPain: 'retrabalho no fechamento',
    desiredOutcome: 'liberar capacidade',
    knownConsequences: Object.freeze([]),
    objections: Object.freeze([]),
    quantitativeObservations: Object.freeze([]),
    verifiedCalculations: Object.freeze([]),
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

function submission(
  revision = 4,
  opportunityEvidence: readonly string[] = Object.freeze(['fact-new']),
): Readonly<SellerSubmission> {
  return Object.freeze({
    schemaVersion: 1,
    proposalId: 'proposal-publish',
    proposal: Object.freeze({
      schemaVersion: 1,
      baseRevision: revision,
      narration: 'O retrabalho pode ser tornado visível sem presumir economia.',
      intent: Object.freeze({
        schemaVersion: 1,
        objective: 'Expor o gargalo com evidência.',
        rationale: 'A hipótese é útil para orientar a próxima decisão.',
        capabilities: Object.freeze([
          'process_data_improvement',
          'bi_decision_intelligence',
        ] as const),
        actions: Object.freeze([]),
        quantitativeOpportunities: Object.freeze([Object.freeze({
          id: 'opp-new',
          kind: 'other' as const,
          objective: 'Medir o impacto do retrabalho.',
          evidenceIds: Object.freeze([...opportunityEvidence]),
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

function review(
  verdict: CriticReview['verdict'] = 'PASS',
  revision = 4,
): Readonly<CriticReview> {
  const findings = verdict === 'PASS'
    ? Object.freeze([])
    : Object.freeze([Object.freeze({
        id: 'finding-1',
        code: 'USER_INTENT_MISMATCH' as const,
        severity: verdict === 'BLOCK' ? 'block' as const : 'revise' as const,
        summary: 'A proposta precisa de correção antes de publicação.',
        evidenceIds: Object.freeze([]),
      })]);
  return Object.freeze({
    schemaVersion: 1,
    proposalId: 'proposal-publish',
    basedOnRevision: revision,
    verdict,
    findings,
  });
}

test('PASS publishes canonical evidence and reactive projection as one outer transaction', () => {
  const initialCanonical = canonical();
  const initialReactive = createReactiveExperienceState({ basedOnRevision: 4 });
  const result = commitCriticApprovedExperience({
    canonical: initialCanonical,
    reactiveState: initialReactive,
    submission: submission(),
    review: review(),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.canonicalChanged, true);
  assert.equal(result.canonical.revision, 5);
  assert.equal(result.canonical.facts[0]?.id, 'fact-new');
  assert.equal(result.canonical.facts[0]?.status, 'proposed');
  assert.equal(result.canonical.facts[0]?.confidence, null);
  assert.equal(result.canonical.opportunities[0]?.id, 'opp-new');
  assert.equal(result.canonical.artifacts[0]?.id, 'artifact-new');
  assert.equal(result.canonical.artifacts[0]?.maturity, 'conceptual');
  assert.equal(result.canonical.artifacts[0]?.summary, 'Visão conceitual apoiada na hipótese explicitada.');
  assert.equal(result.reactiveState.basedOnRevision, 5);
  assert.equal(result.reactiveState.projectionRevision, 1);
  assert.equal(result.reactiveState.processMutations[0]?.mutation.kind, 'upsert_node');
  assert.equal(result.reactiveState.artifacts[0]?.id, 'artifact-new');
});

test('correction-only PASS updates reactive suggestion state without granting the model a canonical mutation', () => {
  const existingFact = Object.freeze({
    id: 'fact-existing',
    subject: 'fechamento',
    predicate: 'leva',
    value: '5 dias',
    status: 'confirmed' as const,
    source: 'user' as const,
    confidence: 1,
    supportingTurnIds: Object.freeze(['turn-1']),
    confirmedByTurnId: 'turn-1',
  });
  const initialCanonical = Object.freeze({
    ...canonical(),
    facts: Object.freeze([existingFact]),
  });
  const initialReactive = createReactiveExperienceState({ basedOnRevision: 4 });
  const base = submission();
  const correctionOnly = Object.freeze({
    ...base,
    proposal: Object.freeze({
      ...base.proposal,
      factProposals: Object.freeze([]),
      intent: Object.freeze({
        ...base.proposal.intent,
        quantitativeOpportunities: Object.freeze([]),
      }),
      processMutations: Object.freeze([]),
      sceneProposal: null,
      artifactProposals: Object.freeze([]),
      correctionProposals: Object.freeze([Object.freeze({
        id: 'correction-existing',
        targetEvidenceId: 'fact-existing',
        reason: 'Há indicação de que o prazo informado pode ter mudado.',
        replacementValue: '3 dias',
        supportingTurnIds: Object.freeze(['turn-1']),
      })]),
    }),
  });

  const result = commitCriticApprovedExperience({
    canonical: initialCanonical,
    reactiveState: initialReactive,
    submission: correctionOnly,
    review: review(),
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.canonicalChanged, false);
  assert.equal(result.canonical, initialCanonical);
  assert.equal(result.canonical.revision, 4);
  assert.equal(result.canonical.facts[0]?.value, '5 dias');
  assert.equal(result.reactiveState.projectionRevision, 1);
  assert.equal(result.reactiveState.correctionSuggestions[0]?.status, 'pending');
  assert.equal(result.reactiveState.correctionSuggestions[0]?.correction.replacementValue, '3 dias');
});

test('REVISE, BLOCK, or stale Critic verdict cannot publish anything', async (t) => {
  for (const candidate of [
    review('REVISE'),
    review('BLOCK'),
    review('PASS', 3),
  ]) {
    await t.test(candidate.verdict + ':' + candidate.basedOnRevision, () => {
      const initialCanonical = canonical();
      const initialReactive = createReactiveExperienceState({ basedOnRevision: 4 });
      const result = commitCriticApprovedExperience({
        canonical: initialCanonical,
        reactiveState: initialReactive,
        submission: submission(),
        review: candidate,
      });
      assert.equal(result.ok, false);
      if (result.ok) return;
      assert.equal(result.canonical, initialCanonical);
      assert.equal(result.reactiveState, initialReactive);
    });
  }
});

test('a canonical sibling failure discards an otherwise valid projected candidate', () => {
  const initialCanonical = canonical();
  const initialReactive = createReactiveExperienceState({ basedOnRevision: 4 });
  const result = commitCriticApprovedExperience({
    canonical: initialCanonical,
    reactiveState: initialReactive,
    submission: submission(4, Object.freeze(['fact-missing'])),
    review: review(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'CANONICAL_COMMIT_REJECTED');
  assert.equal(result.detail, 'INVALID_MUTATION');
  assert.equal(result.canonical, initialCanonical);
  assert.equal(result.reactiveState, initialReactive);
  assert.equal(initialReactive.projectionRevision, 0);
  assert.equal(initialCanonical.revision, 4);
});

test('projection failure occurs before canonical mutation and preserves both originals', () => {
  const initialCanonical = canonical();
  const initialReactive = createReactiveExperienceState({ basedOnRevision: 4 });
  const raw = submission();
  const broken = Object.freeze({
    ...raw,
    proposal: Object.freeze({
      ...raw.proposal,
      artifactProposals: Object.freeze([Object.freeze({
        ...raw.proposal.artifactProposals[0]!,
        evidenceIds: Object.freeze(['fact-missing']),
      })]),
    }),
  });
  const result = commitCriticApprovedExperience({
    canonical: initialCanonical,
    reactiveState: initialReactive,
    submission: broken,
    review: review(),
  });

  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'PROJECTION_REJECTED');
  assert.equal(result.canonical, initialCanonical);
  assert.equal(result.reactiveState, initialReactive);
});
