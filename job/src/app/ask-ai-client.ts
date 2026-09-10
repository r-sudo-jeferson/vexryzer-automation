import type { ReactiveExperienceState } from '../experience/reactive-experience-state.ts';

export interface AskAiVerifiedCalculation {
  id: string;
  resultValue: number;
  resultUnit: string;
  status: 'valid' | 'invalidated';
}

export interface AskAiPublicState {
  sessionId: string;
  canonicalRevision: number;
  verifiedCalculations: readonly AskAiVerifiedCalculation[];
  reactiveState: Readonly<ReactiveExperienceState>;
}

export interface AskAiAcceptedResponse {
  ok: true;
  idempotent: boolean;
  mode: 'agent' | 'guided_recovery';
  narration: string;
  nextQuestion: string | null;
  state: Readonly<AskAiPublicState>;
}

export interface AskAiCorrectionAcceptedResponse {
  ok: true;
  idempotent: boolean;
  correctionId: string;
  state: Readonly<AskAiPublicState>;
}

export interface AskAiClientFailure {
  ok: false;
  code: string;
  currentRevision: number | null;
  retryable: boolean;
}

export type AskAiClientResult = Readonly<AskAiAcceptedResponse> | Readonly<AskAiClientFailure>;
export type AskAiCorrectionResult = Readonly<AskAiCorrectionAcceptedResponse> | Readonly<AskAiClientFailure>;

export interface AskAiClient {
  submit(text: string): Promise<AskAiClientResult>;
  applyCorrection(correctionId: string): Promise<AskAiCorrectionResult>;
  reset(): void;
  hasSession(): boolean;
}

export interface AskAiClientOptions {
  fetchImpl?: typeof fetch;
  createRequestId?: () => string;
}

interface ClientSession {
  sessionId: string;
  sessionToken: string;
  revision: number;
}

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TOKEN = /^[A-Za-z0-9_-]{32,128}$/;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validSessionStart(value: unknown): value is {
  ok: true;
  sessionId: string;
  sessionToken: string;
  revision: number;
} {
  if (!record(value)) return false;
  return value['ok'] === true
    && typeof value['sessionId'] === 'string'
    && SAFE_ID.test(value['sessionId'])
    && value['sessionId'].length <= 96
    && typeof value['sessionToken'] === 'string'
    && TOKEN.test(value['sessionToken'])
    && Number.isInteger(value['revision'])
    && Number(value['revision']) >= 0;
}

function validReactiveShape(value: unknown): value is ReactiveExperienceState {
  if (!record(value)) return false;
  return value['schemaVersion'] === 1
    && Number.isInteger(value['basedOnRevision'])
    && Number(value['basedOnRevision']) >= 0
    && Number.isInteger(value['projectionRevision'])
    && Number(value['projectionRevision']) >= 0
    && Array.isArray(value['actions'])
    && Array.isArray(value['processMutations'])
    && Array.isArray(value['correctionSuggestions'])
    && Array.isArray(value['artifacts'])
    && record(value['scene'])
    && record(value['choreography'])
    && Array.isArray(value['recentSemanticKeys']);
}

function validCalculations(value: unknown): value is AskAiVerifiedCalculation[] {
  return Array.isArray(value) && value.every((item) => record(item)
    && typeof item['id'] === 'string'
    && SAFE_ID.test(item['id'])
    && typeof item['resultValue'] === 'number'
    && Number.isFinite(item['resultValue'])
    && typeof item['resultUnit'] === 'string'
    && item['resultUnit'].length >= 1
    && item['resultUnit'].length <= 64
    && (item['status'] === 'valid' || item['status'] === 'invalidated'));
}

function validPublicState(value: unknown): value is AskAiPublicState {
  if (!record(value)) return false;
  return typeof value['sessionId'] === 'string'
    && SAFE_ID.test(value['sessionId'])
    && Number.isInteger(value['canonicalRevision'])
    && Number(value['canonicalRevision']) >= 0
    && validCalculations(value['verifiedCalculations'])
    && validReactiveShape(value['reactiveState']);
}

function validAccepted(value: unknown): value is AskAiAcceptedResponse {
  return record(value)
    && value['ok'] === true
    && typeof value['idempotent'] === 'boolean'
    && (value['mode'] === 'agent' || value['mode'] === 'guided_recovery')
    && typeof value['narration'] === 'string'
    && (value['nextQuestion'] === null || typeof value['nextQuestion'] === 'string')
    && validPublicState(value['state']);
}

function validCorrectionAccepted(value: unknown): value is AskAiCorrectionAcceptedResponse {
  return record(value)
    && value['ok'] === true
    && typeof value['idempotent'] === 'boolean'
    && typeof value['correctionId'] === 'string'
    && SAFE_ID.test(value['correctionId'])
    && validPublicState(value['state']);
}

function parseFailure(value: unknown, status: number): AskAiClientFailure {
  const code = record(value) && typeof value['code'] === 'string'
    ? value['code']
    : 'INVALID_SERVER_RESPONSE';
  const currentRevision = record(value)
    && Number.isInteger(value['currentRevision'])
    && Number(value['currentRevision']) >= 0
    ? Number(value['currentRevision'])
    : null;
  const retryable = status >= 500
    || code === 'SESSION_BUSY'
    || code === 'STORE_UNAVAILABLE'
    || code === 'AGENT_EXECUTION_FAILED';
  return Object.freeze({ ok: false, code, currentRevision, retryable });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json() as unknown;
  } catch {
    return null;
  }
}

export function createAskAiClient(options: AskAiClientOptions = {}): AskAiClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const createRequestId = options.createRequestId ?? (() => crypto.randomUUID());
  let session: ClientSession | null = null;

  async function startSession(): Promise<AskAiClientFailure | null> {
    let response: Response;
    try {
      response = await fetchImpl('/api/ask-ai/session', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
    } catch {
      return Object.freeze({
        ok: false,
        code: 'NETWORK_UNAVAILABLE',
        currentRevision: null,
        retryable: true,
      });
    }
    const payload = await readJson(response);
    if (!response.ok || !validSessionStart(payload)) {
      return parseFailure(payload, response.status);
    }
    session = {
      sessionId: payload.sessionId,
      sessionToken: payload.sessionToken,
      revision: payload.revision,
    };
    return null;
  }

  return Object.freeze({
    async submit(rawText: string): Promise<AskAiClientResult> {
      const text = rawText.trim();
      if (text.length < 1 || text.length > 4_000) {
        return Object.freeze({
          ok: false,
          code: 'INVALID_INPUT',
          currentRevision: session?.revision ?? null,
          retryable: false,
        });
      }

      if (session === null) {
        const failure = await startSession();
        if (failure !== null) return failure;
      }
      const active = session!;
      const requestId = createRequestId();
      if (!SAFE_ID.test(requestId) || requestId.length > 80) {
        return Object.freeze({
          ok: false,
          code: 'INVALID_CLIENT_REQUEST_ID',
          currentRevision: active.revision,
          retryable: false,
        });
      }

      let response: Response;
      try {
        response = await fetchImpl('/api/ask-ai', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${active.sessionToken}`,
          },
          body: JSON.stringify({
            sessionId: active.sessionId,
            requestId,
            expectedRevision: active.revision,
            text,
          }),
        });
      } catch {
        return Object.freeze({
          ok: false,
          code: 'NETWORK_UNAVAILABLE',
          currentRevision: active.revision,
          retryable: true,
        });
      }

      const payload = await readJson(response);
      if (response.ok && validAccepted(payload)) {
        if (payload.state.sessionId !== active.sessionId) {
          session = null;
          return Object.freeze({
            ok: false,
            code: 'SESSION_ID_MISMATCH',
            currentRevision: null,
            retryable: false,
          });
        }
        active.revision = payload.state.canonicalRevision;
        return Object.freeze(payload);
      }

      const failure = parseFailure(payload, response.status);
      if (failure.currentRevision !== null && failure.code === 'AGENT_EXECUTION_FAILED') {
        active.revision = failure.currentRevision;
      }
      if (['UNAUTHORIZED', 'NOT_FOUND', 'STALE_REVISION', 'SESSION_CONFLICT', 'REQUEST_REPLAY'].includes(failure.code)) {
        session = null;
      }
      return failure;
    },

    async applyCorrection(correctionId: string): Promise<AskAiCorrectionResult> {
      if (!SAFE_ID.test(correctionId) || correctionId.length > 96) {
        return Object.freeze({
          ok: false,
          code: 'INVALID_CORRECTION_ID',
          currentRevision: session?.revision ?? null,
          retryable: false,
        });
      }
      if (session === null) {
        return Object.freeze({
          ok: false,
          code: 'NO_ACTIVE_SESSION',
          currentRevision: null,
          retryable: false,
        });
      }

      const active = session;
      const requestId = createRequestId();
      if (!SAFE_ID.test(requestId) || requestId.length > 80) {
        return Object.freeze({
          ok: false,
          code: 'INVALID_CLIENT_REQUEST_ID',
          currentRevision: active.revision,
          retryable: false,
        });
      }

      let response: Response;
      try {
        response = await fetchImpl('/api/ask-ai/correction', {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            Authorization: `Bearer ${active.sessionToken}`,
          },
          body: JSON.stringify({
            sessionId: active.sessionId,
            requestId,
            expectedRevision: active.revision,
            correctionId,
          }),
        });
      } catch {
        return Object.freeze({
          ok: false,
          code: 'NETWORK_UNAVAILABLE',
          currentRevision: active.revision,
          retryable: true,
        });
      }

      const payload = await readJson(response);
      if (response.ok && validCorrectionAccepted(payload)) {
        if (payload.state.sessionId !== active.sessionId || payload.correctionId !== correctionId) {
          session = null;
          return Object.freeze({
            ok: false,
            code: 'SESSION_ID_MISMATCH',
            currentRevision: null,
            retryable: false,
          });
        }
        active.revision = payload.state.canonicalRevision;
        return Object.freeze(payload);
      }

      const failure = parseFailure(payload, response.status);
      if (['UNAUTHORIZED', 'NOT_FOUND', 'STALE_REVISION', 'SESSION_CONFLICT', 'REQUEST_REPLAY'].includes(failure.code)) {
        session = null;
      }
      return failure;
    },

    reset() {
      session = null;
    },

    hasSession() {
      return session !== null;
    },
  });
}
