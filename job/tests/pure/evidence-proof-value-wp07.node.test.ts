import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import { applyContextMutation } from '../../src/ai/context/context-reducer.ts';
import type { CriticReview } from '../../src/ai/critic/critic-contract.ts';
import type { SellerSubmission } from '../../src/ai/seller/seller-contract.ts';
import {
  commitCriticApprovedExperience,
} from '../../src/experience/accepted-experience-transaction.ts';
import {
  createReactiveExperienceState,
  projectExperienceProposal,
  reconcileReactiveExperience,
} from '../../src/experience/experience-projector.ts';
import type { ExperienceProposal } from '../../src/experience/experience-proposal.ts';
import { processFixtures } from '../../src/canvas/fixtures.ts';
import { projectReactiveCanvas } from '../../src/canvas/reactive-graph-adapter.ts';
import { projectPublicAgentSessionState } from '../../src/server/session/stored-agent-turn-service.ts';
import type { AgentSessionRecord } from '../../src/server/session/agent-session.ts';

function proofCanonical(): CanonicalSalesContext {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: 'session-wp07',
    revision: 7,
    turnIds: Object.freeze(['turn-7']),
    facts: Object.freeze([
      Object.freeze({
        id: 'fact-loop',
        subject: 'fechamento',
        predicate: 'contem',
        value: 'retrabalho recorrente',
        status: 'proposed' as const,
        source: 'inference' as const,
        confidence: null,
        supportingTurnIds: Object.freeze(['turn-7']),
        confirmedByTurnId: null,
      }),
      Object.freeze({
        id: 'fact-confirmed-loop',
        subject: 'conferencia',
        predicate: 'consome',
        value: 'capacidade do time',
        status: 'confirmed' as const,
        source: 'inference' as const,
        confidence: null,
        supportingTurnIds: Object.freeze(['turn-7']),
        confirmedByTurnId: 'turn-7',
      }),
    ]),
    primaryPain: 'retrabalho no fechamento',
    desiredOutcome: 'liberar capacidade',
    knownConsequences: Object.freeze([]),
    objections: Object.freeze([]),
    quantitativeObservations: Object.freeze([
      Object.freeze({
        id: 'obs-volume',
        metric: 'conferencias por mes',
        value: 220,
        unit: 'occurrence' as const,
        period: 'month' as const,
        status: 'confirmed' as const,
        source: 'user' as const,
        supportingTurnIds: Object.freeze(['turn-7']),
        confirmedByTurnId: 'turn-7',
      }),
    ]),
    verifiedCalculations: Object.freeze([
      Object.freeze({
        id: 'calc-capacity',
        kind: 'capacity' as const,
        inputObservationIds: Object.freeze(['obs-volume']),
        expression: '220 ocorrencias * 12 min / 60',
        resultValue: 44,
        resultUnit: 'hour/month',
        computedBy: 'application' as const,
        basedOnRevision: 7,
        status: 'valid' as const,
        invalidatedAtRevision: null,
      }),
    ]),
    openUncertainties: Object.freeze(['horas por pessoa por dia']),
    opportunities: Object.freeze([
      Object.freeze({
        id: 'opp-capacity',
        kind: 'monthly_capacity' as const,
        summary: 'Medir a capacidade consumida pela conferencia manual.',
        capabilities: Object.freeze(['process_data_improvement' as const]),
        evidenceIds: Object.freeze(['fact-confirmed-loop', 'calc-capacity']),
        missingInputs: Object.freeze(['minutos por conferencia', 'pessoas envolvidas']),
        status: 'surfaced' as const,
        invalidatedAtRevision: null,
      }),
    ]),
    artifacts: Object.freeze([]),
    currentSceneId: null,
    latestUserIntent: Object.freeze({ turnId: 'turn-7', text: 'Onde perco capacidade?' }),
  });
}

function proofProposal(): ExperienceProposal {
  return {
    schemaVersion: 1,
    baseRevision: 7,
    narration: 'A conferencia manual consome capacidade que pode ser tornada visivel.',
    intent: {
      schemaVersion: 1,
      objective: 'Materializar a evidencia e o valor com proveniencia.',
      rationale: 'A prova precisa carregar linhagem deterministica.',
      capabilities: ['process_data_improvement', 'bi_decision_intelligence'],
      actions: [
        {
          id: 'act-note',
          kind: 'annotate',
          targetId: 'manual-review',
          text: 'Validar frequencia e causa com o escritorio.',
          evidenceIds: ['fact-confirmed-loop', 'obs-volume'],
        },
        {
          id: 'act-quant',
          kind: 'quantify',
          calculationId: 'calc-capacity',
          targetId: 'manual-review',
          reason: 'Expor a capacidade verificada.',
        },
      ],
      quantitativeOpportunities: [],
      artifactIntents: [],
      nextQuestion: null,
    },
    factProposals: [],
    correctionProposals: [],
    processMutations: [],
    sceneProposal: null,
    artifactProposals: [],
    criticRequired: true,
  };
}

function passReview(): Readonly<CriticReview> {
  return Object.freeze({
    schemaVersion: 1,
    proposalId: 'proposal-wp07',
    basedOnRevision: 7,
    verdict: 'PASS' as const,
    findings: Object.freeze([]),
  });
}

test('WP07 RED: accepted transaction preserves quantitativeOpportunity kind and missingInputs', () => {
  const canonical = Object.freeze({ ...proofCanonical(), revision: 4, facts: Object.freeze([]), quantitativeObservations: Object.freeze([]), verifiedCalculations: Object.freeze([]), opportunities: Object.freeze([]) });
  const base = proofProposal();
  const submission = Object.freeze({
    schemaVersion: 1,
    proposalId: 'proposal-wp07',
    proposal: Object.freeze({
      ...base,
      baseRevision: 4,
      intent: Object.freeze({
        ...base.intent,
        actions: Object.freeze([]),
        quantitativeOpportunities: Object.freeze([Object.freeze({
          id: 'opp-new',
          kind: 'rework_volume' as const,
          objective: 'Medir o impacto do retrabalho.',
          evidenceIds: Object.freeze(['fact-new']),
          missingInputs: Object.freeze(['taxa de retrabalho']),
        })]),
      }),
      factProposals: Object.freeze([Object.freeze({
        id: 'fact-new',
        subject: 'fechamento',
        predicate: 'pode-conter',
        value: 'retrabalho',
        source: 'inference' as const,
        supportingTurnIds: Object.freeze(['turn-1']),
      })]),
    }),
    materialClaims: Object.freeze([]),
    calculationRequests: Object.freeze([]),
  }) as unknown as Readonly<SellerSubmission>;
  const result = commitCriticApprovedExperience({
    canonical,
    reactiveState: createReactiveExperienceState({ basedOnRevision: 4 }),
    submission,
    review: Object.freeze({ ...passReview(), basedOnRevision: 4 }),
    surfaceGuard: () => ({ ok: true }),
  });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const opportunity = result.canonical.opportunities.find((item) => item.id === 'opp-new');
  assert.ok(opportunity !== undefined, 'opportunity must be committed');
  assert.equal((opportunity as unknown as { kind: string }).kind, 'rework_volume');
  assert.deepEqual(
    (opportunity as unknown as { missingInputs: readonly string[] }).missingInputs,
    ['taxa de retrabalho'],
  );
});

test('WP07 RED: node quantification exposes deterministic application lineage', () => {
  const projected = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }),
    proofProposal(),
    proofCanonical(),
  );
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  const result = projectReactiveCanvas(processFixtures.standard.graph, projected.state, { ...proofCanonical(), proposalFacts: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const overlay = result.model.overlays.find((item) => item.nodeId === 'manual-review');
  const quantification = overlay?.quantifications[0] as unknown as Record<string, unknown> | undefined;
  assert.ok(quantification !== undefined, 'quantification must be projected');
  assert.equal(quantification['calculationId'], 'calc-capacity');
  assert.equal(quantification['resultValue'], 44);
  assert.equal(quantification['computedBy'], 'application');
  assert.equal(quantification['expression'], '220 ocorrencias * 12 min / 60');
  assert.equal(quantification['basedOnRevision'], 7);
  assert.deepEqual(quantification['inputObservationIds'], ['obs-volume']);
  const inputs = quantification['inputs'] as unknown as readonly { id: string; source: string; status: string }[];
  assert.deepEqual(inputs, [{ id: 'obs-volume', source: 'user', status: 'confirmed' }]);
});

test('WP07 RED: annotation overlay preserves per-evidence source and status without laundering inference', () => {
  const projected = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }),
    proofProposal(),
    proofCanonical(),
  );
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  const result = projectReactiveCanvas(processFixtures.standard.graph, projected.state, { ...proofCanonical(), proposalFacts: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const overlay = result.model.overlays.find((item) => item.nodeId === 'manual-review');
  const annotationEvidence = (overlay as unknown as {
    annotationEvidence?: readonly {
      text: string;
      evidenceIds: readonly string[];
      evidence: readonly { id: string; source: string; status: string }[];
    }[];
  }).annotationEvidence;
  assert.ok(annotationEvidence !== undefined && annotationEvidence.length === 1, 'annotation lineage must be projected');
  assert.equal(annotationEvidence[0]?.text, 'Validar frequencia e causa com o escritorio.');
  assert.deepEqual(annotationEvidence[0]?.evidence, [
    { id: 'fact-confirmed-loop', kind: 'fact', source: 'inference', status: 'confirmed' },
    { id: 'obs-volume', kind: 'observation', source: 'user', status: 'confirmed' },
  ]);
});

test('WP07 RED: stale annotation evidence fails closed instead of rendering unproven text', () => {
  const projected = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }),
    proofProposal(),
    proofCanonical(),
  );
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  const staleCanonical = Object.freeze({
    ...proofCanonical(),
    facts: Object.freeze([]),
    opportunities: Object.freeze([]),
    proposalFacts: Object.freeze([]),
  });
  const result = projectReactiveCanvas(processFixtures.standard.graph, projected.state, staleCanonical);
  assert.equal(result.ok, false, 'stale evidence must fail closed');
  if (result.ok) return;
  assert.equal(result.code, 'UNKNOWN_EVIDENCE_REFERENCE');
});

test('WP07 RED: opportunities surface with missingInputs and never synthesize numbers', () => {
  const projected = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }),
    proofProposal(),
    proofCanonical(),
  );
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  const result = projectReactiveCanvas(processFixtures.standard.graph, projected.state, { ...proofCanonical(), proposalFacts: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const opportunities = (result.model as unknown as {
    opportunities: readonly Record<string, unknown>[];
  }).opportunities;
  assert.ok(Array.isArray(opportunities) && opportunities.length === 1, 'canonical opportunity must be projected');
  const opportunity = opportunities[0]!;
  assert.equal(opportunity['id'], 'opp-capacity');
  assert.equal(opportunity['kind'], 'monthly_capacity');
  assert.deepEqual(opportunity['missingInputs'], ['minutos por conferencia', 'pessoas envolvidas']);
  assert.ok(!('resultValue' in opportunity), 'non-numeric opportunity must not carry resultValue');
  assert.ok(!('numericValue' in opportunity), 'non-numeric opportunity must not carry numericValue');
  assert.ok(!JSON.stringify(opportunity).includes('resultValue'), 'no synthesized numeric proof allowed');
});

test('WP07 RED: correction invalidation removes dependent calculation and opportunity from presentation', () => {
  const before = proofCanonical();
  const corrected = applyContextMutation(before, {
    baseRevision: 7,
    actor: 'user',
    mutation: {
      type: 'CORRECT_OBSERVATION',
      observationId: 'obs-volume',
      turnId: 'turn-8',
      replacement: {
        id: 'obs-volume-v2',
        metric: 'conferencias por mes',
        value: 180,
        unit: 'occurrence',
        period: 'month',
        status: 'confirmed',
        source: 'user',
        supportingTurnIds: ['turn-8'],
        confirmedByTurnId: 'turn-8',
      },
    },
  });
  assert.equal(corrected.ok, true);
  if (!corrected.ok) return;
  const projected = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }),
    proofProposal(),
    before,
  );
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  const reconciled = reconcileReactiveExperience(projected.state, corrected.context);
  const result = projectReactiveCanvas(processFixtures.standard.graph, reconciled, { ...corrected.context, proposalFacts: [] });
  assert.equal(result.ok, true);
  if (!result.ok) return;
  const quantifications = [
    ...result.model.globalQuantifications,
    ...result.model.overlays.flatMap((overlay) => [...overlay.quantifications]),
  ];
  assert.equal(quantifications.length, 0, 'invalidated calculation must disappear from presentation');
  const opportunities = (result.model as unknown as {
    opportunities: readonly { id: string; status: string }[];
  }).opportunities;
  const visible = opportunities.filter((item) => item.status !== 'invalidated');
  assert.equal(visible.length, 0, 'invalidated opportunity must leave the visible presentation');
});

test('WP07 RED: opportunity ids cannot recursively satisfy annotation evidence', () => {
  const projected = projectExperienceProposal(
    createReactiveExperienceState({ basedOnRevision: 7 }),
    {
      ...proofProposal(),
      intent: {
        ...proofProposal().intent,
        actions: [{
          id: 'act-recursive-proof',
          kind: 'annotate',
          targetId: 'manual-review',
          text: 'Não aceitar oportunidade como prova.',
          evidenceIds: ['opp-capacity'],
        }],
      },
    },
    proofCanonical(),
  );
  assert.equal(projected.ok, false);
  if (!projected.ok) assert.equal(projected.code, 'UNKNOWN_EVIDENCE_REFERENCE');
});

test('WP07 RED: public evidence refs exclude artifacts because artifacts are derived surfaces, not evidence authority', () => {
  const canonical = Object.freeze({
    ...proofCanonical(),
    artifacts: Object.freeze([Object.freeze({
      id: 'artifact-proof',
      kind: 'bi_dashboard' as const,
      title: 'Painel',
      summary: 'Superfície derivada.',
      maturity: 'conceptual' as const,
      evidenceIds: Object.freeze(['fact-confirmed-loop']),
      status: 'revealed' as const,
      invalidatedAtRevision: null,
    })]),
  });
  const record = {
    sessionId: 'session-wp07',
    canonical,
    reactiveState: createReactiveExperienceState({ basedOnRevision: 7 }),
  } as unknown as Readonly<AgentSessionRecord>;
  const state = projectPublicAgentSessionState(record) as unknown as {
    evidence: readonly { id: string; kind: string }[];
  };
  assert.equal(state.evidence.some((item) => item.id === 'artifact-proof'), false);
});

test('WP07 RED: public session state exposes calculation lineage, opportunities and evidence refs', () => {
  const record = {
    sessionId: 'session-wp07',
    canonical: proofCanonical(),
    reactiveState: createReactiveExperienceState({ basedOnRevision: 7 }),
  } as unknown as Readonly<AgentSessionRecord>;
  const state = projectPublicAgentSessionState(record) as unknown as Record<string, unknown>;
  const calculations = state['verifiedCalculations'] as unknown as readonly Record<string, unknown>[];
  assert.equal(calculations[0]?.['computedBy'], 'application');
  assert.equal(calculations[0]?.['expression'], '220 ocorrencias * 12 min / 60');
  const opportunities = state['opportunities'] as unknown as readonly Record<string, unknown>[] | undefined;
  assert.ok(Array.isArray(opportunities) && opportunities.length === 1, 'public state must carry opportunities');
  assert.deepEqual(opportunities[0]?.['missingInputs'], ['minutos por conferencia', 'pessoas envolvidas']);
  const evidence = state['evidence'] as unknown as readonly { id: string }[] | undefined;
  assert.ok(Array.isArray(evidence) && evidence.some((item) => item.id === 'obs-volume'), 'public state must carry evidence refs');
});

test('WP07 RED: Canvas projects only the newest eight active opportunities', () => {
  const canonical = Object.freeze({
    ...proofCanonical(),
    opportunities: Object.freeze(Array.from({ length: 12 }, (_, index) => Object.freeze({
      id: `opp-${index}`,
      kind: 'rework_volume' as const,
      summary: `Oportunidade ${index}`,
      capabilities: Object.freeze([]),
      evidenceIds: Object.freeze(['obs-volume']),
      missingInputs: Object.freeze(['taxa de retrabalho']),
      status: 'surfaced' as const,
      invalidatedAtRevision: null,
    }))),
  });
  const result = projectReactiveCanvas(
    processFixtures.standard.graph,
    createReactiveExperienceState({ basedOnRevision: 7 }),
    { ...canonical, proposalFacts: [] },
  );
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.deepEqual(
    result.model.opportunities.map((item) => item.id),
    ['opp-4', 'opp-5', 'opp-6', 'opp-7', 'opp-8', 'opp-9', 'opp-10', 'opp-11'],
  );
});

test('WP07 RED: projector rejects opportunity and artifact ids as annotation evidence authority', () => {
  const canonical = Object.freeze({
    ...proofCanonical(),
    artifacts: Object.freeze([Object.freeze({
      id: 'artifact-proof',
      kind: 'bi_dashboard' as const,
      title: 'Painel',
      summary: 'Superfície derivada.',
      maturity: 'conceptual' as const,
      evidenceIds: Object.freeze(['obs-volume']),
      status: 'revealed' as const,
      invalidatedAtRevision: null,
    })]),
  });
  for (const evidenceId of ['opp-capacity', 'artifact-proof']) {
    const result = projectExperienceProposal(
      createReactiveExperienceState({ basedOnRevision: 7 }),
      {
        ...proofProposal(),
        intent: {
          ...proofProposal().intent,
          actions: [{
            id: `act-${evidenceId}`,
            kind: 'annotate',
            targetId: 'manual-review',
            text: 'Não aceitar superfície derivada como prova.',
            evidenceIds: [evidenceId],
          }],
        },
      },
      canonical,
    );
    assert.equal(result.ok, false, `${evidenceId} must not satisfy evidence authority`);
    if (!result.ok) assert.equal(result.code, 'UNKNOWN_EVIDENCE_REFERENCE');
  }
});

test('WP07 RED: public state removes invalidated calculations and superseded evidence', () => {
  const canonical = Object.freeze({
    ...proofCanonical(),
    verifiedCalculations: Object.freeze([
      ...proofCanonical().verifiedCalculations,
      Object.freeze({
        ...proofCanonical().verifiedCalculations[0]!,
        id: 'calc-stale',
        status: 'invalidated' as const,
        invalidatedAtRevision: 8,
      }),
    ]),
    facts: Object.freeze([
      ...proofCanonical().facts,
      Object.freeze({
        ...proofCanonical().facts[0]!,
        id: 'fact-stale',
        status: 'superseded' as const,
      }),
    ]),
  });
  const record = {
    sessionId: 'session-wp07',
    canonical,
    reactiveState: createReactiveExperienceState({ basedOnRevision: 7 }),
  } as unknown as Readonly<AgentSessionRecord>;
  const state = projectPublicAgentSessionState(record);
  assert.equal(state.verifiedCalculations.some((item) => item.id === 'calc-stale'), false);
  assert.equal(state.evidence.some((item) => item.id === 'fact-stale'), false);
});
