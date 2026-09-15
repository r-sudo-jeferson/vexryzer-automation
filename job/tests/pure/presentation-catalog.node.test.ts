import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ARTIFACT_KINDS } from '../../src/experience/artifact-intent.ts';
import { ARTIFACT_SURFACE_REGISTRY } from '../../src/experience/artifact-registry.ts';
import { VISUAL_SCENE_COMPOSITIONS } from '../../src/ai/context/context-packager.ts';
import {
  PRESENTATION_CATALOG_VERSION,
  PRESENTATION_COMPONENT_CATALOG,
  PRESENTATION_MODEL_CATALOG,
  PRESENTATION_TOKEN_CATALOG,
  resolvePresentationComponent,
  resolvePresentationModel,
  resolvePresentationToken,
} from '../../src/experience/presentation-catalog.ts';

const here = path.dirname(fileURLToPath(import.meta.url));

test('WP04 token catalog matches tokens.css variable truth exactly', async () => {
  const css = await readFile(path.resolve(here, '../../src/design/tokens.css'), 'utf8');
  const cssVariables = new Set(css.match(/--vxa-[a-z0-9-]+/g) ?? []);
  assert.ok(cssVariables.size > 0);

  const catalogVariables = new Set(
    Object.values(PRESENTATION_TOKEN_CATALOG).map((descriptor) => descriptor.cssVariable),
  );
  assert.deepEqual(catalogVariables, cssVariables);

  for (const [id, descriptor] of Object.entries(PRESENTATION_TOKEN_CATALOG)) {
    assert.ok(Object.isFrozen(descriptor));
    assert.equal(descriptor.version, 1);
    assert.equal(descriptor.id, id);
    assert.equal(descriptor.cssVariable, `--vxa-${id.replace(/\./g, '-')}`);
    assert.equal(descriptor.group, id.split('.')[0]);
  }
  assert.ok(Object.isFrozen(PRESENTATION_TOKEN_CATALOG));
  assert.equal(PRESENTATION_CATALOG_VERSION, 1);
});

test('WP04 component catalog covers every renderable surface and node type', () => {
  const surfaceIds = new Set(
    (ARTIFACT_KINDS as readonly string[]).map((kind) => ARTIFACT_SURFACE_REGISTRY[kind as keyof typeof ARTIFACT_SURFACE_REGISTRY].surfaceId),
  );
  assert.equal(surfaceIds.size, ARTIFACT_KINDS.length);
  for (const surfaceId of surfaceIds) {
    const resolved = resolvePresentationComponent(surfaceId);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) continue;
    assert.equal(resolved.descriptor.kind, 'artifact-surface');
    assert.equal(resolved.descriptor.version, 1);
  }
  for (const nodeComponent of [
    'canvas-origin-node',
    'canvas-process-node',
    'canvas-value-proof-node',
    'canvas-opportunity-proof-node',
    'canvas-agent-presence-node',
  ]) {
    const resolved = resolvePresentationComponent(nodeComponent);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) continue;
    assert.equal(resolved.descriptor.kind, 'canvas-node');
  }
  assert.ok(Object.isFrozen(PRESENTATION_COMPONENT_CATALOG));
});

test('WP04 model catalog covers exactly the approved scene compositions', () => {
  assert.deepEqual(new Set(Object.keys(PRESENTATION_MODEL_CATALOG)), new Set(VISUAL_SCENE_COMPOSITIONS));
  for (const composition of VISUAL_SCENE_COMPOSITIONS) {
    const resolved = resolvePresentationModel(composition);
    assert.equal(resolved.ok, true);
    if (!resolved.ok) continue;
    assert.equal(resolved.descriptor.version, 1);
    assert.equal(resolved.descriptor.composition, composition);
  }
});

test('WP04 forged components, models, tokens and URLs miss the catalog fail-closed', () => {
  const tokenMiss = resolvePresentationToken('forged.token');
  assert.deepEqual(tokenMiss, { ok: false, code: 'CATALOG_MISS', path: 'catalog.tokens[forged.token]' });

  const componentMiss = resolvePresentationComponent('ForgedWidget');
  assert.deepEqual(componentMiss, { ok: false, code: 'CATALOG_MISS', path: 'catalog.components[ForgedWidget]' });

  const urlMiss = resolvePresentationComponent('https://evil.example/widget.js');
  assert.equal(urlMiss.ok, false);
  if (!urlMiss.ok) assert.equal(urlMiss.code, 'CATALOG_MISS');

  const modelMiss = resolvePresentationModel('cinematic');
  assert.deepEqual(modelMiss, { ok: false, code: 'CATALOG_MISS', path: 'catalog.models[composition]' });

  const caseMiss = resolvePresentationToken('Surface.Titanium');
  assert.equal(caseMiss.ok, false);
});
