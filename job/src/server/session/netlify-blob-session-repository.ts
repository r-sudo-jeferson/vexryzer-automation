import { freezeAgentSessionRecord, type AgentSessionRecord } from './agent-session.ts';
import type {
  AgentSessionRepository,
  SessionCompareAndSetResult,
  SessionCreateResult,
  VersionedAgentSession,
} from './session-repository.ts';

export interface ConditionalBlobWriteResult {
  modified: boolean;
  etag?: string;
}

export interface ConditionalJsonBlobStore {
  getWithMetadata(
    key: string,
    options: { type: 'json'; consistency: 'strong' },
  ): Promise<{ data: unknown; etag: string; metadata: object } | null>;
  setJSON(
    key: string,
    value: unknown,
    options: { onlyIfNew?: boolean; onlyIfMatch?: string },
  ): Promise<Readonly<ConditionalBlobWriteResult>>;
}

const SAFE_SESSION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const STORE_PREFIX = 'sessions/';

function sessionKey(sessionId: string): string | null {
  if (
    typeof sessionId !== 'string'
    || sessionId.length < 1
    || sessionId.length > 96
    || !SAFE_SESSION_ID.test(sessionId)
  ) return null;
  return `${STORE_PREFIX}${sessionId}.json`;
}

function validEtag(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 512;
}

function parseStoredRecord(
  sessionId: string,
  value: unknown,
): Readonly<AgentSessionRecord> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  try {
    const record = freezeAgentSessionRecord(value as AgentSessionRecord);
    return record.sessionId === sessionId ? record : null;
  } catch {
    return null;
  }
}

function classifyConditionalWrite(
  result: Readonly<ConditionalBlobWriteResult>,
  conflictCode: 'ALREADY_EXISTS' | 'CONFLICT',
): SessionCreateResult | SessionCompareAndSetResult {
  if (result.modified === false) return { ok: false, code: conflictCode };
  // @netlify/blobs <= current 11.0.x can report modified:true with an empty ETag
  // for a failed conditional write. Never accept an unverifiable commit.
  if (!validEtag(result.etag)) return { ok: false, code: 'STORE_UNAVAILABLE' };
  return { ok: true, etag: result.etag };
}

export function createNetlifyBlobSessionRepository(
  store: Readonly<ConditionalJsonBlobStore>,
): AgentSessionRepository {
  return Object.freeze({
    async get(sessionId: string): Promise<Readonly<VersionedAgentSession> | null> {
      const key = sessionKey(sessionId);
      if (key === null) return null;
      try {
        const result = await store.getWithMetadata(key, {
          type: 'json',
          consistency: 'strong',
        });
        if (result === null) return null;
        if (!validEtag(result.etag)) throw new TypeError('blob read returned an invalid ETag');
        const record = parseStoredRecord(sessionId, result.data);
        if (record === null) throw new TypeError('blob session record failed validation');
        return Object.freeze({ record, etag: result.etag });
      } catch {
        throw new Error('agent session store unavailable');
      }
    },

    async create(record: Readonly<AgentSessionRecord>): Promise<SessionCreateResult> {
      const key = sessionKey(record.sessionId);
      if (key === null) return { ok: false, code: 'STORE_UNAVAILABLE' };
      let frozen: Readonly<AgentSessionRecord>;
      try {
        frozen = freezeAgentSessionRecord(record);
      } catch {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
      try {
        const result = await store.setJSON(key, frozen, { onlyIfNew: true });
        return classifyConditionalWrite(result, 'ALREADY_EXISTS') as SessionCreateResult;
      } catch {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
    },

    async compareAndSet(
      sessionId: string,
      expectedEtag: string,
      record: Readonly<AgentSessionRecord>,
    ): Promise<SessionCompareAndSetResult> {
      const key = sessionKey(sessionId);
      if (key === null || !validEtag(expectedEtag) || record.sessionId !== sessionId) {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
      let frozen: Readonly<AgentSessionRecord>;
      try {
        frozen = freezeAgentSessionRecord(record);
      } catch {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
      try {
        const result = await store.setJSON(key, frozen, { onlyIfMatch: expectedEtag });
        return classifyConditionalWrite(result, 'CONFLICT') as SessionCompareAndSetResult;
      } catch {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
    },
  });
}
