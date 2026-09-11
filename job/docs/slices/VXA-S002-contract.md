# VXA-S002 Slice Contract

slice_id: `VXA-S002`
slice_version: `1.0.0`
initiative_id: `VXA-001`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
status: `AUTHORIZED / IN_PROGRESS`
predecessors: `VXA-S001@1.0.0`
repository: `r-sudo-jeferson/vexryzer-automation`
product_root: `job`
base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0a`
gauntlet_id: `GNT-VXA-S002-001`
product_amendment: `job/docs/product/VXA-001-product-contract-amendment-001.md`
agent_led_product_amendment: `job/docs/product/VXA-001-product-contract-amendment-002.md`
architecture_amendment: `job/docs/architecture/VXA-001-architecture-amendment-001.md`
agent_led_architecture_amendment: `job/docs/architecture/VXA-001-architecture-amendment-003.md`
deepseek_architecture_amendment: `job/docs/architecture/VXA-001-architecture-amendment-004.md`
authorization: `job/docs/authorizations/VXA-S002-AUTHORIZATION.md`
agent_led_authorization: `job/docs/authorizations/VXA-S002-AGENT-LED-ACCOUNTING-SELLER-AUTHORIZATION.md`
deepseek_authorization: `job/docs/authorizations/VXA-S002-DEEPSEEK-SINGLE-TRUTH-AUTHORIZATION.md`
design_spec: `job/docs/superpowers/specs/2026-09-10-ask-ai-adaptive-experience-design.md`
agent_led_design: `job/docs/superpowers/specs/2026-09-10-vxa-s002-agent-led-accounting-seller-design.md`
deepseek_design: `job/docs/superpowers/specs/2026-09-11-vxa-s002-deepseek-single-truth-design.md`
implementation_plan: `job/docs/superpowers/plans/2026-09-10-vxa-ask-ai-adaptive-experience-plan.md`
agent_led_plan: `job/docs/superpowers/plans/2026-09-10-vxa-s002-agent-led-accounting-seller-plan.md`
deepseek_plan: `job/docs/superpowers/plans/2026-09-11-vxa-s002-deepseek-single-truth-plan.md`

## Authorization state

The Slice remains `VXA-S002@1.0.0` on the same authorized base and GAUNTLET.

On 2026-09-10 the Founder authorized the Agent-Led Accounting Seller and Deterministic Trust Kernel.

On 2026-09-11 the Founder issued a stronger provider/harness directive: DeepSeek is the single mandatory AI truth. `VXA-ARCH-A004` and `VXA-S002-DEEPSEEK-SINGLE-TRUTH-AUTHORIZATION.md` revoke every prior active multi-provider, alternate-model and alternate-harness assumption.

Historical experiments do not remain eligible merely because their evidence exists in Git history.

## Active AI truth

The only authorized generative route is:
- provider: DeepSeek;
- model id: `deepseek-v4-pro`;
- harness: DeepSeek Harness;
- Harness target version for fresh exact-tuple verification: `0.1.5-rc.2`;
- API base: `https://api.deepseek.com`;
- server credential name: `DEEPSEEK_API_KEY`.

No other provider, model, alias, standby route, emergency LLM, compatibility route or agent harness is authorized.

If this route is unavailable, Vexryzer uses deterministic guided recovery and preserves the user's canonical/session state. It never switches to another LLM.

## Execution objective

Transform the completed S001 Infinite Canvas into the central agent-led ASK AI experience for accounting firms. The agent persistently coordinates the Canvas rather than treating it as a passive chat illustration.

The Seller chooses the strongest truthful next move from current canonical evidence plus visual state. A move may ask, challenge, calculate, compare, focus, reveal, annotate, restructure a process representation, stage an artifact, demonstrate, handle an objection or deliberately leave the Canvas unchanged.

The system must not reconstruct a fixed sales funnel inside state machines, validators, scene enums, prompts, routing or Critic policy.

## Persuasion objective

ASK AI must be highly persuasive and accounting-native. It should convert supported manual effort, volume, rework, waiting, closing pressure and capacity consumption into concrete operational/economic visibility.

Material arithmetic remains deterministic and provenance-bound. The model may use verified results rhetorically but may not invent ROI, savings, payback, labor cost, percentages, feasibility, urgency or accounting consequences.

## Infinite Canvas agent contract

The agent may emit bounded semantic UI intents. Application code validates and projects them.

Allowed semantics include focus, reveal, compare, annotate, quantify, group, de-emphasize, process mutation, relationship explanation, scene composition and artifact staging.

Arbitrary executable JavaScript, CSS, HTML, React, unrestricted DOM selectors, unrestricted coordinates and arbitrary imports remain forbidden.

Current visual state must feed the next agent turn. User interaction takes priority over non-essential automatic choreography.

## Canonical truth and Harness memory

DeepSeek Harness session state is operational agent memory, not canonical business truth.

Canonical Vexryzer context remains authoritative for facts, provenance, corrections, verified calculations, uncertainty and commercial state. On divergence, canonical state wins.

## Mandatory DeepSeek and Harness gate

No compatibility or quality PASS is inferred from documentation, a prior Harness version or a different provider/model tuple.

Before activation, Engineering must prove on the exact Founder account and exact candidate:
- access through `DEEPSEEK_API_KEY` without exposing the value;
- exact model `deepseek-v4-pro`;
- streaming;
- structured tool calling;
- multi-tool and multi-turn continuation;
- correct tool-result replay;
- durable session identity;
- process restart/session recovery;
- timeout/cancellation/error mapping;
- bounded diagnostics and no secret leakage;
- context/token behavior;
- accounting-native Seller quality;
- persuasive use of deterministic calculations;
- semantic Canvas tool execution;
- deterministic recovery on route failure.

The old restart/session failure from an older DeepSeek Harness release remains historical evidence. It is not silently waived and must be re-tested against the pinned current target.

## Credential and cost boundary

The sole LLM credential name is `DEEPSEEK_API_KEY` and it is server-only.

Founder-authorized prepaid DeepSeek API balance is allowed. Automatic recharge, automatic upgrade, uncontrolled spend and alternate-provider paid fallback are forbidden.

Non-AI infrastructure remains free-tier-first where separately contracted.

## Attachment boundary

The model does not receive customer attachment contents. S002 does not authorize file bytes, OCR output, extracted document text, attachment embeddings, screenshot-derived attachment content or attachment summaries to be sent to DeepSeek.

Future document submission remains a human delivery/request workflow under later Slice authority.

## Non-regression

S002 preserves S001 Canvas behavior, accessibility, mobile support and performance requirements; deterministic arithmetic; canonical provenance; correction invalidation; idempotency; security; Critic hard blocks; attachment isolation and GAUNTLET strength.

## Slice boundary

S002 does not authorize S003 pricing implementation, real evidence uploads, durable request sealing, notification delivery, payment, account/portal functionality, unrestricted visitor code execution or LLM ingestion of customer attachments.
