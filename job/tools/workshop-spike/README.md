# DeepSeek Harness + Mistral Compatibility Spike

Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`  
Slice: `VXA-S002@1.0.0`  
GAUNTLET: `GNT-VXA-S002-001`  
Status: `IN_PROGRESS / REAL_PROVIDER_NOT_VERIFIED`

## Purpose

This is the Task 1 proof gate for the S002 Agent Workshop. It determines whether an exact DeepSeek Harness release can drive the selected Mistral route with the behaviors Vexryzer requires before any Harness dependency is committed to the product root.

It is deliberately a spike, not a production runtime and not evidence that a public live Workshop is safely hostable.

## Candidate under test

- DeepSeek Harness candidate: `0.1.2-rc.1` exact;
- temporary package set: `@deepseek-ai/dsh@0.1.2-rc.1`, `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1`, and `@deepseek-ai/dsh-llm-pi-ai@0.1.2-rc.1`;
- Harness profile: shipped `sdk-minimal`;
- provider route: `mistral`;
- model: `mistral-medium-3-5`;
- endpoint: `https://api.mistral.ai/v1`;
- route implementation: configured Harness `llm-pi-ai` using `openai-completions` compatibility mode.

The Harness version is a **candidate for evidence**, not an accepted product dependency. The temporary runtime pins the `llm-pi-ai` adapter to the same release as the CLI and SDK so evidence cannot accidentally combine package trains.

The Mistral model is intentionally pinned to `mistral-medium-3-5`, not a moving `-latest` alias.

## Why `sdk-minimal`

The first supported route was tested before this composition:

1. The pinned pi-ai Mistral catalog route was exercised on Run `34457175731` at source SHA `6c8119253b111323a350850d8eac06cd77d7be21`. Its pure contracts passed, but the exact catalog did not contain `mistral-medium-3-5`; startup returned `pi-ai provider "mistral" has no configured model "mistral-medium-3-5"`. No provider request was needed to establish that incompatibility.
2. The configured `llm-pi-ai` route was then exercised through the full shipped `sdk` profile on Run `34457652884` at source SHA `626276eba9a25b00ae972b22dbd14f43f201f4c2`. Its pure contracts passed and the route reached the provider, but the first model step ended in `RATE_LIMIT` even after one 65-second retry window. Bounded request evidence showed 26 advertised tool schemas and a 4,528-character system prompt.

The exact Harness release also ships `sdk-minimal`, a standalone SDK coding-agent profile with persistent sessions and exactly two model-facing development tools on a platform: persistent shell plus `str_replace_editor`. Using that official profile preserves the required real tool round-trip while removing unrelated tool surface from the compatibility request. This is a diagnostic composition change, not a claim that request size caused the earlier rate limit; only the real provider run can establish whether the smaller surface changes the outcome.

The spike applies one invocation patch above `sdk-minimal`:

- disable only the shipped `llm-deepseek` adapter row;
- insert `@deepseek-ai/dsh-llm-pi-ai@0.1.2-rc.1`;
- configure only the `mistral` route and the fixed `mistral-medium-3-5` model;
- keep the retry policy bounded to `RATE_LIMIT` only;
- keep timeout-probe retries disabled.

The patch does not recreate a Harness profile or a second architecture.

## DeepSeek Harness SDK contract

The spike uses the public TypeScript SDK surface of `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1` directly. `DeepSeekHarness` receives `profile: sdk-minimal`, one explicit `patches` path, `dshHome`, `processCwd`, `env`, `cwd`, `provider`, `model`, `maxTokens`, and lifecycle timeouts. It does **not** use an older custom `launch` command shape.

The SDK resolves the same-version `@deepseek-ai/dsh` CLI package and builds the canonical profile launch. Before any provider turn, the spike verifies the installed `dsh`, SDK client, pi-ai adapter, and shipped `sdk-minimal` bundle all resolve to the exact requested Harness version.

## Required environment

Run from `job/` with the repository runtime contract:

- Node.js major `24`;
- pnpm exactly `11.25.0`;
- outbound HTTPS access to the package registry and Mistral endpoint;
- `MISTRAL_API_KEY` supplied only through the process environment.

Do not place the key in source, arguments, patches, logs or checked-in fixtures.

## Command

```bash
cd job
export MISTRAL_API_KEY='...'
node tools/workshop-spike/run-harness-mistral.mjs
```

Optional non-secret routing/candidate overrides:

```bash
export VXA_HARNESS_VERSION='0.1.2-rc.1'
export VXA_MISTRAL_PROVIDER_ROUTE='mistral'
export VXA_MISTRAL_MODEL_ID='mistral-medium-3-5'
export VXA_MISTRAL_BASE_URL='https://api.mistral.ai/v1'
export VXA_PNPM_BIN='pnpm'
```

`VXA_PNPM_BIN` only selects an executable; the runner still verifies it reports `11.25.0`.

## Isolation and credential boundary

The runner creates one disposable temporary root and removes it in `finally`.

Package installation happens outside `job/node_modules` and never mutates `job/package.json`. The package-install subprocess receives a scrubbed environment and does **not** receive `MISTRAL_API_KEY`, npm tokens, cloud credentials or unrelated parent secrets. The pnpm build-script allowlist remains exact and reviewed.

Only after package installation and version verification does the Harness subprocess receive a narrow environment containing ordinary execution variables, isolated `DSH_HOME`, and `MISTRAL_API_KEY`. The generated invocation patch is written mode `0600`, stores only `apiKeyEnv: MISTRAL_API_KEY`, and never stores the credential value.

The `sdk-minimal` profile uses the local development shell/editor under its shipped danger-full-access policy, so the spike runs only against its disposable workspace. This does not authorize exposing that profile directly to public visitor traffic.

## Required proof

A compatibility result is accepted only when all six Slice-required capabilities are `true` for the exact Harness/profile/provider/model state:

| Capability | Real evidence required |
| --- | --- |
| `streaming` | root-session assistant streaming events are observed |
| `toolCalls` | both development turns contain a matching `tool/call` → `tool/result` round trip |
| `structuredArguments` | every observed probe `tool/call.arguments` is valid JSON object syntax |
| `multiTurnToolReplay` | the second turn uses a tool to read the artifact produced in turn one and returns its exact nonce |
| `restartSafe` | after closing/restarting the Harness against the same isolated home/session, the model recalls the first-turn nonce without reading the workspace again |
| `timeoutMapped` | a deliberately tiny provider timeout produces a bounded non-success/error path rather than hanging or being misclassified as completed |

In addition, every normal-turn request must expose exactly two tool schemas. That is an integrity check that the real run is using the shipped `sdk-minimal` request surface rather than silently falling back to the 26-tool `sdk` composition.

The first turn must actually create `vxa-harness-tool-probe.txt` with an unpredictable nonce. The runner verifies the filesystem side effect itself; model text claiming that the file was created is not evidence.

## Output contract

Stdout contains bounded JSON. A completed result records the exact Harness version, `sdk-minimal` profile, provider route, model id, six compatibility booleans and bounded event/request counts. Bootstrap/runtime failures record only bounded phase, class and sanitized message.

The runner does not intentionally emit raw provider payloads, conversation transcripts, tool arguments, tool results, nonce values or credentials. Failure diagnostics redact the current Mistral credential and are length-bounded.

Exit codes:

- `0`: all compatibility assertions passed for the exact state;
- `2`: the runner completed but one or more required compatibility capabilities did not pass;
- `1`: environment/bootstrap/runtime failure prevented a valid compatibility decision.

An exit `0` proves provider/Harness compatibility only. It does **not** prove the production Workshop security boundary, network egress confinement, Netlify compatibility or zero-cost long-lived hosting.

## Tests

Pure tests cover the compatibility contract, bounded event evidence, minimal two-tool request surface, environment scrubbing, exact package pins, invocation-patch rendering, timeout configuration, exact candidate selection, fixed Mistral model, runtime-version gates, public SDK option shape and diagnostic redaction:

```bash
cd job
node --test tests/pure/workshop-provider-contract.node.test.ts \
  tests/pure/workshop-harness-evidence.node.test.ts \
  tests/pure/workshop-spike-config.node.test.ts
```

The hosted Node 24 gate is authoritative for the complete spike because the local ChatGPT container has Node 22, no pnpm and no outbound DNS to GitHub/package registries.

## Next gate

Run this exact `sdk-minimal` candidate once in GitHub Actions using environment `s002-spike`. Preserve the bounded result and source SHA. Do not interpret a smaller request as a PASS by itself: all six compatibility capabilities still have to pass on the fixed `mistral-medium-3-5` model.

If the provider still returns an operational `RATE_LIMIT`, preserve it as an external blocker rather than changing model or weakening the proof. If the minimal profile or invocation patch fails deterministically before provider execution, identify the composition root cause before another remote run.
