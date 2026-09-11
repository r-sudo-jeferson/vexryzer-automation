import { createHash, randomUUID } from 'node:crypto';
import { applyContextMutation } from '../../ai/context/context-reducer.ts';
import { createSessionDigest } from '../../ai/context/session-digest.ts';
import type { CanonicalSalesContext, VerifiedCalculation } from '../../ai/context/canonical-sales-context.ts';
import type { RecentContextTurn } from '../../ai/context/context-packager.ts';
import type { ReactiveExperienceState } from '../../experience/reactive-experience-state.ts';
import { projectReactiveCanvas, type ReactiveCanvasModel } from '../../canvas/reactive-graph-adapter.ts';
import { createProcessGraph } from '../../canvas/domain.ts';
import {
  runAgentLedTurn,
  type AgentLedCriticRuntimeConfig,
  type AgentLedTurnRuntimeInput,
  type AgentLedTurnRuntimeResult,
} from '../ai/agent/agent-led-turn-runtime.ts';
import type { SellerTurnRuntimeInput } from '../ai/seller/seller-turn-runtime.ts';
import {
  AGENT_SESSION_LIMITS,
  claimAgentSession,
  completeAgentSession,
  createAgentSession,
  releaseAgentSessionLease,
  sessionTokenMatches,
  type AgentSessionEntropy,
  type AgentSessionMode,
  type AgentSessionRecord,
  type CompletedAgentRequest,
} from './agent-session.ts';
import type { AgentSessionRepository } from './session-repository.ts';

export type SellerRuntimeStaticConfig = Omit<
  SellerTurnRuntimeInput,
  'canonical' | 'digest' | 'recentTurns' | 'visualState' | 'revisionRequest' | 'signal'
>;

export type CriticRuntimeStaticConfig = Omit<AgentLedCriticRuntimeConfig, 'signal'>;

export interface AgentRuntimeStaticConfig {
  executionTimeoutMs: number;
  seller: SellerRuntimeStaticConfig;
  critic: CriticRuntimeStaticConfig;
}

export const AGENT_EXECUTION_TIMEOUT_LIMITS = Object.freeze({
  minMs: 1_000,
  maxMs: 45_000,
});

export interface StoredAgentTurnDependencies {
  applyContextMutation: typeof applyContextMutation;
  createSessionDigest: typeof createSessionDigest;
  runAgentLedTurn: typeof runAgentLedTurn;
  nowEpochMs(): number;
  leaseId(): string;
}

export interface StartStoredAgentSessionInput {
  repository: AgentSessionRepository;
  entropy?: Readonly<AgentSessionEntropy>;
}

export type StartStoredAgentSessionResult =
  | { ok: true; sessionId: string; sessionToken: string; revision: number }
  | { ok: false; code: 'STORE_UNAVAILABLE' | 'SESSION_ID_COLLISION' };

export interface StoredAgentTurnRequest {
  sessionId: string;
  sessionToken: string;
  requestId: string;
  expectedRevision: number;
  text: string;
}

export interface StoredAgentTurnInput {
  repository: AgentSessionRepository;
  request: Readonly<StoredAgentTurnRequest>;
  runtime: Readonly<AgentRuntimeStaticConfig>;
  signal?: AbortSignal;
  dependencies?: Partial<StoredAgentTurnDependencies>;
}

export interface PublicVerifiedCalculation {
  id: string;
  resultValue: number;
  resultUnit: string;
  status: VerifiedCalculation['status'];
}

export interface PublicAgentSessionState {
  sessionId: string;
  canonicalRevision: number;
  verifiedCalculations: readonly Readonly<PublicVerifiedCalculation>[];
  reactiveState: Readonly<ReactiveExperienceState>;
}

export interface StoredAgentTurnSuccess {
  ok: true;
  idempotent: boolean;
  mode: AgentSessionMode;
  narration: string;
  nextQuestion: string | null;
  state: Readonly<PublicAgentSessionState>;
}

export type StoredAgentTurnResult =
  | StoredAgentTurnSuccess
  | {
      ok: false;
      code:
        | 'INVALID_REQUEST'
        | 'NOT_FOUND'
        | 'UNAUTHORIZED'
        | 'REQUEST_REPLAY'
        | 'STALE_REVISION'
        | 'SESSION_BUSY'
        | 'SESSION_CONFLICT'
        | 'STORE_UNAVAILABLE'
        | 'AGENT_EXECUTION_FAILED';
      currentRevision: number | null;
    };

const DEFAULT_DEPENDENCIES: StoredAgentTurnDependencies = Object.freeze({
  applyContextMutation,
  createSessionDigest,
  runAgentLedTurn,
  nowEpochMs: () => Date.now(),
  leaseId: () => randomUUID(),
});

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const GUIDED_RECOVERY_NARRATION = 'A análise automática está temporariamente indisponível. Seu contexto foi preservado sem inventar conclusões.';
const GUIDED_RECOVERY_QUESTION = 'Continue com a rotina, volume ou gargalo que considera mais relevante; retomarei a análise quando houver uma rota elegível.';

function validRequest(input: Readonly<StoredAgentTurnRequest>): boolean {
  const text = input.text.trim();
  return SAFE_ID.test(input.sessionId)
    && input.sessionId.length <= 96
    && SAFE_ID.test(input.requestId)
    && input.requestId.length <= 80
    && Number.isInteger(input.expectedRevision)
    && input.expectedRevision >= 0
    && text.length >= 1
    && text.length <= AGENT_SESSION_LIMITS.userText
    && !CONTROL.test(input.text);
}

function assistantTurnId(requestId: string): string {
  return 'assistant-' + createHash('sha256').update(requestId, 'utf8').digest('hex').slice(0, 32);
}

function visualState(
  record: Readonly<AgentSessionRecord>,
  surface: Readonly<ReactiveCanvasModel>,
) {
  return Object.freeze({
    sceneId: record.canonical.currentSceneId,
    focusedEntityIds: Object.freeze([
      ...new Set([
        ...record.reactiveState.scene.focusIds,
        ...record.reactiveState.scene.comparisonIds,
      ]),
    ]),
    activeArtifactIds: Object.freeze(record.reactiveState.artifacts
      .filter((artifact) => artifact.truthStatus === 'active')
      .map((artifact) => artifact.id)),
    processNodes: Object.freeze(surface.graph.nodes.map((node) => Object.freeze({
      id: node.id,
      label: node.label,
      kind: node.kind,
      provenance: node.provenance,
    }))),
  });
}

export function projectPublicAgentSessionState(
  record: Readonly<AgentSessionRecord>,
): Readonly<PublicAgentSessionState> {
  return Object.freeze({
    sessionId: record.sessionId,
    canonicalRevision: record.canonical.revision,
    verifiedCalculations: Object.freeze(record.canonical.verifiedCalculations.map((calculation) => Object.freeze({
      id: calculation.id,
      resultValue: calculation.resultValue,
      resultUnit: calculation.resultUnit,
      status: calculation.status,
    }))),
    reactiveState: record.reactiveState,
  });
}

function completedResponse(
  record: Readonly<AgentSessionRecord>,
  completed: Readonly<CompletedAgentRequest>,
  idempotent: boolean,
): StoredAgentTurnSuccess {
  return {
    ok: true,
    idempotent,
    mode: completed.mode,
    narration: completed.narration,
    nextQuestion: completed.nextQuestion,
    state: projectPublicAgentSessionState(record),
  };
}

function appendRecent(
  previous: readonly Readonly<RecentContextTurn>[],
  additions: readonly Readonly<RecentContextTurn>[],
): readonly Readonly<RecentContextTurn>[] {
  const seen = new Set<string>();
  const merged: Readonly<RecentContextTurn>[] = [];
  for (const turn of [...previous, ...additions]) {
    if (seen.has(turn.id)) continue;
    seen.add(turn.id);
    merged.push(Object.freeze({ id: turn.id, role: turn.role, text: turn.text.trim() }));
  }
  return Object.freeze(merged.slice(-AGENT_SESSION_LIMITS.recentTurns));
}

async function finalize(
  repository: AgentSessionRepository,
  claimedEtag: string,
  claimed: Readonly<AgentSessionRecord>,
  input: {
    canonical: CanonicalSalesContext;
    reactiveState: Readonly<ReactiveExperienceState>;
    recentTurns: readonly Readonly<RecentContextTurn>[];
    completed: Readonly<CompletedAgentRequest>;
  },
): Promise<StoredAgentTurnResult> {
  const leaseId = claimed.lease?.leaseId;
  if (leaseId === undefined) return { ok: false, code: 'SESSION_CONFLICT', currentRevision: claimed.canonical.revision };
  let record: Readonly<AgentSessionRecord>;
  try {
    record = completeAgentSession(claimed, { leaseId, ...input });
  } catch {
    return { ok: false, code: 'SESSION_CONFLICT', currentRevision: claimed.canonical.revision };
  }

  let write;
  try {
    write = await repository.compareAndSet(record.sessionId, claimedEtag, record);
  } catch {
    return { ok: false, code: 'STORE_UNAVAILABLE', currentRevision: claimed.canonical.revision };
  }
  if (!write.ok) {
    return {
      ok: false,
      code: write.code === 'CONFLICT' ? 'SESSION_CONFLICT'
        : write.code === 'STORE_UNAVAILABLE' ? 'STORE_UNAVAILABLE'
        : 'NOT_FOUND',
      currentRevision: null,
    };
  }
  return completedResponse(record, input.completed, false);
}

async function releaseFailedTurn(
  repository: AgentSessionRepository,
  claimedEtag: string,
  claimed: Readonly<AgentSessionRecord>,
  canonical: CanonicalSalesContext,
  reactiveState: Readonly<ReactiveExperienceState>,
  recentTurns: readonly Readonly<RecentContextTurn>[],
): Promise<StoredAgentTurnResult> {
  const leaseId = claimed.lease?.leaseId;
  if (leaseId === undefined) {
    return { ok: false, code: 'SESSION_CONFLICT', currentRevision: canonical.revision };
  }

  let released: Readonly<AgentSessionRecord>;
  try {
    released = releaseAgentSessionLease(claimed, {
      leaseId,
      canonical,
      reactiveState,
      recentTurns,
    });
  } catch {
    return { ok: false, code: 'SESSION_CONFLICT', currentRevision: canonical.revision };
  }

  let write;
  try {
    write = await repository.compareAndSet(released.sessionId, claimedEtag, released);
  } catch {
    return { ok: false, code: 'STORE_UNAVAILABLE', currentRevision: canonical.revision };
  }
  if (!write.ok) {
    return {
      ok: false,
      code: write.code === 'CONFLICT' ? 'SESSION_CONFLICT'
        : write.code === 'STORE_UNAVAILABLE' ? 'STORE_UNAVAILABLE'
        : 'NOT_FOUND',
      currentRevision: canonical.revision,
    };
  }
  return { ok: false, code: 'AGENT_EXECUTION_FAILED', currentRevision: canonical.revision };
}

function isProviderAvailabilityFailure(
  result: Extract<AgentLedTurnRuntimeResult, { ok: false }>,
): boolean {
  return (result.code === 'SELLER_FAILED' || result.code === 'CRITIC_FAILED')
    && ['NO_ELIGIBLE_ROUTE', 'CREDENTIAL_UNAVAILABLE', 'PROVIDER_FAILED'].includes(result.detail);
}

async function guidedRecovery(
  repository: AgentSessionRepository,
  claimedEtag: string,
  claimed: Readonly<AgentSessionRecord>,
  canonical: CanonicalSalesContext,
  reactiveState: Readonly<ReactiveExperienceState>,
  recentWithUser: readonly Readonly<RecentContextTurn>[],
  inputRevision: number,
): Promise<StoredAgentTurnResult> {
  const completed: CompletedAgentRequest = {
    requestId: claimed.lease!.requestId,
    inputRevision,
    resultRevision: canonical.revision,
    mode: 'guided_recovery',
    narration: GUIDED_RECOVERY_NARRATION,
    nextQuestion: GUIDED_RECOVERY_QUESTION,
  };
  return finalize(repository, claimedEtag, claimed, {
    canonical,
    reactiveState,
    recentTurns: appendRecent(recentWithUser, [{
      id: assistantTurnId(completed.requestId),
      role: 'assistant',
      text: GUIDED_RECOVERY_NARRATION + ' ' + GUIDED_RECOVERY_QUESTION,
    }]),
    completed,
  });
}

export async function startStoredAgentSession(
  input: StartStoredAgentSessionInput,
): Promise<StartStoredAgentSessionResult> {
  const entropy = input.entropy;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const created = createAgentSession(entropy);
    let stored;
    try {
      stored = await input.repository.create(created.record);
    } catch {
      return { ok: false, code: 'STORE_UNAVAILABLE' };
    }
    if (stored.ok) {
      return {
        ok: true,
        sessionId: created.record.sessionId,
        sessionToken: created.sessionToken,
        revision: created.record.canonical.revision,
      };
    }
    if (stored.code === 'STORE_UNAVAILABLE') {
      return { ok: false, code: 'STORE_UNAVAILABLE' };
    }
  }
  return { ok: false, code: 'SESSION_ID_COLLISION' };
}

export async function runStoredAgentTurn(
  input: StoredAgentTurnInput,
): Promise<StoredAgentTurnResult> {
  if (
    !Number.isInteger(input.runtime.executionTimeoutMs)
    || input.runtime.executionTimeoutMs < AGENT_EXECUTION_TIMEOUT_LIMITS.minMs
    || input.runtime.executionTimeoutMs > AGENT_EXECUTION_TIMEOUT_LIMITS.maxMs
    || input.signal?.aborted === true
  ) {
    return { ok: false, code: 'AGENT_EXECUTION_FAILED', currentRevision: null };
  }

  const executionTimeoutSignal = AbortSignal.timeout(input.runtime.executionTimeoutMs);
  const executionSignal = input.signal === undefined
    ? executionTimeoutSignal
    : AbortSignal.any([input.signal, executionTimeoutSignal]);

  if (!validRequest(input.request)) {
    return { ok: false, code: 'INVALID_REQUEST', currentRevision: null };
  }

  const dependencies: StoredAgentTurnDependencies = Object.freeze({
    ...DEFAULT_DEPENDENCIES,
    ...input.dependencies,
  });

  let loaded;
  try {
    loaded = await input.repository.get(input.request.sessionId);
  } catch {
    return { ok: false, code: 'STORE_UNAVAILABLE', currentRevision: null };
  }
  if (loaded === null) return { ok: false, code: 'NOT_FOUND', currentRevision: null };
  if (!sessionTokenMatches(input.request.sessionToken, loaded.record.sessionTokenDigest)) {
    return { ok: false, code: 'UNAUTHORIZED', currentRevision: null };
  }

  const claimed = claimAgentSession(loaded.record, {
    requestId: input.request.requestId,
    expectedRevision: input.request.expectedRevision,
    nowEpochMs: dependencies.nowEpochMs(),
  }, { leaseId: dependencies.leaseId });
  if (!claimed.ok) {
    return {
      ok: false,
      code: claimed.code,
      currentRevision: loaded.record.canonical.revision,
    };
  }
  if (claimed.idempotent) return completedResponse(claimed.record, claimed.completed, true);

  let claimWrite;
  try {
    claimWrite = await input.repository.compareAndSet(
      claimed.record.sessionId,
      loaded.etag,
      claimed.record,
    );
  } catch {
    return { ok: false, code: 'STORE_UNAVAILABLE', currentRevision: loaded.record.canonical.revision };
  }
  if (!claimWrite.ok) {
    return {
      ok: false,
      code: claimWrite.code === 'CONFLICT' ? 'SESSION_CONFLICT'
        : claimWrite.code === 'STORE_UNAVAILABLE' ? 'STORE_UNAVAILABLE'
        : 'NOT_FOUND',
      currentRevision: loaded.record.canonical.revision,
    };
  }

  const userText = input.request.text.trim();
  const userMutation = dependencies.applyContextMutation(claimed.record.canonical, {
    baseRevision: claimed.record.canonical.revision,
    actor: 'user',
    mutation: {
      type: 'SET_LATEST_USER_INTENT',
      turnId: input.request.requestId,
      intent: userText,
    },
  });
  if (!userMutation.ok) {
    return releaseFailedTurn(
      input.repository,
      claimWrite.etag,
      claimed.record,
      claimed.record.canonical,
      claimed.record.reactiveState,
      claimed.record.recentTurns,
    );
  }

  const canonicalAfterInput = userMutation.context;
  const recentWithUser = appendRecent(claimed.record.recentTurns, [{
    id: input.request.requestId,
    role: 'user',
    text: userText,
  }]);

  if (input.runtime.seller.routes.length === 0 || input.runtime.critic.routes.length === 0) {
    return guidedRecovery(
      input.repository,
      claimWrite.etag,
      claimed.record,
      canonicalAfterInput,
      claimed.record.reactiveState,
      recentWithUser,
      input.request.expectedRevision,
    );
  }

  const currentSurface = projectReactiveCanvas(
    createProcessGraph([], []),
    claimed.record.reactiveState,
    canonicalAfterInput,
  );
  if (!currentSurface.ok) {
    return releaseFailedTurn(
      input.repository,
      claimWrite.etag,
      claimed.record,
      canonicalAfterInput,
      claimed.record.reactiveState,
      recentWithUser,
    );
  }

  const agentInput: AgentLedTurnRuntimeInput = {
    seller: {
      ...input.runtime.seller,
      canonical: canonicalAfterInput,
      digest: dependencies.createSessionDigest(canonicalAfterInput),
      recentTurns: recentWithUser,
      visualState: visualState(Object.freeze({
        ...claimed.record,
        canonical: canonicalAfterInput,
      }), currentSurface.model),
      signal: executionSignal,
    },
    critic: {
      ...input.runtime.critic,
      signal: executionSignal,
    },
    reactiveState: claimed.record.reactiveState,
    surfaceGuard: ({ canonical, reactiveState }) => {
      const surface = projectReactiveCanvas(
        createProcessGraph([], []),
        reactiveState,
        canonical,
      );
      return surface.ok
        ? { ok: true }
        : { ok: false, code: surface.code, path: surface.path };
    },
  };

  let agent: AgentLedTurnRuntimeResult;
  try {
    agent = await dependencies.runAgentLedTurn(agentInput);
  } catch {
    return releaseFailedTurn(
      input.repository,
      claimWrite.etag,
      claimed.record,
      canonicalAfterInput,
      claimed.record.reactiveState,
      recentWithUser,
    );
  }

  if (!agent.ok) {
    const canonical = agent.canonical.revision < canonicalAfterInput.revision
      ? canonicalAfterInput
      : agent.canonical;
    const reactiveState = agent.reactiveState.basedOnRevision > canonical.revision
      ? claimed.record.reactiveState
      : agent.reactiveState;
    if (isProviderAvailabilityFailure(agent)) {
      return guidedRecovery(
        input.repository,
        claimWrite.etag,
        claimed.record,
        canonical,
        reactiveState,
        recentWithUser,
        input.request.expectedRevision,
      );
    }
    return releaseFailedTurn(
      input.repository,
      claimWrite.etag,
      claimed.record,
      canonical,
      reactiveState,
      recentWithUser,
    );
  }

  const nextQuestion = agent.submission.proposal.intent.nextQuestion?.text ?? null;
  const narration = agent.submission.proposal.narration;
  const assistantText = nextQuestion === null ? narration : narration + '\n\n' + nextQuestion;
  const completed: CompletedAgentRequest = {
    requestId: input.request.requestId,
    inputRevision: input.request.expectedRevision,
    resultRevision: agent.canonical.revision,
    mode: 'agent',
    narration,
    nextQuestion,
  };
  return finalize(input.repository, claimWrite.etag, claimed.record, {
    canonical: agent.canonical,
    reactiveState: agent.reactiveState,
    recentTurns: appendRecent(recentWithUser, [{
      id: assistantTurnId(input.request.requestId),
      role: 'assistant',
      text: assistantText,
    }]),
    completed,
  });
}
