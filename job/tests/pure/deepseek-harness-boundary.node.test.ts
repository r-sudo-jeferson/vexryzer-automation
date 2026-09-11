import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEEPSEEK_HARNESS_ALLOWED_TOOL_NAMES,
  DEEPSEEK_HARNESS_VISITOR_PROFILE,
  assertDeepSeekHarnessVisitorProfile,
  validateDeepSeekHarnessToolSurface,
} from '../../src/server/ai/harness/deepseek-harness-visitor-policy.ts';

test('DeepSeek Harness visitor profile is exact, native-only and Trust-Kernel subordinate', () => {
  const profile = assertDeepSeekHarnessVisitorProfile();
  assert.equal(profile, DEEPSEEK_HARNESS_VISITOR_PROFILE);
  assert.equal(profile.harness, 'DeepSeek-Harness');
  assert.equal(profile.version, '0.1.5-rc.1');
  assert.equal(profile.providerFamily, 'deepseek');
  assert.equal(profile.modelId, 'deepseek-v4-pro');
  assert.equal(profile.credentialEnvName, 'DEEPSEEK_API_KEY');
  assert.equal(profile.credentialScope, 'server');
  assert.equal(profile.toolPresentationMode, 'native');
  assert.equal(profile.trustAuthority, 'vexryzer_deterministic_trust_kernel');
  assert.equal(profile.unrestrictedShell, false);
  assert.equal(profile.unrestrictedFilesystem, false);
  assert.equal(profile.arbitraryCodeExecution, false);
  assert.equal(profile.dynamicPluginRegistration, false);
  assert.equal(profile.unrestrictedNetworkTools, false);
  assert.equal(profile.codeModeTransport, false);
});

test('seller and critic Harness surfaces are exact Vexryzer allowlists', () => {
  assert.deepEqual(
    DEEPSEEK_HARNESS_ALLOWED_TOOL_NAMES.seller,
    ['capture_user_observations', 'request_calculations', 'submit_seller_submission'],
  );
  assert.deepEqual(DEEPSEEK_HARNESS_ALLOWED_TOOL_NAMES.critic, ['submit_critic_review']);

  assert.equal(validateDeepSeekHarnessToolSurface(
    'seller',
    ['request_calculations', 'submit_seller_submission', 'capture_user_observations'],
  ).ok, true);
  assert.equal(validateDeepSeekHarnessToolSurface('critic', ['submit_critic_review']).ok, true);
});

test('Harness visitor policy rejects executable, filesystem and dynamic-extension surfaces', () => {
  const blockedNames = ['run_code', 'write_file', 'cordis_define'] as const;
  for (const toolName of blockedNames) {
    assert.deepEqual(
      validateDeepSeekHarnessToolSurface('seller', [
        ...DEEPSEEK_HARNESS_ALLOWED_TOOL_NAMES.seller,
        toolName,
      ]),
      { ok: false, code: 'FORBIDDEN_TOOL', toolName },
    );
  }
});

test('Harness visitor policy fails closed on unknown, duplicate, malformed and incomplete tool sets', () => {
  assert.deepEqual(
    validateDeepSeekHarnessToolSurface('seller', [
      ...DEEPSEEK_HARNESS_ALLOWED_TOOL_NAMES.seller,
      'unregistered_semantic_tool',
    ]),
    { ok: false, code: 'UNAUTHORIZED_TOOL', toolName: 'unregistered_semantic_tool' },
  );

  assert.deepEqual(
    validateDeepSeekHarnessToolSurface('seller', [
      'capture_user_observations',
      'request_calculations',
      'submit_seller_submission',
      'submit_seller_submission',
    ]),
    { ok: false, code: 'DUPLICATE_TOOL', toolName: 'submit_seller_submission' },
  );

  assert.deepEqual(
    validateDeepSeekHarnessToolSurface('seller', [
      'capture_user_observations',
      'request_calculations',
      'Submit-Seller-Submission',
    ]),
    { ok: false, code: 'INVALID_TOOL_NAME', toolName: 'Submit-Seller-Submission' },
  );

  assert.deepEqual(
    validateDeepSeekHarnessToolSurface('seller', [
      'capture_user_observations',
      'request_calculations',
    ]),
    { ok: false, code: 'MISSING_REQUIRED_TOOL', toolName: 'submit_seller_submission' },
  );
});
