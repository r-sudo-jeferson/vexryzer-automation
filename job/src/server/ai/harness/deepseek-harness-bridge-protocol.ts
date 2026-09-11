import { createHash } from 'node:crypto';
import {
  isDeepSeekHarnessToolAllowed,
  type DeepSeekHarnessAgentRole,
} from './deepseek-harness-visitor-policy.ts';

export const DEEPSEEK_HARNESS_BRIDGE_LIMITS = Object.freeze({
  idLength: 96,
  argumentBytes: 64 * 1024,
  resultBytes: 128 * 1024,
  jsonDepth: 12,
  jsonNodes: 4_096,
  objectKeys: 128,
  arrayItems: 256,
  stringLength: 16_384,
} as const);

export type DeepSeekHarnessBridgeJson =
  | null
  | boolean
  | number
  | string
  | readonly DeepSeekHarnessBridgeJson[]
  | { readonly [key: string]: DeepSeekHarnessBridgeJson };

export interface DeepSeekHarnessBridgeRequest {
  schemaVersion: 1;
  bridgeRequestId: string;
  sessionId: string;
  harnessSessionId: string;
  leaseId: string;
  requestId: string;
  canonicalRevision: number;
  role: DeepSeekHarnessAgentRole;
  toolName: string;
  args: Readonly<Record<string, DeepSeekHarnessBridgeJson>>;
}

export type DeepSeekHarnessBridgeRequestFailureCode =
  | 'INVALID_SHAPE'
  | 'INVALID_ID'
  | 'INVALID_REVISION'
  | 'INVALID_ROLE'
  | 'INVALID_HARNESS_SESSION'
  | 'UNAUTHORIZED_TOOL'
  | 'INVALID_JSON'
  | 'LIMIT_EXCEEDED';

export type DeepSeekHarnessBridgeRequestValidation =
  | { ok: true; request: Readonly<DeepSeekHarnessBridgeRequest> }
  | { ok: false; code: DeepSeekHarnessBridgeRequestFailureCode; path: string };

export type DeepSeekHarnessBridgeExecutionErrorCode =
  | 'STALE_REVISION'
  | 'LEASE_MISMATCH'
  | 'REQUEST_MISMATCH'
  | 'UNAUTHORIZED_TOOL'
  | 'INVALID_ARGUMENTS'
  | 'CANCELLED'
  | 'DEADLINE_EXCEEDED'
  | 'EXECUTION_REJECTED';

export type DeepSeekHarnessBridgeResponse =
  | {
      schemaVersion: 1;
      bridgeRequestId: string;
      toolName: string;
      ok: true;
      canonicalRevision: number;
      result: DeepSeekHarnessBridgeJson;
    }
  | {
      schemaVersion: 1;
      bridgeRequestId: string;
      toolName: string;
      ok: false;
      canonicalRevision: number;
      code: DeepSeekHarnessBridgeExecutionErrorCode;
    };

export type DeepSeekHarnessBridgeResponseValidation =
  | { ok: true; response: Readonly<DeepSeekHarnessBridgeResponse> }
  | { ok: false; code: 'INVALID_SHAPE' | 'INVALID_ID' | 'INVALID_REVISION' | 'INVALID_JSON' | 'LIMIT_EXCEEDED'; path: string };

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_TOOL_NAME = /^[a-z][a-z0-9_]{0,95}$/;
const SAFE_JSON_KEY = /^[A-Za-z][A-Za-z0-9_]{0,95}$/;

const REQUEST_KEYS = new Set([
  'schemaVersion',
  'bridgeRequestId',
  'sessionId',
  'harnessSessionId',
  'leaseId',
  'requestId',
  'canonicalRevision',
  'role',
  'toolName',
  'args',
]);

const RESPONSE_SUCCESS_KEYS = new Set([
  'schemaVersion',
  'bridgeRequestId',
  'toolName',
  'ok',
  'canonicalRevision',
  'result',
]);

const RESPONSE_FAILURE_KEYS = new Set([
  'schemaVersion',
  'bridgeRequestId',
  'toolName',
  'ok',
  'canonicalRevision',
  'code',
]);

const TOOL_ARGUMENT_KEYS: Readonly<Record<DeepSeekHarnessAgentRole, Readonly<Record<string, ReadonlySet<string>>>>> = Object.freeze({
  seller: Object.freeze({
    capture_user_observations: new Set(['observations']),
    request_calculations: new Set(['requests']),
    submit_seller_submission: new Set(['submission']),
  }),
  critic: Object.freeze({
    submit_critic_review: new Set(['review']),
  }),
});

const EXECUTION_ERROR_CODES = new Set<DeepSeekHarnessBridgeExecutionErrorCode>([
  'STALE_REVISION',
  'LEASE_MISMATCH',
  'REQUEST_MISMATCH',
  'UNAUTHORIZED_TOOL',
  'INVALID_ARGUMENTS',
  'CANCELLED',
  'DEADLINE_EXCEEDED',
  'EXECUTION_REJECTED',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, keys: ReadonlySet<string>): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.size && actual.every((key) => keys.has(key));
}

function safeId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= DEEPSEEK_HARNESS_BRIDGE_LIMITS.idLength
    && SAFE_ID.test(value);
}

interface JsonBudget {
  nodes: number;
}

type JsonValidation =
  | { ok: true; value: DeepSeekHarnessBridgeJson }
  | { ok: false; code: 'INVALID_JSON' | 'LIMIT_EXCEEDED'; path: string };

function validateJson(
  value: unknown,
  path: string,
  depth: number,
  budget: JsonBudget,
): JsonValidation {
  if (depth > DEEPSEEK_HARNESS_BRIDGE_LIMITS.jsonDepth) {
    return { ok: false, code: 'LIMIT_EXCEEDED', path };
  }
  budget.nodes += 1;
  if (budget.nodes > DEEPSEEK_HARNESS_BRIDGE_LIMITS.jsonNodes) {
    return { ok: false, code: 'LIMIT_EXCEEDED', path };
  }

  if (value === null || typeof value === 'boolean') return { ok: true, value };
  if (typeof value === 'number') {
    return Number.isFinite(value)
      ? { ok: true, value }
      : { ok: false, code: 'INVALID_JSON', path };
  }
  if (typeof value === 'string') {
    return value.length <= DEEPSEEK_HARNESS_BRIDGE_LIMITS.stringLength
      ? { ok: true, value }
      : { ok: false, code: 'LIMIT_EXCEEDED', path };
  }

  if (Array.isArray(value)) {
    if (value.length > DEEPSEEK_HARNESS_BRIDGE_LIMITS.arrayItems) {
      return { ok: false, code: 'LIMIT_EXCEEDED', path };
    }
    const items: DeepSeekHarnessBridgeJson[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const item = validateJson(value[index], `${path}[${index}]`, depth + 1, budget);
      if (!item.ok) return item;
      items.push(item.value);
    }
    return { ok: true, value: Object.freeze(items) };
  }

  if (!isRecord(value)) return { ok: false, code: 'INVALID_JSON', path };
  const entries = Object.entries(value);
  if (entries.length > DEEPSEEK_HARNESS_BRIDGE_LIMITS.objectKeys) {
    return { ok: false, code: 'LIMIT_EXCEEDED', path };
  }

  const normalized: Record<string, DeepSeekHarnessBridgeJson> = Object.create(null);
  for (const [key, nested] of entries) {
    if (!SAFE_JSON_KEY.test(key)) {
      return { ok: false, code: 'INVALID_JSON', path: `${path}.${key}` };
    }
    const parsed = validateJson(nested, `${path}.${key}`, depth + 1, budget);
    if (!parsed.ok) return parsed;
    normalized[key] = parsed.value;
  }
  return { ok: true, value: Object.freeze(normalized) };
}

function encodedSize(value: unknown): number | null {
  try {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
  } catch {
    return null;
  }
}

export function deriveDeepSeekHarnessSessionId(
  sessionId: string,
  role: DeepSeekHarnessAgentRole,
): string {
  if (!safeId(sessionId)) throw new TypeError('invalid Vexryzer session id');
  if (role !== 'seller' && role !== 'critic') throw new TypeError('invalid Harness role');
  const digest = createHash('sha256')
    .update('vexryzer-deepseek-harness-session-v1\0', 'utf8')
    .update(role, 'utf8')
    .update('\0', 'utf8')
    .update(sessionId, 'utf8')
    .digest('hex')
    .slice(0, 40);
  return `vxa-${role}-${digest}`;
}

export function validateDeepSeekHarnessBridgeRequest(
  value: unknown,
): DeepSeekHarnessBridgeRequestValidation {
  if (!isRecord(value) || !hasExactKeys(value, REQUEST_KEYS)) {
    return { ok: false, code: 'INVALID_SHAPE', path: 'request' };
  }
  if (value['schemaVersion'] !== 1) return { ok: false, code: 'INVALID_SHAPE', path: 'request.schemaVersion' };

  for (const field of ['bridgeRequestId', 'sessionId', 'leaseId', 'requestId'] as const) {
    if (!safeId(value[field])) return { ok: false, code: 'INVALID_ID', path: `request.${field}` };
  }

  const role = value['role'];
  if (role !== 'seller' && role !== 'critic') {
    return { ok: false, code: 'INVALID_ROLE', path: 'request.role' };
  }

  const harnessSessionId = value['harnessSessionId'];
  if (!safeId(harnessSessionId)) {
    return { ok: false, code: 'INVALID_ID', path: 'request.harnessSessionId' };
  }
  if (harnessSessionId !== deriveDeepSeekHarnessSessionId(value['sessionId'], role)) {
    return { ok: false, code: 'INVALID_HARNESS_SESSION', path: 'request.harnessSessionId' };
  }

  const canonicalRevision = value['canonicalRevision'];
  if (!Number.isInteger(canonicalRevision) || canonicalRevision < 0) {
    return { ok: false, code: 'INVALID_REVISION', path: 'request.canonicalRevision' };
  }

  const toolName = value['toolName'];
  if (typeof toolName !== 'string' || !SAFE_TOOL_NAME.test(toolName) || !isDeepSeekHarnessToolAllowed(role, toolName)) {
    return { ok: false, code: 'UNAUTHORIZED_TOOL', path: 'request.toolName' };
  }

  const bytes = encodedSize(value['args']);
  if (bytes === null) return { ok: false, code: 'INVALID_JSON', path: 'request.args' };
  if (bytes > DEEPSEEK_HARNESS_BRIDGE_LIMITS.argumentBytes) {
    return { ok: false, code: 'LIMIT_EXCEEDED', path: 'request.args' };
  }

  const args = validateJson(value['args'], 'request.args', 0, { nodes: 0 });
  if (!args.ok) return args;
  if (!isRecord(args.value)) return { ok: false, code: 'INVALID_JSON', path: 'request.args' };

  const argumentKeys = TOOL_ARGUMENT_KEYS[role][toolName];
  if (argumentKeys === undefined || !hasExactKeys(args.value, argumentKeys)) {
    return { ok: false, code: 'INVALID_SHAPE', path: 'request.args' };
  }

  return {
    ok: true,
    request: Object.freeze({
      schemaVersion: 1,
      bridgeRequestId: value['bridgeRequestId'],
      sessionId: value['sessionId'],
      harnessSessionId,
      leaseId: value['leaseId'],
      requestId: value['requestId'],
      canonicalRevision,
      role,
      toolName,
      args: args.value,
    }),
  };
}

export function validateDeepSeekHarnessBridgeResponse(
  value: unknown,
): DeepSeekHarnessBridgeResponseValidation {
  if (!isRecord(value) || typeof value['ok'] !== 'boolean') {
    return { ok: false, code: 'INVALID_SHAPE', path: 'response' };
  }
  const expectedKeys = value['ok'] ? RESPONSE_SUCCESS_KEYS : RESPONSE_FAILURE_KEYS;
  if (!hasExactKeys(value, expectedKeys) || value['schemaVersion'] !== 1) {
    return { ok: false, code: 'INVALID_SHAPE', path: 'response' };
  }
  if (!safeId(value['bridgeRequestId'])) {
    return { ok: false, code: 'INVALID_ID', path: 'response.bridgeRequestId' };
  }
  if (typeof value['toolName'] !== 'string' || !SAFE_TOOL_NAME.test(value['toolName'])) {
    return { ok: false, code: 'INVALID_SHAPE', path: 'response.toolName' };
  }
  if (!Number.isInteger(value['canonicalRevision']) || value['canonicalRevision'] < 0) {
    return { ok: false, code: 'INVALID_REVISION', path: 'response.canonicalRevision' };
  }

  if (value['ok'] === false) {
    if (typeof value['code'] !== 'string' || !EXECUTION_ERROR_CODES.has(value['code'] as DeepSeekHarnessBridgeExecutionErrorCode)) {
      return { ok: false, code: 'INVALID_SHAPE', path: 'response.code' };
    }
    return { ok: true, response: Object.freeze(value as unknown as DeepSeekHarnessBridgeResponse) };
  }

  const bytes = encodedSize(value['result']);
  if (bytes === null) return { ok: false, code: 'INVALID_JSON', path: 'response.result' };
  if (bytes > DEEPSEEK_HARNESS_BRIDGE_LIMITS.resultBytes) {
    return { ok: false, code: 'LIMIT_EXCEEDED', path: 'response.result' };
  }
  const result = validateJson(value['result'], 'response.result', 0, { nodes: 0 });
  if (!result.ok) return result;

  return {
    ok: true,
    response: Object.freeze({
      schemaVersion: 1,
      bridgeRequestId: value['bridgeRequestId'],
      toolName: value['toolName'],
      ok: true,
      canonicalRevision: value['canonicalRevision'],
      result: result.value,
    }),
  };
}
