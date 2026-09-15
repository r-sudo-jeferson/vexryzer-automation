import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const canvas = await readFile(path.resolve(here, '../../src/canvas/AutomationCanvas.tsx'), 'utf8');
const app = await readFile(path.resolve(here, '../../src/app/App.tsx'), 'utf8');

test('interaction policy preserves touch pan/pinch on directed mobile and ordinary wheel zoom on desktop', () => {
  assert.match(canvas, /matchMedia\('\(max-width: 720px\), \(pointer: coarse\)'\)/);
  assert.doesNotMatch(canvas, /panOnDrag=\{directedMobile\s*\?\s*false/);
  assert.match(canvas, /panOnDrag=\{\[0,\s*1\]\}/);
  assert.match(canvas, /panOnScroll=\{false\}/);
  assert.match(canvas, /zoomOnPinch(?:=\{true\})?/);
  assert.match(canvas, /zoomOnScroll=\{!directedMobile\}/);
  assert.match(canvas, /preventScrolling=\{!directedMobile\}/);
});

test('user input can interrupt camera travel and resize can reframe an uninterrupted camera intent', () => {
  assert.match(canvas, /onMoveStart=\{handleMoveStart\}/);
  assert.match(canvas, /userInterruptedRef/);
  assert.match(canvas, /setViewport\(instance\.getViewport\(\),\s*\{\s*duration:\s*0\s*\}\)/);
  assert.match(canvas, /ResizeObserver/);
  assert.match(canvas, /viewportRevision/);
});

test('WP05 interruption matrix covers pointer, wheel, touch, drag-motion, viewport keys and external signals', async () => {

  // Canvas-owned matrix: every viewport-takeover path funnels into one guarded owner.
  assert.match(canvas, /onPointerDown=\{handlePointerDown\}/);
  assert.match(canvas, /onClick=\{handleSurfaceClick\}/);
  assert.match(canvas, /onWheel=\{handleWheel\}/);
  assert.match(canvas, /onTouchStart=\{handleTouchStart\}/);
  assert.match(canvas, /onPointerMove=\{handlePointerMove\}/);
  assert.match(canvas, /event\.buttons !== 0/);
  assert.match(canvas, /onKeyDown=\{handleKeyDown\}/);
  assert.match(canvas, /INTERRUPTING_KEYS/);
  assert.match(canvas, /ArrowUp.*ArrowDown.*ArrowLeft.*ArrowRight/s);
  assert.match(canvas, /externalInterruptSignal/);
  assert.match(canvas, /onInterrupt\?: \(\) => void/);

  // Transition-only counting: the probe counts interruptions, not raw events.
  assert.match(canvas, /if \(userInterruptedRef\.current\) return;/);

  // Camera commands resolve through the Director; the effect never plans directly.
  assert.match(canvas, /resolveCameraDirection\(\{/);
  assert.doesNotMatch(canvas, /createCameraPlan\(\{/);

  // Focus contract: traversal and node focus survive, nothing traps or steals focus.
  assert.doesNotMatch(canvas, /\.focus\(/);
  assert.match(canvas, /nodesFocusable/);
  assert.match(canvas, /autoPanOnNodeFocus/);

  // App-owned half of the matrix: focus on a control outside the Canvas and
  // live semantic targets feed the Director without new imperative commands.
  assert.match(canvas, /semanticTargets/);
  assert.match(canvas, /sceneComposition/);
  assert.match(app, /onFocus=\{handleAppFocus\}/);
  assert.match(app, /closest\('\.vxa-canvas'\)/);
  assert.match(app, /semanticTargets=\{semanticTargets\}/);
  assert.match(app, /sceneComposition=\{sceneComposition\}/);
  assert.match(app, /externalInterruptSignal=\{externalInterruptSignal\}/);
});

test('WP07 RED: proof and opportunity value live inside React Flow instead of a second full-width dashboard surface', () => {
  assert.match(canvas, /opportunity-proof/);
  assert.match(canvas, /value-proof/);
  assert.match(canvas, /opportunities\?:/);
  assert.match(canvas, /globalQuantifications\?:/);
  assert.doesNotMatch(app, /<EvidenceProofSurface/);
  assert.doesNotMatch(app, /import \{ EvidenceProofSurface \}/);
});
