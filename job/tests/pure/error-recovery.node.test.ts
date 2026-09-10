import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const boundary = await readFile(path.resolve(here, '../../src/app/ErrorBoundary.tsx'), 'utf8');

test('error recovery clears adversarial fixture state instead of reloading into the same failure', () => {
  assert.doesNotMatch(boundary, /window\.location\.reload\s*\(/);
  assert.match(boundary, /window\.location\.replace\s*\(window\.location\.pathname\)/);
});
