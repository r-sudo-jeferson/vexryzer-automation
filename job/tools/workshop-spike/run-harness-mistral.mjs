import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertWorkshopProviderCompatibility } from './provider-compatibility.ts';
import {
  hasStreamingChunks,
  hasToolRoundTrip,
  inspectHarnessEvents,
} from './harness-evidence.ts';
import {
  assertSpikeNodeVersion,
  assertSpikePnpmVersion,
  buildPackageInstallEnv,
  buildScrubbedHarnessEnv,
  DEFAULT_MISTRAL_BASE_URL,
  DEFAULT_MISTRAL_MODEL_ID,
  DEFAULT_MISTRAL_PROVIDER_ROUTE,
  renderMistralSettingsYaml,
  resolveDshBinFromPackageManifest,
  resolveHarnessCandidateVersion,
  validateSpikeInputs,
} from './spike-config.ts';

const NORMAL_TURN_WALL_MS = 45_000;
const TIMEOUT_PROBE_WALL_MS = 15_000;
const TIMEOUT_PROVIDER_MS = 5;
const MAX_TOKENS = 2_048;

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
      const error = new Error(`${command} exited with code ${code ?? 'unknown'}`);
      error.name = 'SpikeSubprocessError';
      error.stderr = stderr.slice(-4_000);
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

async function bootstrapHarnessRuntime(rootDir, harnessVersion) {
  const runtimeDir = join(rootDir, 'runtime');
  await mkdir(runtimeDir, { recursive: true });
  await writeFile(join(runtimeDir, 'package.json'), JSON.stringify({
    private: true,
    packageManager: 'pnpm@11.25.0',
    dependencies: {
      '@deepseek-ai/dsh': harnessVersion,
      '@deepseek-ai/dsh-sdk-client': harnessVersion,
    },
  }, null, 2));

  const pnpm = process.env.VXA_PNPM_BIN?.trim() || 'pnpm';
  const packageInstallEnv = buildPackageInstallEnv(process.env);
  const pnpmVersion = await runCommand(pnpm, ['--version'], { cwd: runtimeDir, env: packageInstallEnv });
  assertSpikePnpmVersion(pnpmVersion.stdout);
  await runCommand(pnpm, ['install', '--save-exact', '--frozen-lockfile=false'], {
    cwd: runtimeDir,
    env: packageInstallEnv,
  });

  const requireFromRuntime = createRequire(join(runtimeDir, 'package.json'));
  const sdkEntry = requireFromRuntime.resolve('@deepseek-ai/dsh-sdk-client');
  const sdk = await import(pathToFileURL(sdkEntry).href);
  const dshPackagePath = requireFromRuntime.resolve('@deepseek-ai/dsh/package.json');
  const dshManifest = JSON.parse(await readFile(dshPackagePath, 'utf8'));
  const dshBin = resolveDshBinFromPackageManifest(dshManifest, dirname(dshPackagePath));

  return { runtimeDir, sdk, dshBin };
}

async function writeProviderSettings(dshHome, input, timeouts = undefined) {
  await mkdir(dshHome, { recursive: true });
  await writeFile(join(dshHome, 'settings.yaml'), renderMistralSettingsYaml({
    providerRoute: input.providerRoute,
    modelId: input.modelId,
    baseUrl: input.baseUrl,
    ...(timeouts ?? {}),
  }), { mode: 0o600 });
}

function createHarness({ sdk, dshBin, workspace, dshHome, input }) {
  return new sdk.DeepSeekHarness({
    launch: {
      command: process.execPath,
      args: [dshBin, '--profile', 'sdk'],
      cwd: workspace,
      env: buildScrubbedHarnessEnv(process.env, {
        dshHome,
        mistralApiKey: input.mistralApiKey,
      }),
      shutdownTimeoutMs: 1_000,
      disposeEofGraceMs: 6_000,
      disposeGraceMs: 3_000,
    },
    cwd: workspace,
    provider: input.providerRoute,
    model: input.modelId,
    maxTokens: MAX_TOKENS,
  });
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
  await writeProviderSettings(dshHome, input);

  const sessionId = `vxa-s002-provider-${randomUUID()}`;
  const nonce = `VXA-S002-NONCE-${randomUUID()}`;
  const probeFile = 'vxa-harness-tool-probe.txt';
  const harness = createHarness({ ...runtime, workspace, dshHome, input });

  let first;
  let second;
  try {
    first = await withWallTimeout(harness.run(
      `Compatibility probe. Use one available development tool to create ${probeFile} in the current workspace with exactly this single line: ${nonce}. Do not merely describe the action. After the tool succeeds, reply concisely.`,
      { sessionId },
    ), 'first Harness turn', NORMAL_TURN_WALL_MS);

    const fileContent = await readFile(join(workspace, probeFile), 'utf8').catch(() => '');
    if (fileContent.trim() !== nonce) {
      throw new Error('Harness tool probe did not create the exact expected workspace artifact');
    }

    second = await withWallTimeout(harness.run(
      `Use one available development tool to read ${probeFile}. Return the exact nonce found there and no invented value.`,
      { sessionId },
    ), 'second Harness turn', NORMAL_TURN_WALL_MS);
  } finally {
    await harness.close();
  }

  const firstEvidence = inspectHarnessEvents(first.events);
  const secondEvidence = inspectHarnessEvents(second.events);
  const streaming = hasStreamingChunks(first.events) || hasStreamingChunks(second.events);
  const toolCalls = hasToolRoundTrip(first.events) && hasToolRoundTrip(second.events);
  const structuredArguments = firstEvidence.structuredToolArguments && secondEvidence.structuredToolArguments;
  const multiTurnToolReplay = hasToolRoundTrip(second.events) && second.finalResponse.includes(nonce);

  const restartedHarness = createHarness({ ...runtime, workspace, dshHome, input });
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
  const timeoutInput = { ...input, providerRoute: `${input.providerRoute}-timeout` };
  await mkdir(workspace, { recursive: true });
  await writeProviderSettings(dshHome, timeoutInput, {
    timeoutMs: TIMEOUT_PROVIDER_MS,
    streamIdleTimeoutMs: TIMEOUT_PROVIDER_MS,
  });
  const harness = createHarness({ ...runtime, workspace, dshHome, input: timeoutInput });
  try {
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
  assertSpikeNodeVersion(process.version);
  const harnessVersion = resolveHarnessCandidateVersion(process.env.VXA_HARNESS_VERSION);
  const input = {
    providerRoute: process.env.VXA_MISTRAL_PROVIDER_ROUTE?.trim() || DEFAULT_MISTRAL_PROVIDER_ROUTE,
    modelId: process.env.VXA_MISTRAL_MODEL_ID?.trim() || DEFAULT_MISTRAL_MODEL_ID,
    baseUrl: process.env.VXA_MISTRAL_BASE_URL?.trim() || DEFAULT_MISTRAL_BASE_URL,
    mistralApiKey: process.env.MISTRAL_API_KEY?.trim() || '',
  };
  validateSpikeInputs(input);

  const rootDir = await mkdtemp(join(tmpdir(), 'vxa-s002-harness-spike-'));
  try {
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

    const result = {
      schemaVersion: 1,
      compatible,
      ...compatibility,
      evidence: normal.diagnosticCounts,
      notes: [
        'Raw provider payloads and model credentials are intentionally not emitted.',
        'A PASS is valid only for this exact Harness version/provider/model tuple.',
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
  const message = error instanceof Error ? error.message : 'Unknown compatibility-spike failure';
  process.stderr.write(`[${name}] ${message}\n`);
  process.exitCode = 1;
});
