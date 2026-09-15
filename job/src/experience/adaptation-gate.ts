import type { CanonicalSalesContext } from '../ai/context/canonical-sales-context.ts';
import type { VisualSceneComposition } from '../ai/context/context-packager.ts';
import type { ProcessGraph } from '../canvas/domain.ts';
import {
  projectReactiveCanvas,
  type ReactiveCanvasModel,
} from '../canvas/reactive-graph-adapter.ts';
import { ARTIFACT_SURFACE_REGISTRY } from './artifact-registry.ts';
import { containsExecutableSurface } from './executable-surface.ts';
import type { CanvasTelemetryEvent, CanvasTelemetryRecorder, CanvasTelemetryRejectionCode } from './canvas-telemetry.ts';
import type { ExperienceProposal } from './experience-proposal.ts';
import { createCameraIntent } from './experience-semantic-key.ts';
import {
  PRESENTATION_CATALOG_VERSION,
  resolvePresentationComponent,
  resolvePresentationModel,
} from './presentation-catalog.ts';
import type { ReactiveExperienceState } from './reactive-experience-state.ts';

/**
 * WP04 deterministic UI Adaptation Gate.
 *
 * Pipeline over existing stages — schema validation stays in
 * `experience-validation.ts`, revision/evidence checks in
 * `experience-projector.ts`, graph adaptation in
 * `reactive-graph-adapter.ts`. The gate adds, in order:
 * session-authority binding → revision binding → target resolution →
 * disclosure minimum-data (S002 seam: no protected surfaces exist, so the
 * stage proves the plan carries references, never value payloads) →
 * versioned catalog resolution → accessibility/responsive policy →
 * immutable Presentation Plan staged for the renderer WP.
 *
 * Measurement semantics: acceptance is owned by the WP03 projector (the gate
 * never emits `intent-accepted`); the gate emits per-action usage
 * (`action-projected`), gap (`catalog-miss`) and rejection events only.
 * No model-visible action kinds are added; internal projector/director
 * commands never become wire actions.
 */

export const ADAPTATION_GATE_VERSION = 1 as const;

export type AdaptationGateStage =
  | 'session-authority'
  | 'revision-binding'
  | 'target-resolution'
  | 'catalog'
  | 'policy';

export interface AdaptationGateInput {
  proposal: Readonly<ExperienceProposal>;
  canonical: CanonicalSalesContext;
  reactiveState: Readonly<ReactiveExperienceState>;
  baseGraph: ProcessGraph;
  sessionId: string;
  telemetry?: CanvasTelemetryRecorder;
}

export interface PresentationPlanArtifact {
  id: string;
  surfaceId: string;
  maturity: 'conceptual' | 'prototype';
  landmarkLabel: string;
  title: string;
  summary: string;
}

export interface PresentationPlanGroup {
  groupId: string;
  label: string;
  memberIds: readonly string[];
}

export interface PresentationPlanRelationship {
  sourceId: string;
  targetId: string;
  text: string;
}

export interface PresentationPlanNodeOverlay {
  nodeId: string;
  state: 'active' | 'hypothesis' | 'invalidated' | null;
  deEmphasized: boolean;
  revealed: boolean;
  annotationTexts: readonly string[];
}

export interface PresentationPlanQuantification {
  calculationId: string;
  targetId: string | null;
}

export interface PresentationPlanCamera {
  key: string | null;
  targets: readonly string[];
  composition: VisualSceneComposition;
}

export interface PresentationPlan {
  version: 1;
  catalogVersion: 1;
  gateVersion: 1;
  basedOnRevision: number;
  projectionRevision: number;
  composition: VisualSceneComposition;
  focusIds: readonly string[];
  comparisonIds: readonly string[];
  announcement: string | null;
  artifacts: readonly Readonly<PresentationPlanArtifact>[];
  groups: readonly Readonly<PresentationPlanGroup>[];
  relationships: readonly Readonly<PresentationPlanRelationship>[];
  overlays: readonly Readonly<PresentationPlanNodeOverlay>[];
  quantifications: readonly Readonly<PresentationPlanQuantification>[];
  camera: Readonly<PresentationPlanCamera>;
  disclosure: { outcome: 'none-required' };
}

export type AdaptationGateResult =
  | {
      ok: true;
      plan: Readonly<PresentationPlan>;
      telemetry: readonly Readonly<CanvasTelemetryEvent>[];
    }
  | {
      ok: false;
      stage: AdaptationGateStage;
      code: string;
      path: string;
      telemetryCode: CanvasTelemetryRejectionCode | null;
      telemetry: readonly Readonly<CanvasTelemetryEvent>[];
    };

// Mirrors the scene announcement bound in experience-validation.ts; the gate
// rechecks it defensively for proposals that bypass schema validation.
const ANNOUNCEMENT_LIMIT = 600;

function toSurfaceId(kind: string): string {
  return `artifact-${kind.replace(/_/g, '-')}`;
}

function planTextLeaves(plan: {
  announcement: string | null;
  artifacts: readonly { title: string; summary: string }[];
  groups: readonly { label: string }[];
  relationships: readonly { text: string }[];
  overlays: readonly { annotationTexts: readonly string[] }[];
}): { path: string; text: string }[] {
  const leaves: { path: string; text: string }[] = [];
  if (plan.announcement !== null) leaves.push({ path: 'plan.announcement', text: plan.announcement });
  plan.artifacts.forEach((artifact, index) => {
    leaves.push({ path: `plan.artifacts[${index}].title`, text: artifact.title });
    leaves.push({ path: `plan.artifacts[${index}].summary`, text: artifact.summary });
  });
  plan.groups.forEach((group, index) => {
    leaves.push({ path: `plan.groups[${index}].label`, text: group.label });
  });
  plan.relationships.forEach((relationship, index) => {
    leaves.push({ path: `plan.relationships[${index}].text`, text: relationship.text });
  });
  plan.overlays.forEach((overlay, index) => {
    overlay.annotationTexts.forEach((text, textIndex) => {
      leaves.push({ path: `plan.overlays[${index}].annotationTexts[${textIndex}]`, text });
    });
  });
  return leaves;
}

export function runAdaptationGate(input: AdaptationGateInput): AdaptationGateResult {
  const recorder = input.telemetry ?? null;
  const snapshot = (): readonly Readonly<CanvasTelemetryEvent>[] =>
    input.telemetry === undefined ? [] : input.telemetry.snapshot();
  const fail = (
    stage: AdaptationGateStage,
    code: string,
    path: string,
    telemetryCode: CanvasTelemetryRejectionCode | null,
    event?: unknown,
  ): AdaptationGateResult => {
    if (event !== undefined) recorder?.record(event);
    return { ok: false, stage, code, path, telemetryCode, telemetry: snapshot() };
  };

  if (input.canonical.sessionId !== input.sessionId) {
    return fail('session-authority', 'SESSION_MISMATCH', 'gate.sessionId', null);
  }

  if (input.reactiveState.basedOnRevision !== input.canonical.revision) {
    return fail('revision-binding', 'STALE_REVISION', 'gate.basedOnRevision', 'stale-revision', {
      kind: 'stale-revision',
      revision: input.reactiveState.basedOnRevision,
    });
  }

  const surface = projectReactiveCanvas(input.baseGraph, input.reactiveState, {
    ...input.canonical,
    proposalFacts: input.proposal.factProposals.map((fact) => ({
      id: fact.id,
      source: fact.source,
      status: 'proposed',
    })),
  });
  if (!surface.ok) {
    if (surface.code === 'UNKNOWN_ACTION_TARGET' || surface.code === 'UNKNOWN_EVIDENCE_REFERENCE') {
      return fail('target-resolution', surface.code, surface.path, 'missing-evidence', {
        kind: 'intent-rejected',
        rejectionCode: 'missing-evidence',
        revision: input.canonical.revision,
      });
    }
    return fail('target-resolution', surface.code, surface.path, null);
  }
  const model = surface.model;

  const composition = input.proposal.sceneProposal?.composition ?? input.reactiveState.scene.composition;
  const resolvedModel = resolvePresentationModel(composition);
  if (!resolvedModel.ok) {
    return fail('catalog', 'UNKNOWN_MODEL', 'proposal.sceneProposal.composition', 'unknown-kind', {
      kind: 'intent-rejected',
      rejectionCode: 'unknown-kind',
      revision: input.canonical.revision,
    });
  }

  for (let i = 0; i < input.proposal.artifactProposals.length; i += 1) {
    const artifact = input.proposal.artifactProposals[i];
    if (artifact === undefined) continue;
    const resolved = resolvePresentationComponent(toSurfaceId(artifact.kind));
    if (!resolved.ok) {
      recorder?.record({ kind: 'catalog-miss' });
      return fail('catalog', 'CATALOG_MISS', `proposal.artifactProposals[${i}].kind`, 'catalog-miss');
    }
  }
  for (const componentId of ['canvas-origin-node', 'canvas-process-node'] as const) {
    if (!resolvePresentationComponent(componentId).ok) {
      recorder?.record({ kind: 'catalog-miss' });
      return fail('catalog', 'CATALOG_MISS', `catalog.components[${componentId}]`, 'catalog-miss');
    }
  }

  const announcement = input.proposal.sceneProposal?.announcement ?? input.reactiveState.scene.announcement;
  if (announcement !== null && announcement.length > ANNOUNCEMENT_LIMIT) {
    return fail('policy', 'ANNOUNCEMENT_LIMIT_EXCEEDED', 'proposal.sceneProposal.announcement', 'a11y-violation', {
      kind: 'intent-rejected',
      rejectionCode: 'a11y-violation',
      revision: input.canonical.revision,
    });
  }

  const plan = assemblePlan(input, model, composition, announcement);
  for (const leaf of planTextLeaves(plan)) {
    if (containsExecutableSurface(leaf.text)) {
      return fail('policy', 'EXECUTABLE_SURFACE', leaf.path, null);
    }
  }

  for (const action of input.proposal.intent.actions) {
    recorder?.record({ kind: 'action-projected', actionKind: action.kind, composition });
  }

  return { ok: true, plan, telemetry: snapshot() };
}

function assemblePlan(
  input: AdaptationGateInput,
  model: Readonly<ReactiveCanvasModel>,
  composition: VisualSceneComposition,
  announcement: string | null,
): Readonly<PresentationPlan> {
  const camera = createCameraIntent(input.proposal);
  const artifacts = input.reactiveState.artifacts.map((artifact) => {
    const surfaceId = toSurfaceId(artifact.kind);
    const resolved = resolvePresentationComponent(surfaceId);
    const landmarkLabel = resolved.ok
      ? ARTIFACT_SURFACE_REGISTRY[artifact.kind].landmarkLabel
      : artifact.kind;
    return Object.freeze({
      id: artifact.id,
      surfaceId,
      maturity: artifact.status,
      landmarkLabel,
      title: artifact.title,
      summary: artifact.summary,
    });
  });
  return Object.freeze({
    version: 1 as const,
    catalogVersion: PRESENTATION_CATALOG_VERSION,
    gateVersion: ADAPTATION_GATE_VERSION,
    basedOnRevision: input.reactiveState.basedOnRevision,
    projectionRevision: input.reactiveState.projectionRevision,
    composition,
    focusIds: Object.freeze([...model.focusIds]),
    comparisonIds: Object.freeze([...model.comparisonIds]),
    announcement,
    artifacts: Object.freeze(artifacts),
    groups: Object.freeze(model.groups.map((group) => Object.freeze({
      groupId: group.groupId,
      label: group.label,
      memberIds: Object.freeze([...group.memberIds]),
    }))),
    relationships: Object.freeze(model.relationshipExplanations.map((relationship) => Object.freeze({
      sourceId: relationship.sourceId,
      targetId: relationship.targetId,
      text: relationship.text,
    }))),
    overlays: Object.freeze(model.overlays.map((overlay) => Object.freeze({
      nodeId: overlay.nodeId,
      state: overlay.state,
      deEmphasized: overlay.deEmphasized,
      revealed: overlay.revealed,
      annotationTexts: Object.freeze([...overlay.annotations]),
    }))),
    quantifications: Object.freeze([
      ...model.globalQuantifications.map((quantification) => Object.freeze({
        calculationId: quantification.calculationId,
        targetId: null as string | null,
      })),
      ...model.overlays.flatMap((overlay) => overlay.quantifications.map((quantification) => Object.freeze({
        calculationId: quantification.calculationId,
        targetId: overlay.nodeId as string | null,
      }))),
    ]),
    camera: Object.freeze({
      key: camera.key,
      targets: Object.freeze([...camera.targets]),
      composition,
    }),
    disclosure: Object.freeze({ outcome: 'none-required' as const }),
  });
}
