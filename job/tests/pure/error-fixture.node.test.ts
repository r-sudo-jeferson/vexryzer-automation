import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = await readFile(path.resolve(here, '../../src/app/App.tsx'), 'utf8');

test('the visual GAUNTLET can deterministically exercise the real error boundary', () => {
  assert.match(app, /value\s*===\s*['\"]error['\"][\s\S]*throw\s+new\s+Error\(['\"]Visual recovery fixture['\"]\)/);
});
