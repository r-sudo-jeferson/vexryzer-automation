import { describe, expect, it } from 'vitest';
import { createActor } from 'xstate';
import { appMachine } from '../../src/app/app-machine.ts';

describe('app machine', () => {
  it('moves through origin, process and focus deterministically', () => {
    const actor = createActor(appMachine).start();
    expect(actor.getSnapshot().value).toBe('origin');
    actor.send({ type: 'ENTER_PROCESS' });
    expect(actor.getSnapshot().value).toBe('process');
    actor.send({ type: 'FOCUS_NODE', nodeId: 'manual-review' });
    expect(actor.getSnapshot().value).toBe('focus');
    expect(actor.getSnapshot().context.focusedNodeId).toBe('manual-review');
    actor.send({ type: 'EXIT_FOCUS' });
    expect(actor.getSnapshot().value).toBe('process');
    expect(actor.getSnapshot().context.focusedNodeId).toBeNull();
  });

  it('ignores focus attempts from origin and invalid focus ids', () => {
    const actor = createActor(appMachine).start();
    actor.send({ type: 'FOCUS_NODE', nodeId: 'manual-review' });
    expect(actor.getSnapshot().value).toBe('origin');
    actor.send({ type: 'ENTER_PROCESS' });
    actor.send({ type: 'FOCUS_NODE', nodeId: '   ' });
    expect(actor.getSnapshot().value).toBe('process');
    expect(actor.getSnapshot().context.focusedNodeId).toBeNull();
  });
});
