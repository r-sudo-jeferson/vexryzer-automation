import { getDeployStore, getStore } from '@netlify/blobs';
import type { AskAiHttpDependencies } from '../session/ask-ai-http.ts';
import {
  createNetlifyBlobSessionRepository,
  type ConditionalBlobWriteOptions,
  type ConditionalJsonBlobStore,
} from '../session/netlify-blob-session-repository.ts';
import type { AgentRuntimeStaticConfig } from '../session/stored-agent-turn-service.ts';

const DEPLOY_SESSION_STORE = 'vxa-agent-sessions';
const PRODUCTION_SESSION_STORE = 'vxa-agent-sessions-production';

export interface NetlifyDeployRuntimeContext {
  published: boolean;
}

export interface NetlifyBlobStoreFactory {
  productionStore(): ConditionalJsonBlobStore;
  deployStore(): ConditionalJsonBlobStore;
}

function providerActivationBlocked(_value: unknown): number {
  throw new TypeError('provider runtime is not activated until exact route verification passes');
}

function noVerifiedCredential(_credentialEnvName: string): null {
  return null;
}

export function createFailClosedAgentRuntime(): Readonly<AgentRuntimeStaticConfig> {
  const common = {
    routes: Object.freeze([]),
    routeBudgets: Object.freeze([]),
    runtimeStates: Object.freeze([]),
    estimateTokens: providerActivationBlocked,
    resolveCredential: noVerifiedCredential,
    serverConfig: Object.freeze({}),
    timeoutMs: 15_000,
  } as const;

  return Object.freeze({
    seller: Object.freeze({ ...common }),
    critic: Object.freeze({ ...common }),
  });
}

function conditionalStore(store: ReturnType<typeof getStore>): ConditionalJsonBlobStore {
  return Object.freeze({
    getWithMetadata: (
      key: string,
      options: { type: 'json'; consistency: 'strong' },
    ) => store.getWithMetadata(key, options),
    setJSON: (
      key: string,
      value: unknown,
      options: ConditionalBlobWriteOptions,
    ) => store.setJSON(key, value, options),
  });
}

const DEFAULT_BLOB_STORE_FACTORY: Readonly<NetlifyBlobStoreFactory> = Object.freeze({
  productionStore: () => conditionalStore(getStore({
    name: PRODUCTION_SESSION_STORE,
    consistency: 'strong',
  })),
  deployStore: () => conditionalStore(getDeployStore(DEPLOY_SESSION_STORE)),
});

export function createNetlifyAskAiDependencies(
  context: Readonly<NetlifyDeployRuntimeContext>,
  storeFactory: Readonly<NetlifyBlobStoreFactory> = DEFAULT_BLOB_STORE_FACTORY,
): Readonly<AskAiHttpDependencies> {
  if (typeof context?.published !== 'boolean') {
    throw new TypeError('Netlify deploy publication state is required');
  }

  const store = context.published
    ? storeFactory.productionStore()
    : storeFactory.deployStore();

  return Object.freeze({
    repository: createNetlifyBlobSessionRepository(store),
    runtime: createFailClosedAgentRuntime(),
  });
}
