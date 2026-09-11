import {
  freezeObservation,
  type CanonicalSalesContext,
  type QuantitativeObservation,
  type QuantitativePeriod,
  type QuantitativeUnit,
} from './canonical-sales-context.ts';

export const USER_OBSERVATION_KINDS = [
  'people_count',
  'minutes_per_person_per_day',
  'working_days_per_month',
  'occurrences_per_month',
  'minutes_per_occurrence',
  'monthly_hours',
  'hourly_cost',
  'monthly_client_volume',
  'monthly_document_volume',
  'monthly_entry_volume',
  'monthly_occurrence_volume',
  'rework_rate_percent',
] as const;

export type UserObservationKind = (typeof USER_OBSERVATION_KINDS)[number];

export interface QuotedUserObservationRequest {
  id: string;
  kind: UserObservationKind;
  baseRevision: number;
  turnId: string;
  quote: string;
  value: number;
}

export type UserObservationCaptureErrorCode =
  | 'STALE_REVISION'
  | 'NO_AUTHORITATIVE_USER_TURN'
  | 'TURN_MISMATCH'
  | 'QUOTE_NOT_FOUND'
  | 'VALUE_NOT_IN_QUOTE'
  | 'SEMANTIC_MARKER_MISMATCH'
  | 'INVALID_REQUEST'
  | 'DUPLICATE_ID'
  | 'LIMIT_EXCEEDED';

export type UserObservationCaptureResult =
  | { ok: true; observations: readonly Readonly<QuantitativeObservation>[] }
  | { ok: false; code: UserObservationCaptureErrorCode; requestId: string | null };

interface ObservationSemantics {
  metric: string;
  unit: QuantitativeUnit;
  period: QuantitativePeriod;
  requiredMarkers: readonly RegExp[];
  integer: boolean;
  maxValue: number | null;
}

const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_REQUESTS = 8;
const MAX_QUOTE_LENGTH = 500;
const NUMBER_TOKEN = /[-+]?\d[\d.,]*/g;

const MARKERS = Object.freeze({
  person: /\b(?:pessoa|pessoas|colaborador|colaboradores|funcionario|funcionarios|funcionaria|funcionarias)\b/i,
  minute: /\b(?:min|minuto|minutos)\b/i,
  day: /\b(?:dia|dias|diario|diaria|diarios|diarias)\b/i,
  month: /\b(?:mes|meses|mensal|mensais)\b/i,
  occurrence: /\b(?:ocorrencia|ocorrencias|vez|vezes|evento|eventos)\b/i,
  hour: /\b(?:h|hora|horas)\b/i,
  currency: /(?:r\$|\breal\b|\breais\b)/i,
  client: /\b(?:cliente|clientes)\b/i,
  document: /\b(?:documento|documentos)\b/i,
  entry: /\b(?:lancamento|lancamentos|registro|registros)\b/i,
  percent: /(?:%|\bpor cento\b)/i,
});

function normalizedText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

const SEMANTICS: Readonly<Record<UserObservationKind, Readonly<ObservationSemantics>>> = Object.freeze({
  people_count: Object.freeze({
    metric: 'pessoas envolvidas',
    unit: 'person',
    period: null,
    requiredMarkers: Object.freeze([MARKERS.person]),
    integer: true,
    maxValue: null,
  }),
  minutes_per_person_per_day: Object.freeze({
    metric: 'minutos por pessoa por dia',
    unit: 'minute',
    period: 'day',
    requiredMarkers: Object.freeze([MARKERS.minute, MARKERS.person, MARKERS.day]),
    integer: false,
    maxValue: null,
  }),
  working_days_per_month: Object.freeze({
    metric: 'dias de trabalho por mês',
    unit: 'day',
    period: 'month',
    requiredMarkers: Object.freeze([MARKERS.day, MARKERS.month]),
    integer: true,
    maxValue: 31,
  }),
  occurrences_per_month: Object.freeze({
    metric: 'ocorrências por mês',
    unit: 'occurrence',
    period: 'month',
    requiredMarkers: Object.freeze([MARKERS.occurrence, MARKERS.month]),
    integer: true,
    maxValue: null,
  }),
  minutes_per_occurrence: Object.freeze({
    metric: 'minutos por ocorrência',
    unit: 'minute',
    period: 'event',
    requiredMarkers: Object.freeze([MARKERS.minute, MARKERS.occurrence]),
    integer: false,
    maxValue: null,
  }),
  monthly_hours: Object.freeze({
    metric: 'horas por mês',
    unit: 'hour',
    period: 'month',
    requiredMarkers: Object.freeze([MARKERS.hour, MARKERS.month]),
    integer: false,
    maxValue: null,
  }),
  hourly_cost: Object.freeze({
    metric: 'custo por hora informado',
    unit: 'currency',
    period: 'hour',
    requiredMarkers: Object.freeze([MARKERS.currency, MARKERS.hour]),
    integer: false,
    maxValue: null,
  }),
  monthly_client_volume: Object.freeze({
    metric: 'clientes por mês',
    unit: 'client',
    period: 'month',
    requiredMarkers: Object.freeze([MARKERS.client, MARKERS.month]),
    integer: true,
    maxValue: null,
  }),
  monthly_document_volume: Object.freeze({
    metric: 'documentos por mês',
    unit: 'document',
    period: 'month',
    requiredMarkers: Object.freeze([MARKERS.document, MARKERS.month]),
    integer: true,
    maxValue: null,
  }),
  monthly_entry_volume: Object.freeze({
    metric: 'lançamentos por mês',
    unit: 'entry',
    period: 'month',
    requiredMarkers: Object.freeze([MARKERS.entry, MARKERS.month]),
    integer: true,
    maxValue: null,
  }),
  monthly_occurrence_volume: Object.freeze({
    metric: 'ocorrências por mês',
    unit: 'occurrence',
    period: 'month',
    requiredMarkers: Object.freeze([MARKERS.occurrence, MARKERS.month]),
    integer: true,
    maxValue: null,
  }),
  rework_rate_percent: Object.freeze({
    metric: 'percentual de retrabalho',
    unit: 'percent',
    period: null,
    requiredMarkers: Object.freeze([MARKERS.percent]),
    integer: false,
    maxValue: 100,
  }),
});

function parseLocalizedNumber(raw: string): number | null {
  const token = raw.replace(/[.,]+$/, '');
  if (!token) return null;
  const sign = token.startsWith('-') ? -1 : 1;
  const unsigned = token.replace(/^[-+]/, '');
  if (!unsigned) return null;

  let normalized = unsigned;
  const comma = unsigned.lastIndexOf(',');
  const dot = unsigned.lastIndexOf('.');
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.';
    const thousands = decimal === ',' ? /\./g : /,/g;
    normalized = unsigned.replace(thousands, '').replace(decimal, '.');
  } else if (comma >= 0) {
    normalized = unsigned.replace(/\./g, '').replace(',', '.');
  } else if (dot >= 0) {
    const groups = unsigned.split('.');
    normalized = groups.length > 1
      && groups.slice(1).every((group) => group.length === 3)
      ? groups.join('')
      : unsigned;
  }

  const parsed = Number(normalized) * sign;
  return Number.isFinite(parsed) ? parsed : null;
}

function quoteContainsValue(quote: string, value: number): boolean {
  const tokens = quote.match(NUMBER_TOKEN) ?? [];
  return tokens.some((token) => {
    const parsed = parseLocalizedNumber(token);
    return parsed !== null && Object.is(parsed, value);
  });
}

export function hasExplicitUserObservationCandidate(text: string): boolean {
  if (typeof text !== 'string' || text.trim().length === 0) return false;
  const numericTokens = text.match(NUMBER_TOKEN) ?? [];
  const hasNonNegativeNumber = numericTokens.some((token) => {
    const parsed = parseLocalizedNumber(token);
    return parsed !== null && parsed >= 0;
  });
  if (!hasNonNegativeNumber) return false;

  const normalized = normalizedText(text);
  return USER_OBSERVATION_KINDS.some((kind) => (
    SEMANTICS[kind].requiredMarkers.every((pattern) => pattern.test(normalized))
  ));
}

function validId(value: string): boolean {
  return value.length >= 1 && value.length <= 96 && SAFE_ID.test(value);
}

function captureOne(
  canonical: CanonicalSalesContext,
  request: Readonly<QuotedUserObservationRequest>,
): UserObservationCaptureResult {
  if (!validId(request.id) || !validId(request.turnId)
    || !(USER_OBSERVATION_KINDS as readonly string[]).includes(request.kind)
    || !Number.isInteger(request.baseRevision) || request.baseRevision < 0
    || !Number.isFinite(request.value) || request.value < 0
    || typeof request.quote !== 'string') {
    return { ok: false, code: 'INVALID_REQUEST', requestId: request.id ?? null };
  }
  if (request.baseRevision !== canonical.revision) {
    return { ok: false, code: 'STALE_REVISION', requestId: request.id };
  }
  const authoritative = canonical.latestUserIntent;
  if (authoritative === null) {
    return { ok: false, code: 'NO_AUTHORITATIVE_USER_TURN', requestId: request.id };
  }
  if (request.turnId !== authoritative.turnId) {
    return { ok: false, code: 'TURN_MISMATCH', requestId: request.id };
  }

  const quote = request.quote.trim();
  const quoteOccursInAuthoritativeTurn = authoritative.text
    .toLocaleLowerCase('pt-BR')
    .includes(quote.toLocaleLowerCase('pt-BR'));
  if (!quote || quote.length > MAX_QUOTE_LENGTH || !quoteOccursInAuthoritativeTurn) {
    return { ok: false, code: 'QUOTE_NOT_FOUND', requestId: request.id };
  }
  if (!quoteContainsValue(quote, request.value)) {
    return { ok: false, code: 'VALUE_NOT_IN_QUOTE', requestId: request.id };
  }

  const semantics = SEMANTICS[request.kind];
  const normalizedQuote = normalizedText(quote);
  if (!semantics.requiredMarkers.every((pattern) => pattern.test(normalizedQuote))) {
    return { ok: false, code: 'SEMANTIC_MARKER_MISMATCH', requestId: request.id };
  }
  if (semantics.integer && !Number.isInteger(request.value)) {
    return { ok: false, code: 'INVALID_REQUEST', requestId: request.id };
  }
  if (semantics.maxValue !== null && request.value > semantics.maxValue) {
    return { ok: false, code: 'INVALID_REQUEST', requestId: request.id };
  }

  return {
    ok: true,
    observations: Object.freeze([freezeObservation({
      id: request.id,
      metric: semantics.metric,
      value: request.value,
      unit: semantics.unit,
      period: semantics.period,
      status: 'confirmed',
      source: 'user',
      supportingTurnIds: Object.freeze([request.turnId]),
      confirmedByTurnId: request.turnId,
    })]),
  };
}

export function captureQuotedUserObservations(
  canonical: CanonicalSalesContext,
  requests: readonly Readonly<QuotedUserObservationRequest>[],
): UserObservationCaptureResult {
  if (!Array.isArray(requests) || requests.length < 1 || requests.length > MAX_REQUESTS) {
    return { ok: false, code: 'LIMIT_EXCEEDED', requestId: null };
  }

  const ids = new Set<string>();
  const observations: Readonly<QuantitativeObservation>[] = [];
  for (const request of requests) {
    if (ids.has(request.id)) return { ok: false, code: 'DUPLICATE_ID', requestId: request.id };
    ids.add(request.id);
    const captured = captureOne(canonical, request);
    if (!captured.ok) return captured;
    observations.push(captured.observations[0]!);
  }
  return { ok: true, observations: Object.freeze(observations) };
}
