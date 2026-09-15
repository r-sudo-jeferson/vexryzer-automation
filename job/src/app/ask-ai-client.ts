import { isValidExperienceAction } from '../experience/agent-intent.ts';
import { ARTIFACT_KINDS, type ArtifactKind } from '../experience/artifact-intent.ts';
import { resolveArtifactSurface } from '../experience/artifact-registry.ts';
import {
  isValidArtifactProposal,
  isValidCorrectionProposal,
  isValidExperienceSceneProposal,
  isValidProcessMutationProposal,
} from '../experience/experience-validation.ts';
import {
  REACTIVE_EXPERIENCE_LIMITS,
  type ReactiveExperienceState,
} from '../experience/reactive-experience-state.ts';

export interface AskAiVerifiedCalculation {
  id: string;
  resultValue: number;
  resultUnit: string;
  status: 'valid';
  expression: string;
  computedBy: 'application';
  basedOnRevision: number;
  inputObservationIds: readonly string[];
}

export interface AskAiPublicOpportunity {
  id: string;
  kind: 'monthly_capacity' | 'monthly_workload' | 'monthly_cost' | 'rework_volume' | 'other';
  summary: string;
  evidenceIds: readonly string[];
  missingInputs: readonly string[];
  status: 'surfaced' | 'active';
}

export interface AskAiPublicEvidenceRef {
  id: string;
  kind: 'fact' | 'observation';
  source: 'user' | 'inference' | 'system';
  status: 'proposed' | 'confirmed' | 'conflicted';
}

export interface AskAiPublicState {
  sessionId: string;
  canonicalRevision: number;
  verifiedCalculations: readonly AskAiVerifiedCalculation[];
  opportunities: readonly AskAiPublicOpportunity[];
  evidence: readonly AskAiPublicEvidenceRef[];
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

const REACTIVE_KEYS = new Set([
  'schemaVersion',
  'basedOnRevision',
  'projectionRevision',
  'actions',
  'processMutations',
  'correctionSuggestions',
  'artifacts',
  'scene',
  'choreography',
  'recentSemanticKeys',
]);
const PROJECTED_ACTION_KEYS = new Set(['sourceActionId', 'action', 'status', 'invalidatedReason']);
const PROJECTED_MUTATION_KEYS = new Set(['sourceMutationId', 'mutation']);
const PROJECTED_CORRECTION_KEYS = new Set(['sourceCorrectionId', 'correction', 'status', 'invalidatedReason']);
const PROJECTED_ARTIFACT_KEYS = new Set([
  'id',
  'kind',
  'title',
  'summary',
  'evidenceIds',
  'status',
  'truthStatus',
  'invalidatedReason',
  'surfaceId',
  'landmarkLabel',
]);
const CHOREOGRAPHY_KEYS = new Set(['generation', 'intentKey', 'cameraTargetIds', 'interrupted']);

function validProjectedAction(value: unknown): boolean {
  if (!record(value) || !hasOnlyKeys(value, PROJECTED_ACTION_KEYS)) return false;
  if (typeof value['sourceActionId'] !== 'string' || !SAFE_ID.test(value['sourceActionId'])) return false;
  if (!isValidExperienceAction(value['action'])) return false;
  if (value['sourceActionId'] !== value['action'].id) return false;
  if (value['status'] === 'active') return value['invalidatedReason'] === null;
  return value['status'] === 'invalidated'
    && (value['invalidatedReason'] === 'canonical-calculation-invalidated'
      || value['invalidatedReason'] === 'canonical-evidence-invalidated');
}

function validProjectedMutation(value: unknown): boolean {
  if (!record(value) || !hasOnlyKeys(value, PROJECTED_MUTATION_KEYS)) return false;
  if (typeof value['sourceMutationId'] !== 'string' || !SAFE_ID.test(value['sourceMutationId'])) return false;
  return isValidProcessMutationProposal(value['mutation'])
    && value['sourceMutationId'] === value['mutation'].id;
}

function validProjectedCorrection(value: unknown): boolean {
  if (!record(value) || !hasOnlyKeys(value, PROJECTED_CORRECTION_KEYS)) return false;
  if (typeof value['sourceCorrectionId'] !== 'string' || !SAFE_ID.test(value['sourceCorrectionId'])) return false;
  if (!isValidCorrectionProposal(value['correction']) || value['sourceCorrectionId'] !== value['correction'].id) return false;
  if (value['status'] === 'pending') return value['invalidatedReason'] === null;
  return value['status'] === 'invalidated' && value['invalidatedReason'] === 'canonical-evidence-invalidated';
}

function validProjectedArtifact(value: unknown): boolean {
  if (!record(value) || !hasOnlyKeys(value, PROJECTED_ARTIFACT_KEYS)) return false;
  const kind = value['kind'];
  if (!(ARTIFACT_KINDS as readonly unknown[]).includes(kind)) return false;
  if (!isValidArtifactProposal({
    id: value['id'],
    kind,
    title: value['title'],
    summary: value['summary'],
    evidenceIds: value['evidenceIds'],
    status: value['status'],
  })) return false;
  const surface = resolveArtifactSurface(kind as ArtifactKind);
  if (value['surfaceId'] !== surface.surfaceId || value['landmarkLabel'] !== surface.landmarkLabel) return false;
  if (value['truthStatus'] === 'active') return value['invalidatedReason'] === null;
  return value['truthStatus'] === 'invalidated' && value['invalidatedReason'] === 'canonical-evidence-invalidated';
}

function validReactiveShape(value: unknown): value is ReactiveExperienceState {
  if (!record(value) || !hasOnlyKeys(value, REACTIVE_KEYS)) return false;
  const actions = value['actions'];
  const processMutations = value['processMutations'];
  const correctionSuggestions = value['correctionSuggestions'];
  const artifacts = value['artifacts'];
  const recentSemanticKeys = value['recentSemanticKeys'];
  const choreography = value['choreography'];
  if (!Array.isArray(actions) || actions.length > REACTIVE_EXPERIENCE_LIMITS.actions || !actions.every(validProjectedAction)) return false;
  if (!Array.isArray(processMutations) || processMutations.length > REACTIVE_EXPERIENCE_LIMITS.processMutations || !processMutations.every(validProjectedMutation)) return false;
  if (!Array.isArray(correctionSuggestions) || correctionSuggestions.length > REACTIVE_EXPERIENCE_LIMITS.correctionSuggestions || !correctionSuggestions.every(validProjectedCorrection)) return false;
  if (!Array.isArray(artifacts) || artifacts.length > REACTIVE_EXPERIENCE_LIMITS.artifacts || !artifacts.every(validProjectedArtifact)) return false;
  if (!isValidExperienceSceneProposal(value['scene'])) return false;
  if (!record(choreography) || !hasOnlyKeys(choreography, CHOREOGRAPHY_KEYS)) return false;
  if (!Number.isInteger(choreography['generation']) || Number(choreography['generation']) < 0) return false;
  if (choreography['intentKey'] !== null
    && (typeof choreography['intentKey'] !== 'string' || choreography['intentKey'].length > 2000)) return false;
  if (!safeIdList(choreography['cameraTargetIds'], 16) || typeof choreography['interrupted'] !== 'boolean') return false;
  if (!Array.isArray(recentSemanticKeys)
    || recentSemanticKeys.length > REACTIVE_EXPERIENCE_LIMITS.recentSemanticKeys
    || !recentSemanticKeys.every((item) => typeof item === 'string' && item.length >= 1 && item.length <= 2000)) return false;
  return value['schemaVersion'] === 1
    && Number.isInteger(value['basedOnRevision'])
    && Number(value['basedOnRevision']) >= 0
    && Number.isInteger(value['projectionRevision'])
    && Number(value['projectionRevision']) >= 0;
}

const OPPORTUNITY_KINDS = new Set(['monthly_capacity', 'monthly_workload', 'monthly_cost', 'rework_volume', 'other']);
const OPPORTUNITY_STATUSES = new Set(['surfaced', 'active']);
const CALCULATION_KEYS = new Set(['id', 'resultValue', 'resultUnit', 'status', 'expression', 'computedBy', 'basedOnRevision', 'inputObservationIds']);
const OPPORTUNITY_KEYS = new Set(['id', 'kind', 'summary', 'evidenceIds', 'missingInputs', 'status']);
const EVIDENCE_KEYS = new Set(['id', 'kind', 'source', 'status']);
const EVIDENCE_KINDS = new Set(['fact', 'observation']);
const EVIDENCE_SOURCES = new Set(['user', 'inference', 'system']);
const EVIDENCE_STATUSES = new Set(['proposed', 'confirmed', 'conflicted']);
const PUBLIC_STATE_KEYS = new Set([
  'sessionId',
  'canonicalRevision',
  'verifiedCalculations',
  'opportunities',
  'evidence',
  'reactiveState',
]);

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key))
    && Object.keys(value).length === allowed.size;
}

function safeIdList(value: unknown, max: number): value is readonly string[] {
  return Array.isArray(value)
    && value.length <= max
    && value.every((item) => typeof item === 'string' && item.length <= 96 && SAFE_ID.test(item))
    && new Set(value).size === value.length;
}

function boundedTextList(value: unknown, maxItems: number, maxLength: number): value is readonly string[] {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => typeof item === 'string' && item.trim().length >= 1 && item.length <= maxLength)
    && new Set(value.map((item) => (item as string).trim())).size === value.length;
}

function validCalculations(value: unknown): value is AskAiVerifiedCalculation[] {
  return Array.isArray(value) && value.every((item) => record(item)
    && hasOnlyKeys(item, CALCULATION_KEYS)
    && typeof item['id'] === 'string'
    && SAFE_ID.test(item['id'])
    && typeof item['resultValue'] === 'number'
    && Number.isFinite(item['resultValue'])
    && typeof item['resultUnit'] === 'string'
    && item['resultUnit'].length >= 1
    && item['resultUnit'].length <= 64
    && item['status'] === 'valid'
    && typeof item['expression'] === 'string'
    && item['expression'].trim().length >= 1
    && item['expression'].length <= 500
    && item['computedBy'] === 'application'
    && Number.isInteger(item['basedOnRevision'])
    && Number(item['basedOnRevision']) >= 0
    && safeIdList(item['inputObservationIds'], 32)
    && (item['inputObservationIds'] as readonly string[]).length >= 1);
}

function validOpportunities(value: unknown): value is AskAiPublicOpportunity[] {
  return Array.isArray(value) && value.every((item) => record(item)
    && hasOnlyKeys(item, OPPORTUNITY_KEYS)
    && typeof item['id'] === 'string'
    && SAFE_ID.test(item['id'])
    && typeof item['kind'] === 'string'
    && OPPORTUNITY_KINDS.has(item['kind'])
    && typeof item['summary'] === 'string'
    && item['summary'].trim().length >= 1
    && item['summary'].length <= 1000
    && safeIdList(item['evidenceIds'], 32)
    && boundedTextList(item['missingInputs'], 12, 200)
    && typeof item['status'] === 'string'
    && OPPORTUNITY_STATUSES.has(item['status']));
}

function validEvidenceRefs(value: unknown): value is AskAiPublicEvidenceRef[] {
  return Array.isArray(value) && value.every((item) => record(item)
    && hasOnlyKeys(item, EVIDENCE_KEYS)
    && typeof item['id'] === 'string'
    && SAFE_ID.test(item['id'])
    && typeof item['kind'] === 'string'
    && EVIDENCE_KINDS.has(item['kind'])
    && typeof item['source'] === 'string'
    && EVIDENCE_SOURCES.has(item['source'])
    && typeof item['status'] === 'string'
    && EVIDENCE_STATUSES.has(item['status']));
}

function validPublicState(value: unknown): value is AskAiPublicState {
  if (!record(value) || !hasOnlyKeys(value, PUBLIC_STATE_KEYS)) return false;
  return typeof value['sessionId'] === 'string'
    && SAFE_ID.test(value['sessionId'])
    && Number.isInteger(value['canonicalRevision'])
    && Number(value['canonicalRevision']) >= 0
    && validCalculations(value['verifiedCalculations'])
    && validOpportunities(value['opportunities'])
    && validEvidenceRefs(value['evidence'])
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
