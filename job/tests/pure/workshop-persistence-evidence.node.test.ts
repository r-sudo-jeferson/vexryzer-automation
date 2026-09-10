import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectSessionPersistence } from '../../tools/workshop-spike/persistence-evidence.ts';

test('reports only bounded marker facts from nested JSONL session persistence', async () => {
  const root = await mkdtemp(join(tmpdir(), 'vxa-s002-persistence-evidence-'));
  const marker = 'VXA-S002-NONCE-test-marker';
  try {
    const nested = join(root, 'project');
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, 'generation-0.jsonl'), `${JSON.stringify({ event: 'safe-before' })}\n${JSON.stringify({ marker })}\n`);
    await writeFile(join(nested, 'ignored.txt'), marker);

    const evidence = await inspectSessionPersistence(root, marker);
    assert.equal(evidence.jsonlFileCount, 1);
    assert.equal(evidence.markerFileCount, 1);
    assert.equal(evidence.containsMarker, true);
    assert.ok(evidence.scannedBytes > 0);
    assert.equal(JSON.stringify(evidence).includes(marker), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('returns zero evidence when the Harness sessions root does not exist', async () => {
  const root = join(tmpdir(), `vxa-s002-missing-${Date.now()}-${Math.random()}`);
  assert.deepEqual(await inspectSessionPersistence(root, 'marker'), {
    jsonlFileCount: 0,
    scannedBytes: 0,
    markerFileCount: 0,
    containsMarker: false,
  });
});

test('rejects empty roots and markers before filesystem traversal', async () => {
  await assert.rejects(() => inspectSessionPersistence('', 'marker'), /root must not be empty/i);
  await assert.rejects(() => inspectSessionPersistence('/tmp', ''), /marker must not be empty/i);
});
