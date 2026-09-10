import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSpikeRuntimeVersions,
  buildPackageInstallEnv,
  buildScrubbedHarnessEnv,
  renderMistralSettingsYaml,
  resolveDshBinFromPackageManifest,
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

test('renders a Mistral custom provider using credential references only', () => {
  const yaml = renderMistralSettingsYaml({
    providerRoute: 'mistral',
    modelId: 'mistral-medium-latest',
    baseUrl: 'https://api.mistral.ai/v1',
  });
  assert.match(yaml, /apiKeyEnv: MISTRAL_API_KEY/);
  assert.match(yaml, /api: openai-completions/);
  assert.match(yaml, /baseURL: https:\/\/api\.mistral\.ai\/v1/);
  assert.match(yaml, /supportsDeveloperRole: false/);
  assert.match(yaml, /maxTokensField: max_tokens/);
  assert.doesNotMatch(yaml, /mistral-secret/);
});

test('rejects unsafe or incomplete spike inputs before any subprocess starts', () => {
  assert.throws(() => validateSpikeInputs({
    providerRoute: 'Mistral With Space',
    modelId: 'mistral-medium-latest',
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
    modelId: 'mistral-medium-latest',
    baseUrl: 'http://api.mistral.ai/v1',
    mistralApiKey: 'x',
  }), /HTTPS/);
  assert.throws(() => validateSpikeInputs({
    providerRoute: 'mistral',
    modelId: 'mistral-medium-latest',
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

test('can render a deliberately bounded provider timeout probe', () => {
  const yaml = renderMistralSettingsYaml({
    providerRoute: 'mistral-timeout',
    modelId: 'mistral-medium-latest',
    baseUrl: 'https://api.mistral.ai/v1',
    timeoutMs: 5,
    streamIdleTimeoutMs: 5,
  });
  assert.match(yaml, /timeoutMs: 5/);
  assert.match(yaml, /streamIdleTimeoutMs: 5/);
});

test('resolves the dsh executable from the installed package manifest instead of assuming layout', () => {
  assert.equal(
    resolveDshBinFromPackageManifest({ bin: { dsh: './lib/bin.js' } }, '/tmp/runtime/node_modules/@deepseek-ai/dsh'),
    '/tmp/runtime/node_modules/@deepseek-ai/dsh/lib/bin.js',
  );
  assert.equal(
    resolveDshBinFromPackageManifest({ bin: './lib/bin.js' }, '/tmp/runtime/node_modules/@deepseek-ai/dsh'),
    '/tmp/runtime/node_modules/@deepseek-ai/dsh/lib/bin.js',
  );
});

test('rejects an invalid or escaping dsh bin declaration', () => {
  assert.throws(
    () => resolveDshBinFromPackageManifest({ bin: { other: './lib/bin.js' } }, '/tmp/dsh'),
    /bin\.dsh/,
  );
  assert.throws(
    () => resolveDshBinFromPackageManifest({ bin: { dsh: '../escape.js' } }, '/tmp/dsh'),
    /inside the package/,
  );
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
