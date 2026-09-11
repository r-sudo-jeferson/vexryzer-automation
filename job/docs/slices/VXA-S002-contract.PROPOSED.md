# VXA-S002 Slice Contract — PROPOSED

slice_id: `VXA-S002`
proposed_slice_version: `1.0.0`
initiative_id: `VXA-001`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
status: `PROPOSED / NOT_AUTHORIZED`
predecessors: `VXA-S001@1.0.0`
repository: `r-sudo-jeferson/vexryzer-automation`
product_root: `job`
planning_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
proposed_gauntlet_id: `GNT-VXA-S002-001`
product_amendment: `job/docs/product/VXA-001-product-contract-amendment-001.PROPOSED.md`
architecture_amendment: `job/docs/architecture/VXA-001-architecture-amendment-001.PROPOSED.md`
design_spec: `job/docs/superpowers/specs/2026-09-10-ask-ai-adaptive-experience-design.md`
implementation_plan: `job/docs/superpowers/plans/2026-09-10-vxa-ask-ai-adaptive-experience-plan.md`

> This is a proposed Slice contract prepared from Founder-approved design direction. It does not authorize implementation. The version, base SHA and GAUNTLET become authoritative only through explicit Founder authorization.

## Objective

Transform the completed S001 Infinite Canvas foundation into an ASK AI-centered adaptive discovery experience that visibly understands the visitor's operation, progressively materializes process and uncertainty, identifies responsible solution directions, composes persuasive but truthful UI, and can invoke an isolated DeepSeek Harness Workshop for high-value prototype demonstrations without making that Workshop a blocking dependency.

## Observable result

A visitor can arrive with a vague or detailed operational problem, converse with ASK AI as the central experience, see validated understanding progressively alter the Infinite Canvas, correct wrong assumptions, inspect uncertainty/provenance, receive one or more defensible solution directions, and continue through a truthful fast-path experience even when AI or Workshop capability is slow or unavailable.

When a custom prototype is likely to materially increase clarity or persuasion, the system may invoke the Workshop. The visitor receives truthful visual progress and remains able to interact. A valid prototype appears as a clearly identified concept/demo; an unavailable or slow Workshop falls back to approved generative UI without losing confirmed understanding.

## Scope

### ASK AI central experience

- replace the S001 origin-only invitation with an ASK AI-centered discovery nucleus while preserving the premium spatial environment;
- one principal question at a time by default;
- immediate local acknowledgement and truthful streamed activity states;
- bounded structured controls/chips when they reduce cognitive load;
- deterministic fallback path when AI is unavailable;
- no generic floating chatbot pattern.

### Agentic reasoning

- DeepSeek-backed Experience Orchestrator behind a server-owned semantic boundary;
- bounded specialist responsibilities for process understanding, solution strategy and scene composition;
- structured model output validated before application;
- bounded internal tool/specialist loops;
- correction and contradiction handling;
- context condensation that never replaces deterministic facts;
- prompt-injection and system-prompt-extraction resistance;
- no model authority over price, durable submission, uploads, security policy or feasibility truth.

### Independent VXA Critic

- deterministic hard-block policy before model critique;
- separate Critic call/identity for material semantic, visual and commercial proposals;
- structured `PASS | REVISE | BLOCK` verdict;
- bounded revision loop;
- Critic attacks truthfulness, relevance, persuasion, dark patterns, provenance, security, visual quality, accessibility, latency and Workshop use;
- proposal generator cannot silently self-approve.

### Infinite Canvas adaptation

Extend, do not replace, the S001 Canvas foundation.

Support:

- ASK AI nucleus as the central focus;
- progressive process materialization;
- branches and parallel paths;
- multiple process clusters;
- shared actors/systems;
- friction and uncertainty regions;
- opportunity constellations;
- before/after comparisons;
- prototype reveal regions;
- semantic zoom with detail-on-demand;
- stable identities under incremental updates;
- semantic camera intents;
- user interruption authority;
- reduced motion equivalent;
- mobile directed flow that does not require pan/pinch.

### Provenance and corrections

- preserve `user_stated`, `ai_inferred`, `user_confirmed` provenance;
- represent conflict/revision without color-only semantics;
- correcting a fact invalidates dependent AI inference deterministically;
- unrelated confirmed facts remain stable;
- accepted model proposals cannot mutate the original graph if validation fails.

### Solution opportunity framing

ASK AI may qualify:

- automation/integration;
- micro-SaaS/internal tool;
- BI/dashboard/decision intelligence;
- AI-assisted/agentic system;
- data/process improvement prerequisite;
- training/enablement;
- hybrid combination;
- no-software-fit.

The system may compare classes and explain missing evidence. It may not claim confirmed technical feasibility merely from conversational inference.

### Strict generative UI

- closed `ExperienceScene` schema;
- allowlisted component registry;
- semantic camera intents only;
- bounded scene element counts and text;
- no arbitrary style or script fields;
- no dynamic component/module imports from model data;
- no raw model-authored x/y/zoom commands;
- no model-authored same-origin executable code;
- accessible names, focus behavior and reduced-motion handling in every interactive component.

### DeepSeek Harness Workshop

S002 includes the Workshop substrate and compatibility proof:

- prove the selected pinned DeepSeek Harness version with the exact authorized `deepseek-v4-pro` route/model;
- prove required tool calling, streaming/event delivery, structured arguments, multi-turn replay, failure mapping and restart/session behavior;
- isolate the Workshop behind `WorkshopClient`;
- use a prebuilt prototype kit and prebundled dependencies;
- use an ephemeral workspace per live prototype job;
- restrict filesystem/tool capabilities outside prompt text;
- scrub child-process environment;
- forbid access to the live Vexryzer repository during a visitor session;
- forbid production/customer secrets and unrestricted network targets;
- clean workspace on terminal states;
- export only validated prototype artifacts.

Production placement of a persistent live Workshop remains capability-gated until a zero-fixed-cost runtime with sufficient isolation is verified. S002 may not make such a runtime a dependency of the core discovery path.

### Prototype path

- deterministic policy chooses `fast_path` or `workshop`;
- Workshop only when its expected persuasive/clarity gain exceeds its latency/complexity cost;
- conversation remains usable while Workshop runs;
- truthful progress phases only;
- no fake percentages;
- timeout/invalid artifact/crash degrade to fast-path scene;
- stale Workshop result is revalidated or discarded;
- prototype is visibly marked as concept/demo where confusion is possible;
- initial live customer path must not execute arbitrary model-generated JavaScript in the same-origin application.

### Recovery and observability

- bounded timeout for every external waiting state;
- deterministic guided discovery fallback;
- preserve confirmed process/facts through failure/retry;
- stable request/job ids and stale-event rejection;
- telemetry of timing/count/status codes without raw PII by default;
- performance instrumentation for Canvas commits, camera commands and semantic stream timing.

## Explicit exclusions

Unless a later explicit Founder decision changes this contract, S002 excludes:

- authoritative pricing implementation or changes to pricing formulas;
- discounts;
- real customer file upload/evidence persistence;
- durable request sealing/submission;
- notification/email delivery;
- payment/checkout;
- accounts/customer portal/admin dashboard;
- production deployment of customer solutions;
- unrestricted code generation delivered as the paid solution;
- runtime promotion of model-generated React components without engineering review;
- paid infrastructure required to keep the initial product functional.

These remain later-Slice or separate-contract responsibilities.

## Product Truth

The strongest persuasive effect is the visitor seeing their own process become more legible, not decorative animation.

ASK AI must demonstrate understanding before asking for commitment. It may be commercially persuasive, but persuasion must remain evidence-based and reversible when assumptions change.

A valid outcome can be automation, another solution class, a hybrid, more discovery needed, or no-software-fit.

## Experience Truth

The UI behaves like one coordinated intelligent spatial product. ASK AI, Canvas, camera, process graph, opportunity framing and prototype reveal must feel causally connected.

No empty waiting state. If meaningful work takes more than roughly two seconds, the user receives truthful visual feedback tied to actual active work.

The user is never required to manipulate the Canvas to continue.

## Engineering Truth

Deterministic code owns state application, validation, security, concurrency, authority and fallback.

AI output is untrusted input until schema and policy validation succeed.

DeepSeek Harness is an optional development capability behind a narrow interface, not the authority or state machine of the customer experience.

## Invariants

- all product code/tests/config/docs under `job` except permitted provider glue;
- no Machina access or dependency;
- fixed infrastructure cost remains R$ 0 unless Founder explicitly changes the contract;
- Netlify Free remains the selected customer web platform;
- provider secrets remain server-side;
- no unrestricted child environment inheritance;
- no same-origin arbitrary generated JavaScript in S002;
- no prompt instruction treated as a security boundary;
- no model authority over pricing, persistence, uploads, sealing, permissions or feasibility confirmation;
- no fake progress, fake prototype status or fake production state;
- no core mobile task requiring pan/pinch;
- camera automation remains interruptible;
- reduced motion preserves meaning;
- no serious/critical accessibility regressions in authorized fixtures;
- no Workshop failure blocks the discovery path;
- no Workshop result applies after becoming stale without revalidation;
- no customer session promotes a new component into the production registry;
- no broad package install/network dependency inside the live Workshop path;
- no free implementation output that substitutes for the paid engagement.

## Performance and responsiveness budgets

These are design/engineering targets, not promises about third-party provider latency:

- local visual acknowledgement after submit: target `<100 ms`;
- truthful activity indication: target `<400 ms`;
- first semantic model delta when provider permits: target `<1.5 s`;
- useful normal ASK AI state: target `<4 s`;
- any operation exceeding ~2 s: meaningful truthful visual feedback required;
- Workshop reveal: ideal `3-8 s`, never a blocking dependency;
- Workshop over its authorized budget: fast-path scene must be available and user interaction preserved;
- Canvas topology must not relayout on each text token;
- repeated semantic stream updates must not cause unbounded camera commands;
- preserve S001 Core Web Vitals targets unless evidence supports a stronger authorized budget.

## Accessibility requirements

- WCAG 2.2 AA behavior applicable to this Slice;
- keyboard-complete ASK AI/discovery path;
- visible focus throughout scene transitions;
- composer focus cannot be stolen by camera animation;
- screen-reader announcements are semantic and throttled, not token-by-token;
- reduced motion produces equivalent comprehension;
- 200% zoom remains usable;
- scene meaning never depends only on color, spatial position or animation;
- directed mobile path remains usable with virtual keyboard visible;
- spatial Canvas information has an equivalent navigable semantic representation for core discovery actions.

## Security requirements

- input/output schema validation at trust boundaries;
- server-side provider credentials only;
- model tool allowlist enforced outside prompts;
- Critic cannot elevate tool permissions;
- prompt-injection/system-prompt extraction attacks covered by tests;
- prototype artifact validation before render;
- no arbitrary external executable URLs;
- no repository paths in visitor Workshop brief;
- no secrets or full environment snapshots in logs;
- rate/abuse hooks and bounded payload sizes;
- stale/cross-request event isolation;
- no network isolation claim based solely on Harness filesystem sandbox;
- live Workshop enablement requires explicit proof of its execution and egress boundary.

## Required scenario families

Release-blocking scenario selection is finalized by the authorized GAUNTLET, but S002 planning requires representative coverage for:

- vague pain;
- detailed process supplied upfront;
- multiple processes;
- parallel actors/teams;
- unknown software;
- correction of an earlier fact;
- contradiction;
- automation fit;
- micro-SaaS fit;
- BI fit;
- agentic fit;
- training fit;
- hybrid fit;
- no-software-fit;
- user asks price immediately;
- user asks for a free implementation recipe;
- prompt injection/system prompt extraction;
- slow provider;
- malformed model output;
- provider timeout/rate limit;
- Workshop fast success;
- Workshop slow/timeout;
- Workshop invalid artifact;
- Workshop stale completion;
- offline/reconnect where browser behavior applies;
- mobile/keyboard/reduced-motion equivalents.

## Proposed acceptance criteria

1. Authorized base SHA and GAUNTLET are verified before production implementation.
2. S001 Canvas/navigation/accessibility invariants remain intact or have an explicitly authorized migration.
3. ASK AI is the primary/central interaction surface on desktop and mobile.
4. User input receives immediate local acknowledgement without fake server progress.
5. Server emits only closed, typed application events to the browser.
6. Structured AI facts/scenes are validated before mutation/render.
7. Invalid AI output cannot corrupt existing confirmed graph/facts.
8. Corrections invalidate dependent AI inference deterministically.
9. Multiple processes/shared systems are representable without forcing one linear flow.
10. Scene composition uses an allowlisted registry; unknown component kinds fail closed.
11. Model cannot issue arbitrary DOM/CSS/JS/component import or camera coordinates.
12. Camera intents are semantic, interruptible and reduced-motion aware.
13. Streaming text does not trigger Canvas relayout/camera commands per token.
14. Critic hard-block policy executes before model judgment where applicable.
15. Material proposal Critic is logically independent and bounded.
16. `BLOCK` prevents material state mutation/publication; `REVISE` has a bounded retry path.
17. Solution framing supports automation, micro-SaaS, BI, agentic, training, hybrid and no-fit without false feasibility claims.
18. DeepSeek Harness + `deepseek-v4-pro` compatibility is proven on an exact pinned version before production dependency commitment.
19. Visitor Workshop environment does not receive the Vexryzer repository, unrestricted environment, production secrets or arbitrary package/network authority.
20. Workshop crash/timeout/invalid result preserves conversation and confirmed facts and falls back to the fast path.
21. Stale Workshop/agent events cannot overwrite newer user state.
22. Prototype output is validated and clearly identified as concept/demo where required.
23. No same-origin arbitrary model-generated JavaScript executes in S002.
24. AI provider failure exposes deterministic guided recovery with no indefinite spinner.
25. Keyboard, screen reader, reduced-motion, 200% zoom and mobile directed flow pass the authorized accessibility matrix.
26. Security/adversarial tests cover prompt injection, secret exfiltration, tool escalation and generated-artifact attacks.
27. Privacy-safe observability excludes raw PII/prompts/secrets by default.
28. Performance tests prove graph/camera work is bounded under streaming and representative multi-process scenes.
29. Production build/provider-secret scan and dependency/license/audit gates pass on the exact candidate.
30. `GNT-VXA-S002-001` passes on the exact frozen candidate before integration.
31. Candidate-specific evidence is rerun if candidate SHA changes.
32. Exact post-integration content/main result is verified before `COMPLETE`.

## Authorization boundary

This proposal does not authorize Task 1 of the implementation plan. Founder authorization must explicitly adopt the Slice version, exact authorized base SHA, GAUNTLET id, and any proposed Product/Architecture amendments that are intended to become active.