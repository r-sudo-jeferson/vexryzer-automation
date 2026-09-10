import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const workflowsRoot = path.resolve(here, '../../../.github/workflows');
const hostedWorkflow = await readFile(path.join(workflowsRoot, 's001-hosted-diagnostic.yml'), 'utf8');

function actionRefs(workflow: string): string[] {
  return [...workflow.matchAll(/uses:\s*([^\s#]+)/g)].map((match) => match[1]!);
}

test('every executable GitHub Actions workflow pins third-party actions to immutable commits', async () => {
  const workflowFiles = (await readdir(workflowsRoot))
    .filter((file) => /\.ya?ml$/i.test(file))
    .sort();
  assert.ok(workflowFiles.length >= 2, 'expected foundation and S001 workflow surfaces');

  for (const file of workflowFiles) {
    const workflow = await readFile(path.join(workflowsRoot, file), 'utf8');
    const actions = actionRefs(workflow);
    assert.ok(actions.length > 0, `${file} should expose at least one third-party action`);
    for (const action of actions) {
      assert.match(action, /@[0-9a-f]{40}$/i, `${file}: action must be SHA-pinned: ${action}`);
    }
  }
});

test('hosted S001 gate uses the pnpm 11 native setup path', () => {
  const actions = actionRefs(hostedWorkflow);
  assert.ok(actions.length >= 4, 'diagnostic workflow should expose its action supply-chain surface');
  assert.match(hostedWorkflow, /pnpm\/setup@[0-9a-f]{40}/i);
  assert.doesNotMatch(hostedWorkflow, /pnpm\/action-setup@/i);
  assert.doesNotMatch(hostedWorkflow, /actions\/setup-node@/i);
});

test('write permission remains isolated to lockfile capture after validation', () => {
  const [readOnlyPart, capturePart] = hostedWorkflow.split(/\n\s{2}capture-lockfile:\s*\n/);
  assert.ok(readOnlyPart && capturePart, 'capture-lockfile job must be isolated');
  assert.match(readOnlyPart, /permissions:\s*\n\s+contents:\s*read/);
  assert.doesNotMatch(readOnlyPart, /contents:\s*write/);
  assert.match(capturePart, /permissions:\s*\n\s+contents:\s*write/);
  assert.match(capturePart, /needs:\s*s001-hosted-diagnostic/);
});
