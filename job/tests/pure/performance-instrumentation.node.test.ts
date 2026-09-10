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
  assert.match(source, /URLSearchParams\(window\.location\.search\)[\s\S]*get\(['"]perf['"]\)[\s\S]*===\s*['"]1['"]/);
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
  assert.match(probeTypes, /askSubmissions:\s*number/);
  assert.match(probeTypes, /askAccepted:\s*number/);
  assert.match(probeTypes, /askRecoveries:\s*number/);
  assert.match(probeTypes, /askFailures:\s*number/);
  assert.match(probeTypes, /askLastVisualAckMs:\s*number\s*\|\s*null/);
  assert.match(canvasSource, /canvasCommits\s*\+=\s*1/);
  assert.match(canvasSource, /viewportEvents\s*\+=\s*1/);
  assert.match(canvasSource, /semanticBandChanges\s*\+=\s*1/);
  assert.match(canvasSource, /cameraCommands\s*\+=\s*1/);
  assert.match(canvasSource, /cameraInterruptions\s*\+=\s*1/);
  assert.match(canvasSource, /cameraResizeRefits\s*\+=\s*1/);
});

test('opt-in probe measures LCP, INP and CLS rather than exposing budget constants only', () => {
  assert.match(probeTypes, /lcpMs:\s*number\s*\|\s*null/);
  assert.match(probeTypes, /inpMs:\s*number\s*\|\s*null/);
  assert.match(probeTypes, /cls:\s*number/);
  assert.match(probeTypes, /observedEntryTypes:\s*string\[\]/);
  assert.match(source, /largest-contentful-paint/);
  assert.match(source, /first-input/);
  assert.match(source, /layout-shift/);
  assert.match(source, /interactionId/);
  assert.match(source, /durationThreshold/);
  assert.match(source, /observedEntryTypes\.push/);
  const capabilityGuard = source.indexOf("'PerformanceObserver' in window");
  const supportedTypesAccess = source.indexOf('PerformanceObserver.supportedEntryTypes');
  assert.ok(capabilityGuard >= 0 && supportedTypesAccess > capabilityGuard, 'capability guard must precede static PerformanceObserver access');
});
