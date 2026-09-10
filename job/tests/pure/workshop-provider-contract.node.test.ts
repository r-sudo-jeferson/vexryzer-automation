import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertWorkshopProviderCompatibility,
  summarizeWorkshopProviderCompatibility,
  type WorkshopProviderCompatibility,
} from '../../tools/workshop-spike/provider-compatibility.ts';

const fullyCompatible: WorkshopProviderCompatibility = {
  harnessVersion: '0.1.2-rc.1',
  providerRoute: 'mistral',
  modelId: 'mistral-medium-latest',
  streaming: true,
  toolCalls: true,
  multiTurnToolReplay: true,
  structuredArguments: true,
  timeoutMapped: true,
  restartSafe: true,
};

test('accepts only a fully proven Workshop provider compatibility result', () => {
  assert.doesNotThrow(() => assertWorkshopProviderCompatibility(fullyCompatible));
});

test('rejects any missing material compatibility capability', () => {
  for (const capability of [
    'streaming',
    'toolCalls',
    'multiTurnToolReplay',
    'structuredArguments',
    'timeoutMapped',
    'restartSafe',
  ] as const) {
    assert.throws(
      () => assertWorkshopProviderCompatibility({ ...fullyCompatible, [capability]: false }),
      new RegExp(capability),
    );
  }
});

test('summary exposes only bounded compatibility facts', () => {
  assert.deepEqual(summarizeWorkshopProviderCompatibility(fullyCompatible), {
    harnessVersion: '0.1.2-rc.1',
    providerRoute: 'mistral',
    modelId: 'mistral-medium-latest',
    compatible: true,
    verifiedCapabilities: [
      'streaming',
      'toolCalls',
      'multiTurnToolReplay',
      'structuredArguments',
      'timeoutMapped',
      'restartSafe',
    ],
  });
});
