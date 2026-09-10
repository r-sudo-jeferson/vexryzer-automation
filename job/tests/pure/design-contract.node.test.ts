import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

async function css(file: string) {
  return readFile(path.join(root, file), 'utf8');
}

test('design tokens expose the required premium semantic surfaces', async () => {
  const tokens = await css('src/design/tokens.css');
  for (const token of [
    '--vxa-bg-void', '--vxa-surface-titanium', '--vxa-surface-graphite', '--vxa-text-platinum',
    '--vxa-text-muted', '--vxa-border-subtle', '--vxa-focus-ring', '--vxa-accent-intelligence',
    '--vxa-accent-success', '--vxa-space-4', '--vxa-radius-panel', '--vxa-shadow-float',
    '--vxa-motion-camera', '--vxa-font-sans', '--vxa-font-display',
  ]) assert.match(tokens, new RegExp(`${token}\\s*:`), `missing token ${token}`);
});

test('global styles preserve visible focus and reduced-motion equivalence', async () => {
  const global = await css('src/design/global.css');
  assert.match(global, /:focus-visible/);
  assert.match(global, /prefers-reduced-motion:\s*reduce/);
  assert.doesNotMatch(global, /outline:\s*none(?![^}]*:focus-visible)/);
});
