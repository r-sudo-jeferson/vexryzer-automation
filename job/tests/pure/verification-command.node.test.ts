import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(await readFile(path.resolve(here, '../../package.json'), 'utf8')) as { scripts?: Record<string, string> };

test('single verification command includes foundation and visual gates without duplicating visual projects', () => {
  const verify = pkg.scripts?.verify ?? '';
  assert.match(verify, /verify:foundation/);
  assert.match(verify, /verify:bundle/);
  assert.match(pkg.scripts?.['verify:bundle'] ?? '', /scan-production-bundle\.mjs dist/);
  assert.match(verify, /test:visual/);
  assert.match(pkg.scripts?.['test:visual'] ?? '', /--project=chromium-desktop/);
});
