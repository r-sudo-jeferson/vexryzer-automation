import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgentSession } from '../../src/server/session/agent-session.ts';
import {
  createNetlifyBlobSessionRepository,
  type ConditionalJsonBlobStore,
} from '../../src/server/session/netlify-blob-session-repository.ts';

const TOKEN = 'abcdefghijklmnopqrstuvwxyzABCDEFGH0123456789_-';

function created(sessionId = 'session-blob') {
  return createAgentSession({
    sessionId: () => sessionId,
    token: () => TOKEN,
    leaseId: () => 'lease-blob',
  });
}

class FakeBlobStore implements ConditionalJsonBlobStore {
  getCalls: Array<{ key: string; options: { type: 'json'; consistency: 'strong' } }> = [];
  setCalls: Array<{ key: string; value: unknown; options: { onlyIfNew?: boolean; onlyIfMatch?: string } }> = [];
  readResult: { data: unknown; etag?: string; metadata: object } | null = null;
  writeResult: { modified: boolean; etag?: string } = { modified: true, etag: '"etag-1"' };
  throwOnGet = false;
  throwOnSet = false;

  async getWithMetadata(
    key: string,
    options: { type: 'json'; consistency: 'strong' },
  ) {
    this.getCalls.push({ key, options });
    if (this.throwOnGet) throw new Error('get failed');
    return this.readResult;
  }

  async setJSON(
    key: string,
    value: unknown,
    options: { onlyIfNew?: boolean; onlyIfMatch?: string },
  ) {
    this.setCalls.push({ key, value, options });
    if (this.throwOnSet) throw new Error('set failed');
    if (this.writeResult.modified && this.writeResult.etag) {
      this.readResult = {
        data: JSON.parse(JSON.stringify(value)),
        etag: this.writeResult.etag,
        metadata: {},
      };
    }
    return this.writeResult;
  }
}

test('create uses onlyIfNew and accepts a conditional write only when a real ETag is returned', async () => {
  const store = new FakeBlobStore();
  const repository = createNetlifyBlobSessionRepository(store);
  const session = created();

  const result = await repository.create(session.record);
  assert.deepEqual(result, { ok: true, etag: '"etag-1"' });
  assert.equal(store.setCalls.length, 1);
  assert.equal(store.setCalls[0]?.key, 'sessions/session-blob.json');
  assert.deepEqual(store.setCalls[0]?.options, { onlyIfNew: true });
  assert.equal(JSON.stringify(store.setCalls[0]?.value).includes(TOKEN), false);
});

test('onlyIfNew precondition failure maps to ALREADY_EXISTS without overwriting', async () => {
  const store = new FakeBlobStore();
  store.writeResult = { modified: false };
  const repository = createNetlifyBlobSessionRepository(store);

  const result = await repository.create(created().record);
  assert.deepEqual(result, { ok: false, code: 'ALREADY_EXISTS' });
});

test('phantom conditional-write success with missing or empty ETag is STORE_UNAVAILABLE', async (t) => {
  for (const etag of [undefined, '']) {
    await t.test(String(etag), async () => {
      const store = new FakeBlobStore();
      store.writeResult = { modified: true, ...(etag === undefined ? {} : { etag }) };
      const repository = createNetlifyBlobSessionRepository(store);

      const create = await repository.create(created().record);
      assert.deepEqual(create, { ok: false, code: 'STORE_UNAVAILABLE' });

      const cas = await repository.compareAndSet(
        'session-blob',
        '"old-etag"',
        created().record,
      );
      assert.deepEqual(cas, { ok: false, code: 'STORE_UNAVAILABLE' });
    });
  }
});

test('conditional success is rejected when strong read-back does not prove the written ETag and record', async () => {
  const store = new FakeBlobStore();
  const repository = createNetlifyBlobSessionRepository(store);
  const session = created();

  store.writeResult = { modified: true, etag: '"new-etag"' };
  store.setJSON = async (key, value, options) => {
    store.setCalls.push({ key, value, options });
    store.readResult = {
      data: JSON.parse(JSON.stringify(session.record)),
      etag: '"old-etag"',
      metadata: {},
    };
    return store.writeResult;
  };

  const result = await repository.compareAndSet(
    session.record.sessionId,
    '"old-etag"',
    session.record,
  );
  assert.deepEqual(result, { ok: false, code: 'STORE_UNAVAILABLE' });
});

test('a superseding writer after our conditional write is surfaced as CONFLICT, never success', async () => {
  const store = new FakeBlobStore();
  const repository = createNetlifyBlobSessionRepository(store);
  const session = created();

  store.writeResult = { modified: true, etag: '"our-etag"' };
  store.setJSON = async (key, value, options) => {
    store.setCalls.push({ key, value, options });
    store.readResult = {
      data: JSON.parse(JSON.stringify(session.record)),
      etag: '"other-writer-etag"',
      metadata: {},
    };
    return store.writeResult;
  };

  const result = await repository.compareAndSet(
    session.record.sessionId,
    '"old-etag"',
    session.record,
  );
  assert.deepEqual(result, { ok: false, code: 'CONFLICT' });
});

test('compareAndSet forwards onlyIfMatch and maps precondition failure to CONFLICT', async () => {
  const store = new FakeBlobStore();
  const repository = createNetlifyBlobSessionRepository(store);
  const session = created();

  store.writeResult = { modified: true, etag: '"etag-2"' };
  const success = await repository.compareAndSet(
    session.record.sessionId,
    '"etag-1"',
    session.record,
  );
  assert.deepEqual(success, { ok: true, etag: '"etag-2"' });
  assert.deepEqual(store.setCalls[0]?.options, { onlyIfMatch: '"etag-1"' });

  store.writeResult = { modified: false };
  const conflict = await repository.compareAndSet(
    session.record.sessionId,
    '"etag-2"',
    session.record,
  );
  assert.deepEqual(conflict, { ok: false, code: 'CONFLICT' });
});

test('reads are explicitly strong-consistent and revalidate persisted session structure', async () => {
  const store = new FakeBlobStore();
  const session = created();
  store.readResult = {
    data: JSON.parse(JSON.stringify(session.record)),
    etag: '"etag-read"',
    metadata: {},
  };
  const repository = createNetlifyBlobSessionRepository(store);

  const result = await repository.get(session.record.sessionId);
  assert.ok(result);
  assert.equal(result?.etag, '"etag-read"');
  assert.equal(result?.record.sessionId, 'session-blob');
  assert.deepEqual(store.getCalls[0], {
    key: 'sessions/session-blob.json',
    options: { type: 'json', consistency: 'strong' },
  });
});

test('corrupt blobs, mismatched session ids and invalid ETags fail closed as store errors', async (t) => {
  const cases: Array<{ name: string; data: unknown; etag: string }> = [
    { name: 'corrupt', data: { nope: true }, etag: '"etag"' },
    { name: 'mismatched-id', data: JSON.parse(JSON.stringify(created('session-other').record)), etag: '"etag"' },
    { name: 'empty-etag', data: JSON.parse(JSON.stringify(created().record)), etag: '' },
  ];

  for (const item of cases) {
    await t.test(item.name, async () => {
      const store = new FakeBlobStore();
      store.readResult = { data: item.data, etag: item.etag, metadata: {} };
      const repository = createNetlifyBlobSessionRepository(store);
      await assert.rejects(() => repository.get('session-blob'), /store unavailable/);
    });
  }
});

test('invalid external session id never becomes an arbitrary blob key', async () => {
  const store = new FakeBlobStore();
  const repository = createNetlifyBlobSessionRepository(store);

  const result = await repository.get('../secrets');
  assert.equal(result, null);
  assert.equal(store.getCalls.length, 0);

  const cas = await repository.compareAndSet(
    '../secrets',
    '"etag"',
    created().record,
  );
  assert.deepEqual(cas, { ok: false, code: 'STORE_UNAVAILABLE' });
  assert.equal(store.setCalls.length, 0);
});

test('transport exceptions are never confused with CAS conflicts', async () => {
  const store = new FakeBlobStore();
  store.throwOnSet = true;
  const repository = createNetlifyBlobSessionRepository(store);

  const create = await repository.create(created().record);
  assert.deepEqual(create, { ok: false, code: 'STORE_UNAVAILABLE' });

  const cas = await repository.compareAndSet(
    'session-blob',
    '"etag"',
    created().record,
  );
  assert.deepEqual(cas, { ok: false, code: 'STORE_UNAVAILABLE' });
});
