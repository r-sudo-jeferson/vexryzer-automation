# VXA-001 Architecture Amendment 003 — Agent-Led Experience + Deterministic Trust Kernel

amendment_id: `VXA-ARCH-A003`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
parent_architecture: `job/docs/architecture/VXA-001-architecture.md`
status: `AUTHORIZED`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0a`
authorized_at: `2026-09-10`
authority: `FOUNDER_EXPLICIT_DIRECTIVE`
approved_design: `job/docs/superpowers/specs/2026-09-10-vxa-s002-agent-led-accounting-seller-design.md`
provider_successor: `job/docs/architecture/VXA-001-architecture-amendment-004.md`

## 1. Architectural decision

S002 uses an `Agent-Led Experience + Deterministic Trust Kernel` architecture.

The AI Seller owns strategy and improvisation. Deterministic application code owns boundaries whose correctness cannot depend on model discretion: canonical truth/provenance, arithmetic, revisions/idempotency, security, permissions, executable boundaries, accessibility invariants, cancellation/cleanup and later-Slice commercial authority.

The system must not recreate a fixed sales flow inside XState, validators, scene enums, Critic policy, prompt packaging or capability routing.

## 2. Strongest truthful next move

The Seller chooses the strongest truthful next move for the current accounting-office evidence. The runtime does not require that move to be a question.

A move may combine semantic actions, narration, quantitative opportunities, capability hypotheses and artifact intent. The application validates whether proposed effects are safe and evidence-compatible; it does not prescribe the creative sales idea.

Lifecycle state remains deterministic where necessary for requesting, streaming, validation, Critic review, cancellation, stale-response rejection and recovery. Lifecycle state is not a sales funnel.

## 3. Canonical truth, not canonical reasoning

Model-independent canonical context stores durable evidence needed to reconstruct a request after process restart. It retains facts, provenance, correction/supersession history, objections, quantitative observations, verified calculations, uncertainties, surfaced opportunities/artifacts and visual continuity references.

It must not store a mandatory single preferred solution kind that forces later reasoning to conform to an earlier classification.

Model conversation state, prompt caches and Harness session memory are non-authoritative implementation details. Canonical Vexryzer state wins on divergence.

## 4. Quantitative Trust Kernel

Material numeric claims pass through deterministic calculation code.

The model may identify a calculation opportunity and select the rhetorical use of the result. It may not supply an authoritative result value when the application can derive it from canonical inputs.

Each verified calculation records input observation ids, result, unit, computation authority and the canonical revision on which it was based. Corrections invalidate calculations that depend on superseded/conflicted observations before reuse.

Unsupported ROI, savings, payback, productivity gains, labor cost, error reduction, revenue increase or tax/accounting exposure remain unverified claims.

## 5. Semantic experience boundary

The Seller may emit broad semantic intent but not arbitrary executable UI.

`AgentIntent` may coordinate multiple application-owned semantic actions. `ExperienceProposal` binds those actions to an exact `baseRevision`. `ArtifactIntent` describes a desired demonstration.

Application-owned validation rejects stale revisions, unknown action/component kinds, raw executable code, arbitrary imports, unrestricted viewport control, unbounded content, duplicate identities and forbidden external executable URLs.

## 6. Reactive Canvas and artifacts

Accepted agent strategy drives the visual transaction. The Canvas may focus, compare, annotate, quantify, group, de-emphasize, reveal, mutate represented process structure or stage artifacts based on the current proposal.

No graph/layout/camera work occurs merely because another token streamed. Equivalent repeated visual intents are deduplicated. User typing, focus, pan and explicit navigation outrank non-essential automatic choreography.

A turn with no visual change is valid when changing the Canvas would not increase clarity or conviction.

## 7. Critic architecture

The Critic is a truth/quality gate rather than a funnel enforcer.

Deterministic hard blocks run before model Critic for provenance forgery, unsupported numeric authority, price/discount authority, feasibility truth, attachment-read claims, tool escalation and executable/publication violations.

The Critic may `PASS`, `REVISE` or `BLOCK` based on factual support, quantitative honesty, relevance, manipulation risk, latest user intent, uncertainty, visual coherence, accessibility and execution safety. It may not reject a proposal solely because it is novel, combines capabilities or skips an expected question.

## 8. AI runtime ownership

Provider/model/harness authority is owned by successor `VXA-ARCH-A004`.

A003 does not authorize any alternate route. Agent-led semantics remain unchanged regardless of model implementation, while A004 fixes the exact DeepSeek-only runtime truth.

## 9. Non-regression and scope

This amendment preserves the S001 Canvas, accessibility/mobile/performance guarantees, S002 attachment boundary, server-only secrets, deterministic recovery and all stricter security/truth requirements.

It does not authorize S003 pricing, durable request sealing, real uploads, notification delivery, payment, unrestricted visitor execution or arbitrary same-origin generated JavaScript.
