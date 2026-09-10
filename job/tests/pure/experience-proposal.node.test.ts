import test from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIENCE_PROPOSAL_LIMITS, validateExperienceProposal } from '../../src/experience/experience-validation.ts';

function baseProposal(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    baseRevision: 7,
    narration: 'Hoje esse fechamento consome capacidade recorrente; vale expor isso visualmente antes de perguntar mais.',
    intent: {
      schemaVersion: 1,
      objective: 'Transformar capacidade consumida em convicção operacional.',
      rationale: 'A evidência já permite uma demonstração sem inventar ROI.',
      capabilities: ['bi_decision_intelligence', 'process_data_improvement'],
      actions: [
        { id: 'act-quantify', kind: 'quantify', calculationId: 'calc-capacity-month', targetId: 'node-closing', reason: 'Mostrar o número verificável.' },
        { id: 'act-focus', kind: 'focus', targetId: 'node-closing', reason: 'Centralizar o gargalo.' },
      ],
      quantitativeOpportunities: [],
      artifactIntents: [],
      nextQuestion: null,
    },
    factProposals: [],
    correctionProposals: [],
    processMutations: [
      { id: 'mutation-node', kind: 'upsert_node', nodeId: 'node-closing', label: 'Fechamento mensal', summary: 'Rotina com capacidade manual relevante.', evidenceIds: ['calc-capacity-month'] },
    ],
    sceneProposal: {
      composition: 'focus',
      focusIds: ['node-closing'],
      comparisonIds: [],
      announcement: 'Fechamento mensal em foco.',
    },
    artifactProposals: [],
    criticRequired: true,
    ...overrides,
  };
}

test('accepts a revision-bound proposal with several coordinated effects and no mandatory question', () => {
  const result = validateExperienceProposal(baseProposal(), { expectedBaseRevision: 7 });
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error(`${result.code}:${result.path}`);
  assert.equal(result.proposal.intent.nextQuestion, null);
  assert.deepEqual(result.proposal.intent.actions.map((action) => action.id), ['act-quantify', 'act-focus']);
});

test('rejects stale proposals before any product-facing mutation can be accepted', () => {
  const result = validateExperienceProposal(baseProposal(), { expectedBaseRevision: 8 });
  assert.deepEqual(result, { ok: false, code: 'STALE_REVISION', path: 'proposal.baseRevision' });
});

test('rejects raw JSX, script/module/url surfaces and raw viewport coordinates', () => {
  const attacks = [
    { ...baseProposal(), jsx: '<Dashboard />' },
    { ...baseProposal(), script: 'alert(1)' },
    { ...baseProposal(), module: './runtime.ts' },
    { ...baseProposal(), url: 'https://evil.example/payload.js' },
    { ...baseProposal(), sceneProposal: { composition: 'focus', focusIds: ['node-closing'], comparisonIds: [], announcement: null, x: 10, y: 20, zoom: 2 } },
  ];
  for (const attack of attacks) {
    const result = validateExperienceProposal(attack, { expectedBaseRevision: 7 });
    assert.equal(result.ok, false);
  }

  const rawHtml = validateExperienceProposal(baseProposal({ narration: '<div onclick="run()">conteúdo</div>' }));
  assert.deepEqual(rawHtml.ok ? null : rawHtml.code, 'EXECUTABLE_SURFACE');

  const rawCss = validateExperienceProposal(baseProposal({ narration: '.card { display: grid; }' }));
  assert.deepEqual(rawCss.ok ? null : rawCss.code, 'EXECUTABLE_SURFACE');

  const rawJavascript = validateExperienceProposal(baseProposal({ narration: "window.location = 'https://evil.example'" }));
  assert.deepEqual(rawJavascript.ok ? null : rawJavascript.code, 'EXECUTABLE_SURFACE');

  const textualUrl = validateExperienceProposal(baseProposal({ narration: 'Referência textual: https://example.com/guia-contabil' }));
  assert.equal(textualUrl.ok, true);
});

test('process mutation text bounds cannot exceed the Canvas domain that will render an accepted proposal', () => {
  const tooLongLabel = validateExperienceProposal(baseProposal({
    processMutations: [{
      id: 'mutation-label-bound',
      kind: 'upsert_node',
      nodeId: 'node-closing',
      label: 'L'.repeat(EXPERIENCE_PROPOSAL_LIMITS.processNodeLabel + 1),
      summary: 'Resumo seguro.',
      evidenceIds: [],
    }],
  }));
  assert.equal(tooLongLabel.ok, false);
  if (!tooLongLabel.ok) assert.equal(tooLongLabel.path, 'proposal.processMutations[0].label');

  const tooLongSummary = validateExperienceProposal(baseProposal({
    processMutations: [{
      id: 'mutation-summary-bound',
      kind: 'upsert_node',
      nodeId: 'node-closing',
      label: 'Fechamento',
      summary: 'S'.repeat(EXPERIENCE_PROPOSAL_LIMITS.processNodeSummary + 1),
      evidenceIds: [],
    }],
  }));
  assert.equal(tooLongSummary.ok, false);
  if (!tooLongSummary.ok) assert.equal(tooLongSummary.path, 'proposal.processMutations[0].summary');
});

test('rejects executable process mutations, duplicate ids across coordinated effects, and excess mutation choreography', () => {
  const executableMutation = validateExperienceProposal(baseProposal({ processMutations: [
    { id: 'mutation-one', kind: 'upsert_node', nodeId: 'node-closing', label: 'Fechamento', summary: 'Resumo seguro.', evidenceIds: [], component: 'RemoteWidget', module: './RemoteWidget.tsx' },
  ] }));
  assert.equal(executableMutation.ok, false);

  const duplicate = validateExperienceProposal(baseProposal({
    intent: {
      ...baseProposal().intent,
      actions: [{ id: 'same-id', kind: 'focus', targetId: 'node-closing', reason: 'Foco.' }],
    },
    processMutations: [{ id: 'same-id', kind: 'remove_element', targetId: 'node-old', reason: 'Hipótese superada.' }],
  }));
  assert.deepEqual(duplicate.ok ? null : duplicate.code, 'DUPLICATE_ID');

  const processMutations = Array.from({ length: EXPERIENCE_PROPOSAL_LIMITS.processMutations + 1 }, (_, index) => ({
    id: `mutation-${index + 1}`,
    kind: 'remove_element',
    targetId: `node-${index + 1}`,
    reason: 'Evitar coreografia excessiva.',
  }));
  const excessive = validateExperienceProposal(baseProposal({ processMutations }));
  assert.deepEqual(excessive.ok ? null : excessive.code, 'LIMIT_EXCEEDED');
});
