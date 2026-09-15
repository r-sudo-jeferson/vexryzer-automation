import assert from 'node:assert/strict';
import test from 'node:test';
import { createProcessGraph, validateProcessGraph } from '../../src/canvas/domain.ts';
import {
  SPATIAL_AGENT_NODE_ID,
  resolveSpatialAgentPresence,
} from '../../src/canvas/spatial-agent-presence.ts';

test('spatial presence uses a reserved non-canonical node id', () => {
  assert.equal(SPATIAL_AGENT_NODE_ID, '__vxa_spatial_agent__');
  const hostile = createProcessGraph([{
    id: SPATIAL_AGENT_NODE_ID,
    kind: 'source',
    label: 'Hostile collision',
    summary: 'Must be rejected by canonical graph validation.',
    provenance: 'user_stated',
  }], []);
  assert.equal(validateProcessGraph(hostile).some((issue) => issue.code === 'INVALID_NODE_ID'), true);
});

test('presence resolution does not mutate canonical process positions', () => {
  const positions = new Map([
    ['origin', { x: -440, y: -40 }],
    ['manual-review', { x: 330, y: 0 }],
    ['system-entry', { x: 330, y: 210 }],
  ]);
  const before = [...positions.entries()].map(([id, point]) => [id, { ...point }] as const);

  const presence = resolveSpatialAgentPresence({
    status: 'awaiting_user',
    mode: 'focus',
    focusedNodeId: 'manual-review',
    semanticTargets: ['manual-review'],
    positions,
    mobile: true,
  });

  assert.equal(presence.anchorId, 'manual-review');
  assert.equal(presence.visible, true);
  assert.equal(positions.has(SPATIAL_AGENT_NODE_ID), false);
  assert.deepEqual([...positions.entries()], before);
});
