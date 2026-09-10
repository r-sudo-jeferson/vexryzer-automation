import test from 'node:test';
import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '../../src');
const DIRECT_NETWORK_PATTERN = /\bfetch\s*\(|XMLHttpRequest|new\s+WebSocket\s*\(|new\s+EventSource\s*\(/;
const BROWSER_NETWORK_AUTHORITY_PATTERN = /\bfetch\b|XMLHttpRequest|\bWebSocket\b|\bEventSource\b/;

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

function sourcePath(file: string): string {
  return path.relative(srcRoot, file).split(path.sep).join('/');
}

test('S002 keeps browser network authority same-origin and provider egress server-only', async () => {
  const files = await walk(srcRoot);
  const sources = await Promise.all(files.map(async (file) => ({
    file,
    path: sourcePath(file),
    source: await readFile(file, 'utf8'),
  })));
  const joined = sources.map((item) => item.source).join('\n');

  // Global product-surface bans remain unchanged. The forbidden React sink token may
  // exist only inside the validator that rejects it; executable JSX usage remains forbidden.
  const dangerousSinkMentions = sources
    .filter((item) => item.source.includes('dangerouslySetInnerHTML'))
    .map((item) => item.path);
  assert.deepEqual(dangerousSinkMentions, ['experience/experience-validation.ts']);
  assert.doesNotMatch(joined, /dangerouslySetInnerHTML\s*=/);
  assert.doesNotMatch(joined, /VITE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)/);

  const browserSources = sources.filter((item) => !item.path.startsWith('server/'));
  assert.deepEqual(
    browserSources.filter((item) => DIRECT_NETWORK_PATTERN.test(item.source)).map((item) => item.path),
    [],
    'browser code must not acquire a direct arbitrary network primitive',
  );
  assert.deepEqual(
    browserSources.filter((item) => BROWSER_NETWORK_AUTHORITY_PATTERN.test(item.source)).map((item) => item.path),
    ['app/ask-ai-client.ts'],
    'only the dedicated ASK AI browser client may hold fetch authority',
  );

  const askAiClient = browserSources.find((item) => item.path === 'app/ask-ai-client.ts')?.source;
  assert.ok(askAiClient);
  const endpoints = [...askAiClient.matchAll(/fetchImpl\(\s*'([^']+)'/g)].map((match) => match[1]);
  assert.deepEqual(endpoints, [
    '/api/ask-ai/session',
    '/api/ask-ai',
    '/api/ask-ai/correction',
  ]);
  assert.equal((askAiClient.match(/credentials:\s*'same-origin'/g) ?? []).length, 3);
  assert.equal((askAiClient.match(/cache:\s*'no-store'/g) ?? []).length, 3);
  assert.doesNotMatch(askAiClient, /https?:\/\//i);
  assert.doesNotMatch(askAiClient, /XMLHttpRequest|\bWebSocket\b|\bEventSource\b/);

  const directServerEgress = sources
    .filter((item) => item.path.startsWith('server/') && DIRECT_NETWORK_PATTERN.test(item.source))
    .map((item) => item.path);
  assert.deepEqual(
    directServerEgress,
    ['server/ai/providers/provider-chat-client.ts'],
    'provider HTTP egress must remain isolated to the server provider transport',
  );
});
