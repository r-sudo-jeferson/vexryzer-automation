import type { ExperienceAction } from './agent-intent.ts';
import type { ArtifactProposal, CorrectionProposal, ProcessMutationProposal } from './experience-proposal.ts';

export type ProjectedActionStatus = 'active' | 'invalidated';

export interface ProjectedAction {
  sourceActionId: string;
  action: Readonly<ExperienceAction>;
  status: ProjectedActionStatus;
  invalidatedReason: 'canonical-calculation-invalidated' | 'canonical-evidence-invalidated' | null;
}

export interface ProjectedProcessMutation {
  sourceMutationId: string;
  mutation: Readonly<ProcessMutationProposal>;
}

export interface ProjectedCorrectionSuggestion {
  sourceCorrectionId: string;
  correction: Readonly<CorrectionProposal>;
  status: 'pending' | 'invalidated';
  invalidatedReason: 'canonical-evidence-invalidated' | null;
}

export interface ProjectedArtifact {
  id: string;
  kind: ArtifactProposal['kind'];
  title: string;
  summary: string;
  evidenceIds: readonly string[];
  status: ArtifactProposal['status'];
  truthStatus: 'active' | 'invalidated';
  invalidatedReason: 'canonical-evidence-invalidated' | null;
  surfaceId: `artifact-${string}`;
  landmarkLabel: string;
}

export interface ReactiveSceneState {
  composition: 'stable' | 'focus' | 'compare' | 'overview' | 'artifact';
  focusIds: readonly string[];
  comparisonIds: readonly string[];
  announcement: string | null;
}

export interface ExperienceChoreographyState {
  generation: number;
  intentKey: string | null;
  cameraTargetIds: readonly string[];
  interrupted: boolean;
}

export interface ReactiveExperienceState {
  schemaVersion: 1;
  basedOnRevision: number;
  projectionRevision: number;
  actions: readonly Readonly<ProjectedAction>[];
  processMutations: readonly Readonly<ProjectedProcessMutation>[];
  correctionSuggestions: readonly Readonly<ProjectedCorrectionSuggestion>[];
  artifacts: readonly Readonly<ProjectedArtifact>[];
  scene: Readonly<ReactiveSceneState>;
  choreography: Readonly<ExperienceChoreographyState>;
  recentSemanticKeys: readonly string[];
}

export const REACTIVE_EXPERIENCE_LIMITS = Object.freeze({
  actions: 64,
  processMutations: 64,
  correctionSuggestions: 24,
  artifacts: 24,
  recentSemanticKeys: 16,
});

export function freezeStringList(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

export function freezeReactiveScene(scene: ReactiveSceneState): Readonly<ReactiveSceneState> {
  return Object.freeze({
    ...scene,
    focusIds: freezeStringList(scene.focusIds),
    comparisonIds: freezeStringList(scene.comparisonIds),
  });
}

export function freezeExperienceChoreography(
  choreography: ExperienceChoreographyState,
): Readonly<ExperienceChoreographyState> {
  return Object.freeze({ ...choreography, cameraTargetIds: freezeStringList(choreography.cameraTargetIds) });
}

export function freezeReactiveExperienceState(state: ReactiveExperienceState): Readonly<ReactiveExperienceState> {
  return Object.freeze({
    ...state,
    actions: Object.freeze([...state.actions]),
    processMutations: Object.freeze([...state.processMutations]),
    correctionSuggestions: Object.freeze([...state.correctionSuggestions]),
    artifacts: Object.freeze([...state.artifacts]),
    scene: freezeReactiveScene(state.scene),
    choreography: freezeExperienceChoreography(state.choreography),
    recentSemanticKeys: freezeStringList(state.recentSemanticKeys),
  });
}

export function createReactiveExperienceState(input: { basedOnRevision: number }): Readonly<ReactiveExperienceState> {
  if (!Number.isInteger(input.basedOnRevision) || input.basedOnRevision < 0) {
    throw new TypeError('basedOnRevision must be a non-negative integer');
  }
  return freezeReactiveExperienceState({
    schemaVersion: 1,
    basedOnRevision: input.basedOnRevision,
    projectionRevision: 0,
    actions: [],
    processMutations: [],
    correctionSuggestions: [],
    artifacts: [],
    scene: { composition: 'stable', focusIds: [], comparisonIds: [], announcement: null },
    choreography: { generation: 0, intentKey: null, cameraTargetIds: [], interrupted: false },
    recentSemanticKeys: [],
  });
}

export function interruptExperienceChoreography(
  state: Readonly<ReactiveExperienceState>,
): Readonly<ReactiveExperienceState> {
  if (state.choreography.interrupted && state.choreography.cameraTargetIds.length === 0) return state;
  return freezeReactiveExperienceState({
    ...state,
    choreography: freezeExperienceChoreography({
      ...state.choreography,
      cameraTargetIds: [],
      interrupted: true,
    }),
  });
}
