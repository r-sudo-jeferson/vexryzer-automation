import test from 'node:test';
import assert from 'node:assert/strict';
import { AGENT_INTENT_LIMITS, validateAgentIntent } from '../../src/experience/agent-intent.ts';

function baseIntent(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: 1,
    objective: 'Tornar o custo operacional visível sem forçar uma próxima pergunta.',
    rationale: 'Os dados já permitem um movimento persuasivo baseado em capacidade mensal.',
    capabilities: [],
    actions: [],
    quantitativeOpportunities: [],
    artifactIntents: [],
    nextQuestion: null,
    ...overrides,
  };
}

test('accepts an improvisational turn with no question and zero, one, or many capabilities', () => {
  for (const capabilities of [
    [],
    ['bi_decision_intelligence'],
    ['data_import_transform', 'bi_decision_intelligence', 'training_enablement'],
  ]) {
    const result = validateAgentIntent(baseIntent({ capabilities }));
    assert.equal(result.ok, true);
    if (!result.ok) throw new Error(`${result.code}:${result.path}`);
    assert.equal(result.value.nextQuestion, null);
    assert.deepEqual(result.value.capabilities, capabilities);
  }
});

test('accepts multiple coordinated semantic effects without imposing a fixed action order', () => {
  const actions = [
    { id: 'act-quantify', kind: 'quantify', calculationId: 'calc-capacity-month', targetId: 'node-reconciliation', reason: 'Mostrar 44 horas mensais já verificadas.' },
    { id: 'act-compare', kind: 'compare', targetIds: ['node-current', 'node-future'], reason: 'Contrastar estado atual e direção futura.' },
    { id: 'act-focus', kind: 'focus', targetId: 'node-reconciliation', reason: 'Manter o gargalo principal no centro.' },
  ];
  const result = validateAgentIntent(baseIntent({ actions }));
    assert.equal(result.ok, true);
  if (!result.ok) throw new Error(`${result.code}:${result.path}`);
  assert.deepEqual(result.value.actions.map((action) => action.id), ['act-quantify', 'act-compare', 'act-focus']);
});

test('rejects duplicate action ids, classifier/funnel fields, raw viewport coordinates, and executable payload fields', () => {
  const duplicate = validateAgentIntent(baseIntent({
    actions: [
      { id: 'act-one', kind: 'focus', targetId: 'node-one', reason: 'Foco um.' },
      { id: 'act-one', kind: 'reveal', targetId: 'node-two', reason: 'Revelar dois.' },
    ],
  }));
  assert.deepEqual(duplicate.ok ? null : duplicate.code, 'DUPLICATE_ID');

  const hiddenFunnel = validateAgentIntent({ ...baseIntent(), preferredSolutionKind: 'automation_integration' });
  assert.equal(hiddenFunnel.ok, false);

  const rawViewport = validateAgentIntent(baseIntent({ actions: [
    { id: 'act-one', kind: 'focus', targetId: 'node-one', reason: 'Foco.', x: 120, y: 80, zoom: 2 },
  ] }));
  assert.equal(rawViewport.ok, false);

  const executable = validateAgentIntent(baseIntent({ actions: [
    { id: 'act-one', kind: 'focus', targetId: 'node-one', reason: 'Foco.', module: './Dangerous.tsx' },
  ] }));
  assert.equal(executable.ok, false);
});

test('rejects choreography and text beyond bounded limits instead of accepting unbounded model output', () => {
  const tooManyActions = Array.from({ length: AGENT_INTENT_LIMITS.actions + 1 }, (_, index) => ({
    id: `act-${index + 1}`,
    kind: 'focus',
    targetId: `node-${index + 1}`,
    reason: 'Foco sem coreografia excessiva.',
  }));
  const result = validateAgentIntent(baseIntent({ actions: tooManyActions }));
  assert.deepEqual(result.ok ? null : result.code, 'LIMIT_EXCEEDED');

  const rawJsx = validateAgentIntent(baseIntent({ rationale: '<SalesCard onClick={() => run()} />' }));
  assert.deepEqual(rawJsx.ok ? null : rawJsx.code, 'EXECUTABLE_SURFACE');
});
