import test from 'node:test';
import assert from 'node:assert/strict';
import { processFixtures } from '../../src/canvas/fixtures.ts';
import { PROVENANCE_VALUES, validateProcessGraph } from '../../src/canvas/domain.ts';

test('all S001 visual fixtures are deterministic valid graphs', () => {
  for (const [name, fixture] of Object.entries(processFixtures)) {
    assert.equal(validateProcessGraph(fixture.graph).length, 0, `fixture ${name} is invalid`);
  }
});

test('stress fixture contains twenty nodes and long-content fixture exceeds normal label width', () => {
  assert.equal(processFixtures.stress.graph.nodes.length, 20);
  assert.ok(processFixtures.longContent.graph.nodes.some((node) => node.label.length > 72));
});

test('single-node fixture exercises the one-node GAUNTLET state', () => {
  assert.equal(processFixtures.single.graph.nodes.length, 1);
  assert.equal(processFixtures.single.graph.edges.length, 0);
});

test('duplicate-label fixture proves identity is node-id based', () => {
  const duplicates = processFixtures.duplicateLabels.graph.nodes.filter((node) => node.label === 'Conferência manual');
  assert.equal(duplicates.length, 2);
  assert.notEqual(duplicates[0]?.id, duplicates[1]?.id);
});

test('provenance fixture represents every canonical provenance state and uncertainty', () => {
  const fixture = processFixtures.provenance.graph;
  assert.deepEqual(new Set(fixture.nodes.map((node) => node.provenance)), new Set(PROVENANCE_VALUES));
  assert.ok(fixture.nodes.some((node) => node.kind === 'uncertainty' && node.provenance === 'ai_inferred'));
});

test('adversarial-text fixture contains literal markup-shaped content for XSS-safe rendering attacks', () => {
  assert.ok(Object.hasOwn(processFixtures, 'adversarialText'));
  const fixture = (processFixtures as Record<string, { graph: { nodes: readonly { label: string; summary: string }[] } }>).adversarialText;
  assert.ok(fixture);
  const content = fixture.graph.nodes.map((node) => `${node.label} ${node.summary}`).join(' ');
  assert.match(content, /<img/i);
  assert.match(content, /<script/i);
  assert.match(content, /__VXA_INJECTED__/);
});
