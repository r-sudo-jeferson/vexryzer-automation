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
  isDeepSeekHarnessToolAllowed,
  type DeepSeekHarnessAgentRole,
} from './deepseek-harness-visitor-policy.ts';

export const DEEPSEEK_HARNESS_TOOL_ARGUMENT_LIMITS = Object.freeze({
  sellerBytes: 1_000_000,
  criticBytes: 256_000,
  callIdLength: 256,
} as const);

export interface DeepSeekHarnessToolAuthority {
  sessionId: string;
  leaseId: string;
  requestId: string;
  canonicalRevision: number;
  nowEpochMs: number;
}

export interface DeepSeekHarnessToolAuthorizationDependencies {
  parseSellerToolCall: typeof parseSellerToolCall;
  parseCriticReviewToolCall: typeof parseCriticReviewToolCall;
}

export interface DeepSeekHarnessToolAuthorizationInput {
  role: DeepSeekHarnessAgentRole;
  callId: string;
  toolName: string;
  arguments: unknown;
  authority: Readonly<DeepSeekHarnessToolAuthority>;
  session: Readonly<AgentSessionRecord>;
  signal?: AbortSignal;
  expectedCriticProposalId?: string;
  dependencies?: Partial<DeepSeekHarnessToolAuthorizationDependencies>;
}

export type AuthorizedDeepSeekHarnessTool =
  | {
      role: 'seller';
      authority: Readonly<DeepSeekHarnessToolAuthority>;
      parsed: Extract<SellerWireToolResult, { ok: true }>;
    }
  | {
      role: 'critic';
      authority: Readonly<DeepSeekHarnessToolAuthority>;
      parsed: Extract<CriticWireToolResult, { ok: true }>;
    };

export type DeepSeekHarnessToolAuthorizationFailureCode =
  | 'INVALID_CALL_ID'
  | 'INVALID_AUTHORITY'
  | 'UNAUTHORIZED_TOOL'
  | 'SESSION_MISMATCH'
  | 'LEASE_MISMATCH'
  | 'REQUEST_MISMATCH'
  | 'LEASE_EXPIRED'
  | 'STALE_REVISION'
  | 'CANCELLED'
  | 'DEADLINE_EXCEEDED'
  | 'ARGUMENT_LIMIT_EXCEEDED'
  | 'INVALID_ARGUMENTS'
  | 'MISSING_CRITIC_PROPOSAL_BINDING';

export type DeepSeekHarnessToolAuthorizationResult =
  | { ok: true; authorized: Readonly<AuthorizedDeepSeekHarnessTool> }
  | {
      ok: false;
      code: DeepSeekHarnessToolAuthorizationFailureCode;
      parserCode?: string;
    };

const DEFAULT_DEPENDENCIES: Readonly<DeepSeekHarnessToolAuthorizationDependencies> = Object.freeze({
  parseSellerToolCall,
  parseCriticReviewToolCall,
});

const CONTROL = /[\u0000-\u001F\u007F]/;
const SAFE_AUTHORITY_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function safeAuthorityId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= 96
    && SAFE_AUTHORITY_ID.test(value);
}

function validCallId(value: unknown): value is string {
  return typeof value === 'string'
    && value.length >= 1
    && value.length <= DEEPSEEK_HARNESS_TOOL_ARGUMENT_LIMITS.callIdLength
    && !CONTROL.test(value);
}

function validAuthority(value: Readonly<DeepSeekHarnessToolAuthority>): boolean {
  return safeAuthorityId(value.sessionId)
    && safeAuthorityId(value.leaseId)
    && safeAuthorityId(value.requestId)
    && Number.isSafeInteger(value.canonicalRevision)
    && value.canonicalRevision >= 0
    && Number.isSafeInteger(value.nowEpochMs)
    && value.nowEpochMs >= 0;
}

function cancellationCode(signal: AbortSignal): 'CANCELLED' | 'DEADLINE_EXCEEDED' {
  const reason: unknown = signal.reason;
  return reason instanceof DOMException && reason.name === 'TimeoutError'
    ? 'DEADLINE_EXCEEDED'
    : 'CANCELLED';
}

function serializedArguments(
  role: DeepSeekHarnessAgentRole,
  value: unknown,
): { ok: true; json: string } | { ok: false; code: 'INVALID_ARGUMENTS' | 'ARGUMENT_LIMIT_EXCEEDED' } {
  let json: string;
  try {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) return { ok: false, code: 'INVALID_ARGUMENTS' };
    json = encoded;
  } catch {
    return { ok: false, code: 'INVALID_ARGUMENTS' };
  }

  const bytes = new TextEncoder().encode(json).byteLength;
  const limit = role === 'seller'
    ? DEEPSEEK_HARNESS_TOOL_ARGUMENT_LIMITS.sellerBytes
    : DEEPSEEK_HARNESS_TOOL_ARGUMENT_LIMITS.criticBytes;
  return bytes <= limit
    ? { ok: true, json }
    : { ok: false, code: 'ARGUMENT_LIMIT_EXCEEDED' };
}

function asToolCall(
  callId: string,
  toolName: string,
  argumentsJson: string,
): Readonly<AssembledToolCall> {
  return Object.freeze({
    id: callId,
    type: 'function' as const,
    function: Object.freeze({
      name: toolName,
      arguments: argumentsJson,
    }),
  });
}

function frozenAuthority(
  authority: Readonly<DeepSeekHarnessToolAuthority>,
): Readonly<DeepSeekHarnessToolAuthority> {
  return Object.freeze({ ...authority });
}

export function authorizeDeepSeekHarnessTool(
  input: Readonly<DeepSeekHarnessToolAuthorizationInput>,
): DeepSeekHarnessToolAuthorizationResult {
  if (!validCallId(input.callId)) return { ok: false, code: 'INVALID_CALL_ID' };
  if (!validAuthority(input.authority)) return { ok: false, code: 'INVALID_AUTHORITY' };
  if (!isDeepSeekHarnessToolAllowed(input.role, input.toolName)) {
    return { ok: false, code: 'UNAUTHORIZED_TOOL' };
  }

  const { authority, session } = input;
  if (session.sessionId !== authority.sessionId) return { ok: false, code: 'SESSION_MISMATCH' };
  if (session.status !== 'processing' || session.lease === null) {
    return { ok: false, code: 'LEASE_MISMATCH' };
  }
  if (session.lease.leaseId !== authority.leaseId) return { ok: false, code: 'LEASE_MISMATCH' };
  if (session.lease.requestId !== authority.requestId) return { ok: false, code: 'REQUEST_MISMATCH' };
  if (session.lease.expiresAtEpochMs <= authority.nowEpochMs) return { ok: false, code: 'LEASE_EXPIRED' };
  if (session.canonical.revision !== authority.canonicalRevision) return { ok: false, code: 'STALE_REVISION' };
  if (input.signal?.aborted === true) return { ok: false, code: cancellationCode(input.signal) };

  const serialized = serializedArguments(input.role, input.arguments);
  if (!serialized.ok) return serialized;
  const call = asToolCall(input.callId, input.toolName, serialized.json);
  const dependencies: Readonly<DeepSeekHarnessToolAuthorizationDependencies> = Object.freeze({
    ...DEFAULT_DEPENDENCIES,
    ...input.dependencies,
  });
  const trustedAuthority = frozenAuthority(authority);

  if (input.role === 'seller') {
    const parsed = dependencies.parseSellerToolCall(call, authority.canonicalRevision);
    if (!parsed.ok) {
      return { ok: false, code: 'INVALID_ARGUMENTS', parserCode: parsed.code };
    }
    return {
      ok: true,
      authorized: Object.freeze({
        role: 'seller',
        authority: trustedAuthority,
        parsed,
      }),
    };
  }

  if (input.expectedCriticProposalId === undefined) {
    return { ok: false, code: 'MISSING_CRITIC_PROPOSAL_BINDING' };
  }

  const parsed = dependencies.parseCriticReviewToolCall(
    call,
    input.expectedCriticProposalId,
    authority.canonicalRevision,
  );
  if (!parsed.ok) {
    return { ok: false, code: 'INVALID_ARGUMENTS', parserCode: parsed.code };
  }
  return {
    ok: true,
    authorized: Object.freeze({
      role: 'critic',
      authority: trustedAuthority,
      parsed,
    }),
  };
}
