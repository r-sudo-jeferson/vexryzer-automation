# VXA-S002 Task 1 Execution Note

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`  
slice_id: `VXA-S002`  
slice_version: `1.0.0`  
gauntlet_id: `GNT-VXA-S002-001`  
status: `BLOCKED`  
blocker: `MISTRAL_PROVIDER_RATE_LIMIT`  
execution_branch: `slice/vxa-s002-ask-ai-adaptive-experience`  
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`  
latest_executable_spike_sha: `faef7c6f372cc715012a7e7d51d447d3250aad04`

## Contract position

Task 1 is the mandatory first technical gate for `VXA-S002@1.0.0`. DeepSeek Harness cannot become a product dependency until the selected Mistral path proves all required behaviors on one exact candidate state: streaming/events, real tool calls, structured tool arguments, multi-turn tool replay, timeout/error mapping, and restart/session persistence.

The selected model remains fixed at `mistral-medium-3-5`. Mistral Large is not a fallback and is not part of this gate. An operational provider limit is neither a compatibility PASS nor evidence that Medium is incompatible with Harness.

The provider-path order remains intact:

1. pinned Harness release Mistral catalog route;
2. configured `llm-pi-ai` Mistral route;
3. direct/custom integration only after a genuine compatibility failure of the supported Harness paths.

## Runtime and evidence integrity

The credentialed gate runs on the GitHub-hosted Node 24 / pnpm 11.25.0 environment. The temporary Harness runtime remains outside `job/node_modules` and does not mutate `job/package.json`. Package installation receives a scrubbed environment without `MISTRAL_API_KEY`; the credential reaches only the isolated Harness child process and generated configuration stores only its environment-variable reference.

The temporary runtime pins:

- `@deepseek-ai/dsh@0.1.2-rc.1`;
- `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1`;
- `@deepseek-ai/dsh-llm-pi-ai@0.1.2-rc.1`;
- `@earendil-works/pi-ai@0.84.2` exact;
- React / ReactDOM `18.3.1` peer anchors.

The exact pi-ai pin prevents the adapter manifest's `^0.84.2` range from silently changing evidence for the same source SHA.

## Provider-path evidence

### Packaged catalog route — Run `34457175731`

Source SHA: `6c8119253b111323a350850d8eac06cd77d7be21`.

- hosted pure contracts: `25/25` PASS;
- exact Harness candidate: `0.1.2-rc.1`;
- SDK route/model: `mistral` / `mistral-medium-3-5`;
- result: deterministic pre-provider failure;
- failure: `pi-ai provider "mistral" has no configured model "mistral-medium-3-5"`;
- compatibility: `FAIL / NOT_VERIFIED`.

This established only that the packaged `pi-ai@0.84.2` catalog predates the selected fixed model id. It did not establish that the native Mistral provider implementation cannot serve that model.

### Explicit OpenAI-compatible route — Run `34457652884`

Source SHA: `626276eba9a25b00ae972b22dbd14f43f201f4c2`.

- Node `24.21.0`: PASS;
- pnpm `11.25.0`: PASS;
- hosted pure contracts: `24/24` PASS;
- configured route reached Mistral;
- first-step failure: `RATE_LIMIT`;
- tool calls/results: `0/0`;
- system prompt: `4,528` characters;
- advertised tool schemas: `26`;
- artifact id: `10144196082`;
- artifact SHA-256: `c2bb53c9a3319aaf5f8c63c57dcf915f7f309aeddde623b05186304ef9eeba69`;
- compatibility: `FAIL / NOT_VERIFIED`.

### Explicit route on official `sdk-minimal` — Run `34459827166`

Source SHA: `cee6d919e67676f55f6d07ecdf0562b491bcce05`.

- hosted pure contracts: `26/26` PASS;
- real Harness profile: `sdk-minimal`;
- system prompt: `46` characters;
- tool schemas: exactly `2`;
- first-step failure: `RATE_LIMIT`;
- tool calls/results: `0/0`;
- artifact id: `10145087882`;
- artifact SHA-256: `ccf2aadb84caa8129f37165f7c6609b92002ca81ad79542843cc8e35852b8d70`;
- compatibility: `FAIL / NOT_VERIFIED`.

Reducing the model-facing request surface from 26 tools / 4,528 system-prompt characters to 2 tools / 46 characters did not remove the provider limit. Engineering therefore stopped treating request-surface size as a sufficient blocker explanation.

### Native Mistral provider with fixed Medium 3.5 — Run `34463281339`

Source SHA: `faef7c6f372cc715012a7e7d51d447d3250aad04`. Job: `102825863558`.

This candidate removes the OpenAI-compatible transport override. The configured route remains named `mistral`, supplies only `MISTRAL_API_KEY` plus an explicit `models` entry for `mistral-medium-3-5`, and does not set `api`, `baseURL`, or compatibility switches. Under the exact `dsh-llm-pi-ai@0.1.2-rc.1` implementation, that shape reuses pi-ai's built-in Mistral provider and its native `mistral-conversations` Chat Completions transport. The explicit model entry only bridges the fact that the pinned pi-ai catalog predates Medium 3.5.

Hosted evidence:

- checkout exact SHA: PASS;
- Ubuntu `24.04.5`: observed;
- Node `24.21.0`: PASS;
- pnpm `11.25.0`: PASS;
- pure Workshop contracts: `26/26` PASS;
- native-Mistral route rendering contract: PASS;
- exact package/bootstrap checks: passed far enough to enter the real model turn;
- real profile: `sdk-minimal`;
- system prompt: `46` characters;
- tool schemas: exactly `2`;
- request headers observed: `1`;
- step start/end: `1/1`;
- assistant chunks: `12`;
- assistant messages: `0`;
- tool calls/results: `0/0`;
- final provider-neutral failure: `RATE_LIMIT`;
- bounded HTTP status: unavailable in the Harness terminal envelope;
- reported input/output/cache tokens: unavailable because no assistant message completed;
- workspace probe artifact: not created;
- normal recovery policy: bounded exponential backoff over transient provider failures; timeout probe remains retry-free;
- artifact id: `10146455906`;
- artifact SHA-256: `9b807e9092cb4b2d983ff41a482a9f8c3287f794134941d2ecec7b8e31132115`;
- compatibility: `FAIL / NOT_VERIFIED`.

This is the key decision evidence. The exact DeepSeek Harness stack accepted the configured `mistral-medium-3-5` route through model resolution, native-provider construction, Harness startup, request construction, and dispatch to Mistral. There was no `UNKNOWN_MODEL`, unsupported-protocol, patch/composition, tool-schema, or startup failure. The request reached the provider and ended only with `RATE_LIMIT`.

Therefore Run `34463281339` does **not** support the conclusion that Medium 3.5 is incompatible with DeepSeek Harness. It supports the narrower conclusion that base Medium/Harness compatibility remains blocked from full verification by provider capacity/rate limiting.

## Mistral-documentation alignment

Current Mistral documentation identifies `mistral-medium-3-5` as a GA model optimized for agentic and coding use cases, with a 256k context window and support for Chat Completions, function calling and structured outputs. The fixed id is intentionally retained instead of a moving `-latest` alias.

The native provider path now follows the Mistral Chat Completions contract rather than emulating an OpenAI-compatible gateway. The exact pi-ai implementation sends to the Mistral `/v1/chat/completions` endpoint, uses Bearer authentication, SSE streaming, Mistral tool-call serialization, and Mistral tool-call-id normalization.

Mistral documents `429 Too Many Requests` as a rate-limit condition and recommends retry with exponential backoff. The normal probe uses bounded exponential recovery for transient classes. Persistent `RATE_LIMIT` after that policy remains external evidence; it is never converted into PASS.

Mistral also recommends `reasoning_effort="high"` for Medium 3.5 in agentic/code workloads and requires full thinking-chunk replay in multi-turn conversations. Reasoning is deliberately not enabled in this base compatibility probe because it is not one of Task 1's six required capabilities and increases token pressure. If Harness compatibility later passes, reasoning/replay must receive its own production-grade verification before enablement. If a direct Mistral implementation is later authorized by genuine Harness incompatibility, the same Mistral reasoning/replay rule applies there.

## Decision rule from the Founder

The Founder directed Engineering to validate Medium 3.5 with DeepSeek Harness and, only if Medium does not work with Harness, continue according to Mistral's native documentation. Mistral Large is excluded from this decision path.

Run `34463281339` does not trigger the direct-Mistral fallback because it contains no genuine Harness/Medium incompatibility. It reached the provider and was blocked by `RATE_LIMIT`.

A future run that produces a deterministic model/protocol/tool/replay/restart incompatibility after provider capacity is available would authorize proceeding to direct Mistral integration. An operational `RATE_LIMIT`, spending/capacity restriction, authentication outage, or similar external condition does not.

## Current blocker classification

`MISTRAL_PROVIDER_RATE_LIMIT` remains the narrowest supported blocker.

Mistral documents RPS and TPM as independently enforced rate limits, and token accounting covers input plus output. The available Harness envelope does not expose enough provider detail to determine which exact provider-side limiter fired. Engineering will not invent an RPS/TPM/spending diagnosis from `RATE_LIMIT` alone.

No additional model credential is indicated by current evidence. Re-running the same executable state without evidence that provider capacity changed would violate `OPTIMIZED_GATES_ONLY`.

## Next justified gate

Do **not** test Large. Do **not** revert to OpenAI-compatible transport. Do **not** start a direct Mistral production integration merely because the native Harness request received `RATE_LIMIT`.

The next credentialed compatibility run is justified when Mistral capacity for the existing account/model is known to be available or another provider-side limiting condition has changed. At that point rerun the exact executable SHA `faef7c6f372cc715012a7e7d51d447d3250aad04` once.

- If all six capabilities pass: Harness remains the authorized path and production dependency evaluation may proceed.
- If a genuine Medium/Harness incompatibility appears: preserve the exact failure and proceed to the direct Mistral implementation using current Mistral Chat Completions/function-calling/streaming/replay documentation, without testing Large.
- If `RATE_LIMIT` persists: remain `BLOCKED`; do not fabricate a compatibility decision.

## Current truth

- S002: `BLOCKED` on the mandatory first technical gate.
- Task 1: `BLOCKED` on `MISTRAL_PROVIDER_RATE_LIMIT`.
- latest executable spike checkpoint: `faef7c6f372cc715012a7e7d51d447d3250aad04`.
- packaged catalog route: evaluated; catalog lacks the exact fixed Medium 3.5 id.
- native configured `llm-pi-ai` route: resolves fixed Medium 3.5 and reaches Mistral through pi-ai's native Mistral provider.
- Medium 3.5 rejected by DeepSeek Harness: **NO EVIDENCE**.
- full DeepSeek Harness `0.1.2-rc.1` + Medium 3.5 compatibility: `NOT_VERIFIED`, because provider limiting occurs before tool execution.
- Mistral Large: not tested and not authorized as fallback.
- direct Mistral production integration: not yet authorized by the decision rule because no Harness incompatibility is proven.
- root `job/package.json` Harness dependency commitment: prohibited until the mandatory proof passes.
- GAUNTLET: `NOT_RUN`.
- candidate freeze: `NOT_STARTED`.
- promotion: `NOT_STARTED`.
