import { randomUUID } from 'node:crypto';
import { assertProviderCandidateRegistry, providerCandidates } from './provider-candidates.ts';
import { classifyProviderFailure, sanitizeProviderDiagnostic } from './provider-evidence.ts';
import { resolveDirectProviderConfig } from './provider-direct-config.ts';
import { extractAssistantText, extractStructuredToolCall, isUsableOpenAiSse, parseOpenAiSse } from './provider-screen-protocol.ts';
import { buildReplayRequest, buildStreamRequest, buildToolRequest } from './provider-screen-request.ts';

const REQUEST_START_SPACING_MS = 2_500;
const REQUEST_TIMEOUT_MS = 30_000;
let lastRequestStartedAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function paceRequestStart() {
  const now = Date.now();
  const remaining = REQUEST_START_SPACING_MS - (now - lastRequestStartedAt);
  if (remaining > 0) await sleep(remaining);
  lastRequestStartedAt = Date.now();
}

async function post(config, body) {
  await paceRequestStart();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`provider request exceeded ${REQUEST_TIMEOUT_MS}ms`)), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function boundedFailure(config, phase, status, errorClass, error = undefined, state = {}) {
  return {
    provider: config.provider,
    modelId: config.modelId,
    authenticated: state.authenticated === true,
    streaming: state.streaming === true,
    toolCall: state.toolCall === true,
    toolReplay: state.toolReplay === true,
    errorClass,
    failurePhase: phase,
    ...(Number.isInteger(status) ? { httpStatus: status } : {}),
    ...(error instanceof Error
      ? { diagnostic: sanitizeProviderDiagnostic(`${error.name}: ${error.message}`, config.secretsToRedact) }
      : {}),
    ...(state.protocolEvidence && typeof state.protocolEvidence === 'object'
      ? { protocolEvidence: state.protocolEvidence }
      : {}),
  };
}

async function screenCandidate(candidate) {
  let config;
  try {
    config = resolveDirectProviderConfig(candidate, process.env);
  } catch (error) {
    return {
      provider: candidate.provider,
      modelId: candidate.modelId,
      authenticated: false,
      streaming: false,
      toolCall: false,
      toolReplay: false,
      errorClass: 'AUTH',
      failurePhase: 'credential-preflight',
      diagnostic: error instanceof Error ? error.message.slice(-300) : 'credential preflight failed',
    };
  }

  const streamMarker = `VXA-S002-STREAM-${randomUUID()}`;
  let streamResponse;
  try {
    streamResponse = await post(config, buildStreamRequest(config.modelId, streamMarker, config.provider));
  } catch (error) {
    const timeout = error instanceof Error && /abort|timeout|exceeded/i.test(`${error.name} ${error.message}`);
    return boundedFailure(config, 'stream', undefined, timeout ? 'TIMEOUT' : 'UNKNOWN', error);
  }
  if (!streamResponse.ok) {
    return boundedFailure(config, 'stream', streamResponse.status, classifyProviderFailure(streamResponse.status));
  }
  const streamBody = await streamResponse.text();
  const parsedStream = parseOpenAiSse(streamBody);
  const streaming = isUsableOpenAiSse(parsedStream);
  if (!streaming) {
    return boundedFailure(config, 'stream-structure', streamResponse.status, 'PROTOCOL', undefined, {
      authenticated: true,
      protocolEvidence: {
        eventCount: parsedStream.eventCount,
        contentChunkCount: parsedStream.contentChunkCount,
        reasoningChunkCount: parsedStream.reasoningChunkCount,
        done: parsedStream.done,
        markerPresent: parsedStream.text.includes(streamMarker),
        contentBytes: Buffer.byteLength(parsedStream.text, 'utf8'),
      },
    });
  }

  const toolMarker = `VXA-S002-TOOL-${randomUUID()}`;
  let toolResponse;
  try {
    toolResponse = await post(config, buildToolRequest(config.modelId, toolMarker, config.provider));
  } catch (error) {
    const timeout = error instanceof Error && /abort|timeout|exceeded/i.test(`${error.name} ${error.message}`);
    return boundedFailure(config, 'tool', undefined, timeout ? 'TIMEOUT' : 'UNKNOWN', error, { authenticated: true, streaming });
  }
  if (!toolResponse.ok) {
    return boundedFailure(config, 'tool', toolResponse.status, classifyProviderFailure(toolResponse.status), undefined, { authenticated: true, streaming });
  }
  let toolPayload;
  try {
    toolPayload = await toolResponse.json();
  } catch {
    return boundedFailure(config, 'tool-json', toolResponse.status, 'PROTOCOL', undefined, { authenticated: true, streaming });
  }
  const call = extractStructuredToolCall(toolPayload?.choices?.[0]?.message, 'capture_signal');
  const toolCall = call?.arguments.value === toolMarker;
  if (!call || !toolCall) {
    return boundedFailure(config, 'tool-semantic', toolResponse.status, 'PROTOCOL', undefined, { authenticated: true, streaming });
  }

  let replayResponse;
  try {
    replayResponse = await post(config, buildReplayRequest(config.modelId, call, toolMarker, config.provider));
  } catch (error) {
    const timeout = error instanceof Error && /abort|timeout|exceeded/i.test(`${error.name} ${error.message}`);
    return boundedFailure(config, 'replay', undefined, timeout ? 'TIMEOUT' : 'UNKNOWN', error, { authenticated: true, streaming, toolCall });
  }
  if (!replayResponse.ok) {
    return boundedFailure(config, 'replay', replayResponse.status, classifyProviderFailure(replayResponse.status), undefined, { authenticated: true, streaming, toolCall });
  }
  let replayPayload;
  try {
    replayPayload = await replayResponse.json();
  } catch {
    return boundedFailure(config, 'replay-json', replayResponse.status, 'PROTOCOL', undefined, { authenticated: true, streaming, toolCall });
  }
  const replayText = extractAssistantText(replayPayload);
  const toolReplay = replayText.includes(toolMarker);
  if (!toolReplay) {
    return boundedFailure(config, 'replay-semantic', replayResponse.status, 'PROTOCOL', undefined, { authenticated: true, streaming, toolCall });
  }

  return {
    provider: config.provider,
    modelId: config.modelId,
    authenticated: true,
    streaming: true,
    toolCall: true,
    toolReplay: true,
    errorClass: 'NONE',
    failurePhase: 'none',
  };
}

async function main() {
  assertProviderCandidateRegistry();
  const results = [];
  for (const candidate of providerCandidates) results.push(await screenCandidate(candidate));
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'complete',
    requestStartSpacingMs: REQUEST_START_SPACING_MS,
    results,
    notes: [
      'Requests are serialized across all candidates and raw provider payloads are not emitted.',
      '401/403/429 responses are recorded without blind retries.',
      'Streaming protocol proves SSE structure and delivery, not exact free-text instruction following; tool-call/replay markers and persuasion quality remain separate gates.',
    ],
  }, null, 2)}\n`);
}

main().catch((error) => {
  process.stdout.write(`${JSON.stringify({
    schemaVersion: 1,
    status: 'error',
    error: {
      name: error instanceof Error ? error.name : 'UnknownError',
      message: error instanceof Error ? error.message.slice(-500) : 'provider screening failed',
    },
  }, null, 2)}\n`);
  process.exitCode = 1;
});
