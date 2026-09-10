import test from 'node:test';
import assert from 'node:assert/strict';
import { createMotionPolicy } from '../../src/accessibility/motion-policy.ts';

test('reduced motion removes travel while preserving state feedback', () => {
  const reduced = createMotionPolicy(true);
  assert.equal(reduced.cameraDurationMs, 0);
  assert.equal(reduced.decorativeMotion, false);
  assert.equal(reduced.stateFadeMs > 0, true);
});

test('standard motion stays sparse and bounded', () => {
  const standard = createMotionPolicy(false);
  assert.equal(standard.decorativeMotion, true);
  assert.equal(standard.cameraDurationMs <= 520, true);
  assert.equal(standard.stateFadeMs <= 180, true);
});
