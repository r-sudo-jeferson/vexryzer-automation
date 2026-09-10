# VXA-S002 Authorization

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
gauntlet_id: `GNT-VXA-S002-001`
product_amendment_id: `VXA-PC-A001`
architecture_amendment_id: `VXA-ARCH-A001`
provider_architecture_amendment_id: `VXA-ARCH-A002`
status: `AUTHORIZED / IN_PROGRESS`
authorized_at: `2026-09-10`
authority: `FOUNDER_EXPLICIT_DIRECTIVE`
planning_branch: `plan/vxa-s002-ask-ai-adaptive-experience`

## Authorization decision

The Founder approved the hybrid ASK AI direction, instructed Engineering to preserve the plan, and then explicitly directed Engineering to continue immediately after the coherent S002 authority package was presented as awaiting Founder authorization.

Engineering reverified repository `main` before materialization and confirmed the exact authorized base remains:

`6244a246d8faf73e772fc944a398a71a02fb97e0`

This authorizes implementation of `VXA-S002@1.0.0` only, governed by `GNT-VXA-S002-001`, with `VXA-PC-A001` and `VXA-ARCH-A001` active for this Slice.

On `2026-09-10`, the Founder additionally authorized `VXA-ARCH-A002`, replacing the active Mistral-primary assumption with a multi-provider Free Tier strategy that requires no registered payment method and preserves fixed cost `R$ 0`.

## Authorized authority set

- `job/docs/product/VXA-001-product-contract-amendment-001.md`;
- `job/docs/architecture/VXA-001-architecture-amendment-001.md`;
- `job/docs/architecture/VXA-001-architecture-amendment-002.md`;
- `job/docs/slices/VXA-S002-contract.md`;
- `job/docs/authorizations/VXA-S002-PROVIDER-STRATEGY-AUTHORIZATION.md`;
- `job/docs/gauntlets/GNT-VXA-S002-001.md`;
- `job/docs/superpowers/specs/2026-09-10-ask-ai-adaptive-experience-design.md`;
- `job/docs/superpowers/specs/2026-09-10-vxa-s002-multiprovider-free-tier-design.md`;
- `job/docs/superpowers/plans/2026-09-10-vxa-ask-ai-adaptive-experience-plan.md`;
- `job/docs/superpowers/plans/2026-09-10-vxa-s002-multiprovider-free-tier-plan.md`;
- `job/docs/superpowers/specs/2026-09-10-vxa-critic-adversarial-planning-review.md`.

The materialized Product, Architecture, Slice and GAUNTLET documents remain binding. The later provider authorization supersedes only older provider-specific language that conflicts with `VXA-ARCH-A002`; all stronger security, quality, persuasion, accessibility, performance, privacy, Workshop and non-regression guarantees remain active.

## Active provider authority

The authorized provider hierarchy is now:

1. Cloudflare Workers AI as the primary provider family;
2. Groq as independent external fallback;
3. OpenRouter only as optional emergency fallback after exact no-payment and compatibility verification;
4. Mistral in standby, preserving all historical evidence but excluded from the active route.

No active route may require payment method registration, Workers Paid, Groq Developer, paid OpenRouter credits, prepaid wallets, overage or automatic billing. If a provider changes policy and begins requiring payment, the route becomes ineligible until Founder authority changes.

Authorized compatibility candidates are defined by `VXA-ARCH-A002`; candidate listing is not a compatibility PASS.

## Mandatory first technical gate after VXA-ARCH-A002

The provider gate is now provider-neutral and role-aware.

Before activation, each candidate must prove authenticated access without payment registration plus the protocol/quality behavior required by its role. Seller candidates must pass persuasion-quality evaluation in addition to streaming/tool/schema/context behavior. Workshop candidates used through DeepSeek Harness must still prove the existing six Harness properties on an exact pinned tuple.

The prior Mistral diagnostics remain valid historical evidence. They do not need to be re-run unchanged and no failing Mistral result is converted into PASS.

## Preserved Mistral evidence

Run `34466683049` on SHA `835ba25446051ce597b27eae29ac18ea2538c16a` established:

- Workshop pure contracts `38/38 PASS`;
- streaming PASS;
- canonical tool round-trip PASS;
- structured arguments PASS;
- timeout mapping PASS;
- second-turn tool result contains nonce PASS;
- persisted session marker before restart PASS;
- persisted session marker after restart PASS;
- second assistant response nonce recall FAIL;
- restarted assistant response nonce recall FAIL.

The narrow conclusion is that persistence and canonical tool-result transport retained the marker while semantic replay/recall failed for the tested `ministral-14b-2512` tuple. This is not evidence of session-file loss.

## Product-role clarification

ASK AI is the persuasive discovery/sales intelligence surface. Customer attachment contents are not sent to LLM providers. The eventual documents belong to the human request/fulfillment path and remain under later Slice authority.

Provider-neutral canonical context belongs to Vexryzer state. Provider session memory, prompt caching and Harness persistence are never the authoritative conversation record.

## Preserved unknowns

- `NOT_VERIFIED`: exact Cloudflare account access and behavior for each authorized candidate without payment registration.
- `NOT_VERIFIED`: exact Groq account access and behavior for the fallback candidate without payment registration.
- `NOT_VERIFIED`: OpenRouter emergency route unless the Founder separately configures it.
- `NOT_VERIFIED`: zero-fixed-cost production placement of a persistent live visitor Workshop with adequate process/filesystem/network isolation.
- `NOT_VERIFIED`: production deployment until an actual authorized deployment environment exists and is verified.

These unknowns do not weaken S002. The customer-facing fast path must remain functional, truthful and high quality without the live Workshop.

## Non-negotiable boundaries

Authorization does not permit S003 or later roadmap implementation, arbitrary same-origin model-generated JavaScript, visitor access to the Vexryzer repository, production/customer secret exposure, unrestricted child-process environment inheritance, arbitrary package/network access, fake progress, unsupported feasibility claims, Critic bypass, weakening of S001 invariants, moving pricing/upload/persistence/sealing authority into the LLM, sending customer attachment contents to LLM providers, or introducing a paid fallback.

## Execution state

S002 remains `IN_PROGRESS`. `PASS`, `PROMOTED`, and `COMPLETE` remain unavailable until their respective exact-candidate, provider-quality, GAUNTLET and integration evidence exists.
