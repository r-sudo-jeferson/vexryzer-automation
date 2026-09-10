export type ExperienceMode = 'origin' | 'process' | 'focus';

export interface ExperienceState {
  mode: ExperienceMode;
  focusedNodeId: string | null;
}

export type ExperienceEvent =
  | { type: 'ENTER_PROCESS' }
  | { type: 'FOCUS_NODE'; nodeId: string }
  | { type: 'EXIT_FOCUS' }
  | { type: 'RESET' };

export const initialExperienceState: ExperienceState = Object.freeze({
  mode: 'origin',
  focusedNodeId: null,
});

export function transitionExperience(state: ExperienceState, event: ExperienceEvent): ExperienceState {
  switch (event.type) {
    case 'RESET':
      return initialExperienceState;
    case 'ENTER_PROCESS':
      return state.mode === 'origin' ? { mode: 'process', focusedNodeId: null } : state;
    case 'FOCUS_NODE': {
      if (state.mode === 'origin') return state;
      const nodeId = event.nodeId.trim();
      if (!nodeId) throw new TypeError('nodeId is required');
      if (state.mode === 'focus' && state.focusedNodeId === nodeId) return state;
      return { mode: 'focus', focusedNodeId: nodeId };
    }
    case 'EXIT_FOCUS':
      return state.mode === 'focus' ? { mode: 'process', focusedNodeId: null } : state;
  }
}
