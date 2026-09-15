import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AGENT_INTENT_LIMITS,
  EXPERIENCE_ACTION_KINDS,
  validateAgentIntent,
} from '../../src/experience/agent-intent.ts';
import { CAPABILITY_KINDS } from '../../src/ai/context/canonical-sales-context.ts';
import {
  EXPERIENCE_PROPOSAL_LIMITS,
  validateExperienceProposal,
} from '../../src/experience/experience-validation.ts';
import {
  createReactiveExperienceState,
  projectExperienceProposal,
} from '../../src/experience/experience-projector.ts';

function baseIntent(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    objective: 'Transformar capacidade consumida em conviccao operacional.',
    rationale: 'A evidencia ja permite uma demonstracao sem inventar ROI.',
    capabilities: [],
    actions: [],
    quantitativeOpportunities: [],
    artifactIntents: [],
    nextQuestion: null,
    ...overrides,
  };
}

function baseProposal(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    baseRevision: 7,
    narration: 'Hoje esse fechamento consome capacidade recorrente; vale expor isso visualmente antes de perguntar mais.',
    intent: baseIntent(),
    factProposals: [],
    correctionProposals: [],
    processMutations: [],
    sceneProposal: null,
    artifactProposals: [],
    criticRequired: true,
    ...overrides,
  };
}

function validActions(): Record<string, unknown>[] {
  return [
    { id: 'act-focus', kind: 'focus', targetId: 'node-a', reason: 'Foco no gargalo.' },
    { id: 'act-compare', kind: 'compare', targetIds: ['node-a', 'node-b'], reason: 'Comparar estados.' },
    { id: 'act-annotate', kind: 'annotate', targetId: 'node-a', text: 'Insight valido.', evidenceIds: [] },
    { id: 'act-reveal', kind: 'reveal', targetId: 'node-a', reason: 'Revelar etapa.' },
    { id: 'act-group', kind: 'group', groupId: 'group-a', memberIds: ['node-a', 'node-b'], label: 'Grupo.' },
    { id: 'act-deemph', kind: 'de_emphasize', targetIds: ['node-b'], reason: 'Reduzir ruido.' },
    { id: 'act-quant', kind: 'quantify', calculationId: 'calc-a', targetId: 'node-a', reason: 'Numero verificado.' },
    { id: 'act-explain', kind: 'explain_relationship', sourceId: 'node-a', targetId: 'node-b', text: 'Relacao valida.' },
  ];
}

test('WP02 closed union: exactly 11 semantic kinds are accepted, nothing else', () => {
  assert.equal(EXPERIENCE_ACTION_KINDS.length, 11);
  assert.deepEqual([...EXPERIENCE_ACTION_KINDS].sort(), [
    'annotate',
    'compare',
    'de_emphasize',
    'demonstrate',
    'explain_relationship',
    'focus',
    'group',
    'quantify',
    'request_workshop',
    'reveal',
    'stage_artifact',
  ].sort());

  const artifactIntent = {
    id: 'artifact-intent-a',
    kind: 'prototype',
    objective: 'Demonstrar direcao.',
    evidenceIds: [],
    audience: 'owner',
    desiredImpact: 'Clareza.',
    workshopRequired: false,
  };
  const wireActions: Record<string, unknown>[] = [
    ...validActions(),
    { id: 'act-demo', kind: 'demonstrate', artifactIntentId: 'artifact-intent-a', reason: 'Demonstrar.' },
    { id: 'act-stage', kind: 'stage_artifact', artifactIntentId: 'artifact-intent-a', reason: 'Apresentar.' },
    { id: 'act-workshop', kind: 'request_workshop', artifactIntentId: 'artifact-intent-a', reason: 'Oficina.' },
  ];
  const result = validateAgentIntent(baseIntent({ actions: wireActions, artifactIntents: [artifactIntent] }));
  if (!result.ok) assert.fail(`${result.code}:${result.path}`);
  assert.equal(result.value.actions.length, 11);

  for (const kind of ['frame_region', 'sequence_focus', 'present_comparison', 'surface_evidence', 'surface_value', 'present_next_step', 'restore_user_view']) {
    const rejected = validateAgentIntent(baseIntent({
      actions: [{ id: 'act-internal', kind, targetId: 'node-a', reason: 'Comando interno.' }],
    }));
    assert.deepEqual(rejected.ok ? null : rejected.code, 'UNSUPPORTED_ACTION', kind);
  }

  const unknown = validateAgentIntent(baseIntent({
    actions: [{ id: 'act-x', kind: 'teleport', targetId: 'node-a', reason: 'Desconhecido.' }],
  }));
  assert.deepEqual(unknown.ok ? null : unknown.code, 'UNSUPPORTED_ACTION');
});

test('WP02 unknown keys fail closed across intent, actions, mutations and scene', () => {
  const topLevel = validateAgentIntent({ ...baseIntent(), funnelStage: 'close' });
  assert.equal(topLevel.ok, false);

  for (const extra of ['x', 'y', 'zoom', 'viewport', 'position', 'coordinates', 'component', 'module', 'html', 'url', 'handler', 'code', 'script', 'css']) {
    const actionAttack = validateAgentIntent(baseIntent({
      actions: [{ id: 'act-1', kind: 'focus', targetId: 'node-a', reason: 'Foco.', [extra]: 'payload' }],
    }));
    assert.equal(actionAttack.ok, false, `action extra key ${extra}`);
  }

  const mutationAttack = validateExperienceProposal(baseProposal({
    processMutations: [{
      id: 'mut-1', kind: 'remove_element', targetId: 'node-a', reason: 'Remover.', component: 'Widget',
    }],
  }));
  assert.equal(mutationAttack.ok, false);

  const sceneAttack = validateExperienceProposal(baseProposal({
    sceneProposal: { composition: 'focus', focusIds: ['node-a'], comparisonIds: [], announcement: null, x: 10, y: 20, zoom: 2 },
  }));
  assert.equal(sceneAttack.ok, false);

  const rootAttack = validateExperienceProposal({ ...baseProposal(), jsx: '<Dashboard />' });
  assert.equal(rootAttack.ok, false);

  const factAttack = validateExperienceProposal(baseProposal({
    factProposals: [{
      id: 'fact-1', subject: 's', predicate: 'p', value: 'v', source: 'inference', supportingTurnIds: [], html: '<b/>',
    }],
  }));
  assert.equal(factAttack.ok, false);
});

test('WP02 executable surfaces are rejected in every model-controlled text field', () => {
  const payloads = [
    'window.location = 1',
    'document.cookie',
    'globalThis.secret',
    '()=>run()',
    '.card { display: grid; }',
    '<div onclick="run()">x</div>',
    '<script>alert(1)</script>',
    'javascript:alert(1)',
    'data:text/html,<h1>x</h1>',
    'import(evil)',
    'require(evil)',
    '<SalesCard onClick={() => run()} />',
  ];
  for (const payload of payloads) {
    for (const field of ['objective', 'rationale'] as const) {
      const result = validateAgentIntent(baseIntent({ [field]: payload }));
      assert.deepEqual(result.ok ? null : result.code, 'EXECUTABLE_SURFACE', `${field}:${payload}`);
    }
    const reason = validateAgentIntent(baseIntent({
      actions: [{ id: 'act-1', kind: 'focus', targetId: 'node-a', reason: payload }],
    }));
    assert.deepEqual(reason.ok ? null : reason.code, 'EXECUTABLE_SURFACE', `reason:${payload}`);
    const text = validateAgentIntent(baseIntent({
      actions: [{ id: 'act-1', kind: 'annotate', targetId: 'node-a', text: payload, evidenceIds: [] }],
    }));
    assert.deepEqual(text.ok ? null : text.code, 'EXECUTABLE_SURFACE', `text:${payload}`);
    const narration = validateExperienceProposal(baseProposal({ narration: payload }));
    // Plain textual URLs are allowed, but executable payloads never are.
    if (payload.startsWith('Refer')) continue;
    assert.deepEqual(narration.ok ? null : narration.code, 'EXECUTABLE_SURFACE', `narration:${payload}`);
  }

  const artifactAttack = validateAgentIntent(baseIntent({
    artifactIntents: [{
      id: 'artifact-1',
      kind: 'prototype',
      objective: 'window.location = 1',
      evidenceIds: [],
      audience: 'owner',
      desiredImpact: 'Impacto.',
      workshopRequired: false,
    }],
  }));
  assert.deepEqual(artifactAttack.ok ? null : artifactAttack.code, 'EXECUTABLE_SURFACE');
});

test('WP02 limits: oversized arrays and text fail closed with LIMIT_EXCEEDED or INVALID_VALUE', () => {
  const manyActions = Array.from({ length: AGENT_INTENT_LIMITS.actions + 1 }, (_, i) => ({
    id: `act-${i}`, kind: 'focus', targetId: `node-${i}`, reason: 'Foco.',
  }));
  const oversizedActions = validateAgentIntent(baseIntent({ actions: manyActions }));
  assert.deepEqual(oversizedActions.ok ? null : oversizedActions.code, 'LIMIT_EXCEEDED');

  const manyCapabilities = [...CAPABILITY_KINDS, CAPABILITY_KINDS[0] as string];
  const caps = validateAgentIntent(baseIntent({ capabilities: manyCapabilities }));
  assert.deepEqual(caps.ok ? null : caps.code, 'LIMIT_EXCEEDED');
  assert.equal(AGENT_INTENT_LIMITS.capabilities, CAPABILITY_KINDS.length);

  const manyTargets = Array.from({ length: AGENT_INTENT_LIMITS.actionTargetIds + 1 }, (_, i) => `node-${i}`);
  const targets = validateAgentIntent(baseIntent({
    actions: [{ id: 'act-1', kind: 'compare', targetIds: manyTargets, reason: 'Comparar.' }],
  }));
  assert.deepEqual(targets.ok ? null : targets.code, 'LIMIT_EXCEEDED');

  const manyEvidence = Array.from({ length: AGENT_INTENT_LIMITS.evidenceIds + 1 }, (_, i) => `ev-${i}`);
  const evidence = validateAgentIntent(baseIntent({
    actions: [{ id: 'act-1', kind: 'annotate', targetId: 'node-a', text: 'Nota.', evidenceIds: manyEvidence }],
  }));
  assert.deepEqual(evidence.ok ? null : evidence.code, 'LIMIT_EXCEEDED');

  const manyMissing = Array.from({ length: AGENT_INTENT_LIMITS.missingInputs + 1 }, (_, i) => `input-${i}`);
  const missing = validateAgentIntent(baseIntent({
    quantitativeOpportunities: [{
      id: 'opp-1', kind: 'other', objective: 'Objetivo.', evidenceIds: [], missingInputs: manyMissing,
    }],
  }));
  assert.deepEqual(missing.ok ? null : missing.code, 'LIMIT_EXCEEDED');

  const manyMutations = Array.from({ length: EXPERIENCE_PROPOSAL_LIMITS.processMutations + 1 }, (_, i) => ({
    id: `mut-${i}`, kind: 'remove_element', targetId: `node-${i}`, reason: 'Remover.',
  }));
  assert.deepEqual(
    validateExperienceProposal(baseProposal({ processMutations: manyMutations })).ok ? null : 'LIMIT_EXCEEDED',
    'LIMIT_EXCEEDED',
  );

  const manyFocus = Array.from({ length: EXPERIENCE_PROPOSAL_LIMITS.sceneIds + 1 }, (_, i) => `node-${i}`);
  const scene = validateExperienceProposal(baseProposal({
    sceneProposal: { composition: 'focus', focusIds: manyFocus, comparisonIds: [], announcement: null },
  }));
  assert.equal(scene.ok, false);

  const longObjective = validateAgentIntent(baseIntent({ objective: 'O'.repeat(1201) }));
  assert.equal(longObjective.ok, false);
  const longReason = validateAgentIntent(baseIntent({
    actions: [{ id: 'act-1', kind: 'focus', targetId: 'node-a', reason: 'R'.repeat(601) }],
  }));
  assert.equal(longReason.ok, false);
  const longNarration = validateExperienceProposal(baseProposal({ narration: 'N'.repeat(4001) }));
  assert.equal(longNarration.ok, false);
  const longLabel = validateExperienceProposal(baseProposal({
    processMutations: [{
      id: 'mut-1', kind: 'upsert_node', nodeId: 'node-a',
      label: 'L'.repeat(EXPERIENCE_PROPOSAL_LIMITS.processNodeLabel + 1),
      summary: 'Resumo.', evidenceIds: [],
    }],
  }));
  assert.equal(longLabel.ok, false);
});

test('WP02 identity: duplicate ids and invalid targets fail closed', () => {
  const duplicateActions = validateAgentIntent(baseIntent({
    actions: [
      { id: 'act-same', kind: 'focus', targetId: 'node-a', reason: 'Um.' },
      { id: 'act-same', kind: 'reveal', targetId: 'node-b', reason: 'Dois.' },
    ],
  }));
  assert.deepEqual(duplicateActions.ok ? null : duplicateActions.code, 'DUPLICATE_ID');

  const duplicateTargets = validateAgentIntent(baseIntent({
    actions: [{ id: 'act-1', kind: 'compare', targetIds: ['node-a', 'node-a'], reason: 'Duplicado.' }],
  }));
  assert.deepEqual(duplicateTargets.ok ? null : duplicateTargets.code, 'DUPLICATE_ID');

  const crossCollection = validateExperienceProposal({
    ...baseProposal(),
    intent: {
      ...baseIntent(),
      actions: [{ id: 'same-id', kind: 'focus', targetId: 'node-a', reason: 'Foco.' }],
    },
    processMutations: [{ id: 'same-id', kind: 'remove_element', targetId: 'node-old', reason: 'Remover.' }],
  });
  assert.deepEqual(crossCollection.ok ? null : crossCollection.code, 'DUPLICATE_ID');

  const duplicateCapabilities = validateAgentIntent(baseIntent({
    capabilities: ['bi_decision_intelligence', 'bi_decision_intelligence'],
  }));
  assert.deepEqual(duplicateCapabilities.ok ? null : duplicateCapabilities.code, 'DUPLICATE_ID');

  for (const badId of ['', 'Node-A', 'node_a', 'node a', 'a'.repeat(97), '-node', 'node--a']) {
    const bad = validateAgentIntent(baseIntent({
      actions: [{ id: 'act-1', kind: 'focus', targetId: badId, reason: 'Foco.' }],
    }));
    assert.equal(bad.ok, false, `targetId ${JSON.stringify(badId)}`);
  }

  const singleCompare = validateAgentIntent(baseIntent({
    actions: [{ id: 'act-1', kind: 'compare', targetIds: ['only-one'], reason: 'Comparar.' }],
  }));
  assert.equal(singleCompare.ok, false);

  const singleGroup = validateAgentIntent(baseIntent({
    actions: [{ id: 'act-1', kind: 'group', groupId: 'group-1', memberIds: ['only-one'], label: 'Grupo.' }],
  }));
  assert.equal(singleGroup.ok, false);

  const danglingArtifact = validateAgentIntent(baseIntent({
    actions: [{ id: 'act-1', kind: 'demonstrate', artifactIntentId: 'missing-intent', reason: 'Demo.' }],
  }));
  assert.equal(danglingArtifact.ok, false);

  const stale = validateExperienceProposal(baseProposal(), { expectedBaseRevision: 8 });
  assert.deepEqual(stale, { ok: false, code: 'STALE_REVISION', path: 'proposal.baseRevision' });
});

function fullProposal(): Record<string, unknown> {
  return baseProposal({
    intent: baseIntent({
      actions: [
        ...validActions(),
        { id: 'act-demo', kind: 'demonstrate', artifactIntentId: 'artifact-intent-a', reason: 'Demonstrar.' },
        { id: 'act-stage', kind: 'stage_artifact', artifactIntentId: 'artifact-intent-a', reason: 'Apresentar.' },
        { id: 'act-workshop', kind: 'request_workshop', artifactIntentId: 'artifact-intent-a', reason: 'Oficina.' },
      ],
      quantitativeOpportunities: [{
        id: 'opp-1', kind: 'other', objective: 'Objetivo valido.', evidenceIds: [], missingInputs: ['input-a'],
      }],
      artifactIntents: [{
        id: 'artifact-intent-a',
        kind: 'prototype',
        objective: 'Objetivo valido.',
        evidenceIds: [],
        audience: 'owner',
        desiredImpact: 'Impacto valido.',
        workshopRequired: false,
      }],
      nextQuestion: { text: 'Pergunta valida?', objective: 'Objetivo valido.' },
    }),
    factProposals: [{
      id: 'fact-1', subject: 'fechamento', predicate: 'consome', value: 'capacidade',
      source: 'inference', supportingTurnIds: [],
    }],
    correctionProposals: [{
      id: 'correction-1', targetEvidenceId: 'fact-1', reason: 'Motivo valido.',
      replacementValue: 'novo valor', supportingTurnIds: [],
    }],
    processMutations: [
      { id: 'mut-node', kind: 'upsert_node', nodeId: 'node-a', label: 'Rotulo.', summary: 'Resumo.', evidenceIds: [] },
      { id: 'mut-rel', kind: 'upsert_relationship', relationshipId: 'rel-a', sourceNodeId: 'node-a', targetNodeId: 'node-b', label: 'Rotulo.', evidenceIds: [] },
      { id: 'mut-remove', kind: 'remove_element', targetId: 'node-old', reason: 'Motivo.' },
      { id: 'mut-state', kind: 'set_node_state', nodeId: 'node-a', state: 'active', reason: 'Motivo.' },
    ],
    sceneProposal: { composition: 'focus', focusIds: ['node-a'], comparisonIds: [], announcement: 'Anuncio.' },
    artifactProposals: [{
      id: 'artifact-1', kind: 'prototype', title: 'Titulo.', summary: 'Resumo.', evidenceIds: [], status: 'conceptual',
    }],
  });
}

function intentNode(proposal: Record<string, unknown>): Record<string, unknown> {
  return proposal['intent'] as Record<string, unknown>;
}

function actionNode(proposal: Record<string, unknown>, index: number): Record<string, unknown> {
  return (intentNode(proposal)['actions'] as Record<string, unknown>[])[index]!;
}

interface TextLeaf {
  name: string;
  path: string;
  inject: (proposal: Record<string, unknown>, payload: string) => void;
}

function setActionField(proposal: Record<string, unknown>, index: number, field: string, payload: string): void {
  actionNode(proposal, index)[field] = payload;
}

// Exhaustive inventory: every free-text leaf the model can supply through
// ExperienceProposal, AgentIntent, ArtifactIntent and ArtifactProposal reaches
// parseText/parsePrimitive and therefore the shared executable-surface screen.
// ID/enum/boolean/numeric leaves are structurally incapable of carrying
// executable payloads (safeId charset, closed sets) and are covered by the
// unknown-key/invalid-target tests instead. There is no other artifact
// free-text surface in the proposal types ("artifact patches" do not exist).
const TEXT_LEAVES: TextLeaf[] = [
  { name: 'intent.objective', path: 'proposal.agentIntent.objective', inject: (p, v) => { intentNode(p)['objective'] = v; } },
  { name: 'intent.rationale', path: 'proposal.agentIntent.rationale', inject: (p, v) => { intentNode(p)['rationale'] = v; } },
  { name: 'focus.reason', path: 'proposal.agentIntent.actions[0].reason', inject: (p, v) => setActionField(p, 0, 'reason', v) },
  { name: 'compare.reason', path: 'proposal.agentIntent.actions[1].reason', inject: (p, v) => setActionField(p, 1, 'reason', v) },
  { name: 'annotate.text', path: 'proposal.agentIntent.actions[2].text', inject: (p, v) => setActionField(p, 2, 'text', v) },
  { name: 'reveal.reason', path: 'proposal.agentIntent.actions[3].reason', inject: (p, v) => setActionField(p, 3, 'reason', v) },
  { name: 'group.label', path: 'proposal.agentIntent.actions[4].label', inject: (p, v) => setActionField(p, 4, 'label', v) },
  { name: 'de_emphasize.reason', path: 'proposal.agentIntent.actions[5].reason', inject: (p, v) => setActionField(p, 5, 'reason', v) },
  { name: 'quantify.reason', path: 'proposal.agentIntent.actions[6].reason', inject: (p, v) => setActionField(p, 6, 'reason', v) },
  { name: 'explain_relationship.text', path: 'proposal.agentIntent.actions[7].text', inject: (p, v) => setActionField(p, 7, 'text', v) },
  { name: 'demonstrate.reason', path: 'proposal.agentIntent.actions[8].reason', inject: (p, v) => setActionField(p, 8, 'reason', v) },
  { name: 'stage_artifact.reason', path: 'proposal.agentIntent.actions[9].reason', inject: (p, v) => setActionField(p, 9, 'reason', v) },
  { name: 'request_workshop.reason', path: 'proposal.agentIntent.actions[10].reason', inject: (p, v) => setActionField(p, 10, 'reason', v) },
  { name: 'quantitativeOpportunity.objective', path: 'proposal.agentIntent.quantitativeOpportunities[0].objective', inject: (p, v) => { ((intentNode(p)['quantitativeOpportunities'] as Record<string, unknown>[])[0]!)['objective'] = v; } },
  { name: 'quantitativeOpportunity.missingInputs[0]', path: 'proposal.agentIntent.quantitativeOpportunities[0].missingInputs[0]', inject: (p, v) => { (((intentNode(p)['quantitativeOpportunities'] as Record<string, unknown>[])[0]!)['missingInputs'] as string[])[0] = v; } },
  { name: 'nextQuestion.text', path: 'proposal.agentIntent.nextQuestion.text', inject: (p, v) => { (intentNode(p)['nextQuestion'] as Record<string, unknown>)['text'] = v; } },
  { name: 'nextQuestion.objective', path: 'proposal.agentIntent.nextQuestion.objective', inject: (p, v) => { (intentNode(p)['nextQuestion'] as Record<string, unknown>)['objective'] = v; } },
  { name: 'artifactIntent.objective', path: 'proposal.agentIntent.artifactIntents[0].artifactIntent.objective', inject: (p, v) => { ((intentNode(p)['artifactIntents'] as Record<string, unknown>[])[0]!)['objective'] = v; } },
  { name: 'artifactIntent.desiredImpact', path: 'proposal.agentIntent.artifactIntents[0].artifactIntent.desiredImpact', inject: (p, v) => { ((intentNode(p)['artifactIntents'] as Record<string, unknown>[])[0]!)['desiredImpact'] = v; } },
  { name: 'proposal.narration', path: 'proposal.narration', inject: (p, v) => { p['narration'] = v; } },
  { name: 'fact.subject', path: 'proposal.factProposals[0].subject', inject: (p, v) => { (p['factProposals'] as Record<string, unknown>[])[0]!['subject'] = v; } },
  { name: 'fact.predicate', path: 'proposal.factProposals[0].predicate', inject: (p, v) => { (p['factProposals'] as Record<string, unknown>[])[0]!['predicate'] = v; } },
  { name: 'fact.value', path: 'proposal.factProposals[0].value', inject: (p, v) => { (p['factProposals'] as Record<string, unknown>[])[0]!['value'] = v; } },
  { name: 'correction.reason', path: 'proposal.correctionProposals[0].reason', inject: (p, v) => { (p['correctionProposals'] as Record<string, unknown>[])[0]!['reason'] = v; } },
  { name: 'correction.replacementValue', path: 'proposal.correctionProposals[0].replacementValue', inject: (p, v) => { (p['correctionProposals'] as Record<string, unknown>[])[0]!['replacementValue'] = v; } },
  { name: 'upsert_node.label', path: 'proposal.processMutations[0].label', inject: (p, v) => { (p['processMutations'] as Record<string, unknown>[])[0]!['label'] = v; } },
  { name: 'upsert_node.summary', path: 'proposal.processMutations[0].summary', inject: (p, v) => { (p['processMutations'] as Record<string, unknown>[])[0]!['summary'] = v; } },
  { name: 'upsert_relationship.label', path: 'proposal.processMutations[1].label', inject: (p, v) => { (p['processMutations'] as Record<string, unknown>[])[1]!['label'] = v; } },
  { name: 'remove_element.reason', path: 'proposal.processMutations[2].reason', inject: (p, v) => { (p['processMutations'] as Record<string, unknown>[])[2]!['reason'] = v; } },
  { name: 'set_node_state.reason', path: 'proposal.processMutations[3].reason', inject: (p, v) => { (p['processMutations'] as Record<string, unknown>[])[3]!['reason'] = v; } },
  { name: 'scene.announcement', path: 'proposal.sceneProposal.announcement', inject: (p, v) => { (p['sceneProposal'] as Record<string, unknown>)['announcement'] = v; } },
  { name: 'artifactProposal.title', path: 'proposal.artifactProposals[0].title', inject: (p, v) => { (p['artifactProposals'] as Record<string, unknown>[])[0]!['title'] = v; } },
  { name: 'artifactProposal.summary', path: 'proposal.artifactProposals[0].summary', inject: (p, v) => { (p['artifactProposals'] as Record<string, unknown>[])[0]!['summary'] = v; } },
];

test('WP02 executable audit: all 33 model-controlled free-text leaves reject executable surfaces', () => {
  assert.equal(TEXT_LEAVES.length, 33);
  const payloads = ['window.location = 1', '()=>run()', '.card { display: grid; }'];
  for (const leaf of TEXT_LEAVES) {
    for (const payload of payloads) {
      const proposal = fullProposal();
      leaf.inject(proposal, payload);
      const result = validateExperienceProposal(proposal, { expectedBaseRevision: 7 });
      assert.deepEqual(result.ok ? null : result.code, 'EXECUTABLE_SURFACE', `${leaf.name} :: ${payload}`);
      if (!result.ok) assert.equal(result.path, leaf.path, leaf.name);
    }
  }
});

test('WP02 no-op: narration without visual change is an explicit valid outcome', () => {
  const proposal = baseProposal({
    narration: 'Nenhuma mudanca visual e necessaria neste turno; a pergunta conduz.',
    intent: baseIntent({ nextQuestion: { text: 'Qual etapa consome mais prazo hoje?' } }),
  });
  const validated = validateExperienceProposal(proposal, { expectedBaseRevision: 7 });
  if (!validated.ok) assert.fail(`${validated.code}:${validated.path}`);

  const canonical = {
    schemaVersion: 1,
    sessionId: 'session-701',
    revision: 7,
    turnIds: ['turn-7'],
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
    latestUserIntent: { turnId: 'turn-7', text: 'Quero entender o fechamento.' },
  } as const;
  const state = createReactiveExperienceState({ basedOnRevision: 7 });
  const projected = projectExperienceProposal(state, validated.proposal, canonical);
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  assert.equal(projected.deduplicated, false);
  assert.equal(projected.state.projectionRevision, 0);
  assert.deepEqual(projected.state.actions, []);
  assert.equal(projected.state.scene.composition, 'stable');
});
