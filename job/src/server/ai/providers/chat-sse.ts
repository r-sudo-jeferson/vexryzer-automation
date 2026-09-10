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

export type ChatStreamChunkErrorCode =
  | 'chunk_shape'
  | 'choice_shape'
  | 'content'
  | 'content_limit'
  | 'tool_calls'
  | 'tool_index'
  | 'tool_id'
  | 'tool_type'
  | 'tool_function'
  | 'tool_name'
  | 'tool_arguments'
  | 'tool_arguments_limit'
  | 'finish_reason'
  | 'finish_reason_conflict';

export class ChatStreamChunkError extends TypeError {
  readonly code: ChatStreamChunkErrorCode;

  constructor(code: ChatStreamChunkErrorCode) {
    super(`invalid chat stream chunk: ${code}`);
    this.name = 'ChatStreamChunkError';
    this.code = code;
  }
}

function rejectChunk(code: ChatStreamChunkErrorCode): never {
  throw new ChatStreamChunkError(code);
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
      if (!isRecord(chunk) || !Array.isArray(chunk['choices'])) rejectChunk('chunk_shape');
      const choices = chunk['choices'];
      if (choices.length === 0) return;
      if (choices.length !== 1 || !isRecord(choices[0])) {
        rejectChunk('choice_shape');
      }
      const choice = choices[0];
      if (choice['index'] !== 0 || !isRecord(choice['delta'])) {
        rejectChunk('choice_shape');
      }
      const delta = choice['delta'];
      const rawContent = delta['content'];
      if (rawContent !== undefined && rawContent !== null) {
        if (typeof rawContent !== 'string') rejectChunk('content');
        content += rawContent;
        if (utf8Bytes(content) > MAX_CONTENT_BYTES) rejectChunk('content_limit');
      }

      const rawToolCalls = delta['tool_calls'];
      if (rawToolCalls !== undefined) {
        if (!Array.isArray(rawToolCalls) || rawToolCalls.length > MAX_TOOL_CALLS) rejectChunk('tool_calls');
        for (const raw of rawToolCalls) {
          if (!isRecord(raw) || !Number.isInteger(raw['index']) || (raw['index'] as number) < 0 || (raw['index'] as number) >= MAX_TOOL_CALLS) {
            rejectChunk('tool_index');
          }
          const index = raw['index'] as number;
          const current = tools.get(index) ?? { id: '', type: 'function' as const, name: '', arguments: '' };
          if (raw['id'] !== undefined) {
            if (typeof raw['id'] !== 'string' || raw['id'].length === 0 || (current.id && current.id !== raw['id'])) {
              rejectChunk('tool_id');
            }
            current.id = raw['id'];
          }
          if (raw['type'] !== undefined && raw['type'] !== 'function') rejectChunk('tool_type');
          const fn = raw['function'];
          if (fn !== undefined) {
            if (!isRecord(fn)) rejectChunk('tool_function');
            if (fn['name'] !== undefined) {
              if (typeof fn['name'] !== 'string') rejectChunk('tool_name');
              current.name += fn['name'];
            }
            if (fn['arguments'] !== undefined) {
              if (typeof fn['arguments'] !== 'string') rejectChunk('tool_arguments');
              current.arguments += fn['arguments'];
              if (utf8Bytes(current.arguments) > MAX_TOOL_ARGUMENT_BYTES) rejectChunk('tool_arguments_limit');
            }
          }
          tools.set(index, current);
        }
      }

      const rawFinish = choice['finish_reason'];
      if (rawFinish !== undefined && rawFinish !== null) {
        if (typeof rawFinish !== 'string' || rawFinish.length > 64) rejectChunk('finish_reason');
        if (finishReason !== null && finishReason !== rawFinish) rejectChunk('finish_reason_conflict');
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
