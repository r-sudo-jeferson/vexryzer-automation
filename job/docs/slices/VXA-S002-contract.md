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
architecture_amendment: `job/docs/architecture/VXA-001-architecture-amendment-001.md`
provider_architecture_amendment: `job/docs/architecture/VXA-001-architecture-amendment-002.md`
provider_strategy_authorization: `job/docs/authorizations/VXA-S002-PROVIDER-STRATEGY-AUTHORIZATION.md`
design_spec: `job/docs/superpowers/specs/2026-09-10-ask-ai-adaptive-experience-design.md`
provider_design_amendment: `job/docs/superpowers/specs/2026-09-10-vxa-s002-multiprovider-free-tier-design.md`
implementation_plan: `job/docs/superpowers/plans/2026-09-10-vxa-ask-ai-adaptive-experience-plan.md`
provider_implementation_plan: `job/docs/superpowers/plans/2026-09-10-vxa-s002-multiprovider-free-tier-plan.md`
source_proposal_path: `job/docs/slices/VXA-S002-contract.PROPOSED.md`
source_proposal_blob_sha: `9b57331f1202897521a68a62e92e32c8997afd28`

## Authorization state

This Slice became authorized by Founder explicit continuation after the complete proposed authority package was presented for approval. The exact base SHA was reverified before materialization.

On `2026-09-10`, after provider diagnostics and architecture review, the Founder explicitly authorized `VXA-ARCH-A002`: a multi-provider Free Tier strategy with Cloudflare Workers AI as primary provider family, Groq as independent external fallback, OpenRouter optional emergency-only, Mistral standby, fixed cost `R$ 0`, and no registered payment method required for any active route.

The provider amendment changes no Slice id/version and does not reset prior evidence. It supersedes only conflicting provider-specific assumptions.

## Normative incorporation

The complete UTF-8 proposal identified by blob SHA `9b57331f1202897521a68a62e92e32c8997afd28` remains incorporated into this contract in its entirety. All objective, observable-result, ASK AI, agentic reasoning, VXA Critic, Infinite Canvas, provenance, solution framing, strict generative UI, DeepSeek Harness Workshop, prototype, recovery, observability, exclusion, performance, accessibility, security, scenario, invariant and acceptance-criteria sections remain authoritative except where an older provider-specific assumption is explicitly superseded by `VXA-ARCH-A002` and its Founder authorization.

For authority resolution:

- `proposed_slice_version: 1.0.0` remains `slice_version: 1.0.0`;
- `status: PROPOSED / NOT_AUTHORIZED` remains superseded by the authorized/in-progress state;
- `planning_base_sha` remains the exact `base_sha` above;
- `proposed_gauntlet_id` remains `gauntlet_id`;
- proposed Product/Architecture amendment paths resolve to the authorized materialized documents listed above;
- language stating that the proposal does not authorize implementation remains superseded by `job/docs/authorizations/VXA-S002-AUTHORIZATION.md`;
- language that fixes Mistral as the active primary provider is superseded by `job/docs/authorizations/VXA-S002-PROVIDER-STRATEGY-AUTHORIZATION.md` and `VXA-ARCH-A002`.

No substantive condition, acceptance criterion, security boundary, performance target, accessibility requirement, Workshop constraint, persuasion-quality requirement or non-regression rule is removed or weakened.

## Execution objective

Transform the completed S001 Infinite Canvas into the central adaptive ASK AI discovery experience. The customer should see their operation become visibly understood, structured and commercially framed while the UI responds causally to validated intelligence. The experience may classify automation, micro-SaaS, BI, AI/agentic, prerequisite process/data improvement, training, hybrid and no-software-fit opportunities.

ASK AI is the persuasive Seller. It must preserve provider-neutral canonical context, conduct high-information discovery, handle objections truthfully and drive typed generative-UI scenes. Customer attachment contents are not model inputs.

Cloudflare Workers AI is the primary provider family. Groq is the independent external fallback. OpenRouter is optional emergency-only after separate no-payment and compatibility verification. Mistral is standby. The application must retain a deterministic guided recovery path when no LLM route is available.

DeepSeek Harness remains the preferred development harness for controlled high-value prototype creation, subject to mandatory compatibility proof for any provider/model tuple used through it. It is never allowed to become a blocking dependency for normal ASK AI discovery or the source of authoritative conversation memory.

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
- Seller persuasion-quality PASS for any model used as primary/fallback Seller.

Any model used through DeepSeek Harness Workshop must additionally prove the six existing Harness properties: streaming/events, tool calls, structured arguments, multi-turn tool-result replay, timeout/error mapping and restart/session behavior.

Historical Mistral evidence remains preserved and does not need to be repeated unchanged.

## Fixed-cost and provider boundary

The active architecture must remain fixed-cost `R$ 0` at the intended initial volume. A provider/model route becomes ineligible if it requires a payment method, paid subscription, prepaid credits, billing activation, automatic overage or paid failover.

No code may automatically upgrade service, purchase capacity or switch to a paid route. When free capacity is exhausted, the system falls back to another verified free route or deterministic guided discovery.

## Attachment boundary

The model does not receive customer attachment contents. S002 does not authorize file bytes, OCR output, extracted document text, attachment embeddings, screenshot-derived attachment content or attachment summaries to be sent to Cloudflare, Groq, OpenRouter, Mistral or any other LLM provider.

Future document submission remains a human delivery/request workflow under later Slice authority.

## Slice boundary

S002 does not authorize S003 pricing implementation, real evidence uploads, durable request sealing, notification delivery, payment, account/portal functionality, arbitrary same-origin generated JavaScript, unrestricted visitor code execution, LLM ingestion of customer attachments, or production hosting that violates the fixed-cost R$0 rule.
