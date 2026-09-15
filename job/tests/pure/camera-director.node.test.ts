import test from 'node:test';
import assert from 'node:assert/strict';
import { createCameraPlan } from '../../src/canvas/camera.ts';
import {
  resolveCameraDirection,
  resolveRestoreUserView,
  type CameraDirectorInput,
} from '../../src/canvas/camera-director.ts';

const KNOWN = ['node-a', 'node-b', 'node-c', 'origin'];

function input(overrides: Partial<CameraDirectorInput> = {}): CameraDirectorInput {
  return {
    mode: 'process',
    focusedNodeId: null,
    targets: [],
    composition: 'stable',
    announcement: null,
    knownNodeIds: KNOWN,
    mobile: false,
    reducedMotion: false,
    ...overrides,
  };
}

test('WP05 director stays backward compatible when no semantic targets exist', () => {
  assert.deepEqual(
    resolveCameraDirection(input({ mode: 'origin' })).plan,
    createCameraPlan({ mode: 'origin', reducedMotion: false }),
  );
  assert.deepEqual(
    resolveCameraDirection(input({ mode: 'process' })).plan,
    createCameraPlan({ mode: 'process', reducedMotion: false }),
  );
  assert.deepEqual(
    resolveCameraDirection(input({ mode: 'focus', focusedNodeId: 'node-a' })).plan,
    createCameraPlan({ mode: 'focus', focusNodeId: 'node-a', reducedMotion: false }),
  );
  assert.equal(resolveCameraDirection(input({ mode: 'origin' })).directive, 'origin-reset');
  assert.equal(resolveCameraDirection(input({ mode: 'process' })).directive, 'process-overview');
  assert.equal(resolveCameraDirection(input({ mode: 'focus', focusedNodeId: 'node-a' })).directive, 'focus-object');
});

test('WP05 director resolves all eight directive kinds from deterministic triggers', () => {
  const cases = [
    { name: 'focus-object', args: { composition: 'focus', targets: ['node-a'] }, directive: 'focus-object' },
    { name: 'frame-region', args: { composition: 'stable', targets: ['node-a', 'node-b'] }, directive: 'frame-region' },
    { name: 'compare-targets', args: { composition: 'compare', targets: ['node-a', 'node-b'] }, directive: 'compare-targets' },
    { name: 'reveal-sequence', args: { composition: 'artifact', targets: ['node-a'] }, directive: 'reveal-sequence' },
    { name: 'process-overview', args: { composition: 'overview', targets: ['node-a'] }, directive: 'process-overview' },
    { name: 'origin-reset', args: { mode: 'origin', targets: ['node-a'] }, directive: 'origin-reset' },
    { name: 'guided-transition', args: { composition: 'focus', targets: ['node-a'], announcement: 'Mudança.' }, directive: 'guided-transition' },
  ] as const;
  for (const { name, args, directive } of cases) {
    const resolved = resolveCameraDirection(input({ ...args }));
    assert.equal(resolved.directive, directive, name);
    assert.equal(resolved.framing, 'desktop');
  }
  const restored = resolveRestoreUserView(
    { mode: 'focus', focusNodeId: 'node-b' },
    KNOWN,
    { mobile: false, reducedMotion: false },
  );
  assert.equal(restored.directive, 'restore-user-view');
  assert.deepEqual(restored.targets, ['node-b']);
  assert.deepEqual(restored.plan, createCameraPlan({ mode: 'focus', focusNodeId: 'node-b', reducedMotion: false }));
});

test('WP05 director frames multi-target directives distinctly per form factor', () => {
  const desktop = resolveCameraDirection(input({ composition: 'compare', targets: ['node-a', 'node-b'] }));
  assert.equal(desktop.framing, 'desktop');
  assert.equal(desktop.plan.kind, 'fit-all');

  const mobile = resolveCameraDirection(input({ composition: 'compare', targets: ['node-a', 'node-b'], mobile: true }));
  assert.equal(mobile.framing, 'mobile-directed');
  assert.equal(mobile.directive, 'compare-targets');
  assert.deepEqual(mobile.plan, createCameraPlan({ mode: 'focus', focusNodeId: 'node-a', reducedMotion: false }));

  const mobileRegion = resolveCameraDirection(input({ composition: 'stable', targets: ['node-b', 'node-c'], mobile: true }));
  assert.equal(mobileRegion.directive, 'frame-region');
  assert.deepEqual(mobileRegion.plan, createCameraPlan({ mode: 'focus', focusNodeId: 'node-b', reducedMotion: false }));
});

test('WP05 director filters unknown targets instead of guessing, with documented fallbacks', () => {
  const filtered = resolveCameraDirection(input({ composition: 'focus', targets: ['node-ghost', 'node-a'] }));
  assert.deepEqual(filtered.targets, ['node-a']);
  assert.deepEqual(filtered.plan, createCameraPlan({ mode: 'focus', focusNodeId: 'node-a', reducedMotion: false }));

  const allUnknown = resolveCameraDirection(input({ mode: 'process', composition: 'compare', targets: ['ghost-1', 'ghost-2'] }));
  assert.deepEqual(allUnknown.targets, []);
  assert.equal(allUnknown.directive, 'process-overview');
  assert.deepEqual(allUnknown.plan, createCameraPlan({ mode: 'process', reducedMotion: false }));

  const staleFocus = resolveCameraDirection(input({ mode: 'focus', focusedNodeId: 'node-ghost' }));
  assert.equal(staleFocus.directive, 'process-overview');
  assert.deepEqual(staleFocus.plan, createCameraPlan({ mode: 'process', reducedMotion: false }));

  const unknownRestore = resolveRestoreUserView(
    { mode: 'focus', focusNodeId: 'node-ghost' },
    KNOWN,
    { mobile: false, reducedMotion: false },
  );
  assert.equal(unknownRestore.directive, 'restore-user-view');
  assert.deepEqual(unknownRestore.plan, createCameraPlan({ mode: 'process', reducedMotion: false }));
});

test('WP06 mobile spatial companion framing preserves focus while widening the camera envelope', () => {
  const focusPlan = createCameraPlan({ mode: 'focus', focusNodeId: 'node-b', reducedMotion: false });
  const overviewPlan = createCameraPlan({ mode: 'process', reducedMotion: false });
  const resolved = resolveCameraDirection({
    ...input({ mode: 'focus', focusedNodeId: 'node-b', mobile: true }),
    spatialCompanionVisible: true,
  } as CameraDirectorInput);

  assert.equal(resolved.plan.kind, 'fit-nodes');
  assert.equal(resolved.plan.padding, overviewPlan.padding);
  assert.equal(resolved.plan.minZoom, overviewPlan.minZoom);
  assert.equal(resolved.plan.maxZoom, focusPlan.maxZoom);
  assert.equal(resolved.plan.durationMs, focusPlan.durationMs);
});

test('WP05 director honors reduced motion with duration 0 on every directive', () => {
  const reducedCases: CameraDirectorInput[] = [
    input({ mode: 'origin', reducedMotion: true }),
    input({ mode: 'process', reducedMotion: true }),
    input({ mode: 'focus', focusedNodeId: 'node-a', reducedMotion: true }),
    input({ composition: 'compare', targets: ['node-a', 'node-b'], reducedMotion: true }),
    input({ composition: 'artifact', targets: ['node-a'], announcement: 'X', reducedMotion: true }),
    input({ composition: 'compare', targets: ['node-a', 'node-b'], mobile: true, reducedMotion: true }),
  ];
  for (const args of reducedCases) {
    assert.equal(resolveCameraDirection(args).plan.durationMs, 0);
  }
  assert.equal(
    resolveRestoreUserView({ mode: 'focus', focusNodeId: 'node-a' }, KNOWN, { mobile: false, reducedMotion: true }).plan.durationMs,
    0,
  );
});
