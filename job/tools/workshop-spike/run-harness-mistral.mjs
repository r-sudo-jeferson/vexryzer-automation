import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertWorkshopProviderCompatibility } from './provider-compatibility.ts';
import {
  assertMinimalHarnessContinuationSurface,
  assertMinimalHarnessRequestSurface,
  hasStreamingChunks,
  hasToolRoundTrip,
  inspectHarnessEvents,
} from './harness-evidence.ts';
import {
  assertSpikeNodeVersion,
  assertSpikePnpmVersion,
  buildHarnessSdkOptions,
  buildPackageInstallEnv,
  DEFAULT_MISTRAL_MODEL_ID,
  DEFAULT_MISTRAL_PROVIDER_ROUTE,
  HARNESS_SPIKE_PROFILE,
  renderHarnessInstallPackageJson,
  renderHarnessInstallWorkspaceYaml,
  renderMistralMinimalProfilePatchYaml,
  resolveHarnessCandidateVersion,
  sanitizeSpikeDiagnostic,
  validateSpikeInputs,
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
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }
      const diagnostic = [stdout, stderr]
        .filter(Boolean)
        .join('\n')
        .replace(/[\r\n\t]+/g, ' ')
        .trim()
        .slice(-1_200);
      const suffix = diagnostic ? `: ${diagnostic}` : '';
      const error = new Error(`${command} exited with code ${code ?? 'unknown'}${suffix}`);
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
  await writeFile(
    join(runtimeDir, 'package.json'),
    renderHarnessInstallPackageJson(harnessVersion),
  );
  await writeFile(
    join(runtimeDir, 'pnpm-workspace.yaml'),
    renderHarnessInstallWorkspaceYaml(harnessVersion),
  );

  const pnpm = process.env.VXA_PNPM_BIN?.trim() || 'pnpm';
  const packageInstallEnv = buildPackageInstallEnv(process.env);
  const pnpmVersion = await runCommand(pnpm, ['--version'], { cwd: runtimeDir, env: packageInstallEnv });
  assertSpikePnpmVersion(pnpmVersion.stdout);

  currentPhase = 'harness-package-install';
  await runCommand(pnpm, ['install', '--frozen-lockfile=false'], {
    cwd: runtimeDir,
    env: packageInstallEnv,
  });

  currentPhase = 'harness-peer-check';
  await runCommand(pnpm, ['peers', 'check'], {
    cwd: runtimeDir,
    env: packageInstallEnv,
  });

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
    readJson(sdkPackagePath),
    readJson(dshPackagePath),
    readJson(piAiPackagePath),
    readJson(piAiCorePackagePath),
    readJson(minimalBundlePackagePath),
  ]);
  const resolvedHarnessVersions = {
    sdk: sdkManifest.version,
    dsh: dshManifest.version,
    piAi: piAiManifest.version,
    sdkMinimal: minimalBundleManifest.version,
  };
  if (Object.values(resolvedHarnessVersions).some((version) => version !== harnessVersion)) {
    throw new Error(
      `Harness package version mismatch: expected ${harnessVersion}, resolved=${JSON.stringify(resolvedHarnessVersions)}`,
    );
  }
  const expectedPiAiCoreVersion = runtimeManifest.dependencies?.['@earendil-works/pi-ai'];
  if (typeof expectedPiAiCoreVersion !== 'string' || piAiCoreManifest.version !== expectedPiAiCoreVersion) {
    throw new Error(
      `pi-ai core version mismatch: expected ${String(expectedPiAiCoreVersion)}, resolved=${String(piAiCoreManifest.version)}`,
    );
  }

  const sdkEntry = requireFromRuntime.resolve('@deepseek-ai/dsh-sdk-client');
  const sdk = await import(pathToFileURL(sdkEntry).href);
  if (typeof sdk.DeepSeekHarness !== 'function') {
    throw new TypeError('@deepseek-ai/dsh-sdk-client did not export DeepSeekHarness');
  }

  return { runtimeDir, sdk };
}

async function writeProviderPatch(dshHome, input, timeouts = undefined) {
  await mkdir(dshHome, { recursive: true });
  const patchPath = join(dshHome, 'mistral-profile.patch.yml');
  await writeFile(patchPath, renderMistralMinimalProfilePatchYaml({
    providerRoute: input.providerRoute,
    modelId: input.modelId,
    ...(timeouts ?? {}),
  }), { mode: 0o600 });
  return patchPath;
}

function createHarness({ sdk, workspace, dshHome, patchPath, input }) {
  return new sdk.DeepSeekHarness(buildHarnessSdkOptions(process.env, {
    workspace,
    dshHome,
    patchPath,
    input,
    maxTokens: MAX_TOKENS,
  }));
}

function turnEndKinds(events) {
  return events.flatMap((event) => {
    if (!event || typeof event !== 'object' || event.type !== 'turn/end') return [];
    const reason = event.data && typeof event.data === 'object' ? event.data.reason : undefined;
    return reason && typeof reason === 'object' && typeof reason.kind === 'string' ? [reason.kind] : [];
  });
}

async function proveNormalCompatibility(runtime, rootDir, input) {
  const workspace = join(rootDir, 'workspace');
  const dshHome = join(rootDir, 'dsh-home');
  await mkdir(workspace, { recursive: true });
  const patchPath = await writeProviderPatch(dshHome, input);

  const sessionId = `vxa-s002-provider-${randomUUID()}`;
  const nonce = `VXA-S002-NONCE-${randomUUID()}`;
  const probeFile = 'vxa-harness-tool-probe.txt';
  const probePath = join(workspace, probeFile);
  const harness = createHarness({ ...runtime, workspace, dshHome, patchPath, input });

  let first;
  let second;
  let firstEvidence;
  try {
    currentPhase = 'normal-turn-write';
    first = await withWallTimeout(harness.run(
      `Compatibility probe. Use str_replace_editor command create with this exact absolute path: ${probePath}. Set file_text to exactly this single line and nothing else: ${nonce}. Do not merely describe the action. After the tool succeeds, reply concisely.`,
      { sessionId },
    ), 'first Harness turn', NORMAL_TURN_WALL_MS);

    firstEvidence = inspectHarnessEvents(first.events);
    assertMinimalHarnessRequestSurface(firstEvidence);
    const fileContent = await readFile(probePath, 'utf8').catch(() => '');
    if (fileContent.trim() !== nonce) {
      throw new Error(`Harness tool probe did not create the exact expected workspace artifact; evidence=${JSON.stringify(firstEvidence)}`);
    }

    currentPhase = 'normal-turn-read';
    second = await withWallTimeout(harness.run(
      `Use str_replace_editor command view on this exact absolute path: ${probePath}. Return the exact nonce found there and no invented value.`,
      { sessionId },
    ), 'second Harness turn', NORMAL_TURN_WALL_MS);
  } finally {
    await harness.close();
  }

  const secondEvidence = inspectHarnessEvents(second.events);
  assertMinimalHarnessContinuationSurface(firstEvidence, secondEvidence);
  const streaming = hasStreamingChunks(first.events) || hasStreamingChunks(second.events);
  const toolCalls = hasToolRoundTrip(first.events) && hasToolRoundTrip(second.events);
  const structuredArguments = firstEvidence.structuredToolArguments && secondEvidence.structuredToolArguments;
  const multiTurnToolReplay = hasToolRoundTrip(second.events) && second.finalResponse.includes(nonce);

  currentPhase = 'restart-replay';
  const restartedHarness = createHarness({ ...runtime, workspace, dshHome, patchPath, input });
  let restart;
  try {
    restart = await withWallTimeout(restartedHarness.run(
      'Without using any tool or reading any file, return the exact VXA-S002-NONCE value that I supplied in the first turn of this same session. Return only that nonce.',
      { sessionId },
    ), 'restart Harness turn', NORMAL_TURN_WALL_MS);
  } finally {
    await restartedHarness.close();
  }
  const restartEvidence = inspectHarnessEvents(restart.events);
  assertMinimalHarnessRequestSurface(restartEvidence);
  const restartSafe = restart.finalResponse.includes(nonce) && restartEvidence.toolCallCount === 0;

  return {
    streaming,
    toolCalls,
    structuredArguments,
    multiTurnToolReplay,
    restartSafe,
    diagnosticCounts: {
      first: firstEvidence,
      second: secondEvidence,
      restart: restartEvidence,
    },
  };
}

async function proveTimeoutMapping(runtime, rootDir, input) {
  const workspace = join(rootDir, 'timeout-workspace');
  const dshHome = join(rootDir, 'timeout-dsh-home');
  await mkdir(workspace, { recursive: true });
  const patchPath = await writeProviderPatch(dshHome, input, {
    timeoutMs: TIMEOUT_PROVIDER_MS,
    streamIdleTimeoutMs: TIMEOUT_PROVIDER_MS,
  });
  const harness = createHarness({ ...runtime, workspace, dshHome, patchPath, input });
  try {
    currentPhase = 'timeout-mapping';
    const result = await withWallTimeout(harness.run(
      'This is a timeout-mapping probe. Return the word TIMEOUT-PROBE.',
      { sessionId: `vxa-s002-timeout-${randomUUID()}` },
    ), 'provider timeout probe', TIMEOUT_PROBE_WALL_MS);
    const kinds = turnEndKinds(result.events);
    return kinds.length > 0 && !kinds.includes('completed');
  } catch (error) {
    if (error instanceof SpikeWallTimeoutError) return false;
    const name = error instanceof Error ? error.name : '';
    const message = error instanceof Error ? error.message : '';
    return /timeout/i.test(name) || /timed?\s*out|timeout/i.test(message);
  } finally {
    await harness.close();
  }
}

async function main() {
  currentPhase = 'runtime-preflight';
  assertSpikeNodeVersion(process.version);
  const harnessVersion = resolveHarnessCandidateVersion(process.env.VXA_HARNESS_VERSION);
  const input = {
    providerRoute: process.env.VXA_MISTRAL_PROVIDER_ROUTE?.trim() || DEFAULT_MISTRAL_PROVIDER_ROUTE,
    modelId: process.env.VXA_MISTRAL_MODEL_ID?.trim() || DEFAULT_MISTRAL_MODEL_ID,
    mistralApiKey: process.env.MISTRAL_API_KEY?.trim() || '',
  };
  validateSpikeInputs(input);

  const rootDir = await mkdtemp(join(tmpdir(), 'vxa-s002-harness-spike-'));
  try {
    currentPhase = 'harness-bootstrap';
    const runtime = await bootstrapHarnessRuntime(rootDir, harnessVersion);
    const normal = await proveNormalCompatibility(runtime, rootDir, input);
    const timeoutMapped = await proveTimeoutMapping(runtime, rootDir, input);
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
    try {
      assertWorkshopProviderCompatibility(compatibility);
    } catch {
      compatible = false;
    }

    currentPhase = 'complete';
    const result = {
      schemaVersion: 1,
      status: compatible ? 'pass' : 'fail',
      compatible,
      harnessProfile: HARNESS_SPIKE_PROFILE,
      ...compatibility,
      evidence: normal.diagnosticCounts,
      notes: [
        'Raw provider payloads and model credentials are intentionally not emitted.',
        'The official sdk-minimal profile replaces only the DeepSeek adapter with llm-pi-ai and reuses pi-ai\'s native Mistral provider implementation.',
        'The fixed Medium 3.5 id is added to the Mistral route without protocol, endpoint, or compatibility overrides.',
        'Every normal-turn request must expose exactly the two tool schemas shipped by sdk-minimal.',
        'A PASS is valid only for this exact Harness version/profile/provider/model tuple.',
        'This proof does not authorize a public live Workshop deployment.',
      ],
    };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    if (!compatible) process.exitCode = 2;
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  const name = error instanceof Error ? error.name : 'UnknownError';
  const rawMessage = error instanceof Error ? error.message : 'Unknown compatibility-spike failure';
  const message = sanitizeSpikeDiagnostic(rawMessage, process.env.MISTRAL_API_KEY);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'error',
    compatible: false,
    harnessProfile: HARNESS_SPIKE_PROFILE,
    phase: currentPhase,
    error: { name, message },
    notes: [
      'Diagnostic text is bounded and the current Mistral credential is redacted before emission.',
      'No compatibility PASS is valid from this result.',
    ],
  }, null, 2)}\n`);
  process.exitCode = 1;
});
