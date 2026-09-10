import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../src/app');
const read = (name: string) => readFile(path.join(srcRoot, name), 'utf8');
test('public experience does not expose engineering checkpoint or infrastructure copy', async () => {
  const app = await read('App.tsx');
  const errorBoundary = await read('ErrorBoundary.tsx');
  const publicCopy = `${app}\n${errorBoundary}`;
  assert.doesNotMatch(publicCopy, /\bS001\b|VISUAL FOUNDATION|FREE-TIER ARCHITECTURE|nenhum dado é enviado nesta Slice|VXA \/ RECOVERY/i);
});
test('skip-link target is programmatically focusable', async () => {
  const app = await read('App.tsx');
  assert.match(app, /<main\s+id="vxa-primary"\s+className="vxa-main"\s+tabIndex=\{-1\}>/);
});
