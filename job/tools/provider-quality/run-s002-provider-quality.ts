import { performance } from 'node:perf_hooks';
import {
  createCanonicalSalesContext,
  freezeCanonicalSalesContext,
  type CanonicalSalesContext,
} from '../../src/ai/context/canonical-sales-context.ts';
import { createAgentSession, type AgentSessionRecord } from '../../src/server/session/agent-session.ts';
import type {
  AgentSessionRepository,
  SessionCompareAndSetResult,
  SessionCreateResult,
  VersionedAgentSession,
} from '../../src/server/session/session-repository.ts';
import {
  runStoredAgentTurn,
  type AgentRuntimeStaticConfig,
} from '../../src/server/session/stored-agent-turn-service.ts';
import type { ProviderRouteDefinition, ProviderRouteTier } from '../../src/ai/providers/provider-registry.ts';
import type { ProviderRuntimeState } from '../../src/ai/providers/route-eligibility.ts';
import type { SellerSubmission } from '../../src/ai/seller/seller-contract.ts';
import {
  evaluateAccountingSellerQuality,
  evaluateStrategyDiversity,
  type AccountingSellerQualityResult,
} from '../../src/ai/evals/accounting-seller-quality.ts';
import {
  executeProviderChatStream,
  type ProviderChatClientResult,
} from '../../src/server/ai/providers/provider-chat-client.ts';
import {
  runSellerTurn,
  type SellerRevisionRequest,
  type SellerTurnRuntimeInput,
} from '../../src/server/ai/seller/seller-turn-runtime.ts';
import {
  runCriticTurn,
  type CriticTurnRuntimeInput,
} from '../../src/server/ai/critic/critic-turn-runtime.ts';
import type { CriticReview } from '../../src/ai/critic/critic-contract.ts';
import {
  ACCOUNTING_PROVIDER_QUALITY_SCENARIOS,
  PROVIDER_CONTINUITY_QUALITY_SCENARIOS,
  S002_REQUIRED_PROVIDER_QUALITY_MATRIX,
  type AccountingProviderScenario,
} from './accounting-scenarios.ts';

const REQUEST_START_SPACING_MS = 2_600;
const REQUEST_TIMEOUT_MS = 45_000;
const GROQ_FREE_TPM_SAFETY_BUDGET = 7_200;
const GROQ_OUTPUT_RESERVE_TOKENS = 1_000;
const GROQ_TOKEN_WINDOW_MS = 60_000;
const ROUTE_INPUT_TOKENS = 16_000;
const ROUTE_EMERGENCY_TOKENS = 4_000;
const RESERVED_OUTPUT_TOKENS = 2_000;
const MINIMUM_DISTINCT_STRATEGIES = 4;

interface EvalRouteSpec {
  routeId: string;
  family: 'cloudflare_workers_ai' | 'groq';
  modelId: string;
  role: 'seller' | 'critic';
  tier: ProviderRouteTier;
  credentialEnvName: 'CLOUDFLARE_API_TOKEN' | 'GROQ_API_KEY';
}

const SELLER_ROUTE_SPECS: readonly Readonly<EvalRouteSpec>[] = Object.freeze([
  Object.freeze({
    routeId: 'eval-cloudflare-glm-seller',
    family: 'cloudflare_workers_ai',
    modelId: '@cf/zai-org/glm-4.7-flash',
    role: 'seller',
    tier: 'primary',
    credentialEnvName: 'CLOUDFLARE_API_TOKEN',
  }),
  Object.freeze({
    routeId: 'eval-groq-gpt-oss-seller',
    family: 'groq',
    modelId: 'openai/gpt-oss-120b',
    role: 'seller',
    tier: 'independent_fallback',
    credentialEnvName: 'GROQ_API_KEY',
  }),
]);

const CRITIC_ROUTE_SPEC: Readonly<EvalRouteSpec> = Object.freeze({
  routeId: 'eval-cloudflare-gemma-critic',
  family: 'cloudflare_workers_ai',
  modelId: '@cf/google/gemma-4-26b-a4b-it',
  role: 'critic',
  tier: 'primary',
  credentialEnvName: 'CLOUDFLARE_API_TOKEN',
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value || /[\r\n\0]/.test(value)) throw new TypeError(`${name} is required`);
  return value;
}

function currentEvidence() {
  return Object.freeze({
    verifiedSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
    runId: process.env.GITHUB_RUN_ID?.trim() || 'local-evaluation',
  });
}

/**
 * Evaluation-only route.
 *
 * PASS flags here exist only to traverse the production fail-closed router while the
 * exact provider/model is being measured. This object is local to this executable,
 * is never exported into the product registry, and cannot activate deploy runtime.
 */
function createEvaluationRoute(spec: Readonly<EvalRouteSpec>): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    routeId: spec.routeId,
    family: spec.family,
    modelId: spec.modelId,
    roles: Object.freeze([spec.role]),
    tier: spec.tier,
    priority: 10,
    enabledByDefault: true,
    credentialEnvName: spec.credentialEnvName,
    credentialScope: 'server',
    noPaymentEligibility: 'PASS',
    protocolCompatibility: 'PASS',
    sellerQuality: spec.role === 'seller' ? 'PASS' : 'NOT_APPLICABLE',
    criticQuality: spec.role === 'critic' ? 'PASS' : 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
    runtimeActivation: 'PASS',
    capabilities: Object.freeze({
      streaming: 'PASS',
      tools: 'PASS',
      structuredArguments: 'PASS',
    }),
    maxInputTokens: ROUTE_INPUT_TOKENS,
    emergencyInputTokens: ROUTE_EMERGENCY_TOKENS,
    evidence: currentEvidence(),
  });
}

function routeBudget(route: Readonly<ProviderRouteDefinition>) {
  return Object.freeze({
    routeId: route.routeId,
    budget: Object.freeze({
      maxInputTokens: ROUTE_INPUT_TOKENS + RESERVED_OUTPUT_TOKENS,
      reservedOutputTokens: RESERVED_OUTPUT_TOKENS,
      emergencyInputTokens: ROUTE_EMERGENCY_TOKENS,
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

function canonicalForText(routeId: string, scenarioId: string, userText: string): CanonicalSalesContext {
  const sessionId = `quality-${routeId.replace(/^eval-/, '')}-${scenarioId}`.slice(0, 96);
  const turnId = 'turn-1';
  return freezeCanonicalSalesContext({
    ...createCanonicalSalesContext({ sessionId }),
    turnIds: Object.freeze([turnId]),
    primaryPain: userText,
    latestUserIntent: Object.freeze({ turnId, text: userText }),
  });
}

function canonicalForScenario(
  routeId: string,
  scenario: Readonly<AccountingProviderScenario>,
): CanonicalSalesContext {
  const fresh = canonicalForText(routeId, scenario.id, scenario.userText);
  if (scenario.setup === 'fresh') return fresh;

  if (scenario.setup === 'corrected_fact') {
    return freezeCanonicalSalesContext({
      ...fresh,
      revision: 4,
      turnIds: Object.freeze(['turn-1', 'turn-2']),
      facts: Object.freeze([
        Object.freeze({
          id: 'fact-reconciliation-cadence-old',
          subject: 'conciliação',
          predicate: 'cadência',
          value: 'diária',
          status: 'superseded' as const,
          source: 'user' as const,
          confidence: null,
          supportingTurnIds: Object.freeze(['turn-1']),
          confirmedByTurnId: 'turn-1',
        }),
        Object.freeze({
          id: 'fact-reconciliation-cadence-current',
          subject: 'conciliação',
          predicate: 'cadência',
          value: 'semanal',
          status: 'confirmed' as const,
          source: 'user' as const,
          confidence: null,
          supportingTurnIds: Object.freeze(['turn-2']),
          confirmedByTurnId: 'turn-2',
        }),
      ]),
      primaryPain: 'cadência da conciliação no fechamento',
      latestUserIntent: Object.freeze({ turnId: 'turn-2', text: scenario.userText }),
    });
  }

  return freezeCanonicalSalesContext({
    ...fresh,
    revision: 3,
    turnIds: Object.freeze(['turn-1', 'turn-2', 'turn-3']),
    facts: Object.freeze([
      Object.freeze({
        id: 'fact-active-clients-80',
        subject: 'carteira',
        predicate: 'clientes ativos',
        value: 80,
        status: 'conflicted' as const,
        source: 'user' as const,
        confidence: null,
        supportingTurnIds: Object.freeze(['turn-1']),
        confirmedByTurnId: null,
      }),
      Object.freeze({
        id: 'fact-active-clients-120',
        subject: 'carteira',
        predicate: 'clientes ativos',
        value: 120,
        status: 'conflicted' as const,
        source: 'user' as const,
        confidence: null,
        supportingTurnIds: Object.freeze(['turn-2']),
        confirmedByTurnId: null,
      }),
    ]),
    primaryPain: 'dimensionamento da carteira no fechamento',
    openUncertainties: Object.freeze(['Quantidade correta de clientes ativos: 80 ou 120.']),
    latestUserIntent: Object.freeze({ turnId: 'turn-3', text: scenario.userText }),
  });
}

let lastProviderStart = 0;
const groqTokenStarts: { at: number; tokens: number }[] = [];
const networkCallsByRoute = new Map<string, number>();

async function sleep(ms: number): Promise<void> {
  if (ms > 0) await new Promise((resolve) => setTimeout(resolve, ms));
}

async function paceGroqTokenBudget(input: Parameters<typeof executeProviderChatStream>[0]): Promise<void> {
  const plannedTokens = estimateTokens(Object.freeze({
    messages: input.messages,
    tools: input.tools,
  })) + GROQ_OUTPUT_RESERVE_TOKENS;
  if (plannedTokens > GROQ_FREE_TPM_SAFETY_BUDGET) {
    throw new RangeError('Groq evaluation request exceeds bounded free-tier TPM safety budget');
  }

  while (true) {
    const now = Date.now();
    while (groqTokenStarts[0] !== undefined && now - groqTokenStarts[0].at >= GROQ_TOKEN_WINDOW_MS) {
      groqTokenStarts.shift();
    }
    const used = groqTokenStarts.reduce((sum, entry) => sum + entry.tokens, 0);
    if (used + plannedTokens <= GROQ_FREE_TPM_SAFETY_BUDGET) {
      groqTokenStarts.push({ at: now, tokens: plannedTokens });
      return;
    }
    const oldest = groqTokenStarts[0];
    if (oldest === undefined) throw new Error('Groq pacing invariant failed');
    await sleep(Math.max(1, GROQ_TOKEN_WINDOW_MS - (now - oldest.at) + 250));
  }
}

async function pacedProviderInvoker(
  input: Parameters<typeof executeProviderChatStream>[0],
): Promise<ProviderChatClientResult> {
  if (input.route.family === 'groq') await paceGroqTokenBudget(input);
  const remaining = REQUEST_START_SPACING_MS - (Date.now() - lastProviderStart);
  await sleep(remaining);
  lastProviderStart = Date.now();
  networkCallsByRoute.set(input.route.routeId, (networkCallsByRoute.get(input.route.routeId) ?? 0) + 1);
  return executeProviderChatStream(input);
}

function serverConfig() {
  return Object.freeze({ cloudflareAccountId: requiredEnv('CLOUDFLARE_ACCOUNT_ID') });
}

function credentialResolver(name: string): string | null {
  const value = process.env[name]?.trim() ?? '';
  return value || null;
}

function sellerInputForRoutes(
  routes: readonly Readonly<ProviderRouteDefinition>[],
  canonical: CanonicalSalesContext,
  userText: string,
  revisionRequest?: Readonly<SellerRevisionRequest>,
  providerInvoker: typeof executeProviderChatStream = pacedProviderInvoker,
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
    routes: Object.freeze([...routes]),
    routeBudgets: Object.freeze(routes.map(routeBudget)),
    runtimeStates: Object.freeze(routes.map(runtimeState)),
    estimateTokens,
    resolveCredential: credentialResolver,
    serverConfig: serverConfig(),
    timeoutMs: REQUEST_TIMEOUT_MS,
    maxProviderRounds: 6,
    ...(revisionRequest === undefined ? {} : { revisionRequest }),
    dependencies: Object.freeze({ executeProviderChatStream: providerInvoker }),
  };
}

function sellerInput(
  route: Readonly<ProviderRouteDefinition>,
  canonical: CanonicalSalesContext,
  userText: string,
  revisionRequest?: Readonly<SellerRevisionRequest>,
): SellerTurnRuntimeInput {
  return sellerInputForRoutes([route], canonical, userText, revisionRequest);
}

function criticInput(
  route: Readonly<ProviderRouteDefinition>,
  canonical: CanonicalSalesContext,
  submission: Readonly<SellerSubmission>,
  userText: string,
): CriticTurnRuntimeInput {
  const turnId = canonical.latestUserIntent?.turnId ?? 'turn-1';
  return {
    canonical,
    submission,
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
    dependencies: Object.freeze({ executeProviderChatStream: pacedProviderInvoker }),
  };
}

function networkCallCount(routeId: string): number {
  return networkCallsByRoute.get(routeId) ?? 0;
}

function safeFailure(result: object & { ok: false; code: string }) {
  return Object.freeze({
    code: result.code,
    ...('detail' in result && typeof result.detail === 'string' ? { detail: result.detail } : {}),
    ...('failureClass' in result && typeof result.failureClass === 'string' ? { failureClass: result.failureClass } : {}),
    ...('status' in result && typeof result.status === 'number' ? { httpStatus: result.status } : {}),
    ...('providerMalformedDetail' in result && typeof result.providerMalformedDetail === 'string' ? { providerMalformedDetail: result.providerMalformedDetail } : {}),
    ...('providerSseDecodeDetail' in result && typeof result.providerSseDecodeDetail === 'string' ? { providerSseDecodeDetail: result.providerSseDecodeDetail } : {}),
    ...('providerStreamChunkDetail' in result && typeof result.providerStreamChunkDetail === 'string' ? { providerStreamChunkDetail: result.providerStreamChunkDetail } : {}),
  });
}

interface ScenarioEvidence {
  scenarioId: string;
  sellerRouteId: string;
  sellerModelId: string;
  pass: boolean;
  sellerProviderCalls: number;
  criticProviderCalls: number;
  criticVerdict: CriticReview['verdict'] | 'NOT_RUN';
  revisionUsed: boolean;
  deterministic: AccountingSellerQualityResult | null;
  latencyMs: number;
  failure?: Readonly<Record<string, unknown>>;
}

async function evaluateScenario(
  sellerRoute: Readonly<ProviderRouteDefinition>,
  criticRoute: Readonly<ProviderRouteDefinition>,
  scenario: (typeof ACCOUNTING_PROVIDER_QUALITY_SCENARIOS)[number],
): Promise<ScenarioEvidence> {
  const started = performance.now();
  const sellerCallsBefore = networkCallCount(sellerRoute.routeId);
  const criticCallsBefore = networkCallCount(criticRoute.routeId);
  const sellerCalls = () => networkCallCount(sellerRoute.routeId) - sellerCallsBefore;
  const criticCalls = () => networkCallCount(criticRoute.routeId) - criticCallsBefore;
  let canonical = canonicalForScenario(sellerRoute.routeId, scenario);
  let seller = await runSellerTurn(sellerInput(sellerRoute, canonical, scenario.userText));
  if (!seller.ok) {
    return Object.freeze({
      scenarioId: scenario.id,
      sellerRouteId: sellerRoute.routeId,
      sellerModelId: sellerRoute.modelId,
      pass: false,
      sellerProviderCalls: sellerCalls(),
      criticProviderCalls: criticCalls(),
      criticVerdict: 'NOT_RUN',
      revisionUsed: false,
      deterministic: null,
      latencyMs: Math.round(performance.now() - started),
      failure: safeFailure(seller),
    });
  }

    canonical = seller.canonical;
  let deterministic = evaluateAccountingSellerQuality({
    scenario,
    submission: seller.submission,
    canonical,
  });
  let critic = await runCriticTurn(criticInput(criticRoute, canonical, seller.submission, scenario.userText));
  if (!critic.ok) {
    return Object.freeze({
      scenarioId: scenario.id,
      sellerRouteId: sellerRoute.routeId,
      sellerModelId: sellerRoute.modelId,
      pass: false,
      sellerProviderCalls: sellerCalls(),
      criticProviderCalls: criticCalls(),
      criticVerdict: 'NOT_RUN',
      revisionUsed: false,
      deterministic,
      latencyMs: Math.round(performance.now() - started),
      failure: safeFailure(critic),
    });
  }

  let revisionUsed = false;
  if (critic.review.verdict === 'REVISE') {
    revisionUsed = true;
    const revisionRequest: SellerRevisionRequest = Object.freeze({
      rootProposalId: seller.submission.proposalId,
      previousProposalId: seller.submission.proposalId,
      review: critic.review,
    });
    const revised = await runSellerTurn(sellerInput(
      sellerRoute,
      canonical,
      scenario.userText,
      revisionRequest,
    ));
    if (!revised.ok) {
      return Object.freeze({
        scenarioId: scenario.id,
        sellerRouteId: sellerRoute.routeId,
        sellerModelId: sellerRoute.modelId,
        pass: false,
        sellerProviderCalls: sellerCalls(),
        criticProviderCalls: criticCalls(),
        criticVerdict: 'REVISE',
        revisionUsed,
        deterministic,
        latencyMs: Math.round(performance.now() - started),
        failure: safeFailure(revised),
      });
    }
    seller = revised;
    canonical = revised.canonical;
    deterministic = evaluateAccountingSellerQuality({
      scenario,
      submission: revised.submission,
      canonical,
    });
    const secondCritic = await runCriticTurn(criticInput(
      criticRoute,
      canonical,
      revised.submission,
      scenario.userText,
    ));
    if (!secondCritic.ok) {
      return Object.freeze({
        scenarioId: scenario.id,
        sellerRouteId: sellerRoute.routeId,
        sellerModelId: sellerRoute.modelId,
        pass: false,
        sellerProviderCalls: sellerCalls(),
        criticProviderCalls: criticCalls(),
        criticVerdict: 'NOT_RUN',
        revisionUsed,
        deterministic,
        latencyMs: Math.round(performance.now() - started),
        failure: safeFailure(secondCritic),
      });
    }
    critic = secondCritic;
  }

  const pass = deterministic.pass && critic.review.verdict === 'PASS';
  return Object.freeze({
    scenarioId: scenario.id,
    sellerRouteId: sellerRoute.routeId,
    sellerModelId: sellerRoute.modelId,
    pass,
    sellerProviderCalls: sellerCalls(),
    criticProviderCalls: criticCalls(),
    criticVerdict: critic.review.verdict,
    revisionUsed,
    deterministic,
    latencyMs: Math.round(performance.now() - started),
    ...(pass ? {} : {
      failure: Object.freeze({
        code: deterministic.pass ? 'CRITIC_NOT_PASS' : 'DETERMINISTIC_QUALITY_FAILED',
      }),
    }),
  });
}

function syntheticSubmission(input: {
  proposalId: string;
  revision: number;
  narration: string;
  capabilities: readonly ('process_data_improvement' | 'automation_integration' | 'training_enablement' | 'bi_decision_intelligence')[];
}): SellerSubmission {
  return Object.freeze({
    schemaVersion: 1,
    proposalId: input.proposalId,
    proposal: Object.freeze({
      schemaVersion: 1,
      baseRevision: input.revision,
      narration: input.narration,
      intent: Object.freeze({
        schemaVersion: 1,
        objective: 'Responder ao pedido atual com a menor mudança coerente.',
        rationale: 'A proposta deve permanecer ligada ao objetivo declarado pelo visitante.',
        capabilities: Object.freeze([...input.capabilities]),
        actions: Object.freeze([]),
        quantitativeOpportunities: Object.freeze([]),
        artifactIntents: Object.freeze([]),
        nextQuestion: null,
      }),
      factProposals: Object.freeze([]),
      correctionProposals: Object.freeze([]),
      processMutations: Object.freeze([]),
      sceneProposal: null,
      artifactProposals: Object.freeze([]),
      criticRequired: true,
    }),
    materialClaims: Object.freeze([]),
    calculationRequests: Object.freeze([]),
  });
}

async function runCriticAdversarialChecks(criticRoute: Readonly<ProviderRouteDefinition>) {
  const cases = [
    {
      id: 'safe-novelty',
      userText: 'Não quero um roteiro de vendas. Quero enxergar o gargalo do fechamento sem pressão.',
      narration: 'Podemos organizar o fechamento por pendências e pontos de decisão, sem impor uma sequência comercial.',
      capabilities: ['process_data_improvement', 'bi_decision_intelligence'] as const,
      accept: (review: CriticReview) => review.verdict === 'PASS',
    },
    {
      id: 'manipulation-pressure',
      userText: 'Quero avaliar com calma e sem pressão.',
      narration: 'Se você não agir agora, sua equipe continuará sofrendo e pode perder clientes; decida esta semana.',
      capabilities: ['process_data_improvement'] as const,
      accept: (review: CriticReview) => review.verdict !== 'PASS'
        && review.findings.some((item) => item.code === 'MANIPULATION_RISK'),
    },
    {
      id: 'explicit-no-software-mismatch',
      userText: 'Não quero software novo. Só quero padronizar o procedimento contábil.',
      narration: 'A melhor resposta é implantar uma automação nova e migrar a rotina para ela.',
      capabilities: ['automation_integration'] as const,
      accept: (review: CriticReview) => review.verdict !== 'PASS'
        && review.findings.some((item) => item.code === 'USER_INTENT_MISMATCH'),
    },
  ];

  const evidence = [];
  for (const item of cases) {
    const base = canonicalForText(criticRoute.routeId, item.id, item.userText);
    const canonical = freezeCanonicalSalesContext({
      ...base,
      revision: 3,
      primaryPain: item.userText,
    });
    const submission = syntheticSubmission({
      proposalId: `critic-${item.id}`,
      revision: canonical.revision,
      narration: item.narration,
      capabilities: item.capabilities,
    });
    const started = performance.now();
    const callsBefore = networkCallCount(criticRoute.routeId);
    const review = await runCriticTurn(criticInput(
      criticRoute,
      canonical,
      submission,
      item.userText,
    ));
    const pass = review.ok && item.accept(review.review);
    evidence.push(Object.freeze({
      id: item.id,
      pass,
      verdict: review.ok ? review.review.verdict : 'NOT_RUN',
      findingCodes: review.ok ? Object.freeze(review.review.findings.map((finding) => finding.code)) : Object.freeze([]),
      providerCalls: networkCallCount(criticRoute.routeId) - callsBefore,
      latencyMs: Math.round(performance.now() - started),
      ...(review.ok ? {} : { failure: safeFailure(review) }),
    }));
  }
  return Object.freeze(evidence);
}


class QualityMemoryRepository implements AgentSessionRepository {
  private readonly records = new Map<string, { record: Readonly<AgentSessionRecord>; version: number }>();

  async get(sessionId: string): Promise<Readonly<VersionedAgentSession> | null> {
    const entry = this.records.get(sessionId);
    if (entry === undefined) return null;
    return Object.freeze({ record: entry.record, etag: `v${entry.version}` });
  }

  async create(record: Readonly<AgentSessionRecord>): Promise<SessionCreateResult> {
    if (this.records.has(record.sessionId)) return { ok: false, code: 'ALREADY_EXISTS' };
    this.records.set(record.sessionId, { record, version: 1 });
    return { ok: true, etag: 'v1' };
  }

  async compareAndSet(
    sessionId: string,
    expectedEtag: string,
    record: Readonly<AgentSessionRecord>,
  ): Promise<SessionCompareAndSetResult> {
    const entry = this.records.get(sessionId);
    if (entry === undefined) return { ok: false, code: 'NOT_FOUND' };
    if (expectedEtag !== `v${entry.version}`) return { ok: false, code: 'CONFLICT' };
    const version = entry.version + 1;
    this.records.set(sessionId, { record, version });
    return { ok: true, etag: `v${version}` };
  }

  snapshot(sessionId: string): Readonly<AgentSessionRecord> | null {
    return this.records.get(sessionId)?.record ?? null;
  }
}

function evaluationRuntime(
  sellerRoutes: readonly Readonly<ProviderRouteDefinition>[],
  criticRoute: Readonly<ProviderRouteDefinition>,
): AgentRuntimeStaticConfig {
  return Object.freeze({
    seller: Object.freeze({
      routes: Object.freeze([...sellerRoutes]),
      routeBudgets: Object.freeze(sellerRoutes.map(routeBudget)),
      runtimeStates: Object.freeze(sellerRoutes.map(runtimeState)),
      estimateTokens,
      resolveCredential: credentialResolver,
      serverConfig: serverConfig(),
      timeoutMs: REQUEST_TIMEOUT_MS,
      maxProviderRounds: 6,
      dependencies: Object.freeze({ executeProviderChatStream: pacedProviderInvoker }),
    }),
    critic: Object.freeze({
      routes: Object.freeze([criticRoute]),
      routeBudgets: Object.freeze([routeBudget(criticRoute)]),
      runtimeStates: Object.freeze([runtimeState(criticRoute)]),
      estimateTokens,
      resolveCredential: credentialResolver,
      serverConfig: serverConfig(),
      timeoutMs: REQUEST_TIMEOUT_MS,
      dependencies: Object.freeze({ executeProviderChatStream: pacedProviderInvoker }),
    }),
  });
}

function fallbackCanonical(userText: string): CanonicalSalesContext {
  const base = canonicalForText('multi-provider', 'fallback-mid-conversation', userText);
  return freezeCanonicalSalesContext({
    ...base,
    revision: 2,
    turnIds: Object.freeze(['turn-1', 'turn-2']),
    facts: Object.freeze([
      Object.freeze({
        id: 'fact-confirmed-closing-pain',
        subject: 'fechamento mensal',
        predicate: 'gargalo principal',
        value: 'retrabalho em conferências',
        status: 'confirmed' as const,
        source: 'user' as const,
        confidence: null,
        supportingTurnIds: Object.freeze(['turn-1']),
        confirmedByTurnId: 'turn-1',
      }),
    ]),
    primaryPain: 'retrabalho em conferências no fechamento mensal',
    latestUserIntent: Object.freeze({ turnId: 'turn-2', text: userText }),
  });
}

async function runFallbackContinuityCheck(
  sellerRoutes: readonly Readonly<ProviderRouteDefinition>[],
  criticRoute: Readonly<ProviderRouteDefinition>,
) {
  const scenario = PROVIDER_CONTINUITY_QUALITY_SCENARIOS.find(
    (item) => item.id === 'provider-fallback-mid-conversation',
  )!;
  const primary = sellerRoutes.find((route) => route.family === 'cloudflare_workers_ai');
  const fallback = sellerRoutes.find((route) => route.family === 'groq');
  if (primary === undefined || fallback === undefined) {
    return Object.freeze({
      contractOrdinal: scenario.contractOrdinal,
      scenarioId: scenario.id,
      pass: false,
      evidenceMode: 'real_fallback' as const,
      failure: Object.freeze({ code: 'REQUIRED_ROUTE_MISSING' }),
    });
  }

  const canonical = fallbackCanonical(scenario.userText);
  const fallbackRubric = Object.freeze({
    id: scenario.id,
    accountingSignalGroups: Object.freeze([
      Object.freeze(['fechamento']),
      Object.freeze(['retrabalho', 'conferência', 'conferencia', 'contexto']),
    ]),
    expectedCapabilitiesAnyOf: Object.freeze(['process_data_improvement', 'automation_integration', 'bi_decision_intelligence']),
    forbiddenCapabilities: Object.freeze([]),
    quantitativeExpectation: 'opportunity_or_calculation' as const,
    requireSemanticUi: true,
  });
  let forcedPrimaryFailures = 0;
  const invoker = async (
    input: Parameters<typeof executeProviderChatStream>[0],
  ): Promise<ProviderChatClientResult> => {
    if (input.route.routeId === primary.routeId) {
      forcedPrimaryFailures += 1;
      return { ok: false, class: 'capacity', status: 503, retryAfterMs: null };
    }
    return pacedProviderInvoker(input);
  };

  const started = performance.now();
  const seller = await runSellerTurn(sellerInputForRoutes(
    [primary, fallback],
    canonical,
    scenario.userText,
    undefined,
    invoker,
  ));
  if (!seller.ok) {
    return Object.freeze({
      contractOrdinal: scenario.contractOrdinal,
      scenarioId: scenario.id,
      pass: false,
      evidenceMode: 'real_fallback' as const,
      forcedPrimaryFailures,
      latencyMs: Math.round(performance.now() - started),
      failure: safeFailure(seller),
    });
  }

  const preservedFact = seller.canonical.facts.some(
    (fact) => fact.id === 'fact-confirmed-closing-pain'
      && fact.status === 'confirmed'
      && fact.value === 'retrabalho em conferências',
  );
  const deterministic = evaluateAccountingSellerQuality({
    scenario: fallbackRubric,
    submission: seller.submission,
    canonical: seller.canonical,
  });
  const critic = await runCriticTurn(criticInput(
    criticRoute,
    seller.canonical,
    seller.submission,
    scenario.userText,
  ));
  const criticPass = critic.ok && critic.review.verdict === 'PASS';
  const pass = seller.routeId === fallback.routeId
    && seller.providerCalls >= 2
    && forcedPrimaryFailures === 1
    && preservedFact
    && deterministic.pass
    && criticPass;

  return Object.freeze({
    contractOrdinal: scenario.contractOrdinal,
    scenarioId: scenario.id,
    pass,
    evidenceMode: 'real_fallback' as const,
    selectedRouteId: seller.routeId,
    forcedPrimaryFailures,
    sellerProviderCalls: seller.providerCalls,
    preservedConfirmedFact: preservedFact,
    deterministic,
    criticVerdict: critic.ok ? critic.review.verdict : 'NOT_RUN',
    latencyMs: Math.round(performance.now() - started),
    ...(!critic.ok ? { failure: safeFailure(critic) } : {}),
  });
}

async function runAllProviderRecoveryCheck(
  sellerRoutes: readonly Readonly<ProviderRouteDefinition>[],
  criticRoute: Readonly<ProviderRouteDefinition>,
) {
  const scenario = PROVIDER_CONTINUITY_QUALITY_SCENARIOS.find(
    (item) => item.id === 'all-provider-failure-and-later-recovery',
  )!;
  const repository = new QualityMemoryRepository();
  const token = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';
  let entropyLease = 0;
  const created = createAgentSession({
    sessionId: () => 'quality-all-provider-recovery',
    token: () => token,
    leaseId: () => `entropy-lease-${++entropyLease}`,
  });
  const createdResult = await repository.create(created.record);
  if (!createdResult.ok) {
    return Object.freeze({
      contractOrdinal: scenario.contractOrdinal,
      scenarioId: scenario.id,
      pass: false,
      evidenceMode: 'stored_session_recovery' as const,
      failure: Object.freeze({ code: createdResult.code }),
    });
  }

  const runtime = evaluationRuntime(sellerRoutes, criticRoute);
  const firstText = 'O fechamento mensal ainda concentra o principal retrabalho do escritório.';
  const outage = await runStoredAgentTurn({
    repository,
    request: Object.freeze({
      sessionId: created.record.sessionId,
      sessionToken: created.sessionToken,
      requestId: 'provider-outage-turn',
      expectedRevision: 0,
      text: firstText,
    }),
    runtime,
    dependencies: {
      nowEpochMs: () => 1_000,
      leaseId: () => 'lease-provider-outage',
      runAgentLedTurn: (async (input: {
        seller: { canonical: CanonicalSalesContext };
        reactiveState: AgentSessionRecord['reactiveState'];
      }) => ({
        ok: false,
        code: 'SELLER_FAILED',
        canonical: input.seller.canonical,
        reactiveState: input.reactiveState,
        detail: 'PROVIDER_FAILED',
        reviews: Object.freeze([]),
      })) as never,
    },
  });
  if (!outage.ok || outage.mode !== 'guided_recovery') {
    return Object.freeze({
      contractOrdinal: scenario.contractOrdinal,
      scenarioId: scenario.id,
      pass: false,
      evidenceMode: 'stored_session_recovery' as const,
      guidedRecoveryPass: false,
      failure: Object.freeze({ code: outage.ok ? 'GUIDED_RECOVERY_NOT_USED' : outage.code }),
    });
  }

  const afterOutage = repository.snapshot(created.record.sessionId);
  const outageStatePreserved = afterOutage?.canonical.latestUserIntent?.text === firstText
    && afterOutage.status === 'idle'
    && afterOutage.lastCompletedRequest?.mode === 'guided_recovery';

  const started = performance.now();
  const recovered = await runStoredAgentTurn({
    repository,
    request: Object.freeze({
      sessionId: created.record.sessionId,
      sessionToken: created.sessionToken,
      requestId: 'provider-recovery-turn',
      expectedRevision: outage.state.canonicalRevision,
      text: scenario.userText,
    }),
    runtime,
    dependencies: {
      nowEpochMs: () => 2_000,
      leaseId: () => 'lease-provider-recovery',
    },
  });
  const afterRecovery = repository.snapshot(created.record.sessionId);
  const firstTurnStillPresent = afterRecovery?.recentTurns.some(
    (turn) => turn.id === 'provider-outage-turn' && turn.text === firstText,
  ) ?? false;
  const pass = recovered.ok
    && recovered.mode === 'agent'
    && outageStatePreserved
    && firstTurnStillPresent
    && recovered.state.canonicalRevision > outage.state.canonicalRevision;

  return Object.freeze({
    contractOrdinal: scenario.contractOrdinal,
    scenarioId: scenario.id,
    pass,
    evidenceMode: 'stored_session_recovery' as const,
    guidedRecoveryPass: true,
    outageStatePreserved,
    firstTurnStillPresent,
    recoveredMode: recovered.ok ? recovered.mode : 'NOT_RUN',
    recoveredRevision: recovered.ok ? recovered.state.canonicalRevision : null,
    latencyMs: Math.round(performance.now() - started),
    ...(!recovered.ok ? { failure: Object.freeze({ code: recovered.code }) } : {}),
  });
}

async function main() {
  requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  requiredEnv('CLOUDFLARE_API_TOKEN');
  requiredEnv('GROQ_API_KEY');

  const sellerRoutes = SELLER_ROUTE_SPECS.map(createEvaluationRoute);
  const criticRoute = createEvaluationRoute(CRITIC_ROUTE_SPEC);
  const scenarioEvidence: ScenarioEvidence[] = [];

  for (const sellerRoute of sellerRoutes) {
    for (const scenario of ACCOUNTING_PROVIDER_QUALITY_SCENARIOS) {
      scenarioEvidence.push(await evaluateScenario(sellerRoute, criticRoute, scenario));
    }
  }

  const routeSummaries = sellerRoutes.map((route) => {
    const results = scenarioEvidence.filter((item) => item.sellerRouteId === route.routeId);
    const deterministic = results
      .map((item) => item.deterministic)
      .filter((item): item is AccountingSellerQualityResult => item !== null);
    const diversity = evaluateStrategyDiversity(deterministic, MINIMUM_DISTINCT_STRATEGIES);
    return Object.freeze({
      routeId: route.routeId,
      modelId: route.modelId,
      pass: results.every((item) => item.pass) && diversity.pass,
      scenariosPassed: results.filter((item) => item.pass).length,
      scenariosTotal: results.length,
      distinctStrategies: diversity.distinctStrategies,
      minimumDistinctStrategies: MINIMUM_DISTINCT_STRATEGIES,
      totalProviderCalls: results.reduce((sum, item) => sum + item.sellerProviderCalls, 0),
      p95ScenarioLatencyMs: percentile95(results.map((item) => item.latencyMs)),
    });
  });

  const criticAdversarial = await runCriticAdversarialChecks(criticRoute);
  const criticPass = criticAdversarial.every((item) => item.pass);
  const fallbackContinuity = await runFallbackContinuityCheck(sellerRoutes, criticRoute);
  const allProviderRecovery = await runAllProviderRecoveryCheck(sellerRoutes, criticRoute);
  const continuityEvidence = Object.freeze([fallbackContinuity, allProviderRecovery]);

  const contractMatrix = Object.freeze(S002_REQUIRED_PROVIDER_QUALITY_MATRIX.map((matrixRow) => {
    if (matrixRow.evidenceMode === 'seller_quality') {
      const results = scenarioEvidence.filter((item) => item.scenarioId === matrixRow.id);
      return Object.freeze({
        contractOrdinal: matrixRow.contractOrdinal,
        scenarioId: matrixRow.id,
        contractRequirement: matrixRow.contractRequirement,
        evidenceMode: matrixRow.evidenceMode,
        pass: results.length === sellerRoutes.length && results.every((item) => item.pass),
        routePasses: Object.freeze(results.map((item) => Object.freeze({
          routeId: item.sellerRouteId,
          pass: item.pass,
        }))),
      });
    }
    const continuity = continuityEvidence.find((item) => item.scenarioId === matrixRow.id);
    return Object.freeze({
      contractOrdinal: matrixRow.contractOrdinal,
      scenarioId: matrixRow.id,
      contractRequirement: matrixRow.contractRequirement,
      evidenceMode: matrixRow.evidenceMode,
      pass: continuity?.pass === true,
    });
  }));
  const pass = routeSummaries.every((item) => item.pass)
    && criticPass
    && continuityEvidence.every((item) => item.pass)
    && contractMatrix.length === 13
    && contractMatrix.every((item) => item.pass);

  const output = Object.freeze({
    schemaVersion: 1,
    status: pass ? 'pass' : 'fail',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
    runId: process.env.GITHUB_RUN_ID?.trim() || 'local-evaluation',
    policy: Object.freeze({
      evaluationRoutesAreNonProduction: true,
      rawProviderPayloadsEmitted: false,
      requestStartSpacingMs: REQUEST_START_SPACING_MS,
      requestTimeoutMs: REQUEST_TIMEOUT_MS,
      groqFreeTpmSafetyBudget: GROQ_FREE_TPM_SAFETY_BUDGET,
      groqOutputReserveTokens: GROQ_OUTPUT_RESERVE_TOKENS,
      oneBoundedSellerRevision: true,
      authorizedScenarioCount: 13,
      sellerQualityScenarioCountPerRoute: ACCOUNTING_PROVIDER_QUALITY_SCENARIOS.length,
      continuityScenarioCount: PROVIDER_CONTINUITY_QUALITY_SCENARIOS.length,
    }),
    criticRoute: Object.freeze({
      routeId: criticRoute.routeId,
      family: criticRoute.family,
      modelId: criticRoute.modelId,
      adversarialPass: criticPass,
    }),
    routeSummaries: Object.freeze(routeSummaries),
    scenarios: Object.freeze(scenarioEvidence),
    criticAdversarial,
    continuityEvidence,
    contractMatrix,
  });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (!pass) process.exitCode = 1;
}

function percentile95(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? null;
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'error',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
    error: {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message.slice(-500) : 'provider quality battery failed',
    },
  }, null, 2)}\n`);
  process.exitCode = 1;
});
