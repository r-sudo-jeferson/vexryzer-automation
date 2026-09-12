import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DeepSeekHarness } from '@deepseek-ai/dsh-sdk-client';

const PASS_TOKEN = 'VXA_DEEPSEEK_HARNESS_OK';
const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const JOB_ROOT = resolve(SCRIPT_DIR, '..');
const PATCH_FILE = resolve(JOB_ROOT, 'config/deepseek-harness-smoke.cordis.patch.yml');

function fail(code) {
  console.error(`DeepSeek Harness live verification: FAIL (${code})`);
  process.exitCode = 1;
}

function safeFailureCode(error) {
  const name = error instanceof Error ? error.name : 'UNKNOWN';
  const message = error instanceof Error ? error.message : '';
  if (/AUTH|401|403/i.test(message)) return 'AUTH';
  if (/QUOTA/i.test(message)) return 'QUOTA';
  if (/RATE.?LIMIT|429/i.test(message)) return 'RATE_LIMIT';
  if (/UNKNOWN_MODEL|INVALID_REQUEST|model/i.test(message)) return 'MODEL_OR_ROUTE';
  if (/TIMEOUT/i.test(name + ' ' + message)) return 'TIMEOUT';
  if (/TransportClosed/i.test(name)) return 'HARNESS_TRANSPORT';
  if (/JsonRpcResponse/i.test(name)) return 'HARNESS_RPC';
  return 'HARNESS_RUNTIME';
}
const apiKey = process.env.DEEPSEEK_API_KEY;
if (typeof apiKey !== 'string' || apiKey.trim() !== apiKey || apiKey.length < 16 || /[\r\n]/.test(apiKey)) {
  fail('MISSING_OR_INVALID_SECRET');
} else {
  const harnessHome = await mkdtemp(resolve(process.env.RUNNER_TEMP ?? tmpdir(), 'vxa-dsh-'));
  const childEnv = {
    CI: 'true',
    NO_COLOR: '1',
    DSH_TELEMETRY_DISABLED: '1',
    DSH_PERMISSION_MODE: 'read-only',
    DEEPSEEK_API_KEY: apiKey,
    ...(process.env.PATH === undefined ? {} : { PATH: process.env.PATH }),
    ...(process.env.HOME === undefined ? {} : { HOME: process.env.HOME }),
    ...(process.env.LANG === undefined ? {} : { LANG: process.env.LANG }),
    TMPDIR: process.env.RUNNER_TEMP ?? process.env.TMPDIR ?? tmpdir(),
  };

  const harness = new DeepSeekHarness({
    profile: 'sdk',
    patches: [PATCH_FILE],
    dshHome: harnessHome,
    processCwd: JOB_ROOT,
    cwd: JOB_ROOT,
    provider: 'deepseek-official',
    model: 'deepseek-v4-pro',
    reasoningEffort: 'high',
    maxTokens: 128,
    initializeTimeoutMs: 60_000,
    requestTimeoutMs: 180_000,
    shutdownTimeoutMs: 5_000,
    env: childEnv,
  });
  try {
    const result = await harness.run(
      `Return exactly ${PASS_TOKEN} and no other visible text. Do not call tools.`,
    );
    if (result.finalResponse.trim() !== PASS_TOKEN) {
      fail('RESPONSE_MISMATCH');
    } else {
      console.log('DeepSeek Harness live verification: PASS');
    }
  } catch (error) {
    fail(safeFailureCode(error));
  } finally {
    try {
      await harness.close();
    } catch {
      if (process.exitCode !== 1) fail('HARNESS_SHUTDOWN');
    }
    await rm(harnessHome, { recursive: true, force: true });
  }
}
