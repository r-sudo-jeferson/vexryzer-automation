# DeepSeek Harness + Mistral Compatibility Spike

Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`  
Slice: `VXA-S002@1.0.0`  
GAUNTLET: `GNT-VXA-S002-001`  
Status: `IN_PROGRESS / REAL_PROVIDER_NOT_VERIFIED`

## Purpose

This is the Task 1 proof gate for the S002 Agent Workshop. It determines whether an exact DeepSeek Harness release can drive the selected Mistral route with the behaviors Vexryzer requires before any Harness dependency is committed to the product root.

It is deliberately a spike, not a production runtime and not evidence that a public live Workshop is safely hostable.

## Candidate under test

- DeepSeek Harness: `0.1.2-rc.1` exact;
- package pair: `@deepseek-ai/dsh@0.1.2-rc.1` + `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1`;
- provider route: `mistral` by default;
- model: `mistral-medium-latest` by default;
- endpoint: `https://api.mistral.ai/v1` by default;
- route implementation: Harness `llm-pi-ai` using `openai-completions` compatibility mode.

The version is a **candidate for evidence**, not an accepted product dependency. DeepSeek Harness is developer-preview software. A known public report exists against the `0.1.2-rc.1` train for Web/client-module loading; the SDK profile must therefore be proven directly rather than inferred healthy from version recency. If this exact candidate fails for a Harness defect, the root cause must be recorded before evaluating another exact release.

The upstream `dsh-v0.1.2-rc.1` manifest declares the CLI executable as `bin.dsh = lib/bin.js`. The spike still resolves the installed manifest dynamically and refuses a path escaping the installed package instead of hardcoding package layout.

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

Optional non-secret routing overrides:

```bash
export VXA_MISTRAL_PROVIDER_ROUTE='mistral'
export VXA_MISTRAL_MODEL_ID='mistral-medium-latest'
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

Stdout contains a bounded JSON result with:

- schema version;
- exact Harness version;
- provider route and model id;
- the six compatibility booleans;
- counts of relevant session-event categories and tool names.

It does not intentionally emit raw provider payloads, conversation transcripts, tool arguments, tool results, nonce values or credentials.

Exit codes:

- `0`: all compatibility assertions passed for the exact tuple;
- `2`: the runner completed but one or more required compatibility capabilities did not pass;
- `1`: environment/bootstrap/runtime failure prevented a valid compatibility decision.

An exit `0` proves provider/harness compatibility only. It does **not** prove the production Workshop security boundary, network egress confinement, Netlify compatibility or zero-cost long-lived hosting.

## Tests

Pure tests cover the evidence contract, event extraction, argument validation, environment scrubbing, timeout route configuration, runtime-version gates and package-manifest CLI resolution:

```bash
cd job
node --test tests/pure/workshop-provider-contract.node.test.ts \
  tests/pure/workshop-harness-evidence.node.test.ts \
  tests/pure/workshop-spike-config.node.test.ts
```

The repository's normal Node 24 `pnpm test:pure` remains the authoritative integrated test command once the complete branch can be checked out in a compliant environment.

## Current execution evidence

The current ChatGPT execution container is not a valid environment for the credentialed proof:

- Node present: `v22.16.0`, while Vexryzer requires Node 24;
- GitHub/package network from the local container is unavailable due DNS resolution failure;
- no `MISTRAL_API_KEY` is exposed to the local execution container.

Independent pure contract tests were exercised in an isolated scratch tree with Node 22's explicit experimental type stripping. That evidence is useful for TDD of the helper logic but is **not** a substitute for the required Node 24 integrated run.

Therefore DeepSeek Harness + Mistral real-provider compatibility remains `NOT_VERIFIED`, and the product `job/package.json` must not receive a Harness dependency yet.

## Next gate

Run this exact spike in a Node 24 / pnpm 11.25.0 environment that can reach both the package registry and Mistral and that receives the existing Mistral credential securely. Preserve only the bounded JSON evidence and exact source SHA. If any required capability fails, preserve the failure, identify root cause, correct the spike/integration rather than weakening the contract, and rerun on a new exact candidate state.
