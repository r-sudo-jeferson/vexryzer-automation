import type { CanonicalSalesContext } from '../../../ai/context/canonical-sales-context.ts';
import type { CriticReview } from '../../../ai/critic/critic-contract.ts';
import { applyContextMutation } from '../../../ai/context/context-reducer.ts';
import {
  captureQuotedUserObservations,
  type UserObservationCaptureResult,
} from '../../../ai/context/user-evidence-ingestion.ts';
import {
  packageContext,
  type ContextPack,
  type CurrentExperienceState,
  type RecentContextTurn,
} from '../../../ai/context/context-packager.ts';
import {
  buildEmergencyContinuationCapsule,
  type EmergencyContinuationCapsule,
} from '../../../ai/context/emergency-capsule.ts';
import {
  assertProviderRouteBudget,
  availableInputTokens,
  type ProviderRouteBudget,
  type TokenEstimator,
} from '../../../ai/context/token-budget.ts';
import { computeVerifiedCalculation } from '../../../ai/quant/calculation-engine.ts';
import type { VerifiedCalculation } from '../../../ai/context/canonical-sales-context.ts';
import type { ProviderRouteDefinition } from '../../../ai/providers/provider-registry.ts';
import type { ProviderRuntimeState } from '../../../ai/providers/route-eligibility.ts';
import {
  selectProviderRoute,
  type ProviderContextMode,
  type ProviderFallbackReason,
  type ProviderRouteDecision,
  type ProviderRouteTokenUsage,
  type ProviderSelectionRequest,
} from '../../../ai/providers/provider-router.ts';
import {
  createProviderDispatchEnvelope,
  type CanonicalDispatchContext,
} from '../../../ai/providers/provider-dispatch.ts';
import {
  validateSellerSubmission,
  type SellerSubmission,
  type SellerSubmissionValidation,
} from '../../../ai/seller/seller-contract.ts';
import {
  executeProviderChatStream,
  type ProviderChatClientResult,
} from '../providers/provider-chat-client.ts';
import type {
  ProviderChatMessage,
  ProviderServerConfig,
} from '../providers/openai-chat-wire.ts';
import {
  parseSellerToolCall,
  SELLER_LOCAL_TOOLS,
  type SellerWireToolResult,
} from './seller-wire-tools.ts';

export interface SellerRouteBudgetConfig {
  routeId: string;
  budget: Readonly<ProviderRouteBudget>;
}

export interface SellerRevisionRequest { rootProposalId: string; previousProposalId: string; review: Readonly<CriticReview>; }

export type SellerCredentialResolver = (credentialEnvName: string) => string | null | undefined | Promise<string | null | undefined>;

export interface SellerTurnRuntimeDependencies {
  packageContext: typeof packageContext;
  buildEmergencyContinuationCapsule: typeof buildEmergencyContinuationCapsule;
  selectProviderRoute: typeof selectProviderRoute;
  createProviderDispatchEnvelope: typeof createProviderDispatchEnvelope;
  parseSellerToolCall: typeof parseSellerToolCall;
  computeVerifiedCalculation: typeof computeVerifiedCalculation;
  applyContextMutation: typeof applyContextMutation;
  captureQuotedUserObservations: typeof captureQuotedUserObservations;
  validateSellerSubmission: typeof validateSellerSubmission;
  executeProviderChatStream: typeof executeProviderChatStream;
}

export interface SellerTurnRuntimeInput {
  canonical: CanonicalSalesContext;
  digest: Parameters<typeof packageContext>[0]['digest'];
  recentTurns: readonly RecentContextTurn[];
  visualState: CurrentExperienceState;
  routes: readonly Readonly<ProviderRouteDefinition>[];
  routeBudgets: readonly Readonly<SellerRouteBudgetConfig>[];
  runtimeStates: readonly Readonly<ProviderRuntimeState>[];
  estimateTokens: TokenEstimator;
  resolveCredential: SellerCredentialResolver;
  serverConfig: Readonly<ProviderServerConfig>;
  timeoutMs: number;
  signal?: AbortSignal;
  maxProviderRounds?: number;
  revisionRequest?: Readonly<SellerRevisionRequest>;
  dependencies?: Partial<SellerTurnRuntimeDependencies>;
}

export type SellerTurnRuntimeResult =
  | {
      ok: true;
      canonical: CanonicalSalesContext;
      submission: Readonly<SellerSubmission>;
      routeId: string;
      providerRounds: number;
      providerCalls: number;
    }
  | {
      ok: false;
      code: 'INVALID_RUNTIME_CONFIG';
      canonical: CanonicalSalesContext;
      detail: 'ROUTE_BUDGET_MISMATCH' | 'INVALID_ROUND_LIMIT' | 'INVALID_TIMEOUT' | 'DUPLICATE_ROUTE' | 'DUPLICATE_RUNTIME_STATE' | 'INVALID_REVISION_REQUEST';
    }
  | {
      ok: false;
      code: 'CONTEXT_PREPARATION_FAILED';
      canonical: CanonicalSalesContext;
      routeId: string;
      detail: string;
    }
  | {
      ok: false;
      code: 'NO_ELIGIBLE_ROUTE';
      canonical: CanonicalSalesContext;
    }
  | {
      ok: false;
      code: 'DISPATCH_REJECTED';
      canonical: CanonicalSalesContext;
      routeId: string;
      detail: string;
    }
  | {
      ok: false;
      code: 'CREDENTIAL_UNAVAILABLE';
      canonical: CanonicalSalesContext;
      routeId: string;
    }
  | {
      ok: false;
      code: 'PROVIDER_FAILED';
      canonical: CanonicalSalesContext;
      routeId: string;
      failureClass: Exclude<ProviderChatClientResult, { ok: true }>['class'];
      status: number | null;
      retryAfterMs: number | null;
      providerMalformedDetail?: Exclude<ProviderChatClientResult, { ok: true }>['malformedDetail'];
      providerSseDecodeDetail?: Exclude<ProviderChatClientResult, { ok: true }>['sseDecodeDetail'];
      providerStreamChunkDetail?: Exclude<ProviderChatClientResult, { ok: true }>['streamChunkDetail'];
    }
  | {
      ok: false;
      code: 'INVALID_PROVIDER_OUTPUT';
      canonical: CanonicalSalesContext;
      routeId: string;
      detail: string;
    }
  | {
      ok: false;
      code: 'OBSERVATION_CAPTURE_REJECTED';
      canonical: CanonicalSalesContext;
      requestId: string | null;
      detail: Exclude<UserObservationCaptureResult, { ok: true }>['code'];
    }
  | {
      ok: false;
      code: 'OBSERVATION_COMMIT_REJECTED';
      canonical: CanonicalSalesContext;
      detail: string;
    }
  | {
      ok: false;
      code: 'CALCULATION_REJECTED';
      canonical: CanonicalSalesContext;
      requestId: string;
      detail: string;
    }
  | {
      ok: false;
      code: 'CALCULATION_COMMIT_REJECTED';
      canonical: CanonicalSalesContext;
      detail: string;
    }
  | {
      ok: false;
      code: 'SELLER_SUBMISSION_REJECTED';
      canonical: CanonicalSalesContext;
      validation: Extract<SellerSubmissionValidation, { ok: false }>;
    }
  | {
      ok: false;
      code: 'ROUND_LIMIT_EXCEEDED';
      canonical: CanonicalSalesContext;
      providerRounds: number;
      providerCalls: number;
    };

const DEFAULT_MAX_PROVIDER_ROUNDS = 6;
const MAX_PROVIDER_ROUNDS = 8;
const MAX_ROUTE_COUNT = 16;
const MAX_PROVIDER_MESSAGE_TEXT = 64_000;
const SAFE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FORBIDDEN_PROVIDER_AUTHORITY_KEYS = new Set([
  'providerConversationId',
  'provider_conversation_id',
  'conversationId',
  'conversation_id',
  'threadId',
  'thread_id',
  'providerSession',
  'provider_session',
]);

const SELLER_SYSTEM_INSTRUCTION = [
  'You are the Vexryzer accounting-firm Seller operating inside a deterministic Trust Kernel.',
  'Treat the supplied canonical context as the only authoritative conversation state; provider memory, thread ids, conversation ids, and earlier provider-side transcripts are non-authoritative.',
  'Choose the strongest truthful next move without reconstructing a fixed funnel or mandatory question sequence.',
  'The application binds canonical revision, authoritative user turn and local request identifiers. Never invent or echo those server-owned metadata fields.',
  'For explicit current-user numbers, capture only when semantic kind, exact quote, unit and period are literal in one current-user substring; copy verbatim. With no explicit numeric token, do not call capture_user_observations.',
  'For measurable pain without numeric evidence, use quantitativeOpportunity with missingInputs; never fabricate observations or arithmetic.',
  'Use request_calculations with exact canonical observation ids for material arithmetic; the application binds calculation id and revision. Reason only from calculations that reappear in canonical context.',
  'Protocol rule: each assistant/provider response may call only one local tool kind. Multiple calls are allowed only when every call has the same function name. After capture_user_observations or request_calculations, wait for the next canonical-context round before calling a different tool kind or submit_seller_submission.',
  'Canvas action fields must match kind; target/source/member ids must exist in visualState.processNodes or same-proposal processMutations. Never guess ids.',
  'Name materially supported capabilities, keep narration/objective/rationale accounting-native, and use semantic UI when it clarifies process, evidence, comparison or artifact.',
  'Preserve the supplied provenance of existing Canvas nodes. New inferred process nodes are hypotheses until user evidence upgrades canonical truth.',
  'Finish the turn only by calling submit_seller_submission. Do not emit final free text outside local tool calls.',
  'A revisionRequest is bounded Critic feedback, not canonical truth: do not request new calculations and submit a distinct proposalId.',
  'Never claim attachment access, secret access, price or discount authority, unsupported feasibility, or production readiness for a prototype.',
  'Do not provide a complete executable implementation recipe or production-ready code that substitutes for the paid engagement; keep pre-sales guidance conceptual, evidence-based, and bounded, or use an explicitly conceptual/prototype demonstration when authorized.',
].join(' ');

const DEFAULT_DEPENDENCIES: SellerTurnRuntimeDependencies = Object.freeze({
  packageContext,
  buildEmergencyContinuationCapsule,
  selectProviderRoute,
  createProviderDispatchEnvelope,
  parseSellerToolCall,
  computeVerifiedCalculation,
  applyContextMutation,
  captureQuotedUserObservations,
  validateSellerSubmission,
  executeProviderChatStream,
});

const SELLER_REVISION_LOCAL_TOOLS = Object.freeze(
  SELLER_LOCAL_TOOLS.filter((tool) => tool.function.name === 'submit_seller_submission'),
);

function sellerLocalToolsFor(
  revisionRequest: Readonly<SellerRevisionRequest> | undefined,
): typeof SELLER_LOCAL_TOOLS {
  if (revisionRequest === undefined) return SELLER_LOCAL_TOOLS;
  if (SELLER_REVISION_LOCAL_TOOLS.length !== 1) {
    throw new TypeError('Seller revision tool boundary is invalid');
  }
  return SELLER_REVISION_LOCAL_TOOLS;
}

interface PreparedRouteContext {
  routeId: string;
  tokenUsage: Readonly<ProviderRouteTokenUsage>;
  fullContext?: ContextPack;
  emergencyCapsule?: EmergencyContinuationCapsule;
}

interface PreparedRouteContexts {
  byRoute: ReadonlyMap<string, Readonly<PreparedRouteContext>>;
  selectionRequest: Readonly<ProviderSelectionRequest>;
}

interface SellerProviderMessageSource<TContext extends CanonicalDispatchContext = CanonicalDispatchContext> {
  role: ProviderRouteDecision['role'];
  canonicalRevision: number;
  contextMode: ProviderContextMode;
  fallbackReason: ProviderFallbackReason | null;
  context: TContext;
}

type PreparationResult =
  | { ok: true; prepared: PreparedRouteContexts }
  | { ok: false; routeId: string; detail: string };

function isBoundedPositiveInteger(value: number, max: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= max;
}

function validateRuntimeConfiguration(input: SellerTurnRuntimeInput): Extract<SellerTurnRuntimeResult, { ok: false; code: 'INVALID_RUNTIME_CONFIG' }> | null {
  const maxProviderRounds = input.maxProviderRounds ?? DEFAULT_MAX_PROVIDER_ROUNDS;
  if (!isBoundedPositiveInteger(maxProviderRounds, MAX_PROVIDER_ROUNDS)) {
    return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical: input.canonical, detail: 'INVALID_ROUND_LIMIT' };
  }
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 120_000) {
    return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical: input.canonical, detail: 'INVALID_TIMEOUT' };
  }
  if (input.routes.length < 1 || input.routes.length > MAX_ROUTE_COUNT || new Set(input.routes.map((route) => route.routeId)).size !== input.routes.length) {
    return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical: input.canonical, detail: 'DUPLICATE_ROUTE' };
  }
  if (new Set(input.runtimeStates.map((state) => state.routeId)).size !== input.runtimeStates.length) {
    return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical: input.canonical, detail: 'DUPLICATE_RUNTIME_STATE' };
  }
  if (input.revisionRequest !== undefined) {
    const q = input.revisionRequest;
    const validId = (value: string) => value.length >= 1 && value.length <= 96 && SAFE_ID_PATTERN.test(value);
    if (!validId(q.rootProposalId) || !validId(q.previousProposalId) || q.review.verdict !== 'REVISE'
      || q.review.proposalId !== q.previousProposalId || q.review.basedOnRevision !== input.canonical.revision
      || q.review.findings.length < 1) {
      return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical: input.canonical, detail: 'INVALID_REVISION_REQUEST' };
    }
  }
  if (input.routeBudgets.length !== input.routes.length || new Set(input.routeBudgets.map((item) => item.routeId)).size !== input.routeBudgets.length) {
    return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical: input.canonical, detail: 'ROUTE_BUDGET_MISMATCH' };
  }

  const routeIds = new Set(input.routes.map((route) => route.routeId));
  for (const item of input.routeBudgets) {
    if (!routeIds.has(item.routeId)) {
      return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical: input.canonical, detail: 'ROUTE_BUDGET_MISMATCH' };
    }
    try {
      assertProviderRouteBudget(item.budget);
    } catch {
      return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical: input.canonical, detail: 'ROUTE_BUDGET_MISMATCH' };
    }
    const route = input.routes.find((candidate) => candidate.routeId === item.routeId)!;
    if (
      route.maxInputTokens === null
      || route.emergencyInputTokens === null
      || route.maxInputTokens !== availableInputTokens(item.budget)
      || route.emergencyInputTokens !== item.budget.emergencyInputTokens
    ) {
      return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical: input.canonical, detail: 'ROUTE_BUDGET_MISMATCH' };
    }
  }
  return null;
}

function overflowTokenCount(measured: number | null, limit: number): number {
  if (measured !== null && Number.isFinite(measured) && measured > limit) return measured;
  return limit + 1;
}

function prepareRouteContexts(
  input: SellerTurnRuntimeInput,
  canonical: CanonicalSalesContext,
  dependencies: SellerTurnRuntimeDependencies,
): PreparationResult {
  const budgetByRoute = new Map(input.routeBudgets.map((item) => [item.routeId, item.budget] as const));
  const prepared = new Map<string, Readonly<PreparedRouteContext>>();
  const tokenUsage: ProviderRouteTokenUsage[] = [];

  for (const route of input.routes) {
    const budget = budgetByRoute.get(route.routeId)!;
    let fullContext: ContextPack | undefined;
    let emergencyCapsule: EmergencyContinuationCapsule | undefined;
    let fullContextInputTokens = 0;
    let emergencyCapsuleInputTokens = 0;

    if (route.tier === 'primary') {
      const packaged = dependencies.packageContext({
        role: 'seller',
        canonical,
        digest: input.digest,
        recentTurns: input.recentTurns,
        visualState: input.visualState,
        budget,
        estimateTokens: (contextPayload) => estimateSellerProviderInputTokens({
          role: 'seller',
          canonicalRevision: canonical.revision,
          contextMode: 'full',
          fallbackReason: null,
          context: contextPayload as CanonicalDispatchContext,
        }, input.estimateTokens, input.revisionRequest),
      });
      if (packaged.ok) {
        fullContext = packaged.pack;
        try {
          fullContextInputTokens = estimateSellerProviderInputTokens({
            role: 'seller',
            canonicalRevision: canonical.revision,
            contextMode: 'full',
            fallbackReason: null,
            context: fullContext,
          }, input.estimateTokens);
        } catch {
          return { ok: false, routeId: route.routeId, detail: 'INVALID_TOKEN_ESTIMATOR' };
        }
      } else if (packaged.code === 'CONTEXT_BUDGET_EXCEEDED') {
        fullContextInputTokens = overflowTokenCount(packaged.estimatedInputTokens, availableInputTokens(budget));
      } else {
        return { ok: false, routeId: route.routeId, detail: packaged.code };
      }
    } else if (route.tier !== 'standby' && route.enabledByDefault) {
      const capsule = dependencies.buildEmergencyContinuationCapsule({
        canonical,
        visualState: input.visualState,
        budget,
        estimateTokens: input.estimateTokens,
      });
      if (capsule.ok) {
        emergencyCapsule = capsule.capsule;
        emergencyCapsuleInputTokens = capsule.capsule.estimatedInputTokens;
      } else if (capsule.code === 'EMERGENCY_BUDGET_EXCEEDED') {
        emergencyCapsuleInputTokens = overflowTokenCount(capsule.estimatedInputTokens, budget.emergencyInputTokens);
      } else {
        return { ok: false, routeId: route.routeId, detail: capsule.code };
      }
    }

    const usage = Object.freeze({ routeId: route.routeId, fullContextInputTokens, emergencyCapsuleInputTokens });
    tokenUsage.push(usage);
    prepared.set(route.routeId, Object.freeze({
      routeId: route.routeId,
      tokenUsage: usage,
      ...(fullContext === undefined ? {} : { fullContext }),
      ...(emergencyCapsule === undefined ? {} : { emergencyCapsule }),
    }));
  }

  return {
    ok: true,
    prepared: {
      byRoute: prepared,
      selectionRequest: Object.freeze({
        role: 'seller',
        canonicalRevision: canonical.revision,
        fullContextInputTokens: tokenUsage.reduce((max, item) => Math.max(max, item.fullContextInputTokens), 0),
        emergencyCapsuleInputTokens: tokenUsage.reduce((max, item) => Math.max(max, item.emergencyCapsuleInputTokens), 0),
        requiresStreaming: true,
        requiresTools: true,
        requiresStructuredArguments: true,
        routeTokenUsage: Object.freeze(tokenUsage),
      }),
    },
  };
}

function selectedDispatch(
  decision: Readonly<ProviderRouteDecision>,
  context: Readonly<PreparedRouteContext>,
  dependencies: SellerTurnRuntimeDependencies,
) {
  if (decision.contextMode === 'full') {
    return context.fullContext === undefined
      ? dependencies.createProviderDispatchEnvelope({ decision })
      : dependencies.createProviderDispatchEnvelope({ decision, fullContext: context.fullContext });
  }
  return context.emergencyCapsule === undefined
    ? dependencies.createProviderDispatchEnvelope({ decision })
    : dependencies.createProviderDispatchEnvelope({ decision, emergencyCapsule: context.emergencyCapsule });
}

function containsForbiddenProviderAuthorityKey(value: unknown, seen = new Set<object>()): boolean {
  if (Array.isArray(value)) {
    if (seen.has(value)) return false;
    seen.add(value);
    return value.some((item) => containsForbiddenProviderAuthorityKey(item, seen));
  }
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return false;
  seen.add(value);
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_PROVIDER_AUTHORITY_KEYS.has(key)) return true;
    if (containsForbiddenProviderAuthorityKey(nested, seen)) return true;
  }
  return false;
}

export function buildSellerProviderMessages<TContext extends CanonicalDispatchContext>(
  envelope: Readonly<SellerProviderMessageSource<TContext>>,
  revisionRequest?: Readonly<SellerRevisionRequest>,
): readonly ProviderChatMessage[] {
  if (envelope.role !== 'seller') throw new TypeError('Seller messages require a seller dispatch envelope');
  if (envelope.context.canonicalRevision !== envelope.canonicalRevision) {
    throw new TypeError('Seller dispatch context revision mismatch');
  }
  if (containsForbiddenProviderAuthorityKey(envelope.context)) {
    throw new TypeError('Provider conversation authority is forbidden in Seller dispatch context');
  }

  if (revisionRequest !== undefined && (revisionRequest.review.verdict !== 'REVISE'
    || revisionRequest.review.proposalId !== revisionRequest.previousProposalId
    || revisionRequest.review.basedOnRevision !== envelope.canonicalRevision)) {
    throw new TypeError('Seller revision request is not bound to the canonical revision');
  }
  const payload = Object.freeze({
    schemaVersion: 1 as const,
    canonicalRevision: envelope.canonicalRevision,
    contextMode: envelope.contextMode,
    fallbackReason: envelope.fallbackReason,
    context: envelope.context,
    ...(revisionRequest === undefined ? {} : { revisionRequest }),
  });
  let content: string;
  try {
    content = JSON.stringify(payload);
  } catch {
    throw new TypeError('Seller dispatch context must be JSON serializable');
  }
  if (content.length < 1 || content.length > MAX_PROVIDER_MESSAGE_TEXT) {
    throw new TypeError('Seller dispatch message exceeds bounded wire size');
  }

  return Object.freeze([
    Object.freeze({ role: 'system' as const, content: SELLER_SYSTEM_INSTRUCTION }),
    Object.freeze({ role: 'user' as const, content }),
  ]);
}

function estimateSellerProviderInputTokens(
  source: Readonly<SellerProviderMessageSource>,
  estimateTokens: TokenEstimator,
  revisionRequest?: Readonly<SellerRevisionRequest>,
): number {
  const messages = buildSellerProviderMessages(source, revisionRequest);
  const measured = estimateTokens(Object.freeze({ messages, tools: sellerLocalToolsFor(revisionRequest) }));
  if (!Number.isInteger(measured) || measured < 0) {
    throw new TypeError('token estimator must return a non-negative integer');
  }
  return measured;
}

function withRouteTokenUsage(
  request: Readonly<ProviderSelectionRequest>,
  routeId: string,
  contextMode: ProviderContextMode,
  measuredInputTokens: number,
): Readonly<ProviderSelectionRequest> {
  if (request.routeTokenUsage === undefined) return request;
  const routeTokenUsage = request.routeTokenUsage.map((usage) => {
    if (usage.routeId !== routeId) return usage;
    return Object.freeze(contextMode === 'full'
      ? { ...usage, fullContextInputTokens: measuredInputTokens }
      : { ...usage, emergencyCapsuleInputTokens: measuredInputTokens });
  });
  return Object.freeze({ ...request, routeTokenUsage: Object.freeze(routeTokenUsage) });
}

function canFallbackAfterProviderFailure(failureClass: Exclude<ProviderChatClientResult, { ok: true }>['class']): boolean {
  return failureClass !== 'cancelled' && failureClass !== 'client';
}

function markRouteUnavailable(
  states: readonly Readonly<ProviderRuntimeState>[],
  routeId: string,
  failureClass: Exclude<ProviderChatClientResult, { ok: true }>['class'],
): readonly Readonly<ProviderRuntimeState>[] {
  return Object.freeze(states.map((state) => {
    if (state.routeId !== routeId) return state;
    if (failureClass === 'rate_limit' || failureClass === 'capacity') {
      return Object.freeze({ ...state, quota: 'exhausted' as const });
    }
    return Object.freeze({ ...state, circuit: 'open' as const });
  }));
}

function providerFailure(
  canonical: CanonicalSalesContext,
  routeId: string,
  failure: Exclude<ProviderChatClientResult, { ok: true }>,
): Extract<SellerTurnRuntimeResult, { ok: false; code: 'PROVIDER_FAILED' }> {
  return {
    ok: false,
    code: 'PROVIDER_FAILED',
    canonical,
    routeId,
    failureClass: failure.class,
    status: failure.status,
    retryAfterMs: failure.retryAfterMs,
    ...(failure.malformedDetail === undefined ? {} : { providerMalformedDetail: failure.malformedDetail }),
    ...(failure.sseDecodeDetail === undefined ? {} : { providerSseDecodeDetail: failure.sseDecodeDetail }),
    ...(failure.streamChunkDetail === undefined ? {} : { providerStreamChunkDetail: failure.streamChunkDetail }),
  };
}

function parseProviderTools(
  completion: Extract<ProviderChatClientResult, { ok: true }>['completion'],
  canonicalRevision: number,
  dependencies: SellerTurnRuntimeDependencies,
):
  | { ok: true; parsed: readonly Extract<SellerWireToolResult, { ok: true }>[] }
  | { ok: false; detail: string } {
  if (completion.content.trim().length > 0) return { ok: false, detail: 'FREE_TEXT_WITH_OR_WITHOUT_TOOLS' };
  if (completion.toolCalls.length < 1) return { ok: false, detail: 'TOOL_CALL_REQUIRED' };
  if (new Set(completion.toolCalls.map((call) => call.id)).size !== completion.toolCalls.length) {
    return { ok: false, detail: 'DUPLICATE_TOOL_CALL_ID' };
  }

  const parsed: Extract<SellerWireToolResult, { ok: true }>[] = [];
  for (const call of completion.toolCalls) {
    const result = dependencies.parseSellerToolCall(call, canonicalRevision);
    if (!result.ok) return { ok: false, detail: result.code };
    parsed.push(result);
  }
  const kinds = new Set(parsed.map((item) => item.kind));
  if (kinds.size !== 1) return { ok: false, detail: 'MIXED_TOOL_KINDS' };
  if (parsed[0]?.kind === 'seller_submission' && parsed.length !== 1) {
    return { ok: false, detail: 'MULTIPLE_SELLER_SUBMISSIONS' };
  }
  return { ok: true, parsed: Object.freeze(parsed) };
}

export async function runSellerTurn(input: SellerTurnRuntimeInput): Promise<SellerTurnRuntimeResult> {
  const invalid = validateRuntimeConfiguration(input);
  if (invalid !== null) return invalid;

  const dependencies: SellerTurnRuntimeDependencies = Object.freeze({ ...DEFAULT_DEPENDENCIES, ...input.dependencies });
  const maxProviderRounds = input.maxProviderRounds ?? DEFAULT_MAX_PROVIDER_ROUNDS;
  const activeTools = sellerLocalToolsFor(input.revisionRequest);
  let canonical = input.canonical;
  let runtimeStates: readonly Readonly<ProviderRuntimeState>[] = Object.freeze([...input.runtimeStates]);
  let providerCalls = 0;

  for (let providerRound = 1; providerRound <= maxProviderRounds; providerRound += 1) {
    const preparation = prepareRouteContexts(input, canonical, dependencies);
    if (!preparation.ok) {
      return { ok: false, code: 'CONTEXT_PREPARATION_FAILED', canonical, routeId: preparation.routeId, detail: preparation.detail };
    }

    const attemptedRoutes = new Set<string>();
    let selectionRequest = preparation.prepared.selectionRequest;
    let measurementAdjustments = 0;
    let successful: { decision: Readonly<ProviderRouteDecision>; completion: Extract<ProviderChatClientResult, { ok: true }>['completion'] } | null = null;

    while (attemptedRoutes.size < input.routes.length) {
      const decision = dependencies.selectProviderRoute(input.routes, selectionRequest, runtimeStates);
      if (!decision.ok) return { ok: false, code: 'NO_ELIGIBLE_ROUTE', canonical };
      if (decision.canonicalRevision !== canonical.revision || attemptedRoutes.has(decision.route.routeId)) {
        return { ok: false, code: 'INVALID_RUNTIME_CONFIG', canonical, detail: 'ROUTE_BUDGET_MISMATCH' };
      }

      const preparedContext = preparation.prepared.byRoute.get(decision.route.routeId);
      if (preparedContext === undefined) {
        return { ok: false, code: 'DISPATCH_REJECTED', canonical, routeId: decision.route.routeId, detail: 'SELECTED_CONTEXT_MISSING' };
      }
      const dispatch = selectedDispatch(decision, preparedContext, dependencies);
      if (!dispatch.ok) {
        return { ok: false, code: 'DISPATCH_REJECTED', canonical, routeId: decision.route.routeId, detail: dispatch.code };
      }

      let messages: readonly ProviderChatMessage[];
      try {
        messages = buildSellerProviderMessages(dispatch.envelope, input.revisionRequest);
      } catch {
        return { ok: false, code: 'DISPATCH_REJECTED', canonical, routeId: decision.route.routeId, detail: 'MESSAGE_BUILD_FAILED' };
      }

      let exactInputTokens: number;
      try {
        exactInputTokens = input.estimateTokens(Object.freeze({ messages, tools: activeTools }));
        if (!Number.isInteger(exactInputTokens) || exactInputTokens < 0) throw new TypeError('invalid token estimate');
      } catch {
        return { ok: false, code: 'CONTEXT_PREPARATION_FAILED', canonical, routeId: decision.route.routeId, detail: 'INVALID_TOKEN_ESTIMATOR' };
      }

      if (exactInputTokens !== decision.requirements.inputTokens) {
        measurementAdjustments += 1;
        if (measurementAdjustments > input.routes.length * 2) {
          return { ok: false, code: 'CONTEXT_PREPARATION_FAILED', canonical, routeId: decision.route.routeId, detail: 'UNSTABLE_TOKEN_ESTIMATOR' };
        }
        selectionRequest = withRouteTokenUsage(selectionRequest, decision.route.routeId, decision.contextMode, exactInputTokens);
        continue;
      }
      attemptedRoutes.add(decision.route.routeId);

      let credential: string | null | undefined;
      try {
        credential = await input.resolveCredential(dispatch.envelope.credentialEnvName);
      } catch {
        credential = null;
      }
      if (typeof credential !== 'string' || credential.length === 0) {
        return { ok: false, code: 'CREDENTIAL_UNAVAILABLE', canonical, routeId: decision.route.routeId };
      }

      const baseExecutionInput = {
        route: decision.route,
        serverConfig: input.serverConfig,
        apiToken: credential,
        messages,
        tools: activeTools,
        timeoutMs: input.timeoutMs,
      };
      let providerResult: ProviderChatClientResult;
      try {
        providerResult = input.signal === undefined
          ? await dependencies.executeProviderChatStream(baseExecutionInput)
          : await dependencies.executeProviderChatStream({ ...baseExecutionInput, signal: input.signal });
      } catch {
        providerResult = { ok: false, class: 'unknown', status: null, retryAfterMs: null };
      }
      providerCalls += 1;

      if (!providerResult.ok) {
        if (!canFallbackAfterProviderFailure(providerResult.class)) {
          return providerFailure(canonical, decision.route.routeId, providerResult);
        }
        runtimeStates = markRouteUnavailable(runtimeStates, decision.route.routeId, providerResult.class);
        if (attemptedRoutes.size >= input.routes.length) {
          return providerFailure(canonical, decision.route.routeId, providerResult);
        }
        continue;
      }

      successful = { decision, completion: providerResult.completion };
      break;
    }

    if (successful === null) return { ok: false, code: 'NO_ELIGIBLE_ROUTE', canonical };

    const tools = parseProviderTools(successful.completion, canonical.revision, dependencies);
    if (!tools.ok) {
      return { ok: false, code: 'INVALID_PROVIDER_OUTPUT', canonical, routeId: successful.decision.route.routeId, detail: tools.detail };
    }

    const first = tools.parsed[0]!;
    if (input.revisionRequest !== undefined && first.kind !== 'seller_submission') {
      return { ok: false, code: 'INVALID_PROVIDER_OUTPUT', canonical, routeId: successful.decision.route.routeId, detail: 'NON_SUBMISSION_TOOL_FORBIDDEN_DURING_CRITIC_REVISION' };
    }
    if (first.kind === 'seller_submission') {
      if (input.revisionRequest !== undefined && first.submission['proposalId'] === input.revisionRequest.previousProposalId) {
        return { ok: false, code: 'INVALID_PROVIDER_OUTPUT', canonical, routeId: successful.decision.route.routeId, detail: 'REVISED_PROPOSAL_ID_REUSED' };
      }
      const validation = dependencies.validateSellerSubmission(first.submission, { canonical });
      if (!validation.ok) return { ok: false, code: 'SELLER_SUBMISSION_REJECTED', canonical, validation };
      return {
        ok: true,
        canonical,
        submission: validation.submission,
        routeId: successful.decision.route.routeId,
        providerRounds: providerRound,
        providerCalls,
      };
    }

    if (first.kind === 'user_observation_requests') {
      const requests = tools.parsed.flatMap((item) =>
        item.kind === 'user_observation_requests' ? item.requests : []);
      if (requests.length < 1 || requests.length > 8) {
        return { ok: false, code: 'INVALID_PROVIDER_OUTPUT', canonical, routeId: successful.decision.route.routeId, detail: 'OBSERVATION_REQUEST_LIMIT' };
      }
      const signatures = requests.map((request) => JSON.stringify(request));
      if (new Set(signatures).size !== signatures.length) {
        return { ok: false, code: 'INVALID_PROVIDER_OUTPUT', canonical, routeId: successful.decision.route.routeId, detail: 'DUPLICATE_OBSERVATION_REQUEST' };
      }
      const authoritativeTurn = canonical.latestUserIntent;
      if (authoritativeTurn === null) {
        return { ok: false, code: 'OBSERVATION_CAPTURE_REJECTED', canonical, requestId: null, detail: 'NO_AUTHORITATIVE_USER_TURN' };
      }
      const observationIds = new Set(canonical.quantitativeObservations.map((item) => item.id));
      const boundRequests = requests.map((request, index) => Object.freeze({
        ...request,
        id: `seller-observation-r${canonical.revision}-${index + 1}`,
        baseRevision: canonical.revision,
        turnId: authoritativeTurn.turnId,
      }));
      if (boundRequests.some((request) => observationIds.has(request.id))) {
        return { ok: false, code: 'INVALID_PROVIDER_OUTPUT', canonical, routeId: successful.decision.route.routeId, detail: 'SERVER_OBSERVATION_ID_COLLISION' };
      }
      const captured = dependencies.captureQuotedUserObservations(canonical, boundRequests);
      if (!captured.ok) {
        return {
          ok: false,
          code: 'OBSERVATION_CAPTURE_REJECTED',
          canonical,
          requestId: captured.requestId,
          detail: captured.code,
        };
      }
      const committed = dependencies.applyContextMutation(canonical, {
        baseRevision: canonical.revision,
        actor: 'user',
        mutation: { type: 'ADD_USER_OBSERVATIONS', observations: captured.observations },
      });
      if (!committed.ok) {
        return { ok: false, code: 'OBSERVATION_COMMIT_REJECTED', canonical, detail: committed.code };
      }
      canonical = committed.context;
      continue;
    }

    const requests = tools.parsed.flatMap((item) => item.kind === 'calculation_requests' ? item.requests : []);
    if (requests.length < 1 || requests.length > 8) {
      return { ok: false, code: 'INVALID_PROVIDER_OUTPUT', canonical, routeId: successful.decision.route.routeId, detail: 'CALCULATION_REQUEST_LIMIT' };
    }
    const signatures = requests.map((request) => JSON.stringify(request));
    if (new Set(signatures).size !== signatures.length) {
      return { ok: false, code: 'INVALID_PROVIDER_OUTPUT', canonical, routeId: successful.decision.route.routeId, detail: 'DUPLICATE_CALCULATION_REQUEST' };
    }
    const calculationIds = new Set(canonical.verifiedCalculations.map((item) => item.id));
    const boundRequests = requests.map((request, index) => Object.freeze({
      ...request,
      id: `seller-calculation-r${canonical.revision}-${index + 1}`,
      baseRevision: canonical.revision,
    }));
    if (boundRequests.some((request) => calculationIds.has(request.id))) {
      return { ok: false, code: 'INVALID_PROVIDER_OUTPUT', canonical, routeId: successful.decision.route.routeId, detail: 'SERVER_CALCULATION_ID_COLLISION' };
    }

    const calculations: VerifiedCalculation[] = [];
    for (const request of boundRequests) {
      const result = dependencies.computeVerifiedCalculation(canonical, request);
      if (!result.ok) {
        return { ok: false, code: 'CALCULATION_REJECTED', canonical, requestId: request.id, detail: result.code };
      }
      calculations.push(result.calculation);
    }

    const committed = dependencies.applyContextMutation(canonical, {
      baseRevision: canonical.revision,
      actor: 'system',
      mutation: { type: 'ADD_CALCULATIONS', calculations: Object.freeze(calculations) },
    });
    if (!committed.ok) {
      return { ok: false, code: 'CALCULATION_COMMIT_REJECTED', canonical, detail: committed.code };
    }
    canonical = committed.context;
  }

  return {
    ok: false,
    code: 'ROUND_LIMIT_EXCEEDED',
    canonical,
    providerRounds: maxProviderRounds,
    providerCalls,
  };
}
