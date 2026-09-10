import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const workflow = await readFile(path.resolve(here, '../../.github/workflows/s001-hosted-diagnostic.yml'), 'utf8');

test('hosted S001 gate pins every action to an immutable commit and uses the pnpm 11 native setup path', () => {
  const actions = [...workflow.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]!);
  assert.ok(actions.length >= 4, 'diagnostic workflow should expose its action supply-chain surface');
  for (const action of actions) assert.match(action, /@[0-9a-f]{40}$/i, `action must be SHA-pinned: ${action}`);
  assert.match(workflow, /pnpm\/setup@[0-9a-f]{40}/i);
  assert.doesNotMatch(workflow, /pnpm\/action-setup@/i);
  assert.doesNotMatch(workflow, /actions\/setup-node@/i);
});

test('write permission remains isolated to lockfile capture after validation', () => {
  const [readOnlyPart, capturePart] = workflow.split(/\n\s{2}capture-lockfile:\s*\n/);
  assert.ok(readOnlyPart && capturePart, 'capture-lockfile job must be isolated');
  assert.match(readOnlyPart, /permissions:\s*\n\s+contents:\s*read/);
  assert.doesNotMatch(readOnlyPart, /contents:\s*write/);
  assert.match(capturePart, /permissions:\s*\n\s+contents:\s*write/);
  assert.match(capturePart, /needs:\s*s001-hosted-diagnostic/);
});
