import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const config = await readFile(path.resolve(here, '../../netlify.toml'), 'utf8');

test('Netlify S001 security headers preserve a closed client execution and egress boundary', () => {
  assert.match(config, /X-Content-Type-Options\s*=\s*"nosniff"/);
  assert.match(config, /Referrer-Policy\s*=\s*"strict-origin-when-cross-origin"/);
  assert.match(config, /Permissions-Policy\s*=\s*"camera=\(\), microphone=\(\), geolocation=\(\)"/);
  assert.match(config, /Cross-Origin-Opener-Policy\s*=\s*"same-origin"/);
  assert.match(config, /script-src 'self'/);
  assert.match(config, /connect-src 'self'/);
  assert.match(config, /object-src 'none'/);
  assert.match(config, /frame-ancestors 'none'/);
  assert.doesNotMatch(config, /script-src[^;]*'unsafe-inline'/);
  assert.doesNotMatch(config, /'unsafe-eval'/);
  assert.doesNotMatch(config, /connect-src[^\n"]+https?:/);
});
