import test from 'node:test';
import assert from 'node:assert/strict';
import type { ConditionalJsonBlobStore } from '../../src/server/session/netlify-blob-session-repository.ts';
import {
  createFailClosedAgentRuntime,
  createNetlifyAskAiDependencies,
  type NetlifyBlobStoreFactory,
} from '../../src/server/netlify/ask-ai-netlify-runtime.ts';

class InertStore implements ConditionalJsonBlobStore {
  async getWithMetadata(
    _key: string,
    _options: { type: 'json'; consistency: 'strong' },
  ) {
    return null;
  }

  async setJSON(
    _key: string,
    _value: unknown,
    _options: { onlyIfNew: true } | { onlyIfMatch: string },
  ) {
    return { modified: false };
  }
}

function factoryCounters() {
  const store = new InertStore();
  const calls = { production: 0, deploy: 0 };
  const factory: NetlifyBlobStoreFactory = {
    productionStore: () => {
      calls.production += 1;
      return store;
    },
    deployStore: () => {
      calls.deploy += 1;
      return store;
    },
  };
  return { calls, factory };
}

test('published Netlify deploys use the production session store boundary only', () => {
  const { calls, factory } = factoryCounters();
  const dependencies = createNetlifyAskAiDependencies({ published: true }, factory);

  assert.deepEqual(calls, { production: 1, deploy: 0 });
  assert.equal(dependencies.runtime.seller.routes.length, 0);
  assert.equal(dependencies.runtime.critic.routes.length, 0);
});

test('non-published Netlify deploys use deploy-scoped session storage only', () => {
  const { calls, factory } = factoryCounters();
  createNetlifyAskAiDependencies({ published: false }, factory);

  assert.deepEqual(calls, { production: 0, deploy: 1 });
});

test('provider execution remains fail-closed until exact provider route verification activates a runtime', async () => {
  const runtime = createFailClosedAgentRuntime();

  assert.equal(runtime.seller.routes.length, 0);
  assert.equal(runtime.critic.routes.length, 0);
  assert.throws(
    () => runtime.seller.estimateTokens({ attempted: 'provider-dispatch' }),
    /not activated until exact route verification passes/,
  );
  assert.equal(await runtime.seller.resolveCredential('DEEPSEEK_API_KEY'), null);
  assert.equal(await runtime.critic.resolveCredential('DEEPSEEK_API_KEY'), null);
});
