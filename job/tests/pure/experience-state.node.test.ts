import test from 'node:test';
import assert from 'node:assert/strict';
import { initialExperienceState, transitionExperience } from '../../src/app/experience-state.ts';

test('experience follows origin -> process -> focus and back deterministically', () => {
  const process = transitionExperience(initialExperienceState, { type: 'ENTER_PROCESS' });
  assert.deepEqual(process, { mode: 'process', focusedNodeId: null });

  const focus = transitionExperience(process, { type: 'FOCUS_NODE', nodeId: 'manual-review' });
  assert.deepEqual(focus, { mode: 'focus', focusedNodeId: 'manual-review' });

  const back = transitionExperience(focus, { type: 'EXIT_FOCUS' });
  assert.deepEqual(back, { mode: 'process', focusedNodeId: null });
});

test('duplicate and invalid focus events never corrupt state', () => {
  assert.deepEqual(transitionExperience(initialExperienceState, { type: 'RESET' }), initialExperienceState);
  assert.deepEqual(transitionExperience(initialExperienceState, { type: 'FOCUS_NODE', nodeId: 'manual-review' }), initialExperienceState);
  assert.throws(() => transitionExperience({ mode: 'process', focusedNodeId: null }, { type: 'FOCUS_NODE', nodeId: '   ' }), /nodeId/);
});
