import test from 'node:test';
import assert from 'node:assert/strict';
import type { CanonicalSalesContext } from '../../src/ai/context/canonical-sales-context.ts';
import {
  createReactiveExperienceState,
  projectExperienceProposal,
} from '../../src/experience/experience-projector.ts';
import type { ExperienceProposal } from '../../src/experience/experience-proposal.ts';
import { processFixtures } from '../../src/canvas/fixtures.ts';
import { projectReactiveCanvas } from '../../src/canvas/reactive-graph-adapter.ts';

function canonical(calculationStatus: 'valid' | 'invalidated' = 'valid'): CanonicalSalesContext {
  return Object.freeze({
    schemaVersion: 1,
    sessionId: 'session-canvas-adapter',
    revision: 7,
    turnIds: Object.freeze(['turn-7']),
    facts: Object.freeze([]),
    primaryPain: null,
    desiredOutcome: null,
    knownConsequences: Object.freeze([]),
    objections: Object.freeze([]),
    quantitativeObservations: Object.freeze([]),
    verifiedCalculations: Object.freeze([Object.freeze({
      id: 'calc-1',
      kind: 'capacity' as const,
      inputObservationIds: Object.freeze(['obs-1']),
      expression: '40 * 22 / 60',
      resultValue: 14.67,
      resultUnit: 'hour/month',
      computedBy: 'application' as const,
      basedOnRevision: 7,
      status: calculationStatus,
      invalidatedAtRevision: calculationStatus === 'invalidated' ? 7 : null,
    })]),
    openUncertainties: Object.freeze([]),
    opportunities: Object.freeze([]),
    artifacts: Object.freeze([]),
    currentSceneId: null,
    latestUserIntent: Object.freeze({
      turnId: 'turn-7',
      text: 'Mostre onde está a capacidade perdida.',
    }),
  });
}

function proposal(overrides: Partial<ExperienceProposal> = {}): ExperienceProposal {
  return {
    schemaVersion: 1,
    baseRevision: 7,
    narration: 'A hipótese operacional foi projetada.',
    intent: {
      schemaVersion: 1,
      objective: 'Materializar o gargalo.',
      rationale: 'A relação precisa ficar visível.',
      capabilities: ['process_data_improvement', 'bi_decision_intelligence'],
      actions: [],
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
    ...overrides,
  };
}

test('composes graph mutation, focus, reveal, group, relationship explanation and verified quantity without laundering provenance', () => {
  const baseGraph = processFixtures.standard.graph;
  const state = createReactiveExperienceState({ basedOnRevision: 7 });
  const projected = projectExperienceProposal(state, proposal({
    processMutations: [
      {
        id: 'mut-update',
        kind: 'upsert_node',
        nodeId: 'manual-review',
        label: 'Conferência manual priorizada',
        summary: 'Etapa já confirmada, agora destacada pela análise.',
        evidenceIds: [],
      },
      {
        id: 'mut-new',
        kind: 'upsert_node',
        nodeId: 'rework-loop',
        label: 'Loop de retrabalho',
        summary: 'Hipótese visual de repetição a validar com o escritório.',
        evidenceIds: [],
      },
      {
        id: 'mut-rel',
        kind: 'upsert_relationship',
        relationshipId: 'rel-rework',
        sourceNodeId: 'manual-review',
        targetNodeId: 'rework-loop',
        label: 'pode gerar',
        evidenceIds: [],
      },
      {
        id: 'mut-state',
        kind: 'set_node_state',
        nodeId: 'rework-loop',
        state: 'hypothesis',
        reason: 'Ainda requer confirmação.',
      },
    ],
    intent: {
      ...proposal().intent,
      actions: [
        { id: 'action-focus', kind: 'focus', targetId: 'rework-loop', reason: 'Tornar a hipótese legível.' },
        { id: 'action-reveal', kind: 'reveal', targetId: 'rework-loop', reason: 'Expor a nova hipótese.' },
        { id: 'action-note', kind: 'annotate', targetId: 'rework-loop', text: 'Validar frequência e causa.', evidenceIds: [] },
        { id: 'action-quant', kind: 'quantify', calculationId: 'calc-1', targetId: 'rework-loop', reason: 'Contextualizar capacidade.' },
        { id: 'action-group', kind: 'group', groupId: 'group-review', memberIds: ['manual-review', 'rework-loop'], label: 'Conferência e retrabalho' },
        { id: 'action-rel', kind: 'explain_relationship', sourceId: 'manual-review', targetId: 'rework-loop', text: 'Uma nova conferência pode realimentar o trabalho.' },
      ],
    },
    sceneProposal: {
      composition: 'focus',
      focusIds: ['rework-loop'],
      comparisonIds: [],
      announcement: 'Hipótese de retrabalho em foco.',
    },
  }), canonical());
  assert.equal(projected.ok, true);
  if (!projected.ok) return;

  const result = projectReactiveCanvas(baseGraph, projected.state, canonical());
  assert.equal(result.ok, true);
  if (!result.ok) return;

  const existing = result.model.graph.nodes.find((node) => node.id === 'manual-review');
  assert.equal(existing?.label, 'Conferência manual priorizada');
  assert.equal(existing?.provenance, 'user_confirmed');

  const generated = result.model.graph.nodes.find((node) => node.id === 'rework-loop');
  assert.equal(generated?.kind, 'evidence');
  assert.equal(generated?.provenance, 'ai_inferred');

  const edge = result.model.graph.edges.find((item) => item.id === 'rel-rework');
  assert.equal(edge?.label, 'pode gerar');

  const overlay = result.model.overlays.find((item) => item.nodeId === 'rework-loop');
  assert.equal(overlay?.state, 'hypothesis');
  assert.equal(overlay?.revealed, true);
  assert.deepEqual(overlay?.annotations, ['Validar frequência e causa.']);
  assert.equal(overlay?.quantifications[0]?.calculationId, 'calc-1');
  assert.equal(overlay?.quantifications[0]?.resultValue, 14.67);
  assert.deepEqual(result.model.focusIds, ['rework-loop']);
  assert.deepEqual(result.model.groups[0]?.memberIds, ['manual-review', 'rework-loop']);
  assert.equal(result.model.relationshipExplanations[0]?.text, 'Uma nova conferência pode realimentar o trabalho.');
});

test('dangling relationship mutation is rejected atomically and preserves the base graph', () => {
  const initial = createReactiveExperienceState({ basedOnRevision: 7 });
  const projected = projectExperienceProposal(initial, proposal({
    processMutations: [{
      id: 'mut-dangling',
      kind: 'upsert_relationship',
      relationshipId: 'rel-dangling',
      sourceNodeId: 'manual-review',
      targetNodeId: 'missing-node',
      label: 'inválida',
      evidenceIds: [],
    }],
  }), canonical());
  assert.equal(projected.ok, true);
  if (!projected.ok) return;

  const baseGraph = processFixtures.standard.graph;
  const result = projectReactiveCanvas(baseGraph, projected.state, canonical());
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.equal(result.code, 'INVALID_GRAPH_MUTATION');
  assert.equal(result.graph, baseGraph);
  assert.equal(baseGraph.edges.some((edge) => edge.id === 'rel-dangling'), false);
});

test('unknown semantic action target fails closed instead of fabricating a node', () => {
  const initial = createReactiveExperienceState({ basedOnRevision: 7 });
  const projected = projectExperienceProposal(initial, proposal({
    intent: {
      ...proposal().intent,
      actions: [{
        id: 'action-missing',
        kind: 'de_emphasize',
        targetIds: ['missing-node'],
        reason: 'Não deve ser fabricado.',
      }],
    },
  }), canonical());
  assert.equal(projected.ok, true);
  if (!projected.ok) return;

  const result = projectReactiveCanvas(processFixtures.standard.graph, projected.state, canonical());
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'UNKNOWN_ACTION_TARGET');
});

test('remove_element prunes a node and all dependent relationships while retaining the original fixture', () => {
  const initial = createReactiveExperienceState({ basedOnRevision: 7 });
  const projected = projectExperienceProposal(initial, proposal({
    processMutations: [{
      id: 'mut-remove',
      kind: 'remove_element',
      targetId: 'manual-review',
      reason: 'Correção visual aceita.',
    }],
  }), canonical());
  assert.equal(projected.ok, true);
  if (!projected.ok) return;

  const baseGraph = processFixtures.standard.graph;
  const result = projectReactiveCanvas(baseGraph, projected.state, canonical());
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.model.graph.nodes.some((node) => node.id === 'manual-review'), false);
  assert.equal(result.model.graph.edges.some((edge) => edge.source === 'manual-review' || edge.target === 'manual-review'), false);
  assert.equal(baseGraph.nodes.some((node) => node.id === 'manual-review'), true);
});
