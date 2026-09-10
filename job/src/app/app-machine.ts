import { assign, setup } from 'xstate';

export interface AppMachineContext {
  focusedNodeId: string | null;
}

export type AppMachineEvent =
  | { type: 'ENTER_PROCESS' }
  | { type: 'FOCUS_NODE'; nodeId: string }
  | { type: 'EXIT_FOCUS' }
  | { type: 'RESET' };

export const appMachine = setup({
  types: {
    context: {} as AppMachineContext,
    events: {} as AppMachineEvent,
  },
  guards: {
    hasValidNodeId: ({ event }) => event.type === 'FOCUS_NODE' && event.nodeId.trim().length > 0,
  },
  actions: {
    setFocus: assign({
      focusedNodeId: ({ event }) => event.type === 'FOCUS_NODE' ? event.nodeId.trim() : null,
    }),
    clearFocus: assign({ focusedNodeId: null }),
  },
}).createMachine({
  id: 'vxa-experience',
  initial: 'origin',
  context: { focusedNodeId: null },
  states: {
    origin: {
      on: {
        ENTER_PROCESS: { target: 'process', actions: 'clearFocus' },
        RESET: { actions: 'clearFocus' },
      },
    },
    process: {
      on: {
        FOCUS_NODE: { target: 'focus', guard: 'hasValidNodeId', actions: 'setFocus' },
        RESET: { target: 'origin', actions: 'clearFocus' },
        ENTER_PROCESS: {},
      },
    },
    focus: {
      on: {
        FOCUS_NODE: { guard: 'hasValidNodeId', actions: 'setFocus' },
        EXIT_FOCUS: { target: 'process', actions: 'clearFocus' },
        ENTER_PROCESS: { target: 'process', actions: 'clearFocus' },
        RESET: { target: 'origin', actions: 'clearFocus' },
      },
    },
  },
});
