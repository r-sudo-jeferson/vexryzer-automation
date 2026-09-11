import { performance } from 'node:perf_hooks';
import {
  createCanonicalSalesContext,
  freezeCanonicalSalesContext,
  type CanonicalSalesContext,
} from '../../src/ai/context/canonical-sales-context.ts';
import type { ProviderRouteDefinition } from '../../src/ai/providers/provider-registry.ts';
import type { ProviderRuntimeState } from '../../src/ai/providers/route-eligibility.ts';
import {
  evaluateAccountingSellerQuality,
  type AccountingSellerQualityResult,
} from '../../src/ai/evals/accounting-seller-quality.ts';
import {
  consumeProviderChatSseResponse,
  executeProviderChatStream,
  type ProviderChatClientResult,
} from '../../src/server/ai/providers/provider-chat-client.ts';
import { buildServerChatHttpRequest } from '../../src/server/ai/providers/openai-chat-wire.ts';
import {
  runSellerTurn,
  type SellerTurnRuntimeInput,
} from '../../src/server/ai/seller/seller-turn-runtime.ts';
import {
  ACCOUNTING_PROVIDER_QUALITY_SCENARIOS,
  type AccountingProviderScenario,
} from '../provider-quality/accounting-scenarios.ts';
import {
  extractSafeProviderErrorShape,
  type SafeProviderErrorShape,
} from './provider-error-shape.ts';

const REQUEST_START_SPACING_MS = 2_600;
const REQUEST_TIMEOUT_MS = 45_000;
const ROUTE_INPUT_TOKENS = 16_000;
const RESERVED_OUTPUT_TOKENS = 2_000;
const GROQ_EMERGENCY_INPUT_TOKENS = 6_200;
const MAX_DIAGNOSTIC_STREAM_BYTES = 256 * 1024;
const SCREEN_SCENARIO_IDS = new Set([
  'vague-operational-pain',
  'detailed-process-upfront',
  'repeated-manual-reconciliation',
  'training-process-better-than-software',
]);

interface ModelSpec {
  routeId: string;
  modelId: string;
}

const CLOUDFLARE_SELLER_CANDIDATES: readonly Readonly<ModelSpec>[] = Object.freeze([
  Object.freeze({
    routeId: 'screen-cloudflare-glm-seller',
    modelId: '@cf/zai-org/glm-4.7-flash',
  }),
  Object.freeze({
    routeId: 'screen-cloudflare-nemotron-seller',
    modelId: '@cf/nvidia/nemotron-3-120b-a12b',
  }),
]);

const GROQ_ERROR_PROBE: Readonly<ModelSpec> = Object.freeze({
  routeId: 'screen-groq-gpt-oss-seller',
  modelId: 'openai/gpt-oss-120b',
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value || /[\r\n\0]/.test(value)) throw new TypeError(`${name} is required`);
  return value;
}

function currentEvidence() {
  return Object.freeze({
    verifiedSha: process.env.GITHUB_SHA?.trim() || 'local-diagnostic',
    runId: process.env.GITHUB_RUN_ID?.trim() || 'local-diagnostic',
  });
}

function cloudflareRoute(spec: Readonly<ModelSpec>): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    routeId: spec.routeId,
    family: 'cloudflare_workers_ai' as const,
    modelId: spec.modelId,
    roles: Object.freeze(['seller'] as const),
    tier: 'primary' as const,
    priority: 10,
    enabledByDefault: true,
    credentialEnvName: 'CLOUDFLARE_API_TOKEN',
    credentialScope: 'server' as const,
    noPaymentEligibility: 'PASS' as const,
    protocolCompatibility: 'PASS' as const,
    sellerQuality: 'PASS' as const,
    criticQuality: 'NOT_APPLICABLE' as const,
    composerQuality: 'NOT_APPLICABLE' as const,
    harnessCompatibility: 'NOT_APPLICABLE' as const,
    workshopSafety: 'NOT_APPLICABLE' as const,
    workshopHarness: null,
    runtimeActivation: 'PASS' as const,
    capabilities: Object.freeze({
      streaming: 'PASS' as const,
      tools: 'PASS' as const,
      structuredArguments: 'PASS' as const,
    }),
    maxInputTokens: ROUTE_INPUT_TOKENS,
    emergencyInputTokens: GROQ_EMERGENCY_INPUT_TOKENS,
    evidence: currentEvidence(),
  });
}

function groqRoute(spec: Readonly<ModelSpec>): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    routeId: spec.routeId,
    family: 'groq' as const,
    modelId: spec.modelId,
    roles: Object.freeze(['seller'] as const),
    tier: 'independent_fallback' as const,
    priority: 10,
    enabledByDefault: true,
    credentialEnvName: 'GROQ_API_KEY',
    credentialScope: 'server' as const,
    noPaymentEligibility: 'PASS' as const,
    protocolCompatibility: 'PASS' as const,
    sellerQuality: 'PASS' as const,
    criticQuality: 'NOT_APPLICABLE' as const,
    composerQuality: 'NOT_APPLICABLE' as const,
    harnessCompatibility: 'NOT_APPLICABLE' as const,
    workshopSafety: 'NOT_APPLICABLE' as const,
    workshopHarness: null,
    runtimeActivation: 'PASS' as const,
    capabilities: Object.freeze({
      streaming: 'PASS' as const,
      tools: 'PASS' as const,
      structuredArguments: 'PASS' as const,
    }),
    maxInputTokens: ROUTE_INPUT_TOKENS,
    emergencyInputTokens: GROQ_EMERGENCY_INPUT_TOKENS,
    evidence: currentEvidence(),
  });
}

function routeBudget(route: Readonly<ProviderRouteDefinition>) {
  return Object.freeze({
    routeId: route.routeId,
    budget: Object.freeze({
      maxInputTokens: ROUTE_INPUT_TOKENS + RESERVED_OUTPUT_TOKENS,
      reservedOutputTokens: RESERVED_OUTPUT_TOKENS,
      emergencyInputTokens: GROQ_EMERGENCY_INPUT_TOKENS,
    }),
  });
}

function runtimeState(route: Readonly<ProviderRouteDefinition>): Readonly<ProviderRuntimeState> {
  return Object.freeze({ routeId: route.routeId, circuit: 'closed', quota: 'available' });
}

function estimateTokens(value: unknown): number {
  const json = JSON.stringify(value);
  if (json === undefined) return 0;
  return Math.ceil(new TextEncoder().encode(json).byteLength / 3);
}

function canonicalForScenario(
  routeId: string,
  scenario: Readonly<AccountingProviderScenario>,
): CanonicalSalesContext {
  if (scenario.setup !== 'fresh') throw new TypeError('diagnostic screen accepts only fresh scenarios');
  const turnId = 'turn-1';
  return freezeCanonicalSalesContext({
    ...createCanonicalSalesContext({ sessionId: `screen-${routeId}-${scenario.id}`.slice(0, 96) }),
    turnIds: Object.freeze([turnId]),
    primaryPain: scenario.userText,
    latestUserIntent: Object.freeze({ turnId, text: scenario.userText }),
  });
}

function serverConfig() {
  return Object.freeze({ cloudflareAccountId: requiredEnv('CLOUDFLARE_ACCOUNT_ID') });
}

function credentialResolver(name: string): string | null {
  const value = process.env[name]?.trim() ?? '';
  return value || null;
}

let lastProviderStart = 0;

async function pacedProviderInvoker(
  input: Parameters<typeof executeProviderChatStream>[0],
): Promise<ProviderChatClientResult> {
  const remaining = REQUEST_START_SPACING_MS - (Date.now() - lastProviderStart);
  if (remaining > 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, remaining));
  lastProviderStart = Date.now();
  return executeProviderChatStream(input);
}

function sellerInput(
  route: Readonly<ProviderRouteDefinition>,
  canonical: CanonicalSalesContext,
  userText: string,
  providerInvoker: typeof executeProviderChatStream = pacedProviderInvoker,
  maxProviderRounds = 6,
): SellerTurnRuntimeInput {
  const turnId = canonical.latestUserIntent?.turnId ?? 'turn-1';
  return {
    canonical,
    digest: null,
    recentTurns: Object.freeze([{ id: turnId, role: 'user', text: userText }]),
    visualState: Object.freeze({
      sceneId: canonical.currentSceneId,
      focusedEntityIds: Object.freeze([]),
      activeArtifactIds: Object.freeze([]),
      processNodes: Object.freeze([]),
    }),
    routes: Object.freeze([route]),
    routeBudgets: Object.freeze([routeBudget(route)]),
    runtimeStates: Object.freeze([runtimeState(route)]),
    estimateTokens,
    resolveCredential: credentialResolver,
    serverConfig: serverConfig(),
    timeoutMs: REQUEST_TIMEOUT_MS,
    maxProviderRounds,
    dependencies: Object.freeze({ executeProviderChatStream: providerInvoker }),
  };
}

function safeFailure(result: object & { ok: false; code: string }): Readonly<Record<string, unknown>> {
  const validation = 'validation' in result && typeof result.validation === 'object' && result.validation !== null
    ? result.validation as Record<string, unknown>
    : null;
  return Object.freeze({
    code: result.code,
    ...('detail' in result && typeof result.detail === 'string' ? { detail: result.detail } : {}),
    ...('failureClass' in result && typeof result.failureClass === 'string'
      ? { failureClass: result.failureClass }
      : {}),
    ...('status' in result && typeof result.status === 'number' ? { httpStatus: result.status } : {}),
    ...('providerMalformedDetail' in result && typeof result.providerMalformedDetail === 'string'
      ? { providerMalformedDetail: result.providerMalformedDetail }
      : {}),
    ...('providerStreamChunkDetail' in result && typeof result.providerStreamChunkDetail === 'string'
      ? { providerStreamChunkDetail: result.providerStreamChunkDetail }
      : {}),
    ...(validation !== null && typeof validation['code'] === 'string'
      ? { validationCode: validation['code'] }
      : {}),
    ...(validation !== null && typeof validation['path'] === 'string'
      ? { validationPath: validation['path'] }
      : {}),
  });
}

async function screenCloudflareCandidate(
  spec: Readonly<ModelSpec>,
  scenarios: readonly Readonly<AccountingProviderScenario>[],
) {
  const route = cloudflareRoute(spec);
  const evidence = [];
  for (const scenario of scenarios) {
    const canonical = canonicalForScenario(route.routeId, scenario);
    const started = performance.now();
    const seller = await runSellerTurn(sellerInput(route, canonical, scenario.userText));
    if (!seller.ok) {
      evidence.push(Object.freeze({
        scenarioId: scenario.id,
        pass: false,
        runtimePass: false,
        deterministicPass: false,
        providerCalls: 'providerCalls' in seller && typeof seller.providerCalls === 'number'
          ? seller.providerCalls
          : null,
        latencyMs: Math.round(performance.now() - started),
        failure: safeFailure(seller),
      }));
      continue;
    }
    const deterministic: AccountingSellerQualityResult = evaluateAccountingSellerQuality({
      scenario,
      submission: seller.submission,
      canonical: seller.canonical,
    });
    evidence.push(Object.freeze({
      scenarioId: scenario.id,
      pass: deterministic.pass,
      runtimePass: true,
      deterministicPass: deterministic.pass,
      providerCalls: seller.providerCalls,
      latencyMs: Math.round(performance.now() - started),
      checks: deterministic.checks,
      strategySignature: deterministic.strategySignature,
    }));
  }
  const passed = evidence.filter((item) => item.pass).length;
  return Object.freeze({
    routeId: route.routeId,
    modelId: route.modelId,
    screenOnly: true,
    eligibleForActivation: false,
    scenariosPassed: passed,
    scenariosTotal: evidence.length,
    passRate: evidence.length === 0 ? 0 : passed / evidence.length,
    evidence: Object.freeze(evidence),
  });
}

async function inspectProviderErrorStream(response: Response): Promise<Readonly<{
  responseOk: boolean;
  httpStatus: number;
  contentTypeClass: 'sse' | 'json' | 'other' | 'missing';
  bytesInspected: number;
  truncated: boolean;
  errorEvent: Readonly<SafeProviderErrorShape> | null;
}>> {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const contentTypeClass = contentType.startsWith('text/event-stream')
    ? 'sse' as const
    : contentType.includes('json')
      ? 'json' as const
      : contentType.length === 0
        ? 'missing' as const
        : 'other' as const;
  if (!response.ok || response.body === null) {
    return Object.freeze({
      responseOk: response.ok,
      httpStatus: response.status,
      contentTypeClass,
      bytesInspected: 0,
      truncated: false,
      errorEvent: null,
    });
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let bytesInspected = 0;
  let truncated = false;
  let errorEvent: Readonly<SafeProviderErrorShape> | null = null;
  try {
    while (errorEvent === null) {
      const next = await reader.read();
      if (next.done) break;
      bytesInspected += next.value.byteLength;
      if (bytesInspected > MAX_DIAGNOSTIC_STREAM_BYTES) {
        truncated = true;
        break;
      }
      buffer += decoder.decode(next.value, { stream: true })
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n');
      while (true) {
        const boundary = buffer.indexOf('\n\n');
        if (boundary < 0) break;
        const frame = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const dataLines = frame.split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''));
        if (dataLines.length === 0) continue;
        const data = dataLines.join('\n');
        if (data === '[DONE]') continue;
        let parsed: unknown;
        try {
          parsed = JSON.parse(data) as unknown;
        } catch {
          continue;
        }
        errorEvent = extractSafeProviderErrorShape(parsed);
        if (errorEvent !== null) break;
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch {
      // Diagnostic clone cleanup only.
    }
    reader.releaseLock();
  }
  return Object.freeze({
    responseOk: response.ok,
    httpStatus: response.status,
    contentTypeClass,
    bytesInspected,
    truncated,
    errorEvent,
  });
}

async function runGroqErrorProbe(scenario: Readonly<AccountingProviderScenario>) {
  const route = groqRoute(GROQ_ERROR_PROBE);
  let wireEvidence: Awaited<ReturnType<typeof inspectProviderErrorStream>> | null = null;
  const invoker = async (
    input: Parameters<typeof executeProviderChatStream>[0],
  ): Promise<ProviderChatClientResult> => {
    const remaining = REQUEST_START_SPACING_MS - (Date.now() - lastProviderStart);
    if (remaining > 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, remaining));
    lastProviderStart = Date.now();
    const request = buildServerChatHttpRequest({
      route: input.route,
      serverConfig: input.serverConfig,
      apiToken: input.apiToken,
      messages: input.messages,
      tools: input.tools,
    });
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: AbortSignal.timeout(input.timeoutMs),
    });
    const diagnosticCopy = response.clone();
    const [result, diagnostic] = await Promise.all([
      consumeProviderChatSseResponse(response),
      inspectProviderErrorStream(diagnosticCopy),
    ]);
    if (wireEvidence === null) wireEvidence = diagnostic;
    return result;
  };

  const canonical = canonicalForScenario(route.routeId, scenario);
  const started = performance.now();
  try {
    const sellerResult = await runSellerTurn(
      sellerInput(route, canonical, scenario.userText, invoker, 1),
    );
    return Object.freeze({
      routeId: route.routeId,
      modelId: route.modelId,
      scenarioId: scenario.id,
      rawProviderPayloadsEmitted: false,
      latencyMs: Math.round(performance.now() - started),
      result: sellerResult.ok
        ? Object.freeze({ ok: true, providerCalls: sellerResult.providerCalls })
        : Object.freeze({ ok: false, failure: safeFailure(sellerResult) }),
      wireEvidence,
    });
  } catch {
    return Object.freeze({
      routeId: route.routeId,
      modelId: route.modelId,
      scenarioId: scenario.id,
      rawProviderPayloadsEmitted: false,
      latencyMs: Math.round(performance.now() - started),
      result: Object.freeze({
        ok: false,
        failure: Object.freeze({ code: 'DIAGNOSTIC_EXECUTION_THROW' }),
      }),
      wireEvidence,
    });
  }
}

async function main(): Promise<void> {
  requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  requiredEnv('CLOUDFLARE_API_TOKEN');
  requiredEnv('GROQ_API_KEY');

  const screenScenarios = ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.filter(
    (scenario) => SCREEN_SCENARIO_IDS.has(scenario.id),
  );
  if (
    screenScenarios.length !== SCREEN_SCENARIO_IDS.size
    || screenScenarios.some((scenario) => scenario.setup !== 'fresh')
  ) {
    throw new TypeError('diagnostic scenario set drifted');
  }

  const candidates = [];
  for (const spec of CLOUDFLARE_SELLER_CANDIDATES) {
    candidates.push(await screenCloudflareCandidate(spec, screenScenarios));
  }

  const groqScenario = ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.find(
    (scenario) => scenario.id === 'vague-operational-pain',
  );
  if (groqScenario === undefined) throw new TypeError('Groq diagnostic scenario is missing');
  const groqErrorProbe = await runGroqErrorProbe(groqScenario);

  const ranked = [...candidates].sort((left, right) => (
    right.scenariosPassed - left.scenariosPassed
    || right.passRate - left.passRate
    || left.modelId.localeCompare(right.modelId)
  ));
  const leader = ranked[0] ?? null;
  const uniqueLeader = leader !== null
    && (ranked.length === 1 || leader.scenariosPassed > (ranked[1]?.scenariosPassed ?? -1));

  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'complete',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-diagnostic',
    runId: process.env.GITHUB_RUN_ID?.trim() || 'local-diagnostic',
    diagnosticOnly: true,
    activatesNoProviderRoute: true,
    rawProviderPayloadsEmitted: false,
    screenScenarioIds: Object.freeze([...SCREEN_SCENARIO_IDS]),
    candidates: Object.freeze(candidates),
    screenLeader: uniqueLeader ? leader?.modelId ?? null : null,
    groqErrorProbe,
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'error',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-diagnostic',
    diagnosticOnly: true,
    rawProviderPayloadsEmitted: false,
    errorClass: error instanceof Error ? error.name : 'UnknownError',
  }, null, 2)}\n`);
  process.exitCode = 1;
});
