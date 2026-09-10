import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const jobRoot = path.resolve(here, '../..');

async function source(relative: string): Promise<string> {
  return readFile(path.join(jobRoot, relative), 'utf8');
}

test('controlled React Flow selection is routed into authoritative focus state with keyboard auto-pan enabled', async () => {
  const canvas = await source('src/canvas/AutomationCanvas.tsx');
  assert.match(canvas, /onNodesChange=\{handleNodesChange\}/);
  assert.match(canvas, /change\.type === 'select'/);
  assert.match(canvas, /change\.selected/);
  assert.match(canvas, /autoPanOnNodeFocus/);
});

test('React Flow process-node focus visibly overrides vendor outline suppression', async () => {
  const css = await source('src/canvas/nodes/nodes.css');
  assert.match(css, /\.react-flow__node\.react-flow__node-process:focus-visible\s*\{/);
  assert.match(css, /outline:\s*2px solid var\(--vxa-focus-ring\)/);
});

test('process provenance remains textual across semantic zoom and is included in the accessible node name', async () => {
  const node = await source('src/canvas/nodes/ProcessNode.tsx');
  assert.match(node, /export function processNodeAccessibleLabel/);
  assert.match(node, /Proveniência:/);
  assert.match(node, /<span className="vxa-node__provenance">\{provenanceLabels\[model\.provenance\]\}<\/span>/);
  assert.doesNotMatch(node, /detail \? <span className="vxa-node__provenance"/);
});

test('origin CTA contrast is never attenuated by parent opacity animation', async () => {
  const app = await source('src/app/App.tsx');
  assert.doesNotMatch(app, /initial=\{\{\s*opacity:/);
  assert.doesNotMatch(app, /animate=\{\{\s*opacity:/);
});
