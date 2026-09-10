import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CREDENTIAL_RULES } from './security-patterns.mjs';

const TEXT_EXTENSIONS = new Set(['.html', '.js', '.mjs', '.cjs', '.css', '.json']);

const RULES = Object.freeze([
  { id: 'provider-mistral', pattern: /\bmistral\b/i },
  { id: 'provider-anthropic', pattern: /\banthropic\b/i },
  { id: 'provider-openai', pattern: /\bopenai\b/i },
  ...CREDENTIAL_RULES,
  { id: 'client-secret-contract', pattern: /VITE_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)/ },
]);

async function walk(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walk(root, child));
    else if (entry.isFile() && TEXT_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) files.push(child);
  }
  return files;
}

export async function scanProductionBundle(root) {
  const stat = await lstat(root);
  if (!stat.isDirectory()) throw new TypeError('bundle root must be a directory');

  const findings = [];
  for (const relative of await walk(root)) {
    const content = await readFile(path.join(root, relative), 'utf8');
    for (const rule of RULES) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(content)) findings.push({ rule: rule.id, file: relative.replaceAll(path.sep, '/') });
    }
  }
  return findings;
}

function formatFinding(finding) {
  return `- [${finding.rule}] ${finding.file}`;
}

async function main() {
  const root = path.resolve(process.argv[2] ?? 'dist');
  const findings = await scanProductionBundle(root);
  if (findings.length === 0) {
    console.log(`VXA production bundle scan: PASS (${root})`);
    return;
  }
  console.error('VXA production bundle scan: FAIL');
  for (const finding of findings) console.error(formatFinding(finding));
  process.exitCode = 1;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`VXA production bundle scan: ERROR (${error instanceof Error ? error.name : 'UnknownError'})`);
    process.exitCode = 2;
  });
}
