import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSellerSchemaDiagnosticCases,
  classifyProviderSchemaError,
} from '../../tools/provider-quality/run-seller-schema-diagnostic.ts';

function countKey(value: unknown, key: string): number {
  if (Array.isArray(value)) return value.reduce((sum, item) => sum + countKey(item, key), 0);
  if (typeof value !== 'object' || value === null) return 0;
  return Object.entries(value).reduce(
    (sum, [nestedKey, nested]) => sum + (nestedKey === key ? 1 : 0) + countKey(nested, key),
    0,
  );
}

test('schema diagnostic isolates tool count, submit complexity, combinators and descriptions', () => {
  const cases = buildSellerSchemaDiagnosticCases();
  assert.deepEqual(cases.map((item) => item.id), [
    'simple-control',
    'capture-calculation-only',
    'submit-only-complete',
    'submit-without-one-of',
    'submit-without-descriptions',
    'complete-tools',
  ]);
  assert.deepEqual(cases.map((item) => item.tools.length), [1, 2, 1, 1, 1, 3]);
  assert.ok(countKey(cases[2]!.tools, 'oneOf') > 0);
  assert.equal(countKey(cases[3]!.tools, 'oneOf'), 0);
  assert.equal(countKey(cases[4]!.tools, 'description'), 1);
  assert.equal(countKey(cases[4]!.tools[0]!.function.parameters, 'description'), 0);
});

test('schema diagnostic classifies only bounded structural signals and never returns provider prose', () => {
  const classified = classifyProviderSchemaError(JSON.stringify({
    errors: [{ code: 10042, message: 'Invalid tools schema: oneOf is unsupported; private-marker-do-not-emit' }],
  }));
  assert.deepEqual(classified.errorCodes, ['10042']);
  assert.deepEqual(classified.signals, ['invalid', 'one_of', 'schema', 'tools', 'unsupported']);
  assert.equal(classified.jsonObject, true);
  assert.ok(classified.responseBytes > 0);
  assert.equal(JSON.stringify(classified).includes('private-marker-do-not-emit'), false);
});
