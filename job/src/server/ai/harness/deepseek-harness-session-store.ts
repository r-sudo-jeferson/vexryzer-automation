import { createHash } from 'node:crypto';
import type { AgentSessionRepository } from '../../session/session-repository.ts';
import type { ConditionalJsonBlobStore } from '../../session/netlify-blob-session-repository.ts';
import type { DeepSeekHarnessAgentRole } from './deepseek-harness-visitor-policy.ts';

const STORE_PREFIX = 'harness-sessions/';
const SAFE_PARENT_SESSION_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_AUTHORITY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_HARNESS_SESSION_ID = /^vxa-harness-(?:seller|critic)-[a-f0-9]{40}$/;
const SAFE_EVENT_TYPE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const HEX_SHA256 = /^[a-f0-9]{64}$/;
const MAX_ID_LENGTH = 96;
const MAX_ETAG_LENGTH = 512;
const MAX_EVENTS_PER_SEGMENT = 256;
const MAX_JSON_BYTES = 1_000_000;
const MAX_JSON_DEPTH = 24;

export interface DeepSeekHarnessSessionEvent {
  seq: number;
  type: string;
  data: unknown;
}

interface DeepSeekHarnessSegmentReference {
  key: string;
  startSeq: number;
  endSeqExclusive: number;
  digest: string;
}

interface DeepSeekHarnessSessionManifest {
  schemaVersion: 1;
  parentSessionId: string;
  harnessSessionId: string;
  role: DeepSeekHarnessAgentRole;
  header: Readonly<Record<string, unknown>>;
  nextSeq: number;
  segments: readonly Readonly<DeepSeekHarnessSegmentReference>[];
  updatedAtEpochMs: number;
}

interface DeepSeekHarnessSessionSegment {
  schemaVersion: 1;
  parentSessionId: string;
  harnessSessionId: string;
  role: DeepSeekHarnessAgentRole;
  startSeq: number;
  endSeqExclusive: number;
  events: readonly Readonly<DeepSeekHarnessSessionEvent>[];
}

export type DeepSeekHarnessSessionStoreFailureCode =
  | 'INVALID_REQUEST'
  | 'PARENT_LEASE_INVALID'
  | 'PARENT_LEASE_EXPIRED'
  | 'ALREADY_EXISTS'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NON_CONTIGUOUS_EVENTS'
  | 'STORE_UNAVAILABLE';

export type DeepSeekHarnessSessionCreateResult =
  | {
      ok: true;
      harnessSessionId: string;
      nextSeq: number;
      manifestEtag: string;
    }
  | { ok: false; code: DeepSeekHarnessSessionStoreFailureCode };

export type DeepSeekHarnessSessionAppendResult =
  | {
      ok: true;
      harnessSessionId: string;
      nextSeq: number;
      manifestEtag: string;
    }
  | { ok: false; code: DeepSeekHarnessSessionStoreFailureCode };

export type DeepSeekHarnessSessionReadResult =
  | {
      ok: true;
      harnessSessionId: string;
      header: Readonly<Record<string, unknown>>;
      events: readonly Readonly<DeepSeekHarnessSessionEvent>[];
      nextSeq: number;
      manifestEtag: string;
    }
  | { ok: false; code: DeepSeekHarnessSessionStoreFailureCode };

export interface DeepSeekHarnessBlobSessionStore {
  create(input: {
    parentSessionId: string;
    leaseId: string;
    requestId: string;
    role: DeepSeekHarnessAgentRole;
    header: Readonly<Record<string, unknown>>;
  }): Promise<DeepSeekHarnessSessionCreateResult>;
  append(input: {
    parentSessionId: string;
    leaseId: string;
    requestId: string;
    role: DeepSeekHarnessAgentRole;
    harnessSessionId: string;
    expectedManifestEtag: string;
    events: readonly Readonly<DeepSeekHarnessSessionEvent>[];
  }): Promise<DeepSeekHarnessSessionAppendResult>;
  read(input: {
    parentSessionId: string;
    role: DeepSeekHarnessAgentRole;
    harnessSessionId: string;
  }): Promise<DeepSeekHarnessSessionReadResult>;
}

export interface DeepSeekHarnessBlobSessionStoreDependencies {
  store: Readonly<ConditionalJsonBlobStore>;
  parentRepository: Readonly<AgentSessionRepository>;
  nowEpochMs(): number;
}

function validRole(value: unknown): value is DeepSeekHarnessAgentRole {
  return value === 'seller' || value === 'critic';
}

function validParentSessionId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= MAX_ID_LENGTH
    && SAFE_PARENT_SESSION_ID.test(value);
}

function validAuthorityId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= MAX_ID_LENGTH
    && SAFE_AUTHORITY_ID.test(value);
}

function validEtag(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && value.length <= MAX_ETAG_LENGTH;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validateJsonValue(value: unknown, depth = 0): boolean {
  if (depth > MAX_JSON_DEPTH) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every((item) => validateJsonValue(item, depth + 1));
  if (!isPlainObject(value)) return false;
  return Object.values(value).every((item) => validateJsonValue(item, depth + 1));
}

function canonicalSerialize(value: unknown): string {
  if (Array.isArray(value)) return '[' + value.map(canonicalSerialize).join(',') + ']';
  if (isPlainObject(value)) {
    const entries = Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => JSON.stringify(key) + ':' + canonicalSerialize(nested));
    return '{' + entries.join(',') + '}';
  }
  return JSON.stringify(value);
}

function jsonFits(value: unknown): boolean {
  if (!validateJsonValue(value)) return false;
  try {
    return new TextEncoder().encode(canonicalSerialize(value)).byteLength <= MAX_JSON_BYTES;
  } catch {
    return false;
  }
}

function cloneFrozenJsonObject(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.freeze(structuredClone(value));
}

function freezeEvent(event: Readonly<DeepSeekHarnessSessionEvent>): Readonly<DeepSeekHarnessSessionEvent> {
  return Object.freeze({
    seq: event.seq,
    type: event.type,
    data: structuredClone(event.data),
  });
}

function validEvent(event: unknown): event is Readonly<DeepSeekHarnessSessionEvent> {
  if (!isPlainObject(event)) return false;
  const keys = Object.keys(event).sort();
  if (keys.join(',') !== 'data,seq,type') return false;
  return Number.isSafeInteger(event['seq'])
    && (event['seq'] as number) >= 0
    && typeof event['type'] === 'string'
    && SAFE_EVENT_TYPE.test(event['type'])
    && jsonFits(event['data']);
}

function validHeader(value: unknown): value is Readonly<Record<string, unknown>> {
  return isPlainObject(value) && jsonFits(value);
}

export function deriveDeepSeekHarnessSessionId(
  parentSessionId: string,
  role: DeepSeekHarnessAgentRole,
): string {
  if (!validParentSessionId(parentSessionId) || !validRole(role)) {
    throw new TypeError('invalid Harness session authority');
  }
  const digest = createHash('sha256')
    .update('vxa-deepseek-harness-session\0', 'utf8')
    .update(role, 'utf8')
    .update('\0', 'utf8')
    .update(parentSessionId, 'utf8')
    .digest('hex')
    .slice(0, 40);
  return `vxa-harness-${role}-${digest}`;
}

function sessionPrefix(harnessSessionId: string): string {
  return `${STORE_PREFIX}${harnessSessionId}`;
}
function manifestKey(harnessSessionId: string): string {
  return `${sessionPrefix(harnessSessionId)}/manifest.json`;
}

function segmentKey(
  harnessSessionId: string,
  startSeq: number,
  endSeqExclusive: number,
  digest: string,
): string {
  return `${sessionPrefix(harnessSessionId)}/segments/${startSeq}-${endSeqExclusive}-${digest}.json`;
}

function sameJson(a: unknown, b: unknown): boolean {
  try {
    return canonicalSerialize(a) === canonicalSerialize(b);
  } catch {
    return false;
  }
}

function parseManifest(
  value: unknown,
  expected: {
    parentSessionId: string;
    role: DeepSeekHarnessAgentRole;
    harnessSessionId: string;
  },
): Readonly<DeepSeekHarnessSessionManifest> | null {
  if (!isPlainObject(value)) return null;
  if (value['schemaVersion'] !== 1
    || value['parentSessionId'] !== expected.parentSessionId
    || value['harnessSessionId'] !== expected.harnessSessionId
    || value['role'] !== expected.role
    || !validHeader(value['header'])
    || !Number.isSafeInteger(value['nextSeq'])
    || (value['nextSeq'] as number) < 0
    || !Number.isSafeInteger(value['updatedAtEpochMs'])
    || (value['updatedAtEpochMs'] as number) < 0
    || !Array.isArray(value['segments'])) {
    return null;
  }

  const refs: Readonly<DeepSeekHarnessSegmentReference>[] = [];
  let expectedStart = 0;
  for (const raw of value['segments']) {
    if (!isPlainObject(raw)
      || !Number.isSafeInteger(raw['startSeq'])
      || !Number.isSafeInteger(raw['endSeqExclusive'])
      || typeof raw['digest'] !== 'string'
      || !HEX_SHA256.test(raw['digest'])
      || typeof raw['key'] !== 'string') {
      return null;
    }
    const startSeq = raw['startSeq'] as number;
    const endSeqExclusive = raw['endSeqExclusive'] as number;
    const digest = raw['digest'];
    const key = raw['key'];
    if (startSeq !== expectedStart
      || endSeqExclusive <= startSeq
      || key !== segmentKey(expected.harnessSessionId, startSeq, endSeqExclusive, digest)) {
      return null;
    }
    expectedStart = endSeqExclusive;
    refs.push(Object.freeze({ key, startSeq, endSeqExclusive, digest }));
  }

  if (expectedStart !== value['nextSeq']) return null;
  return Object.freeze({
    schemaVersion: 1,
    parentSessionId: expected.parentSessionId,
    harnessSessionId: expected.harnessSessionId,
    role: expected.role,
    header: cloneFrozenJsonObject(value['header']),
    nextSeq: value['nextSeq'] as number,
    segments: Object.freeze(refs),
    updatedAtEpochMs: value['updatedAtEpochMs'] as number,
  });
}

function segmentDigest(segment: Readonly<DeepSeekHarnessSessionSegment>): string {
  return createHash('sha256').update(canonicalSerialize(segment), 'utf8').digest('hex');
}
function parseSegment(
  value: unknown,
  expected: {
    parentSessionId: string;
    role: DeepSeekHarnessAgentRole;
    harnessSessionId: string;
    reference: Readonly<DeepSeekHarnessSegmentReference>;
  },
): readonly Readonly<DeepSeekHarnessSessionEvent>[] | null {
  if (!isPlainObject(value)
    || value['schemaVersion'] !== 1
    || value['parentSessionId'] !== expected.parentSessionId
    || value['harnessSessionId'] !== expected.harnessSessionId
    || value['role'] !== expected.role
    || value['startSeq'] !== expected.reference.startSeq
    || value['endSeqExclusive'] !== expected.reference.endSeqExclusive
    || !Array.isArray(value['events'])) {
    return null;
  }

  const events: Readonly<DeepSeekHarnessSessionEvent>[] = [];
  let seq = expected.reference.startSeq;
  for (const raw of value['events']) {
    if (!validEvent(raw) || raw.seq !== seq) return null;
    events.push(freezeEvent(raw));
    seq += 1;
  }
  if (seq !== expected.reference.endSeqExclusive) return null;

  const segment: Readonly<DeepSeekHarnessSessionSegment> = Object.freeze({
    schemaVersion: 1,
    parentSessionId: expected.parentSessionId,
    harnessSessionId: expected.harnessSessionId,
    role: expected.role,
    startSeq: expected.reference.startSeq,
    endSeqExclusive: expected.reference.endSeqExclusive,
    events: Object.freeze(events),
  });
  return segmentDigest(segment) === expected.reference.digest
    ? segment.events
    : null;
}

async function validateParentLease(
  dependencies: Readonly<DeepSeekHarnessBlobSessionStoreDependencies>,
  input: { parentSessionId: string; leaseId: string; requestId: string },
): Promise<{ ok: true } | { ok: false; code: DeepSeekHarnessSessionStoreFailureCode }> {
  if (!validParentSessionId(input.parentSessionId)
    || !validAuthorityId(input.leaseId)
    || !validAuthorityId(input.requestId)) {
    return { ok: false, code: 'INVALID_REQUEST' };
  }

  let parent;
  try {
    parent = await dependencies.parentRepository.get(input.parentSessionId);
  } catch {
    return { ok: false, code: 'STORE_UNAVAILABLE' };
  }
  if (parent === null || parent.record.status !== 'processing' || parent.record.lease === null) {
    return { ok: false, code: 'PARENT_LEASE_INVALID' };
  }

  const lease = parent.record.lease;
  if (lease.leaseId !== input.leaseId || lease.requestId !== input.requestId) {
    return { ok: false, code: 'PARENT_LEASE_INVALID' };
  }

  const now = dependencies.nowEpochMs();
  if (!Number.isSafeInteger(now) || now < 0) return { ok: false, code: 'STORE_UNAVAILABLE' };
  if (lease.expiresAtEpochMs <= now) return { ok: false, code: 'PARENT_LEASE_EXPIRED' };
  return { ok: true };
}

async function readManifest(
  store: Readonly<ConditionalJsonBlobStore>,
  expected: {
    parentSessionId: string;
    role: DeepSeekHarnessAgentRole;
    harnessSessionId: string;
  },
): Promise<
  | { ok: true; manifest: Readonly<DeepSeekHarnessSessionManifest>; etag: string }
  | { ok: false; code: 'NOT_FOUND' | 'STORE_UNAVAILABLE' }
> {
  let stored;
  try {
    stored = await store.getWithMetadata(manifestKey(expected.harnessSessionId), {
      type: 'json',
      consistency: 'strong',
    });
  } catch {
    return { ok: false, code: 'STORE_UNAVAILABLE' };
  }
  if (stored === null) return { ok: false, code: 'NOT_FOUND' };
  if (!validEtag(stored.etag)) return { ok: false, code: 'STORE_UNAVAILABLE' };
  const manifest = parseManifest(stored.data, expected);
  if (manifest === null) return { ok: false, code: 'STORE_UNAVAILABLE' };
  return { ok: true, manifest, etag: stored.etag };
}
async function confirmManifestWrite(
  store: Readonly<ConditionalJsonBlobStore>,
  manifest: Readonly<DeepSeekHarnessSessionManifest>,
  writeResult: { modified: boolean; etag?: string },
  previousEtag?: string,
): Promise<
  | { ok: true; etag: string }
  | { ok: false; code: 'CONFLICT' | 'STORE_UNAVAILABLE' }
> {
  if (!writeResult.modified) return { ok: false, code: 'CONFLICT' };
  if (!validEtag(writeResult.etag)) return { ok: false, code: 'STORE_UNAVAILABLE' };

  const readBack = await readManifest(store, {
    parentSessionId: manifest.parentSessionId,
    role: manifest.role,
    harnessSessionId: manifest.harnessSessionId,
  });
  if (!readBack.ok) return { ok: false, code: 'STORE_UNAVAILABLE' };
  if (readBack.etag === writeResult.etag && sameJson(readBack.manifest, manifest)) {
    return { ok: true, etag: writeResult.etag };
  }
  if (previousEtag !== undefined && readBack.etag !== previousEtag) {
    return { ok: false, code: 'CONFLICT' };
  }
  return { ok: false, code: 'STORE_UNAVAILABLE' };
}
async function ensureSegmentStored(
  store: Readonly<ConditionalJsonBlobStore>,
  key: string,
  segment: Readonly<DeepSeekHarnessSessionSegment>,
  reference: Readonly<DeepSeekHarnessSegmentReference>,
): Promise<boolean> {
  try {
    await store.setJSON(key, segment, { onlyIfNew: true });
    const stored = await store.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (stored === null) return false;
    const parsed = parseSegment(stored.data, {
      parentSessionId: segment.parentSessionId,
      role: segment.role,
      harnessSessionId: segment.harnessSessionId,
      reference,
    });
    return parsed !== null;
  } catch {
    return false;
  }
}

function validReadIdentity(input: {
  parentSessionId: string;
  role: DeepSeekHarnessAgentRole;
  harnessSessionId: string;
}): boolean {
  if (!validParentSessionId(input.parentSessionId)
    || !validRole(input.role)
    || typeof input.harnessSessionId !== 'string'
    || !SAFE_HARNESS_SESSION_ID.test(input.harnessSessionId)) {
    return false;
  }
  return deriveDeepSeekHarnessSessionId(input.parentSessionId, input.role) === input.harnessSessionId;
}

export function createDeepSeekHarnessBlobSessionStore(
  dependencies: Readonly<DeepSeekHarnessBlobSessionStoreDependencies>,
): DeepSeekHarnessBlobSessionStore {
  return Object.freeze({
    async create(
      input: Parameters<DeepSeekHarnessBlobSessionStore['create']>[0],
    ): Promise<DeepSeekHarnessSessionCreateResult> {
      if (!validRole(input.role) || !validHeader(input.header)) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }
      const parentLease = await validateParentLease(dependencies, input);
      if (!parentLease.ok) return parentLease;

      const harnessSessionId = deriveDeepSeekHarnessSessionId(input.parentSessionId, input.role);
      const now = dependencies.nowEpochMs();
      if (!Number.isSafeInteger(now) || now < 0) {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
      const manifest: Readonly<DeepSeekHarnessSessionManifest> = Object.freeze({
        schemaVersion: 1,
        parentSessionId: input.parentSessionId,
        harnessSessionId,
        role: input.role,
        header: cloneFrozenJsonObject(input.header),
        nextSeq: 0,
        segments: Object.freeze([]),
        updatedAtEpochMs: now,
      });

      let writeResult;
      try {
        writeResult = await dependencies.store.setJSON(
          manifestKey(harnessSessionId),
          manifest,
          { onlyIfNew: true },
        );
      } catch {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
      if (!writeResult.modified) return { ok: false, code: 'ALREADY_EXISTS' };

      const confirmed = await confirmManifestWrite(dependencies.store, manifest, writeResult);
      if (!confirmed.ok) return confirmed;
      return Object.freeze({
        ok: true,
        harnessSessionId,
        nextSeq: 0,
        manifestEtag: confirmed.etag,
      });
    },

    async append(
      input: Parameters<DeepSeekHarnessBlobSessionStore['append']>[0],
    ): Promise<DeepSeekHarnessSessionAppendResult> {
      if (!validRole(input.role)
        || !validEtag(input.expectedManifestEtag)
        || !validReadIdentity(input)
        || !Array.isArray(input.events)
        || input.events.length < 1
        || input.events.length > MAX_EVENTS_PER_SEGMENT) {
        return { ok: false, code: 'INVALID_REQUEST' };
      }

      const parentLease = await validateParentLease(dependencies, input);
      if (!parentLease.ok) return parentLease;

      const current = await readManifest(dependencies.store, input);
      if (!current.ok) return current;
      if (current.etag !== input.expectedManifestEtag) {
        return { ok: false, code: 'CONFLICT' };
      }

      const events: Readonly<DeepSeekHarnessSessionEvent>[] = [];
      let expectedSeq = current.manifest.nextSeq;
      for (const raw of input.events) {
        if (!validEvent(raw) || raw.seq !== expectedSeq) {
          return { ok: false, code: 'NON_CONTIGUOUS_EVENTS' };
        }
        events.push(freezeEvent(raw));
        expectedSeq += 1;
      }

      const segment: Readonly<DeepSeekHarnessSessionSegment> = Object.freeze({
        schemaVersion: 1,
        parentSessionId: input.parentSessionId,
        harnessSessionId: input.harnessSessionId,
        role: input.role,
        startSeq: current.manifest.nextSeq,
        endSeqExclusive: expectedSeq,
        events: Object.freeze(events),
      });
      const digest = segmentDigest(segment);
      const key = segmentKey(
        input.harnessSessionId,
        segment.startSeq,
        segment.endSeqExclusive,
        digest,
      );
      const reference: Readonly<DeepSeekHarnessSegmentReference> = Object.freeze({
        key,
        startSeq: segment.startSeq,
        endSeqExclusive: segment.endSeqExclusive,
        digest,
      });

      if (!await ensureSegmentStored(dependencies.store, key, segment, reference)) {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }

      const publicationLease = await validateParentLease(dependencies, input);
      if (!publicationLease.ok) return publicationLease;

      const now = dependencies.nowEpochMs();
      if (!Number.isSafeInteger(now) || now < 0) {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
      const manifest: Readonly<DeepSeekHarnessSessionManifest> = Object.freeze({
        ...current.manifest,
        nextSeq: segment.endSeqExclusive,
        segments: Object.freeze([...current.manifest.segments, reference]),
        updatedAtEpochMs: now,
      });

      let writeResult;
      try {
        writeResult = await dependencies.store.setJSON(
          manifestKey(input.harnessSessionId),
          manifest,
          { onlyIfMatch: input.expectedManifestEtag },
        );
      } catch {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }

      const confirmed = await confirmManifestWrite(
        dependencies.store,
        manifest,
        writeResult,
        input.expectedManifestEtag,
      );
      if (!confirmed.ok) return confirmed;
      return Object.freeze({
        ok: true,
        harnessSessionId: input.harnessSessionId,
        nextSeq: manifest.nextSeq,
        manifestEtag: confirmed.etag,
      });
    },

    async read(
      input: Parameters<DeepSeekHarnessBlobSessionStore['read']>[0],
    ): Promise<DeepSeekHarnessSessionReadResult> {
      if (!validReadIdentity(input)) return { ok: false, code: 'INVALID_REQUEST' };
      const current = await readManifest(dependencies.store, input);
      if (!current.ok) return current;

      const events: Readonly<DeepSeekHarnessSessionEvent>[] = [];
      for (const reference of current.manifest.segments) {
        let stored;
        try {
          stored = await dependencies.store.getWithMetadata(reference.key, {
            type: 'json',
            consistency: 'strong',
          });
        } catch {
          return { ok: false, code: 'STORE_UNAVAILABLE' };
        }
        if (stored === null) return { ok: false, code: 'STORE_UNAVAILABLE' };
        const parsed = parseSegment(stored.data, {
          parentSessionId: input.parentSessionId,
          role: input.role,
          harnessSessionId: input.harnessSessionId,
          reference,
        });
        if (parsed === null) return { ok: false, code: 'STORE_UNAVAILABLE' };
        events.push(...parsed);
      }

      if (events.length !== current.manifest.nextSeq) {
        return { ok: false, code: 'STORE_UNAVAILABLE' };
      }
      return Object.freeze({
        ok: true,
        harnessSessionId: input.harnessSessionId,
        header: current.manifest.header,
        events: Object.freeze(events),
        nextSeq: current.manifest.nextSeq,
        manifestEtag: current.etag,
      });
    },
  });
}
