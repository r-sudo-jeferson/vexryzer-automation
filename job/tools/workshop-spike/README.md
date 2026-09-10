# DeepSeek Harness + Mistral Compatibility Spike

Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`  
Slice: `VXA-S002@1.0.0`  
GAUNTLET: `GNT-VXA-S002-001`  
Status: `IN_PROGRESS / REAL_PROVIDER_NOT_VERIFIED`

## Purpose

This is the Task 1 proof gate for the S002 Agent Workshop. It determines whether an exact DeepSeek Harness release can drive Mistral Medium 3.5 with the behaviors Vexryzer requires before any Harness dependency is committed to the product root.

It is deliberately a spike, not a production runtime and not evidence that a public live Workshop is safely hostable.

## Candidate under test

- DeepSeek Harness candidate: `0.1.2-rc.1` exact;
- temporary package set: `@deepseek-ai/dsh@0.1.2-rc.1`, `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1`, `@deepseek-ai/dsh-llm-pi-ai@0.1.2-rc.1`, and `@earendil-works/pi-ai@0.84.2`;
- Harness profile: shipped `sdk-minimal`;
- provider route: `mistral`;
- model: `mistral-medium-3-5`;
- provider implementation: pi-ai's native Mistral provider;
- provider base URL inherited from pi-ai: `https://api.mistral.ai`;
- wire endpoint built by the native provider: `POST /v1/chat/completions` with SSE streaming.

The Harness version is a **candidate for evidence**, not an accepted product dependency. The temporary runtime pins the `llm-pi-ai` adapter to the same release as the CLI and SDK. It also pins the adapter's pi-ai core to exact `0.84.2` rather than accepting the adapter manifest's `^0.84.2` range, so a later patch release cannot silently change evidence for the same source SHA. Bootstrap verifies the installed core version before any provider request.

The Mistral model is intentionally pinned to `mistral-medium-3-5`, not a moving `-latest` alias. Current Mistral documentation identifies Medium 3.5 as a GA model optimized for agentic and coding use cases, with a 256k context window, Chat Completions, streaming-compatible function calling and structured outputs.

## Why the native Mistral provider

The exact `pi-ai@0.84.2` dependency already contains a native Mistral provider. Its provider definition owns the Mistral endpoint and `MISTRAL_API_KEY` discovery, and its `mistral-conversations` implementation serializes Mistral tool calls, normalizes Mistral tool-call ids, streams `text/event-stream`, and sends requests to `/v1/chat/completions`.

The exact `dsh-llm-pi-ai@0.1.2-rc.1` route builder preserves that native implementation when a configured route names the installed `mistral` catalog provider and does **not** override `api`. Its catalog resolver also permits a configured `models` list to add a model id newer than the packaged catalog while inheriting the provider family's shared native protocol and base URL.

Therefore this probe adds only `mistral-medium-3-5` to the configured Mistral route. It deliberately does **not** set:

- `api`;
- `baseURL`;
- OpenAI compatibility flags;
- a Large-model fallback;
- model routing.

This distinguishes the current probe from the earlier configured route that used `openai-completions` compatibility mode.

## Prior route evidence

1. Run `34457175731`, source SHA `6c8119253b111323a350850d8eac06cd77d7be21`, tested the packaged Mistral catalog directly. The packaged catalog did not yet contain `mistral-medium-3-5`, so resolution failed before a provider request with `pi-ai provider "mistral" has no configured model "mistral-medium-3-5"`.
2. Run `34457652884`, source SHA `626276eba9a25b00ae972b22dbd14f43f201f4c2`, tested an explicitly configured `openai-completions` route through the full `sdk` profile. It reached Mistral but returned `RATE_LIMIT`; request evidence showed 26 tool schemas and a 4,528-character system prompt.
3. Run `34459827166`, source SHA `cee6d919e67676f55f6d07ecdf0562b491bcce05`, moved the same configured route to the shipped `sdk-minimal` profile. The request surface fell to exactly two tool schemas and a 46-character system prompt, but the first provider step still returned `RATE_LIMIT`.

Those runs did not prove that Medium 3.5 is incompatible with DeepSeek Harness. A provider `RATE_LIMIT` is operational evidence, not a protocol/model compatibility failure.

## Why `sdk-minimal`

The exact Harness release ships `sdk-minimal`, a standalone SDK coding-agent profile with persistent sessions and exactly two model-facing development tools on a platform: persistent shell plus `str_replace_editor`. It preserves the real tool round-trip required by the Slice while avoiding unrelated tool surface.

The spike applies one invocation patch above `sdk-minimal`:

- disable only the shipped `llm-deepseek` adapter row;
- insert `@deepseek-ai/dsh-llm-pi-ai@0.1.2-rc.1`;
- configure the `mistral` catalog route with `MISTRAL_API_KEY`;
- add only fixed model id `mistral-medium-3-5` to that route;
- keep normal request recovery bounded and exponential for transient provider failures;
- disable request retries entirely in the synthetic timeout probe.

The patch does not recreate a Harness profile or a second architecture.

## Retry policy

Mistral documents `429 Too Many Requests` and transient 5xx conditions as retryable with exponential backoff. The Harness retry extension already implements exponential delay and provider-routed failure classes. The normal compatibility probe therefore uses a finite policy over `RATE_LIMIT`, `SERVER`, `TIMEOUT`, and `TRANSPORT`, with five retries, 1-second initial delay, 16-second maximum delay, and 10% jitter.

Authentication, invalid request, quota/capacity classification and deterministic model/protocol failures are not made retryable by this profile. The timeout-mapping probe sets `maxRetries: 0` so a deliberate tiny timeout cannot be hidden by request recovery.

A retry policy can recover a transient response; it does not convert persistent rate limiting into compatibility evidence.

## Reasoning policy for this gate

Mistral recommends `reasoning_effort="high"` for Medium 3.5 in agentic and coding use cases. It also documents that high reasoning increases token use and requires preserving the full assistant message, including thinking chunks, across multi-turn replay.

Reasoning is **not enabled in this compatibility spike**. The authorized Task 1 gate requires streaming, tool calls, structured arguments, multi-turn tool replay, timeout/error mapping and restart/session behavior; adjustable reasoning is not one of those six criteria. Enabling it here would alter token pressure before the base compatibility question is resolved.

If Medium 3.5 passes the Harness compatibility gate, production reasoning behavior must be evaluated separately against the Mistral replay contract before it is enabled. If the Harness path is proven incompatible and Engineering moves to a direct Mistral integration, the same Mistral reasoning/replay contract applies there.

## DeepSeek Harness SDK contract

The spike uses the public TypeScript SDK surface of `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1` directly. `DeepSeekHarness` receives `profile: sdk-minimal`, one explicit `patches` path, `dshHome`, `processCwd`, `env`, `cwd`, `provider`, `model`, `maxTokens`, and lifecycle timeouts. It does **not** use an older custom `launch` command shape.

The SDK resolves the same-version `@deepseek-ai/dsh` CLI package and builds the canonical profile launch. Before any provider turn, the spike verifies the installed `dsh`, SDK client, pi-ai adapter, shipped `sdk-minimal` bundle, and exact pi-ai core version.

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

Optional non-secret candidate overrides:

```bash
export VXA_HARNESS_VERSION='0.1.2-rc.1'
export VXA_MISTRAL_PROVIDER_ROUTE='mistral'
export VXA_MISTRAL_MODEL_ID='mistral-medium-3-5'
export VXA_PNPM_BIN='pnpm'
```

There is intentionally no provider-base-URL override in this probe. The native Mistral provider owns the endpoint. `VXA_PNPM_BIN` only selects an executable; the runner still verifies it reports `11.25.0`.

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

Pure tests cover the compatibility contract, bounded event evidence, minimal two-tool request surface, environment scrubbing, exact package pins, native Mistral invocation-patch rendering, bounded exponential retry configuration, timeout configuration, exact candidate selection, fixed Mistral model, runtime-version gates, public SDK option shape and diagnostic redaction:

```bash
cd job
node --test tests/pure/workshop-provider-contract.node.test.ts \
  tests/pure/workshop-harness-evidence.node.test.ts \
  tests/pure/workshop-spike-config.node.test.ts
```

The hosted Node 24 gate is authoritative for the complete spike because the local ChatGPT container does not match the repository runtime contract and cannot install the remote temporary package graph.

## Decision rule

Run this exact native-Mistral candidate once in GitHub Actions using environment `s002-spike` after local/proportional verification.

- A deterministic Harness/model/protocol/tool/replay incompatibility is evidence that Medium 3.5 does not satisfy this Harness path. In that case Engineering may continue with the direct Mistral integration specified by current Mistral documentation, without testing Mistral Large.
- A `RATE_LIMIT` or other provider-capacity condition remains an external blocker and does **not** prove Medium/Harness incompatibility.
- A PASS requires all six capabilities on the exact fixed Medium 3.5 tuple. No result from Large or a fallback model can substitute for that proof.
