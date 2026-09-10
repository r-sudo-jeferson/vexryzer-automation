type JsonRecord = Record<string, unknown>;

export interface HarnessEventEvidence {
  assistantChunkCount: number;
  assistantMessageCount: number;
  assistantAttemptCount: number;
  stepStartCount: number;
  stepEndCount: number;
  requestHeaderCount: number;
  toolCallCount: number;
  toolResultCount: number;
  toolErrorCount: number;
  toolErrorCodes: string[];
  turnErrorCodes: string[];
  turnErrorStatuses: number[];
  reportedInputTokens: number;
  reportedOutputTokens: number;
  reportedCacheReadTokens: number;
  reportedCacheWriteTokens: number;
  maxSystemPromptChars: number;
  maxToolSchemaCount: number;
  structuredToolArguments: boolean;
  turnCompleted: boolean;
  turnEndReasons: string[];
  toolNames: string[];
}

function record(value: unknown): JsonRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonRecord
    : null;
}

function eventType(value: unknown): string | null {
  const event = record(value);
  return typeof event?.type === 'string' ? event.type : null;
}

function eventData(value: unknown): JsonRecord | null {
  return record(record(value)?.data);
}

function toolCallIdFromCall(value: unknown): string | null {
  const data = eventData(value);
  return typeof data?.callId === 'string' ? data.callId : null;
}

function toolCallIdFromResult(value: unknown): string | null {
  const message = record(eventData(value)?.message);
  if (typeof message?.toolCallId === 'string') return message.toolCallId;
  if (typeof message?.tool_call_id === 'string') return message.tool_call_id;
  return null;
}

function validStructuredArguments(value: unknown): boolean {
  const data = eventData(value);
  if (typeof data?.arguments !== 'string') return false;
  try {
    return record(JSON.parse(data.arguments)) !== null;
  } catch {
    return false;
  }
}

function toolErrorCode(value: unknown): string | null {
  const error = record(eventData(value)?.error);
  return typeof error?.code === 'string' ? error.code : null;
}

function turnEndReason(value: unknown): string | null {
  const reason = record(eventData(value)?.reason);
  return typeof reason?.kind === 'string' ? reason.kind : null;
}

function turnEndError(value: unknown): JsonRecord | null {
  const reason = record(eventData(value)?.reason);
  return reason?.kind === 'error' ? record(reason.error) : null;
}

function turnErrorCode(value: unknown): string | null {
  const error = turnEndError(value);
  return typeof error?.code === 'string' ? error.code : null;
}

function turnErrorStatus(value: unknown): number | null {
  const error = turnEndError(value);
  return Number.isInteger(error?.status) ? error.status as number : null;
}

function assistantUsage(value: unknown): JsonRecord | null {
  return eventType(value) === 'assistant/message' ? record(eventData(value)?.usage) : null;
}

function safeNonNegativeInteger(value: unknown): number {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : 0;
}

function maxOrZero(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values);
}

function requestHeader(value: unknown): JsonRecord | null {
  return eventType(value) === 'request/header' ? record(eventData(value)?.header) : null;
}

export function hasStreamingChunks(events: readonly unknown[]): boolean {
  return events.some((event) => eventType(event) === 'assistant/chunk');
}

export function hasToolRoundTrip(events: readonly unknown[]): boolean {
  const calls = new Set(
    events
      .filter((event) => eventType(event) === 'tool/call')
      .map(toolCallIdFromCall)
      .filter((id): id is string => id !== null),
  );
  return events.some((event) => {
    if (eventType(event) !== 'tool/result') return false;
    const id = toolCallIdFromResult(event);
    return id !== null && calls.has(id);
  });
}

export function assertMinimalHarnessRequestSurface(evidence: HarnessEventEvidence): void {
  if (evidence.requestHeaderCount < 1) {
    throw new Error('sdk-minimal probe did not expose a request/header event');
  }
  if (evidence.maxToolSchemaCount !== 2) {
    throw new Error(`sdk-minimal probe expected exactly 2 tool schemas; got ${evidence.maxToolSchemaCount}`);
  }
}

export function assertMinimalHarnessContinuationSurface(
  priorEvidence: HarnessEventEvidence,
  continuationEvidence: HarnessEventEvidence,
): void {
  assertMinimalHarnessRequestSurface(priorEvidence);
  if (continuationEvidence.requestHeaderCount === 0) return;
  assertMinimalHarnessRequestSurface(continuationEvidence);
}

export function inspectHarnessEvents(events: readonly unknown[]): HarnessEventEvidence {
  const toolCalls = events.filter((event) => eventType(event) === 'tool/call');
  const toolResults = events.filter((event) => eventType(event) === 'tool/result');
  const assistantMessages = events.filter((event) => eventType(event) === 'assistant/message');
  const requestHeaders = events.filter((event) => eventType(event) === 'request/header');
  const toolNames = [...new Set(toolCalls.flatMap((event) => {
    const name = eventData(event)?.name;
    return typeof name === 'string' ? [name] : [];
  }))];
  const toolErrorCodes = [...new Set(toolResults.map(toolErrorCode).filter((code): code is string => code !== null))];
  const turnEndReasons = events.map(turnEndReason).filter((reason): reason is string => reason !== null);
  const turnErrorCodes = [...new Set(events.map(turnErrorCode).filter((code): code is string => code !== null))];
  const turnErrorStatuses = [...new Set(events.map(turnErrorStatus).filter((status): status is number => status !== null))];

  return {
    assistantChunkCount: events.filter((event) => eventType(event) === 'assistant/chunk').length,
    assistantMessageCount: assistantMessages.length,
    assistantAttemptCount: events.filter((event) => eventType(event) === 'assistant/attempt').length,
    stepStartCount: events.filter((event) => eventType(event) === 'step/start').length,
    stepEndCount: events.filter((event) => eventType(event) === 'step/end').length,
    requestHeaderCount: requestHeaders.length,
    toolCallCount: toolCalls.length,
    toolResultCount: toolResults.length,
    toolErrorCount: toolResults.filter((event) => record(eventData(event)?.error) !== null).length,
    toolErrorCodes,
    turnErrorCodes,
    turnErrorStatuses,
    reportedInputTokens: assistantMessages.reduce(
      (total, event) => total + safeNonNegativeInteger(assistantUsage(event)?.inputTokens),
      0,
    ),
    reportedOutputTokens: assistantMessages.reduce(
      (total, event) => total + safeNonNegativeInteger(assistantUsage(event)?.outputTokens),
      0,
    ),
    reportedCacheReadTokens: assistantMessages.reduce(
      (total, event) => total + safeNonNegativeInteger(assistantUsage(event)?.cacheReadTokens),
      0,
    ),
    reportedCacheWriteTokens: assistantMessages.reduce(
      (total, event) => total + safeNonNegativeInteger(assistantUsage(event)?.cacheWriteTokens),
      0,
    ),
    maxSystemPromptChars: maxOrZero(requestHeaders.map((event) => {
      const header = requestHeader(event);
      return typeof header?.system === 'string' ? header.system.length : 0;
    })),
    maxToolSchemaCount: maxOrZero(requestHeaders.map((event) => {
      const header = requestHeader(event);
      return Array.isArray(header?.tools) ? header.tools.length : 0;
    })),
    structuredToolArguments: toolCalls.length > 0 && toolCalls.every(validStructuredArguments),
    turnCompleted: turnEndReasons.includes('completed'),
    turnEndReasons,
    toolNames,
  };
}
