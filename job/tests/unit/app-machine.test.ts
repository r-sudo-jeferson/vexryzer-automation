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

  it('owns ASK AI request, accepted, recovery and error lifecycle without changing spatial mode', () => {
    const actor = createActor(appMachine).start();
    actor.send({ type: 'ASK_REQUESTED' });
    expect(actor.getSnapshot().value).toBe('origin');
    expect(actor.getSnapshot().context.agentStatus).toBe('requesting');

    actor.send({
      type: 'ASK_ACCEPTED',
      response: {
        ok: true,
        idempotent: false,
        mode: 'agent',
        narration: 'Há um gargalo de conferência.',
        nextQuestion: 'Quantas vezes isso ocorre por mês?',
        state: {
          sessionId: 'session-one',
          canonicalRevision: 2,
          verifiedCalculations: [],
          reactiveState: {
            schemaVersion: 1,
            basedOnRevision: 2,
            projectionRevision: 1,
            actions: [],
            processMutations: [],
            correctionSuggestions: [],
            artifacts: [],
            scene: { composition: 'stable', focusIds: [], comparisonIds: [], announcement: null },
            choreography: { generation: 0, intentKey: null, cameraTargetIds: [], interrupted: false },
            recentSemanticKeys: [],
          },
        },
      },
    });
    expect(actor.getSnapshot().context.agentStatus).toBe('awaiting_user');
    expect(actor.getSnapshot().context.agentNarration).toBe('Há um gargalo de conferência.');
    expect(actor.getSnapshot().context.agentQuestion).toBe('Quantas vezes isso ocorre por mês?');
    expect(actor.getSnapshot().context.agentState?.canonicalRevision).toBe(2);

    actor.send({ type: 'ASK_REQUESTED' });
    actor.send({ type: 'ASK_FAILED', code: 'STORE_UNAVAILABLE' });
    expect(actor.getSnapshot().context.agentStatus).toBe('error');
    expect(actor.getSnapshot().context.agentErrorCode).toBe('STORE_UNAVAILABLE');

    actor.send({ type: 'ASK_SESSION_RESET' });
    expect(actor.getSnapshot().context.agentStatus).toBe('idle');
    expect(actor.getSnapshot().context.agentState).toBeNull();
    expect(actor.getSnapshot().value).toBe('origin');
  });

  it('marks deterministic guided recovery distinctly from agent acceptance', () => {
    const actor = createActor(appMachine).start();
    actor.send({
      type: 'ASK_ACCEPTED',
      response: {
        ok: true,
        idempotent: false,
        mode: 'guided_recovery',
        narration: 'A análise automática está indisponível.',
        nextQuestion: 'Descreva a rotina mais crítica.',
        state: {
          sessionId: 'session-recovery',
          canonicalRevision: 1,
          verifiedCalculations: [],
          reactiveState: {
            schemaVersion: 1,
            basedOnRevision: 1,
            projectionRevision: 0,
            actions: [],
            processMutations: [],
            correctionSuggestions: [],
            artifacts: [],
            scene: { composition: 'stable', focusIds: [], comparisonIds: [], announcement: null },
            choreography: { generation: 0, intentKey: null, cameraTargetIds: [], interrupted: false },
            recentSemanticKeys: [],
          },
        },
      },
    });
    expect(actor.getSnapshot().context.agentStatus).toBe('recovery');
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
