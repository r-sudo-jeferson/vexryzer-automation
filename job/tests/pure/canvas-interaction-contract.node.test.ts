import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const canvas = await readFile(path.resolve(here, '../../src/canvas/AutomationCanvas.tsx'), 'utf8');

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
