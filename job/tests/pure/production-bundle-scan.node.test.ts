import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const scanner = path.join(root, 'scripts/scan-production-bundle.mjs');

async function withBundle(files: Record<string, string>, run: (dir: string) => void | Promise<void>): Promise<void> {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'vxa-bundle-scan-'));
  try {
    for (const [relative, content] of Object.entries(files)) {
      const file = path.join(dir, relative);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, content, 'utf8');
    }
    await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function scan(dir: string) {
  return spawnSync(process.execPath, [scanner, dir], { encoding: 'utf8' });
}

test('safe minified CSS and React Flow metadata do not trigger provider or credential findings', async () => {
  await withBundle({
    'assets/index.css': '.x{mask-image:linear-gradient(#000,#0000);box-shadow:0 0 2px #000}',
    'assets/index.js': 'const attribution="https://reactflow.dev/";const label="process intelligence";',
  }, (dir) => {
    const result = scan(dir);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /PASS/);
  });
});

test('provider identifiers are rejected with named findings but without dumping bundle lines', async () => {
  await withBundle({ 'assets/index.js': 'const provider = "OpenAI"; const unrelated = "safe";' }, (dir) => {
    const result = scan(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /provider-openai/i);
    assert.match(result.stderr, /assets\/index\.js/);
    assert.doesNotMatch(result.stderr, /const provider/);
  });
});

test('credential-like values are rejected without echoing the secret value', async () => {
  const secret = `sk-${'A'.repeat(32)}`;
  await withBundle({ 'assets/index.js': `window.token=${JSON.stringify(secret)};` }, (dir) => {
    const result = scan(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /credential-openai-style/i);
    assert.doesNotMatch(result.stderr, new RegExp(secret));
  });
});

test('Vite client secret contracts are rejected even when no concrete secret is present', async () => {
  await withBundle({ 'assets/index.js': 'const name="VITE_VENDOR_SECRET";' }, (dir) => {
    const result = scan(dir);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /client-secret-contract/i);
  });
});
