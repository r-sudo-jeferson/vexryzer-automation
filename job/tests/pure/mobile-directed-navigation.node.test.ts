import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const cssPath = path.resolve(here, '../../src/app/app.css');
test('mobile directed process navigation is vertical and never requires horizontal step scrolling', async () => {
  const css = await readFile(cssPath, 'utf8');
  assert.doesNotMatch(css, /\.vxa-director__steps\s*\{[^}]*overflow-x:\s*auto/);
  assert.match(css, /@media \(max-width: 980px\)[\s\S]*\.vxa-director__steps\s*\{[^}]*display:\s*grid[^}]*overflow-y:\s*auto[^}]*overflow-x:\s*hidden/);
});
