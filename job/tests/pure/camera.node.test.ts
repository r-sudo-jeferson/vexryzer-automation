import test from 'node:test';
import assert from 'node:assert/strict';
import { createCameraPlan, cameraTransitionAllowed } from '../../src/canvas/camera.ts';

test('camera plans are deterministic for origin, process and focus', () => {
  assert.deepEqual(createCameraPlan({ mode: 'origin', reducedMotion: false }), {
    kind: 'fit-nodes', nodeIds: ['origin'], padding: 0.28, minZoom: 0.78, maxZoom: 1.06, durationMs: 520,
  });
  assert.deepEqual(createCameraPlan({ mode: 'process', reducedMotion: true }), {
    kind: 'fit-all', padding: 0.18, minZoom: 0.52, maxZoom: 1, durationMs: 0,
  });
  assert.deepEqual(createCameraPlan({ mode: 'focus', focusNodeId: 'manual-1', reducedMotion: false }), {
    kind: 'fit-nodes', nodeIds: ['manual-1'], padding: 0.34, minZoom: 0.92, maxZoom: 1.22, durationMs: 360,
  });
});

test('focus requires a node id and invalid camera transitions are rejected', () => {
  assert.throws(() => createCameraPlan({ mode: 'focus', reducedMotion: false }), /focusNodeId/);
  assert.equal(cameraTransitionAllowed('origin', 'process'), true);
  assert.equal(cameraTransitionAllowed('process', 'focus'), true);
  assert.equal(cameraTransitionAllowed('focus', 'process'), true);
  assert.equal(cameraTransitionAllowed('origin', 'focus'), false);
});
