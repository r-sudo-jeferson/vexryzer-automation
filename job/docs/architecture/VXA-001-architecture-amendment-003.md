# VXA-001 Architecture Amendment 003 — Agent-Led Experience + Deterministic Trust Kernel

amendment_id: `VXA-ARCH-A003`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
parent_architecture: `job/docs/architecture/VXA-001-architecture.md`
parent_amendment: `VXA-ARCH-A002`
status: `AUTHORIZED`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
authorized_at: `2026-09-10`
authority: `FOUNDER_EXPLICIT_DIRECTIVE`
approved_design: `job/docs/superpowers/specs/2026-09-10-vxa-s002-agent-led-accounting-seller-design.md`
approved_design_commit: `a98432c75ba7bf94c11e04bf591ab50f27392307`

## 1. Architectural decision

S002 uses an `Agent-Led Experience + Deterministic Trust Kernel` architecture.

The AI Seller owns strategy and improvisation. Deterministic application code owns only boundaries whose correctness cannot depend on model discretion: canonical truth/provenance, arithmetic, revisions/idempotency, security, permissions, provider eligibility, executable boundaries, publication gates, accessibility invariants, cancellation/cleanup and later-Slice commercial authority.

The system must not recreate a fixed sales flow inside XState, validators, scene enums, Critic policy, prompt packaging or capability routing.

## 2. Strongest truthful next move

The Seller is asked to choose the strongest truthful next move for the current accounting-office evidence. The runtime does not require that move to be a question.

A move may combine semantic actions, narration, quantitative opportunities, capability hypotheses and artifact intent. The application validates whether the proposed effects are safe and evidence-compatible; it does not prescribe the creative sales idea.

Lifecycle state remains deterministic where necessary for requesting, streaming, validation, Critic review, cancellation, stale-response rejection, Workshop execution and recovery. Lifecycle state is not a sales funnel.

## 3. Canonical truth, not canonical reasoning

Provider-neutral canonical context stores durable evidence needed to reconstruct a request after provider change or process restart. It retains facts, provenance, correction/supersession history, objections, quantitative observations, verified calculations, uncertainties, previously surfaced opportunities/artifacts and visual continuity references.

It must not store a mandatory single preferred solution kind that forces later reasoning to conform to an earlier classification. Opportunity/capability records are historical/evidential context, not a thought prison.

Provider conversation ids, provider memory, prompt caches and Workshop sessions are non-authoritative implementation details.

## 4. Quantitative Trust Kernel

Material numeric claims pass through deterministic calculation code.

The model may identify a calculation opportunity and select the rhetorical use of the result. It may not supply an authoritative result value when the application can derive it from canonical inputs.

Each verified calculation records input observation ids, result, unit, computation authority and the canonical revision on which it was based. Corrections invalidate calculations that depend on superseded/conflicted observations before they can be reused.

Unsupported ROI, savings, payback, productivity gains, labor cost, error reduction, revenue increase or tax/accounting exposure remain unverified claims and cannot be promoted to `VerifiedCalculation` without authorized inputs and calculation semantics.

## 5. Semantic experience boundary

The Seller may emit broad semantic intent but not arbitrary executable UI.

`AgentIntent` may coordinate multiple application-owned semantic actions. `ExperienceProposal` binds those actions to an exact `baseRevision`. `ArtifactIntent` describes a desired demonstration such as an operational object, import preview, presentation, BI dashboard, training module, workflow concept or prototype.

Application-owned validation rejects stale revisions, unknown action/component kinds, raw executable code, arbitrary module imports, raw viewport coordinates, unbounded content, duplicate identities and forbidden external executable URLs.

The safe semantic action/component vocabulary may evolve without requiring a new deterministic sales state for every novel idea.

## 6. Reactive Canvas and artifacts

Accepted agent strategy drives the visual transaction. The Canvas may focus, compare, annotate, quantify, group, de-emphasize, reveal or stage artifacts based on the current proposal.

No graph/layout/camera work occurs merely because another token streamed. Equivalent repeated visual intents are deduplicated. User typing, focus, pan and explicit navigation outrank non-essential automatic choreography.

A turn with no visual change is valid when changing the Canvas would not increase clarity or conviction.

## 7. Critic architecture

The Critic is independent from the proposal generator when required by risk, but it is a truth/quality gate rather than a funnel enforcer.

Deterministic hard blocks run before model Critic for provenance forgery, unsupported numeric authority, price/discount authority, feasibility truth, attachment-read claims, tool escalation and executable/publication boundary violations.

The Critic may `PASS`, `REVISE` or `BLOCK` based on factual support, quantitative honesty, relevance, manipulation risk, latest user intent, uncertainty, visual coherence, accessibility and execution safety. It may not reject a proposal solely because it is novel, combines capabilities or skips an expected question.

## 8. Provider and Workshop continuity

`VXA-ARCH-A002` remains active for multi-provider routing. Cloudflare Workers AI remains the primary provider family, Groq remains the independent fallback, OpenRouter remains optional emergency-only and Mistral remains standby, subject to exact role-quality evidence.

The selected Workshop harness for the currently proven tuple is OpenCode `1.18.30` + Groq `openai/gpt-oss-120b`, based on run `34483101166` at exact evidence SHA `e8f627947dd0223dbf7237aa64d54687aab86c72`. DeepSeek Harness evidence is retained historically; its failed restart/session gate is not erased.

Workshop remains optional, isolated and non-authoritative. Generated executable artifacts are untrusted until the full publication boundary is verified.

## 9. Non-regression and scope

This amendment preserves the S001 Canvas, accessibility/mobile/performance guarantees; S002 attachment boundary; R$0/no-payment provider policy; server-only secrets; deterministic recovery; existing GAUNTLET; and all stricter security/truth requirements.

It does not authorize S003 pricing, durable request sealing, real uploads, notification delivery, payment, unrestricted visitor execution or arbitrary same-origin generated JavaScript.
