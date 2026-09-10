import type { ExperienceState } from './experience-state.ts';

export function encodeViewState(state: ExperienceState): string {
  if (state.mode === 'origin') return '#origin';
  if (state.mode === 'process') return '#process';
  return state.focusedNodeId ? `#focus=${encodeURIComponent(state.focusedNodeId)}` : '#process';
}

export function decodeViewState(hash: string, validNodeIds: readonly string[]): ExperienceState {
  if (hash === '#process') return { mode: 'process', focusedNodeId: null };
  if (hash.startsWith('#focus=')) {
    const raw = hash.slice('#focus='.length);
    let nodeId = '';
    try { nodeId = decodeURIComponent(raw).trim(); } catch { return { mode: 'process', focusedNodeId: null }; }
    if (nodeId && validNodeIds.includes(nodeId)) return { mode: 'focus', focusedNodeId: nodeId };
    return { mode: 'process', focusedNodeId: null };
  }
  return { mode: 'origin', focusedNodeId: null };
}
