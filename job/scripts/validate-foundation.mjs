import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BINDING = 'FORGE-VEXRYZER-AUTOMATION-v1.0.0';
const CI_EXECUTION_POLICY_MARKER = 'CI_EXECUTION_POLICY: `OPTIMIZED_GATES_ONLY`';
const PLANNING_STATUS = 'PLANNED_NOT_AUTHORIZED';
const CONSTRUCTION_STATUSES = new Set(['AUTHORIZED', 'IN_PROGRESS', 'PASS']);
const AUTHORIZATION_FILE = 'job/docs/authorizations/VXA-S001-AUTHORIZATION.md';
const FORBIDDEN_REPOS = ['r-sudo-jeferson/Machina', 'machina-group/machina'];
const ALLOWED_ROOT_ENTRIES = new Set(['AGENTS.md', 'README.md', 'job', '.github', '.gitignore']);
const REQUIRED_FILES = [
  'AGENTS.md',
  'README.md',
  'job/docs/product/VXA-001-product-contract.md',
  'job/docs/architecture/VXA-001-architecture.md',
  'job/docs/slices/VXA-slice-map.md',
  'job/docs/slices/VXA-S001-contract.md',
  'job/docs/gauntlets/GNT-VXA-S001-001.md',
  'job/docs/handoffs/ENGINEERING-START.md',
  'job/docs/superpowers/specs/2026-09-09-vexryzer-automation-design.md',
  'job/docs/superpowers/plans/2026-09-09-vxa-s001-implementation-plan.md',
  'job/docs/foundation/VXA-FOUNDATION-001.md',
];

function error(code, message, file = null) {
  return { code, message, file };
}

async function exists(target) {
  try {
    await lstat(target);
    return true;
  } catch (err) {
    if (err?.code === 'ENOENT') return false;
    throw err;
  }
}

async function walkFiles(root, relative = '') {
  const absolute = path.join(root, relative);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, child));
    else if (entry.isFile()) files.push(child.replaceAll(path.sep, '/'));
  }
  return files;
}

async function read(root, relative) {
  return readFile(path.join(root, relative), 'utf8');
}

function extractBacktickedField(text, name) {
  const match = text.match(new RegExp('^' + name + ': `([^`]+)`$', 'm'));
  return match?.[1] ?? null;
}

function extractPlainOrBacktickedStatus(text) {
  return text.match(/^status:\s*`?([^`\n]+)`?$/m)?.[1]?.trim() ?? null;
}

function isSha(value) {
  return /^[0-9a-f]{40}$/i.test(value ?? '');
}

function isDependencySurface(file) {
  return file === '.gitmodules'
    || file.startsWith('.github/workflows/')
    || /(^|\/)(package\.json|pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(file);
}

const credentialPatterns = [
  /ghp_[A-Za-z0-9]{30,}/g,
  /github_pat_[A-Za-z0-9_]{40,}/g,
  /sk-[A-Za-z0-9_-]{20,}/g,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

export async function validateRepository(root) {
  const errors = [];
  const rootEntries = await readdir(root, { withFileTypes: true });

  for (const entry of rootEntries) {
    if (entry.name === '.git') continue;
    if (!ALLOWED_ROOT_ENTRIES.has(entry.name)) {
      errors.push(error('ROOT_BOUNDARY_VIOLATION', `Top-level entry is not permitted: ${entry.name}`, entry.name));
    }
  }

  for (const file of REQUIRED_FILES) {
    if (!await exists(path.join(root, file))) {
      errors.push(error('REQUIRED_FILE_MISSING', `Required foundation file is missing: ${file}`, file));
    }
  }

  const agentsFile = 'AGENTS.md';
  if (await exists(path.join(root, agentsFile))) {
    const agents = await read(root, agentsFile);
    if (!agents.includes(CI_EXECUTION_POLICY_MARKER)) {
      errors.push(error('CI_EXECUTION_POLICY_MISSING', 'AGENTS.md must retain the optimized remote CI execution policy marker.', agentsFile));
    }
  }

  const requiredReadable = [];
  for (const file of REQUIRED_FILES) {
    if (await exists(path.join(root, file))) requiredReadable.push(file);
  }
  for (const file of requiredReadable) {
    const text = await read(root, file);
    if (!text.includes(BINDING)) {
      errors.push(error('BINDING_MISMATCH', `Required file does not carry canonical binding ${BINDING}`, file));
    }
  }

  const sliceFile = 'job/docs/slices/VXA-S001-contract.md';
  if (await exists(path.join(root, sliceFile))) {
    const slice = await read(root, sliceFile);
    const baseSha = extractBacktickedField(slice, 'base_sha');
    const status = extractPlainOrBacktickedStatus(slice);
    if (baseSha === 'UNESTABLISHED_REPOSITORY_WAS_EMPTY_AT_PLANNING' || !isSha(baseSha)) {
      errors.push(error('BASE_SHA_UNESTABLISHED', 'S001 base_sha must be an exact 40-hex bootstrap SHA before hardening can pass.', sliceFile));
    }
    if (status !== PLANNING_STATUS && !CONSTRUCTION_STATUSES.has(status)) {
      errors.push(error('S001_STATUS_INVALID', `Unsupported S001 status: ${status ?? 'missing'}.`, sliceFile));
    }

    if (CONSTRUCTION_STATUSES.has(status)) {
      if (!await exists(path.join(root, AUTHORIZATION_FILE))) {
        errors.push(error('S001_AUTHORIZATION_RECORD_MISSING', 'S001 construction status requires an explicit authorization record.', AUTHORIZATION_FILE));
      } else {
        const authorization = await read(root, AUTHORIZATION_FILE);
        const authorizedBaseSha = extractBacktickedField(authorization, 'authorized_base_sha');
        const authorizedSliceId = extractBacktickedField(authorization, 'slice_id');
        const authorizedSliceVersion = extractBacktickedField(authorization, 'slice_version');
        const authorizationStatus = extractPlainOrBacktickedStatus(authorization);
        if (!authorization.includes(BINDING)) {
          errors.push(error('AUTHORIZATION_BINDING_MISMATCH', `Authorization record does not carry canonical binding ${BINDING}.`, AUTHORIZATION_FILE));
        }
        if (authorizedSliceId !== 'VXA-S001' || authorizedSliceVersion !== '1.0.0') {
          errors.push(error('AUTHORIZATION_SLICE_MISMATCH', 'Authorization record must target VXA-S001@1.0.0.', AUTHORIZATION_FILE));
        }
        if (!isSha(authorizedBaseSha) || authorizedBaseSha !== baseSha) {
          errors.push(error('AUTHORIZATION_BASE_SHA_MISMATCH', 'Authorization base SHA must be an exact SHA matching the S001 contract base_sha.', AUTHORIZATION_FILE));
        }
        if (authorizationStatus !== 'AUTHORIZED') {
          errors.push(error('AUTHORIZATION_STATUS_INVALID', 'Authorization record status must be AUTHORIZED.', AUTHORIZATION_FILE));
        }
      }
    }
  }

  const handoffFile = 'job/docs/handoffs/ENGINEERING-START.md';
  if (await exists(path.join(root, handoffFile)) && await exists(path.join(root, sliceFile))) {
    const handoff = await read(root, handoffFile);
    const slice = await read(root, sliceFile);
    const handoffSha = extractBacktickedField(handoff, 'base_sha');
    const sliceSha = extractBacktickedField(slice, 'base_sha');
    if (!isSha(handoffSha) || handoffSha !== sliceSha) {
      errors.push(error('BASE_SHA_MISMATCH', 'Engineering handoff base_sha must exactly match the S001 base_sha.', handoffFile));
    }
    const sliceStatus = extractPlainOrBacktickedStatus(slice);
    const handoffStatus = extractPlainOrBacktickedStatus(handoff);
    if (handoffStatus !== sliceStatus) {
      errors.push(error('HANDOFF_STATUS_MISMATCH', `Engineering handoff status must exactly match S001 status ${sliceStatus ?? 'missing'}.`, handoffFile));
    }
  }

  const allFiles = await walkFiles(root);
  for (const file of allFiles) {
    let text;
    try {
      text = await read(root, file);
    } catch {
      continue;
    }

    if (isDependencySurface(file)) {
      for (const forbidden of FORBIDDEN_REPOS) {
        if (text.toLowerCase().includes(forbidden.toLowerCase())) {
          errors.push(error('ISOLATION_DEPENDENCY_VIOLATION', `Forbidden Machina dependency reference detected in dependency surface: ${forbidden}`, file));
        }
      }
    }

    for (const pattern of credentialPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(text)) {
        errors.push(error('CREDENTIAL_PATTERN_DETECTED', 'Possible committed credential/private key pattern detected.', file));
        break;
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

function format(result) {
  if (result.ok) return 'VXA foundation validation: PASS';
  return ['VXA foundation validation: FAIL', ...result.errors.map((e) => `- [${e.code}] ${e.file ? `${e.file}: ` : ''}${e.message}`)].join('\n');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  const root = path.resolve(process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '../..'));
  const result = await validateRepository(root);
  console.log(format(result));
  process.exitCode = result.ok ? 0 : 1;
}
