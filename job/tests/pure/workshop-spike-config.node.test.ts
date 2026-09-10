import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildScrubbedHarnessEnv,
  renderMistralSettingsYaml,
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
