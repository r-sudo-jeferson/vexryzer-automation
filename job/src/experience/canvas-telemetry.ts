import { EXPERIENCE_ACTION_KINDS } from './agent-intent.ts';
import type { ExperienceActionKind } from './agent-intent.ts';

/**
 * WP01 baseline observability hooks: non-sensitive, typed, bounded telemetry.
 *
 * WIRING OWNERSHIP — this module defines the contract and the recorder only.
 * No validator, projector, adapter or component imports it yet (locked by the
 * WP01 characterization suite). Emission wiring belongs to later packages:
 * WP03 owns projection/stale-revision/no-op events, WP04 owns
 * rejection-taxonomy/catalog-miss events, WP05 owns camera-interruption
 * events, and WP14 consolidates the hooks into eval/performance evidence.
 * Recorders are per-session instances created by the server-side turn
 * runtime; they are never globals, never shared across sessions and never
 * client-persisted. No event carries prompts, text, secrets, attachment
 * material or protected payloads — only enumerated kinds, codes and bounded
 * numbers/booleans.
 */

export const CANVAS_TELEMETRY_EVENT_KINDS = [
  'intent-accepted',
  'intent-rejected',
  'action-projected',
  'camera-interrupted',
  'catalog-miss',
  'disclosure-denied',
  'stale-revision',
  'tool-failure',
  'agent-retry',
  'human-override',
  'recovery',
  'no-op',
] as const;
export type CanvasTelemetryEventKind = (typeof CANVAS_TELEMETRY_EVENT_KINDS)[number];

export const CANVAS_TELEMETRY_REJECTION_CODES = [
  'unknown-kind',
  'unknown-key',
  'stale-revision',
  'missing-evidence',
  'disclosure-denied',
  'catalog-miss',
  'unsafe-url',
  'a11y-violation',
  'responsive-violation',
] as const;
export type CanvasTelemetryRejectionCode = (typeof CANVAS_TELEMETRY_REJECTION_CODES)[number];

export const CANVAS_TELEMETRY_COMPOSITIONS = [
  'stable',
  'focus',
  'compare',
  'overview',
  'artifact',
] as const;
export type CanvasTelemetryComposition = (typeof CANVAS_TELEMETRY_COMPOSITIONS)[number];

export const CANVAS_TELEMETRY_LIMITS = Object.freeze({
  events: 128,
  countMax: 1_000_000,
  revisionMax: 2_147_483_647,
});

export type CanvasTelemetryEvent =
  | { kind: 'intent-accepted'; revision: number }
  | { kind: 'intent-rejected'; rejectionCode: CanvasTelemetryRejectionCode; revision?: number }
  | { kind: 'action-projected'; actionKind: ExperienceActionKind; composition?: CanvasTelemetryComposition; count?: number }
  | { kind: 'camera-interrupted'; interrupted?: boolean }
  | { kind: 'catalog-miss'; actionKind?: ExperienceActionKind; count?: number }
  | { kind: 'disclosure-denied'; revision?: number; count?: number }
  | { kind: 'stale-revision'; revision: number; count?: number }
  | { kind: 'tool-failure'; count?: number }
  | { kind: 'agent-retry'; count?: number }
  | { kind: 'human-override' }
  | { kind: 'recovery'; revision?: number }
  | { kind: 'no-op'; deduplicated?: boolean; revision?: number };

type TelemetryField =
  | 'rejectionCode'
  | 'actionKind'
  | 'composition'
  | 'count'
  | 'revision'
  | 'deduplicated'
  | 'interrupted';

interface TelemetryEventSpec {
  required: readonly TelemetryField[];
  optional: readonly TelemetryField[];
}

const EVENT_SPECS: Record<CanvasTelemetryEventKind, TelemetryEventSpec> = {
  'intent-accepted': { required: ['revision'], optional: [] },
  'intent-rejected': { required: ['rejectionCode'], optional: ['revision'] },
  'action-projected': { required: ['actionKind'], optional: ['composition', 'count'] },
  'camera-interrupted': { required: [], optional: ['interrupted'] },
  'catalog-miss': { required: [], optional: ['actionKind', 'count'] },
  'disclosure-denied': { required: [], optional: ['revision', 'count'] },
  'stale-revision': { required: ['revision'], optional: ['count'] },
  'tool-failure': { required: [], optional: ['count'] },
  'agent-retry': { required: [], optional: ['count'] },
  'human-override': { required: [], optional: [] },
  'recovery': { required: [], optional: ['revision'] },
  'no-op': { required: [], optional: ['deduplicated', 'revision'] },
};

const FORBIDDEN_TELEMETRY_KEYS = new Set([
  'prompt',
  'text',
  'label',
  'narration',
  'reason',
  'objective',
  'rationale',
  'question',
  'secret',
  'token',
  'apikey',
  'api-key',
  'attachment',
  'file',
  'document',
  'ocr',
  'embedding',
  'upload',
  'byte',
  'blob',
  'payload',
  'html',
  'css',
  'script',
  'url',
  'href',
  'src',
  'component',
  'module',
  'code',
  'value',
  'summary',
  'title',
  'quote',
  'expression',
]);

const REJECTION_CODES = new Set<string>(CANVAS_TELEMETRY_REJECTION_CODES);
const ACTION_KINDS = new Set<string>(EXPERIENCE_ACTION_KINDS);
const COMPOSITIONS = new Set<string>(CANVAS_TELEMETRY_COMPOSITIONS);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEventKind(value: unknown): value is CanvasTelemetryEventKind {
  return typeof value === 'string'
    && (CANVAS_TELEMETRY_EVENT_KINDS as readonly string[]).includes(value);
}

function isBoundedCount(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= CANVAS_TELEMETRY_LIMITS.countMax;
}

function isBoundedRevision(value: unknown): value is number {
  return typeof value === 'number'
    && Number.isInteger(value)
    && value >= 0
    && value <= CANVAS_TELEMETRY_LIMITS.revisionMax;
}

function validFieldValue(field: TelemetryField, value: unknown): boolean {
  switch (field) {
    case 'rejectionCode': return typeof value === 'string' && REJECTION_CODES.has(value);
    case 'actionKind': return typeof value === 'string' && ACTION_KINDS.has(value);
    case 'composition': return typeof value === 'string' && COMPOSITIONS.has(value);
    case 'count': return isBoundedCount(value);
    case 'revision': return isBoundedRevision(value);
    case 'deduplicated': return typeof value === 'boolean';
    case 'interrupted': return typeof value === 'boolean';
  }
}

function validateEvent(value: unknown): { ok: true; event: Readonly<CanvasTelemetryEvent> } | { ok: false } {
  if (!isRecord(value)) return { ok: false };
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_TELEMETRY_KEYS.has(key.toLowerCase())) return { ok: false };
  }
  const kind = value['kind'];
  if (!isEventKind(kind)) return { ok: false };
  const spec = EVENT_SPECS[kind];
  const allowed = new Set<string>(['kind', ...spec.required, ...spec.optional]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) return { ok: false };
  }
  const normalized: Record<string, unknown> = { kind };
  for (const field of [...spec.required, ...spec.optional]) {
    const fieldValue = value[field];
    if (fieldValue === undefined) {
      if (spec.required.includes(field)) return { ok: false };
      continue;
    }
    if (!validFieldValue(field, fieldValue)) return { ok: false };
    normalized[field] = fieldValue;
  }
  return { ok: true, event: Object.freeze(normalized) as Readonly<CanvasTelemetryEvent> };
}

export interface CanvasTelemetryRecorder {
  record(entry: unknown): boolean;
  snapshot(): readonly Readonly<CanvasTelemetryEvent>[];
  droppedCount(): number;
  clear(): void;
}

export function createCanvasTelemetryRecorder(): CanvasTelemetryRecorder {
  const events: Readonly<CanvasTelemetryEvent>[] = [];
  let dropped = 0;
  return {
    record(entry: unknown): boolean {
      const parsed = validateEvent(entry);
      if (!parsed.ok) return false;
      if (events.length >= CANVAS_TELEMETRY_LIMITS.events) {
        events.shift();
        dropped += 1;
      }
      events.push(parsed.event);
      return true;
    },
    snapshot(): readonly Readonly<CanvasTelemetryEvent>[] {
      return Object.freeze([...events]);
    },
    droppedCount(): number {
      return dropped;
    },
    clear(): void {
      events.length = 0;
      dropped = 0;
    },
  };
}
