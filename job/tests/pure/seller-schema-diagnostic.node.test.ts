import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSellerSchemaDiagnosticCases,
  classifyProviderSchemaError,
  inferSellerSchemaRootCause,
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
    'padded-simple-control',
    'deep-simple-control',
    'wide-simple-control',
    'capture-calculation-only',
    'submit-envelope-only',
    'submit-intent-only',
    'submit-records-only',
    'submit-material-only',
    'submit-only-complete',
    'submit-without-one-of',
    'submit-without-descriptions',
    'complete-tools',
  ]);
  assert.deepEqual(cases.map((item) => item.tools.length), [1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1, 3]);
  assert.ok(countKey(cases[9]!.tools, 'oneOf') > 0);
  assert.equal(countKey(cases[10]!.tools, 'oneOf'), 0);
  assert.equal(countKey(cases[11]!.tools, 'description'), 1);
  assert.equal(countKey(cases[11]!.tools[0]!.function.parameters, 'description'), 0);
  assert.ok(JSON.stringify(cases[1]!.tools).length >= JSON.stringify(cases[9]!.tools).length);
  assert.equal(countKey(cases[2]!.tools, 'properties'), 7);
  assert.ok(countKey(cases[3]!.tools, 'type') >= 125);
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

test('schema diagnostic infers only a uniquely isolated structural dimension', () => {
  const passing = [
    'simple-control',
    'padded-simple-control',
    'deep-simple-control',
    'wide-simple-control',
    'submit-envelope-only',
    'submit-intent-only',
    'submit-records-only',
    'submit-material-only',
  ].map((id) => ({ id, accepted: true }));
  assert.equal(inferSellerSchemaRootCause([
    ...passing,
    { id: 'submit-only-complete', accepted: false },
  ]), 'COMBINED_SUBMIT_SCHEMA_COMPLEXITY_LIMIT');
  assert.equal(inferSellerSchemaRootCause([
    ...passing.filter((item) => item.id !== 'padded-simple-control'),
    { id: 'padded-simple-control', accepted: false },
    { id: 'submit-only-complete', accepted: false },
  ]), 'SCHEMA_BYTE_SIZE_LIMIT');
  assert.equal(inferSellerSchemaRootCause([
    ...passing,
    { id: 'submit-intent-only', accepted: false },
    { id: 'submit-records-only', accepted: false },
    { id: 'submit-only-complete', accepted: false },
  ]), 'NOT_ISOLATED');
  assert.equal(inferSellerSchemaRootCause([
    { id: 'simple-control', accepted: true },
    { id: 'submit-only-complete', accepted: true },
    { id: 'complete-tools', accepted: false },
  ]), 'COMPLETE_TOOL_COMPOSITION_REJECTED');
});
