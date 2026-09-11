import type { AgentSessionRecord } from '../../session/agent-session.ts';
import type { AssembledToolCall } from '../providers/chat-sse.ts';
import {
  parseCriticReviewToolCall,
  type CriticWireToolResult,
} from '../critic/critic-wire-tools.ts';
import {
  parseSellerToolCall,
  type SellerWireToolResult,
} from '../seller/seller-wire-tools.ts';
import {
  validateDeepSeekHarnessBridgeRequest,
  type DeepSeekHarnessBridgeRequest,
  type DeepSeekHarnessBridgeRequestValidation,
  type DeepSeekHarnessBridgeResponse,
  type DeepSeekHarnessBridgeExecutionErrorCode,
} from './deepseek-harness-bridge-protocol.ts';

export interface DeepSeekHarnessBridgeAuthorizationDependencies {
  parseSellerToolCall: typeof parseSellerToolCall;
  parseCriticReviewToolCall: typeof parseCriticReviewToolCall;
}

export interface DeepSeekHarnessBridgeAuthorizationInput {
  value: unknown;
  session: Readonly<AgentSessionRecord>;
  nowEpochMs: number;
  signal?: AbortSignal;
  expectedCriticProposalId?: string;
  dependencies?: Partial<DeepSeekHarnessBridgeAuthorizationDependencies>;
}

export type AuthorizedDeepSeekHarnessBridgeTool =
  | {
      role: 'seller';
      request: Readonly<DeepSeekHarnessBridgeRequest>;
      parsed: Extract<SellerWireToolResult, { ok: true }>;
    }
  | {
      role: 'critic';
      request: Readonly<DeepSeekHarnessBridgeRequest>;
      parsed: Extract<CriticWireToolResult, { ok: true }>;
    };

export type DeepSeekHarnessBridgeAuthorizationResult =
  | { ok: true; authorized: Readonly<AuthorizedDeepSeekHarnessBridgeTool> }
  | {
      ok: false;
      stage: 'protocol';
      validation: Extract<DeepSeekHarnessBridgeRequestValidation, { ok: false }>;
    }
  | {
      ok: false;
      stage: 'authority';
      response: Readonly<Extract<DeepSeekHarnessBridgeResponse, { ok: false }>>;
    }
  | {
      ok: false;
      stage: 'tool';
      response: Readonly<Extract<DeepSeekHarnessBridgeResponse, { ok: false }>>;
      parserCode: string;
    };

const DEFAULT_DEPENDENCIES: Readonly<DeepSeekHarnessBridgeAuthorizationDependencies> = Object.freeze({
  parseSellerToolCall,
  parseCriticReviewToolCall,
});

function failure(
  request: Readonly<DeepSeekHarnessBridgeRequest>,
  canonicalRevision: number,
  code: DeepSeekHarnessBridgeExecutionErrorCode,
): Readonly<Extract<DeepSeekHarnessBridgeResponse, { ok: false }>> {
  return Object.freeze({
    schemaVersion: 1,
    bridgeRequestId: request.bridgeRequestId,
    toolName: request.toolName,
    ok: false,
    canonicalRevision,
    code,
  });
}

function authorityFailure(
  request: Readonly<DeepSeekHarnessBridgeRequest>,
  session: Readonly<AgentSessionRecord>,
  code: DeepSeekHarnessBridgeExecutionErrorCode,
): DeepSeekHarnessBridgeAuthorizationResult {
  return {
    ok: false,
    stage: 'authority',
    response: failure(request, session.canonical.revision, code),
  };
}

function cancellationCode(signal: AbortSignal): DeepSeekHarnessBridgeExecutionErrorCode {
  const reason = signal.reason;
  return reason instanceof DOMException && reason.name === 'TimeoutError'
    ? 'DEADLINE_EXCEEDED'
    : 'CANCELLED';
}

function toolCall(request: Readonly<DeepSeekHarnessBridgeRequest>): Readonly<AssembledToolCall> {
  return Object.freeze({
    id: request.bridgeRequestId,
    type: 'function' as const,
    function: Object.freeze({
      name: request.toolName,
      arguments: JSON.stringify(request.args),
    }),
  });
}

function toolFailure(
  request: Readonly<DeepSeekHarnessBridgeRequest>,
  session: Readonly<AgentSessionRecord>,
  parserCode: string,
): DeepSeekHarnessBridgeAuthorizationResult {
  return {
    ok: false,
    stage: 'tool',
    response: failure(request, session.canonical.revision, 'INVALID_ARGUMENTS'),
    parserCode,
  };
}

export function authorizeDeepSeekHarnessBridgeTool(
  input: Readonly<DeepSeekHarnessBridgeAuthorizationInput>,
): DeepSeekHarnessBridgeAuthorizationResult {
  const validation = validateDeepSeekHarnessBridgeRequest(input.value);
  if (!validation.ok) {
    return { ok: false, stage: 'protocol', validation };
  }
  const request = validation.request;
  const session = input.session;

  if (session.sessionId !== request.sessionId) {
    return authorityFailure(request, session, 'SESSION_MISMATCH');
  }
  if (session.status !== 'processing' || session.lease === null) {
    return authorityFailure(request, session, 'LEASE_MISMATCH');
  }
  if (session.lease.leaseId !== request.leaseId) {
    return authorityFailure(request, session, 'LEASE_MISMATCH');
  }
  if (session.lease.requestId !== request.requestId) {
    return authorityFailure(request, session, 'REQUEST_MISMATCH');
  }
  if (!Number.isSafeInteger(input.nowEpochMs) || input.nowEpochMs < 0) {
    return authorityFailure(request, session, 'EXECUTION_REJECTED');
  }
  if (session.lease.expiresAtEpochMs <= input.nowEpochMs) {
    return authorityFailure(request, session, 'LEASE_EXPIRED');
  }
  if (session.canonical.revision !== request.canonicalRevision) {
    return authorityFailure(request, session, 'STALE_REVISION');
  }
  if (input.signal?.aborted === true) {
    return authorityFailure(request, session, cancellationCode(input.signal));
  }

  const dependencies: Readonly<DeepSeekHarnessBridgeAuthorizationDependencies> = Object.freeze({
    ...DEFAULT_DEPENDENCIES,
    ...input.dependencies,
  });
  const call = toolCall(request);

  if (request.role === 'seller') {
    const parsed = dependencies.parseSellerToolCall(call, request.canonicalRevision);
    if (!parsed.ok) return toolFailure(request, session, parsed.code);
    return {
      ok: true,
      authorized: Object.freeze({
        role: 'seller',
        request,
        parsed,
      }),
    };
  }

  const expectedProposalId = input.expectedCriticProposalId;
  if (expectedProposalId === undefined) {
    return {
      ok: false,
      stage: 'tool',
      response: failure(request, session.canonical.revision, 'EXECUTION_REJECTED'),
      parserCode: 'MISSING_CRITIC_PROPOSAL_BINDING',
    };
  }

  const parsed = dependencies.parseCriticReviewToolCall(
    call,
    expectedProposalId,
    request.canonicalRevision,
  );
  if (!parsed.ok) return toolFailure(request, session, parsed.code);
  return {
    ok: true,
    authorized: Object.freeze({
      role: 'critic',
      request,
      parsed,
    }),
  };
}
