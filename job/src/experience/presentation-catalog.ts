import { ARTIFACT_KINDS, type ArtifactKind } from './artifact-intent.ts';
import { ARTIFACT_SURFACE_REGISTRY } from './artifact-registry.ts';
import { VISUAL_SCENE_COMPOSITIONS, type VisualSceneComposition } from '../ai/context/context-packager.ts';

/**
 * Application-owned presentation catalogs, versioned as one unit.
 *
 * Every entry maps to existing design truth: token ids invert mechanically to
 * `--vxa-*` variables in `src/design/tokens.css` (dots become dashes),
 * components name application-owned renderables, and models are exactly the
 * five approved scene compositions. New visual primitives require code
 * review, catalog update, version bump and tests; the agent composes but
 * never invents production components. A drift test locks the token set
 * against `tokens.css` and model/component coverage against their sources.
 */
export const PRESENTATION_CATALOG_VERSION = 1 as const;

export interface CatalogTokenDescriptor {
  id: string;
  cssVariable: `--vxa-${string}`;
  group: string;
  version: 1;
}

export interface CatalogComponentDescriptor {
  id: string;
  kind: 'canvas-node' | 'artifact-surface';
  module: string;
  version: 1;
}

export interface CatalogModelDescriptor {
  composition: VisualSceneComposition;
  version: 1;
  description: string;
}

export type CatalogMissCode = 'CATALOG_MISS';

export type CatalogResolution<T> =
  | { ok: true; descriptor: Readonly<T> }
  | { ok: false; code: CatalogMissCode; path: string };

function token(id: string, group: string): Readonly<CatalogTokenDescriptor> {
  return Object.freeze({ id, cssVariable: `--vxa-${id.replace(/\./g, '-')}`, group, version: 1 as const });
}

export const PRESENTATION_TOKEN_CATALOG: Readonly<Record<string, Readonly<CatalogTokenDescriptor>>> = Object.freeze({
  'accent.danger': token('accent.danger', 'accent'),
  'accent.evidence': token('accent.evidence', 'accent'),
  'accent.intelligence': token('accent.intelligence', 'accent'),
  'accent.intelligence.soft': token('accent.intelligence.soft', 'accent'),
  'accent.success': token('accent.success', 'accent'),
  'accent.warning': token('accent.warning', 'accent'),
  'bg.elevated': token('bg.elevated', 'bg'),
  'bg.void': token('bg.void', 'bg'),
  'border.strong': token('border.strong', 'border'),
  'border.subtle': token('border.subtle', 'border'),
  'content.max': token('content.max', 'content'),
  'ease.standard': token('ease.standard', 'ease'),
  'focus.ring': token('focus.ring', 'focus'),
  'font.display': token('font.display', 'font'),
  'font.mono': token('font.mono', 'font'),
  'font.sans': token('font.sans', 'font'),
  'motion.camera': token('motion.camera', 'motion'),
  'motion.fast': token('motion.fast', 'motion'),
  'motion.state': token('motion.state', 'motion'),
  'radius.control': token('radius.control', 'radius'),
  'radius.node': token('radius.node', 'radius'),
  'radius.panel': token('radius.panel', 'radius'),
  'radius.pill': token('radius.pill', 'radius'),
  'shadow.float': token('shadow.float', 'shadow'),
  'shadow.focus': token('shadow.focus', 'shadow'),
  'shadow.inset': token('shadow.inset', 'shadow'),
  'shadow.panel': token('shadow.panel', 'shadow'),
  'space.1': token('space.1', 'space'),
  'space.10': token('space.10', 'space'),
  'space.12': token('space.12', 'space'),
  'space.16': token('space.16', 'space'),
  'space.2': token('space.2', 'space'),
  'space.3': token('space.3', 'space'),
  'space.4': token('space.4', 'space'),
  'space.5': token('space.5', 'space'),
  'space.6': token('space.6', 'space'),
  'space.8': token('space.8', 'space'),
  'surface.graphite': token('surface.graphite', 'surface'),
  'surface.platinum': token('surface.platinum', 'surface'),
  'surface.soft': token('surface.soft', 'surface'),
  'surface.titanium': token('surface.titanium', 'surface'),
  'text.hero': token('text.hero', 'text'),
  'text.lg': token('text.lg', 'text'),
  'text.md': token('text.md', 'text'),
  'text.muted': token('text.muted', 'text'),
  'text.on.light': token('text.on.light', 'text'),
  'text.platinum': token('text.platinum', 'text'),
  'text.primary': token('text.primary', 'text'),
  'text.sm': token('text.sm', 'text'),
  'text.subtle': token('text.subtle', 'text'),
  'text.xl': token('text.xl', 'text'),
  'text.xs': token('text.xs', 'text'),
  'touch.target': token('touch.target', 'touch'),
});

function component(
  id: string,
  kind: CatalogComponentDescriptor['kind'],
  module: string,
): Readonly<CatalogComponentDescriptor> {
  return Object.freeze({ id, kind, module, version: 1 as const });
}

const CANVAS_NODE_COMPONENTS: Readonly<Record<string, Readonly<CatalogComponentDescriptor>>> = Object.freeze({
  'canvas-origin-node': component('canvas-origin-node', 'canvas-node', 'src/canvas/nodes/OriginNode.tsx'),
  'canvas-process-node': component('canvas-process-node', 'canvas-node', 'src/canvas/nodes/ProcessNode.tsx'),
  'canvas-value-proof-node': component('canvas-value-proof-node', 'canvas-node', 'src/canvas/EvidenceProofSurface.tsx'),
  'canvas-opportunity-proof-node': component('canvas-opportunity-proof-node', 'canvas-node', 'src/canvas/EvidenceProofSurface.tsx'),
  'canvas-agent-presence-node': component('canvas-agent-presence-node', 'canvas-node', 'src/canvas/nodes/SpatialAgentNode.tsx'),
});

function artifactSurfaceComponents(): Readonly<Record<string, Readonly<CatalogComponentDescriptor>>> {
  const entries: Record<string, Readonly<CatalogComponentDescriptor>> = {};
  for (const kind of ARTIFACT_KINDS as readonly ArtifactKind[]) {
    const surface = ARTIFACT_SURFACE_REGISTRY[kind];
    entries[surface.surfaceId] = component(surface.surfaceId, 'artifact-surface', 'src/experience/artifact-registry.ts');
  }
  return Object.freeze(entries);
}

export const PRESENTATION_COMPONENT_CATALOG: Readonly<Record<string, Readonly<CatalogComponentDescriptor>>> = Object.freeze({
  ...CANVAS_NODE_COMPONENTS,
  ...artifactSurfaceComponents(),
});

const MODEL_DESCRIPTIONS: Readonly<Record<VisualSceneComposition, string>> = Object.freeze({
  stable: 'Resting composition: no agent-directed framing; user navigation leads.',
  focus: 'Single-object focus: the approved bottleneck or entity stays centered with provenance visible.',
  compare: 'Side-by-side comparison of approved current and future states over canonical evidence.',
  overview: 'Full process overview: every validated step visible without forced focus.',
  artifact: 'Artifact staging: a conceptual or prototype surface presented with explicit maturity.',
});

export const PRESENTATION_MODEL_CATALOG: Readonly<Record<VisualSceneComposition, Readonly<CatalogModelDescriptor>>> = Object.freeze(
  Object.fromEntries(
    (VISUAL_SCENE_COMPOSITIONS as readonly VisualSceneComposition[]).map((composition) => [
      composition,
      Object.freeze({ composition, version: 1 as const, description: MODEL_DESCRIPTIONS[composition] }),
    ]),
  ) as Record<VisualSceneComposition, Readonly<CatalogModelDescriptor>>,
);

export function resolvePresentationToken(id: string): CatalogResolution<CatalogTokenDescriptor> {
  const descriptor = PRESENTATION_TOKEN_CATALOG[id];
  if (descriptor === undefined) return { ok: false, code: 'CATALOG_MISS', path: `catalog.tokens[${id}]` };
  return { ok: true, descriptor };
}

export function resolvePresentationComponent(id: string): CatalogResolution<CatalogComponentDescriptor> {
  const descriptor = PRESENTATION_COMPONENT_CATALOG[id];
  if (descriptor === undefined) return { ok: false, code: 'CATALOG_MISS', path: `catalog.components[${id}]` };
  return { ok: true, descriptor };
}

export function resolvePresentationModel(composition: string): CatalogResolution<CatalogModelDescriptor> {
  if (!(VISUAL_SCENE_COMPOSITIONS as readonly string[]).includes(composition)) {
    return { ok: false, code: 'CATALOG_MISS', path: 'catalog.models[composition]' };
  }
  const descriptor = PRESENTATION_MODEL_CATALOG[composition as VisualSceneComposition];
  return { ok: true, descriptor };
}
