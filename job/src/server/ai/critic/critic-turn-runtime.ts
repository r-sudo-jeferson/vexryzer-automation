import type { CanonicalSalesContext } from '../../../ai/context/canonical-sales-context.ts';
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
import type { CriticReview } from '../../../ai/critic/critic-contract.ts';
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
  CRITIC_LOCAL_TOOLS,
  parseCriticReviewToolCall,
  type CriticWireToolResult,
} from './critic-wire-tools.ts';

export interface CriticRouteBudgetConfig {
  routeId: string;
  budget: Readonly<ProviderRouteBudget>;
}

export type CriticCredentialResolver = (credentialEnvName: string) =>
  string | null | undefined | Promise<string | null | undefined>;

export interface CriticTurnRuntimeDependencies {
  packageContext: typeof packageContext;
  buildEmergencyContinuationCapsule: typeof buildEmergencyContinuationCapsule;
  selectProviderRoute: typeof selectProviderRoute;
  createProviderDispatchEnvelope: typeof createProviderDispatchEnvelope;
  validateSellerSubmission: typeof validateSellerSubmission;
  parseCriticReviewToolCall: typeof parseCriticReviewToolCall;
  executeProviderChatStream: typeof executeProviderChatStream;
}

export interface CriticTurnRuntimeInput {
  canonical: CanonicalSalesContext;
  submission: Readonly<SellerSubmission>;
  digest: Parameters<typeof packageContext>[0]['digest'];
  recentTurns: readonly RecentContextTurn[];
  visualState: CurrentExperienceState;
  routes: readonly Readonly<ProviderRouteDefinition>[];
  routeBudgets: readonly Readonly<CriticRouteBudgetConfig>[];
  runtimeStates: readonly Readonly<ProviderRuntimeState>[];
  estimateTokens: TokenEstimator;
  resolveCredential: CriticCredentialResolver;
  serverConfig: Readonly<ProviderServerConfig>;
  timeoutMs: number;
  signal?: AbortSignal;
  dependencies?: Partial<CriticTurnRuntimeDependencies>;
}

export type CriticTurnRuntimeResult =
  | {
      ok: true;
      review: Readonly<CriticReview>;
      routeId: string;
      providerCalls: number;
    }
  | {
      ok: false;
      code: 'STALE_SUBMISSION';
    }
  | {
      ok: false;
      code: 'SELLER_SUBMISSION_REJECTED';
      validation: Extract<SellerSubmissionValidation, { ok: false }>;
    }
  | {
      ok: false;
      code: 'INVALID_RUNTIME_CONFIG';
      detail:
        | 'ROUTE_BUDGET_MISMATCH'
        | 'INVALID_TIMEOUT'
        | 'DUPLICATE_ROUTE'
        | 'DUPLICATE_RUNTIME_STATE';
    }
  | {
      ok: false;
      code: 'CONTEXT_PREPARATION_FAILED';
      routeId: string;
      detail: string;
    }
  | { ok: false; code: 'NO_ELIGIBLE_ROUTE' }
  | {
      ok: false;
      code: 'DISPATCH_REJECTED';
      routeId: string;
      detail: string;
    }
  | {
      ok: false;
      code: 'CREDENTIAL_UNAVAILABLE';
      routeId: string;
    }
  | {
      ok: false;
      code: 'PROVIDER_FAILED';
      routeId: string;
      failureClass: Exclude<ProviderChatClientResult, { ok: true }>['class'];
      status: number | null;
      retryAfterMs: number | null;
    }
  | {
      ok: false;
      code: 'INVALID_PROVIDER_OUTPUT';
      routeId: string;
      detail: string;
    }
  | {
      ok: false;
      code: 'CRITIC_REVIEW_REJECTED';
      routeId: string;
      detail: string;
    };

const MAX_ROUTE_COUNT = 16;
const MAX_PROVIDER_MESSAGE_TEXT = 96_000;
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

const CRITIC_SYSTEM_INSTRUCTION = [
  'You are the independent Vexryzer Critic operating after deterministic Seller validation and before any customer-facing commit.',
  'Evaluate the exact Seller proposal against canonical evidence, quantitative truth, user intent, accessibility, manipulation, artifact truth, and execution safety.',
  'Novel strategy, combined capabilities, skipped questions, or deviation from a conventional sales funnel are never findings by themselves.',
  'PASS only when the proposal is already valid. REVISE only for a bounded correctable issue. BLOCK unsafe or materially misleading output.',
  'Provider memory and provider conversation identifiers are non-authoritative.',
  'Finish only by calling submit_critic_review. Emit no final free text.',
].join(' ');

const DEFAULT_DEPENDENCIES: CriticTurnRuntimeDependencies = Object.freeze({
  packageContext,
  buildEmergencyContinuationCapsule,
  selectProviderRoute,
  createProviderDispatchEnvelope,
  validateSellerSubmission,
  parseCriticReviewToolCall,
  executeProviderChatStream,
});

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

interface CriticProviderMessageSource<TContext extends CanonicalDispatchContext = CanonicalDispatchContext> {
  role: ProviderRouteDecision['role'];
  canonicalRevision: number;
  contextMode: ProviderContextMode;
  fallbackReason: ProviderFallbackReason | null;
  context: TContext;
}

type PreparationResult =
  | { ok: true; prepared: PreparedRouteContexts }
  | { ok: false; routeId: string; detail: string };

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

function reviewTarget(submission: Readonly<SellerSubmission>) {
  return Object.freeze({
    proposalId: submission.proposalId,
    proposal: submission.proposal,
    materialClaims: submission.materialClaims,
  });
}

export function buildCriticProviderMessages<TContext extends CanonicalDispatchContext>(
  envelope: Readonly<CriticProviderMessageSource<TContext>>,
  submission: Readonly<SellerSubmission>,
): readonly ProviderChatMessage[] {
  if (envelope.role !== 'critic') throw new TypeError('Critic messages require a critic dispatch envelope');
  if (envelope.context.canonicalRevision !== envelope.canonicalRevision) {
    throw new TypeError('Critic dispatch context revision mismatch');
  }
  if (submission.proposal.baseRevision !== envelope.canonicalRevision) {
    throw new TypeError('Critic review target revision mismatch');
  }
  if (containsForbiddenProviderAuthorityKey(envelope.context)) {
    throw new TypeError('Provider conversation authority is forbidden in Critic dispatch context');
  }

  const payload = Object.freeze({
    schemaVersion: 1 as const,
    canonicalRevision: envelope.canonicalRevision,
    contextMode: envelope.contextMode,
    fallbackReason: envelope.fallbackReason,
    context: envelope.context,
    reviewTarget: reviewTarget(submission),
  });

  let content: string;
  try {
    content = JSON.stringify(payload);
  } catch {
    throw new TypeError('Critic dispatch context must be JSON serializable');
  }
  if (content.length < 1 || content.length > MAX_PROVIDER_MESSAGE_TEXT) {
    throw new TypeError('Critic dispatch message exceeds bounded wire size');
  }

  return Object.freeze([
    Object.freeze({ role: 'system' as const, content: CRITIC_SYSTEM_INSTRUCTION }),
    Object.freeze({ role: 'user' as const, content }),
  ]);
}

export function estimateCriticProviderInputTokens(
  source: Readonly<CriticProviderMessageSource>,
  submission: Readonly<SellerSubmission>,
  estimateTokens: TokenEstimator,
): number {
  const messages = buildCriticProviderMessages(source, submission);
  const measured = estimateTokens(Object.freeze({ messages, tools: CRITIC_LOCAL_TOOLS }));
  if (!Number.isInteger(measured) || measured < 0) {
    throw new TypeError('token estimator must return a non-negative integer');
  }
  return measured;
}

function validateRuntimeConfiguration(
  input: CriticTurnRuntimeInput,
): Extract<CriticTurnRuntimeResult, { ok: false; code: 'INVALID_RUNTIME_CONFIG' }> | null {
  if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1 || input.timeoutMs > 120_000) {
    return { ok: false, code: 'INVALID_RUNTIME_CONFIG', detail: 'INVALID_TIMEOUT' };
  }
  if (
    input.routes.length < 1
    || input.routes.length > MAX_ROUTE_COUNT
    || new Set(input.routes.map((route) => route.routeId)).size !== input.routes.length
  ) {
    return { ok: false, code: 'INVALID_RUNTIME_CONFIG', detail: 'DUPLICATE_ROUTE' };
  }
  if (new Set(input.runtimeStates.map((state) => state.routeId)).size !== input.runtimeStates.length) {
    return { ok: false, code: 'INVALID_RUNTIME_CONFIG', detail: 'DUPLICATE_RUNTIME_STATE' };
  }
  if (
    input.routeBudgets.length !== input.routes.length
    || new Set(input.routeBudgets.map((item) => item.routeId)).size !== input.routeBudgets.length
  ) {
    return { ok: false, code: 'INVALID_RUNTIME_CONFIG', detail: 'ROUTE_BUDGET_MISMATCH' };
  }

  const routeIds = new Set(input.routes.map((route) => route.routeId));
  for (const item of input.routeBudgets) {
    if (!routeIds.has(item.routeId)) {
      return { ok: false, code: 'INVALID_RUNTIME_CONFIG', detail: 'ROUTE_BUDGET_MISMATCH' };
    }
    try {
      assertProviderRouteBudget(item.budget);
    } catch {
      return { ok: false, code: 'INVALID_RUNTIME_CONFIG', detail: 'ROUTE_BUDGET_MISMATCH' };
    }
    const route = input.routes.find((candidate) => candidate.routeId === item.routeId)!;
    if (
      route.maxInputTokens === null
      || route.emergencyInputTokens === null
      || route.maxInputTokens !== availableInputTokens(item.budget)
      || route.emergencyInputTokens !== item.budget.emergencyInputTokens
    ) {
      return { ok: false, code: 'INVALID_RUNTIME_CONFIG', detail: 'ROUTE_BUDGET_MISMATCH' };
    }
  }
  return null;
}

function overflowTokenCount(measured: number | null, limit: number): number {
  if (measured !== null && Number.isFinite(measured) && measured > limit) return measured;
  return limit + 1;
}

function prepareRouteContexts(
  input: CriticTurnRuntimeInput,
  submission: Readonly<SellerSubmission>,
  dependencies: CriticTurnRuntimeDependencies,
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
        role: 'critic',
        canonical: input.canonical,
        digest: input.digest,
        recentTurns: input.recentTurns,
        visualState: input.visualState,
        budget,
        estimateTokens: (contextPayload) => estimateCriticProviderInputTokens({
          role: 'critic',
          canonicalRevision: input.canonical.revision,
          contextMode: 'full',
          fallbackReason: null,
          context: contextPayload as CanonicalDispatchContext,
        }, submission, input.estimateTokens),
      });
      if (packaged.ok) {
        fullContext = packaged.pack;
        try {
          fullContextInputTokens = estimateCriticProviderInputTokens({
            role: 'critic',
            canonicalRevision: input.canonical.revision,
            contextMode: 'full',
            fallbackReason: null,
            context: fullContext,
          }, submission, input.estimateTokens);
        } catch {
          return { ok: false, routeId: route.routeId, detail: 'INVALID_TOKEN_ESTIMATOR' };
        }
      } else if (packaged.code === 'CONTEXT_BUDGET_EXCEEDED') {
        fullContextInputTokens = overflowTokenCount(
          packaged.estimatedInputTokens,
          availableInputTokens(budget),
        );
      } else {
        return { ok: false, routeId: route.routeId, detail: packaged.code };
      }
    } else if (route.tier !== 'standby' && route.enabledByDefault) {
      const capsule = dependencies.buildEmergencyContinuationCapsule({
        canonical: input.canonical,
        visualState: input.visualState,
        budget,
        estimateTokens: input.estimateTokens,
      });
      if (capsule.ok) {
        emergencyCapsule = capsule.capsule;
        emergencyCapsuleInputTokens = capsule.capsule.estimatedInputTokens;
      } else if (capsule.code === 'EMERGENCY_BUDGET_EXCEEDED') {
        emergencyCapsuleInputTokens = overflowTokenCount(
          capsule.estimatedInputTokens,
          budget.emergencyInputTokens,
        );
      } else {
        return { ok: false, routeId: route.routeId, detail: capsule.code };
      }
    }

    const usage = Object.freeze({
      routeId: route.routeId,
      fullContextInputTokens,
      emergencyCapsuleInputTokens,
    });
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
        role: 'critic',
        canonicalRevision: input.canonical.revision,
        fullContextInputTokens: tokenUsage.reduce(
          (max, item) => Math.max(max, item.fullContextInputTokens),
          0,
        ),
        emergencyCapsuleInputTokens: tokenUsage.reduce(
          (max, item) => Math.max(max, item.emergencyCapsuleInputTokens),
          0,
        ),
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
  dependencies: CriticTurnRuntimeDependencies,
) {
  if (decision.contextMode === 'full') {
    return context.fullContext === undefined
      ? dependencies.createProviderDispatchEnvelope({ decision })
      : dependencies.createProviderDispatchEnvelope({ decision, fullContext: context.fullContext });
  }
  return context.emergencyCapsule === undefined
    ? dependencies.createProviderDispatchEnvelope({ decision })
    : dependencies.createProviderDispatchEnvelope({
        decision,
        emergencyCapsule: context.emergencyCapsule,
      });
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

function canFallbackAfterProviderFailure(
  failureClass: Exclude<ProviderChatClientResult, { ok: true }>['class'],
): boolean {
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
  routeId: string,
  failure: Exclude<ProviderChatClientResult, { ok: true }>,
): Extract<CriticTurnRuntimeResult, { ok: false; code: 'PROVIDER_FAILED' }> {
  return {
    ok: false,
    code: 'PROVIDER_FAILED',
    routeId,
    failureClass: failure.class,
    status: failure.status,
    retryAfterMs: failure.retryAfterMs,
  };
}

function parseProviderReview(
  completion: Extract<ProviderChatClientResult, { ok: true }>['completion'],
  submission: Readonly<SellerSubmission>,
  revision: number,
  dependencies: CriticTurnRuntimeDependencies,
): { ok: true; review: Readonly<CriticReview> } | { ok: false; detail: string } {
  if (completion.content.trim().length > 0) {
    return { ok: false, detail: 'FREE_TEXT_WITH_OR_WITHOUT_TOOL' };
  }
  if (completion.toolCalls.length !== 1) {
    return { ok: false, detail: 'EXACTLY_ONE_CRITIC_TOOL_REQUIRED' };
  }
  const parsed: CriticWireToolResult = dependencies.parseCriticReviewToolCall(
    completion.toolCalls[0]!,
    submission.proposalId,
    revision,
  );
  if (!parsed.ok) return { ok: false, detail: parsed.code };
  return { ok: true, review: parsed.review };
}

export async function runCriticTurn(input: CriticTurnRuntimeInput): Promise<CriticTurnRuntimeResult> {
  if (input.submission.proposal.baseRevision !== input.canonical.revision) {
    return { ok: false, code: 'STALE_SUBMISSION' };
  }

  const invalid = validateRuntimeConfiguration(input);
  if (invalid !== null) return invalid;

  const dependencies: CriticTurnRuntimeDependencies = Object.freeze({
    ...DEFAULT_DEPENDENCIES,
    ...input.dependencies,
  });

  const validatedSubmission = dependencies.validateSellerSubmission(input.submission, {
    canonical: input.canonical,
  });
  if (!validatedSubmission.ok) {
    return {
      ok: false,
      code: 'SELLER_SUBMISSION_REJECTED',
      validation: validatedSubmission,
    };
  }

  const preparation = prepareRouteContexts(input, validatedSubmission.submission, dependencies);
  if (!preparation.ok) {
    return {
      ok: false,
      code: 'CONTEXT_PREPARATION_FAILED',
      routeId: preparation.routeId,
      detail: preparation.detail,
    };
  }

  let runtimeStates: readonly Readonly<ProviderRuntimeState>[] = Object.freeze([
    ...input.runtimeStates,
  ]);
  let selectionRequest = preparation.prepared.selectionRequest;
  let measurementAdjustments = 0;
  const attemptedRoutes = new Set<string>();
  let providerCalls = 0;

  while (attemptedRoutes.size < input.routes.length) {
    const decision = dependencies.selectProviderRoute(
      input.routes,
      selectionRequest,
      runtimeStates,
    );
    if (!decision.ok) return { ok: false, code: 'NO_ELIGIBLE_ROUTE' };
    if (
      decision.canonicalRevision !== input.canonical.revision
      || attemptedRoutes.has(decision.route.routeId)
    ) {
      return {
        ok: false,
        code: 'INVALID_RUNTIME_CONFIG',
        detail: 'ROUTE_BUDGET_MISMATCH',
      };
    }

    const preparedContext = preparation.prepared.byRoute.get(decision.route.routeId);
    if (preparedContext === undefined) {
      return {
        ok: false,
        code: 'DISPATCH_REJECTED',
        routeId: decision.route.routeId,
        detail: 'SELECTED_CONTEXT_MISSING',
      };
    }

    const dispatch = selectedDispatch(decision, preparedContext, dependencies);
    if (!dispatch.ok) {
      return {
        ok: false,
        code: 'DISPATCH_REJECTED',
        routeId: decision.route.routeId,
        detail: dispatch.code,
      };
    }

    let messages: readonly ProviderChatMessage[];
    try {
      messages = buildCriticProviderMessages(
        dispatch.envelope,
        validatedSubmission.submission,
      );
    } catch {
      return {
        ok: false,
        code: 'DISPATCH_REJECTED',
        routeId: decision.route.routeId,
        detail: 'MESSAGE_BUILD_FAILED',
      };
    }

    let exactInputTokens: number;
    try {
      exactInputTokens = input.estimateTokens(Object.freeze({
        messages,
        tools: CRITIC_LOCAL_TOOLS,
      }));
      if (!Number.isInteger(exactInputTokens) || exactInputTokens < 0) {
        throw new TypeError('invalid token estimate');
      }
    } catch {
      return {
        ok: false,
        code: 'CONTEXT_PREPARATION_FAILED',
        routeId: decision.route.routeId,
        detail: 'INVALID_TOKEN_ESTIMATOR',
      };
    }

    if (exactInputTokens !== decision.requirements.inputTokens) {
      measurementAdjustments += 1;
      if (measurementAdjustments > input.routes.length * 2) {
        return {
          ok: false,
          code: 'CONTEXT_PREPARATION_FAILED',
          routeId: decision.route.routeId,
          detail: 'UNSTABLE_TOKEN_ESTIMATOR',
        };
      }
      selectionRequest = withRouteTokenUsage(
        selectionRequest,
        decision.route.routeId,
        decision.contextMode,
        exactInputTokens,
      );
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
      return {
        ok: false,
        code: 'CREDENTIAL_UNAVAILABLE',
        routeId: decision.route.routeId,
      };
    }

    const baseExecutionInput = {
      route: decision.route,
      serverConfig: input.serverConfig,
      apiToken: credential,
      messages,
      tools: CRITIC_LOCAL_TOOLS,
      timeoutMs: input.timeoutMs,
    };

    let providerResult: ProviderChatClientResult;
    try {
      providerResult = input.signal === undefined
        ? await dependencies.executeProviderChatStream(baseExecutionInput)
        : await dependencies.executeProviderChatStream({
            ...baseExecutionInput,
            signal: input.signal,
          });
    } catch {
      providerResult = {
        ok: false,
        class: 'unknown',
        status: null,
        retryAfterMs: null,
      };
    }
    providerCalls += 1;

    if (!providerResult.ok) {
      if (!canFallbackAfterProviderFailure(providerResult.class)) {
        return providerFailure(decision.route.routeId, providerResult);
      }
      runtimeStates = markRouteUnavailable(
        runtimeStates,
        decision.route.routeId,
        providerResult.class,
      );
      if (attemptedRoutes.size >= input.routes.length) {
        return providerFailure(decision.route.routeId, providerResult);
      }
      continue;
    }

    const review = parseProviderReview(
      providerResult.completion,
      validatedSubmission.submission,
      input.canonical.revision,
      dependencies,
    );
    if (!review.ok) {
      return {
        ok: false,
        code: review.detail === 'STALE_REVIEW' || review.detail === 'INVALID_REVIEW'
          ? 'CRITIC_REVIEW_REJECTED'
          : 'INVALID_PROVIDER_OUTPUT',
        routeId: decision.route.routeId,
        detail: review.detail,
      };
    }

    return {
      ok: true,
      review: review.review,
      routeId: decision.route.routeId,
      providerCalls,
    };
  }

  return { ok: false, code: 'NO_ELIGIBLE_ROUTE' };
}
