import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProviderChatBody,
  buildProviderChatEndpoint,
  buildServerChatHttpRequest,
  type LocalFunctionTool,
} from '../../src/server/ai/providers/openai-chat-wire.ts';
import { createChatStreamAccumulator } from '../../src/server/ai/providers/chat-sse.ts';
import type { ProviderRouteDefinition } from '../../src/ai/providers/provider-registry.ts';

const route: Readonly<ProviderRouteDefinition> = Object.freeze({
  routeId: 'deepseek-v4-pro-agent',
  family: 'deepseek',
  modelId: 'deepseek-v4-pro',
  roles: Object.freeze(['seller', 'critic', 'composer', 'workshop']),
  tier: 'primary',
  priority: 1,
  enabledByDefault: true,
  credentialEnvName: 'DEEPSEEK_API_KEY',
  credentialScope: 'server',
  noPaymentEligibility: 'NOT_VERIFIED',
  protocolCompatibility: 'NOT_VERIFIED',
  sellerQuality: 'NOT_VERIFIED',
  criticQuality: 'NOT_VERIFIED',
  composerQuality: 'NOT_VERIFIED',
  harnessCompatibility: 'NOT_VERIFIED',
  workshopSafety: 'NOT_VERIFIED',
  workshopHarness: 'DeepSeek-Harness@0.1.5-rc.2',
  runtimeActivation: 'NOT_VERIFIED',
  capabilities: Object.freeze({
    streaming: 'NOT_VERIFIED',
    tools: 'NOT_VERIFIED',
    structuredArguments: 'NOT_VERIFIED',
  }),
  maxInputTokens: null,
  emergencyInputTokens: null,
  evidence: null,
});

const tools: readonly LocalFunctionTool[] = Object.freeze([Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'submit_intent',
    description: 'Submit a bounded semantic intent.',
    parameters: Object.freeze({
      type: 'object',
      properties: Object.freeze({
        objective: Object.freeze({ type: 'string' }),
      }),
      required: Object.freeze(['objective']),
      additionalProperties: false,
    }),
  }),
})]);

test('DeepSeek wire uses only the official V4 Pro chat endpoint', () => {
  assert.equal(buildProviderChatEndpoint(route, Object.freeze({})), 'https://api.deepseek.com/chat/completions');
});

test('DeepSeek thinking request omits incompatible tool_choice and pins reasoning policy', () => {
  const body = buildProviderChatBody({
    route,
    messages: Object.freeze([
      Object.freeze({ role: 'system' as const, content: 'system' }),
      Object.freeze({ role: 'user' as const, content: 'user' }),
    ]),
    tools,
  });
  assert.equal(body.model, 'deepseek-v4-pro');
  assert.deepEqual(body.thinking, { type: 'enabled' });
  assert.equal(body.reasoning_effort, 'high');
  assert.equal(body.stream, true);
  assert.equal('tool_choice' in body, false);
  assert.equal('include_reasoning' in body, false);
});

test('server request keeps DeepSeek key in Authorization header only', () => {
  const request = buildServerChatHttpRequest({
    route,
    serverConfig: Object.freeze({}),
    apiToken: 'deepseek-test-token',
    messages: Object.freeze([{ role: 'user' as const, content: 'user' }]),
    tools,
  });
  assert.equal(request.headers.get('Authorization'), 'Bearer deepseek-test-token');
  assert.equal(request.body.includes('deepseek-test-token'), false);
  assert.equal(request.url, 'https://api.deepseek.com/chat/completions');
});

test('stream accumulator preserves bounded DeepSeek reasoning separately from user-visible content', () => {
  const accumulator = createChatStreamAccumulator();
  accumulator.accept({
    choices: [{
      index: 0,
      delta: { reasoning_content: 'reason-', content: null },
      finish_reason: null,
    }],
  });
  accumulator.accept({
    choices: [{
      index: 0,
      delta: { reasoning_content: 'trace', content: '' },
      finish_reason: 'stop',
    }],
  });
  assert.deepEqual(accumulator.finish(), {
    content: '',
    reasoningContent: 'reason-trace',
    toolCalls: [],
    finishReason: 'stop',
  });
});

test('stream accumulator rejects non-string DeepSeek reasoning content', () => {
  const accumulator = createChatStreamAccumulator();
  assert.throws(() => accumulator.accept({
    choices: [{
      index: 0,
      delta: { reasoning_content: { private: true } },
      finish_reason: null,
    }],
  }), /reasoning/i);
});
