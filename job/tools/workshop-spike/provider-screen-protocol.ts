export interface ParsedSse {
  eventCount: number;
  text: string;
  done: boolean;
}

export function parseOpenAiSse(body: string): ParsedSse {
  let eventCount = 0;
  let text = '';
  let done = false;
  for (const line of body.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (!data) continue;
    if (data === '[DONE]') { done = true; continue; }
    try {
      const event = JSON.parse(data) as { choices?: Array<{ delta?: { content?: unknown } }> };
      eventCount += 1;
      const content = event.choices?.[0]?.delta?.content;
      if (typeof content === 'string') text += content;
    } catch {
      // Invalid raw SSE data is ignored here; the caller judges whether a usable stream completed.
    }
  }
  return { eventCount, text, done };
}

export interface StructuredToolCall {
  id: string;
  name: string;
  argumentsJson: string;
  arguments: Record<string, unknown>;
}

export function extractStructuredToolCall(message: unknown, expectedName: string): StructuredToolCall | null {
  if (!message || typeof message !== 'object') return null;
  const toolCalls = (message as { tool_calls?: unknown }).tool_calls;
  if (!Array.isArray(toolCalls) || toolCalls.length !== 1) return null;
  const call = toolCalls[0];
  if (!call || typeof call !== 'object') return null;
  const id = (call as { id?: unknown }).id;
  const fn = (call as { function?: unknown }).function;
  if (typeof id !== 'string' || !id || !fn || typeof fn !== 'object') return null;
  const name = (fn as { name?: unknown }).name;
  const argumentsJson = (fn as { arguments?: unknown }).arguments;
  if (name !== expectedName || typeof argumentsJson !== 'string') return null;
  try {
    const parsed = JSON.parse(argumentsJson) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return { id, name, argumentsJson, arguments: parsed as Record<string, unknown> };
  } catch {
    return null;
  }
}

export function extractAssistantText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const choices = (payload as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return '';
  const message = choices[0] && typeof choices[0] === 'object' ? (choices[0] as { message?: unknown }).message : undefined;
  if (!message || typeof message !== 'object') return '';
  const content = (message as { content?: unknown }).content;
  return typeof content === 'string' ? content : '';
}
