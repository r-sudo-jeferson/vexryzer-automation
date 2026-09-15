import { createCameraPlan, type CameraMode, type CameraPlan } from './camera.ts';

/**
 * Application-owned semantic Camera Director over the deterministic planner.
 *
 * The Director resolves narrative intent (composition, semantic targets,
 * announcement, saved user view, form factor) onto the backward-compatible
 * `origin|process|focus` + `fit-all|fit-nodes` plan vocabulary. The planner
 * stays the single owner of geometry and durations; the Director never
 * invents coordinates, transforms, zoom levels or durations.
 *
 * Target discipline: unknown ids are filtered, never guessed. An empty
 * resolved set falls back to the mode plan. Reduced motion always yields
 * duration 0 through the planner. Mobile framing is distinct by strategy
 * (multi-target directives condense to first-focus for touch reachability)
 * while durations stay planner-owned on both form factors.
 */

export type CameraDirectiveKind =
  | 'focus-object'
  | 'frame-region'
  | 'compare-targets'
  | 'reveal-sequence'
  | 'process-overview'
  | 'origin-reset'
  | 'restore-user-view'
  | 'guided-transition';

export type CameraSceneComposition = 'stable' | 'focus' | 'compare' | 'overview' | 'artifact';

export interface CameraDirectorInput {
  mode: CameraMode;
  focusedNodeId: string | null;
  targets: readonly string[];
  composition: CameraSceneComposition;
  announcement: string | null;
  knownNodeIds: readonly string[];
  mobile: boolean;
  reducedMotion: boolean;
  spatialCompanionVisible?: boolean;
}

export interface SavedUserView {
  mode: CameraMode;
  focusNodeId: string | null;
}

export interface CameraDirectorResolution {
  directive: CameraDirectiveKind;
  framing: 'desktop' | 'mobile-directed';
  targets: readonly string[];
  plan: CameraPlan;
}

function resolveKnownTargets(targets: readonly string[], knownNodeIds: readonly string[]): string[] {
  const known = new Set(knownNodeIds);
  return targets.filter((target) => known.has(target));
}

export function resolveCameraDirection(input: CameraDirectorInput): CameraDirectorResolution {
  const framing = input.mobile ? 'mobile-directed' : 'desktop';
  const planInput = { reducedMotion: input.reducedMotion };
  const targets = resolveKnownTargets(input.targets, input.knownNodeIds);
  const frameSpatialCompanion = (plan: CameraPlan): CameraPlan => {
    if (!input.mobile || input.spatialCompanionVisible !== true || plan.kind !== 'fit-nodes') return plan;
    const overviewPlan = createCameraPlan({ mode: 'process', ...planInput });
    return Object.freeze({ ...plan, padding: overviewPlan.padding, minZoom: overviewPlan.minZoom });
  };

  if (input.mode === 'origin') {
    return {
      directive: 'origin-reset',
      framing,
      targets,
      plan: createCameraPlan({ mode: 'origin', ...planInput }),
    };
  }

  const focusedKnown = input.focusedNodeId !== null && input.knownNodeIds.includes(input.focusedNodeId)
    ? input.focusedNodeId
    : null;

  if (targets.length === 0) {
    if (focusedKnown !== null) {
      return {
        directive: 'focus-object',
        framing,
        targets,
        plan: frameSpatialCompanion(createCameraPlan({ mode: 'focus', focusNodeId: focusedKnown, ...planInput })),
      };
    }
    return {
      directive: 'process-overview',
      framing,
      targets,
      plan: createCameraPlan({ mode: 'process', ...planInput }),
    };
  }

  if (input.announcement !== null) {
    return {
      directive: 'guided-transition',
      framing,
      targets,
      plan: frameSpatialCompanion(createCameraPlan({ mode: 'focus', focusNodeId: targets[0]!, ...planInput })),
    };
  }

  if (input.composition === 'overview') {
    return {
      directive: 'process-overview',
      framing,
      targets,
      plan: createCameraPlan({ mode: 'process', ...planInput }),
    };
  }

  if (input.composition === 'artifact') {
    return {
      directive: 'reveal-sequence',
      framing,
      targets,
      plan: frameSpatialCompanion(createCameraPlan({ mode: 'focus', focusNodeId: targets[0]!, ...planInput })),
    };
  }

  if (input.composition === 'compare' || targets.length >= 2) {
    if (input.mobile) {
      return {
        directive: input.composition === 'compare' ? 'compare-targets' : 'frame-region',
        framing,
        targets,
        plan: frameSpatialCompanion(createCameraPlan({ mode: 'focus', focusNodeId: targets[0]!, ...planInput })),
      };
    }
    return {
      directive: input.composition === 'compare' ? 'compare-targets' : 'frame-region',
      framing,
      targets,
      plan: createCameraPlan({ mode: 'process', ...planInput }),
    };
  }

  return {
    directive: 'focus-object',
    framing,
    targets,
    plan: frameSpatialCompanion(createCameraPlan({ mode: 'focus', focusNodeId: targets[0]!, ...planInput })),
  };
}

export function resolveRestoreUserView(
  savedView: SavedUserView,
  knownNodeIds: readonly string[],
  context: { mobile: boolean; reducedMotion: boolean },
): CameraDirectorResolution {
  const framing = context.mobile ? 'mobile-directed' : 'desktop';
  const planInput = { reducedMotion: context.reducedMotion };
  if (savedView.mode === 'origin') {
    return {
      directive: 'restore-user-view',
      framing,
      targets: [],
      plan: createCameraPlan({ mode: 'origin', ...planInput }),
    };
  }
  if (savedView.mode === 'process' || savedView.focusNodeId === null || !knownNodeIds.includes(savedView.focusNodeId)) {
    return {
      directive: 'restore-user-view',
      framing,
      targets: [],
      plan: createCameraPlan({ mode: 'process', ...planInput }),
    };
  }
  return {
    directive: 'restore-user-view',
    framing,
    targets: [savedView.focusNodeId],
    plan: createCameraPlan({ mode: 'focus', focusNodeId: savedView.focusNodeId, ...planInput }),
  };
}
