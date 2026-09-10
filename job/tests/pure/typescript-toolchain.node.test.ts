import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');

interface CompilerOptions {
  strict?: boolean;
  skipLibCheck?: boolean;
  exactOptionalPropertyTypes?: boolean;
  allowImportingTsExtensions?: boolean;
}

interface TsConfig {
  compilerOptions: CompilerOptions;
  include?: string[];
  references?: Array<{ path?: string }>;
}

interface PackageManifest {
  devDependencies: Record<string, string>;
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, file), 'utf8')) as T;
}

test('TypeScript toolchain uses the mature 5.9.3 compiler without weakening source strictness', async () => {
  const pkg = await readJson<PackageManifest>('package.json');
  const app = await readJson<TsConfig>('tsconfig.app.json');
  const node = await readJson<TsConfig>('tsconfig.node.json');
  assert.equal(pkg.devDependencies.typescript, '5.9.3');
  for (const config of [app, node]) {
    assert.equal(config.compilerOptions.strict, true);
    assert.equal(config.compilerOptions.skipLibCheck, true);
    assert.equal(config.compilerOptions.exactOptionalPropertyTypes, true);
  }
  assert.equal(app.compilerOptions.allowImportingTsExtensions, true);
  assert.ok(app.include?.includes('tests/setup.ts'));
});

test('Playwright/browser typing is isolated in an explicit DOM-aware project', async () => {
  const rootConfig = await readJson<TsConfig>('tsconfig.json');
  const node = await readJson<TsConfig>('tsconfig.node.json');
  await access(path.join(root, 'tsconfig.e2e.json'));
  assert.equal(node.include?.includes('playwright.config.ts'), false);
  assert.ok(rootConfig.references?.some((entry) => entry.path === './tsconfig.e2e.json'));
});
