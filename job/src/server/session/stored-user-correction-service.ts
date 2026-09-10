import { createHash, randomUUID } from 'node:crypto';
import {
  applyContextMutation,
  type ContextMutation,
} from '../../ai/context/context-reducer.ts';
import type {
  CanonicalSalesContext,
  QuantitativeObservation,
  SalesFact,
} from '../../ai/context/canonical-sales-context.ts';
import { projectReactiveCanvas } from '../../canvas/reactive-graph-adapter.ts';
import { createProcessGraph } from '../../canvas/domain.ts';
import { reconcileReactiveExperience } from '../../experience/experience-projector.ts';
import type { ReactiveExperienceState } from '../../experience/reactive-experience-state.ts';
import {
  claimAgentSession,
  releaseAgentSessionLease,
  sessionTokenMatches,
  type AgentSessionRecord,
} from './agent-session.ts';
import type { AgentSessionRepository } from './session-repository.ts';
import {
  projectPublicAgentSessionState,
  type PublicAgentSessionState,
} from './stored-agent-turn-service.ts';

export interface StoredUserCorrectionRequest {
  sessionId: string;
  sessionToken: string;
  requestId: string;
  expectedRevision: number;
  correctionId: string;
}

export interface StoredUserCorrectionDependencies {
  applyContextMutation: typeof applyContextMutation;
  reconcileReactiveExperience: typeof reconcileReactiveExperience;
  nowEpochMs(): number;
  leaseId(): string;
}

export type StoredUserCorrectionResult =
  | {
      ok: true;
      idempotent: boolean;
      correctionId: string;
      state: Readonly<PublicAgentSessionState>;
    }
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
        | 'CORRECTION_NOT_PENDING'
        | 'CORRECTION_TARGET_INVALID'
        | 'CORRECTION_VALUE_INVALID'
        | 'CORRECTION_COMMIT_REJECTED'
        | 'SURFACE_REJECTED';
      currentRevision: number | null;
    };

const DEFAULT_DEPENDENCIES: StoredUserCorrectionDependencies = Object.freeze({
  applyContextMutation,
  reconcileReactiveExperience,
  nowEpochMs: () => Date.now(),
  leaseId: () => randomUUID(),
});

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const CORRECTION_REQUEST_KEYS = new Set([
  'sessionId',
  'sessionToken',
  'requestId',
  'expectedRevision',
  'correctionId',
]);

function validId(value: string, max = 96): boolean {
  return value.length >= 1 && value.length <= max && SAFE_ID.test(value);
}

function validRequest(request: Readonly<StoredUserCorrectionRequest>): boolean {
  if (Object.keys(request).some((key) => !CORRECTION_REQUEST_KEYS.has(key))
    || [...CORRECTION_REQUEST_KEYS].some((key) => !Object.hasOwn(request, key))) return false;
  return validId(request.sessionId)
    && validId(request.requestId, 80)
    && validId(request.correctionId)
    && Number.isInteger(request.expectedRevision)
    && request.expectedRevision >= 0;
}

function replacementId(kind: 'fact' | 'observation', requestId: string, correctionId: string): string {
  const digest = createHash('sha256')
    .update(kind + ':' + requestId + ':' + correctionId, 'utf8')
    .digest('hex')
    .slice(0, 32);
  return `${kind}-correction-${digest}`;
}

function uniqueIds(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values)]);
}

function exactIdempotentCorrection(
  record: Readonly<AgentSessionRecord>,
  request: Readonly<StoredUserCorrectionRequest>,
): boolean {
  const suggestion = record.reactiveState.correctionSuggestions.find(
    (item) => item.sourceCorrectionId === request.correctionId,
  );
  if (suggestion?.status !== 'invalidated') return false;

  const factId = replacementId('fact', request.requestId, request.correctionId);
  const fact = record.canonical.facts.find((item) => item.id === factId);
  if (fact?.status === 'confirmed' && fact.source === 'user' && fact.confirmedByTurnId === request.requestId) {
    return true;
  }

  const observationId = replacementId('observation', request.requestId, request.correctionId);
  const observation = record.canonical.quantitativeObservations.find((item) => item.id === observationId);
  return observation?.status === 'confirmed'
    && observation.source === 'user'
    && observation.confirmedByTurnId === request.requestId;
}

function buildFactCorrection(
  target: Readonly<SalesFact>,
  correction: Readonly<{
    targetEvidenceId: string;
    replacementValue: string | number | boolean;
    supportingTurnIds: readonly string[];
  }>,
  requestId: string,
  correctionId: string,
): ContextMutation {
  const replacement: SalesFact = Object.freeze({
    id: replacementId('fact', requestId, correctionId),
    subject: target.subject,
    predicate: target.predicate,
    value: correction.replacementValue,
    status: 'confirmed',
    source: 'user',
    confidence: 1,
    supportingTurnIds: uniqueIds([
      ...target.supportingTurnIds,
      ...correction.supportingTurnIds,
      requestId,
    ]),
    confirmedByTurnId: requestId,
  });
  return {
    type: 'CORRECT_FACT',
    factId: target.id,
    turnId: requestId,
    replacement,
  };
}

function buildObservationCorrection(
  target: Readonly<QuantitativeObservation>,
  correction: Readonly<{
    targetEvidenceId: string;
    replacementValue: string | number | boolean;
    supportingTurnIds: readonly string[];
  }>,
  requestId: string,
  correctionId: string,
): ContextMutation | null {
  if (typeof correction.replacementValue !== 'number'
    || !Number.isFinite(correction.replacementValue)
    || correction.replacementValue < 0) return null;

  const replacement: QuantitativeObservation = Object.freeze({
    id: replacementId('observation', requestId, correctionId),
    metric: target.metric,
    value: correction.replacementValue,
    unit: target.unit,
    period: target.period,
    status: 'confirmed',
    source: 'user',
    supportingTurnIds: uniqueIds([
      ...target.supportingTurnIds,
      ...correction.supportingTurnIds,
      requestId,
    ]),
    confirmedByTurnId: requestId,
  });
  return {
    type: 'CORRECT_OBSERVATION',
    observationId: target.id,
    turnId: requestId,
    replacement,
  };
}

function correctionMutation(
  canonical: CanonicalSalesContext,
  reactiveState: Readonly<ReactiveExperienceState>,
  requestId: string,
  correctionId: string,
):
  | { ok: true; mutation: ContextMutation }
  | { ok: false; code: 'CORRECTION_NOT_PENDING' | 'CORRECTION_TARGET_INVALID' | 'CORRECTION_VALUE_INVALID' } {
  const projected = reactiveState.correctionSuggestions.find(
    (item) => item.sourceCorrectionId === correctionId,
  );
  if (projected === undefined || projected.status !== 'pending') {
    return { ok: false, code: 'CORRECTION_NOT_PENDING' };
  }

  const correction = projected.correction;
  const fact = canonical.facts.find(
    (item) => item.id === correction.targetEvidenceId && item.status !== 'superseded',
  );
  if (fact !== undefined) {
    return {
      ok: true,
      mutation: buildFactCorrection(fact, correction, requestId, correctionId),
    };
  }

  const observation = canonical.quantitativeObservations.find(
    (item) => item.id === correction.targetEvidenceId && item.status !== 'superseded',
  );
  if (observation !== undefined) {
    const mutation = buildObservationCorrection(observation, correction, requestId, correctionId);
    return mutation === null
      ? { ok: false, code: 'CORRECTION_VALUE_INVALID' }
      : { ok: true, mutation };
  }

  return { ok: false, code: 'CORRECTION_TARGET_INVALID' };
}

async function release(
  repository: AgentSessionRepository,
  claimed: Readonly<AgentSessionRecord>,
  claimedEtag: string,
  canonical: CanonicalSalesContext,
  reactiveState: Readonly<ReactiveExperienceState>,
): Promise<
  | { ok: true; record: Readonly<AgentSessionRecord> }
  | { ok: false; code: 'SESSION_CONFLICT' | 'STORE_UNAVAILABLE' | 'NOT_FOUND' }
> {
  const leaseId = claimed.lease?.leaseId;
  if (leaseId === undefined) return { ok: false, code: 'SESSION_CONFLICT' };

  let released: Readonly<AgentSessionRecord>;
  try {
    released = releaseAgentSessionLease(claimed, {
      leaseId,
      canonical,
      reactiveState,
      recentTurns: claimed.recentTurns,
    });
  } catch {
    return { ok: false, code: 'SESSION_CONFLICT' };
  }

  let write;
  try {
    write = await repository.compareAndSet(released.sessionId, claimedEtag, released);
  } catch {
    return { ok: false, code: 'STORE_UNAVAILABLE' };
  }
  if (!write.ok) {
    return {
      ok: false,
      code: write.code === 'CONFLICT'
        ? 'SESSION_CONFLICT'
        : write.code,
    };
  }
  return { ok: true, record: released };
}

export async function runStoredUserCorrection(input: {
  repository: AgentSessionRepository;
  request: Readonly<StoredUserCorrectionRequest>;
  dependencies?: Partial<StoredUserCorrectionDependencies>;
}): Promise<StoredUserCorrectionResult> {
  if (!validRequest(input.request)) {
    return { ok: false, code: 'INVALID_REQUEST', currentRevision: null };
  }

  const dependencies: StoredUserCorrectionDependencies = Object.freeze({
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

  if (exactIdempotentCorrection(loaded.record, input.request)) {
    return {
      ok: true,
      idempotent: true,
      correctionId: input.request.correctionId,
      state: projectPublicAgentSessionState(loaded.record),
    };
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
  if (claimed.idempotent) {
    return {
      ok: false,
      code: 'REQUEST_REPLAY',
      currentRevision: loaded.record.canonical.revision,
    };
  }

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

  const prepared = correctionMutation(
    claimed.record.canonical,
    claimed.record.reactiveState,
    input.request.requestId,
    input.request.correctionId,
  );
  if (!prepared.ok) {
    const released = await release(
      input.repository,
      claimed.record,
      claimWrite.etag,
      claimed.record.canonical,
      claimed.record.reactiveState,
    );
    if (!released.ok) {
      return { ok: false, code: released.code, currentRevision: claimed.record.canonical.revision };
    }
    return { ok: false, code: prepared.code, currentRevision: claimed.record.canonical.revision };
  }

  const committed = dependencies.applyContextMutation(claimed.record.canonical, {
    baseRevision: claimed.record.canonical.revision,
    actor: 'user',
    mutation: prepared.mutation,
  });
  if (!committed.ok) {
    const released = await release(
      input.repository,
      claimed.record,
      claimWrite.etag,
      claimed.record.canonical,
      claimed.record.reactiveState,
    );
    if (!released.ok) {
      return { ok: false, code: released.code, currentRevision: claimed.record.canonical.revision };
    }
    return { ok: false, code: 'CORRECTION_COMMIT_REJECTED', currentRevision: claimed.record.canonical.revision };
  }

  let reactiveState: Readonly<ReactiveExperienceState>;
  try {
    reactiveState = dependencies.reconcileReactiveExperience(
      claimed.record.reactiveState,
      committed.context,
    );
  } catch {
    const released = await release(
      input.repository,
      claimed.record,
      claimWrite.etag,
      claimed.record.canonical,
      claimed.record.reactiveState,
    );
    if (!released.ok) {
      return {
        ok: false,
        code: released.code,
        currentRevision: claimed.record.canonical.revision,
      };
    }
    return { ok: false, code: 'CORRECTION_COMMIT_REJECTED', currentRevision: claimed.record.canonical.revision };
  }

  const surface = projectReactiveCanvas(
    createProcessGraph([], []),
    reactiveState,
    committed.context,
  );
  if (!surface.ok) {
    const released = await release(
      input.repository,
      claimed.record,
      claimWrite.etag,
      claimed.record.canonical,
      claimed.record.reactiveState,
    );
    if (!released.ok) {
      return {
        ok: false,
        code: released.code,
        currentRevision: claimed.record.canonical.revision,
      };
    }
    return { ok: false, code: 'SURFACE_REJECTED', currentRevision: claimed.record.canonical.revision };
  }

  const finalized = await release(
    input.repository,
    claimed.record,
    claimWrite.etag,
    committed.context,
    reactiveState,
  );
  if (!finalized.ok) {
    return {
      ok: false,
      code: finalized.code === 'CONFLICT' ? 'SESSION_CONFLICT' : finalized.code,
      currentRevision: committed.context.revision,
    };
  }

  return {
    ok: true,
    idempotent: false,
    correctionId: input.request.correctionId,
    state: projectPublicAgentSessionState(finalized.record),
  };
}
