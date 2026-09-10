import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../src');

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target));
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(target);
  }
  return files;
}

test('S001 browser runtime has no external/network production path or raw HTML injection', async () => {
  const sources = await Promise.all((await walk(srcRoot)).map((file) => readFile(file, 'utf8')));
  const joined = sources.join('\n');
  assert.doesNotMatch(joined, /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket\s*\(|new\s+EventSource\s*\(/);
  assert.doesNotMatch(joined, /dangerouslySetInnerHTML/);
  assert.doesNotMatch(joined, /VITE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)/);
});
