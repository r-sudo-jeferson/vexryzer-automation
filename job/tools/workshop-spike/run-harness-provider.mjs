import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { candidatesForRole } from './provider-candidates.ts';
import { assertWorkshopProviderCompatibility } from './provider-compatibility.ts';
import {
  assertMinimalHarnessContinuationSurface,
  assertMinimalHarnessRequestSurface,
  hasStreamingChunks,
  hasToolRoundTrip,
  inspectHarnessEvents,
} from './harness-evidence.ts';
import { isMappedTimeoutEvidence } from './harness-timeout-evidence.ts';
import { inspectSessionPersistence } from './persistence-evidence.ts';
import {
  buildProviderHarnessSdkOptions,
  renderProviderMinimalProfilePatchYaml,
  sanitizeHarnessProviderDiagnostic,
} from './provider-harness-config.ts';
import {
  assertSpikeNodeVersion,
  assertSpikePnpmVersion,
  buildPackageInstallEnv,
  HARNESS_SPIKE_PROFILE,
  renderHarnessInstallPackageJson,
  renderHarnessInstallWorkspaceYaml,
  resolveHarnessCandidateVersion,
} from './spike-config.ts';

const NORMAL_TURN_WALL_MS = 180_000;
const TIMEOUT_PROBE_WALL_MS = 15_000;
const TIMEOUT_PROVIDER_MS = 5;
const MAX_TOKENS = 2_048;
let currentPhase = 'preflight';

class SpikeWallTimeoutError extends Error {
  constructor(label, timeoutMs) {
    super(`${label} exceeded ${timeoutMs}ms wall-clock budget`);
    this.name = 'SpikeWallTimeoutError';
  }
}

function runCommand(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) return resolve({ stdout, stderr });
      const diagnostic = [stdout, stderr].filter(Boolean).join('\n').replace(/[\r\n\t]+/g, ' ').trim().slice(-1_200);
      const error = new Error(`${command} exited with code ${code ?? 'unknown'}${diagnostic ? `: ${diagnostic}` : ''}`);
      error.name = 'SpikeSubprocessError';
      reject(error);
    });
  });
}

async function withWallTimeout(promise, label, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new SpikeWallTimeoutError(label, timeoutMs)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function bootstrapHarnessRuntime(rootDir, harnessVersion) {
  const runtimeDir = join(rootDir, 'runtime');
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(join(runtimeDir, 'package.json'), renderHarnessInstallPackageJson(harnessVersion));
  await writeFile(join(runtimeDir, 'pnpm-workspace.yaml'), renderHarnessInstallWorkspaceYaml(harnessVersion));

  const pnpm = process.env.VXA_PNPM_BIN?.trim() || 'pnpm';
  const packageInstallEnv = buildPackageInstallEnv(process.env);
  const pnpmVersion = await runCommand(pnpm, ['--version'], { cwd: runtimeDir, env: packageInstallEnv });
  assertSpikePnpmVersion(pnpmVersion.stdout);

  currentPhase = 'harness-package-install';
  await runCommand(pnpm, ['install', '--frozen-lockfile=false'], { cwd: runtimeDir, env: packageInstallEnv });
  currentPhase = 'harness-peer-check';
  await runCommand(pnpm, ['peers', 'check'], { cwd: runtimeDir, env: packageInstallEnv });

  currentPhase = 'harness-package-verify';
  const requireFromRuntime = createRequire(join(runtimeDir, 'package.json'));
  const sdkPackagePath = requireFromRuntime.resolve('@deepseek-ai/dsh-sdk-client/package.json');
  const dshPackagePath = requireFromRuntime.resolve('@deepseek-ai/dsh/package.json');
  const piAiPackagePath = requireFromRuntime.resolve('@deepseek-ai/dsh-llm-pi-ai/package.json');
  const piAiCorePackagePath = join(runtimeDir, 'node_modules', '@earendil-works', 'pi-ai', 'package.json');
  const requireFromDsh = createRequire(dshPackagePath);
  const minimalBundlePackagePath = requireFromDsh.resolve('@deepseek-ai/dsh-sdk-minimal/package.json');
  const runtimeManifest = await readJson(join(runtimeDir, 'package.json'));
  const [sdkManifest, dshManifest, piAiManifest, piAiCoreManifest, minimalBundleManifest] = await Promise.all([
    readJson(sdkPackagePath), readJson(dshPackagePath), readJson(piAiPackagePath), readJson(piAiCorePackagePath), readJson(minimalBundlePackagePath),
  ]);
  const resolved = {
    sdk: sdkManifest.version,
    dsh: dshManifest.version,
    piAi: piAiManifest.version,
    sdkMinimal: minimalBundleManifest.version,
  };
  if (Object.values(resolved).some((version) => version !== harnessVersion)) {
    throw new Error(`Harness package version mismatch: expected ${harnessVersion}, resolved=${JSON.stringify(resolved)}`);
  }
  const expectedPiAiCore = runtimeManifest.dependencies?.['@earendil-works/pi-ai'];
  if (typeof expectedPiAiCore !== 'string' || piAiCoreManifest.version !== expectedPiAiCore) {
    throw new Error(`pi-ai core version mismatch: expected ${String(expectedPiAiCore)}, resolved=${String(piAiCoreManifest.version)}`);
  }
  const sdkEntry = requireFromRuntime.resolve('@deepseek-ai/dsh-sdk-client');
  const sdk = await import(pathToFileURL(sdkEntry).href);
  if (typeof sdk.DeepSeekHarness !== 'function') throw new TypeError('@deepseek-ai/dsh-sdk-client did not export DeepSeekHarness');
  return { runtimeDir, sdk };
}

function required(name, value) {
  const normalized = value?.trim() || '';
  if (!normalized || /[\r\n\0]/.test(normalized)) throw new TypeError(`${name} is required`);
  return normalized;
}

function harnessInputFor(candidate) {
  if (candidate.provider === 'cloudflare-workers-ai') {
    return {
      providerRoute: candidate.provider,
      modelId: candidate.modelId,
      credentialRef: 'CLOUDFLARE_API_TOKEN',
      credentialValue: required('CLOUDFLARE_API_TOKEN', process.env.CLOUDFLARE_API_TOKEN),
      displayName: 'Cloudflare Workers AI',
      baseURL: 'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1',
      providerEnv: { CLOUDFLARE_ACCOUNT_ID: required('CLOUDFLARE_ACCOUNT_ID', process.env.CLOUDFLARE_ACCOUNT_ID) },
    };
  }
  if (candidate.provider === 'groq') {
    return {
      providerRoute: candidate.provider,
      modelId: candidate.modelId,
      credentialRef: 'GROQ_API_KEY',
      credentialValue: required('GROQ_API_KEY', process.env.GROQ_API_KEY),
      displayName: 'Groq',
      baseURL: 'https://api.groq.com/openai/v1',
      providerEnv: {},
    };
  }
  throw new TypeError(`unsupported Workshop provider: ${candidate.provider}`);
}

async function writeProviderPatch(dshHome, input, timeouts) {
  await mkdir(dshHome, { recursive: true });
  const patchPath = join(dshHome, 'provider-profile.patch.yml');
  await writeFile(patchPath, renderProviderMinimalProfilePatchYaml({
    providerRoute: input.providerRoute,
    modelId: input.modelId,
    credentialRef: input.credentialRef,
    displayName: input.displayName,
    baseURL: input.baseURL,
    ...(timeouts ?? {}),
  }), { mode: 0o600 });
  return patchPath;
}

function createHarness({ sdk, workspace, dshHome, patchPath, input }) {
  return new sdk.DeepSeekHarness(buildProviderHarnessSdkOptions(process.env, {
    workspace, dshHome, patchPath, input, maxTokens: MAX_TOKENS,
  }));
}

function toolResultContainsMarker(events, marker) {
  return events.some((event) => {
    if (!event || typeof event !== 'object' || event.type !== 'tool/result') return false;
    const data = event.data && typeof event.data === 'object' ? event.data : null;
    return JSON.stringify(data?.message ?? null).includes(marker);
  });
}

async function proveNormalCompatibility(runtime, candidateRoot, input) {
  const workspace = join(candidateRoot, 'workspace');
  const dshHome = join(candidateRoot, 'dsh-home');
  await mkdir(workspace, { recursive: true });
  const patchPath = await writeProviderPatch(dshHome, input);
  const sessionId = `vxa-s002-provider-${randomUUID()}`;
  const nonce = `VXA-S002-NONCE-${randomUUID()}`;
  const probePath = join(workspace, 'vxa-harness-agent-probe.txt');
  const harness = createHarness({ ...runtime, workspace, dshHome, patchPath, input });

  let first;
  let second;
  let firstEvidence;
  try {
    currentPhase = `${input.providerRoute}:agent-write`;
    first = await withWallTimeout(harness.run(
      `Act as a coding agent. Use str_replace_editor command create with this exact absolute path: ${probePath}. Set file_text to exactly this single line and nothing else: ${nonce}. Do not merely describe the action. After the tool succeeds, reply concisely.`,
      { sessionId },
    ), 'first Harness agent turn', NORMAL_TURN_WALL_MS);
    firstEvidence = inspectHarnessEvents(first.events);
    assertMinimalHarnessRequestSurface(firstEvidence);
    const fileContent = await readFile(probePath, 'utf8').catch(() => '');
    if (fileContent.trim() !== nonce) throw new Error(`Harness agent did not create the exact expected workspace artifact; evidence=${JSON.stringify(firstEvidence)}`);

    currentPhase = `${input.providerRoute}:agent-read`;
    second = await withWallTimeout(harness.run(
      `Use str_replace_editor command view on this exact absolute path: ${probePath}. Return the exact nonce found there and no invented value.`,
      { sessionId },
    ), 'second Harness agent turn', NORMAL_TURN_WALL_MS);
  } finally {
    await harness.close();
  }

  const persistenceRoot = join(dshHome, 'sessions');
  const persistenceBeforeRestart = await inspectSessionPersistence(persistenceRoot, nonce);
  const secondEvidence = inspectHarnessEvents(second.events);
  assertMinimalHarnessContinuationSurface(firstEvidence, secondEvidence);
  const streaming = hasStreamingChunks(first.events) || hasStreamingChunks(second.events);
  const toolCalls = hasToolRoundTrip(first.events) && hasToolRoundTrip(second.events);
  const structuredArguments = firstEvidence.structuredToolArguments && secondEvidence.structuredToolArguments;
  const secondToolResultContainsNonce = toolResultContainsMarker(second.events, nonce);
  const secondResponseIncludesNonce = second.finalResponse.includes(nonce);
  const multiTurnToolReplay = hasToolRoundTrip(second.events) && secondToolResultContainsNonce && secondResponseIncludesNonce;

  currentPhase = `${input.providerRoute}:restart-replay`;
  const restartedHarness = createHarness({ ...runtime, workspace, dshHome, patchPath, input });
  let restart;
  try {
    restart = await withWallTimeout(restartedHarness.run(
      'Without using any tool or reading any file, return the exact VXA-S002-NONCE value that I supplied in the first turn of this same session. Return only that nonce.',
      { sessionId },
    ), 'restart Harness agent turn', NORMAL_TURN_WALL_MS);
  } finally {
    await restartedHarness.close();
  }
  const persistenceAfterRestart = await inspectSessionPersistence(persistenceRoot, nonce);
  const restartEvidence = inspectHarnessEvents(restart.events);
  assertMinimalHarnessRequestSurface(restartEvidence);
  const restartResponseIncludesNonce = restart.finalResponse.includes(nonce);
  const restartSafe = restartResponseIncludesNonce && restartEvidence.toolCallCount === 0;

  return {
    streaming,
    toolCalls,
    structuredArguments,
    multiTurnToolReplay,
    restartSafe,
    evidence: { first: firstEvidence, second: secondEvidence, restart: restartEvidence },
    semanticEvidence: {
      secondToolResultContainsNonce,
      secondResponseIncludesNonce,
      restartResponseIncludesNonce,
      persistenceBeforeRestart,
      persistenceAfterRestart,
    },
  };
}

async function proveTimeoutMapping(runtime, candidateRoot, input) {
  const workspace = join(candidateRoot, 'timeout-workspace');
  const dshHome = join(candidateRoot, 'timeout-dsh-home');
  await mkdir(workspace, { recursive: true });
  const patchPath = await writeProviderPatch(dshHome, input, { timeoutMs: TIMEOUT_PROVIDER_MS, streamIdleTimeoutMs: TIMEOUT_PROVIDER_MS });
  const harness = createHarness({ ...runtime, workspace, dshHome, patchPath, input });
  try {
    currentPhase = `${input.providerRoute}:timeout-mapping`;
    const result = await withWallTimeout(harness.run(
      'This is a timeout-mapping probe. Return the word TIMEOUT-PROBE.',
      { sessionId: `vxa-s002-timeout-${randomUUID()}` },
    ), 'provider timeout probe', TIMEOUT_PROBE_WALL_MS);
    return isMappedTimeoutEvidence(inspectHarnessEvents(result.events));
  } catch (error) {
    if (error instanceof SpikeWallTimeoutError) return false;
    return isMappedTimeoutEvidence(undefined, error);
  } finally {
    await harness.close();
  }
}

async function probeCandidate(runtime, rootDir, harnessVersion, candidate) {
  let input;
  try {
    input = harnessInputFor(candidate);
    const candidateRoot = join(rootDir, candidate.provider === 'cloudflare-workers-ai' ? 'cloudflare-gpt-oss' : 'groq-gpt-oss');
    await mkdir(candidateRoot, { recursive: true });
    const normal = await proveNormalCompatibility(runtime, candidateRoot, input);
    const timeoutMapped = await proveTimeoutMapping(runtime, candidateRoot, input);
    const compatibility = {
      harnessVersion,
      providerRoute: input.providerRoute,
      modelId: input.modelId,
      streaming: normal.streaming,
      toolCalls: normal.toolCalls,
      multiTurnToolReplay: normal.multiTurnToolReplay,
      structuredArguments: normal.structuredArguments,
      timeoutMapped,
      restartSafe: normal.restartSafe,
    };
    let compatible = true;
    try { assertWorkshopProviderCompatibility(compatibility); } catch { compatible = false; }
    return {
      status: compatible ? 'pass' : 'fail',
      compatible,
      harnessProfile: HARNESS_SPIKE_PROFILE,
      ...compatibility,
      evidence: normal.evidence,
      semanticEvidence: normal.semanticEvidence,
    };
  } catch (error) {
    const values = input
      ? [input.credentialValue, ...Object.values(input.providerEnv)]
      : [process.env.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_ACCOUNT_ID, process.env.GROQ_API_KEY];
    return {
      status: 'error',
      compatible: false,
      harnessProfile: HARNESS_SPIKE_PROFILE,
      harnessVersion,
      providerRoute: candidate.provider,
      modelId: candidate.modelId,
      phase: currentPhase,
      error: {
        name: error instanceof Error ? error.name : 'UnknownError',
        message: sanitizeHarnessProviderDiagnostic(error instanceof Error ? error.message : 'unknown provider Harness failure', values),
      },
    };
  }
}

async function main() {
  assertSpikeNodeVersion(process.version);
  const harnessVersion = resolveHarnessCandidateVersion(process.env.VXA_HARNESS_VERSION);
  const candidates = candidatesForRole('workshop_code');
  const rootDir = await mkdtemp(join(tmpdir(), 'vxa-s002-provider-harness-'));
  try {
    currentPhase = 'harness-bootstrap';
    const runtime = await bootstrapHarnessRuntime(rootDir, harnessVersion);
    const results = [];
    for (const candidate of candidates) results.push(await probeCandidate(runtime, rootDir, harnessVersion, candidate));
    const compatible = results.some((result) => result.compatible === true);
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      status: compatible ? 'pass' : 'fail',
      compatible,
      harness: 'deepseek-harness',
      harnessVersion,
      harnessProfile: HARNESS_SPIKE_PROFILE,
      results,
      notes: [
        'This is a real agentic filesystem/tool/session probe through DeepSeek Harness sdk-minimal.',
        'Raw provider payloads, API credentials, account identifiers and prompt text are not emitted.',
        'A PASS is valid only for the exact Harness/provider/model tuple represented in each result.',
        'This proof does not authorize public live Workshop deployment or make Harness authoritative conversation memory.',
      ],
    }, null, 2)}\n`);
    if (!compatible) process.exitCode = 2;
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const values = [process.env.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_ACCOUNT_ID, process.env.GROQ_API_KEY];
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'error',
    compatible: false,
    harness: 'deepseek-harness',
    harnessProfile: HARNESS_SPIKE_PROFILE,
    phase: currentPhase,
    error: {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: sanitizeHarnessProviderDiagnostic(error instanceof Error ? error.message : 'unknown Harness failure', values),
    },
  }, null, 2)}\n`);
  process.exitCode = 1;
});
