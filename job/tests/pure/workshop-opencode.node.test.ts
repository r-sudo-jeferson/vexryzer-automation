import assert from 'node:assert/strict';
import test from 'node:test';
import {
  OPENCODE_PROVIDER_ID,
  OPENCODE_VERSION,
  buildOpenCodeRuntimeEnv,
  renderOpenCodeConfig,
  renderOpenCodeInstallPackageJson,
} from '../../tools/workshop-spike/opencode-config.ts';
import {
  inspectOpenCodeEvents,
  parseOpenCodeJsonEvents,
  sanitizeOpenCodeDiagnostic,
} from '../../tools/workshop-spike/opencode-evidence.ts';

test('pins the immutable OpenCode release and installation package exactly', () => {
  assert.equal(OPENCODE_VERSION, '1.18.30');
  const manifest = JSON.parse(renderOpenCodeInstallPackageJson());
  assert.deepEqual(manifest.dependencies, { 'opencode-ai': '1.18.30' });
  assert.equal(manifest.private, true);
});

test('renders a Groq-only OpenCode config with deny-by-default Workshop permissions', () => {
  const config = JSON.parse(renderOpenCodeConfig({
    modelId: 'openai/gpt-oss-120b',
    credentialRef: 'GROQ_API_KEY',
  }));

  assert.equal(OPENCODE_PROVIDER_ID, 'vxa-groq');
  assert.equal(config.share, 'disabled');
  assert.equal(config.autoupdate, false);
  assert.deepEqual(Object.keys(config.provider), ['vxa-groq']);
  assert.equal(config.provider['vxa-groq'].npm, '@ai-sdk/openai-compatible');
  assert.equal(config.provider['vxa-groq'].options.baseURL, 'https://api.groq.com/openai/v1');
  assert.equal(config.provider['vxa-groq'].options.apiKey, '{env:GROQ_API_KEY}');
  assert.deepEqual(Object.keys(config.provider['vxa-groq'].models), ['openai/gpt-oss-120b']);
  assert.equal(config.permission['*'], 'deny');
  assert.equal(config.permission.read, 'allow');
  assert.equal(config.permission.edit, 'allow');
  assert.equal(config.permission.bash, 'deny');
  assert.equal(config.permission.task, 'deny');
  assert.equal(config.permission.webfetch, 'deny');
  assert.equal(config.permission.websearch, 'deny');
  assert.equal(config.permission.external_directory, 'deny');
});

test('builds a confined OpenCode runtime environment with only the selected provider credential', () => {
  const env = buildOpenCodeRuntimeEnv({
    PATH: '/usr/bin',
    HOME: '/home/runner',
    GROQ_API_KEY: 'groq-secret',
    CLOUDFLARE_API_TOKEN: 'cf-secret',
    MISTRAL_API_KEY: 'mistral-secret',
    OPENAI_API_KEY: 'openai-secret',
  }, {
    stateRoot: '/tmp/vxa-opencode',
    configPath: '/tmp/vxa-opencode/opencode.json',
    credentialRef: 'GROQ_API_KEY',
    credentialValue: 'groq-secret',
  });

  assert.equal(env.PATH, '/usr/bin');
  assert.equal(env.HOME, '/tmp/vxa-opencode/home');
  assert.equal(env.XDG_CONFIG_HOME, '/tmp/vxa-opencode/xdg-config');
  assert.equal(env.XDG_DATA_HOME, '/tmp/vxa-opencode/xdg-data');
  assert.equal(env.XDG_CACHE_HOME, '/tmp/vxa-opencode/xdg-cache');
  assert.equal(env.OPENCODE_CONFIG, '/tmp/vxa-opencode/opencode.json');
  assert.equal(env.OPENCODE_CONFIG_DIR, '/tmp/vxa-opencode/config-dir');
  assert.equal(env.OPENCODE_DISABLE_AUTOUPDATE, 'true');
  assert.equal(env.OPENCODE_AUTO_SHARE, 'false');
  assert.equal(env.GROQ_API_KEY, 'groq-secret');
  assert.equal(env.CLOUDFLARE_API_TOKEN, undefined);
  assert.equal(env.MISTRAL_API_KEY, undefined);
  assert.equal(env.OPENAI_API_KEY, undefined);
});

test('parses bounded OpenCode NDJSON and exposes completed structured tool evidence', () => {
  const ndjson = [
    JSON.stringify({ type: 'step_start', timestamp: 1, sessionID: 'ses_vxa', part: { type: 'step-start' } }),
    JSON.stringify({
      type: 'tool_use', timestamp: 2, sessionID: 'ses_vxa',
      part: {
        type: 'tool', tool: 'write', sessionID: 'ses_vxa',
        state: { status: 'completed', input: { filePath: '/tmp/workspace/probe.txt', content: 'VXA-NONCE' }, output: 'Wrote file' },
      },
    }),
    JSON.stringify({ type: 'text', timestamp: 3, sessionID: 'ses_vxa', part: { type: 'text', text: 'VXA-NONCE', time: { end: 3 } } }),
  ].join('\n');

  const events = parseOpenCodeJsonEvents(ndjson);
  const evidence = inspectOpenCodeEvents(events);
  assert.equal(events.length, 3);
  assert.equal(evidence.sessionID, 'ses_vxa');
  assert.equal(evidence.eventCount, 3);
  assert.equal(evidence.streamedEvents, true);
  assert.deepEqual(evidence.completedTools.map((tool) => tool.name), ['write']);
  assert.deepEqual(evidence.completedTools[0]?.input, { filePath: '/tmp/workspace/probe.txt', content: 'VXA-NONCE' });
  assert.equal(evidence.finalText, 'VXA-NONCE');
});

test('rejects malformed NDJSON, mixed session identities, and unbounded event output', () => {
  assert.throws(() => parseOpenCodeJsonEvents('{bad'), /OpenCode JSON event/);
  assert.throws(() => inspectOpenCodeEvents([
    { type: 'text', sessionID: 'ses_a', part: { type: 'text', text: 'a' } },
    { type: 'text', sessionID: 'ses_b', part: { type: 'text', text: 'b' } },
  ]), /mixed session/i);
  assert.throws(() => parseOpenCodeJsonEvents('x'.repeat(2_000_001)), /bounded/i);
});

test('redacts selected and ambient credential material from OpenCode diagnostics', () => {
  const diagnostic = sanitizeOpenCodeDiagnostic(
    'GROQ_API_KEY=groq-secret Authorization: Bearer groq-secret OPENAI_API_KEY=openai-secret',
    ['groq-secret', 'openai-secret'],
  );
  assert.equal(diagnostic.includes('groq-secret'), false);
  assert.equal(diagnostic.includes('openai-secret'), false);
  assert.match(diagnostic, /\[REDACTED\]/);
  assert.ok(diagnostic.length <= 800);
});
