import test from 'node:test';
import assert from 'node:assert/strict';
import {
  claimAgentSession,
  createAgentSession,
  type AgentSessionRecord,
} from '../../src/server/session/agent-session.ts';
import type {
  AgentSessionRepository,
  SessionCompareAndSetResult,
  SessionCreateResult,
  VersionedAgentSession,
} from '../../src/server/session/session-repository.ts';
import type {
  ConditionalBlobWriteOptions,
  ConditionalJsonBlobStore,
} from '../../src/server/session/netlify-blob-session-repository.ts';
import {
  createDeepSeekHarnessBlobSessionStore,
  deriveDeepSeekHarnessSessionId,
} from '../../src/server/ai/harness/deepseek-harness-session-store.ts';

class MemoryBlobStore implements ConditionalJsonBlobStore {
  readonly values = new Map<string, { value: unknown; version: number }>();

  async getWithMetadata(key: string, _options: { type: 'json'; consistency: 'strong' }) {
    const entry = this.values.get(key);
    if (entry === undefined) return null;
    return {
      data: structuredClone(entry.value),
      etag: `v${entry.version}`,
      metadata: {},
    };
  }

  async setJSON(key: string, value: unknown, options: ConditionalBlobWriteOptions) {
    const existing = this.values.get(key);
    if ('onlyIfNew' in options) {
      if (existing !== undefined) return { modified: false };
      this.values.set(key, { value: structuredClone(value), version: 1 });
      return { modified: true, etag: 'v1' };
    }
    if (existing === undefined || `v${existing.version}` !== options.onlyIfMatch) {
      return { modified: false };
    }
    const version = existing.version + 1;
    this.values.set(key, { value: structuredClone(value), version });
    return { modified: true, etag: `v${version}` };
  }
}

class ParentRepository implements AgentSessionRepository {
  readonly record: Readonly<AgentSessionRecord>;

  constructor(record: Readonly<AgentSessionRecord>) {
    this.record = record;
  }

  async get(sessionId: string): Promise<Readonly<VersionedAgentSession> | null> {
    return sessionId === this.record.sessionId
      ? { record: this.record, etag: 'parent-v1' }
      : null;
  }

  async create(_record: Readonly<AgentSessionRecord>): Promise<SessionCreateResult> {
    throw new Error('not used');
  }

  async compareAndSet(
    _sessionId: string,
    _expectedEtag: string,
    _record: Readonly<AgentSessionRecord>,
  ): Promise<SessionCompareAndSetResult> {
    throw new Error('not used');
  }
}

function parentRecord(nowEpochMs = 1_000): Readonly<AgentSessionRecord> {
  const created = createAgentSession({
    sessionId: () => 'session-harness-store',
    token: () => 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-',
    leaseId: () => 'unused',
  });
  const claimed = claimAgentSession(created.record, {
    requestId: 'request-one',
    expectedRevision: 0,
    nowEpochMs,
  }, {
    leaseId: () => 'lease-one',
  });
  if (!claimed.ok || claimed.idempotent) throw new Error('failed to seed claimed session');
  return claimed.record;
}

function authority() {
  return {
    parentSessionId: 'session-harness-store',
    leaseId: 'lease-one',
    requestId: 'request-one',
  };
}

function event(seq: number, type = 'test/event') {
  return { seq, type, data: { value: seq } };
}

test('Harness session identity is stable per parent session and isolated by role', () => {
  const seller = deriveDeepSeekHarnessSessionId('session-harness-store', 'seller');
  const same = deriveDeepSeekHarnessSessionId('session-harness-store', 'seller');
  const critic = deriveDeepSeekHarnessSessionId('session-harness-store', 'critic');

  assert.equal(seller, same);
  assert.notEqual(seller, critic);
  assert.match(seller, /^vxa-harness-seller-[a-f0-9]{40}$/);
  assert.match(critic, /^vxa-harness-critic-[a-f0-9]{40}$/);
});

test('create requires the live parent lease and materializes an empty durable manifest', async () => {
  const blobs = new MemoryBlobStore();
  const parent = parentRecord();
  const store = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: new ParentRepository(parent),
    nowEpochMs: () => 2_000,
  });

  const created = await store.create({
    ...authority(),
    role: 'seller',
    header: { version: 1, cwd: '/virtual/vexryzer' },
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  assert.equal(created.nextSeq, 0);
  assert.equal(created.manifestEtag, 'v1');

  const loaded = await store.read({
    parentSessionId: authority().parentSessionId,
    role: 'seller',
    harnessSessionId: created.harnessSessionId,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.deepEqual(loaded.events, []);
  assert.deepEqual(loaded.header, { version: 1, cwd: '/virtual/vexryzer' });
});

test('append writes immutable segment then advances manifest with CAS and strong readback', async () => {
  const blobs = new MemoryBlobStore();
  const store = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: new ParentRepository(parentRecord()),
    nowEpochMs: () => 2_000,
  });
  const created = await store.create({
    ...authority(),
    role: 'seller',
    header: { version: 1 },
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const appended = await store.append({
    ...authority(),
    role: 'seller',
    harnessSessionId: created.harnessSessionId,
    expectedManifestEtag: created.manifestEtag,
    events: [event(0), event(1)],
  });
  assert.equal(appended.ok, true);
  if (!appended.ok) return;
  assert.equal(appended.nextSeq, 2);
  assert.notEqual(appended.manifestEtag, created.manifestEtag);

  const loaded = await store.read({
    parentSessionId: authority().parentSessionId,
    role: 'seller',
    harnessSessionId: created.harnessSessionId,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.deepEqual(loaded.events, [event(0), event(1)]);
  assert.equal(loaded.nextSeq, 2);

  const segmentKeys = [...blobs.values.keys()].filter((key) => key.includes('/segments/'));
  assert.equal(segmentKeys.length, 1);
  assert.match(segmentKeys[0]!, /\/segments\/0-2-[a-f0-9]{64}\.json$/);
});

test('restart opens the same durable log without process memory', async () => {
  const blobs = new MemoryBlobStore();
  const parent = new ParentRepository(parentRecord());
  const first = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: parent,
    nowEpochMs: () => 2_000,
  });
  const created = await first.create({
    ...authority(),
    role: 'critic',
    header: { version: 1, role: 'critic' },
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const appended = await first.append({
    ...authority(),
    role: 'critic',
    harnessSessionId: created.harnessSessionId,
    expectedManifestEtag: created.manifestEtag,
    events: [event(0, 'critic/event')],
  });
  assert.equal(appended.ok, true);

  const restarted = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: parent,
    nowEpochMs: () => 3_000,
  });
  const loaded = await restarted.read({
    parentSessionId: authority().parentSessionId,
    role: 'critic',
    harnessSessionId: created.harnessSessionId,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.deepEqual(loaded.events, [event(0, 'critic/event')]);
});

test('append revalidates parent lease before manifest publication', async () => {
  const blobs = new MemoryBlobStore();
  const parent = parentRecord();
  const creator = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: new ParentRepository(parent),
    nowEpochMs: () => 2_000,
  });
  const created = await creator.create({
    ...authority(),
    role: 'seller',
    header: { version: 1 },
  });
  assert.equal(created.ok, true);
  if (!created.ok || parent.lease === null) return;

  const stolen = claimAgentSession(parent, {
    requestId: 'request-two',
    expectedRevision: parent.canonical.revision,
    nowEpochMs: parent.lease.expiresAtEpochMs,
  }, {
    leaseId: () => 'lease-two',
  });
  assert.equal(stolen.ok, true);
  if (!stolen.ok || stolen.idempotent) return;

  let parentReads = 0;
  const switchingParent: AgentSessionRepository = {
    async get(sessionId) {
      parentReads += 1;
      const record = parentReads === 1 ? parent : stolen.record;
      return sessionId === record.sessionId
        ? { record, etag: `parent-v${parentReads}` }
        : null;
    },
    async create() { throw new Error('not used'); },
    async compareAndSet() { throw new Error('not used'); },
  };
  const appender = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: switchingParent,
    nowEpochMs: () => 2_000,
  });

  const result = await appender.append({
    ...authority(),
    role: 'seller',
    harnessSessionId: created.harnessSessionId,
    expectedManifestEtag: created.manifestEtag,
    events: [event(0)],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'PARENT_LEASE_INVALID');
  assert.equal(parentReads, 2);

  const loaded = await creator.read({
    parentSessionId: authority().parentSessionId,
    role: 'seller',
    harnessSessionId: created.harnessSessionId,
  });
  assert.equal(loaded.ok, true);
  if (!loaded.ok) return;
  assert.deepEqual(loaded.events, []);
  assert.equal(loaded.manifestEtag, created.manifestEtag);
});

test('stale writer loses ownership when manifest CAS has advanced', async () => {
  const blobs = new MemoryBlobStore();
  const store = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: new ParentRepository(parentRecord()),
    nowEpochMs: () => 2_000,
  });
  const created = await store.create({
    ...authority(),
    role: 'seller',
    header: { version: 1 },
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;

  const first = await store.append({
    ...authority(),
    role: 'seller',
    harnessSessionId: created.harnessSessionId,
    expectedManifestEtag: created.manifestEtag,
    events: [event(0)],
  });
  assert.equal(first.ok, true);

  const stale = await store.append({
    ...authority(),
    role: 'seller',
    harnessSessionId: created.harnessSessionId,
    expectedManifestEtag: created.manifestEtag,
    events: [event(0, 'stale/event')],
  });
  assert.equal(stale.ok, false);
  if (!stale.ok) assert.equal(stale.code, 'CONFLICT');
});

test('expired or mismatched parent lease blocks Harness writes before blob mutation', async () => {
  const blobs = new MemoryBlobStore();
  const parent = parentRecord();
  assert.ok(parent.lease);

  const expired = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: new ParentRepository(parent),
    nowEpochMs: () => parent.lease!.expiresAtEpochMs,
  });
  const expiredCreate = await expired.create({
    ...authority(),
    role: 'seller',
    header: { version: 1 },
  });
  assert.equal(expiredCreate.ok, false);
  if (!expiredCreate.ok) assert.equal(expiredCreate.code, 'PARENT_LEASE_EXPIRED');
  assert.equal(blobs.values.size, 0);

  const live = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: new ParentRepository(parent),
    nowEpochMs: () => 2_000,
  });
  const mismatch = await live.create({
    ...authority(),
    leaseId: 'wrong-lease',
    role: 'seller',
    header: { version: 1 },
  });
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.code, 'PARENT_LEASE_INVALID');
  assert.equal(blobs.values.size, 0);
});

test('append refuses non-contiguous sequence before writing a segment', async () => {
  const blobs = new MemoryBlobStore();
  const store = createDeepSeekHarnessBlobSessionStore({
    store: blobs,
    parentRepository: new ParentRepository(parentRecord()),
    nowEpochMs: () => 2_000,
  });
  const created = await store.create({
    ...authority(),
    role: 'seller',
    header: { version: 1 },
  });
  assert.equal(created.ok, true);
  if (!created.ok) return;
  const before = blobs.values.size;

  const result = await store.append({
    ...authority(),
    role: 'seller',
    harnessSessionId: created.harnessSessionId,
    expectedManifestEtag: created.manifestEtag,
    events: [event(1)],
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, 'NON_CONTIGUOUS_EVENTS');
  assert.equal(blobs.values.size, before);
});
