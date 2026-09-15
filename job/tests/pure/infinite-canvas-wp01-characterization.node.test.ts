import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCameraPlan } from '../../src/canvas/camera.ts';
import { projectReactiveCanvas } from '../../src/canvas/reactive-graph-adapter.ts';
import { createProcessGraph } from '../../src/canvas/domain.ts';
import { createReactiveExperienceState } from '../../src/experience/experience-projector.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../src');

async function readSource(relative: string): Promise<string> {
  return readFile(path.resolve(srcRoot, relative), 'utf8');
}

// WP01 characterization: green locks on the current truth that later WPs must
// evolve. These tests PASS while documenting present gaps; they are not
// failing RED tests and CI stays green.
//
// Truthful RED evidence observed in-session before the WP02 correction
// (probe via validateAgentIntent on the pre-fix tree):
//   rationale 'window.location = 1'  -> allowed (fail-open)
//   rationale '.card { display: grid; }' -> allowed (fail-open)
//   rationale '()=>run()'            -> allowed (fail-open)
//   rationale 'document.cookie'       -> allowed (fail-open)
// After centralizing the shared executable-surface screen (WP02), every probe
// above returns EXECUTABLE_SURFACE, locked by the WP02 executable audit over
// all 33 model-controlled free-text leaves.

test('WP06 evolution G03-12: seller is Canvas-spatial while the external surface remains a channel', async () => {
  const app = await readSource('app/App.tsx');
  const panel = await readSource('app/AskAiPanel.tsx');
  const canvas = await readSource('canvas/AutomationCanvas.tsx');
  const spatialNode = await readSource('canvas/nodes/SpatialAgentNode.tsx');

  // AskAiPanel intentionally stays outside the Canvas as an accessible input/control
  // channel. It must no longer be the seller's visual embodiment.
  const panelIndex = app.indexOf('<AskAiPanel');
  const stageIndex = app.indexOf('vxa-stage');
  assert.ok(panelIndex >= 0, 'AskAiPanel channel must exist in App');
  assert.ok(stageIndex >= 0, 'Canvas stage must exist in App');
  assert.ok(panelIndex < stageIndex, 'channel remains outside the Canvas world');
  assert.match(panel, /CANAL \/ CONTABILIDADE/);
  assert.match(panel, /Fale com o agente no Canvas/);

  // WP06 supersedes the original WP01 gap: the seller now has application-owned
  // world-space presence and accepted voice inside AutomationCanvas.
  assert.match(canvas, /resolveSpatialAgentPresence/);
  assert.match(canvas, /SPATIAL_AGENT_NODE_ID/);
  assert.match(canvas, /agentNarration/);
  assert.match(canvas, /agentQuestion/);
  assert.match(spatialNode, /vxa-spatial-agent/);
  assert.match(spatialNode, /vxa-spatial-agent__voice/);
  assert.doesNotMatch(spatialNode, /textarea|<button/);

  // Composer capability remains reachable (non-regression lock, not a gap).
  assert.match(panel, /maxLength=\{4_000\}/);
  assert.match(panel, /onCompositionStart/);
  assert.match(panel, /aria-live="polite"/);
  assert.match(panel, /vxa-visually-hidden/);
});

test('WP01 characterization G03-09: camera planner is fixed-mode geometry, not a semantic Director', async () => {
  const camera = await readSource('canvas/camera.ts');

  assert.match(camera, /CameraMode='origin'\|'process'\|'focus'|CameraMode\s*=\s*'origin'/);
  assert.doesNotMatch(camera, /Director|director/);
  assert.doesNotMatch(camera, /interrupt|Interruption/);
  assert.doesNotMatch(camera, /mobile|Mobile/);
  assert.doesNotMatch(camera, /frame_region|sequence_focus|restore_user_view/);

  // Fixed duration family is the only policy today.
  assert.equal(createCameraPlan({ mode: 'origin', reducedMotion: false }).durationMs, 520);
  assert.equal(createCameraPlan({ mode: 'process', reducedMotion: false }).durationMs, 460);
  assert.equal(
    createCameraPlan({ mode: 'focus', focusNodeId: 'node-1', reducedMotion: false }).durationMs,
    360,
  );
  assert.equal(createCameraPlan({ mode: 'process', reducedMotion: true }).durationMs, 0);

  // Only two plan kinds exist; no semantic plan vocabulary.
  assert.equal(createCameraPlan({ mode: 'process', reducedMotion: false }).kind, 'fit-all');
  assert.equal(createCameraPlan({ mode: 'origin', reducedMotion: false }).kind, 'fit-nodes');
});

test('WP01 characterization materialization: artifact/workshop semantics reach the adapter as no-ops', async () => {
  const adapter = await readSource('canvas/reactive-graph-adapter.ts');

  // The three artifact-bound action kinds share one pass-through arm today.
  assert.match(adapter, /case 'demonstrate':\s*\n\s*case 'stage_artifact':\s*\n\s*case 'request_workshop':/);

  // Proof: an active demonstrate action produces no overlay, group, or quantification.
  const graph = createProcessGraph(
    [{ id: 'node-a', kind: 'evidence', label: 'Evidencia', summary: 'Resumo.', provenance: 'user_stated' }],
    [],
  );
  const state = createReactiveExperienceState({ basedOnRevision: 3 });
  const withDemonstrate = {
    ...state,
    actions: Object.freeze([Object.freeze({
      sourceActionId: 'act-demo',
      action: Object.freeze({ id: 'act-demo', kind: 'demonstrate', artifactIntentId: 'artifact-1', reason: 'Demonstrar.' }),
      status: 'active',
      invalidatedReason: null,
    })]),
  } as unknown as typeof state;
  const projected = projectReactiveCanvas(graph, withDemonstrate, {
    verifiedCalculations: [],
    facts: [],
    quantitativeObservations: [],
    opportunities: [],
    proposalFacts: [],
  });
  assert.equal(projected.ok, true);
  if (!projected.ok) return;
  assert.deepEqual(projected.model.overlays, []);
  assert.deepEqual(projected.model.groups, []);
  assert.deepEqual(projected.model.globalQuantifications, []);
});

test('WP01 characterization disclosure/catalog: no enforcement gate or versioned catalog exists yet', async () => {
  const adapter = await readSource('canvas/reactive-graph-adapter.ts');
  const projector = await readSource('experience/experience-projector.ts');
  const validation = await readSource('experience/experience-validation.ts');

  // The six WP09 disclosure states have no producer or engine in current code.
  for (const source of [adapter, projector, validation]) {
    for (const token of ['PUBLIC', 'DEMO', 'PARTIAL', 'LOCKED', 'ENTITLED', 'INTERNAL']) {
      assert.ok(!source.includes(`'${token}'`) && !source.includes(`"${token}"`), `RED: no ${token} state machine yet`);
    }
  }

  // No catalog-bypass rejection or versioned catalog resolution exists yet.
  assert.doesNotMatch(adapter, /catalog|Catalog/);
  assert.doesNotMatch(projector, /catalog|Catalog/);
  assert.doesNotMatch(validation, /catalog-miss|catalog_gap/);
});

test('WP01 baseline: validators stay telemetry-free; WP03 projector holds a type-only optional seam', async () => {
  const validation = await readSource('experience/experience-validation.ts');
  const projector = await readSource('experience/experience-projector.ts');
  const adapter = await readSource('canvas/reactive-graph-adapter.ts');

  // WP01 installed hooks as a standalone module without rewiring validators.
  // WP03 supersedes only the projector lock: it accepts an OPTIONAL
  // per-turn recorder through a type-only seam. Schema validation and graph
  // adaptation remain telemetry-free by construction.
  assert.doesNotMatch(validation, /canvas-telemetry|createCanvasTelemetryRecorder|recordCanvasTelemetry/);
  assert.doesNotMatch(adapter, /canvas-telemetry|createCanvasTelemetryRecorder|recordCanvasTelemetry/);

  // Projector seam discipline: type-only import, optional parameter, guarded
  // emission, and no recorder instantiation (ownership stays with turn scope).
  assert.match(projector, /import type \{ CanvasTelemetryRecorder \} from '\.\/canvas-telemetry\.ts'/);
  assert.match(projector, /telemetry\?: CanvasTelemetryRecorder/);
  assert.doesNotMatch(projector, /createCanvasTelemetryRecorder/);
  for (const emission of projector.match(/telemetry(\?)?\.record/g) ?? []) {
    assert.equal(emission, 'telemetry?.record');
  }

  // The hook module itself exists as the WP01 baseline contract.
  const telemetry = await readSource('experience/canvas-telemetry.ts');
  assert.match(telemetry, /CANVAS_TELEMETRY_EVENT_KINDS/);
  assert.match(telemetry, /CANVAS_TELEMETRY_REJECTION_CODES/);
  assert.match(telemetry, /createCanvasTelemetryRecorder/);
  assert.match(telemetry, /FORBIDDEN_TELEMETRY_KEYS/);
});
