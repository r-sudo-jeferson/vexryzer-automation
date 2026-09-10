import { join } from 'node:path';
import { buildPackageInstallEnv } from './spike-config.ts';

export const OPENCODE_VERSION = '1.18.30' as const;
export const OPENCODE_PROVIDER_ID = 'vxa-groq' as const;
export const OPENCODE_MODEL_ID = 'openai/gpt-oss-120b' as const;
export const OPENCODE_CREDENTIAL_REF = 'GROQ_API_KEY' as const;
export const OPENCODE_PROVIDER_BASE_URL = 'https://api.groq.com/openai/v1' as const;

function requireSafeAbsoluteLikePath(name: string, value: string): void {
  if (!value.trim()) throw new TypeError(`${name} is required`);
  if (value.includes('\0') || /[\r\n]/.test(value)) throw new TypeError(`${name} contains unsafe characters`);
}

function requireOpenCodeProviderInput(input: { modelId: string; credentialRef: string }): void {
  if (input.modelId !== OPENCODE_MODEL_ID) {
    throw new TypeError(`OpenCode Workshop model must be exactly ${OPENCODE_MODEL_ID}`);
  }
  if (input.credentialRef !== OPENCODE_CREDENTIAL_REF) {
    throw new TypeError(`OpenCode Workshop credential must be exactly ${OPENCODE_CREDENTIAL_REF}`);
  }
}

export function renderOpenCodeInstallPackageJson(): string {
  return `${JSON.stringify({
    private: true,
    packageManager: 'pnpm@11.25.0',
    dependencies: {
      'opencode-ai': OPENCODE_VERSION,
    },
  }, null, 2)}\n`;
}

export function renderOpenCodeInstallWorkspaceYaml(): string {
  return [
    'allowBuilds:',
    `  'opencode-ai@${OPENCODE_VERSION}': true`,
    '',
  ].join('\n');
}

export function renderOpenCodeConfig(input: { modelId: string; credentialRef: string }): string {
  requireOpenCodeProviderInput(input);
  return `${JSON.stringify({
    $schema: 'https://opencode.ai/config.json',
    share: 'disabled',
    autoupdate: false,
    model: `${OPENCODE_PROVIDER_ID}/${input.modelId}`,
    permission: {
      '*': 'deny',
      read: 'allow',
      edit: 'allow',
      bash: 'deny',
      task: 'deny',
      skill: 'deny',
      lsp: 'deny',
      question: 'deny',
      webfetch: 'deny',
      websearch: 'deny',
      external_directory: 'deny',
      doom_loop: 'deny',
    },
    provider: {
      [OPENCODE_PROVIDER_ID]: {
        npm: '@ai-sdk/openai-compatible',
        name: 'Vexryzer Workshop Groq',
        options: {
          baseURL: OPENCODE_PROVIDER_BASE_URL,
          apiKey: `{env:${input.credentialRef}}`,
        },
        models: {
          [input.modelId]: {
            name: 'GPT OSS 120B',
          },
        },
      },
    },
  }, null, 2)}\n`;
}

export interface OpenCodeRuntimeEnvInput {
  stateRoot: string;
  configPath: string;
  credentialRef: string;
  credentialValue: string;
}

export function buildOpenCodeRuntimeEnv(
  parentEnv: NodeJS.ProcessEnv,
  input: OpenCodeRuntimeEnvInput,
): NodeJS.ProcessEnv {
  requireSafeAbsoluteLikePath('stateRoot', input.stateRoot);
  requireSafeAbsoluteLikePath('configPath', input.configPath);
  requireOpenCodeProviderInput({ modelId: OPENCODE_MODEL_ID, credentialRef: input.credentialRef });
  if (!input.credentialValue.trim() || /[\r\n\0]/.test(input.credentialValue)) {
    throw new TypeError(`${input.credentialRef} is required and must not contain control characters`);
  }

  const env = buildPackageInstallEnv(parentEnv);
  env.HOME = join(input.stateRoot, 'home');
  env.XDG_CONFIG_HOME = join(input.stateRoot, 'xdg-config');
  env.XDG_DATA_HOME = join(input.stateRoot, 'xdg-data');
  env.XDG_CACHE_HOME = join(input.stateRoot, 'xdg-cache');
  env.TMPDIR = join(input.stateRoot, 'tmp');
  env.OPENCODE_CONFIG = input.configPath;
  env.OPENCODE_CONFIG_DIR = join(input.stateRoot, 'config-dir');
  env.OPENCODE_DISABLE_AUTOUPDATE = 'true';
  env.OPENCODE_DISABLE_PRUNE = 'true';
  env.OPENCODE_AUTO_SHARE = 'false';
  env.NO_COLOR = '1';
  env[input.credentialRef] = input.credentialValue;
  return env;
}
