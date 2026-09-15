import type { CameraMode } from './camera.ts';
import type { CanvasPoint } from './layout.ts';

export const SPATIAL_AGENT_NODE_ID = '__vxa_spatial_agent__' as const;

export type SpatialAgentStatus =
  | 'idle'
  | 'requesting'
  | 'correcting'
  | 'awaiting_user'
  | 'recovery'
  | 'error';

export type SpatialAgentPhase =
  | 'observing'
  | 'thinking'
  | 'asking'
  | 'recovering'
  | 'error';

export interface SpatialAgentPresenceInput {
  status: SpatialAgentStatus;
  mode: CameraMode;
  focusedNodeId: string | null;
  semanticTargets: readonly string[];
  positions: ReadonlyMap<string, CanvasPoint>;
  mobile: boolean;
}

export type SpatialAgentPlacement = 'above' | 'right' | 'left' | 'below';

export interface SpatialAgentPresence {
  visible: boolean;
  anchorId: string | null;
  position: CanvasPoint;
  placement: SpatialAgentPlacement;
  phase: SpatialAgentPhase;
  key: string;
}

const PROCESS_FOOTPRINT = Object.freeze({ width: 300, height: 180 });
const AGENT_FOOTPRINT = Object.freeze({ width: 248, height: 200 });
const PLACEMENT_GAP = 24;

interface PlacementCandidate {
  placement: SpatialAgentPlacement;
  position: CanvasPoint;
}

function overlapsProcessNode(
  candidate: Readonly<CanvasPoint>,
  anchorId: string | null,
  positions: ReadonlyMap<string, CanvasPoint>,
): boolean {
  const left = candidate.x;
  const right = candidate.x + AGENT_FOOTPRINT.width;
  const top = candidate.y;
  const bottom = candidate.y + AGENT_FOOTPRINT.height;

  for (const [id, point] of positions) {
    if (id === anchorId || id === 'origin') continue;
    const nodeRight = point.x + PROCESS_FOOTPRINT.width;
    const nodeBottom = point.y + PROCESS_FOOTPRINT.height;
    if (left < nodeRight && right > point.x && top < nodeBottom && bottom > point.y) return true;
  }
  return false;
}

function resolvePlacement(
  anchor: Readonly<CanvasPoint>,
  anchorId: string | null,
  positions: ReadonlyMap<string, CanvasPoint>,
  mobile: boolean,
  mode: CameraMode,
): Readonly<PlacementCandidate> {
  if (anchorId === 'origin') {
    return mobile
      ? Object.freeze({ placement: 'below' as const, position: Object.freeze({ x: anchor.x + 12, y: anchor.y + 190 }) })
      : Object.freeze({ placement: 'above' as const, position: Object.freeze({ x: anchor.x + 36, y: anchor.y - 190 }) });
  }

  const sideRight = Object.freeze({
    placement: 'right' as const,
    position: Object.freeze({ x: anchor.x + PROCESS_FOOTPRINT.width + PLACEMENT_GAP, y: anchor.y }),
  });
  const sideLeft = Object.freeze({
    placement: 'left' as const,
    position: Object.freeze({ x: anchor.x - AGENT_FOOTPRINT.width - PLACEMENT_GAP, y: anchor.y }),
  });
  const above = Object.freeze({
    placement: 'above' as const,
    position: Object.freeze({ x: anchor.x + 12, y: anchor.y - AGENT_FOOTPRINT.height - PLACEMENT_GAP }),
  });
  const below = Object.freeze({
    placement: 'below' as const,
    position: Object.freeze({ x: anchor.x + 12, y: anchor.y + PROCESS_FOOTPRINT.height + PLACEMENT_GAP }),
  });
  const candidates = mobile
    ? [sideRight, sideLeft, above, below]
    : [above, sideRight, sideLeft, below];
  return candidates.find((candidate) => !overlapsProcessNode(candidate.position, anchorId, positions))
    ?? (mode === 'focus' ? sideRight : above);
}

function resolvePhase(status: SpatialAgentStatus): SpatialAgentPhase {
  switch (status) {
    case 'requesting':
    case 'correcting':
      return 'thinking';
    case 'awaiting_user':
      return 'asking';
    case 'recovery':
      return 'recovering';
    case 'error':
      return 'error';
    case 'idle':
      return 'observing';
  }
}

function firstKnown(
  ids: readonly string[],
  positions: ReadonlyMap<string, CanvasPoint>,
): string | null {
  for (const id of ids) if (positions.has(id)) return id;
  return null;
}

function resolveAnchor(input: SpatialAgentPresenceInput): string | null {
  if (input.mode === 'origin' && input.positions.has('origin')) return 'origin';
  const semantic = firstKnown(input.semanticTargets, input.positions);
  if (semantic !== null) return semantic;
  if (input.focusedNodeId !== null && input.positions.has(input.focusedNodeId)) {
    return input.focusedNodeId;
  }
  if (input.positions.has('origin')) return 'origin';
  return input.positions.keys().next().value ?? null;
}

export function resolveSpatialAgentPresence(
  input: SpatialAgentPresenceInput,
): Readonly<SpatialAgentPresence> {
  const anchorId = resolveAnchor(input);
  const anchor = anchorId === null ? { x: 0, y: 0 } : input.positions.get(anchorId) ?? { x: 0, y: 0 };
  const phase = resolvePhase(input.status);
  const placement = resolvePlacement(anchor, anchorId, input.positions, input.mobile, input.mode);

  return Object.freeze({
    visible: anchorId !== null,
    anchorId,
    position: placement.position,
    placement: placement.placement,
    phase,
    key: [phase, anchorId ?? 'none', placement.placement, input.mobile ? 'mobile' : 'desktop', input.mode].join(':'),
  });
}
