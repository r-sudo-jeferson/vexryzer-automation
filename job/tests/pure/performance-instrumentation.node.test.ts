import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = await readFile(path.resolve(here, '../../src/performance/usePerformanceInstrumentation.ts'), 'utf8');
const canvasSource = await readFile(path.resolve(here, '../../src/canvas/AutomationCanvas.tsx'), 'utf8');
const probeTypes = await readFile(path.resolve(here, '../../src/performance/performance-probe.d.ts'), 'utf8');

test('GAUNTLET performance observer is explicitly opt-in and cleaned up', () => {
  assert.match(source, /URLSearchParams\(window\.location\.search\)[\s\S]*get\(['\"]perf['\"]\)[\s\S]*===\s*['\"]1['\"]/);
  const guardIndex = source.indexOf("get('perf') === '1'");
  const assignmentIndex = source.indexOf('window.__VXA_PERF__ =');
  assert.ok(guardIndex >= 0 && guardIndex < assignmentIndex, 'perf opt-in guard must precede probe initialization');
  assert.match(source, /delete\s+window\.__VXA_PERF__/);
});

test('opt-in probe exposes render, viewport, semantic-band and camera counters for GAUNTLET inspection', () => {
  assert.match(probeTypes, /canvasCommits:\s*number/);
  assert.match(probeTypes, /viewportEvents:\s*number/);
  assert.match(probeTypes, /semanticBandChanges:\s*number/);
  assert.match(probeTypes, /cameraCommands:\s*number/);
  assert.match(probeTypes, /cameraInterruptions:\s*number/);
  assert.match(probeTypes, /cameraResizeRefits:\s*number/);
  assert.match(canvasSource, /canvasCommits\s*\+=\s*1/);
  assert.match(canvasSource, /viewportEvents\s*\+=\s*1/);
  assert.match(canvasSource, /semanticBandChanges\s*\+=\s*1/);
  assert.match(canvasSource, /cameraCommands\s*\+=\s*1/);
  assert.match(canvasSource, /cameraInterruptions\s*\+=\s*1/);
  assert.match(canvasSource, /cameraResizeRefits\s*\+=\s*1/);
});
