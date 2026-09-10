import type { ProviderRouteDefinition } from '../../../ai/providers/provider-registry.ts';

export type JsonSchema = Readonly<Record<string, unknown>>;

export interface LocalFunctionTool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

export type ChatToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export type ProviderChatMessage =
  | { role: 'system' | 'user'; content: string }
  | { role: 'assistant'; content: string | null; tool_calls?: readonly ChatToolCall[] }
  | { role: 'tool'; tool_call_id: string; content: string };

export interface ProviderServerConfig {
  cloudflareAccountId?: string;
}

export interface ProviderChatBody {
  model: string;
  messages: readonly ProviderChatMessage[];
  stream: true;
  tools: readonly LocalFunctionTool[];
  tool_choice: 'required';
  include_reasoning?: false;
}

export interface ServerChatHttpRequest {
  url: string;
  method: 'POST';
  headers: Headers;
  body: string;
}

const SAFE_ACCOUNT_ID = /^[A-Za-z0-9_-]{1,64}$/;
const SAFE_TOOL_NAME = /^[a-z][a-z0-9_]{0,63}$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const MAX_MESSAGES = 64;
const MAX_MESSAGE_TEXT = 64_000;
const MAX_TOOLS = 16;
const MAX_TOOL_DESCRIPTION = 1_000;
const MAX_SCHEMA_BYTES = 64_000;
const MAX_TOOL_ARGUMENT_BYTES = 256_000;
const MAX_API_TOKEN_LENGTH = 8_192;

function assertText(name: string, value: unknown, maxLength: number): asserts value is string {
  if (
    typeof value !== 'string'
    || value.length === 0
    || value.length > maxLength
    || CONTROL_CHARACTER_PATTERN.test(value)
  ) throw new TypeError(`${name} is invalid`);
}

function assertToolCall(call: ChatToolCall, path: string): void {
  if (!call || typeof call !== 'object') throw new TypeError(`${path} is invalid`);
  assertText(`${path}.id`, call.id, 256);
  if (call.type !== 'function') throw new TypeError(`${path} must be a local function tool`);
  if (!SAFE_TOOL_NAME.test(call.function?.name ?? '')) throw new TypeError(`${path}.function tool name is invalid`);
  if (typeof call.function?.arguments !== 'string' || new TextEncoder().encode(call.function.arguments).byteLength > MAX_TOOL_ARGUMENT_BYTES) {
    throw new TypeError(`${path}.function.arguments is invalid`);
  }
}

function assertMessages(messages: readonly ProviderChatMessage[]): void {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) {
    throw new TypeError('messages are invalid');
  }
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (!message || typeof message !== 'object') throw new TypeError(`messages[${i}] is invalid`);
    if (message.role === 'system' || message.role === 'user') {
      assertText(`messages[${i}].content`, message.content, MAX_MESSAGE_TEXT);
      continue;
    }
    if (message.role === 'assistant') {
      if (message.content !== null) assertText(`messages[${i}].content`, message.content, MAX_MESSAGE_TEXT);
      if (message.tool_calls !== undefined) {
        if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0 || message.tool_calls.length > MAX_TOOLS) {
          throw new TypeError(`messages[${i}].tool_calls is invalid`);
        }
        for (let j = 0; j < message.tool_calls.length; j += 1) assertToolCall(message.tool_calls[j]!, `messages[${i}].tool_calls[${j}]`);
      }
      if (message.content === null && message.tool_calls === undefined) throw new TypeError(`messages[${i}] assistant message is empty`);
      continue;
    }
    if (message.role === 'tool') {
      assertText(`messages[${i}].tool_call_id`, message.tool_call_id, 256);
      assertText(`messages[${i}].content`, message.content, MAX_MESSAGE_TEXT);
      continue;
    }
    throw new TypeError(`messages[${i}].role is invalid`);
  }
}

function validateJsonValue(value: unknown, depth = 0): void {
  if (depth > 16) throw new TypeError('tool schema is too deep');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('tool schema contains non-finite number');
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) validateJsonValue(item, depth + 1);
    return;
  }
  if (typeof value === 'object') {
    for (const [key, nested] of Object.entries(value)) {
      assertText('tool schema key', key, 256);
      validateJsonValue(nested, depth + 1);
    }
    return;
  }
  throw new TypeError('tool schema must be JSON data');
}

function assertLocalTools(tools: readonly LocalFunctionTool[]): void {
  if (!Array.isArray(tools) || tools.length === 0 || tools.length > MAX_TOOLS) throw new TypeError('local function tools are invalid');
  const names = new Set<string>();
  for (let i = 0; i < tools.length; i += 1) {
    const tool = tools[i];
    if (!tool || typeof tool !== 'object' || tool.type !== 'function') throw new TypeError(`tools[${i}] must be a local function tool`);
    const fn = tool.function;
    if (!fn || typeof fn !== 'object' || !SAFE_TOOL_NAME.test(fn.name ?? '')) throw new TypeError(`tools[${i}] tool name is invalid`);
    if (names.has(fn.name)) throw new TypeError(`tools[${i}] tool name is duplicated`);
    names.add(fn.name);
    assertText(`tools[${i}].description`, fn.description, MAX_TOOL_DESCRIPTION);
    if (!fn.parameters || typeof fn.parameters !== 'object' || Array.isArray(fn.parameters)) throw new TypeError(`tools[${i}].parameters is invalid`);
    if (fn.parameters['type'] !== 'object' || fn.parameters['additionalProperties'] !== false) {
      throw new TypeError(`tools[${i}].parameters must be a closed object schema`);
    }
    validateJsonValue(fn.parameters);
    const bytes = new TextEncoder().encode(JSON.stringify(fn.parameters)).byteLength;
    if (bytes > MAX_SCHEMA_BYTES) throw new TypeError(`tools[${i}].parameters exceeds schema limit`);
  }
}

export function buildProviderChatEndpoint(
  route: Readonly<ProviderRouteDefinition>,
  serverConfig: Readonly<ProviderServerConfig>,
): string {
  if (route.family === 'groq') return 'https://api.groq.com/openai/v1/chat/completions';
  if (route.family === 'cloudflare_workers_ai') {
    const accountId = serverConfig.cloudflareAccountId;
    if (typeof accountId !== 'string' || !SAFE_ACCOUNT_ID.test(accountId)) {
      throw new TypeError('cloudflareAccountId is required and must be a safe account identifier');
    }
    return `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1/chat/completions`;
  }
  throw new TypeError(`unsupported provider family: ${route.family}`);
}

export function buildProviderChatBody(input: {
  route: Readonly<ProviderRouteDefinition>;
  messages: readonly ProviderChatMessage[];
  tools: readonly LocalFunctionTool[];
}): Readonly<ProviderChatBody> {
  assertMessages(input.messages);
  assertLocalTools(input.tools);
  assertText('route.modelId', input.route.modelId, 256);
  return Object.freeze({
    model: input.route.modelId,
    messages: Object.freeze([...input.messages]),
    stream: true,
    tools: Object.freeze([...input.tools]),
    tool_choice: 'required',
    ...(input.route.family === 'groq' ? { include_reasoning: false as const } : {}),
  });
}

export function buildServerChatHttpRequest(input: {
  route: Readonly<ProviderRouteDefinition>;
  serverConfig: Readonly<ProviderServerConfig>;
  apiToken: string;
  messages: readonly ProviderChatMessage[];
  tools: readonly LocalFunctionTool[];
}): Readonly<ServerChatHttpRequest> {
  const token = input.apiToken;
  if (
    typeof token !== 'string'
    || token.length === 0
    || token.length > MAX_API_TOKEN_LENGTH
    || /[\r\n]/.test(token)
  ) throw new TypeError('apiToken is invalid');
  const url = buildProviderChatEndpoint(input.route, input.serverConfig);
  const body = JSON.stringify(buildProviderChatBody(input));
  return Object.freeze({
    url,
    method: 'POST' as const,
    headers: new Headers({
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    }),
    body,
  });
}
