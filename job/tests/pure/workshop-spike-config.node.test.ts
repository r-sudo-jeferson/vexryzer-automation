import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSpikeRuntimeVersions,
  buildHarnessSdkOptions,
  buildPackageInstallEnv,
  buildScrubbedHarnessEnv,
  DEFAULT_MISTRAL_MODEL_ID,
  MISTRAL_RATE_LIMIT_WINDOW_MS,
  MISTRAL_SPIKE_MAX_RETRIES,
  renderHarnessInstallPackageJson,
  renderHarnessInstallWorkspaceYaml,
  renderMistralMinimalProfilePatchYaml,
  resolveHarnessCandidateVersion,
  sanitizeSpikeDiagnostic,
  validateSpikeInputs,
} from '../../tools/workshop-spike/spike-config.ts';

test('scrubs unrelated secrets from the Harness child environment', () => {
  const env = buildScrubbedHarnessEnv({
    PATH: '/usr/bin',
    HOME: '/home/test',
    HTTPS_PROXY: 'http://proxy.test',
    OPENAI_API_KEY: 'must-not-pass',
    AWS_SECRET_ACCESS_KEY: 'must-not-pass',
    MISTRAL_API_KEY: 'mistral-secret',
  }, {
    dshHome: '/tmp/dsh-home',
    mistralApiKey: 'mistral-secret',
  });

  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.HOME, '/home/test');
  assert.equal(env.HTTPS_PROXY, 'http://proxy.test');
  assert.equal(env.DSH_HOME, '/tmp/dsh-home');
  assert.equal(env.MISTRAL_API_KEY, 'mistral-secret');
  assert.equal(env.OPENAI_API_KEY, undefined);
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined);
});

test('renders an sdk-minimal invocation patch for the configured Mistral route', () => {
  const yaml = renderMistralMinimalProfilePatchYaml({
    providerRoute: 'mistral',
    modelId: 'mistral-medium-3-5',
    baseUrl: 'https://api.mistral.ai/v1',
  });
  assert.match(yaml, /^- id: llm-deepseek\n  disabled: true/m);
  assert.match(yaml, /- insert:\n\s+- id: llm-pi-ai\n\s+name: '@deepseek-ai\/dsh-llm-pi-ai'/);
  assert.match(yaml, /providers:\n\s+mistral:/);
  assert.match(yaml, /displayName: Mistral/);
  assert.match(yaml, /apiKeyEnv: MISTRAL_API_KEY/);
  assert.match(yaml, /api: openai-completions/);
  assert.match(yaml, /baseURL: https:\/\/api\.mistral\.ai\/v1/);
  assert.match(yaml, /supportsDeveloperRole: false/);
  assert.match(yaml, /maxTokensField: max_tokens/);
  assert.match(yaml, /- id: mistral-medium-3-5/);
  assert.match(yaml, new RegExp(`maxRetries: ${MISTRAL_SPIKE_MAX_RETRIES}`));
  assert.match(yaml, /retryableCodes:\n\s+- RATE_LIMIT/);
  assert.match(yaml, new RegExp(`initialDelayMs: ${MISTRAL_RATE_LIMIT_WINDOW_MS}`));
  assert.match(yaml, new RegExp(`maxDelayMs: ${MISTRAL_RATE_LIMIT_WINDOW_MS}`));
  assert.match(yaml, /jitterRatio: 0/);
  assert.doesNotMatch(yaml, /mistral-secret/);
  assert.doesNotMatch(yaml, /-latest/);
});

test('pins the default Mistral model instead of using a silently moving latest alias', () => {
  assert.equal(DEFAULT_MISTRAL_MODEL_ID, 'mistral-medium-3-5');
  assert.doesNotMatch(DEFAULT_MISTRAL_MODEL_ID, /-latest$/);
});

test('rejects unsafe or incomplete spike inputs before any subprocess starts', () => {
  assert.throws(() => validateSpikeInputs({
    providerRoute: 'Mistral With Space',
    modelId: 'mistral-medium-3-5',
    baseUrl: 'https://api.mistral.ai/v1',
    mistralApiKey: 'x',
  }), /providerRoute/);
  assert.throws(() => validateSpikeInputs({
    providerRoute: 'mistral',
    modelId: '../model',
    baseUrl: 'https://api.mistral.ai/v1',
    mistralApiKey: 'x',
  }), /modelId/);
  assert.throws(() => validateSpikeInputs({
    providerRoute: 'mistral',
    modelId: 'mistral-medium-3-5',
    baseUrl: 'http://api.mistral.ai/v1',
    mistralApiKey: 'x',
  }), /HTTPS/);
  assert.throws(() => validateSpikeInputs({
    providerRoute: 'mistral',
    modelId: 'mistral-medium-3-5',
    baseUrl: 'https://api.mistral.ai/v1',
    mistralApiKey: '',
  }), /MISTRAL_API_KEY/);
});

test('does not expose model credentials to temporary package installation', () => {
  const env = buildPackageInstallEnv({
    PATH: '/usr/bin',
    HOME: '/home/test',
    HTTPS_PROXY: 'http://proxy.test',
    MISTRAL_API_KEY: 'must-not-pass-to-package-scripts',
    NPM_TOKEN: 'must-not-pass',
  });
  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.HTTPS_PROXY, 'http://proxy.test');
  assert.equal(env.MISTRAL_API_KEY, undefined);
  assert.equal(env.NPM_TOKEN, undefined);
  assert.equal(env.PNPM_CONFIG_AUTO_INSTALL_PEERS, 'true');
});

test('uses an exact reviewed build-script policy instead of weakening pnpm security', () => {
  const yaml = renderHarnessInstallWorkspaceYaml('0.1.2-rc.1');
  assert.match(yaml, /'@deepseek-ai\/dsh-subprocess-local@0\.1\.2-rc\.1': true/);
  assert.match(yaml, /'koffi@3\.2\.1': true/);
  assert.match(yaml, /'node-pty@1\.2\.0-beta\.15': true/);
  assert.match(yaml, /'@google\/genai@1\.52\.0': false/);
  assert.match(yaml, /'protobufjs@7\.6\.6': false/);
  assert.doesNotMatch(yaml, /dangerouslyAllowAllBuilds/);
  assert.doesNotMatch(yaml, /strictDepBuilds:\s*false/);
});

test('anchors the published Harness consumer and pi-ai adapter to the reviewed release', () => {
  const manifest = JSON.parse(renderHarnessInstallPackageJson('0.1.2-rc.1')) as {
    dependencies: Record<string, string>;
  };
  assert.equal(manifest.dependencies['@deepseek-ai/dsh'], '0.1.2-rc.1');
  assert.equal(manifest.dependencies['@deepseek-ai/dsh-sdk-client'], '0.1.2-rc.1');
  assert.equal(manifest.dependencies['@deepseek-ai/dsh-llm-pi-ai'], '0.1.2-rc.1');
  assert.equal(manifest.dependencies.react, '18.3.1');
  assert.equal(manifest.dependencies['react-dom'], '18.3.1');
});

test('refuses an unreviewed Harness release before dependency policies can run', () => {
  assert.throws(
    () => renderHarnessInstallWorkspaceYaml('0.1.1-rc.2'),
    /No reviewed dependency policy/,
  );
  assert.throws(
    () => renderHarnessInstallPackageJson('0.1.1-rc.2'),
    /No reviewed dependency policy/,
  );
});

test('keeps the timeout probe on sdk-minimal and disables retry amplification', () => {
  const yaml = renderMistralMinimalProfilePatchYaml({
    providerRoute: 'mistral',
    modelId: 'mistral-medium-3-5',
    baseUrl: 'https://api.mistral.ai/v1',
    timeoutMs: 5,
    streamIdleTimeoutMs: 5,
  });
  assert.match(yaml, /timeoutMs: 5/);
  assert.match(yaml, /streamIdleTimeoutMs: 5/);
  assert.match(yaml, /maxRetries: 0/);
  assert.match(yaml, /api: openai-completions/);
  assert.match(yaml, /- id: mistral-medium-3-5/);
});

test('builds only the public DeepSeek Harness 0.1.2-rc.1 SDK option shape', () => {
  const options = buildHarnessSdkOptions({
    PATH: '/usr/bin',
    HOME: '/home/test',
    OPENAI_API_KEY: 'must-not-pass',
  }, {
    workspace: '/tmp/workspace',
    dshHome: '/tmp/dsh-home',
    patchPath: '/tmp/mistral-profile.patch.yml',
    maxTokens: 2048,
    input: {
      providerRoute: 'mistral',
      modelId: 'mistral-medium-3-5',
      baseUrl: 'https://api.mistral.ai/v1',
      mistralApiKey: 'mistral-secret',
    },
  });

  assert.equal(options.profile, 'sdk-minimal');
  assert.deepEqual(options.patches, ['/tmp/mistral-profile.patch.yml']);
  assert.equal(options.dshHome, '/tmp/dsh-home');
  assert.equal(options.processCwd, '/tmp/workspace');
  assert.equal(options.cwd, '/tmp/workspace');
  assert.equal(options.provider, 'mistral');
  assert.equal(options.model, 'mistral-medium-3-5');
  assert.equal(options.maxTokens, 2048);
  assert.equal(options.initializeTimeoutMs, 10_000);
  assert.equal(options.shutdownTimeoutMs, 1_000);
  assert.equal(options.disposeEofGraceMs, 6_000);
  assert.equal(options.disposeGraceMs, 3_000);
  assert.equal(options.env.MISTRAL_API_KEY, 'mistral-secret');
  assert.equal(options.env.OPENAI_API_KEY, undefined);
  assert.equal('launch' in options, false);
  assert.equal('command' in options, false);
  assert.equal('args' in options, false);
  assert.equal('dshBin' in options, false);
});

test('rejects invalid SDK option construction before Harness startup', () => {
  const input = {
    providerRoute: 'mistral',
    modelId: 'mistral-medium-3-5',
    baseUrl: 'https://api.mistral.ai/v1',
    mistralApiKey: 'secret',
  };
  assert.throws(() => buildHarnessSdkOptions({}, {
    workspace: '',
    dshHome: '/tmp/dsh-home',
    patchPath: '/tmp/mistral-profile.patch.yml',
    maxTokens: 2048,
    input,
  }), /workspace/);
  assert.throws(() => buildHarnessSdkOptions({}, {
    workspace: '/tmp/workspace',
    dshHome: '/tmp/dsh-home',
    patchPath: '',
    maxTokens: 2048,
    input,
  }), /patchPath/);
  assert.throws(() => buildHarnessSdkOptions({}, {
    workspace: '/tmp/workspace',
    dshHome: '/tmp/dsh-home',
    patchPath: '/tmp/mistral-profile.patch.yml',
    maxTokens: 0,
    input,
  }), /maxTokens/);
});

test('sanitizes the actual Mistral credential from bounded diagnostics', () => {
  const diagnostic = sanitizeSpikeDiagnostic(
    'provider failed with token super-secret-value while contacting endpoint',
    'super-secret-value',
  );
  assert.equal(diagnostic.includes('super-secret-value'), false);
  assert.match(diagnostic, /\[REDACTED\]/);
  assert.ok(diagnostic.length <= 800);
});

test('requires the repository Node and pnpm runtime versions for the live spike', () => {
  assert.doesNotThrow(() => assertSpikeRuntimeVersions({ nodeVersion: 'v24.21.0', pnpmVersion: '11.25.0' }));
  assert.throws(
    () => assertSpikeRuntimeVersions({ nodeVersion: 'v22.16.0', pnpmVersion: '11.25.0' }),
    /Node 24/,
  );
  assert.throws(
    () => assertSpikeRuntimeVersions({ nodeVersion: 'v24.21.0', pnpmVersion: '11.24.0' }),
    /pnpm 11\.25\.0/,
  );
});

test('uses only exact Harness versions and allows controlled candidate selection', () => {
  assert.equal(resolveHarnessCandidateVersion(undefined), '0.1.2-rc.1');
  assert.equal(resolveHarnessCandidateVersion('0.1.1-rc.2'), '0.1.1-rc.2');
  assert.throws(() => resolveHarnessCandidateVersion('latest'), /exact semver/);
  assert.throws(() => resolveHarnessCandidateVersion('^0.1.2-rc.1'), /exact semver/);
});
