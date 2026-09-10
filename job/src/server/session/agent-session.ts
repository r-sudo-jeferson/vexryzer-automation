import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import {
  createCanonicalSalesContext,
  freezeCanonicalSalesContext,
  type CanonicalSalesContext,
} from '../../ai/context/canonical-sales-context.ts';
import type { RecentContextTurn } from '../../ai/context/context-packager.ts';
import {
  createReactiveExperienceState,
  freezeReactiveExperienceState,
  type ReactiveExperienceState,
} from '../../experience/reactive-experience-state.ts';

export const AGENT_SESSION_LIMITS = Object.freeze({
  userText: 4_000,
  recentTurns: 24,
  leaseMs: 60_000,
});

export type AgentSessionMode = 'agent' | 'guided_recovery';

export interface AgentSessionLease {
  leaseId: string;
  requestId: string;
  expiresAtEpochMs: number;
}

export interface CompletedAgentRequest {
  requestId: string;
  inputRevision: number;
  resultRevision: number;
  mode: AgentSessionMode;
  narration: string;
  nextQuestion: string | null;
}

export interface AgentSessionRecord {
  schemaVersion: 1;
  sessionId: string;
  sessionTokenDigest: string;
  status: 'idle' | 'processing';
  lease: Readonly<AgentSessionLease> | null;
  canonical: CanonicalSalesContext;
  reactiveState: Readonly<ReactiveExperienceState>;
  recentTurns: readonly Readonly<RecentContextTurn>[];
  lastCompletedRequest: Readonly<CompletedAgentRequest> | null;
}

export interface CreatedAgentSession {
  record: Readonly<AgentSessionRecord>;
  sessionToken: string;
}

export interface AgentSessionEntropy {
  sessionId(): string;
  token(): string;
  leaseId(): string;
}

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const DEFAULT_ENTROPY: AgentSessionEntropy = Object.freeze({
  sessionId: () => randomUUID(),
  token: () => randomBytes(32).toString('base64url'),
  leaseId: () => randomUUID(),
});

function safeId(value: string): boolean {
  return value.length >= 1 && value.length <= 96 && SAFE_ID.test(value);
}

function boundedText(value: string, max: number): boolean {
  const text = value.trim();
  return text.length >= 1 && text.length <= max && !CONTROL.test(value);
}

export function digestSessionToken(token: string): string {
  if (!TOKEN.test(token)) throw new TypeError('invalid session token');
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export function sessionTokenMatches(token: string, expectedDigest: string): boolean {
  if (!TOKEN.test(token) || !HEX_SHA256.test(expectedDigest)) return false;
  const actual = Buffer.from(digestSessionToken(token), 'hex');
  const expected = Buffer.from(expectedDigest, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function freezeAgentSessionRecord(record: AgentSessionRecord): Readonly<AgentSessionRecord> {
  if (record.schemaVersion !== 1 || !safeId(record.sessionId) || !HEX_SHA256.test(record.sessionTokenDigest)) {
    throw new TypeError('invalid agent session identity');
  }
  if (record.status !== 'idle' && record.status !== 'processing') throw new TypeError('invalid agent session status');
  if ((record.status === 'idle') !== (record.lease === null)) throw new TypeError('lease/status mismatch');
  if (record.lease !== null) {
    if (!safeId(record.lease.leaseId) || !safeId(record.lease.requestId)
      || !Number.isSafeInteger(record.lease.expiresAtEpochMs) || record.lease.expiresAtEpochMs < 0) {
      throw new TypeError('invalid agent session lease');
    }
  }
  if (record.recentTurns.length > AGENT_SESSION_LIMITS.recentTurns) throw new TypeError('too many recent turns');
  const turnIds = new Set<string>();
  const recentTurns = record.recentTurns.map((turn) => {
    if (!safeId(turn.id) || turnIds.has(turn.id) || !['user', 'assistant', 'tool'].includes(turn.role)
      || !boundedText(turn.text, 8_000)) throw new TypeError('invalid recent turn');
    turnIds.add(turn.id);
    return Object.freeze({ id: turn.id, role: turn.role, text: turn.text.trim() });
  });

  const canonical = freezeCanonicalSalesContext(record.canonical);
  const reactiveState = freezeReactiveExperienceState(record.reactiveState);
  if (reactiveState.basedOnRevision > canonical.revision) {
    throw new TypeError('reactive state cannot be ahead of canonical state');
  }

  let lastCompletedRequest: Readonly<CompletedAgentRequest> | null = null;
  if (record.lastCompletedRequest !== null) {
    const completed = record.lastCompletedRequest;
    if (!safeId(completed.requestId)
      || !Number.isInteger(completed.inputRevision) || completed.inputRevision < 0
      || !Number.isInteger(completed.resultRevision) || completed.resultRevision < completed.inputRevision
      || completed.resultRevision > canonical.revision
      || !['agent', 'guided_recovery'].includes(completed.mode)
      || !boundedText(completed.narration, 4_000)
      || (completed.nextQuestion !== null && !boundedText(completed.nextQuestion, 800))) {
      throw new TypeError('invalid completed request');
    }
    lastCompletedRequest = Object.freeze({ ...completed });
  }

  return Object.freeze({
    ...record,
    lease: record.lease === null ? null : Object.freeze({ ...record.lease }),
    canonical,
    reactiveState,
    recentTurns: Object.freeze(recentTurns),
    lastCompletedRequest,
  });
}

export function createAgentSession(
  entropy: Readonly<AgentSessionEntropy> = DEFAULT_ENTROPY,
): Readonly<CreatedAgentSession> {
  const sessionId = entropy.sessionId();
  const sessionToken = entropy.token();
  if (!safeId(sessionId) || !TOKEN.test(sessionToken)) throw new TypeError('session entropy produced invalid identifiers');
  const canonical = createCanonicalSalesContext({ sessionId });
  return Object.freeze({
    sessionToken,
    record: freezeAgentSessionRecord({
      schemaVersion: 1,
      sessionId,
      sessionTokenDigest: digestSessionToken(sessionToken),
      status: 'idle',
      lease: null,
      canonical,
      reactiveState: createReactiveExperienceState({ basedOnRevision: canonical.revision }),
      recentTurns: [],
      lastCompletedRequest: null,
    }),
  });
}

export function claimAgentSession(
  record: Readonly<AgentSessionRecord>,
  input: { requestId: string; expectedRevision: number; nowEpochMs: number },
  entropy: Pick<AgentSessionEntropy, 'leaseId'> = DEFAULT_ENTROPY,
):
  | { ok: true; record: Readonly<AgentSessionRecord>; idempotent: false }
  | { ok: true; record: Readonly<AgentSessionRecord>; idempotent: true; completed: Readonly<CompletedAgentRequest> }
  | { ok: false; code: 'INVALID_REQUEST' | 'REQUEST_REPLAY' | 'STALE_REVISION' | 'SESSION_BUSY' } {
  if (!safeId(input.requestId) || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 0
    || !Number.isSafeInteger(input.nowEpochMs) || input.nowEpochMs < 0) {
    return { ok: false, code: 'INVALID_REQUEST' };
  }

  const completed = record.lastCompletedRequest;
  if (completed !== null && completed.requestId === input.requestId) {
    if (record.status !== 'idle') return { ok: false, code: 'SESSION_BUSY' };
    if (completed.resultRevision !== record.canonical.revision) {
      return { ok: false, code: 'REQUEST_REPLAY' };
    }
    return { ok: true, record, idempotent: true, completed };
  }

  if (record.canonical.turnIds.includes(input.requestId)) return { ok: false, code: 'REQUEST_REPLAY' };
  if (input.expectedRevision !== record.canonical.revision) return { ok: false, code: 'STALE_REVISION' };
  if (record.status === 'processing' && record.lease !== null
    && record.lease.expiresAtEpochMs > input.nowEpochMs) {
    return { ok: false, code: 'SESSION_BUSY' };
  }

  const leaseId = entropy.leaseId();
  if (!safeId(leaseId)) return { ok: false, code: 'INVALID_REQUEST' };
  return {
    ok: true,
    idempotent: false,
    record: freezeAgentSessionRecord({
      ...record,
      status: 'processing',
      lease: {
        leaseId,
        requestId: input.requestId,
        expiresAtEpochMs: input.nowEpochMs + AGENT_SESSION_LIMITS.leaseMs,
      },
    }),
  };
}

export function releaseAgentSessionLease(
  claimed: Readonly<AgentSessionRecord>,
  input: {
    leaseId: string;
    canonical: CanonicalSalesContext;
    reactiveState: Readonly<ReactiveExperienceState>;
    recentTurns: readonly Readonly<RecentContextTurn>[];
  },
): Readonly<AgentSessionRecord> {
  if (claimed.status !== 'processing' || claimed.lease === null || claimed.lease.leaseId !== input.leaseId) {
    throw new TypeError('session release does not own the active lease');
  }
  return freezeAgentSessionRecord({
    ...claimed,
    status: 'idle',
    lease: null,
    canonical: input.canonical,
    reactiveState: input.reactiveState,
    recentTurns: input.recentTurns.slice(-AGENT_SESSION_LIMITS.recentTurns),
  });
}

export function completeAgentSession(
  claimed: Readonly<AgentSessionRecord>,
  input: {
    leaseId: string;
    canonical: CanonicalSalesContext;
    reactiveState: Readonly<ReactiveExperienceState>;
    recentTurns: readonly Readonly<RecentContextTurn>[];
    completed: Readonly<CompletedAgentRequest>;
  },
): Readonly<AgentSessionRecord> {
  if (claimed.status !== 'processing' || claimed.lease === null || claimed.lease.leaseId !== input.leaseId) {
    throw new TypeError('session completion does not own the active lease');
  }
  if (input.completed.requestId !== claimed.lease.requestId) {
    throw new TypeError('session completion request does not match lease');
  }
  return freezeAgentSessionRecord({
    ...claimed,
    status: 'idle',
    lease: null,
    canonical: input.canonical,
    reactiveState: input.reactiveState,
    recentTurns: input.recentTurns.slice(-AGENT_SESSION_LIMITS.recentTurns),
    lastCompletedRequest: input.completed,
  });
}
