import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveZoomBand, zoomDetailLevel, ZOOM_THRESHOLDS } from '../../src/canvas/semantic-zoom.ts';

test('semantic zoom uses stable far, medium and near boundaries', () => {
  assert.equal(resolveZoomBand(0.4), 'far');
  assert.equal(resolveZoomBand(ZOOM_THRESHOLDS.medium), 'medium');
  assert.equal(resolveZoomBand(0.9), 'medium');
  assert.equal(resolveZoomBand(ZOOM_THRESHOLDS.near), 'near');
  assert.equal(resolveZoomBand(1.6), 'near');
});

test('semantic zoom hysteresis resists flicker around the active boundary', () => {
  assert.equal(resolveZoomBand(0.70, 'medium'), 'medium');
  assert.equal(resolveZoomBand(0.66, 'medium'), 'far');
  assert.equal(resolveZoomBand(1.06, 'near'), 'near');
  assert.equal(resolveZoomBand(1.02, 'near'), 'medium');
});

test('detail levels are monotonic', () => {
  assert.equal(zoomDetailLevel('far'), 0);
  assert.equal(zoomDetailLevel('medium'), 1);
  assert.equal(zoomDetailLevel('near'), 2);
});
