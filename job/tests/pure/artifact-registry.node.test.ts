import test from 'node:test';
import assert from 'node:assert/strict';
import { ARTIFACT_SURFACE_REGISTRY, resolveArtifactSurface } from '../../src/experience/artifact-registry.ts';

const expectedKinds = [
  'operational_object', 'data_import_preview', 'presentation', 'bi_dashboard', 'training_module', 'workflow_concept', 'prototype',
] as const;

test('application-owned artifact registry covers every authorized S002 artifact kind', () => {
  assert.deepEqual(Object.keys(ARTIFACT_SURFACE_REGISTRY).sort(), [...expectedKinds].sort());
  for (const kind of expectedKinds) {
    const surface = resolveArtifactSurface(kind);
    assert.equal(surface.kind, kind);
    assert.match(surface.surfaceId, /^artifact-[a-z0-9-]+$/);
    assert.ok(surface.landmarkLabel.length > 0);
    assert.ok(surface.description.length > 0);
  }
});

test('artifact registry contains semantic application identifiers, never executable module/component/url authority', () => {
  const serialized = JSON.stringify(ARTIFACT_SURFACE_REGISTRY).toLowerCase();
  for (const forbidden of ['http://', 'https://', 'javascript:', '.tsx', '.jsx', 'modulepath', 'componentpath', 'import(']) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
