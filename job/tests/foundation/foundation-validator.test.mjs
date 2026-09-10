import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, cp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateRepository } from '../../scripts/validate-foundation.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtureSource = path.resolve(here, '../../..');

async function makeFixture() {
  const root = await mkdtemp(path.join(tmpdir(), 'vxa-foundation-'));
  await cp(fixtureSource, root, { recursive: true });
  return root;
}

async function write(root, relative, content) {
  const target = path.join(root, relative);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
}

function codes(result) {
  return new Set(result.errors.map((entry) => entry.code));
}

test('accepts the canonical repository fixture', async () => {
  const result = await validateRepository(fixtureSource);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
});

test('rejects product-bearing files at repository root', async () => {
  const root = await makeFixture();
  await write(root, 'package.json', '{"name":"forbidden-root-product"}\n');
  const result = await validateRepository(root);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('ROOT_BOUNDARY_VIOLATION'));
});

test('rejects the obsolete unestablished bootstrap SHA placeholder', async () => {
  const root = await makeFixture();
  const slicePath = path.join(root, 'job/docs/slices/VXA-S001-contract.md');
  const text = await (await import('node:fs/promises')).readFile(slicePath, 'utf8');
  await write(root, 'job/docs/slices/VXA-S001-contract.md', text.replace(/base_sha: `[^`]+`/, 'base_sha: `UNESTABLISHED_REPOSITORY_WAS_EMPTY_AT_PLANNING`'));
  const result = await validateRepository(root);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('BASE_SHA_UNESTABLISHED'));
});

test('rejects a binding mismatch in mandatory planning contracts', async () => {
  const root = await makeFixture();
  const target = path.join(root, 'job/docs/architecture/VXA-001-architecture.md');
  const text = await (await import('node:fs/promises')).readFile(target, 'utf8');
  await write(root, 'job/docs/architecture/VXA-001-architecture.md', text.replace('FORGE-VEXRYZER-AUTOMATION-v1.0.0', 'WRONG-BINDING'));
  const result = await validateRepository(root);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('BINDING_MISMATCH'));
});

test('accepts S001 authorization when an exact authorization record is present', async () => {
  const root = await makeFixture();
  const authorizedBase = 'd6a7e1d1994003dff1a9a6871fe1015a049ecdb8';
  const slicePath = path.join(root, 'job/docs/slices/VXA-S001-contract.md');
  const handoffPath = path.join(root, 'job/docs/handoffs/ENGINEERING-START.md');
  const slice = await (await import('node:fs/promises')).readFile(slicePath, 'utf8');
  const handoff = await (await import('node:fs/promises')).readFile(handoffPath, 'utf8');
  await write(root, 'job/docs/slices/VXA-S001-contract.md', slice
    .replace(/^status: `[^`]+`$/m, 'status: `IN_PROGRESS`')
    .replace(/base_sha: `[^`]+`/, `base_sha: \`${authorizedBase}\``));
  await write(root, 'job/docs/handoffs/ENGINEERING-START.md', handoff
    .replace(/^status: `[^`]+`$/m, 'status: `IN_PROGRESS`')
    .replace(/base_sha: `[^`]+`/, `base_sha: \`${authorizedBase}\``));
  await write(root, 'job/docs/authorizations/VXA-S001-AUTHORIZATION.md', `# VXA-S001 Authorization\n\nbinding_id: \`FORGE-VEXRYZER-AUTOMATION-v1.0.0\`\nslice_id: \`VXA-S001\`\nslice_version: \`1.0.0\`\nauthorized_base_sha: \`${authorizedBase}\`\nstatus: \`AUTHORIZED\`\n`);
  const result = await validateRepository(root);
  assert.equal(result.ok, true, JSON.stringify(result.errors, null, 2));
});

test('rejects S001 construction status without an authorization record', async () => {
  const root = await makeFixture();
  await rm(path.join(root, 'job/docs/authorizations/VXA-S001-AUTHORIZATION.md'));
  const result = await validateRepository(root);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('S001_AUTHORIZATION_RECORD_MISSING'));
});

test('rejects forbidden Machina dependencies in workflows', async () => {
  const root = await makeFixture();
  await write(root, '.github/workflows/forbidden.yml', 'steps:\n  - run: git clone https://github.com/r-sudo-jeferson/Machina.git\n');
  const result = await validateRepository(root);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('ISOLATION_DEPENDENCY_VIOLATION'));
});

test('rejects obvious committed credential patterns', async () => {
  const root = await makeFixture();
  const leaked = 'gh' + 'p_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890';
  await write(root, 'job/docs/leak.txt', `token=${leaked}\n`);
  const result = await validateRepository(root);
  assert.equal(result.ok, false);
  assert.ok(codes(result).has('CREDENTIAL_PATTERN_DETECTED'));
});
