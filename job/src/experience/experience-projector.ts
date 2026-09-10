import type { CanonicalSalesContext } from '../ai/context/canonical-sales-context.ts';
import type { ExperienceAction } from './agent-intent.ts';
import type { ArtifactProposal, CorrectionProposal, ExperienceProposal, ProcessMutationProposal } from './experience-proposal.ts';
import { resolveArtifactSurface } from './artifact-registry.ts';

export { createReactiveExperienceState, interruptExperienceChoreography } from './reactive-experience-state.ts';
export type { ReactiveExperienceState } from './reactive-experience-state.ts';
import {
  REACTIVE_EXPERIENCE_LIMITS,
  freezeExperienceChoreography,
  freezeReactiveExperienceState,
  freezeReactiveScene,
  freezeStringList,
  type ProjectedAction,
  type ProjectedActionStatus,
  type ProjectedArtifact,
  type ProjectedCorrectionSuggestion,
  type ProjectedProcessMutation,
  type ReactiveExperienceState,
} from './reactive-experience-state.ts';
import { createCameraIntent, createExperienceSemanticKey } from './experience-semantic-key.ts';

export type ExperienceProjectionErrorCode =
  | 'STALE_REVISION'
  | 'REVISION_ROLLBACK'
  | 'INVALID_CALCULATION_REFERENCE'
  | 'INVALID_ARTIFACT_REFERENCE'
  | 'INVALID_CORRECTION_REFERENCE'
  | 'UNKNOWN_EVIDENCE_REFERENCE'
  | 'PROJECTION_CAPACITY_EXCEEDED';

export type ExperienceProjectionResult =
  | { ok: true; state: Readonly<ReactiveExperienceState>; deduplicated: boolean }
  | { ok: false; code: ExperienceProjectionErrorCode; path: string; state: Readonly<ReactiveExperienceState> };

function collectKnownEvidenceIds(canonical: CanonicalSalesContext, proposal?: Readonly<ExperienceProposal>): Set<string> {
  const ids = new Set<string>();
  for (const item of canonical.facts) ids.add(item.id);
  for (const item of canonical.quantitativeObservations) ids.add(item.id);
  for (const item of canonical.verifiedCalculations) ids.add(item.id);
  for (const item of canonical.opportunities) ids.add(item.id);
  for (const item of canonical.artifacts) ids.add(item.id);
  if (proposal) for (const item of proposal.factProposals) ids.add(item.id);
  return ids;
}

function collectInvalidEvidenceIds(canonical: CanonicalSalesContext): Set<string> {
  const ids = new Set<string>();
  for (const item of canonical.facts) if (item.status === 'superseded') ids.add(item.id);
  for (const item of canonical.quantitativeObservations) if (item.status === 'superseded') ids.add(item.id);
  for (const item of canonical.verifiedCalculations) if (item.status === 'invalidated') ids.add(item.id);
  for (const item of canonical.opportunities) if (item.status === 'invalidated') ids.add(item.id);
  for (const item of canonical.artifacts) if (item.status === 'invalidated') ids.add(item.id);
  return ids;
}

function isCorrectableEvidence(canonical: CanonicalSalesContext, id: string): boolean {
  const fact = canonical.facts.find((item) => item.id === id);
  if (fact !== undefined) return fact.status !== 'superseded';
  const observation = canonical.quantitativeObservations.find((item) => item.id === id);
  return observation !== undefined && observation.status !== 'superseded';
}

function actionInvalidation(action: Readonly<ExperienceAction>, canonical: CanonicalSalesContext, invalidEvidenceIds: ReadonlySet<string>): ProjectedAction['invalidatedReason'] {
  if (action.kind === 'quantify') {
    const calculation = canonical.verifiedCalculations.find((item) => item.id === action.calculationId);
    if (calculation === undefined || calculation.status !== 'valid') return 'canonical-calculation-invalidated';
  }
  if (action.kind === 'annotate' && action.evidenceIds.some((id) => invalidEvidenceIds.has(id))) return 'canonical-evidence-invalidated';
  return null;
}

export function reconcileReactiveExperience(
  state: Readonly<ReactiveExperienceState>,
  canonical: CanonicalSalesContext,
): Readonly<ReactiveExperienceState> {
  if (canonical.revision < state.basedOnRevision) throw new TypeError('canonical revision rollback is not allowed');
  const invalidEvidenceIds = collectInvalidEvidenceIds(canonical);
  let changed = canonical.revision !== state.basedOnRevision;

  const actions = state.actions.map((item) => {
    const invalidatedReason = actionInvalidation(item.action, canonical, invalidEvidenceIds);
    const status: ProjectedActionStatus = invalidatedReason === null ? 'active' : 'invalidated';
    if (status === item.status && invalidatedReason === item.invalidatedReason) return item;
    changed = true;
    return Object.freeze({ ...item, status, invalidatedReason });
  });

  const correctionSuggestions = state.correctionSuggestions.map((item) => {
    const invalidatedReason = isCorrectableEvidence(canonical, item.correction.targetEvidenceId)
      ? null
      : 'canonical-evidence-invalidated' as const;
    const status = invalidatedReason === null ? 'pending' as const : 'invalidated' as const;
    if (status === item.status && invalidatedReason === item.invalidatedReason) return item;
    changed = true;
    return Object.freeze({ ...item, status, invalidatedReason });
  });

  const artifacts = state.artifacts.map((item) => {
    const invalidatedReason = item.evidenceIds.some((id) => invalidEvidenceIds.has(id)) ? 'canonical-evidence-invalidated' as const : null;
    const truthStatus = invalidatedReason === null ? 'active' as const : 'invalidated' as const;
    if (truthStatus === item.truthStatus && invalidatedReason === item.invalidatedReason) return item;
    changed = true;
    return Object.freeze({ ...item, truthStatus, invalidatedReason });
  });

  if (!changed) return state;
  return freezeReactiveExperienceState({ ...state, basedOnRevision: canonical.revision, actions, correctionSuggestions, artifacts });
}

function validateProjectionReferences(
  proposal: Readonly<ExperienceProposal>,
  canonical: CanonicalSalesContext,
): { ok: true } | { ok: false; code: ExperienceProjectionErrorCode; path: string } {
  const knownEvidence = collectKnownEvidenceIds(canonical, proposal);
  const artifactIntentIds = new Set(proposal.intent.artifactIntents.flatMap((item) => item.id === undefined ? [] : [item.id]));

  for (let i = 0; i < proposal.intent.actions.length; i += 1) {
    const action = proposal.intent.actions[i];
    if (action === undefined) continue;
    if (action.kind === 'quantify') {
      const calculation = canonical.verifiedCalculations.find((item) => item.id === action.calculationId);
      if (calculation === undefined || calculation.status !== 'valid') return { ok: false, code: 'INVALID_CALCULATION_REFERENCE', path: `proposal.intent.actions[${i}].calculationId` };
    }
    if ((action.kind === 'demonstrate' || action.kind === 'stage_artifact' || action.kind === 'request_workshop') && !artifactIntentIds.has(action.artifactIntentId)) {
      return { ok: false, code: 'INVALID_ARTIFACT_REFERENCE', path: `proposal.intent.actions[${i}].artifactIntentId` };
    }
    if (action.kind === 'annotate') {
      for (const evidenceId of action.evidenceIds) if (!knownEvidence.has(evidenceId)) return { ok: false, code: 'UNKNOWN_EVIDENCE_REFERENCE', path: `proposal.intent.actions[${i}].evidenceIds` };
    }
  }

  for (let i = 0; i < proposal.correctionProposals.length; i += 1) {
    const correction = proposal.correctionProposals[i];
    if (correction === undefined) continue;
    if (!isCorrectableEvidence(canonical, correction.targetEvidenceId)) {
      return { ok: false, code: 'INVALID_CORRECTION_REFERENCE', path: `proposal.correctionProposals[${i}].targetEvidenceId` };
    }
  }

  for (let i = 0; i < proposal.artifactProposals.length; i += 1) {
    const artifact = proposal.artifactProposals[i];
    if (artifact === undefined) continue;
    for (const evidenceId of artifact.evidenceIds) if (!knownEvidence.has(evidenceId)) return { ok: false, code: 'UNKNOWN_EVIDENCE_REFERENCE', path: `proposal.artifactProposals[${i}].evidenceIds` };
    resolveArtifactSurface(artifact.kind);
  }
  return { ok: true };
}

function hasVisualSemantics(proposal: Readonly<ExperienceProposal>): boolean {
  return proposal.intent.actions.length > 0
    || proposal.correctionProposals.length > 0
    || proposal.processMutations.length > 0
    || proposal.sceneProposal !== null
    || proposal.artifactProposals.length > 0;
}

function actionSlotKey(item: Readonly<ProjectedAction>): string {
  const action = item.action;
  switch (action.kind) {
    case 'focus': return 'focus';
    case 'compare': return 'compare';
    case 'annotate': return `annotate:${action.targetId}`;
    case 'reveal': return `reveal:${action.targetId}`;
    case 'group': return `group:${action.groupId}`;
    case 'de_emphasize': return `de_emphasize:${[...action.targetIds].sort().join(',')}`;
    case 'quantify': return `quantify:${action.calculationId}:${action.targetId ?? 'none'}`;
    case 'demonstrate': return `demonstrate:${action.artifactIntentId}`;
    case 'explain_relationship': return `relationship:${action.sourceId}:${action.targetId}`;
    case 'stage_artifact': return `stage_artifact:${action.artifactIntentId}`;
    case 'request_workshop': return `request_workshop:${action.artifactIntentId}`;
  }
}

function mergeActions(
  previous: readonly Readonly<ProjectedAction>[],
  incoming: readonly Readonly<ProjectedAction>[],
): readonly Readonly<ProjectedAction>[] {
  if (incoming.length === 0) return previous;
  const merged = [...previous];
  const slots = new Map(merged.map((item, index) => [actionSlotKey(item), index] as const));
  for (const item of incoming) {
    const key = actionSlotKey(item);
    const index = slots.get(key);
    if (index === undefined) {
      slots.set(key, merged.length);
      merged.push(item);
    } else {
      merged[index] = item;
    }
  }
  return Object.freeze(merged);
}

function processMutationSlotKey(item: Readonly<ProjectedProcessMutation>): string {
  const mutation = item.mutation;
  switch (mutation.kind) {
    case 'upsert_node': return `node:${mutation.nodeId}`;
    case 'upsert_relationship': return `relationship:${mutation.relationshipId}`;
    case 'remove_element': return `remove:${mutation.targetId}`;
    case 'set_node_state': return `node-state:${mutation.nodeId}`;
  }
}

function processMutationTouchesTarget(item: Readonly<ProjectedProcessMutation>, targetId: string): boolean {
  const mutation = item.mutation;
  switch (mutation.kind) {
    case 'upsert_node': return mutation.nodeId === targetId;
    case 'upsert_relationship': return mutation.relationshipId === targetId || mutation.sourceNodeId === targetId || mutation.targetNodeId === targetId;
    case 'remove_element': return mutation.targetId === targetId;
    case 'set_node_state': return mutation.nodeId === targetId;
  }
}

function mergeProcessMutations(
  previous: readonly Readonly<ProjectedProcessMutation>[],
  incoming: readonly Readonly<ProjectedProcessMutation>[],
): readonly Readonly<ProjectedProcessMutation>[] {
  if (incoming.length === 0) return previous;
  let merged = [...previous];

  for (const item of incoming) {
    const mutation = item.mutation;
    if (mutation.kind === 'remove_element') {
      merged = merged.filter((existing) => !processMutationTouchesTarget(existing, mutation.targetId));
      merged.push(item);
      continue;
    }

    if (mutation.kind === 'upsert_node') {
      merged = merged.filter((existing) => !(existing.mutation.kind === 'remove_element' && existing.mutation.targetId === mutation.nodeId));
    } else if (mutation.kind === 'upsert_relationship') {
      merged = merged.filter((existing) => !(existing.mutation.kind === 'remove_element' && existing.mutation.targetId === mutation.relationshipId));
    }

    const key = processMutationSlotKey(item);
    const index = merged.findIndex((existing) => processMutationSlotKey(existing) === key);
    if (index < 0) merged.push(item);
    else merged[index] = item;
  }
  return Object.freeze(merged);
}

function mergeCorrectionSuggestions(
  previous: readonly Readonly<ProjectedCorrectionSuggestion>[],
  incoming: readonly Readonly<ProjectedCorrectionSuggestion>[],
): readonly Readonly<ProjectedCorrectionSuggestion>[] {
  if (incoming.length === 0) return previous;
  const merged = [...previous];
  for (const item of incoming) {
    const index = merged.findIndex((existing) =>
      existing.correction.targetEvidenceId === item.correction.targetEvidenceId);
    if (index < 0) merged.push(item);
    else merged[index] = item;
  }
  return Object.freeze(merged);
}

function projectCorrectionSuggestions(
  proposals: readonly Readonly<CorrectionProposal>[],
): readonly Readonly<ProjectedCorrectionSuggestion>[] {
  return Object.freeze(proposals.map((correction) => Object.freeze({
    sourceCorrectionId: correction.id,
    correction,
    status: 'pending' as const,
    invalidatedReason: null,
  })));
}

function mergeArtifacts(
  previous: readonly Readonly<ProjectedArtifact>[],
  incoming: readonly Readonly<ProjectedArtifact>[],
): readonly Readonly<ProjectedArtifact>[] {
  if (incoming.length === 0) return previous;
  const merged = [...previous];
  const slots = new Map(merged.map((item, index) => [item.id, index] as const));
  for (const item of incoming) {
    const index = slots.get(item.id);
    if (index === undefined) {
      slots.set(item.id, merged.length);
      merged.push(item);
    } else {
      merged[index] = item;
    }
  }
  return Object.freeze(merged);
}

function projectArtifacts(proposals: readonly Readonly<ArtifactProposal>[], canonical: CanonicalSalesContext): readonly Readonly<ProjectedArtifact>[] {
  const invalidEvidence = collectInvalidEvidenceIds(canonical);
  return Object.freeze(proposals.map((artifact) => {
    const surface = resolveArtifactSurface(artifact.kind);
    const invalidated = artifact.evidenceIds.some((id) => invalidEvidence.has(id));
    return Object.freeze({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary,
      evidenceIds: freezeStringList(artifact.evidenceIds),
      status: artifact.status,
      truthStatus: invalidated ? 'invalidated' as const : 'active' as const,
      invalidatedReason: invalidated ? 'canonical-evidence-invalidated' as const : null,
      surfaceId: surface.surfaceId,
      landmarkLabel: surface.landmarkLabel,
    });
  }));
}

export function projectExperienceProposal(
  state: Readonly<ReactiveExperienceState>,
  proposal: Readonly<ExperienceProposal>,
  canonical: CanonicalSalesContext,
): ExperienceProjectionResult {
  if (canonical.revision < state.basedOnRevision) return { ok: false, code: 'REVISION_ROLLBACK', path: 'canonical.revision', state };
  const reconciled = reconcileReactiveExperience(state, canonical);
  if (proposal.baseRevision !== canonical.revision) return { ok: false, code: 'STALE_REVISION', path: 'proposal.baseRevision', state: reconciled };

  const references = validateProjectionReferences(proposal, canonical);
  if (!references.ok) return { ...references, state: reconciled };
  if (!hasVisualSemantics(proposal)) return { ok: true, state: reconciled, deduplicated: false };

  const key = createExperienceSemanticKey(proposal);
  if (reconciled.recentSemanticKeys.includes(key)) return { ok: true, state: reconciled, deduplicated: true };

  const invalidEvidenceIds = collectInvalidEvidenceIds(canonical);
  const actions = proposal.intent.actions.map((action) => {
    const invalidatedReason = actionInvalidation(action, canonical, invalidEvidenceIds);
    return Object.freeze({
      sourceActionId: action.id,
      action,
      status: invalidatedReason === null ? 'active' as const : 'invalidated' as const,
      invalidatedReason,
    });
  });
  const processMutations = proposal.processMutations.map((mutation) => Object.freeze({ sourceMutationId: mutation.id, mutation }));
  const correctionSuggestions = projectCorrectionSuggestions(proposal.correctionProposals);
  const artifacts = projectArtifacts(proposal.artifactProposals, canonical);
  const scene = proposal.sceneProposal === null
    ? reconciled.scene
    : freezeReactiveScene({
      composition: proposal.sceneProposal.composition,
      focusIds: proposal.sceneProposal.focusIds,
      comparisonIds: proposal.sceneProposal.comparisonIds,
      announcement: proposal.sceneProposal.announcement,
    });

  const camera = createCameraIntent(proposal);
  let choreography = reconciled.choreography;
  if (camera.key !== null && camera.key !== reconciled.choreography.intentKey) {
    choreography = freezeExperienceChoreography({
      generation: reconciled.choreography.generation + 1,
      intentKey: camera.key,
      cameraTargetIds: camera.targets,
      interrupted: false,
    });
  }

  const nextActions = mergeActions(reconciled.actions, actions);
  const nextProcessMutations = mergeProcessMutations(reconciled.processMutations, processMutations);
  const nextCorrectionSuggestions = mergeCorrectionSuggestions(reconciled.correctionSuggestions, correctionSuggestions);
  const nextArtifacts = mergeArtifacts(reconciled.artifacts, artifacts);
  if (nextActions.length > REACTIVE_EXPERIENCE_LIMITS.actions) {
    return { ok: false, code: 'PROJECTION_CAPACITY_EXCEEDED', path: 'reactiveExperience.actions', state: reconciled };
  }
  if (nextProcessMutations.length > REACTIVE_EXPERIENCE_LIMITS.processMutations) {
    return { ok: false, code: 'PROJECTION_CAPACITY_EXCEEDED', path: 'reactiveExperience.processMutations', state: reconciled };
  }
  if (nextCorrectionSuggestions.length > REACTIVE_EXPERIENCE_LIMITS.correctionSuggestions) {
    return { ok: false, code: 'PROJECTION_CAPACITY_EXCEEDED', path: 'reactiveExperience.correctionSuggestions', state: reconciled };
  }
  if (nextArtifacts.length > REACTIVE_EXPERIENCE_LIMITS.artifacts) {
    return { ok: false, code: 'PROJECTION_CAPACITY_EXCEEDED', path: 'reactiveExperience.artifacts', state: reconciled };
  }

  const recentSemanticKeys = [...reconciled.recentSemanticKeys, key].slice(-REACTIVE_EXPERIENCE_LIMITS.recentSemanticKeys);
  return {
    ok: true,
    deduplicated: false,
    state: freezeReactiveExperienceState({
      ...reconciled,
      basedOnRevision: canonical.revision,
      projectionRevision: reconciled.projectionRevision + 1,
      actions: nextActions,
      processMutations: nextProcessMutations,
      correctionSuggestions: nextCorrectionSuggestions,
      artifacts: nextArtifacts,
      scene,
      choreography,
      recentSemanticKeys,
    }),
  };
}
