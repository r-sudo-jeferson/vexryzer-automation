import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveSpatialAgentPresence } from '../../src/canvas/spatial-agent-presence.ts';

const positions = new Map([
  ['origin', { x: -440, y: -40 }],
  ['step-a', { x: 0, y: 0 }],
  ['step-b', { x: 330, y: 0 }],
  ['step-c', { x: 330, y: 210 }],
  ['step-d', { x: 0, y: 210 }],
]);

test('agent lives in Canvas world space and follows validated semantic targets', () => {
  const presence = resolveSpatialAgentPresence({
    status: 'requesting', mode: 'focus', focusedNodeId: 'step-a',
    semanticTargets: ['step-b'], positions, mobile: false,
  });
  assert.equal(presence.anchorId, 'step-b');
  assert.equal(presence.phase, 'thinking');
  assert.equal(presence.placement, 'above');
  assert.equal(presence.position.y < positions.get('step-b')!.y, true);
  assert.equal(presence.visible, true);
});

test('mobile uses a distinct app-owned placement instead of desktop scaling', () => {
  const desktop = resolveSpatialAgentPresence({
    status: 'awaiting_user', mode: 'focus', focusedNodeId: 'step-b',
    semanticTargets: [], positions, mobile: false,
  });
  const mobile = resolveSpatialAgentPresence({
    status: 'awaiting_user', mode: 'focus', focusedNodeId: 'step-b',
    semanticTargets: [], positions, mobile: true,
  });
  assert.equal(desktop.anchorId, 'step-b');
  assert.equal(mobile.anchorId, 'step-b');
  assert.notDeepEqual(mobile.position, desktop.position);
  assert.notEqual(mobile.placement, desktop.placement);
  const otherProcessPositions = [...positions.entries()]
    .filter(([id]) => id !== 'origin' && id !== mobile.anchorId)
    .map(([, point]) => point);
  assert.equal(otherProcessPositions.some((point) =>
    Math.abs(mobile.position.x - point.x) < 300
      && Math.abs(mobile.position.y - point.y) < 190), false);
  assert.equal(mobile.phase, 'asking');
});

test('unknown semantic targets fail closed to known focus then origin', () => {
  const focused = resolveSpatialAgentPresence({
    status: 'idle', mode: 'focus', focusedNodeId: 'step-c',
    semanticTargets: ['missing'], positions, mobile: false,
  });
  assert.equal(focused.anchorId, 'step-c');

  const origin = resolveSpatialAgentPresence({
    status: 'recovery', mode: 'process', focusedNodeId: null,
    semanticTargets: ['missing'], positions, mobile: false,
  });
  assert.equal(origin.anchorId, 'origin');
  assert.equal(origin.phase, 'recovering');
});

test('presence key changes only with spatial or lifecycle meaning', () => {
  const base = resolveSpatialAgentPresence({
    status: 'idle', mode: 'process', focusedNodeId: null,
    semanticTargets: [], positions, mobile: false,
  });
  const moved = resolveSpatialAgentPresence({
    status: 'requesting', mode: 'focus', focusedNodeId: 'step-a',
    semanticTargets: ['step-b'], positions, mobile: false,
  });
  assert.notEqual(base.key, moved.key);
  assert.equal(base.phase, 'observing');
  assert.equal(moved.phase, 'thinking');
});
