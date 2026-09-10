import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  OPENCODE_CREDENTIAL_REF,
  OPENCODE_MODEL_ID,
  OPENCODE_PROVIDER_ID,
  OPENCODE_VERSION,
  buildOpenCodeRuntimeEnv,
  renderOpenCodeConfig,
  renderOpenCodeInstallPackageJson,
  renderOpenCodeInstallWorkspaceYaml,
} from './opencode-config.ts';
import {
  inspectOpenCodeEvents,
  parseOpenCodeJsonEvents,
  sanitizeOpenCodeDiagnostic,
} from './opencode-evidence.ts';
import { assertSpikeNodeVersion, assertSpikePnpmVersion, buildPackageInstallEnv } from './spike-config.ts';

const NORMAL_TURN_WALL_MS = 180_000;
const TIMEOUT_PROBE_WALL_MS = 50;
const MAX_STDOUT_BYTES = 2_000_000;
const MAX_STDERR_BYTES = 128_000;
const FILE_TOOL_NAMES = new Set(['write', 'edit']);
let currentPhase = 'preflight';

class OpenCodeSubprocessError extends Error {
  constructor(message) {
    super(message);
    this.name = 'OpenCodeSubprocessError';
  }
}

class OpenCodeCompatibilityError extends Error {
  constructor(message, evidence = {}) {
    super(message);
    this.name = 'OpenCodeCompatibilityError';
    this.evidence = evidence;
  }
}

function boundedAppend(current, chunk, maxBytes) {
  const next = current + chunk;
  if (Buffer.byteLength(next, 'utf8') > maxBytes) return null;
  return next;
}

function runProcess(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let overflow = false;
    let settled = false;
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, options.wallMs);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => {
      const next = boundedAppend(stdout, chunk, options.maxStdoutBytes ?? MAX_STDOUT_BYTES);
      if (next === null) {
        overflow = true;
        child.kill('SIGTERM');
        return;
      }
      stdout = next;
    });
    child.stderr.on('data', (chunk) => {
      const next = boundedAppend(stderr, chunk, options.maxStderrBytes ?? MAX_STDERR_BYTES);
      if (next === null) {
        overflow = true;
        child.kill('SIGTERM');
        return;
      }
      stderr = next;
    });
    child.once('error', (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once('close', (code, signal) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code, signal, stdout, stderr, timedOut, overflow });
    });
  });
}

function requireSuccessfulProcess(label, result, secretValues = []) {
  if (result.overflow) throw new OpenCodeSubprocessError(`${label} exceeded bounded output limits`);
  if (result.timedOut) throw new OpenCodeSubprocessError(`${label} exceeded wall-clock budget`);
  if (result.code !== 0) {
    const diagnostic = sanitizeOpenCodeDiagnostic([result.stdout, result.stderr].filter(Boolean).join('\n'), secretValues);
    throw new OpenCodeSubprocessError(`${label} exited with code ${String(result.code)}${diagnostic ? `: ${diagnostic}` : ''}`);
  }
  return result;
}

async function bootstrapOpenCodeRuntime(rootDir) {
  const runtimeDir = join(rootDir, 'runtime');
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(join(runtimeDir, 'package.json'), renderOpenCodeInstallPackageJson());
  await writeFile(join(runtimeDir, 'pnpm-workspace.yaml'), renderOpenCodeInstallWorkspaceYaml());
  const installEnv = buildPackageInstallEnv(process.env);
  const pnpm = process.env.VXA_PNPM_BIN?.trim() || 'pnpm';

  currentPhase = 'opencode-pnpm-version';
  const pnpmVersion = requireSuccessfulProcess('pnpm version check', await runProcess(pnpm, ['--version'], {
    cwd: runtimeDir, env: installEnv, wallMs: 15_000,
  }));
  assertSpikePnpmVersion(pnpmVersion.stdout);

  currentPhase = 'opencode-package-install';
  requireSuccessfulProcess('OpenCode package install', await runProcess(pnpm, ['install', '--frozen-lockfile=false'], {
    cwd: runtimeDir, env: installEnv, wallMs: 180_000, maxStdoutBytes: 1_000_000, maxStderrBytes: 256_000,
  }));

  currentPhase = 'opencode-package-verify';
  const manifest = JSON.parse(await readFile(join(runtimeDir, 'node_modules', 'opencode-ai', 'package.json'), 'utf8'));
  if (manifest.version !== OPENCODE_VERSION) {
    throw new OpenCodeSubprocessError(`OpenCode package version mismatch: expected ${OPENCODE_VERSION}, got ${String(manifest.version)}`);
  }
  const bin = join(runtimeDir, 'node_modules', '.bin', 'opencode');
  const version = requireSuccessfulProcess('OpenCode binary version check', await runProcess(bin, ['--version'], {
    cwd: runtimeDir, env: installEnv, wallMs: 15_000,
  }));
  if (version.stdout.trim() !== OPENCODE_VERSION) {
    throw new OpenCodeSubprocessError(`OpenCode binary version mismatch: expected ${OPENCODE_VERSION}, got ${version.stdout.trim()}`);
  }
  return { bin };
}

async function createRuntimeState(rootDir) {
  const stateRoot = join(rootDir, 'state');
  const workspace = join(rootDir, 'workspace');
  const configPath = join(stateRoot, 'opencode.json');
  for (const path of [
    workspace,
    stateRoot,
    join(stateRoot, 'home'),
    join(stateRoot, 'xdg-config'),
    join(stateRoot, 'xdg-data'),
    join(stateRoot, 'xdg-cache'),
    join(stateRoot, 'config-dir'),
    join(stateRoot, 'tmp'),
  ]) await mkdir(path, { recursive: true });

  await writeFile(configPath, renderOpenCodeConfig({
    modelId: OPENCODE_MODEL_ID,
    credentialRef: OPENCODE_CREDENTIAL_REF,
  }), { mode: 0o600 });
  const credentialValue = process.env.GROQ_API_KEY?.trim();
  if (!credentialValue) throw new OpenCodeSubprocessError('GROQ_API_KEY is required');
  const env = buildOpenCodeRuntimeEnv(process.env, {
    stateRoot,
    configPath,
    credentialRef: OPENCODE_CREDENTIAL_REF,
    credentialValue,
  });
  return { stateRoot, workspace, env, credentialValue };
}

async function runOpenCodeTurn(runtime, state, prompt, sessionID) {
  const args = [
    'run',
    '--format', 'json',
    '--model', `${OPENCODE_PROVIDER_ID}/${OPENCODE_MODEL_ID}`,
    '--agent', 'build',
    '--dir', state.workspace,
  ];
  if (sessionID) args.push('--session', sessionID);
  args.push(prompt);
  const result = await runProcess(runtime.bin, args, {
    cwd: state.workspace,
    env: state.env,
    wallMs: NORMAL_TURN_WALL_MS,
  });
  requireSuccessfulProcess('OpenCode agent turn', result, [state.credentialValue]);
  const events = parseOpenCodeJsonEvents(result.stdout);
  return { events, evidence: inspectOpenCodeEvents(events) };
}

function toolNames(events) {
  return events.filter((event) => event.type === 'tool_use')
    .map((event) => event.part && typeof event.part === 'object' ? event.part.tool : undefined)
    .filter((tool) => typeof tool === 'string');
}

async function proveAgentCompatibility(runtime, state) {
  const nonce = `VXA-S002-OPENCODE-${randomUUID()}`;
  const probePath = join(state.workspace, 'vxa-opencode-agent-probe.txt');

  currentPhase = 'opencode-agent-write';
  const first = await runOpenCodeTurn(
    runtime,
    state,
    `Act as a coding agent. Use the write or edit filesystem tool, never bash, to create exactly this file: ${probePath}. Its complete contents must be exactly this single line and nothing else: ${nonce}. After the tool succeeds, reply concisely.`,
  );
  const writeTool = first.evidence.completedTools.find((tool) => FILE_TOOL_NAMES.has(tool.name));
  const fileContent = await readFile(probePath, 'utf8').catch(() => '');
  if (!writeTool || fileContent.trim() !== nonce) {
    throw new OpenCodeCompatibilityError('OpenCode did not perform the required real filesystem write', {
      streamedEvents: first.evidence.streamedEvents,
      completedToolNames: first.evidence.completedTools.map((tool) => tool.name),
      artifactExact: fileContent.trim() === nonce,
    });
  }
  const sessionID = first.evidence.sessionID;

  currentPhase = 'opencode-agent-read-after-process-restart';
  const second = await runOpenCodeTurn(
    runtime,
    state,
    `Continue this same session. Use the read filesystem tool, never bash, on exactly this file: ${probePath}. Return the exact nonce found in the tool result and do not invent a value.`,
    sessionID,
  );
  const readTool = second.evidence.completedTools.find((tool) => tool.name === 'read');
  const secondToolResultContainsNonce = Boolean(readTool?.outputContainsText(nonce));
  const secondResponseIncludesNonce = second.evidence.finalText.includes(nonce);
  if (!readTool || !secondToolResultContainsNonce || !secondResponseIncludesNonce) {
    throw new OpenCodeCompatibilityError('OpenCode did not semantically use the resumed-session read tool result', {
      streamedEvents: first.evidence.streamedEvents || second.evidence.streamedEvents,
      writeTool: Boolean(writeTool),
      readTool: Boolean(readTool),
      secondToolResultContainsNonce,
      secondResponseIncludesNonce,
    });
  }
  if (second.evidence.sessionID !== sessionID) {
    throw new OpenCodeCompatibilityError('OpenCode changed session identity during explicit --session continuation');
  }

  currentPhase = 'opencode-restart-recall';
  const third = await runOpenCodeTurn(
    runtime,
    state,
    'Without using any tool or reading any file, return the exact VXA-S002-OPENCODE nonce value from the first turn of this same persisted session. Return only that nonce.',
    sessionID,
  );
  const thirdToolNames = toolNames(third.events);
  const restartResponseIncludesNonce = third.evidence.finalText.includes(nonce);
  const restartSafe = third.evidence.sessionID === sessionID && thirdToolNames.length === 0 && restartResponseIncludesNonce;
  if (!restartSafe) {
    throw new OpenCodeCompatibilityError('OpenCode did not recall persisted session context after process restart without another tool read', {
      sameSession: third.evidence.sessionID === sessionID,
      thirdToolCount: thirdToolNames.length,
      restartResponseIncludesNonce,
    });
  }

  return {
    streaming: first.evidence.streamedEvents || second.evidence.streamedEvents || third.evidence.streamedEvents,
    toolCalls: Boolean(writeTool && readTool),
    structuredArguments: Boolean(writeTool && readTool),
    multiTurnToolReplay: secondToolResultContainsNonce && secondResponseIncludesNonce,
    restartSafe,
    sameSessionAcrossProcesses: second.evidence.sessionID === sessionID && third.evidence.sessionID === sessionID,
    processRestartsProven: 2,
    eventCounts: [first.evidence.eventCount, second.evidence.eventCount, third.evidence.eventCount],
  };
}

async function proveTimeoutMapping(runtime, state) {
  currentPhase = 'opencode-timeout-mapping';
  const result = await runProcess(runtime.bin, [
    'run', '--format', 'json', '--model', `${OPENCODE_PROVIDER_ID}/${OPENCODE_MODEL_ID}`,
    '--agent', 'build', '--dir', state.workspace,
    'This is a timeout mapping probe. Reply only TIMEOUT-PROBE.',
  ], {
    cwd: state.workspace,
    env: state.env,
    wallMs: TIMEOUT_PROBE_WALL_MS,
  });
  return result.timedOut === true && result.overflow === false;
}

async function main() {
  assertSpikeNodeVersion(process.version);
  const rootDir = await mkdtemp(join(tmpdir(), 'vxa-s002-opencode-'));
  try {
    const runtime = await bootstrapOpenCodeRuntime(rootDir);
    const state = await createRuntimeState(rootDir);
    const normal = await proveAgentCompatibility(runtime, state);
    const timeoutMapped = await proveTimeoutMapping(runtime, state);
    const compatible = normal.streaming
      && normal.toolCalls
      && normal.structuredArguments
      && normal.multiTurnToolReplay
      && normal.restartSafe
      && normal.sameSessionAcrossProcesses
      && timeoutMapped;

    process.stdout.write(`${JSON.stringify({
      status: compatible ? 'pass' : 'fail',
      compatible,
      harness: 'opencode',
      harnessVersion: OPENCODE_VERSION,
      providerRoute: 'groq',
      modelId: OPENCODE_MODEL_ID,
      streaming: normal.streaming,
      toolCalls: normal.toolCalls,
      structuredArguments: normal.structuredArguments,
      multiTurnToolReplay: normal.multiTurnToolReplay,
      restartSafe: normal.restartSafe,
      sameSessionAcrossProcesses: normal.sameSessionAcrossProcesses,
      processRestartsProven: normal.processRestartsProven,
      timeoutMapped,
      eventCounts: normal.eventCounts,
      notes: [
        'Each continuation is a fresh opencode CLI process using the exact prior session ID.',
        'Bash, subagents, web access, external directories, sharing, and unrelated model credentials are denied or omitted.',
        'A PASS is valid only for OpenCode 1.18.30 with Groq openai/gpt-oss-120b.',
      ],
    }, null, 2)}\n`);
    if (!compatible) process.exitCode = 2;
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const values = [
    process.env.GROQ_API_KEY,
    process.env.CLOUDFLARE_API_TOKEN,
    process.env.MISTRAL_API_KEY,
    process.env.OPENAI_API_KEY,
  ];
  const isCompatibility = error instanceof OpenCodeCompatibilityError;
  process.stdout.write(`${JSON.stringify({
    status: isCompatibility ? 'fail' : 'error',
    compatible: false,
    harness: 'opencode',
    harnessVersion: OPENCODE_VERSION,
    providerRoute: 'groq',
    modelId: OPENCODE_MODEL_ID,
    phase: currentPhase,
    ...(isCompatibility && error.evidence ? { evidence: error.evidence } : {}),
    error: {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: sanitizeOpenCodeDiagnostic(error instanceof Error ? error.message : 'unknown OpenCode failure', values),
    },
  }, null, 2)}\n`);
  process.exitCode = isCompatibility ? 2 : 1;
});
