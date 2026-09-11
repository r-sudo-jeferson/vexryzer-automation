import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const jobRoot = path.resolve(here, '../..');

async function text(relative: string) {
  return readFile(path.join(jobRoot, relative), 'utf8');
}

test('product package pins the approved S001 runtime and test stack', async () => {
  const pkg = JSON.parse(await text('package.json')) as {
    packageManager?: string;
    engines?: { node?: string };
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };

  assert.equal(pkg.packageManager, 'pnpm@11.25.0');
  assert.equal(pkg.engines?.node, '>=24 <25');
  assert.equal(pkg.dependencies?.react, '19.2.8');
  assert.equal(pkg.dependencies?.['react-dom'], '19.2.8');
  assert.equal(pkg.dependencies?.['@xyflow/react'], '12.11.6');
  assert.equal(pkg.dependencies?.motion, '13.1.1');
  assert.equal(pkg.dependencies?.xstate, '5.32.5');
  assert.equal(pkg.dependencies?.['@xstate/react'], '6.1.0');
  for (const script of ['build', 'typecheck', 'test', 'test:pure', 'test:unit', 'test:e2e', 'test:a11y']) {
    assert.ok(pkg.scripts?.[script], `missing script ${script}`);
  }
});

test('strict TypeScript and Netlify configuration live under job', async () => {
  const tsconfig = JSON.parse(await text('tsconfig.app.json')) as { compilerOptions?: Record<string, unknown> };
  assert.equal(tsconfig.compilerOptions?.strict, true);
  assert.equal(tsconfig.compilerOptions?.noUncheckedIndexedAccess, true);
  assert.equal(tsconfig.compilerOptions?.exactOptionalPropertyTypes, true);

  const netlify = await text('netlify.toml');
  assert.match(netlify, /command\s*=\s*"pnpm build"/);
  assert.match(netlify, /publish\s*=\s*"dist"/);
});

test('browser build has no client-visible secret contract', async () => {
  const vite = await text('vite.config.ts');
  assert.doesNotMatch(vite, /VITE_.*(?:KEY|TOKEN|SECRET)/i);
  const source = await text('src/server/netlify/ask-ai-netlify-runtime.ts');
  assert.doesNotMatch(source, /VITE_/);
});
