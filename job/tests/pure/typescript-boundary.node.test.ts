import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

interface TsConfig {
  compilerOptions?: {
    strict?: boolean;
    skipLibCheck?: boolean;
    exactOptionalPropertyTypes?: boolean;
    noUncheckedIndexedAccess?: boolean;
    lib?: string[];
  };
  include?: string[];
}

interface PackageManifest {
  devDependencies?: Record<string, string>;
}

async function json<T>(relative: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, relative), 'utf8')) as T;
}

test('strict project checks own code exactly while treating third-party declarations as an upstream boundary', async () => {
  for (const file of ['tsconfig.app.json', 'tsconfig.node.json', 'tsconfig.e2e.json']) {
    const config = await json<TsConfig>(file);
    assert.equal(config.compilerOptions?.strict, true, `${file} must remain strict`);
    assert.equal(config.compilerOptions?.exactOptionalPropertyTypes, true, `${file} must keep exact optional checking`);
    assert.equal(config.compilerOptions?.noUncheckedIndexedAccess, true, `${file} must keep unchecked-index protection`);
    assert.equal(config.compilerOptions?.skipLibCheck, true, `${file} must not re-typecheck incompatible vendor .d.ts internals`);
  }
});

test('test stack avoids redundant jest-dom augmentation and shares the performance probe window contract', async () => {
  const pkg = await json<PackageManifest>('package.json');
  assert.equal(pkg.devDependencies?.['@testing-library/jest-dom'], undefined);
  await access(path.join(root, 'src/performance/performance-probe.d.ts'));
  const e2e = await json<TsConfig>('tsconfig.e2e.json');
  assert.ok(e2e.include?.includes('src/performance/performance-probe.d.ts'));
});

test('node tooling config exposes DOM timing primitives required by Vitest dependencies', async () => {
  const node = await json<TsConfig>('tsconfig.node.json');
  assert.ok(node.compilerOptions?.lib?.includes('DOM'));
});
