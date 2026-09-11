import { CRITIC_TOOL_NAME } from '../critic/critic-wire-tools.ts';
import { SELLER_TOOL_NAMES } from '../seller/seller-wire-tools.ts';

export const DEEPSEEK_HARNESS_VISITOR_PROFILE = Object.freeze({
  harness: 'DeepSeek-Harness',
  version: '0.1.5-rc.1',
  providerFamily: 'deepseek',
  modelId: 'deepseek-v4-pro',
  credentialEnvName: 'DEEPSEEK_API_KEY',
  credentialScope: 'server',
  toolPresentationMode: 'native',
  trustAuthority: 'vexryzer_deterministic_trust_kernel',
  unrestrictedShell: false,
  unrestrictedFilesystem: false,
  arbitraryCodeExecution: false,
  dynamicPluginRegistration: false,
  unrestrictedNetworkTools: false,
  codeModeTransport: false,
} as const);

export type DeepSeekHarnessAgentRole = 'seller' | 'critic';

export const DEEPSEEK_HARNESS_ALLOWED_TOOL_NAMES: Readonly<
  Record<DeepSeekHarnessAgentRole, readonly string[]>
> = Object.freeze({
  seller: Object.freeze([...SELLER_TOOL_NAMES]),
  critic: Object.freeze([CRITIC_TOOL_NAME]),
});

export type DeepSeekHarnessToolSurfaceErrorCode =
  | 'INVALID_TOOL_NAME'
  | 'DUPLICATE_TOOL'
  | 'FORBIDDEN_TOOL'
  | 'UNAUTHORIZED_TOOL'
  | 'MISSING_REQUIRED_TOOL';

export type DeepSeekHarnessToolSurfaceValidation =
  | { ok: true; toolNames: readonly string[] }
  | {
      ok: false;
      code: DeepSeekHarnessToolSurfaceErrorCode;
      toolName: string | null;
    };

const SAFE_TOOL_NAME = /^[a-z][a-z0-9_]{0,95}$/;

const FORBIDDEN_TOOL_NAMES = new Set([
  'run_code',
  'bash',
  'shell',
  'exec',
  'execute',
  'terminal',
  'pwsh',
  'powershell',
  'read_file',
  'write_file',
  'edit_file',
  'filesystem',
  'str_replace_editor',
  'curl',
  'wget',
  'http_request',
  'fetch_url',
  'web',
  'browser',
  'subagent',
  'spawn_agent',
  'jobs',
  'cordis_define',
  'cordis_run',
  'cordis_mount',
  'cordis_inspect',
]);

const FORBIDDEN_TOOL_SEGMENTS = Object.freeze([
  'shell',
  'bash',
  'filesystem',
  'file_write',
  'write_file',
  'editor',
  'exec',
  'terminal',
  'command',
  'dynamic_plugin',
  'run_code',
]);

function forbiddenToolName(name: string): boolean {
  if (FORBIDDEN_TOOL_NAMES.has(name)) return true;
  return FORBIDDEN_TOOL_SEGMENTS.some((segment) => name.includes(segment));
}

export function validateDeepSeekHarnessToolSurface(
  role: DeepSeekHarnessAgentRole,
  toolNames: readonly string[],
): DeepSeekHarnessToolSurfaceValidation {
  const expected = DEEPSEEK_HARNESS_ALLOWED_TOOL_NAMES[role];
  const actual = new Set<string>();

  for (const toolName of toolNames) {
    if (!SAFE_TOOL_NAME.test(toolName)) {
      return { ok: false, code: 'INVALID_TOOL_NAME', toolName };
    }
    if (actual.has(toolName)) {
      return { ok: false, code: 'DUPLICATE_TOOL', toolName };
    }
    if (forbiddenToolName(toolName)) {
      return { ok: false, code: 'FORBIDDEN_TOOL', toolName };
    }
    if (!expected.includes(toolName)) {
      return { ok: false, code: 'UNAUTHORIZED_TOOL', toolName };
    }
    actual.add(toolName);
  }

  for (const required of expected) {
    if (!actual.has(required)) {
      return { ok: false, code: 'MISSING_REQUIRED_TOOL', toolName: required };
    }
  }

  return {
    ok: true,
    toolNames: Object.freeze([...toolNames]),
  };
}

export function assertDeepSeekHarnessVisitorProfile(): typeof DEEPSEEK_HARNESS_VISITOR_PROFILE {
  const profile = DEEPSEEK_HARNESS_VISITOR_PROFILE;
  if (profile.harness !== 'DeepSeek-Harness'
    || profile.version !== '0.1.5-rc.1'
    || profile.providerFamily !== 'deepseek'
    || profile.modelId !== 'deepseek-v4-pro'
    || profile.credentialEnvName !== 'DEEPSEEK_API_KEY'
    || profile.credentialScope !== 'server'
    || profile.toolPresentationMode !== 'native'
    || profile.unrestrictedShell
    || profile.unrestrictedFilesystem
    || profile.arbitraryCodeExecution
    || profile.dynamicPluginRegistration
    || profile.unrestrictedNetworkTools
    || profile.codeModeTransport) {
    throw new Error('DEEPSEEK_HARNESS_VISITOR_PROFILE_UNSAFE');
  }
  return profile;
}
