# VXA-001 Architecture Amendment 004 — DeepSeek Single Truth Agent Runtime

amendment_id: `VXA-ARCH-A004`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
parent_architecture: `job/docs/architecture/VXA-001-architecture.md`
parent_amendment: `VXA-ARCH-A003`
status: `AUTHORIZED / IMPLEMENTATION_IN_PROGRESS`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0a`
authorized_at: `2026-09-11`
authority: `FOUNDER_EXPLICIT_DIRECTIVE`
model_provider: `DeepSeek`
model_id: `deepseek-v4-pro`
harness: `DeepSeek Harness`
harness_target_version: `0.1.5-rc.1`
credential_env: `DEEPSEEK_API_KEY`

## 1. Decision

VXA-S002 has exactly one active generative model truth: DeepSeek `deepseek-v4-pro`. The sole authorized agent harness is DeepSeek Harness. No second LLM provider, model family, model alias, agent harness, compatibility route, emergency LLM, standby LLM or silent fallback may exist in active product configuration, runtime selection, tests, deployment configuration or current normative documentation.

Historical evidence for prior experiments remains recoverable from Git history only. Historical success or failure does not keep an alternative route alive in the current tree.

If DeepSeek is unavailable, rate limited, out of prepaid balance, misconfigured or fails an exact compatibility gate, Vexryzer must fail closed into deterministic guided recovery. It must never switch to another LLM.

## 2. Exact model truth

The production target is the exact API model id `deepseek-v4-pro` using the DeepSeek API endpoint `https://api.deepseek.com`.

Legacy aliases and sibling models are not authorized. In particular, no legacy chat/reasoner alias or Flash variant may be introduced as an implicit substitute for V4 Pro.

Thinking mode may vary by request complexity while remaining on the same exact model. Reasoning effort may use `low`, `high` or `max` according to a deterministic application-owned policy. Provider-returned hidden reasoning is never application truth.

## 3. Harness truth

DeepSeek Harness becomes the required agentic runtime for the live Seller/Canvas coordination path after the exact target tuple passes the required compatibility and safety gates.

The prior DeepSeek Harness result was produced on an older release candidate and remains historical evidence. It does not authorize a competing harness. The current target `0.1.5-rc.1` must be reverified rather than assuming that either the old failure or the new release implies compatibility.

Until that gate passes, the production runtime remains fail-closed. Engineering may not activate another harness to avoid the gate.

## 4. Agent lives in the Infinite Canvas

The Infinite Canvas is the persistent operational surface of the commercial agent, not a passive illustration of chat.

For every accepted turn, the agent reasons over canonical business evidence plus the current visual world state and may emit bounded semantic intents that cause application-owned Canvas behavior. The agent may focus, compare, annotate, quantify, reveal, group, de-emphasize, mutate process structure, explain relationships, stage artifacts, request demonstrations and compose visual scenes.

The agent may not emit arbitrary executable JavaScript, CSS, HTML, React, DOM selectors, unrestricted coordinates, arbitrary module imports or browser code. Semantic intents are validated and projected by Vexryzer-owned code.

User pan, zoom, focus, typing, navigation and explicit user actions outrank non-essential automatic choreography.

## 5. Deterministic Trust Kernel remains authoritative

DeepSeek and the Harness own strategy, language, tool selection, persuasion, improvisation and visual intent. They do not own truth.

Application code remains authoritative for:
- canonical facts and provenance;
- corrections and supersession;
- arithmetic and verified calculations;
- idempotency, revisions, leases and concurrency;
- authorization and security;
- schema validation and semantic UI boundaries;
- persistence;
- attachment isolation;
- price/discount authority;
- timeout/cancellation;
- cost limits and prepaid-balance policy;
- safe failure/recovery.

A Harness session is operational agent memory. It is never canonical business truth. Canonical Vexryzer state wins on divergence.

## 6. Persuasion standard

The Seller must be exceptionally persuasive while remaining evidence-bound. It should actively surface operational cost, capacity consumption, recurring burden, rework, waiting, closing pressure and the cost of inertia when canonical inputs permit deterministic calculation.

The preferred commercial arc is not a scripted funnel. The agent chooses the strongest truthful next move and may combine language, calculations and Canvas manipulation to increase clarity and conviction.

Forbidden persuasion remains: invented ROI, fabricated savings, fake urgency, fake scarcity, unsupported feasibility, invented accounting/tax consequences, hidden material uncertainty, fake testimonials, model-authored discounts and pressure after explicit refusal.

## 7. Credential and billing boundary

The sole LLM credential name is `DEEPSEEK_API_KEY`.

The credential is server-only. It must never enter source, Git history, browser bundles, Vite variables, client-visible configuration, logs, screenshots, artifacts or diagnostic payloads.

Founder-authorized prepaid DeepSeek balance is permitted. Automatic recharge, automatic paid upgrade, uncontrolled spend and provider failover are forbidden. Usage and estimated cost must be observable and bounded.

## 8. Exact activation gate

Before the agent runtime is considered active, the exact `DeepSeek Harness 0.1.5-rc.1 + deepseek-v4-pro + Founder account` tuple must prove:
- authenticated access using only `DEEPSEEK_API_KEY`;
- streamed agent events;
- real tool calls with validated structured arguments;
- multiple tool rounds;
- tool-result replay;
- multi-turn continuation;
- durable session identity;
- process restart and session recovery;
- no replay-based corruption of canonical state;
- timeout and cancellation mapping;
- bounded error diagnostics with no secret leakage;
- context and token accounting;
- Seller quality for accounting-native persuasion;
- semantic Canvas tool execution through the Vexryzer validation layer;
- deterministic recovery when the exact route is unavailable.

No requirement may be weakened to obtain PASS.

## 9. Revocations

This amendment revokes the active authority of every prior multi-provider strategy, prior alternative harness selection and every current-tree artifact whose purpose is to keep another provider/model/harness eligible.

Those artifacts must be deleted or rewritten as part of this amendment's implementation. Git history is the archive.

## 10. Non-regression

This amendment preserves VXA-S001 Infinite Canvas behavior, accessibility, mobile behavior, performance requirements, S002 attachment isolation, deterministic arithmetic, canonical provenance, correction semantics, Critic hard blocks, security, idempotency and the existing GAUNTLET. It strengthens provider/harness determinism and does not authorize later-Slice pricing, payment, durable request sealing, unrestricted generated code or customer attachment ingestion.
