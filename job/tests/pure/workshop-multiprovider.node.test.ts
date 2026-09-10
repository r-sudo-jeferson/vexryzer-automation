import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertProviderCandidateRegistry,
  candidatesForRole,
  optionalEmergencyProviders,
  providerCandidates,
  standbyProviders,
} from '../../tools/workshop-spike/provider-candidates.ts';
import {
  classifyProviderFailure,
  sanitizeProviderDiagnostic,
  summarizeProviderScreen,
} from '../../tools/workshop-spike/provider-evidence.ts';
import { resolveDirectProviderConfig } from '../../tools/workshop-spike/provider-direct-config.ts';
import {
  buildProviderHarnessEnv,
  buildProviderHarnessSdkOptions,
  PROVIDER_RETRY_INITIAL_DELAY_MS,
  PROVIDER_SPIKE_MAX_RETRIES,
  renderProviderMinimalProfilePatchYaml,
  validateProviderHarnessInput,
} from '../../tools/workshop-spike/provider-harness-config.ts';
import {
  extractAssistantText,
  extractStructuredToolCall,
  parseOpenAiSse,
} from '../../tools/workshop-spike/provider-screen-protocol.ts';
import {
  buildReplayRequest,
  buildStreamRequest,
  buildToolRequest,
} from '../../tools/workshop-spike/provider-screen-request.ts';
import { isMappedTimeoutEvidence } from '../../tools/workshop-spike/harness-timeout-evidence.ts';

const cloudflare = providerCandidates.find((candidate) => candidate.provider === 'cloudflare-workers-ai')!;
const groq = providerCandidates.find((candidate) => candidate.provider === 'groq')!;

test('authorized provider registry is exact, fixed-id, and zero-payment only', () => {
  assert.doesNotThrow(() => assertProviderCandidateRegistry());
  assert.equal(providerCandidates.some((candidate) => /-latest$/i.test(candidate.modelId)), false);
  assert.equal(providerCandidates.every((candidate) => candidate.noPaymentRequired === true), true);
});

test('keeps mistral standby and openrouter optional emergency-only', () => {
  assert.deepEqual(standbyProviders, ['mistral']);
  assert.deepEqual(optionalEmergencyProviders, ['openrouter']);
  const activeProviderNames: readonly string[] = providerCandidates.map((candidate) => candidate.provider);
  assert.equal(activeProviderNames.includes('mistral'), false);
  assert.equal(activeProviderNames.includes('openrouter'), false);
});

test('routes workshop code only to explicit code candidates', () => {
  assert.deepEqual(candidatesForRole('workshop_code').map(({ provider, modelId }) => `${provider}/${modelId}`), [
    'cloudflare-workers-ai/@cf/openai/gpt-oss-120b',
    'groq/openai/gpt-oss-120b',
  ]);
});

test('rejects moving aliases, standby activation, payment-required routes, and path traversal', () => {
  assert.throws(() => assertProviderCandidateRegistry([{
    provider: 'groq', modelId: 'model-latest', roles: ['seller'], credentialRefs: ['GROQ_API_KEY'], noPaymentRequired: true, optional: false,
  }]), /moving model aliases/);
  assert.throws(() => assertProviderCandidateRegistry([{
    provider: 'mistral', modelId: 'mistral-medium-3-5', roles: ['seller'], credentialRefs: ['MISTRAL_API_KEY'], noPaymentRequired: true, optional: false,
  }]), /standby\/optional/);
  assert.throws(() => assertProviderCandidateRegistry([{
    provider: 'cloudflare-workers-ai', modelId: '@cf/x/y', roles: ['seller'], credentialRefs: ['CLOUDFLARE_API_TOKEN'], noPaymentRequired: false as true, optional: false,
  }]), /payment-required/);
  assert.throws(() => assertProviderCandidateRegistry([{
    provider: 'groq', modelId: '../model', roles: ['seller'], credentialRefs: ['GROQ_API_KEY'], noPaymentRequired: true, optional: false,
  }]), /unsafe model id/);
});

test('classifies provider failures without using raw provider text as authority', () => {
  assert.equal(classifyProviderFailure(401), 'AUTH');
  assert.equal(classifyProviderFailure(403), 'AUTH');
  assert.equal(classifyProviderFailure(429), 'RATE_LIMIT');
  assert.equal(classifyProviderFailure(408), 'TIMEOUT');
  assert.equal(classifyProviderFailure(504), 'TIMEOUT');
  assert.equal(classifyProviderFailure(500), 'CAPACITY');
  assert.equal(classifyProviderFailure(503), 'CAPACITY');
  assert.equal(classifyProviderFailure(400), 'PROTOCOL');
  assert.equal(classifyProviderFailure(undefined), 'UNKNOWN');
});

test('redacts credentials, authorization values, and cloudflare account id from diagnostics', () => {
  const diagnostic = sanitizeProviderDiagnostic(
    'Authorization: Bearer cf-secret; account 0123456789abcdef0123456789abcdef; GROQ_API_KEY=groq-secret',
    ['cf-secret', 'groq-secret', '0123456789abcdef0123456789abcdef'],
  );
  assert.equal(diagnostic.includes('cf-secret'), false);
  assert.equal(diagnostic.includes('groq-secret'), false);
  assert.equal(diagnostic.includes('0123456789abcdef0123456789abcdef'), false);
  assert.match(diagnostic, /\[REDACTED\]/);
  assert.ok(diagnostic.length <= 600);
});

test('screen summary emits bounded booleans and class only', () => {
  const summary = summarizeProviderScreen({
    provider: 'groq', modelId: 'openai/gpt-oss-120b', authenticated: true,
    streaming: true, toolCall: true, toolReplay: false, status: 429,
  });
  assert.deepEqual(summary, {
    provider: 'groq', modelId: 'openai/gpt-oss-120b', authenticated: true,
    streaming: true, toolCall: true, toolReplay: false, errorClass: 'RATE_LIMIT',
  });
  assert.equal('raw' in summary, false);
  assert.equal('headers' in summary, false);
});

test('builds Cloudflare OpenAI-compatible endpoint from protected account id without exposing it in registry data', () => {
  const config = resolveDirectProviderConfig(cloudflare, {
    CLOUDFLARE_ACCOUNT_ID: 'abc123', CLOUDFLARE_API_TOKEN: 'secret-token',
  });
  assert.equal(config.endpoint, 'https://api.cloudflare.com/client/v4/accounts/abc123/ai/v1/chat/completions');
  assert.equal(config.apiKey, 'secret-token');
  assert.deepEqual(config.secretsToRedact, ['abc123', 'secret-token']);
  assert.equal(JSON.stringify(cloudflare).includes('abc123'), false);
});

test('builds Groq endpoint and rejects missing credentials before network dispatch', () => {
  const config = resolveDirectProviderConfig(groq, { GROQ_API_KEY: 'groq-secret' });
  assert.equal(config.endpoint, 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(config.apiKey, 'groq-secret');
  assert.throws(() => resolveDirectProviderConfig(groq, {}), /GROQ_API_KEY/);
});

test('rejects unsupported direct provider and malformed cloudflare account id', () => {
  assert.throws(() => resolveDirectProviderConfig({
    provider: 'mistral', modelId: 'mistral-medium-3-5', roles: ['seller'],
    credentialRefs: ['MISTRAL_API_KEY'], noPaymentRequired: true, optional: false,
  }, { MISTRAL_API_KEY: 'secret' }), /not enabled/);
  assert.throws(() => resolveDirectProviderConfig(cloudflare, {
    CLOUDFLARE_ACCOUNT_ID: '../bad', CLOUDFLARE_API_TOKEN: 'secret-token',
  }), /ACCOUNT_ID/);
});

test('parses streamed OpenAI-compatible content without retaining raw payloads', () => {
  const body = 'data: {"choices":[{"delta":{"content":"VXA"}}]}\n\ndata: {"choices":[{"delta":{"content":"-OK"}}]}\n\ndata: [DONE]\n\n';
  assert.deepEqual(parseOpenAiSse(body), { eventCount: 2, contentChunkCount: 2, reasoningChunkCount: 0, text: 'VXA-OK', done: true });
});

test('extracts one structured function call and validates JSON arguments', () => {
  const message = { tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'capture_signal', arguments: '{"value":"nonce"}' } }] };
  assert.deepEqual(extractStructuredToolCall(message, 'capture_signal'), {
    id: 'call-1', name: 'capture_signal', argumentsJson: '{"value":"nonce"}', arguments: { value: 'nonce' },
  });
});

test('rejects malformed or wrong-name tool calls', () => {
  assert.equal(extractStructuredToolCall({ tool_calls: [{ id: 'x', function: { name: 'other', arguments: '{}' } }] }, 'capture_signal'), null);
  assert.equal(extractStructuredToolCall({ tool_calls: [{ id: 'x', function: { name: 'capture_signal', arguments: '{bad' } }] }, 'capture_signal'), null);
});

test('extracts assistant text only from the first choice message', () => {
  assert.equal(extractAssistantText({ choices: [{ message: { content: 'nonce' } }] }), 'nonce');
  assert.equal(extractAssistantText({ choices: [] }), '');
});

test('builds a tiny streaming probe with an exact fixed marker', () => {
  const request = buildStreamRequest('openai/gpt-oss-120b', 'STREAM-NONCE', 'groq');
  assert.equal(request.model, 'openai/gpt-oss-120b');
  assert.equal(request.stream, true);
  assert.equal(request.include_reasoning, false);
  assert.match(JSON.stringify(request.messages), /STREAM-NONCE/);
  assert.equal('tools' in request, false);
});

test('builds one required structured tool with a closed object schema', () => {
  const request = buildToolRequest('openai/gpt-oss-120b', 'TOOL-NONCE', 'groq');
  assert.equal(request.tool_choice, 'required');
  assert.equal(request.tools.length, 1);
  assert.equal(request.tools[0]?.function.name, 'capture_signal');
  assert.equal(request.tools[0]?.function.parameters.additionalProperties, false);
  assert.deepEqual(request.tools[0]?.function.parameters.required, ['value']);
});

test('replays the exact tool call/result and disables another tool invocation', () => {
  const request = buildReplayRequest('openai/gpt-oss-120b', {
    id: 'call-1', name: 'capture_signal', argumentsJson: '{"value":"TOOL-NONCE"}', arguments: { value: 'TOOL-NONCE' },
  }, 'TOOL-NONCE', 'groq');
  assert.equal(request.tool_choice, 'none');
  assert.equal(request.messages[1]?.role, 'assistant');
  assert.equal(request.messages[2]?.role, 'tool');
  assert.equal(request.messages[2]?.tool_call_id, 'call-1');
  assert.match(String(request.messages[2]?.content), /TOOL-NONCE/);
});

test('renders Cloudflare catalog route without protocol override and pins exact GLM model', () => {
  const yaml = renderProviderMinimalProfilePatchYaml({
    providerRoute: 'cloudflare-workers-ai', modelId: '@cf/zai-org/glm-4.7-flash',
    credentialRef: 'CLOUDFLARE_API_TOKEN', displayName: 'Cloudflare Workers AI',
    baseURL: 'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1',
  });
  assert.match(yaml, /cloudflare-workers-ai:/);
  assert.match(yaml, /apiKeyEnv: "CLOUDFLARE_API_TOKEN"/);
  assert.match(yaml, /baseURL: "https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/\{CLOUDFLARE_ACCOUNT_ID\}\/ai\/v1"/);
  assert.match(yaml, /- id: "@cf\/zai-org\/glm-4\.7-flash"/);
  assert.doesNotMatch(yaml, /^\s+api:/m);
  assert.match(yaml, new RegExp(`maxRetries: ${PROVIDER_SPIKE_MAX_RETRIES}`));
  assert.match(yaml, new RegExp(`initialDelayMs: ${PROVIDER_RETRY_INITIAL_DELAY_MS}`));
});

test('renders Groq catalog route and exact GPT OSS model', () => {
  const yaml = renderProviderMinimalProfilePatchYaml({
    providerRoute: 'groq', modelId: 'openai/gpt-oss-120b', credentialRef: 'GROQ_API_KEY',
    displayName: 'Groq', baseURL: 'https://api.groq.com/openai/v1',
  });
  assert.match(yaml, /groq:/);
  assert.match(yaml, /apiKeyEnv: "GROQ_API_KEY"/);
  assert.match(yaml, /- id: "openai\/gpt-oss-120b"/);
  assert.doesNotMatch(yaml, /^\s+api:/m);
});

test('timeout probe disables retries', () => {
  const yaml = renderProviderMinimalProfilePatchYaml({
    providerRoute: 'groq', modelId: 'openai/gpt-oss-120b', credentialRef: 'GROQ_API_KEY',
    displayName: 'Groq', baseURL: 'https://api.groq.com/openai/v1', timeoutMs: 5, streamIdleTimeoutMs: 5,
  });
  assert.match(yaml, /timeoutMs: 5/);
  assert.match(yaml, /streamIdleTimeoutMs: 5/);
  assert.match(yaml, /maxRetries: 0/);
});

test('passes only selected provider credential and required ambient provider env', () => {
  const env = buildProviderHarnessEnv({
    PATH: '/usr/bin', HOME: '/home/test', OPENAI_API_KEY: 'do-not-pass', MISTRAL_API_KEY: 'do-not-pass',
  }, {
    dshHome: '/tmp/dsh', credentialRef: 'CLOUDFLARE_API_TOKEN', credentialValue: 'cf-secret',
    providerEnv: { CLOUDFLARE_ACCOUNT_ID: 'account-id' },
  });
  assert.equal(env.DSH_HOME, '/tmp/dsh');
  assert.equal(env.CLOUDFLARE_API_TOKEN, 'cf-secret');
  assert.equal(env.CLOUDFLARE_ACCOUNT_ID, 'account-id');
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.MISTRAL_API_KEY, undefined);
});

test('validates Cloudflare model ids but rejects traversal, latest aliases, and unsafe credential refs', () => {
  assert.doesNotThrow(() => validateProviderHarnessInput({
    providerRoute: 'cloudflare-workers-ai', modelId: '@cf/openai/gpt-oss-120b', credentialRef: 'CLOUDFLARE_API_TOKEN',
    credentialValue: 'secret', displayName: 'Cloudflare',
    baseURL: 'https://api.cloudflare.com/client/v4/accounts/{CLOUDFLARE_ACCOUNT_ID}/ai/v1',
    providerEnv: { CLOUDFLARE_ACCOUNT_ID: 'id' },
  }));
  assert.throws(() => validateProviderHarnessInput({
    providerRoute: 'groq', modelId: '../model', credentialRef: 'GROQ_API_KEY', credentialValue: 'secret',
    displayName: 'Groq', baseURL: 'https://api.groq.com/openai/v1', providerEnv: {},
  }), /modelId/);
  assert.throws(() => validateProviderHarnessInput({
    providerRoute: 'groq', modelId: 'model-latest', credentialRef: 'GROQ_API_KEY', credentialValue: 'secret',
    displayName: 'Groq', baseURL: 'https://api.groq.com/openai/v1', providerEnv: {},
  }), /latest/);
  assert.throws(() => validateProviderHarnessInput({
    providerRoute: 'groq', modelId: 'openai/gpt-oss-120b', credentialRef: 'bad-ref', credentialValue: 'secret',
    displayName: 'Groq', baseURL: 'https://api.groq.com/openai/v1', providerEnv: {},
  }), /credentialRef/);
});

test('builds sdk-minimal options with provider-neutral routing', () => {
  const input = {
    providerRoute: 'groq', modelId: 'openai/gpt-oss-120b', credentialRef: 'GROQ_API_KEY', credentialValue: 'secret',
    displayName: 'Groq', baseURL: 'https://api.groq.com/openai/v1', providerEnv: {},
  };
  const options = buildProviderHarnessSdkOptions({ PATH: '/usr/bin', OPENAI_API_KEY: 'nope' }, {
    workspace: '/tmp/workspace', dshHome: '/tmp/dsh', patchPath: '/tmp/provider.patch.yml', maxTokens: 2048, input,
  });
  assert.equal(options.profile, 'sdk-minimal');
  assert.equal(options.provider, 'groq');
  assert.equal(options.model, 'openai/gpt-oss-120b');
  assert.equal(options.env.GROQ_API_KEY, 'secret');
  assert.equal(options.env.OPENAI_API_KEY, undefined);
});

test('accepts only explicit timeout evidence from Harness result summaries', () => {
  assert.equal(isMappedTimeoutEvidence({ turnErrorCodes: ['TIMEOUT'], turnEndReasons: ['error'] }), true);
  assert.equal(isMappedTimeoutEvidence({ turnErrorCodes: ['RATE_LIMIT'], turnEndReasons: ['error'] }), false);
  assert.equal(isMappedTimeoutEvidence({ turnErrorCodes: [], turnEndReasons: ['completed'] }), false);
});

test('accepts thrown timeout diagnostics but rejects unrelated provider failures', () => {
  assert.equal(isMappedTimeoutEvidence(undefined, new Error('provider timeout after 5ms')), true);
  assert.equal(isMappedTimeoutEvidence(undefined, Object.assign(new Error('rate limit'), { name: 'ProviderError' })), false);
});
