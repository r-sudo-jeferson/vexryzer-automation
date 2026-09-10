export type ChatSseEvent =
  | { type: 'chunk'; data: unknown }
  | { type: 'done' };

export interface ChatSseDecoder {
  push(chunk: Uint8Array | string): readonly ChatSseEvent[];
  finish(): readonly ChatSseEvent[];
}

export interface AssembledToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface AssembledChatStream {
  content: string;
  toolCalls: readonly Readonly<AssembledToolCall>[];
  finishReason: string | null;
}

export interface ChatStreamAccumulator {
  accept(chunk: unknown): void;
  finish(): Readonly<AssembledChatStream>;
}

const DEFAULT_MAX_BUFFERED_BYTES = 2_000_000;
const MAX_CONTENT_BYTES = 512_000;
const MAX_TOOL_ARGUMENT_BYTES = 1_000_000;
const MAX_TOOL_CALLS = 16;
const SAFE_TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function decodeFrame(frame: string): ChatSseEvent | null {
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.length === 0 || line.startsWith(':')) continue;
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).replace(/^ /, ''));
      continue;
    }
    throw new TypeError('unsupported sse field');
  }
  if (dataLines.length === 0) return null;
  const data = dataLines.join('\n');
  if (data === '[DONE]') return { type: 'done' };
  try {
    return { type: 'chunk', data: JSON.parse(data) as unknown };
  } catch {
    throw new TypeError('malformed sse json');
  }
}

export function createChatSseDecoder(
  options: { maxBufferedBytes?: number } = {},
): ChatSseDecoder {
  const maxBufferedBytes = options.maxBufferedBytes ?? DEFAULT_MAX_BUFFERED_BYTES;
  if (!Number.isInteger(maxBufferedBytes) || maxBufferedBytes < 16) throw new TypeError('maxBufferedBytes is invalid');

  const decoder = new TextDecoder();
  let buffer = '';
  let done = false;

  const drain = (finish: boolean): readonly ChatSseEvent[] => {
    if (done && buffer.length === 0) return Object.freeze([]);
    buffer = buffer.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const output: ChatSseEvent[] = [];
    while (true) {
      const boundary = buffer.indexOf('\n\n');
      if (boundary < 0) break;
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const event = decodeFrame(frame);
      if (event !== null) {
        output.push(event);
        if (event.type === 'done') {
          done = true;
          if (buffer.trim().length > 0) throw new TypeError('sse data received after done');
          break;
        }
      }
    }
    if (finish && buffer.trim().length > 0) {
      const event = decodeFrame(buffer);
      buffer = '';
      if (event !== null) {
        output.push(event);
        if (event.type === 'done') done = true;
      }
    }
    if (utf8Bytes(buffer) > maxBufferedBytes) throw new RangeError('sse buffer limit exceeded');
    return Object.freeze(output);
  };

  return Object.freeze({
    push(chunk: Uint8Array | string): readonly ChatSseEvent[] {
      if (done) {
        if ((typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true })).trim().length > 0) {
          throw new TypeError('sse data received after done');
        }
        return Object.freeze([]);
      }
      buffer += typeof chunk === 'string' ? chunk : decoder.decode(chunk, { stream: true });
      if (utf8Bytes(buffer) > maxBufferedBytes) throw new RangeError('sse buffer limit exceeded');
      return drain(false);
    },
    finish(): readonly ChatSseEvent[] {
      if (!done) buffer += decoder.decode();
      return drain(true);
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type MutableTool = { id: string; type: 'function'; name: string; arguments: string };

export function createChatStreamAccumulator(): ChatStreamAccumulator {
  let content = '';
  let finishReason: string | null = null;
  const tools = new Map<number, MutableTool>();

  return Object.freeze({
    accept(chunk: unknown): void {
      if (!isRecord(chunk) || !Array.isArray(chunk['choices'])) throw new TypeError('invalid chat stream chunk');
      const choices = chunk['choices'];
      if (choices.length === 0) return;
      if (choices.length !== 1 || !isRecord(choices[0])) {
        throw new TypeError('unsupported chat stream choice');
      }
      const choice = choices[0];
      if (choice['index'] !== 0 || !isRecord(choice['delta'])) {
        throw new TypeError('unsupported chat stream choice');
      }
      const delta = choice['delta'];
      const rawContent = delta['content'];
      if (rawContent !== undefined && rawContent !== null) {
        if (typeof rawContent !== 'string') throw new TypeError('invalid chat content fragment');
        content += rawContent;
        if (utf8Bytes(content) > MAX_CONTENT_BYTES) throw new RangeError('chat content limit exceeded');
      }

      const rawToolCalls = delta['tool_calls'];
      if (rawToolCalls !== undefined) {
        if (!Array.isArray(rawToolCalls) || rawToolCalls.length > MAX_TOOL_CALLS) throw new TypeError('invalid tool call fragments');
        for (const raw of rawToolCalls) {
          if (!isRecord(raw) || !Number.isInteger(raw['index']) || (raw['index'] as number) < 0 || (raw['index'] as number) >= MAX_TOOL_CALLS) {
            throw new TypeError('invalid tool call index');
          }
          const index = raw['index'] as number;
          const current = tools.get(index) ?? { id: '', type: 'function' as const, name: '', arguments: '' };
          if (raw['id'] !== undefined) {
            if (typeof raw['id'] !== 'string' || raw['id'].length === 0 || (current.id && current.id !== raw['id'])) {
              throw new TypeError('invalid tool call id fragment');
            }
            current.id = raw['id'];
          }
          if (raw['type'] !== undefined && raw['type'] !== 'function') throw new TypeError('only local function tool calls are supported');
          const fn = raw['function'];
          if (fn !== undefined) {
            if (!isRecord(fn)) throw new TypeError('invalid tool call function fragment');
            if (fn['name'] !== undefined) {
              if (typeof fn['name'] !== 'string') throw new TypeError('invalid tool call name fragment');
              current.name += fn['name'];
            }
            if (fn['arguments'] !== undefined) {
              if (typeof fn['arguments'] !== 'string') throw new TypeError('invalid tool call arguments fragment');
              current.arguments += fn['arguments'];
              if (utf8Bytes(current.arguments) > MAX_TOOL_ARGUMENT_BYTES) throw new RangeError('tool arguments limit exceeded');
            }
          }
          tools.set(index, current);
        }
      }

      const rawFinish = choice['finish_reason'];
      if (rawFinish !== undefined && rawFinish !== null) {
        if (typeof rawFinish !== 'string' || rawFinish.length > 64) throw new TypeError('invalid finish reason');
        if (finishReason !== null && finishReason !== rawFinish) throw new TypeError('conflicting finish reason');
        finishReason = rawFinish;
      }
    },

    finish(): Readonly<AssembledChatStream> {
      const toolCalls = [...tools.entries()]
        .sort(([left], [right]) => left - right)
        .map(([, tool]) => {
          if (!tool.id || !tool.name) throw new TypeError('incomplete tool call');
          if (!SAFE_TOOL_NAME.test(tool.name)) throw new TypeError('tool call name is invalid');
          let parsedArguments: unknown;
          try {
            parsedArguments = JSON.parse(tool.arguments) as unknown;
          } catch {
            throw new TypeError('tool call arguments must be a json object');
          }
          if (!isRecord(parsedArguments)) throw new TypeError('tool call arguments must be a json object');
          return Object.freeze({
            id: tool.id,
            type: 'function' as const,
            function: Object.freeze({ name: tool.name, arguments: tool.arguments }),
          });
        });
      return Object.freeze({
        content,
        toolCalls: Object.freeze(toolCalls),
        finishReason,
      });
    },
  });
}
