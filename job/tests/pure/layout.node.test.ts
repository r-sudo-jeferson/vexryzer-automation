import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutProcessGraph } from '../../src/canvas/layout.ts';
import { processFixtures } from '../../src/canvas/fixtures.ts';

test('standard layout is deterministic and collision-free for representative nodes', () => {
  const positions = layoutProcessGraph(processFixtures.standard.graph);
  assert.equal(positions.size, 4);
  const values = [...positions.values()];
  assert.equal(new Set(values.map((p) => `${p.x}:${p.y}`)).size, 4);
  assert.deepEqual(positions.get('source-inbox'), { x: 0, y: 0 });
});

test('stress layout wraps into rows without duplicate positions', () => {
  const positions = layoutProcessGraph(processFixtures.stress.graph);
  assert.equal(positions.size, 20);
  assert.equal(new Set([...positions.values()].map((p) => `${p.x}:${p.y}`)).size, 20);
  assert.ok(Math.max(...[...positions.values()].map((p) => p.y)) > 0);
});
