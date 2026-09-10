import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const MISTRAL_API_BASE = 'https://api.mistral.ai/v1';
const REQUEST_TIMEOUT_MS = 30_000;
export const MODEL_BATTERY_INTERVAL_MS = 2_200;
const PROBE_VALUE = 'VXA-S002-TOOL-OK';

export const MODEL_CANDIDATES = Object.freeze([
  { id: 'zai-glm-5-2', label: 'Z.ai GLM 5.2', tokensPerMinute: 20_000, requestsPerSecond: 1.0 },
  { id: 'mistral-medium-3-5', label: 'Mistral Medium 3.5', tokensPerMinute: 20_000, requestsPerSecond: 1.0 },
  { id: 'mistral-small-2603', label: 'Mistral Small 4', tokensPerMinute: 20_000, requestsPerSecond: 1.0 },
  { id: 'mistral-large-2512', label: 'Mistral Large 3', tokensPerMinute: 250_000, requestsPerSecond: 1.0 },
  { id: 'ministral-14b-2512', label: 'Ministral 3 14B', tokensPerMinute: 937_500, requestsPerSecond: 0.5 },
  { id: 'ministral-8b-2512', label: 'Ministral 3 8B', tokensPerMinute: 625_000, requestsPerSecond: 3.13 },
  { id: 'ministral-3b-2512', label: 'Ministral 3 3B', tokensPerMinute: 1_300_000, requestsPerSecond: 12.5 },
  { id: 'codestral-2508', label: 'Codestral 25.08', tokensPerMinute: 625_000, requestsPerSecond: 2.08 },
]);

export function minIntervalMsForRps(requestsPerSecond) {
  if (!Number.isFinite(requestsPerSecond) || requestsPerSecond <= 0) {
    throw new TypeError('requestsPerSecond must be positive');
  }
  return Math.ceil(1_000 / requestsPerSecond);
}

export function validateBatteryConfiguration() {
  if (MODEL_CANDIDATES[0]?.id !== 'zai-glm-5-2') {
    throw new Error('GLM 5.2 must be the first model tested');
  }
  const ids = new Set();
  for (const candidate of MODEL_CANDIDATES) {
    if (ids.has(candidate.id)) throw new Error(`Duplicate model id: ${candidate.id}`);
    ids.add(candidate.id);
    if (candidate.id.endsWith('-latest')) throw new Error(`Moving aliases are not allowed: ${candidate.id}`);
    if (MODEL_BATTERY_INTERVAL_MS < minIntervalMsForRps(candidate.requestsPerSecond)) {
      throw new Error(`Battery interval violates the configured RPS limit for ${candidate.id}`);
    }
  }
}

function boundedProviderError(payload) {
  const error = payload && typeof payload === 'object' && payload.error && typeof payload.error === 'object'
    ? payload.error
    : {};
  return {
    code: typeof error.code === 'string' || typeof error.code === 'number' ? String(error.code).slice(0, 80) : null,
    type: typeof error.type === 'string' ? error.type.slice(0, 80) : null,
  };
}

class RequestGate {
  #lastStartedAt = 0;

  async fetch(path, init) {
    const elapsed = Date.now() - this.#lastStartedAt;
    const remaining = MODEL_BATTERY_INTERVAL_MS - elapsed;
    if (this.#lastStartedAt > 0 && remaining > 0) await delay(remaining);
    this.#lastStartedAt = Date.now();
    return fetch(`${MISTRAL_API_BASE}${path}`, {
      ...init,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  }
}

async function readJsonSafely(response) {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

async function listVisibleModels(gate, headers) {
  const response = await gate.fetch('/models', { headers });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    return { ok: false, httpStatus: response.status, ...boundedProviderError(payload), visibleIds: [] };
  }
  const data = Array.isArray(payload.data) ? payload.data : [];
  const visibleIds = data
    .map((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string' ? entry.id : null)
    .filter(Boolean);
  return { ok: true, httpStatus: response.status, visibleIds };
}

async function runStreamProbe(gate, headers, modelId) {
  const response = await gate.fetch('/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: 'Reply with exactly STREAM-OK.' }],
      stream: true,
      max_tokens: 32,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const payload = await readJsonSafely(response);
    return { ok: false, httpStatus: response.status, ...boundedProviderError(payload), chunkCount: 0, sawDone: false };
  }

  const text = await response.text();
  let chunkCount = 0;
  let sawDone = false;
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const value = line.slice(5).trim();
    if (value === '[DONE]') {
      sawDone = true;
      continue;
    }
    try {
      JSON.parse(value);
      chunkCount += 1;
    } catch {
      // Invalid chunks are reflected by ok=false below; raw provider content is never emitted.
    }
  }
  return {
    ok: chunkCount > 0 && sawDone,
    httpStatus: response.status,
    code: null,
    type: null,
    chunkCount,
    sawDone,
  };
}

function toolDefinition() {
  return {
    type: 'function',
    function: {
      name: 'echo_probe',
      description: 'Echo a short probe value exactly as provided.',
      parameters: {
        type: 'object',
        properties: { value: { type: 'string' } },
        required: ['value'],
        additionalProperties: false,
      },
    },
  };
}

function parseToolArguments(value) {
  if (value && typeof value === 'object') return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

async function runToolProbe(gate, headers, modelId) {
  const userMessage = {
    role: 'user',
    content: `Call echo_probe exactly once with value ${PROBE_VALUE}. Do not answer without calling the tool.`,
  };
  const tools = [toolDefinition()];
  const response = await gate.fetch('/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: [userMessage],
      tools,
      tool_choice: 'any',
      max_tokens: 64,
      temperature: 0,
    }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    return {
      result: { ok: false, httpStatus: response.status, ...boundedProviderError(payload), toolCallCount: 0, structuredArguments: false },
      replayContext: null,
    };
  }

  const assistant = payload?.choices?.[0]?.message;
  const toolCalls = Array.isArray(assistant?.tool_calls) ? assistant.tool_calls : [];
  const call = toolCalls[0];
  const args = parseToolArguments(call?.function?.arguments);
  const structuredArguments = call?.function?.name === 'echo_probe' && args?.value === PROBE_VALUE && typeof call?.id === 'string';
  return {
    result: {
      ok: toolCalls.length === 1 && structuredArguments,
      httpStatus: response.status,
      code: null,
      type: null,
      toolCallCount: toolCalls.length,
      structuredArguments,
    },
    replayContext: toolCalls.length === 1 && structuredArguments
      ? {
          userMessage,
          assistantMessage: {
            role: 'assistant',
            content: assistant.content ?? '',
            tool_calls: toolCalls,
          },
          toolCallId: call.id,
          tools,
        }
      : null,
  };
}

async function runReplayProbe(gate, headers, modelId, replayContext) {
  if (!replayContext) return { ok: false, skipped: true, httpStatus: null, code: null, type: null };
  const response = await gate.fetch('/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: modelId,
      messages: [
        replayContext.userMessage,
        replayContext.assistantMessage,
        {
          role: 'tool',
          name: 'echo_probe',
          tool_call_id: replayContext.toolCallId,
          content: JSON.stringify({ value: PROBE_VALUE }),
        },
      ],
      tools: replayContext.tools,
      tool_choice: 'auto',
      max_tokens: 64,
      temperature: 0,
    }),
  });
  const payload = await readJsonSafely(response);
  if (!response.ok) {
    return { ok: false, skipped: false, httpStatus: response.status, ...boundedProviderError(payload) };
  }
  const content = payload?.choices?.[0]?.message?.content;
  return {
    ok: typeof content === 'string' && content.includes(PROBE_VALUE),
    skipped: false,
    httpStatus: response.status,
    code: null,
    type: null,
  };
}

async function testCandidate(gate, headers, candidate, visibleIds) {
  const stream = await runStreamProbe(gate, headers, candidate.id);
  if (!stream.ok) {
    return {
      modelId: candidate.id,
      label: candidate.label,
      configuredLimits: { tokensPerMinute: candidate.tokensPerMinute, requestsPerSecond: candidate.requestsPerSecond },
      visibleInModelsEndpoint: visibleIds.includes(candidate.id),
      stream,
      tool: { ok: false, skipped: true },
      replay: { ok: false, skipped: true },
      providerCapable: false,
    };
  }

  const toolProbe = await runToolProbe(gate, headers, candidate.id);
  const replay = await runReplayProbe(gate, headers, candidate.id, toolProbe.replayContext);
  return {
    modelId: candidate.id,
    label: candidate.label,
    configuredLimits: { tokensPerMinute: candidate.tokensPerMinute, requestsPerSecond: candidate.requestsPerSecond },
    visibleInModelsEndpoint: visibleIds.includes(candidate.id),
    stream,
    tool: toolProbe.result,
    replay,
    providerCapable: stream.ok && toolProbe.result.ok && replay.ok,
  };
}

export async function runBattery(apiKey) {
  validateBatteryConfiguration();
  if (!apiKey?.trim() || /\s/.test(apiKey)) throw new TypeError('MISTRAL_API_KEY is missing or malformed');

  const headers = {
    Authorization: `Bearer ${apiKey.trim()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  const gate = new RequestGate();
  const modelListing = await listVisibleModels(gate, headers);
  const visibleIds = modelListing.visibleIds ?? [];
  const results = [];
  for (const candidate of MODEL_CANDIDATES) {
    results.push(await testCandidate(gate, headers, candidate, visibleIds));
  }
  return {
    schemaVersion: 1,
    status: results.some((entry) => entry.providerCapable) ? 'pass' : 'blocked',
    firstModelTested: MODEL_CANDIDATES[0].id,
    requestIntervalMs: MODEL_BATTERY_INTERVAL_MS,
    modelListing: {
      ok: modelListing.ok,
      httpStatus: modelListing.httpStatus,
      code: modelListing.code ?? null,
      type: modelListing.type ?? null,
      candidateVisibility: Object.fromEntries(MODEL_CANDIDATES.map((candidate) => [candidate.id, visibleIds.includes(candidate.id)])),
    },
    results,
    providerCapableModels: results.filter((entry) => entry.providerCapable).map((entry) => entry.modelId),
    notes: [
      'Calls are serialized and globally spaced by 2200ms, exceeding the 2000ms minimum implied by the slowest configured 0.5 RPS candidate.',
      'Raw prompts, provider response text, credentials, and authorization headers are not emitted.',
      'This is a direct Mistral API screening gate; a provider-capable result does not by itself prove DeepSeek Harness compatibility.',
      'Only exact model identifiers are tested; no moving latest alias or hidden fallback is used.',
    ],
  };
}

async function main() {
  const result = await runBattery(process.env.MISTRAL_API_KEY ?? '');
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.providerCapableModels.length === 0) process.exitCode = 2;
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    const name = error instanceof Error ? error.name : 'UnknownError';
    const message = error instanceof Error ? error.message : 'Unknown battery failure';
    process.stdout.write(`${JSON.stringify({
      schemaVersion: 1,
      status: 'error',
      providerCapableModels: [],
      error: { name, message: String(message).replace(/[\r\n\t]+/g, ' ').slice(-400) },
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}
