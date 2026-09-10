import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const runnerUrl = new URL('../../tools/workshop-spike/run-harness-mistral.mjs', import.meta.url);

test('gives sdk-minimal str_replace_editor the exact absolute probe path', async () => {
  const source = await readFile(runnerUrl, 'utf8');
  assert.match(source, /const probePath = join\(workspace, probeFile\);/);
  assert.match(source, /exact absolute path: \$\{probePath\}/);
  assert.match(source, /readFile\(probePath, 'utf8'\)/);
  assert.match(source, /str_replace_editor command view[^`]*\$\{probePath\}/);
  assert.doesNotMatch(source, /create \$\{probeFile\} in the current workspace/);
});
