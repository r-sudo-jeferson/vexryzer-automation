type JsonRecord = Record<string, unknown>;

export interface HarnessEventEvidence {
  assistantChunkCount: number;
  toolCallCount: number;
  toolResultCount: number;
  structuredToolArguments: boolean;
  turnCompleted: boolean;
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

export function inspectHarnessEvents(events: readonly unknown[]): HarnessEventEvidence {
  const toolCalls = events.filter((event) => eventType(event) === 'tool/call');
  const toolResults = events.filter((event) => eventType(event) === 'tool/result');
  const toolNames = [...new Set(toolCalls.flatMap((event) => {
    const name = eventData(event)?.name;
    return typeof name === 'string' ? [name] : [];
  }))];

  const completed = events.some((event) => {
    if (eventType(event) !== 'turn/end') return false;
    const reason = record(eventData(event)?.reason);
    return reason?.kind === 'completed';
  });

  return {
    assistantChunkCount: events.filter((event) => eventType(event) === 'assistant/chunk').length,
    toolCallCount: toolCalls.length,
    toolResultCount: toolResults.length,
    structuredToolArguments: toolCalls.length > 0 && toolCalls.every(validStructuredArguments),
    turnCompleted: completed,
    toolNames,
  };
}
