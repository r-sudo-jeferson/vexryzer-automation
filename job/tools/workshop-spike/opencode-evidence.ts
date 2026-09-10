const MAX_EVENT_OUTPUT_BYTES = 2_000_000;
const MAX_EVENT_COUNT = 5_000;

export interface OpenCodeJsonEvent {
  type: string;
  sessionID: string;
  part?: unknown;
  [key: string]: unknown;
}

export interface OpenCodeCompletedToolEvidence {
  name: string;
  input: Record<string, unknown>;
  outputContainsText: (marker: string) => boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseOpenCodeJsonEvents(stdout: string): OpenCodeJsonEvent[] {
  if (Buffer.byteLength(stdout, 'utf8') > MAX_EVENT_OUTPUT_BYTES) {
    throw new Error('OpenCode JSON event output exceeded bounded evidence limit');
  }
  const lines = stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length > MAX_EVENT_COUNT) throw new Error('OpenCode JSON event count exceeded bounded evidence limit');
  return lines.map((line, index) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      throw new Error(`OpenCode JSON event ${index + 1} is malformed`);
    }
    if (!isRecord(parsed) || typeof parsed.type !== 'string' || typeof parsed.sessionID !== 'string' || !parsed.sessionID.trim()) {
      throw new Error(`OpenCode JSON event ${index + 1} has an invalid envelope`);
    }
    return parsed as OpenCodeJsonEvent;
  });
}

export function inspectOpenCodeEvents(events: readonly OpenCodeJsonEvent[]) {
  if (events.length === 0) throw new Error('OpenCode emitted no JSON events');
  const sessionIDs = new Set(events.map((event) => event.sessionID));
  if (sessionIDs.size !== 1) throw new Error('OpenCode emitted mixed session identities');
  const sessionID = events[0]!.sessionID;

  const completedTools: OpenCodeCompletedToolEvidence[] = [];
  const textParts: string[] = [];
  const errorEvents: string[] = [];
  for (const event of events) {
    if (event.type === 'tool_use' && isRecord(event.part)) {
      const part = event.part;
      const state = isRecord(part.state) ? part.state : undefined;
      if (part.type === 'tool' && typeof part.tool === 'string' && state?.status === 'completed' && isRecord(state.input)) {
        const output = state.output;
        completedTools.push({
          name: part.tool,
          input: { ...state.input },
          outputContainsText: (marker: string) => JSON.stringify(output ?? '').includes(marker),
        });
      }
    }
    if (event.type === 'text' && isRecord(event.part) && event.part.type === 'text' && typeof event.part.text === 'string') {
      textParts.push(event.part.text);
    }
    if (event.type === 'error') errorEvents.push(event.type);
  }

  return {
    sessionID,
    eventCount: events.length,
    streamedEvents: events.length >= 2,
    completedTools,
    finalText: textParts.at(-1) ?? '',
    errorEventCount: errorEvents.length,
  };
}

export function sanitizeOpenCodeDiagnostic(message: string, secretValues: readonly (string | undefined)[]): string {
  let sanitized = message.replace(/[\r\n\t]+/g, ' ').trim();
  for (const secret of secretValues) {
    const value = secret?.trim();
    if (value) sanitized = sanitized.split(value).join('[REDACTED]');
  }
  sanitized = sanitized.replace(/Authorization\s*:\s*Bearer\s+\S+/gi, 'Authorization: Bearer [REDACTED]');
  sanitized = sanitized.replace(/((?:GROQ|OPENAI|MISTRAL|CLOUDFLARE)_[A-Z0-9_]*(?:KEY|TOKEN)\s*[=:]\s*)\S+/gi, '$1[REDACTED]');
  return sanitized.slice(-800);
}
