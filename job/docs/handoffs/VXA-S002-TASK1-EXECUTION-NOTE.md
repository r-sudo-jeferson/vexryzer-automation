# VXA-S002 Task 1 Execution Note

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
gauntlet_id: `GNT-VXA-S002-001`
status: `BLOCKED`
blocker: `MISTRAL_PROVIDER_RATE_LIMIT`
execution_branch: `slice/vxa-s002-ask-ai-adaptive-experience`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
latest_spike_checkpoint_sha: `6973d15234674674b582f35e0de58163cdb971a9`

## Plan strengthening

Task 1 in the stored implementation plan included a sample test that created an object with all compatibility booleans set to `true` and asserted that those booleans were `true`. That sample cannot fail when the production compatibility contract is absent and therefore cannot prove behavior.

Under test-integrity and TDD rules, execution strengthens that sample rather than treating it as evidence. The real test imports production spike-contract code, rejects every missing material capability independently, and proves that the exported summary contains only bounded non-secret compatibility facts.

The RED phase is valid only when the test fails because the production module is absent or behavior is incorrect. A syntax/runtime/tooling error is not accepted as RED evidence.

## Environment evidence

The available local execution container cannot resolve `github.com`, so it cannot clone the repository or install remote npm packages. Its Node runtime is `v22.16.0`, while the repository contract requires Node 24 for product verification.

This does not authorize remote CI as a trial loop. Independent pure spike-contract behavior and bounded Harness-event extraction were exercised in an isolated scratch tree with Node's explicit experimental TypeScript stripping. The authoritative hosted spike uses the repository-required Node 24 and pnpm 11.25.0.

## Harness version evaluation

The currently reviewed spike candidate remains exact DeepSeek Harness `0.1.2-rc.1`. Newer upstream tags exist, but no newer release is accepted merely because it is newer. Moving the candidate requires its own dependency/build-script/peer review and fresh compatibility evidence.

The exact Harness version/provider/model tuple must prove Mistral streaming, tool calls, structured tool arguments, same-session replay, timeout/error mapping, and restart/session persistence before root product dependency commitment.

## Credentialed spike evidence

### Run 34453403706 — checkpoint `776a54990f601c92399145e2fcc5ae7c13bdcbb0`

- Node `24.21.0`: PASS.
- pnpm `11.25.0`: PASS.
- pure Workshop contracts: `22/22` PASS.
- `MISTRAL_API_KEY` supplied by GitHub Environment `s002-spike`: present and masked.
- real Harness + Mistral turn: emitted `12` assistant chunks, then ended with `turn/end.reason.kind = error`.
- tool calls/results: `0/0`.
- exact workspace artifact: not created.
- compatibility result: `FAIL / NOT_VERIFIED`.
- bounded artifact id: `10142462639`.

This run proved the failure occurs before a Harness tool round trip; it did not safely expose the structured provider failure code.

### Diagnostic TDD strengthening

A new pure test was written first to require extraction of only structured `turn/end.reason.error.code` and integer HTTP status facts while refusing provider error text and request identifiers. The isolated RED failed because the fields were absent. The minimal implementation then passed the complete local `workshop-harness-evidence` suite `6/6`.

Checkpoint `6973d15234674674b582f35e0de58163cdb971a9` contains only this bounded diagnostic strengthening and its test.

### Run 34454158028 — checkpoint `6973d15234674674b582f35e0de58163cdb971a9`

- checkout exact checkpoint: PASS.
- Node `24.21.0`: PASS.
- pnpm `11.25.0`: PASS.
- all hosted pure Workshop contracts: `23/23` PASS.
- `MISTRAL_API_KEY`: present and masked.
- real Harness + Mistral turn: emitted `12` assistant chunks, then ended before any tool call.
- `turn/end.reason.kind`: `error`.
- bounded provider-neutral error code: `RATE_LIMIT`.
- bounded HTTP status: unavailable in the Harness failure envelope.
- tool calls/results: `0/0`.
- compatibility result: `FAIL / NOT_VERIFIED`.
- bounded artifact id: `10142760271`.
- bounded artifact SHA-256: `be5182498be59fe5058877f582a941003a681c9f048537ed4cea1f147fb705c6`.

The second run localizes the immediate failure to provider rate limiting. It does not prove a Harness tool-call incompatibility, a filesystem failure, or a Mistral function-calling limitation. Re-running the unchanged candidate while the external condition is unchanged would be speculative CI and is prohibited by `OPTIMIZED_GATES_ONLY`.

## Provider and route findings

Current Mistral documentation confirms `mistral-medium-3-5` supports function calling, so the selected model is not disqualified from the required tool-use proof merely by model capability.

The exact DeepSeek Harness `0.1.2-rc.1` `llm-pi-ai` source documents catalog-backed provider routes: a route naming an installed catalog provider can reuse the catalog provider/model defaults, while hand-declared routes can provide explicit protocol/base URL/model data.

The exact `@earendil-works/pi-ai@0.84.2` source used by this Harness train contains a built-in `mistral` provider whose base URL is `https://api.mistral.ai`, whose credential discovery includes `MISTRAL_API_KEY`, and whose backend is the native `mistral-conversations` implementation. That native implementation contains first-class Mistral tool serialization, tool-call replay normalization, and streaming handling. The spike's current explicit route instead overrides the backend to `openai-completions` and the base URL to `/v1`, so the two paths are materially distinct.

Task 1 Step 4 requires strict evaluation order: pinned Harness Mistral catalog route first; configured `llm-pi-ai` Mistral route second; custom adapter only if required behavior still fails. The current spike reached the explicit route before this ordering discrepancy was identified. Its `RATE_LIMIT` failure is operational, not a valid compatibility failure that authorizes skipping the catalog route.

## Next authorized compatibility probe

When Mistral rate capacity is available again, the next code candidate must make the normal compatibility probe register the catalog-backed route without overriding provider protocol, endpoint, compatibility switches, or model catalog. The intended settings shape is equivalent to:

```yaml
llm-pi-ai:
  providers:
    mistral:
      apiKeyEnv: MISTRAL_API_KEY
```

The SDK route/model remain `mistral` / `mistral-medium-3-5`. `MISTRAL_API_KEY` remains available only through the scrubbed child environment.

The timeout probe can use the same catalog route in its separate `DSH_HOME`, adding only the bounded timeout fields required for the timeout-mapping test. It does not need a synthetic hand-declared provider route merely for isolation because its settings home is already isolated.

If the catalog-backed route then produces a reproducible compatibility failure rather than an operational condition such as `RATE_LIMIT`, Engineering may proceed to the second mandated path: an explicit configured `llm-pi-ai` Mistral route. A custom adapter remains prohibited until both supported paths have been evaluated against the required behavior.

No new credentialed CI run should be dispatched solely to check whether the same provider rate-limit condition has disappeared.

## Current truth

- S002: `BLOCKED` on the mandatory first technical gate.
- Task 1: `BLOCKED` on `MISTRAL_PROVIDER_RATE_LIMIT`.
- branch documentation head after this note: determined by the commit containing this update.
- latest executable spike checkpoint: `6973d15234674674b582f35e0de58163cdb971a9`.
- bounded diagnostic extraction: verified by TDD locally and by hosted Node-24 pure contracts.
- DeepSeek Harness `0.1.2-rc.1` + Mistral real-provider compatibility: `NOT_VERIFIED`.
- `mistral-medium-3-5` function-calling capability: supported by current Mistral documentation; Harness compatibility still unproven.
- catalog-backed `mistral` route existence/native Mistral backend: verified from the exact `pi-ai@0.84.2` source; selected-model presence in the packaged catalog remains `NOT_VERIFIED` until the catalog-first probe resolves it.
- root `job/package.json` Harness dependency commitment: prohibited until the real-provider proof passes.
- GAUNTLET: `NOT_RUN`.
- candidate: `NOT_FROZEN`.
- promotion: `NOT_STARTED`.
- no additional credential action is required from the Founder based on current evidence; immediate progress requires provider rate capacity, not a new secret.
