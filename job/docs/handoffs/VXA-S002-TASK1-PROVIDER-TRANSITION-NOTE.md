# VXA-S002 Task 1 Provider Transition Handoff

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
gauntlet_id: `GNT-VXA-S002-001`
status: `IN_PROGRESS / NOT_VERIFIED`
execution_branch: `slice/vxa-s002-ask-ai-adaptive-experience`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
transition_checkpoint_sha: `835ba25446051ce597b27eae29ac18ea2538c16a`
architecture_amendment: `VXA-ARCH-A002`
previous_handoff: `job/docs/handoffs/VXA-S002-TASK1-EXECUTION-NOTE.md`

## Purpose

This handoff preserves the historical Mistral investigation and records the Founder-authorized transition to the multi-provider Free Tier strategy. It supersedes the previous handoff only for current provider routing, blocker/status and next-gate instructions. The earlier run evidence remains valid for the exact tuples tested.

## Final pre-transition Mistral diagnostic

Run: `34466683049`  
Job: `102836791901`  
Candidate SHA: `835ba25446051ce597b27eae29ac18ea2538c16a`  
Harness: `0.1.2-rc.1`  
Profile: `sdk-minimal`  
Provider route: `mistral`  
Model: `ministral-14b-2512`  
Artifact id: `10147809490`  
Artifact SHA-256: `062420462c8da0146756cf3672a03b7258b4f71a043dba9a31b983bb4eae230d`

Hosted pure Workshop contracts: `38/38 PASS`.

Compatibility evidence:

- streaming: `PASS`;
- canonical tool call/result round-trip: `PASS`;
- structured tool arguments: `PASS`;
- timeout mapping: `PASS`;
- multi-turn semantic replay: `FAIL`;
- restart semantic recall: `FAIL`.

Bounded semantic/persistence evidence:

- second tool result contains nonce: `true`;
- second assistant response includes nonce: `false`;
- restarted assistant response includes nonce: `false`;
- persistence before restart: one JSONL file, marker present;
- persistence after restart: one JSONL file, marker present.

The root-cause boundary is therefore narrower than “Harness persistence failed”. The Harness session file retained the marker before and after restart, and the canonical second-turn tool result contained the nonce. The tested Ministral 14B tuple failed to reproduce that known value in the assistant response both before and after restart.

This is a semantic suitability/replay failure for the exact tested tuple, not evidence of session-file loss. It also does not convert earlier Medium 3.5 `429` or GLM/Large `403` results into compatibility failures.

## Historical provider screening retained

The prior model battery established distinct provider conditions:

- Z.ai GLM 5.2 on the Mistral account: `403` / access entitlement;
- Mistral Medium 3.5: `429` / provider Free Tier capacity/rate condition;
- Mistral Small 4: `429` / provider Free Tier capacity/rate condition;
- Mistral Large 3: `403` / access entitlement;
- Ministral 14B: direct provider stream/tool/replay capable, later Harness semantic replay/recall failure as above;
- Ministral 8B: direct replay semantic screen failed;
- Ministral 3B: direct stream/tool/replay screen passed;
- Codestral 2508: direct stream/tool/replay screen passed but remains code-specialized.

These results remain historical evidence. The Founder subsequently authorized a provider-strategy change rather than further blind Mistral CI retries.

## Founder-authorized active strategy

Current provider authority is now:

1. Cloudflare Workers AI primary family;
2. Groq independent external fallback;
3. OpenRouter optional emergency-only after separate exact verification;
4. Mistral standby.

Fixed cost remains `R$ 0`. Active routes must not require a payment method, paid subscription, prepaid credits, billing activation, automatic upgrade or overage.

Customer attachment contents are not LLM inputs. ASK AI is the persuasive Seller and adaptive experience intelligence; future documents are delivered to the human fulfillment path under later Slice authority.

## Authorized compatibility candidates

All begin `NOT_VERIFIED`:

- Cloudflare `@cf/zai-org/glm-4.7-flash` — primary Seller/Composer candidate;
- Cloudflare `@cf/google/gemma-4-26b-a4b-it` — Critic/second-opinion candidate;
- Cloudflare `@cf/openai/gpt-oss-120b` — Workshop code/UI candidate;
- Cloudflare `@cf/nvidia/nemotron-3-120b-a12b` — fallback-quality candidate;
- Groq `openai/gpt-oss-120b` — independent provider fallback candidate;
- OpenRouter exact `:free` model — disabled/optional until separately configured and verified.

No candidate is PASS merely because documentation lists it.

## New mandatory gate

The next credentialed gate must verify actual no-payment account access and role behavior for the new provider matrix.

Direct runtime screening must prove, as applicable:

- authenticated access without billing/payment registration;
- exact model id;
- streaming;
- structured tool/function call arguments;
- tool-result continuation;
- bounded error mapping for access/rate/capacity/timeout;
- no secret leakage;
- tested context/rate behavior.

A Seller route additionally requires persuasion-quality evaluation against the authorized Seller rubric.

A model used through DeepSeek Harness Workshop additionally requires the existing six Harness properties on the exact pinned tuple.

## Credential dependency

The first new gate depends on GitHub Environment `s002-spike` containing these secret names, with values never copied into chat or repository:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
GROQ_API_KEY
```

`OPENROUTER_API_KEY` is optional and must not block progress.

Until those credentials exist, Engineering may implement and verify provider-neutral pure contracts locally/statically, but may not claim provider compatibility.

## CI discipline

Do not continue using the old Mistral workflow as a trial-and-error loop. Construction should occur on an isolated staging branch and maximize pure/local verification first. Run the new credentialed provider workflow only when it materially increases confidence and the candidate is stabilized.

Do not re-run run `34466683049` unchanged. Its evidence is already decisive for its exact tuple.

## Current truth

- S002: `IN_PROGRESS / NOT_VERIFIED`;
- provider architecture `VXA-ARCH-A002`: `AUTHORIZED`;
- active primary provider family: Cloudflare Workers AI, compatibility `NOT_VERIFIED`;
- external fallback provider: Groq, compatibility `NOT_VERIFIED`;
- OpenRouter: optional/disabled, `NOT_VERIFIED`;
- Mistral: standby with preserved historical evidence;
- canonical context/provider-neutral Seller design: authorized, not yet implemented;
- GAUNTLET: `NOT_RUN`;
- candidate freeze: `NOT_STARTED`;
- promotion: `NOT_STARTED`;
- final state: `IN_PROGRESS`.
