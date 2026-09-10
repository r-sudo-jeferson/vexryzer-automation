import type { AgentSessionEntropy } from './agent-session.ts';
import type { AgentSessionRepository } from './session-repository.ts';
import {
  runStoredAgentTurn,
  startStoredAgentSession,
  type AgentRuntimeStaticConfig,
  type StoredAgentTurnResult,
} from './stored-agent-turn-service.ts';

export interface AskAiHttpDependencies {
  repository: AgentSessionRepository;
  runtime: Readonly<AgentRuntimeStaticConfig>;
  entropy?: Readonly<AgentSessionEntropy>;
}

const MAX_BODY_BYTES = 16_384;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,128}$/;
const JSON_CONTENT_TYPE = /^application\/json(?:\s*;|$)/i;
const CLOSED_TURN_KEYS = new Set(['sessionId', 'requestId', 'expectedRevision', 'text']);

function json(body: unknown, status = 200, extraHeaders: HeadersInit = {}): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(JSON.stringify(body), { status, headers });
}

function methodNotAllowed(): Response {
  return json({ ok: false, code: 'METHOD_NOT_ALLOWED' }, 405, { Allow: 'POST' });
}

function requestOriginAllowed(request: Request): boolean {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (origin === null) return true;
  try {
    return origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function hasJsonContentType(request: Request): boolean {
  return JSON_CONTENT_TYPE.test(request.headers.get('content-type') ?? '');
}

async function boundedJson(request: Request): Promise<
  | { ok: true; value: unknown }
  | { ok: false; response: Response }
> {
  const declared = request.headers.get('content-length');
  if (declared !== null) {
    const size = Number(declared);
    if (!Number.isSafeInteger(size) || size < 0) {
      return { ok: false, response: json({ ok: false, code: 'INVALID_CONTENT_LENGTH' }, 400) };
    }
    if (size > MAX_BODY_BYTES) {
      return { ok: false, response: json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413) };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false, response: json({ ok: false, code: 'INVALID_BODY' }, 400) };
  }
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    return { ok: false, response: json({ ok: false, code: 'PAYLOAD_TOO_LARGE' }, 413) };
  }
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, response: json({ ok: false, code: 'INVALID_JSON' }, 400) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseBearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  if (authorization === null) return null;
  const match = /^Bearer ([A-Za-z0-9_-]{32,128})$/.exec(authorization);
  return match?.[1] ?? null;
}

function mapTurnFailure(result: Exclude<StoredAgentTurnResult, { ok: true }>): Response {
  switch (result.code) {
    case 'INVALID_REQUEST':
      return json({ ok: false, code: result.code }, 400);
    case 'UNAUTHORIZED':
      return json({ ok: false, code: result.code }, 401, {
        'WWW-Authenticate': 'Bearer realm="vexryzer-ask-ai"',
      });
    case 'NOT_FOUND':
      return json({ ok: false, code: result.code }, 404);
    case 'REQUEST_REPLAY':
    case 'STALE_REVISION':
    case 'SESSION_CONFLICT':
      return json({
        ok: false,
        code: result.code,
        currentRevision: result.currentRevision,
      }, 409);
    case 'SESSION_BUSY':
      return json({
        ok: false,
        code: result.code,
        currentRevision: result.currentRevision,
      }, 409, { 'Retry-After': '1' });
    case 'STORE_UNAVAILABLE':
      return json({ ok: false, code: result.code }, 503, { 'Retry-After': '2' });
    case 'AGENT_EXECUTION_FAILED':
      return json({
        ok: false,
        code: result.code,
        currentRevision: result.currentRevision,
      }, 502);
  }
}

export async function handleAskAiSessionStart(
  request: Request,
  dependencies: Readonly<AskAiHttpDependencies>,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed();
  if (!requestOriginAllowed(request)) return json({ ok: false, code: 'CROSS_SITE_REQUEST_REJECTED' }, 403);

  const result = await startStoredAgentSession({
    repository: dependencies.repository,
    entropy: dependencies.entropy,
  });
  if (!result.ok) {
    return json({ ok: false, code: result.code }, 503, { 'Retry-After': '2' });
  }
  return json({
    ok: true,
    sessionId: result.sessionId,
    sessionToken: result.sessionToken,
    revision: result.revision,
  }, 201);
}

export async function handleAskAiTurn(
  request: Request,
  dependencies: Readonly<AskAiHttpDependencies>,
): Promise<Response> {
  if (request.method !== 'POST') return methodNotAllowed();
  if (!requestOriginAllowed(request)) return json({ ok: false, code: 'CROSS_SITE_REQUEST_REJECTED' }, 403);
  if (!hasJsonContentType(request)) return json({ ok: false, code: 'UNSUPPORTED_MEDIA_TYPE' }, 415);

  const sessionToken = parseBearerToken(request);
  if (sessionToken === null || !TOKEN_PATTERN.test(sessionToken)) {
    return json({ ok: false, code: 'UNAUTHORIZED' }, 401, {
      'WWW-Authenticate': 'Bearer realm="vexryzer-ask-ai"',
    });
  }

  const parsed = await boundedJson(request);
  if (!parsed.ok) return parsed.response;
  if (!isRecord(parsed.value)
    || Object.keys(parsed.value).some((key) => !CLOSED_TURN_KEYS.has(key))
    || ![...CLOSED_TURN_KEYS].every((key) => Object.hasOwn(parsed.value as object, key))) {
    return json({ ok: false, code: 'INVALID_REQUEST' }, 400);
  }

  const { sessionId, requestId, expectedRevision, text } = parsed.value;
  if (
    typeof sessionId !== 'string'
    || typeof requestId !== 'string'
    || typeof expectedRevision !== 'number'
    || typeof text !== 'string'
  ) {
    return json({ ok: false, code: 'INVALID_REQUEST' }, 400);
  }

  const result = await runStoredAgentTurn({
    repository: dependencies.repository,
    runtime: dependencies.runtime,
    request: {
      sessionId,
      sessionToken,
      requestId,
      expectedRevision,
      text,
    },
  });

  if (!result.ok) return mapTurnFailure(result);
  return json({
    ok: true,
    idempotent: result.idempotent,
    mode: result.mode,
    narration: result.narration,
    nextQuestion: result.nextQuestion,
    state: result.state,
  });
}
