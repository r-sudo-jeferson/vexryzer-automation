import { assign, setup } from 'xstate';
import type {
  AskAiAcceptedResponse,
  AskAiCorrectionAcceptedResponse,
  AskAiPublicState,
} from './ask-ai-client.ts';

export type AgentExperienceStatus = 'idle' | 'requesting' | 'correcting' | 'awaiting_user' | 'recovery' | 'error';

export interface AppMachineContext {
  focusedNodeId: string | null;
  agentStatus: AgentExperienceStatus;
  agentState: Readonly<AskAiPublicState> | null;
  agentNarration: string | null;
  agentQuestion: string | null;
  agentErrorCode: string | null;
}

export type AppMachineEvent =
  | { type: 'ENTER_PROCESS' }
  | { type: 'FOCUS_NODE'; nodeId: string }
  | { type: 'EXIT_FOCUS' }
  | { type: 'RESET' }
  | { type: 'ASK_REQUESTED' }
  | { type: 'ASK_ACCEPTED'; response: Readonly<AskAiAcceptedResponse> }
  | { type: 'ASK_FAILED'; code: string }
  | { type: 'CORRECTION_REQUESTED' }
  | { type: 'CORRECTION_ACCEPTED'; response: Readonly<AskAiCorrectionAcceptedResponse> }
  | { type: 'CORRECTION_FAILED'; code: string }
  | { type: 'ASK_SESSION_RESET' };

const initialAgentContext = Object.freeze({
  agentStatus: 'idle' as const,
  agentState: null,
  agentNarration: null,
  agentQuestion: null,
  agentErrorCode: null,
});

export const appMachine = setup({
  types: {
    context: {} as AppMachineContext,
    events: {} as AppMachineEvent,
  },
  guards: {
    hasValidNodeId: ({ event }) => event.type === 'FOCUS_NODE' && event.nodeId.trim().length > 0,
    hasErrorCode: ({ event }) =>
      (event.type === 'ASK_FAILED' || event.type === 'CORRECTION_FAILED')
      && event.code.trim().length > 0,
  },
  actions: {
    setFocus: assign({
      focusedNodeId: ({ event }) => event.type === 'FOCUS_NODE' ? event.nodeId.trim() : null,
    }),
    clearFocus: assign({ focusedNodeId: null }),
    markAskRequested: assign({
      agentStatus: 'requesting',
      agentErrorCode: null,
    }),
    acceptAsk: assign(({ event }) => {
      if (event.type !== 'ASK_ACCEPTED') return {};
      return {
        agentStatus: event.response.mode === 'guided_recovery' ? 'recovery' : 'awaiting_user',
        agentState: event.response.state,
        agentNarration: event.response.narration,
        agentQuestion: event.response.nextQuestion,
        agentErrorCode: null,
      };
    }),
    markCorrectionRequested: assign({
      agentStatus: 'correcting',
      agentErrorCode: null,
    }),
    acceptCorrection: assign(({ event }) => event.type === 'CORRECTION_ACCEPTED'
      ? {
          agentStatus: 'awaiting_user' as const,
          agentState: event.response.state,
          agentErrorCode: null,
        }
      : {}),
    failAsk: assign(({ event }) =>
      event.type === 'ASK_FAILED' || event.type === 'CORRECTION_FAILED'
        ? {
            agentStatus: 'error' as const,
            agentErrorCode: event.code.trim(),
          }
        : {}),
    resetAgent: assign({
      ...initialAgentContext,
    }),
  },
}).createMachine({
  id: 'vxa-experience',
  initial: 'origin',
  context: {
    focusedNodeId: null,
    ...initialAgentContext,
  },
  on: {
    ASK_REQUESTED: { actions: 'markAskRequested' },
    ASK_ACCEPTED: { actions: 'acceptAsk' },
    ASK_FAILED: { guard: 'hasErrorCode', actions: 'failAsk' },
    CORRECTION_REQUESTED: { actions: 'markCorrectionRequested' },
    CORRECTION_ACCEPTED: { actions: 'acceptCorrection' },
    CORRECTION_FAILED: { guard: 'hasErrorCode', actions: 'failAsk' },
    ASK_SESSION_RESET: { actions: 'resetAgent' },
  },
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
