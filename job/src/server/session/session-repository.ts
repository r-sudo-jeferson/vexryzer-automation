import type { AgentSessionRecord } from './agent-session.ts';

export interface VersionedAgentSession {
  record: Readonly<AgentSessionRecord>;
  etag: string;
}

export type SessionCreateResult =
  | { ok: true; etag: string }
  | { ok: false; code: 'ALREADY_EXISTS' | 'STORE_UNAVAILABLE' };

export type SessionCompareAndSetResult =
  | { ok: true; etag: string }
  | { ok: false; code: 'CONFLICT' | 'NOT_FOUND' | 'STORE_UNAVAILABLE' };

export interface AgentSessionRepository {
  get(sessionId: string): Promise<Readonly<VersionedAgentSession> | null>;
  create(record: Readonly<AgentSessionRecord>): Promise<SessionCreateResult>;
  compareAndSet(
    sessionId: string,
    expectedEtag: string,
    record: Readonly<AgentSessionRecord>,
  ): Promise<SessionCompareAndSetResult>;
}
