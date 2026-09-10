import test from 'node:test';
import assert from 'node:assert/strict';
import { processFixtures } from '../../src/canvas/fixtures.ts';
import { validateProcessGraph } from '../../src/canvas/domain.ts';

test('all S001 visual fixtures are deterministic valid graphs', () => {
  for (const [name, fixture] of Object.entries(processFixtures)) {
    assert.equal(validateProcessGraph(fixture.graph).length, 0, `fixture ${name} is invalid`);
  }
});

test('stress fixture contains twenty nodes and long-content fixture exceeds normal label width', () => {
  assert.equal(processFixtures.stress.graph.nodes.length, 20);
  assert.ok(processFixtures.longContent.graph.nodes.some((node) => node.label.length > 72));
});
