import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const canvas = await readFile(path.resolve(here, '../../src/canvas/AutomationCanvas.tsx'), 'utf8');

test('touch pan and pinch remain optional enhancements instead of being disabled on mobile', () => {
  assert.doesNotMatch(canvas, /panOnDrag=\{directedMobile\s*\?\s*false/);
  assert.match(canvas, /panOnDrag=\{\[0,\s*1\]\}/);
  assert.match(canvas, /zoomOnPinch(?:=\{true\})?/);
  assert.match(canvas, /preventScrolling=\{false\}/);
});

test('user input can interrupt camera travel and resize can reframe an uninterrupted camera intent', () => {
  assert.match(canvas, /onMoveStart=\{handleMoveStart\}/);
  assert.match(canvas, /userInterruptedRef/);
  assert.match(canvas, /setViewport\(instance\.getViewport\(\),\s*\{\s*duration:\s*0\s*\}\)/);
  assert.match(canvas, /ResizeObserver/);
  assert.match(canvas, /viewportRevision/);
});
