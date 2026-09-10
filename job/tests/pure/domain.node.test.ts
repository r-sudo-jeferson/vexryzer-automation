import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createProcessGraph,
  validateProcessGraph,
  PROCESS_NODE_KINDS,
  PROVENANCE_VALUES,
  type ProcessNodeModel,
} from '../../src/canvas/domain.ts';

const nodes: ProcessNodeModel[] = [
  { id: 'source-1', kind: 'source', label: 'Planilha recebida', provenance: 'user_stated', summary: 'Entrada do processo' },
  { id: 'manual-1', kind: 'manual_action', label: 'Conferência manual', provenance: 'user_confirmed', summary: 'Validação recorrente', effort: { minutesPerOccurrence: 18 } },
  { id: 'output-1', kind: 'output', label: 'Relatório pronto', provenance: 'ai_inferred', summary: 'Saída revisada' },
];

test('graph creation preserves typed nodes and valid directed edges', () => {
  const graph = createProcessGraph(nodes, [
    { id: 'e1', source: 'source-1', target: 'manual-1' },
    { id: 'e2', source: 'manual-1', target: 'output-1' },
  ]);
  assert.equal(graph.nodes.length, 3);
  assert.equal(validateProcessGraph(graph).length, 0);
});

test('graph validation rejects duplicate ids, dangling edges and self loops', () => {
  const graph = createProcessGraph([
    ...nodes,
    { ...nodes[0]!, label: 'Duplicado' },
  ], [
    { id: 'e1', source: 'source-1', target: 'missing' },
    { id: 'e2', source: 'manual-1', target: 'manual-1' },
  ]);
  const codes = new Set(validateProcessGraph(graph).map((issue) => issue.code));
  assert.ok(codes.has('DUPLICATE_NODE_ID'));
  assert.ok(codes.has('DANGLING_EDGE'));
  assert.ok(codes.has('SELF_LOOP'));
});

test('node labels reject empty and control-character content', () => {
  const graph = createProcessGraph([
    { id: 'bad-empty', kind: 'system', label: '   ', provenance: 'user_stated', summary: 'x' },
    { id: 'bad-control', kind: 'uncertainty', label: 'ERP\u0000?', provenance: 'ai_inferred', summary: 'x' },
  ], []);
  const codes = validateProcessGraph(graph).map((issue) => issue.code);
  assert.equal(codes.filter((code) => code === 'INVALID_NODE_LABEL').length, 2);
});

test('edge ids and optional semantic labels are bounded before reaching React Flow', () => {
  const graph = createProcessGraph(nodes, [
    { id: '../edge', source: 'source-1', target: 'manual-1', label: 'válida' },
    { id: 'edge-empty-label', source: 'manual-1', target: 'output-1', label: '   ' },
    { id: 'edge-control-label', source: 'source-1', target: 'output-1', label: 'gera\u0000retrabalho' },
  ]);
  const codes = validateProcessGraph(graph).map((issue) => issue.code);
  assert.equal(codes.includes('INVALID_EDGE_ID'), true);
  assert.equal(codes.filter((code) => code === 'INVALID_EDGE_LABEL').length, 2);
});

test('domain vocabulary matches the canonical architecture contract', () => {
  assert.deepEqual(PROCESS_NODE_KINDS, ['source', 'manual_action', 'transformation', 'system', 'output', 'evidence', 'effort', 'uncertainty', 'estimate', 'request_receipt']);
  assert.deepEqual(PROVENANCE_VALUES, ['user_stated', 'ai_inferred', 'user_confirmed']);
});
