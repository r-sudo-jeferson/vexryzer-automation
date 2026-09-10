# DeepSeek Harness + Mistral Compatibility Spike

Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`  
Slice: `VXA-S002@1.0.0`  
GAUNTLET: `GNT-VXA-S002-001`  
Status: `IN_PROGRESS / REAL_PROVIDER_NOT_VERIFIED`

## Purpose

This is the Task 1 proof gate for the S002 Agent Workshop. It determines whether an exact DeepSeek Harness release can drive the selected Mistral route with the behaviors Vexryzer requires before any Harness dependency is committed to the product root.

It is deliberately a spike, not a production runtime and not evidence that a public live Workshop is safely hostable.

## Candidate under test

- default DeepSeek Harness candidate: `0.1.2-rc.1` exact;
- default package pair: `@deepseek-ai/dsh@0.1.2-rc.1` + `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1`;
- provider route: `mistral` by default;
- model: `mistral-medium-3-5` by default;
- endpoint: `https://api.mistral.ai/v1` by default;
- route implementation: Harness `llm-pi-ai` using `openai-completions` compatibility mode.

The Harness version is a **candidate for evidence**, not an accepted product dependency. DeepSeek Harness is developer-preview software. A known public report exists against the `0.1.2-rc.1` train for Web/client-module loading; the SDK profile must therefore be proven directly rather than inferred healthy from version recency. If this exact candidate fails for a Harness defect, the root cause must be recorded before evaluating another exact release.

The runner permits a different exact semver through `VXA_HARNESS_VERSION` so a controlled comparison such as `0.1.1-rc.2` can be performed **without changing the source candidate SHA**. Tags such as `latest`, ranges such as `^0.1.2-rc.1`, and other mutable Harness selectors are rejected. Each result records the exact version it actually tested; evidence from different Harness versions may not be combined.

The Mistral default is intentionally pinned to `mistral-medium-3-5`, not `mistral-medium-latest`. Mistral documents `-latest` as a moving GA alias that may switch to a newer model; an exact model id keeps compatibility evidence attributable to one model release.

## DeepSeek Harness SDK contract

The spike uses the public TypeScript SDK surface of `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1` directly. `DeepSeekHarness` receives `profile`, `dshHome`, `processCwd`, `env`, `cwd`, `provider`, `model`, `maxTokens`, and lifecycle timeouts. It does **not** use the older `launch: { command, args }` shape.

The SDK itself resolves the same-version `@deepseek-ai/dsh` CLI package and builds canonical `dsh --profile sdk` argv. The spike additionally verifies that both installed package manifests report the exact requested Harness version before starting a provider turn.

## Required environment

Run from `job/` with the repository runtime contract:

- Node.js major `24`;
- pnpm exactly `11.25.0`;
- outbound HTTPS access to the package registry and Mistral endpoint;
- `MISTRAL_API_KEY` supplied only through the process environment.

Do not place the key in source, arguments, settings YAML, logs or checked-in fixtures.

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

`VXA_PNPM_BIN` exists only for an environment where the exact pnpm executable must be selected explicitly. The runner still verifies that the selected executable reports `11.25.0`.

## Isolation behavior of the spike

The runner creates one disposable temporary root and removes it in `finally`.

Package installation happens in a temporary runtime directory, not in `job/node_modules` and not in `job/package.json`. The package-install subprocess receives a scrubbed environment and does **not** receive `MISTRAL_API_KEY`, npm tokens, cloud credentials or other unrelated parent secrets. `PNPM_CONFIG_AUTO_INSTALL_PEERS=true` is set explicitly because the current Harness package family uses peer dependencies heavily.

Only after installation completes does the Harness subprocess receive a narrow environment containing ordinary execution variables, an isolated `DSH_HOME`, and `MISTRAL_API_KEY`. `settings.yaml` stores only `apiKeyEnv: MISTRAL_API_KEY`; it never stores the credential value.

The spike uses the shipped `sdk` profile in a disposable workspace. This does not approve `sdk-minimal` or an unrestricted Harness composition for visitor traffic.

## Required proof

A compatibility result is accepted only when all six fields are `true` for the exact Harness/provider/model tuple:

| Capability | Real evidence required |
| --- | --- |
| `streaming` | root-session `assistant/chunk` events are observed |
| `toolCalls` | both development turns contain a matching `tool/call` → `tool/result` round trip |
| `structuredArguments` | every observed probe `tool/call.arguments` is valid JSON object syntax |
| `multiTurnToolReplay` | the second turn uses a tool to read the artifact produced in turn one and returns its exact nonce |
| `restartSafe` | after closing/restarting the Harness against the same isolated home/session, the model recalls the first-turn nonce without reading the workspace again |
| `timeoutMapped` | a deliberately tiny provider timeout produces a bounded non-success/error path rather than hanging or being misclassified as completed |

The first turn must actually create `vxa-harness-tool-probe.txt` with an unpredictable nonce. The runner verifies the filesystem side effect itself; model text claiming that the file was created is not evidence.

## Output contract

Stdout contains a bounded JSON result. Successful completion records the exact Harness version, provider route, model id, six compatibility booleans and bounded event counts. Bootstrap/runtime failure records only a bounded phase, error class and sanitized message.

The runner does not intentionally emit raw provider payloads, conversation transcripts, tool arguments, tool results, nonce values or credentials. Before any failure diagnostic is emitted, the current Mistral credential value is replaced with `[REDACTED]` and the diagnostic is length-bounded.

Exit codes:

- `0`: all compatibility assertions passed for the exact tuple;
- `2`: the runner completed but one or more required compatibility capabilities did not pass;
- `1`: environment/bootstrap/runtime failure prevented a valid compatibility decision.

An exit `0` proves provider/Harness compatibility only. It does **not** prove the production Workshop security boundary, network egress confinement, Netlify compatibility or zero-cost long-lived hosting.

## Tests

Pure tests cover the evidence contract, event extraction, argument validation, environment scrubbing, timeout route configuration, exact candidate-version selection, pinned Mistral model selection, runtime-version gates, public Harness SDK option shape and diagnostic redaction:

```bash
cd job
node --test tests/pure/workshop-provider-contract.node.test.ts \
  tests/pure/workshop-harness-evidence.node.test.ts \
  tests/pure/workshop-spike-config.node.test.ts
```

The repository's normal Node 24 `pnpm test:pure` remains the authoritative integrated test command once the complete branch can be checked out in a compliant environment.

## Current execution evidence

The current ChatGPT local execution container is not a valid environment for the credentialed proof:

- Node present: `v22.16.0`, while Vexryzer requires Node 24;
- `pnpm` is not installed locally;
- GitHub/package network from the local container is unavailable due DNS resolution failure;
- GitHub Environment `s002-spike` now holds `MISTRAL_API_KEY` according to Founder confirmation, but GitHub secret values are intentionally not readable through this environment.

Therefore the next justified remote CI run is a hosted-runtime integration gate: Node 24 + pnpm 11.25.0 + the `s002-spike` environment secret. Until that run produces real evidence, DeepSeek Harness + Mistral compatibility remains `NOT_VERIFIED`, and the product `job/package.json` must not receive a Harness dependency.

## Next gate

Run this exact spike in GitHub Actions using environment `s002-spike`. Start with the default exact Harness candidate and fixed Mistral model. If it fails, preserve the failure and identify whether the cause is provider compatibility, SDK/runtime packaging, profile boot, tool availability, persistence/restart behavior or a known Harness release defect. Only then evaluate another exact candidate using `VXA_HARNESS_VERSION`.

Preserve only the bounded JSON evidence and exact source SHA. Do not combine results from different Harness versions, provider routes, model ids or source SHAs. If any required capability fails, correct the integration rather than weakening the contract, and rerun on a new exact candidate state when source changes.
