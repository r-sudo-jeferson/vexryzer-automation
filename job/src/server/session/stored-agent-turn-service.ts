import { createHash } from 'node:crypto';
import { applyContextMutation } from '../../ai/context/context-reducer.ts';
import { createSessionDigest } from '../../ai/context/session-digest.ts';
import type { CanonicalSalesContext } from '../../ai/context/canonical-sales-context.ts';
import type { RecentContextTurn } from '../../ai/context/context-packager.ts';
import type { ReactiveExperienceState } from '../../experience/reactive-experience-state.ts';
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
  sessionTokenMatches,
  type AgentSessionEntropy,
  type AgentSessionMode,
  type AgentSessionRecord,
  type CompletedAgentRequest,
} from './agent-session.ts';
import type { AgentSessionRepository } from './session-repository.ts';

export type SellerRuntimeStaticConfig = Omit<
  SellerTurnRuntimeInput,
  'canonical' | 'digest' | 'recentTurns' | 'visualState' | 'revisionRequest'
>;

export interface AgentRuntimeStaticConfig {
  seller: SellerRuntimeStaticConfig;
  critic: AgentLedCriticRuntimeConfig;
}

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
  dependencies?: Partial<StoredAgentTurnDependencies>;
}

export interface PublicAgentSessionState {
  sessionId: string;
  canonicalRevision: number;
  canonical: CanonicalSalesContext;
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
  leaseId: () => crypto.randomUUID(),
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

function visualState(record: Readonly<AgentSessionRecord>) {
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
  });
}

function publicState(record: Readonly<AgentSessionRecord>): Readonly<PublicAgentSessionState> {
  return Object.freeze({
    sessionId: record.sessionId,
    canonicalRevision: record.canonical.revision,
    canonical: record.canonical,
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
    state: publicState(record),
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

function availabilityFailure(result: Extract<AgentLedTurnRuntimeResult, { ok: false }>): boolean {
  if (result.code !== 'SELLER_FAILED' && result.code !== 'CRITIC_FAILED') return false;
  return ['NO_ELIGIBLE_ROUTE', 'CREDENTIAL_UNAVAILABLE', 'PROVIDER_FAILED'].includes(result.detail);
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
    if (stored.code === 'STORE_UNAVAILABLE') return stored;
  }
  return { ok: false, code: 'SESSION_ID_COLLISION' };
}

export async function runStoredAgentTurn(
  input: StoredAgentTurnInput,
): Promise<StoredAgentTurnResult> {
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
    return { ok: false, code: 'AGENT_EXECUTION_FAILED', currentRevision: claimed.record.canonical.revision };
  }

  const canonicalAfterInput = userMutation.context;
  const recentWithUser = appendRecent(claimed.record.recentTurns, [{
    id: input.request.requestId,
    role: 'user',
    text: userText,
  }]);

  if (input.runtime.seller.routes.length === 0 || input.runtime.critic.routes.length === 0) {
    const completed: CompletedAgentRequest = {
      requestId: input.request.requestId,
      inputRevision: input.request.expectedRevision,
      resultRevision: canonicalAfterInput.revision,
      mode: 'guided_recovery',
      narration: GUIDED_RECOVERY_NARRATION,
      nextQuestion: GUIDED_RECOVERY_QUESTION,
    };
    return finalize(input.repository, claimWrite.etag, claimed.record, {
      canonical: canonicalAfterInput,
      reactiveState: claimed.record.reactiveState,
      recentTurns: appendRecent(recentWithUser, [{
        id: assistantTurnId(input.request.requestId),
        role: 'assistant',
        text: GUIDED_RECOVERY_NARRATION + ' ' + GUIDED_RECOVERY_QUESTION,
      }]),
      completed,
    });
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
      })),
    },
    critic: input.runtime.critic,
    reactiveState: claimed.record.reactiveState,
  };

  let agent: AgentLedTurnRuntimeResult;
  try {
    agent = await dependencies.runAgentLedTurn(agentInput);
  } catch {
    return { ok: false, code: 'AGENT_EXECUTION_FAILED', currentRevision: canonicalAfterInput.revision };
  }

  if (!agent.ok) {
    if (!availabilityFailure(agent)) {
      return { ok: false, code: 'AGENT_EXECUTION_FAILED', currentRevision: agent.canonical.revision };
    }
    const completed: CompletedAgentRequest = {
      requestId: input.request.requestId,
      inputRevision: input.request.expectedRevision,
      resultRevision: agent.canonical.revision,
      mode: 'guided_recovery',
      narration: GUIDED_RECOVERY_NARRATION,
      nextQuestion: GUIDED_RECOVERY_QUESTION,
    };
    return finalize(input.repository, claimWrite.etag, claimed.record, {
      canonical: agent.canonical,
      reactiveState: input.reactiveState ?? claimed.record.reactiveState,
      recentTurns: appendRecent(recentWithUser, [{
        id: assistantTurnId(input.request.requestId),
        role: 'assistant',
        text: GUIDED_RECOVERY_NARRATION + ' ' + GUIDED_RECOVERY_QUESTION,
      }]),
      completed,
    });
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
