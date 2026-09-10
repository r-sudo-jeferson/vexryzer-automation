import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeViewState, encodeViewState } from '../../src/app/view-state.ts';

test('view state round-trips origin, process and valid focus without sensitive data', () => {
  assert.equal(encodeViewState({ mode: 'origin', focusedNodeId: null }), '#origin');
  assert.deepEqual(decodeViewState('#process', ['node-a']), { mode: 'process', focusedNodeId: null });
  const hash = encodeViewState({ mode: 'focus', focusedNodeId: 'node-a' });
  assert.equal(hash, '#focus=node-a');
  assert.deepEqual(decodeViewState(hash, ['node-a']), { mode: 'focus', focusedNodeId: 'node-a' });
});

test('unknown or malformed focus degrades safely to process', () => {
  assert.deepEqual(decodeViewState('#focus=unknown', ['node-a']), { mode: 'process', focusedNodeId: null });
  assert.deepEqual(decodeViewState('#focus=', ['node-a']), { mode: 'process', focusedNodeId: null });
  assert.deepEqual(decodeViewState('#something-else', ['node-a']), { mode: 'origin', focusedNodeId: null });
});
