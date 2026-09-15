import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANVAS_TELEMETRY_EVENT_KINDS,
  CANVAS_TELEMETRY_LIMITS,
  CANVAS_TELEMETRY_REJECTION_CODES,
  createCanvasTelemetryRecorder,
} from '../../src/experience/canvas-telemetry.ts';

test('telemetry contract exposes only non-sensitive enumerated signals with fixed bounds', () => {
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('intent-accepted'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('intent-rejected'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('camera-interrupted'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('catalog-miss'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('disclosure-denied'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('stale-revision'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('tool-failure'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('agent-retry'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('human-override'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('recovery'));
  assert.ok(CANVAS_TELEMETRY_EVENT_KINDS.includes('no-op'));
  assert.deepEqual(
    [...CANVAS_TELEMETRY_REJECTION_CODES].sort(),
    [
      'a11y-violation',
      'catalog-miss',
      'disclosure-denied',
      'missing-evidence',
      'responsive-violation',
      'stale-revision',
      'unknown-key',
      'unknown-kind',
      'unsafe-url',
    ].sort(),
  );
  assert.equal(CANVAS_TELEMETRY_LIMITS.events, 128);
});

test('recorder accepts one valid example of every event kind and freezes snapshots', () => {
  const recorder = createCanvasTelemetryRecorder();
  const valid: Record<string, unknown>[] = [
    { kind: 'intent-accepted', revision: 7 },
    { kind: 'intent-rejected', rejectionCode: 'unknown-kind', revision: 7 },
    { kind: 'action-projected', actionKind: 'compare', composition: 'compare', count: 2 },
    { kind: 'camera-interrupted', interrupted: true },
    { kind: 'camera-interrupted' },
    { kind: 'catalog-miss', actionKind: 'focus', count: 1 },
    { kind: 'disclosure-denied', revision: 7, count: 1 },
    { kind: 'stale-revision', revision: 6, count: 1 },
    { kind: 'tool-failure', count: 1 },
    { kind: 'agent-retry', count: 2 },
    { kind: 'human-override' },
    { kind: 'recovery', revision: 8 },
    { kind: 'no-op', deduplicated: true, revision: 7 },
  ];
  for (const entry of valid) {
    assert.equal(recorder.record(entry), true, JSON.stringify(entry));
  }
  const snapshot = recorder.snapshot();
  assert.equal(snapshot.length, valid.length);
  assert.ok(Object.isFrozen(snapshot));
  for (const event of snapshot) assert.ok(Object.isFrozen(event));
  assert.equal(snapshot[0]?.kind, 'intent-accepted');
});

test('recorder rejects missing required fields, bad enums and out-of-bounds numbers fail-closed', () => {
  const recorder = createCanvasTelemetryRecorder();
  const invalid: Record<string, unknown>[] = [
    { kind: 'intent-accepted' },
    { kind: 'intent-accepted', revision: -1 },
    { kind: 'intent-accepted', revision: 1.5 },
    { kind: 'intent-rejected' },
    { kind: 'intent-rejected', rejectionCode: 'invented-reason' },
    { kind: 'action-projected' },
    { kind: 'action-projected', actionKind: 'frame_region' },
    { kind: 'action-projected', actionKind: 'focus', composition: 'cinematic' },
    { kind: 'action-projected', actionKind: 'focus', count: -1 },
    { kind: 'action-projected', actionKind: 'focus', count: 1.5 },
    { kind: 'action-projected', actionKind: 'focus', count: CANVAS_TELEMETRY_LIMITS.countMax + 1 },
    { kind: 'stale-revision' },
    { kind: 'stale-revision', revision: -2 },
    { kind: 'camera-interrupted', interrupted: 'yes' },
    { kind: 'no-op', deduplicated: 'yes' },
    { kind: 'frame-region' },
    { kind: 'intent-accepted', revision: 7, extraKey: 1 },
  ];
  for (const entry of invalid) {
    assert.equal(recorder.record(entry), false, JSON.stringify(entry));
  }
  assert.equal(recorder.record(null), false);
  assert.equal(recorder.record('intent-accepted'), false);
  assert.equal(recorder.snapshot().length, 0);
});

test('recorder rejects fields that are invalid for the given event kind', () => {
  const recorder = createCanvasTelemetryRecorder();
  const crossKind: Record<string, unknown>[] = [
    { kind: 'intent-accepted', revision: 7, rejectionCode: 'unknown-kind' },
    { kind: 'intent-accepted', revision: 7, actionKind: 'focus' },
    { kind: 'intent-accepted', revision: 7, deduplicated: true },
    { kind: 'intent-rejected', rejectionCode: 'unknown-key', actionKind: 'focus' },
    { kind: 'intent-rejected', rejectionCode: 'unknown-key', composition: 'focus' },
    { kind: 'intent-rejected', rejectionCode: 'unknown-key', count: 1 },
    { kind: 'action-projected', actionKind: 'focus', rejectionCode: 'unknown-kind' },
    { kind: 'action-projected', actionKind: 'focus', revision: 7 },
    { kind: 'action-projected', actionKind: 'focus', interrupted: true },
    { kind: 'camera-interrupted', count: 1 },
    { kind: 'camera-interrupted', revision: 7 },
    { kind: 'catalog-miss', revision: 7 },
    { kind: 'catalog-miss', composition: 'focus' },
    { kind: 'human-override', count: 1 },
    { kind: 'human-override', revision: 7 },
    { kind: 'tool-failure', revision: 7 },
    { kind: 'agent-retry', actionKind: 'focus' },
    { kind: 'recovery', count: 1 },
    { kind: 'no-op', count: 1 },
    { kind: 'no-op', actionKind: 'focus' },
    { kind: 'stale-revision', revision: 6, actionKind: 'focus' },
    { kind: 'disclosure-denied', actionKind: 'focus' },
  ];
  for (const entry of crossKind) {
    assert.equal(recorder.record(entry), false, JSON.stringify(entry));
  }
  assert.equal(recorder.snapshot().length, 0);
});

test('recorder never stores private content, prompts, secrets or attachment payloads', () => {
  const recorder = createCanvasTelemetryRecorder();
  const attacks: Record<string, unknown>[] = [
    { kind: 'intent-accepted', revision: 7, text: 'o fechamento leva 5 dias' },
    { kind: 'intent-accepted', revision: 7, prompt: 'system prompt' },
    { kind: 'intent-accepted', revision: 7, narration: 'narrativa' },
    { kind: 'intent-accepted', revision: 7, reason: 'motivo' },
    { kind: 'intent-accepted', revision: 7, secret: 'sk-123' },
    { kind: 'intent-accepted', revision: 7, token: 'bearer-abc' },
    { kind: 'action-projected', actionKind: 'focus', payload: { a: 1 } },
    { kind: 'action-projected', actionKind: 'focus', attachment: 'bytes' },
    { kind: 'action-projected', actionKind: 'focus', file: 'doc.pdf' },
    { kind: 'action-projected', actionKind: 'focus', ocr: 'extracted' },
    { kind: 'action-projected', actionKind: 'focus', embedding: [1, 2] },
    { kind: 'action-projected', actionKind: 'focus', html: '<div/>' },
    { kind: 'action-projected', actionKind: 'focus', url: 'https://evil.example' },
    { kind: 'action-projected', actionKind: 'focus', component: 'Widget' },
    { kind: 'action-projected', actionKind: 'focus', value: 42 },
    { kind: 'action-projected', actionKind: 'focus', title: 'titulo' },
  ];
  for (const attack of attacks) {
    assert.equal(recorder.record(attack), false, JSON.stringify(attack));
  }
  assert.equal(recorder.snapshot().length, 0);
});

test('recorder is bounded and isolated per session scope', () => {
  const first = createCanvasTelemetryRecorder();
  const second = createCanvasTelemetryRecorder();
  assert.equal(first.record({ kind: 'human-override' }), true);
  assert.equal(second.snapshot().length, 0);

  const bounded = createCanvasTelemetryRecorder();
  for (let i = 0; i < CANVAS_TELEMETRY_LIMITS.events + 10; i += 1) {
    assert.equal(bounded.record({ kind: 'action-projected', actionKind: 'focus', count: i }), true);
  }
  assert.equal(bounded.snapshot().length, CANVAS_TELEMETRY_LIMITS.events);
  assert.equal(bounded.droppedCount(), 10);
  assert.equal(bounded.snapshot()[0]?.kind, 'action-projected');

  bounded.clear();
  assert.equal(bounded.snapshot().length, 0);
  assert.equal(bounded.droppedCount(), 0);
});
