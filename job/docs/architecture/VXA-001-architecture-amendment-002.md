# VXA-001 Architecture Amendment 002 — Multi-Provider Free Tier Seller Intelligence

amendment_id: `VXA-ARCH-A002`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
parent_architecture: `job/docs/architecture/VXA-001-architecture.md`
parent_amendment: `VXA-ARCH-A001`
status: `AUTHORIZED`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
authorization_checkpoint_sha: `835ba25446051ce597b27eae29ac18ea2538c16a`
authorized_at: `2026-09-10`
authority: `FOUNDER_EXPLICIT_DIRECTIVE`

## 1. Scope of this amendment

This amendment supersedes only provider-specific assumptions in `VXA-ARCH-A001`, the S002 design and implementation plan where those documents describe Mistral as the active primary intelligence provider or Mistral compatibility as the only admissible first provider gate.

It does not reduce or replace the dual-plane architecture, closed generative-UI registry, deterministic state authority, Critic independence, Workshop isolation, performance/accessibility requirements, security boundaries, public-repository safety or the fixed-cost requirement.

Historical Mistral compatibility evidence remains valid evidence about the exact tuples that were tested. It is not deleted or rewritten to manufacture a different conclusion.

## 2. Architectural objective

The customer-facing intelligence must behave as a premium, persuasive operational seller rather than a generic chatbot. It must retain context across long discovery sessions, understand and progressively structure operational pain, handle objections truthfully, select the next high-information question, and adapt the Infinite Canvas through validated typed scene intents.

The intelligence layer must remain operational when one free provider is unavailable. Provider substitution must not reset conversation state, invent facts, change pricing authority, bypass Critic gates, or alter security constraints.

## 3. Active provider portfolio

Provider and model names below define authorized candidates. Every tuple is `NOT_VERIFIED` until credentialed evidence proves actual access and required behavior without registering a payment method.

### 3.1 Primary provider family — Cloudflare Workers AI

Authorized candidate roles:

- `@cf/zai-org/glm-4.7-flash`: default ASK AI Seller, Experience Orchestrator, Process Architect, Solution Strategist and fast-path Experience Composer when one model can safely co-locate those responsibilities;
- `@cf/google/gemma-4-26b-a4b-it`: VxaCritic / second-opinion candidate and optional code/UI review candidate;
- `@cf/openai/gpt-oss-120b`: high-reasoning and controlled Workshop code/UI generation candidate;
- `@cf/nvidia/nemotron-3-120b-a12b`: same-provider fallback-quality candidate when its live free access and exact capabilities are verified.

A Cloudflare model that requires Workers Paid, prepaid AI Gateway credits, billing activation or a payment method is ineligible while the R$0/no-payment constraint remains active.

### 3.2 Independent external fallback — Groq

Groq is authorized as the independent provider-family fallback. `openai/gpt-oss-120b` is the initial compatibility candidate.

Groq is not a mirrored second primary. Its purpose is to preserve continuity when Cloudflare is unavailable, exhausted, rate-limited, or unsuitable for a specific bounded task. The Router must account for account-specific RPM/TPM/RPD/TPD limits and build a compact continuation capsule before dispatch.

### 3.3 Optional emergency fallback — OpenRouter

OpenRouter remains disabled unless the Founder separately configures a credential and Engineering verifies that the chosen exact `:free` model works without payment registration and passes the applicable tool/quality/security gates.

Production must never use an unpinned random `openrouter/free` route for the main seller because uncontrolled model substitution can change persuasion quality, schema behavior and safety characteristics between turns.

### 3.4 Standby — Mistral

Mistral is removed from the active provider path and placed in standby. Existing evidence is preserved. It may re-enter only after a changed external condition justifies renewed testing and the exact route/model passes the current provider matrix.

## 4. Provider-neutral Canonical Context

The source of conversation truth belongs to Vexryzer. Provider-side session memory, prompt caching and Harness persistence are optimizations or execution details, never authoritative memory.

The canonical context has four logical layers:

- `L0 AuthoritativeState`: confirmed facts, proposed facts, corrections, conflicts, provenance, process actors/systems/steps/handoffs, pain, known consequences, objective, objections, solution hypotheses, decision state, scene identifiers and bounded commercial state;
- `L1 WorkingSet`: the current user objective, recent relevant exchanges, unresolved ambiguity, active tool round-trip and current scene/decision focus;
- `L2 SessionDigest`: deterministic or schema-validated incremental summary of older dialogue that preserves fact/provenance distinctions and does not convert inference into confirmation;
- `L3 SpecialistCapsule`: task-specific projection for Seller, Critic, Composer or Workshop containing only information required for that task.

The application must be able to reconstruct the next provider request from these layers without relying on opaque provider conversation IDs.

## 5. Context Packager

A deterministic `ContextPackager` selects and bounds the provider request. It places stable contract material before dynamic session material where the provider benefits from prefix caching, but correctness must not depend on cache hits.

Packaging rules:

1. include the minimum contract and tool schemas required for the requested capability;
2. include confirmed/proposed/conflicted facts with provenance labels;
3. include the current sales objective and unresolved decision;
4. include only the most relevant recent turns;
5. include SessionDigest for older material when needed;
6. include no attachment bytes or attachment-derived content;
7. enforce a provider/model-specific token budget before network dispatch;
8. produce a smaller `EmergencyContinuationCapsule` for constrained fallback routes.

Context compaction must be observable through metadata and testable with deterministic fixtures. A context overflow must trigger at most one bounded recompaction attempt before fallback/recovery.

## 6. Seller Intelligence Contract

The main Seller operates under a provider-independent behavioral contract. Persuasion is produced through demonstrable understanding rather than hype.

Allowed persuasion moves include:

- pain mirroring;
- root-cause reframing;
- exposing hidden process relationships;
- quantifying only user-supplied or deterministic consequences;
- contrasting current and desired operational states;
- handling objections truthfully;
- reducing uncertainty;
- demonstrating solution direction through the Canvas;
- proposing the next responsible action.

The Seller must prefer one principal high-information question at a time. It must not use fabricated ROI, fake scarcity, fake urgency, unsupported feasibility claims, manipulative pressure, invented customer facts or pricing authority.

Provider fallback must retain the same Seller contract and canonical state so the experience remains coherent even when model style differs.

## 7. Strict generative UI and code adaptation

### 7.1 Fast path

Normal ASK AI turns produce validated domain facts, process mutations and typed `ExperienceScene` proposals. The model does not emit executable React/JavaScript/CSS for the visitor runtime. The closed component registry remains authoritative.

### 7.2 Controlled Workshop path

When a custom demonstration materially improves understanding or persuasion, the Workshop may use a code-capable model. The generated change is treated as an untrusted artifact and must pass workspace confinement, dependency policy, typecheck, static analysis, tests, browser render, accessibility and visual review before reveal.

A live visitor Workshop remains optional and non-blocking. If its zero-cost execution boundary cannot be proven, the product continues entirely through the fast generative-UI path.

## 8. Attachment boundary

The AI provider receives no customer attachment content. S002 does not send files, OCR output, document text, embeddings, screenshots derived from customer uploads or attachment summaries to any LLM provider.

The future request/upload flow remains a human delivery path governed by later Slice authority. ASK AI may know only application-safe metadata explicitly authorized by a later Slice, such as that a document is expected, never its contents by default.

## 9. Provider Capability Registry

Every route is declared with explicit capabilities and policy metadata rather than inferred from model naming.

Required registry dimensions include:

- provider id and exact model id;
- role eligibility: `seller`, `critic`, `composer`, `workshop_code`;
- streaming support;
- tool/function calling support;
- structured argument/output behavior;
- tested context budget;
- tested fallback capsule budget;
- credential name references, never values;
- no-payment eligibility state;
- current compatibility verdict;
- last verified date/SHA;
- provider-health circuit state at runtime.

A route with `noPaymentEligible !== true` cannot become active under this amendment.

## 10. Router, quota governor and circuit breaker

The Router selects a route from task capability, provider health, available quota signals, context size, latency budget, privacy class and quality requirement.

The Router must never choose a route merely because it appears first in a list. It must preserve role requirements: a Seller fallback must pass Seller quality evaluation; a Workshop route must pass code/tool gates; a Critic route must remain independent from the proposal it evaluates when risk requires separation.

Failure classes:

- `401/403`: do not retry blindly; open/configure the circuit according to access failure and select another eligible route;
- `429`: honor provider retry metadata when it fits the UX budget; otherwise route to another eligible free provider;
- `5xx/capacity`: bounded retry only, then provider-family fallback;
- timeout/cancellation: propagate abort, record bounded telemetry and fallback if safe;
- malformed structured/tool output: one bounded repair attempt when justified, then alternate route or deterministic recovery;
- context overflow: one deterministic recompaction, then route with a compatible capsule budget;
- Critic `BLOCK`: no material mutation or prototype publication;
- all LLM routes unavailable: deterministic guided discovery with canonical state preserved.

There is no paid fallback.

## 11. Zero-cost enforcement

The runtime and configuration must fail closed against paid capability.

Forbidden active configuration includes:

- provider route known to require a payment method;
- prepaid AI wallet or credit purchase;
- Workers Paid requirement;
- Groq Developer requirement;
- OpenRouter paid credit requirement;
- automatic upgrade or overage;
- billing-dependent failover;
- client-side provider credentials.

Engineering must verify the live account/provider condition before marking a route available. A future provider policy change that makes a route billing-dependent automatically makes that route ineligible until Founder authority changes.

## 12. Observability and privacy

Telemetry records route metadata, not customer conversation content by default.

Minimum bounded fields include provider/model, role, route reason, fallback reason, latency, request/response token usage when exposed, estimated quota unit, error class, circuit transition, context size, compaction occurrence, tool-call count, schema validation verdict, Critic verdict and scene validation verdict.

Raw prompts/responses, attachment content, API keys and hidden system instructions must not be emitted to public CI artifacts or default telemetry.

If AI Gateway is evaluated later, request/response payload logging must be explicitly reviewed rather than inherited by default.

## 13. DeepSeek Harness role after this amendment

DeepSeek Harness remains the preferred controlled Workshop harness, not the source of ASK AI product memory and not a blocking dependency for ordinary discovery.

The pinned Harness/pi-ai provider catalog indicates Cloudflare Workers AI and Groq provider ids, but that catalog fact is not compatibility proof. Each selected Harness/provider/model tuple must still prove:

- streaming/event delivery;
- canonical tool round-trip;
- structured arguments;
- multi-turn tool-result replay;
- timeout/error mapping;
- restart/session behavior.

The same exact-candidate evidence rule applies as before.

## 14. Historical Mistral diagnostic conclusion

Run `34466683049` on SHA `835ba25446051ce597b27eae29ac18ea2538c16a` proves the following for Harness `0.1.2-rc.1` + `ministral-14b-2512`:

- pure Workshop contracts: `38/38 PASS`;
- streaming: PASS;
- canonical tool calls/results: PASS;
- structured arguments: PASS;
- timeout mapping: PASS;
- second-turn tool result contains the nonce: PASS;
- persistence contains the marker before restart: PASS;
- persistence contains the marker after restart: PASS;
- second assistant response reproduces the nonce: FAIL;
- restarted assistant response reproduces the nonce: FAIL.

Therefore the narrow supported conclusion is that Harness persistence and the canonical tool-result path retained the marker, while Ministral 14B failed the response-semantic replay/recall assertions. This is not evidence of session-file loss.

## 15. Verification order

Before active provider integration:

1. verify account access and no-payment eligibility for Cloudflare candidates;
2. run direct provider capability probes with rate discipline;
3. run the exact Harness compatibility gate for Workshop candidates;
4. verify Groq independently with an EmergencyContinuationCapsule;
5. keep OpenRouter disabled unless separately configured and verified;
6. implement canonical context and Router contracts with pure tests;
7. run Seller persuasion/adversarial evals before declaring a model eligible for primary/fallback sales duty;
8. preserve deterministic recovery for complete provider outage;
9. execute the existing S002 GAUNTLET only on a frozen exact candidate.

## 16. Completion semantics

This amendment is an authorization, not a PASS. The current Slice remains `IN_PROGRESS / NOT_VERIFIED` until the amended provider gates, implementation verification, independent critique and `GNT-VXA-S002-001` are satisfied on an exact candidate SHA.
