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

export type ConditionalBlobWriteOptions =
  | { onlyIfNew: true; onlyIfMatch?: never }
  | { onlyIfMatch: string; onlyIfNew?: never };

export interface ConditionalJsonBlobStore {
  getWithMetadata(
    key: string,
    options: { type: 'json'; consistency: 'strong' },
  ): Promise<{ data: unknown; etag?: string; metadata: object } | null>;
  setJSON(
    key: string,
    value: unknown,
    options: ConditionalBlobWriteOptions,
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

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(stableSerialize).join(',') + ']';
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => JSON.stringify(key) + ':' + stableSerialize(nested));
    return '{' + entries.join(',') + '}';
  }
  return JSON.stringify(value) ?? 'undefined';
}

function sameRecord(a: Readonly<AgentSessionRecord>, b: Readonly<AgentSessionRecord>): boolean {
  return stableSerialize(a) === stableSerialize(b);
}

async function confirmConditionalWrite(
  store: Readonly<ConditionalJsonBlobStore>,
  key: string,
  intended: Readonly<AgentSessionRecord>,
  result: Readonly<ConditionalBlobWriteResult>,
  conflictCode: 'ALREADY_EXISTS' | 'CONFLICT',
  previousEtag?: string,
): Promise<SessionCreateResult | SessionCompareAndSetResult> {
  if (result.modified === false) return { ok: false, code: conflictCode };
  // @netlify/blobs 11.0.3 can report modified:true for non-412 failures.
  // Empty ETag is known evidence of that phantom-success path.
  if (!validEtag(result.etag)) return { ok: false, code: 'STORE_UNAVAILABLE' };

  let readBack;
  try {
    readBack = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
  } catch {
    return { ok: false, code: 'STORE_UNAVAILABLE' };
  }
  if (readBack === null || !validEtag(readBack.etag)) {
    return { ok: false, code: 'STORE_UNAVAILABLE' };
  }

  const persisted = parseStoredRecord(intended.sessionId, readBack.data);
  if (readBack.etag === result.etag && persisted !== null && sameRecord(persisted, intended)) {
    return { ok: true, etag: result.etag };
  }

  if (previousEtag !== undefined && readBack.etag !== previousEtag) {
    return { ok: false, code: 'CONFLICT' };
  }
  return { ok: false, code: 'STORE_UNAVAILABLE' };
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
        return await confirmConditionalWrite(store, key, frozen, result, 'ALREADY_EXISTS') as SessionCreateResult;
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
        return await confirmConditionalWrite(
          store,
          key,
          frozen,
          result,
          'CONFLICT',
          expectedEtag,
        ) as SessionCompareAndSetResult;
      } catch {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
    },
  });
}
