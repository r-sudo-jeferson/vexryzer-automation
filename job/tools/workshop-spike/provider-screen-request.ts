import type { StructuredToolCall } from './provider-screen-protocol.ts';

const TOOL_NAME = 'capture_signal' as const;

const tool = {
  type: 'function' as const,
  function: {
    name: TOOL_NAME,
    description: 'Returns one exact diagnostic marker supplied by the caller.',
    parameters: {
      type: 'object' as const,
      properties: { value: { type: 'string' as const } },
      required: ['value'] as const,
      additionalProperties: false,
    },
  },
};

export function buildStreamRequest(model: string, marker: string) {
  return {
    model,
    stream: true,
    messages: [{ role: 'user' as const, content: `Return exactly ${marker} and nothing else.` }],
  };
}

export function buildToolRequest(model: string, marker: string) {
  return {
    model,
    stream: false,
    messages: [{
      role: 'user' as const,
      content: `Call ${TOOL_NAME} exactly once with value equal to ${marker}. After the tool result, return that exact value.`,
    }],
    tools: [tool],
    tool_choice: 'required' as const,
  };
}

export function buildReplayRequest(model: string, call: StructuredToolCall, marker: string) {
  return {
    model,
    stream: false,
    messages: [
      {
        role: 'user' as const,
        content: `Call ${TOOL_NAME} exactly once with value equal to ${marker}. After the tool result, return that exact value.`,
      },
      {
        role: 'assistant' as const,
        content: null,
        tool_calls: [{
          id: call.id,
          type: 'function' as const,
          function: { name: call.name, arguments: call.argumentsJson },
        }],
      },
      {
        role: 'tool' as const,
        tool_call_id: call.id,
        name: call.name,
        content: JSON.stringify({ accepted: true, value: marker }),
      },
    ],
    tools: [tool],
    tool_choice: 'none' as const,
  };
}
