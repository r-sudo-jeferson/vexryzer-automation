import {
  buildServerChatHttpRequest,
  type LocalFunctionTool,
  type ProviderChatMessage,
  type ProviderServerConfig,
} from './openai-chat-wire.ts';
import { createChatSseDecoder, createChatStreamAccumulator, type AssembledChatStream } from './chat-sse.ts';
import { classifyHttpFailure, classifyTransportFailure } from './provider-http-errors.ts';
import type { ProviderRouteDefinition } from '../../../ai/providers/provider-registry.ts';

export type ProviderChatFailureClass =
  | 'access'
  | 'rate_limit'
  | 'capacity'
  | 'client'
  | 'unknown'
  | 'timeout'
  | 'cancelled'
  | 'network'
  | 'malformed';

export type ProviderChatClientResult =
  | { ok: true; completion: Readonly<AssembledChatStream> }
  | { ok: false; class: ProviderChatFailureClass; status: number | null; retryAfterMs: number | null };

const MAX_TIMEOUT_MS = 120_000;

export async function consumeProviderChatSseResponse(
  response: Response,
  nowMs = Date.now(),
): Promise<ProviderChatClientResult> {
  if (!response.ok) {
    const failure = classifyHttpFailure(response.status, response.headers, nowMs);
    return { ok: false, class: failure.class, status: response.status, retryAfterMs: failure.retryAfterMs };
  }

  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (!contentType.startsWith('text/event-stream') || response.body === null) {
    return { ok: false, class: 'malformed', status: response.status, retryAfterMs: null };
  }

  const decoder = createChatSseDecoder();
  const accumulator = createChatStreamAccumulator();
  const reader = response.body.getReader();
  let sawDone = false;

  const rejectMalformed = async (): Promise<ProviderChatClientResult> => {
    try {
      await reader.cancel();
    } catch {
      // Cancellation cleanup is best-effort and never changes the classified provider failure.
    }
    return { ok: false, class: 'malformed', status: response.status, retryAfterMs: null };
  };

  try {
    while (true) {
      let next: ReadableStreamReadResult<Uint8Array>;
      try {
        next = await reader.read();
      } catch {
        return { ok: false, class: 'network', status: response.status, retryAfterMs: null };
      }
      if (next.done) break;
      try {
        for (const event of decoder.push(next.value)) {
          if (event.type === 'done') sawDone = true;
          else accumulator.accept(event.data);
        }
      } catch {
        return await rejectMalformed();
      }
    }

    try {
      for (const event of decoder.finish()) {
        if (event.type === 'done') sawDone = true;
        else accumulator.accept(event.data);
      }
      if (!sawDone) return { ok: false, class: 'malformed', status: response.status, retryAfterMs: null };
      return { ok: true, completion: accumulator.finish() };
    } catch {
      return await rejectMalformed();
    }
  } finally {
    reader.releaseLock();
  }
}

function createAbortContext(parent: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  timeoutTriggered: () => boolean;
  cleanup: () => void;
} {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > MAX_TIMEOUT_MS) {
    throw new TypeError('timeoutMs is invalid');
  }
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException('Provider request timed out', 'TimeoutError'));
  }, timeoutMs);

  const abortFromParent = () => controller.abort(parent?.reason);
  if (parent?.aborted) abortFromParent();
  else parent?.addEventListener('abort', abortFromParent, { once: true });

  return {
    signal: controller.signal,
    timeoutTriggered: () => timedOut,
    cleanup: () => {
      clearTimeout(timeout);
      parent?.removeEventListener('abort', abortFromParent);
    },
  };
}

export async function executeProviderChatStream(input: {
  route: Readonly<ProviderRouteDefinition>;
  serverConfig: Readonly<ProviderServerConfig>;
  apiToken: string;
  messages: readonly ProviderChatMessage[];
  tools: readonly LocalFunctionTool[];
  timeoutMs: number;
  signal?: AbortSignal;
}): Promise<ProviderChatClientResult> {
  const request = buildServerChatHttpRequest({
    route: input.route,
    serverConfig: input.serverConfig,
    apiToken: input.apiToken,
    messages: input.messages,
    tools: input.tools,
  });
  const abort = createAbortContext(input.signal, input.timeoutMs);

  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      signal: abort.signal,
    });
    const result = await consumeProviderChatSseResponse(response);
    if (!result.ok && result.class === 'network' && abort.signal.aborted) {
      const failure = classifyTransportFailure({
        aborted: true,
        timeoutTriggered: abort.timeoutTriggered(),
      });
      return { ok: false, class: failure.class, status: result.status, retryAfterMs: null };
    }
    return result;
  } catch {
    const failure = classifyTransportFailure({
      aborted: abort.signal.aborted,
      timeoutTriggered: abort.timeoutTriggered(),
    });
    return { ok: false, class: failure.class, status: null, retryAfterMs: null };
  } finally {
    abort.cleanup();
  }
}
