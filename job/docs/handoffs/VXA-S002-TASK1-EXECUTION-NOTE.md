# VXA-S002 Task 1 Execution Note

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`  
slice_id: `VXA-S002`  
slice_version: `1.0.0`  
gauntlet_id: `GNT-VXA-S002-001`  
status: `BLOCKED`  
blocker: `MISTRAL_PROVIDER_RATE_LIMIT`  
execution_branch: `slice/vxa-s002-ask-ai-adaptive-experience`  
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`  
latest_executable_spike_sha: `cee6d919e67676f55f6d07ecdf0562b491bcce05`

## Contract position

Task 1 is the mandatory first technical gate for `VXA-S002@1.0.0`. DeepSeek Harness cannot become a product dependency until the selected Mistral path proves all required behaviors on one exact candidate state: streaming/events, real tool calls, structured tool arguments, multi-turn tool replay, timeout/error mapping, and restart/session persistence.

The authorized provider-path order is preserved:

1. pinned Harness release Mistral catalog route;
2. configured `llm-pi-ai` Mistral route;
3. custom adapter only if the two supported paths fail for actual compatibility reasons.

The selected model remains fixed at `mistral-medium-3-5`. No run below changes model, weakens a capability, or treats an operational provider limit as a compatibility PASS.

## Runtime and evidence integrity

The credentialed gate runs only on the GitHub-hosted Node 24 / pnpm 11.25.0 environment because the local ChatGPT container has Node 22, no pnpm and no usable outbound package/GitHub DNS.

The temporary Harness runtime is outside `job/node_modules` and does not mutate `job/package.json`. Package installation receives a scrubbed environment with no `MISTRAL_API_KEY`. The credential is added only to the isolated Harness child process and is referenced from generated configuration by the environment-variable name, never by value.

For the latest candidate, the temporary runtime pins:

- `@deepseek-ai/dsh@0.1.2-rc.1`;
- `@deepseek-ai/dsh-sdk-client@0.1.2-rc.1`;
- `@deepseek-ai/dsh-llm-pi-ai@0.1.2-rc.1`;
- `@earendil-works/pi-ai@0.84.2` exact;
- React / ReactDOM `18.3.1` peer anchors.

The explicit pi-ai core pin prevents the adapter manifest's `^0.84.2` range from silently changing evidence for the same source SHA. The hosted bootstrap verifies installed package versions before provider execution.

## Provider-path evidence

### Catalog route — Run `34457175731`

Source SHA: `6c8119253b111323a350850d8eac06cd77d7be21`.

- hosted pure contracts: `25/25` PASS;
- exact Harness candidate: `0.1.2-rc.1`;
- SDK route/model: `mistral` / `mistral-medium-3-5`;
- result: deterministic pre-provider failure;
- failure: `pi-ai provider "mistral" has no configured model "mistral-medium-3-5"`;
- provider request: not required to establish this failure;
- compatibility: `FAIL / NOT_VERIFIED`.

This closes the first supported path for the exact selected model. The packaged `pi-ai@0.84.2` Mistral provider exists, but its catalog does not expose the selected fixed model id required by the Slice.

### Configured route on full `sdk` profile — Run `34457652884`

Source SHA: `626276eba9a25b00ae972b22dbd14f43f201f4c2`.

- Node `24.21.0`: PASS;
- pnpm `11.25.0`: PASS;
- hosted pure contracts: `24/24` PASS;
- configured `llm-pi-ai` route reached the provider;
- first step final failure: `RATE_LIMIT`;
- tool calls/results: `0/0`;
- reported token usage: unavailable because no assistant message completed;
- bounded request surface: system prompt `4,528` characters, `26` tool schemas;
- credentialed phase duration: about 75 seconds under a retry policy allowing one `RATE_LIMIT` retry after a 65-second local window;
- artifact id: `10144196082`;
- artifact SHA-256: `c2bb53c9a3319aaf5f8c63c57dcf915f7f309aeddde623b05186304ef9eeba69`;
- compatibility: `FAIL / NOT_VERIFIED`.

This run established that the configured route can boot and reach Mistral, but it did not distinguish a provider/account limit from request-size pressure.

### Configured route on official `sdk-minimal` profile — Run `34459827166`

Source SHA: `cee6d919e67676f55f6d07ecdf0562b491bcce05`.

The exact `0.1.2-rc.1` Harness release ships `sdk-minimal`, a standalone SDK coding-agent profile with persistent JSONL sessions and two model-facing development tools on Linux: persistent shell and `str_replace_editor`. The candidate uses the official profile and a launch patch that disables only `llm-deepseek` and inserts the same configured `llm-pi-ai` Mistral adapter. It does not recreate the Harness architecture.

Hosted evidence:

- checkout exact SHA: PASS;
- Node `24.21.0`: PASS;
- pnpm `11.25.0`: PASS;
- pure Workshop contracts: `26/26` PASS;
- exact `dsh`, SDK, `llm-pi-ai`, `sdk-minimal`, and `pi-ai@0.84.2` bootstrap verification: passed far enough to enter the real model turn;
- real profile recorded in result: `sdk-minimal`;
- request headers observed: `1`;
- system prompt: `46` characters;
- tool schemas: exactly `2`;
- step start/end: `1/1`;
- assistant chunks: `4`;
- assistant messages: `0`;
- tool calls/results: `0/0`;
- final provider-neutral error code: `RATE_LIMIT`;
- bounded HTTP status: unavailable in the Harness failure envelope;
- reported token usage: unavailable because the model request never completed;
- exact workspace artifact: not created;
- credentialed phase duration: about 75 seconds under the same bounded `RATE_LIMIT` retry policy;
- artifact id: `10145087882`;
- artifact SHA-256: `ccf2aadb84caa8129f37165f7c6609b92002ca81ad79542843cc8e35852b8d70`;
- compatibility: `FAIL / NOT_VERIFIED`.

The reduction from 26 tool schemas / 4,528 system-prompt characters to 2 tool schemas / 46 characters did **not** change the provider result. Therefore Engineering must not continue shrinking the Harness request or removing required tool capability as a supposed fix. Request-surface pressure is no longer a sufficient explanation for the blocker.

## Current blocker classification

`MISTRAL_PROVIDER_RATE_LIMIT` is now the narrowest supported classification.

Current Mistral documentation states that API keys inherit Workspace/Organization limits and that `429 Too Many Requests` can result from API rate limits or a Workspace spending limit. Exact Organization rate limits are visible in the Mistral Admin Panel; programmatic spend/rate-limit inspection uses Mistral's Admin API and a dedicated Admin API key. The standard model API credential already stored in GitHub Environment `s002-spike` does not provide that administrative visibility.

No suitable connected Mistral account plugin is available in the current ChatGPT environment. Engineering therefore cannot safely determine from here whether the active constraint is RPS, TPM, monthly/model quota, Workspace spending cap, Organization spending cap, or another provider-side limit.

A direct synthetic replacement, model switch, removal of required tool behavior, or custom adapter would not resolve this evidence and is prohibited by the Slice order/integrity rules.

## Next justified gate

Do **not** rerun the unchanged candidate merely to test whether the provider limit disappeared.

The next credentialed compatibility run is justified only after one of these external facts changes or is verified:

- Mistral Admin Panel shows sufficient API/model rate capacity and no exhausted Workspace/Organization spending cap; or
- an authorized Mistral Admin API key becomes available to read the applicable spend/rate limits; or
- the provider/account limit is increased/reset by the account owner/provider.

After that external condition is verified, rerun the exact executable candidate `cee6d919e67676f55f6d07ecdf0562b491bcce05` once. If all six required capabilities pass, only then may Engineering evaluate production Harness dependency commitment. If the run exposes a genuine protocol/tool/replay/restart incompatibility instead of an operational rate limit, preserve that failure and return to root-cause debugging before any custom adapter decision.

## Current truth

- S002: `BLOCKED` on the mandatory first technical gate.
- Task 1: `BLOCKED` on `MISTRAL_PROVIDER_RATE_LIMIT`.
- latest executable spike checkpoint: `cee6d919e67676f55f6d07ecdf0562b491bcce05`.
- catalog route for the exact selected model: evaluated and deterministically unavailable in the pinned catalog.
- configured `llm-pi-ai` route: boots and reaches Mistral through both full `sdk` and official `sdk-minimal` compositions.
- official `sdk-minimal` composition integrity: verified in the hosted run by exactly 2 tool schemas and a 46-character system prompt.
- DeepSeek Harness `0.1.2-rc.1` + Mistral full compatibility: `NOT_VERIFIED` because the provider blocks before tool execution.
- root `job/package.json` Harness dependency commitment: prohibited.
- GAUNTLET: `NOT_RUN`.
- candidate freeze: `NOT_STARTED`.
- promotion: `NOT_STARTED`.
- no credential rotation is indicated by current evidence; the model credential is present and reaches the provider.
