# VXA-S002 Slice Contract

slice_id: `VXA-S002`
slice_version: `1.0.0`
initiative_id: `VXA-001`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
status: `AUTHORIZED / IN_PROGRESS`
predecessors: `VXA-S001@1.0.0`
repository: `r-sudo-jeferson/vexryzer-automation`
product_root: `job`
base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
gauntlet_id: `GNT-VXA-S002-001`
product_amendment: `job/docs/product/VXA-001-product-contract-amendment-001.md`
agent_led_product_amendment: `job/docs/product/VXA-001-product-contract-amendment-002.md`
architecture_amendment: `job/docs/architecture/VXA-001-architecture-amendment-001.md`
provider_architecture_amendment: `job/docs/architecture/VXA-001-architecture-amendment-002.md`
agent_led_architecture_amendment: `job/docs/architecture/VXA-001-architecture-amendment-003.md`
provider_strategy_authorization: `job/docs/authorizations/VXA-S002-PROVIDER-STRATEGY-AUTHORIZATION.md`
agent_led_authorization: `job/docs/authorizations/VXA-S002-AGENT-LED-ACCOUNTING-SELLER-AUTHORIZATION.md`
design_spec: `job/docs/superpowers/specs/2026-09-10-ask-ai-adaptive-experience-design.md`
provider_design_amendment: `job/docs/superpowers/specs/2026-09-10-vxa-s002-multiprovider-free-tier-design.md`
agent_led_design_amendment: `job/docs/superpowers/specs/2026-09-10-vxa-s002-agent-led-accounting-seller-design.md`
implementation_plan: `job/docs/superpowers/plans/2026-09-10-vxa-ask-ai-adaptive-experience-plan.md`
provider_implementation_plan: `job/docs/superpowers/plans/2026-09-10-vxa-s002-multiprovider-free-tier-plan.md`
agent_led_implementation_plan: `job/docs/superpowers/plans/2026-09-10-vxa-s002-agent-led-accounting-seller-plan.md`
source_proposal_path: `job/docs/slices/VXA-S002-contract.PROPOSED.md`
source_proposal_blob_sha: `9b57331f1202897521a68a62e92e32c8997afd28`

## Authorization state

This Slice became authorized by Founder explicit continuation after the complete proposed authority package was presented for approval. The exact base SHA was reverified before materialization.

On `2026-09-10`, after provider diagnostics and architecture review, the Founder explicitly authorized `VXA-ARCH-A002`: a multi-provider Free Tier strategy with Cloudflare Workers AI as primary provider family, Groq as independent external fallback, OpenRouter optional emergency-only, Mistral standby, fixed cost `R$ 0`, and no registered payment method required for any active route.

On `2026-09-10`, the Founder then explicitly approved the Agent-Led Accounting Seller design and directed Engineering to execute it. `VXA-PC-A002`, `VXA-ARCH-A003` and `VXA-S002-AGENT-LED-ACCOUNTING-SELLER-AUTHORIZATION.md` therefore strengthen the same Slice without changing its id, version, base SHA or GAUNTLET.

These amendments do not reset prior exact-tuple evidence. They supersede only conflicting provider assumptions or product/orchestration assumptions that would force a deterministic sales funnel.

## Normative incorporation

The complete UTF-8 proposal identified by blob SHA `9b57331f1202897521a68a62e92e32c8997afd28` remains incorporated into this contract in its entirety. All objective, observable-result, ASK AI, agentic reasoning, VXA Critic, Infinite Canvas, provenance, solution framing, strict generative UI, Workshop, prototype, recovery, observability, exclusion, performance, accessibility, security, scenario, invariant and acceptance-criteria sections remain authoritative except where a newer authorized amendment explicitly strengthens or supersedes a narrower assumption.

For authority resolution:

- `proposed_slice_version: 1.0.0` remains `slice_version: 1.0.0`;
- `status: PROPOSED / NOT_AUTHORIZED` remains superseded by the authorized/in-progress state;
- `planning_base_sha` remains the exact `base_sha` above;
- `proposed_gauntlet_id` remains `gauntlet_id`;
- proposed Product/Architecture amendment paths resolve to the authorized materialized documents listed above;
- language stating that the proposal does not authorize implementation remains superseded by `job/docs/authorizations/VXA-S002-AUTHORIZATION.md`;
- language that fixes Mistral as the active primary provider is superseded by `job/docs/authorizations/VXA-S002-PROVIDER-STRATEGY-AUTHORIZATION.md` and `VXA-ARCH-A002`;
- language that implies a required single solution classifier, next-question-centric funnel or fixed scene progression is superseded by `VXA-PC-A002`, `VXA-ARCH-A003` and the Founder-approved agent-led design;
- DeepSeek Harness preference does not override exact compatibility evidence: the currently selected proven Workshop tuple is OpenCode `1.18.30` + Groq `openai/gpt-oss-120b` as recorded in `job/docs/handoffs/VXA-S002-HARNESS-SELECTION-NOTE.md`.

No substantive security boundary, performance target, accessibility requirement, Workshop isolation constraint, quantitative-truth requirement or non-regression rule is removed or weakened.

## Execution objective

Transform the completed S001 Infinite Canvas into the central agent-led ASK AI experience for accounting firms. The visitor should see their operation become visibly understood, economically quantified and commercially reframed while the UI reacts causally to accepted intelligence.

The Seller must optimize for the strongest truthful next move rather than completion of a predetermined discovery flow. It may ask a question, challenge a premise, expose an insight, request deterministic arithmetic, combine capabilities, change the visual composition, stage an artifact, handle an objection, request an optional Workshop demonstration or deliberately make no visual change when that is stronger.

Operational/digital artifacts, data import/transform, presentations, BI/decision intelligence, training/enablement, automation/integration, internal tools, AI/agentic systems and process/data improvement are composable capabilities, not a mutually exclusive classifier that constrains reasoning. A no-new-software disposition remains valid.

ASK AI is expected to be highly persuasive and accounting-native. When canonical evidence permits, it should turn manual effort, volume, rework, waiting, deadline pressure and capacity consumption into concrete numbers. Material arithmetic is computed deterministically from provenance-bound inputs; the model may use the verified result rhetorically but may not invent ROI, savings, labor cost, payback, unsupported percentages or feasibility.

Customer attachment contents are not model inputs.

Cloudflare Workers AI is the primary provider family. Groq is the independent external fallback. OpenRouter is optional emergency-only after separate no-payment and compatibility verification. Mistral is standby. The application must retain deterministic guided recovery when no LLM route is available.

The currently selected proven Workshop harness tuple is OpenCode `1.18.30` + Groq `openai/gpt-oss-120b`, based on run `34483101166` at exact evidence SHA `e8f627947dd0223dbf7237aa64d54687aab86c72`. This Workshop remains optional, isolated, non-authoritative and cannot block normal ASK AI discovery.

## Mandatory provider and quality gate

No active provider/model route may be treated as compatible merely because documentation lists the model or provider.

Before an active route is accepted, Engineering must prove on the exact account/route/model:

- usable access without registering a payment method or enabling billing;
- required streaming behavior;
- required tool/function calling and structured arguments for the role;
- multi-turn continuation using Vexryzer canonical context;
- bounded timeout/cancel/error mapping;
- no secret leakage;
- tested context/rate behavior;
- Seller persuasion-quality PASS for any model used as primary/fallback Seller;
- accounting-native language quality and quantitative reasoning opportunity detection for Seller roles;
- improvisational quality sufficient to avoid reconstructing a fixed question funnel.

Any model used through a Workshop harness must additionally prove the required agent properties for its exact harness/provider/model tuple, including streaming/events, real tool use, structured arguments, multi-turn tool-result replay, timeout/error mapping and restart/session behavior.

Historical Mistral and DeepSeek evidence remains preserved and does not need to be repeated unchanged unless a material hypothesis or exact tuple changes.

## Fixed-cost and provider boundary

The active architecture must remain fixed-cost `R$ 0` at the intended initial volume. A provider/model route becomes ineligible if it requires a payment method, paid subscription, prepaid credits, billing activation, automatic overage or paid failover.

No code may automatically upgrade service, purchase capacity or switch to a paid route. When free capacity is exhausted, the system falls back to another verified free route or deterministic guided discovery.

## Attachment boundary

The model does not receive customer attachment contents. S002 does not authorize file bytes, OCR output, extracted document text, attachment embeddings, screenshot-derived attachment content or attachment summaries to be sent to Cloudflare, Groq, OpenRouter, Mistral or any other LLM provider.

Future document submission remains a human delivery/request workflow under later Slice authority.

## Slice boundary

S002 does not authorize S003 pricing implementation, real evidence uploads, durable request sealing, notification delivery, payment, account/portal functionality, arbitrary same-origin generated JavaScript, unrestricted visitor code execution, LLM ingestion of customer attachments, or production hosting that violates the fixed-cost R$0 rule.
