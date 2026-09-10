import test from 'node:test';
import assert from 'node:assert/strict';
import { findCredentialRule } from '../../scripts/security-patterns.mjs';

test('credential detection rejects real token shapes without colliding with CSS vocabulary', () => {
  assert.equal(findCredentialRule('--xy-minimap-mask-stroke-color-default'), null);
  assert.equal(findCredentialRule('mask-stroke-color-default'), null);

  const openAiStyle = ['s', 'k', '-'].join('') + 'A'.repeat(32);
  assert.equal(findCredentialRule(openAiStyle), 'credential-openai-style');

  const githubClassic = ['g', 'h', 'p', '_'].join('') + 'A'.repeat(36);
  assert.equal(findCredentialRule(githubClassic), 'credential-github-classic');
});
