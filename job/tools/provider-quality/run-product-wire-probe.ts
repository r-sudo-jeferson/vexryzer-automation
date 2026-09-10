import { randomUUID } from 'node:crypto';
import type { ProviderRouteDefinition } from '../../src/ai/providers/provider-registry.ts';
import {
  executeProviderChatStream,
  type ProviderChatClientResult,
} from '../../src/server/ai/providers/provider-chat-client.ts';
import type { LocalFunctionTool } from '../../src/server/ai/providers/openai-chat-wire.ts';

interface ProbeRoute {
  routeId: string;
  family: 'cloudflare_workers_ai' | 'groq';
  modelId: string;
  credentialEnvName: 'CLOUDFLARE_API_TOKEN' | 'GROQ_API_KEY';
}

const ROUTES: readonly Readonly<ProbeRoute>[] = Object.freeze([
  Object.freeze({
    routeId: 'cloudflare-glm-4-7-flash-seller',
    family: 'cloudflare_workers_ai',
    modelId: '@cf/zai-org/glm-4.7-flash',
    credentialEnvName: 'CLOUDFLARE_API_TOKEN',
  }),
  Object.freeze({
    routeId: 'cloudflare-gemma-4-26b-critic',
    family: 'cloudflare_workers_ai',
    modelId: '@cf/google/gemma-4-26b-a4b-it',
    credentialEnvName: 'CLOUDFLARE_API_TOKEN',
  }),
  Object.freeze({
    routeId: 'groq-gpt-oss-120b-seller',
    family: 'groq',
    modelId: 'openai/gpt-oss-120b',
    credentialEnvName: 'GROQ_API_KEY',
  }),
]);

const tool: LocalFunctionTool = Object.freeze({
  type: 'function',
  function: Object.freeze({
    name: 'capture_signal',
    description: 'Return the exact bounded diagnostic marker supplied by the user.',
    parameters: Object.freeze({
      type: 'object',
      additionalProperties: false,
      properties: Object.freeze({
        value: Object.freeze({ type: 'string' }),
      }),
      required: Object.freeze(['value']),
    }),
  }),
});

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim() ?? '';
  if (!value || /[\r\n\0]/.test(value)) throw new TypeError(`${name} is required`);
  return value;
}

function directRoute(spec: Readonly<ProbeRoute>): Readonly<ProviderRouteDefinition> {
  return Object.freeze({
    routeId: spec.routeId,
    family: spec.family,
    modelId: spec.modelId,
    roles: Object.freeze(['seller'] as const),
    tier: spec.family === 'groq' ? 'independent_fallback' : 'primary',
    enabledByDefault: false,
    credentialEnvName: spec.credentialEnvName,
    credentialScope: 'server',
    noPaymentEligibility: 'NOT_VERIFIED',
    protocolCompatibility: 'NOT_VERIFIED',
    sellerQuality: 'NOT_VERIFIED',
    criticQuality: 'NOT_APPLICABLE',
    composerQuality: 'NOT_APPLICABLE',
    harnessCompatibility: 'NOT_APPLICABLE',
    workshopSafety: 'NOT_APPLICABLE',
    workshopHarness: null,
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
}

function safeFailure(result: Exclude<ProviderChatClientResult, { ok: true }>) {
  return Object.freeze({
    failureClass: result.class,
    httpStatus: result.status,
    ...(result.malformedDetail === undefined ? {} : { malformedDetail: result.malformedDetail }),
  });
}

async function main() {
  const cloudflareAccountId = requiredEnv('CLOUDFLARE_ACCOUNT_ID');
  const results = [];

  for (const spec of ROUTES) {
    const marker = `VXA-S002-WIRE-${randomUUID()}`;
    const result = await executeProviderChatStream({
      route: directRoute(spec),
      serverConfig: Object.freeze({ cloudflareAccountId }),
      apiToken: requiredEnv(spec.credentialEnvName),
      messages: Object.freeze([
        Object.freeze({
          role: 'system' as const,
          content: 'Call capture_signal exactly once. Emit no free text.',
        }),
        Object.freeze({
          role: 'user' as const,
          content: `Call capture_signal with value exactly equal to ${marker}.`,
        }),
      ]),
      tools: Object.freeze([tool]),
      timeoutMs: 30_000,
    });

    if (!result.ok) {
      results.push(Object.freeze({
        routeId: spec.routeId,
        family: spec.family,
        modelId: spec.modelId,
        pass: false,
        ...safeFailure(result),
      }));
      continue;
    }

    const call = result.completion.toolCalls[0];
    let markerMatched = false;
    if (result.completion.toolCalls.length === 1 && call?.function.name === 'capture_signal') {
      try {
        const parsed = JSON.parse(call.function.arguments) as unknown;
        markerMatched = typeof parsed === 'object'
          && parsed !== null
          && !Array.isArray(parsed)
          && (parsed as Record<string, unknown>)['value'] === marker;
      } catch {
        markerMatched = false;
      }
    }

    const pass = result.completion.content.trim().length === 0
      && result.completion.toolCalls.length === 1
      && markerMatched
      && result.completion.finishReason === 'tool_calls';

    results.push(Object.freeze({
      routeId: spec.routeId,
      family: spec.family,
      modelId: spec.modelId,
      pass,
      failureClass: pass ? null : 'semantic_protocol',
      httpStatus: 200,
      toolCallCount: result.completion.toolCalls.length,
      freeTextPresent: result.completion.content.trim().length > 0,
      markerMatched,
      finishReason: result.completion.finishReason,
    }));
  }

  const pass = results.every((item) => item.pass);
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: pass ? 'pass' : 'fail',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
    rawProviderPayloadsEmitted: false,
    results,
  }, null, 2)}\n`);
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'error',
    candidateSha: process.env.GITHUB_SHA?.trim() || 'local-evaluation',
    error: {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message.slice(-300) : 'product wire probe failed',
    },
  }, null, 2)}\n`);
  process.exitCode = 1;
});
