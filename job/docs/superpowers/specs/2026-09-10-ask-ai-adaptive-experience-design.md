# ASK AI Adaptive Experience Design

Date: 2026-09-10
Status: `PLANNED / NOT_AUTHORIZED`
Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
Planning base: `6244a246d8faf73e772fc944a398a71a02fb97e0`
Planning branch: `plan/vxa-s002-ask-ai-adaptive-experience`

> This document captures Founder-approved product direction for the future ASK AI work. It is planning material only. It does not authorize S002, does not replace a Slice contract, and does not create a GAUNTLET. Execution remains blocked until a material authorized Slice and matching GAUNTLET are present in the repository.

## 1. Product direction

ASK AI is not a secondary chat widget. It is the central intelligence and interaction surface of Vexryzer Automation. The whole experience reacts to what ASK AI understands: the Infinite Canvas, camera, process map, visual evidence, opportunity framing, prototype reveals, confidence, uncertainty, and commercial next action.

The objective is to make the visitor feel that Vexryzer has understood the operational problem before asking for commitment. Persuasion comes from demonstrable understanding, appropriate visual transformation, credible reasoning and useful prototypes, not from fake urgency, fabricated ROI, dark patterns or unsupported feasibility claims.

The commercial opportunity set is broader than custom automation alone. ASK AI may identify and frame opportunities in:

- workflow automation and integrations;
- micro-SaaS/productized internal tools;
- BI, dashboards, reporting and decision intelligence;
- agentic and AI-assisted operational systems;
- data/process improvements required before automation;
- training, enablement and operational education;
- hybrid solutions combining more than one of the above.

These are hypotheses until validated. The agent must not convert an attractive idea into a technical promise.

## 2. Experience doctrine

The Infinite Canvas is the primary spatial substrate, not decoration behind a chat. The experience should progressively materialize a truthful model of the visitor's world while ASK AI conducts discovery.

The default interaction pattern remains one principal question at a time. The system may use chips, constrained controls, micro-forms, selectable nodes or visual comparisons when they reduce cognitive load. It should never require the visitor to understand diagramming, graph editing or technical notation.

Every meaningful AI conclusion should have one of four visible outcomes when appropriate:

1. a fact becomes visible;
2. an uncertainty becomes visible;
3. a relationship becomes visible;
4. the next decision becomes easier.

The UI should avoid decorative busyness. The strongest visual effect should be the user's own process changing shape as understanding improves.

## 3. Experience acts

### Act A — Magnetic origin

ASK AI is visually central. The first screen establishes the premium spatial world, makes the user feel safe to describe a messy problem, and offers a low-friction first interaction.

### Act B — Pain mirror

ASK AI reflects the visitor's pain in concise language. The Canvas begins to show actors, systems, repeated work, handoffs and bottlenecks. AI-inferred facts are visibly distinct from user-stated facts.

### Act C — Process materialization

The process graph becomes progressively structured. The camera reveals only as much structure as helps comprehension. Parallel paths, repeated work, unclear steps and missing information are represented explicitly rather than forced into a linear flow.

### Act D — Insight reveal

ASK AI identifies a non-obvious but defensible pattern, such as reconciliation rather than spreadsheets being the actual bottleneck. The relevant Canvas region receives focus so the reasoning is visually inspectable.

### Act E — Opportunity constellation

Potential solution classes appear around the understood problem: automation, micro-SaaS, BI, AI/agentic, training or hybrid. They are framed as solution directions with confidence and missing evidence, not as guaranteed implementation plans.

### Act F — Demonstration

When the persuasive value justifies the latency, the system may show a controlled live prototype or mini-demonstration. Otherwise it uses approved generative UI components to create an immediate solution concept.

### Act G — Qualification and transition

ASK AI obtains the minimum sufficient brief and advances to later commercial slices without repeating discovery. Pricing, durable evidence, final sealing and other later authorities remain owned by their authorized slices.

## 4. Infinite Canvas as an adaptive stage

The current S001 Canvas foundation must be extended rather than rewritten. Existing process node and provenance semantics remain useful. New visual behaviors should be additive and contract-driven.

### 4.1 Spatial layers

The Canvas may represent these logical layers without necessarily displaying all of them simultaneously:

- `conversation_nucleus`: ASK AI focus and current question context;
- `process`: source, manual actions, transformations, systems and outputs;
- `pain`: bottlenecks, repetition, delay, uncertainty and friction;
- `opportunity`: solution directions and their relationship to the process;
- `prototype`: safe demonstrations, previews and concept surfaces;
- `evidence_placeholder`: future locations where evidence could strengthen or resolve a fact;
- `decision`: the current commercial or discovery choice;
- `history`: prior confirmed understanding available through semantic zoom rather than constant clutter.

The user should perceive one coherent world, not multiple dashboards bolted together.

### 4.2 Scene contract

The model never controls raw DOM, CSS, JavaScript or React component source in the customer runtime. It proposes a typed scene intent. A validator and registry resolve that intent into approved components.

Proposed contract shape:

```ts
export interface ExperienceScene {
  sceneId: string;
  intent: SceneIntent;
  camera: CameraIntent;
  focus: readonly SceneFocusTarget[];
  elements: readonly SceneElement[];
  narration: SceneNarration;
  provenance: readonly SceneProvenance[];
  transition: SceneTransition;
}
```

The schema must reject unknown component kinds, arbitrary styles, scripts, arbitrary external URLs, unbounded text, invalid coordinates, inaccessible control definitions and unsupported animation instructions.

### 4.3 Scene intents

Initial allowed intents should include at least:

- `ask_origin`
- `pain_mirror`
- `process_reveal`
- `process_focus`
- `uncertainty_focus`
- `friction_lens`
- `before_after`
- `opportunity_constellation`
- `automation_concept`
- `micro_saas_concept`
- `bi_concept`
- `agentic_concept`
- `training_path`
- `hybrid_solution`
- `prototype_preparing`
- `prototype_reveal`
- `comparison`
- `recovery`
- `handoff`

The registry can grow only through reviewed product changes. The model cannot invent new runtime component types during a visitor session.

### 4.4 Camera choreography

The existing `origin | process | focus` camera vocabulary should evolve into an intent-driven camera system while preserving user interruption authority.

Potential camera intents:

- origin focus;
- ASK AI focus;
- reveal newly materialized nodes;
- fit process;
- focus pain cluster;
- focus uncertainty;
- focus opportunity cluster;
- compare two regions;
- prototype reveal;
- recover after invalid scene;
- mobile directed step;
- return to visitor-selected viewport.

Camera commands must be sparse, interruptible, motion-policy aware and semantically meaningful. A model response cannot directly issue arbitrary pan/zoom coordinates; it chooses from validated camera intents and targets.

### 4.5 Semantic zoom

Semantic zoom should reduce cognitive overload rather than merely scale typography.

At low zoom the visitor sees process topology, major bottlenecks and opportunity regions. At medium zoom they see node labels, confidence/provenance cues and relationships. At high zoom they may see summaries, evidence state, effort facts and focused controls. The scene engine must avoid re-render storms when zoom bands change.

### 4.6 Ephemeral versus durable visual facts

A visual element can be:

- `ephemeral`: temporary narration or animation state;
- `proposed`: AI inference requiring confirmation;
- `confirmed`: derived from a user-confirmed fact;
- `system`: deterministic state from the application;
- `prototype`: demonstration that must never be confused with deployed functionality.

Prototype UI must carry an unambiguous concept/demo treatment when necessary to avoid implying production readiness.

## 5. Generative UI model

The live experience uses a hybrid model.

### 5.1 Fast path — approved generative composition

The Experience Composer chooses approved component families and parameters. Rendering is immediate after schema validation. This path is the default because it is fast, deterministic at the component boundary and compatible with accessibility/performance guarantees.

Candidate component families:

- ASK AI composer/nucleus;
- pain mirror;
- process step and cluster;
- uncertainty marker;
- friction lens;
- evidence hint;
- system/actor badge;
- operational metric card;
- before/after comparison;
- automation opportunity;
- micro-SaaS concept card;
- BI/dashboard concept card;
- agentic workflow concept;
- training path;
- hybrid recommendation constellation;
- prototype portal/reveal;
- objection/clarification choice;
- confidence/provenance treatment;
- fallback and recovery state.

### 5.2 Slow path — controlled live prototype

When a custom prototype is likely to materially increase understanding or conversion, the Experience Orchestrator may request the Workshop to create one. Live prototype generation is exceptional, budgeted and non-blocking.

While the Workshop works, ASK AI continues discovery or explanation. The Canvas exposes truthful preparation state and may progressively show the solution frame. No spinner-only waiting state is allowed.

If the Workshop misses its latency budget, fails validation or is unavailable, the experience degrades to approved generative composition without losing the conversation.

### 5.3 Component learning loop

The Workshop may propose new reusable Vexryzer components outside the visitor runtime. A new component enters the runtime registry only after engineering review, accessibility verification, responsive verification, security review, browser tests, visual evidence and the applicable GAUNTLET.

A visitor session cannot promote a component into production.

## 6. Dual-plane agent architecture

### 6.1 Experience Runtime

The Experience Runtime is the customer-facing control plane. It should remain small, fast and predictable.

Responsibilities:

- conversation lifecycle;
- request streaming;
- validated extraction of structured facts;
- XState transitions;
- provenance and correction handling;
- process graph mutation through deterministic validation;
- scene validation and composition;
- camera intent selection;
- Workshop invocation policy;
- fallback behavior;
- rate/abuse policy hooks;
- telemetry without sensitive content.

Mistral remains the planned intelligence provider unless a later authorized contract changes the stack.

### 6.2 Agent roles

The runtime should model separate responsibilities even if early deployment co-locates some roles for latency/cost reasons:

- `ExperienceOrchestrator`: decides the next discovery action and coordinates specialists;
- `ProcessArchitect`: extracts and reconciles process facts, actors, systems, handoffs and uncertainty;
- `SolutionStrategist`: evaluates opportunity classes and missing evidence without promising feasibility;
- `ExperienceComposer`: proposes the best typed visual scene for the current understanding;
- `VxaCritic`: independently evaluates commercial quality, truthfulness, safety, UX and visual appropriateness;
- `WorkshopAgent`: DeepSeek Harness-backed development agent for controlled prototype creation.

A role is not permission. All material state changes remain subject to application-side validation and authority rules.

### 6.3 DeepSeek Harness Workshop

DeepSeek Harness is the preferred development-agent harness for the Workshop, subject to a compatibility spike. It is currently developer-preview software, so the selected version must be pinned and upgrades must pass compatibility verification.

The Workshop requires a real development environment, not prompt-only pseudo-tools. Its isolated workspace may include:

- a constrained Vexryzer prototype SDK/component kit;
- filesystem editing inside the workspace;
- sandboxed shell execution;
- a test runner;
- static analysis;
- controlled browser rendering/screenshots when available;
- artifact export into a validated format;
- Critic invocation;
- no production secrets;
- no customer production data;
- no access to the Vexryzer repository during a live visitor session.

For product-development/design-lab use, a separately authorized engineering workspace may have repository access. That is not the same security profile as the live customer Workshop.

### 6.4 Mistral through DeepSeek Harness

The preferred order of evaluation is:

1. verify a native/catalog Mistral route if the pinned Harness release exposes one;
2. verify `llm-pi-ai` with the real Mistral endpoint and selected model, including multi-turn tool calling and streaming;
3. if compatibility is insufficient, implement a narrow Mistral adapter against the Harness LLM seam rather than weakening model/tool contracts.

The integration is `SPIKE_REQUIRED` until real provider calls prove tool-call arguments, streaming, retries, error mapping, cancellation behavior and multi-turn replay.

### 6.5 Workshop runtime placement

Do not run a long-lived development subprocess inside the normal Netlify Function request path by assumption. The deployment location for a persistent DeepSeek Harness runtime remains `NOT_VERIFIED` under the zero-cost constraint.

Until a compliant free execution environment is verified, the customer product must remain fully functional through the fast generative-UI path. The Workshop can be developed and tested locally/CI without becoming a production dependency.

## 7. Critical agent

`VxaCritic` is independent from the Builder/Composer role. It cannot silently rewrite authoritative state. It returns a structured verdict.

```ts
export type CriticVerdict = 'PASS' | 'REVISE' | 'BLOCK';

export interface CriticFinding {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  correction: string;
}
```

The Critic evaluates at least:

- unsupported claims or implied guarantees;
- mismatch between user pain and proposed solution;
- insufficient discovery;
- repetitive or fatiguing questioning;
- weak or manipulative persuasion;
- hidden assumptions presented as facts;
- provenance mistakes;
- prompt injection/system prompt extraction;
- unsafe tool invocation;
- exposure of secrets or protected data;
- incorrect UI scene for the current state;
- excessive visual noise;
- inaccessible interactions;
- poor mobile experience;
- slow/no-feedback states;
- prototype confusion with production functionality;
- opportunity-class bias;
- failure to consider training/data/process improvements when appropriate;
- unnecessary Workshop invocation;
- missed high-value Workshop invocation;
- contradictions between narration, graph and scene.

A `BLOCK` prevents material state mutation or prototype publication. `REVISE` returns the relevant proposal to the responsible role. The application owns the loop bound so agents cannot recurse indefinitely.

## 8. Latency and visual feedback budgets

These are experience budgets, not guarantees about external providers.

| Event | Design budget |
| --- | ---: |
| local visual acknowledgement after submit | under 100 ms |
| visible truthful activity indication | under 400 ms |
| first semantic agent delta when provider permits | target under 1.5 s |
| useful normal ASK AI response | target under 4 s |
| operation taking more than ~2 s | meaningful visual feedback required |
| live Workshop reveal | ideal 3-8 s |
| Workshop over budget or failed | degrade to approved generative UI |

Feedback must be causally tied to real state. Examples include `understanding process`, `checking an ambiguity`, `structuring handoffs`, `comparing solution directions`, and `preparing demonstration` only when those phases are actually active.

Never present a fake progress percentage when the system cannot know progress.

## 9. Adaptive scenario coverage

The design should support broad variation without turning the runtime into unrestricted agent autonomy.

| Scenario | ASK AI behavior | Canvas behavior |
| --- | --- | --- |
| vague pain | ask for the highest-information example | show a small uncertainty-first scene |
| user supplies detailed process | summarize and confirm instead of re-interviewing | materialize graph rapidly, focus only uncertain regions |
| multiple processes | separate candidates, ask which matters most | clusters with explicit boundaries and shared systems |
| parallel teams/actors | identify ownership/handoffs | lanes/clusters without forcing a single line |
| recurring manual work | quantify recurrence when useful | repetition/effort treatment, no fabricated savings |
| one-time work | avoid false automation framing | consider tooling, data cleanup, training or no-fit |
| direct price question | acknowledge intent, collect only responsible minimum | keep discovery concise; pricing remains later authority |
| wants BI/dashboard | clarify decision/use case/data source | BI concept region tied to inputs/decisions |
| wants micro-SaaS | clarify users/workflow/ownership | product concept scene distinct from process automation |
| wants AI agent | expose tasks, decisions, allowed authority | agentic concept showing human/system boundaries |
| training is better fit | explain why without forcing software sale | training path tied to operational gaps |
| hybrid fit | keep solution classes explicit | constellation showing complementary parts |
| asks for free implementation recipe | remain useful without delivering full paid solution | show concept/architecture level, not deployable product |
| changes a fact | accept correction and recompute dependent understanding | animate correction, invalidate dependent inference |
| contradicts earlier answer | clarify material contradiction only | mark conflicted region, preserve history/provenance |
| unknown software | avoid guessing compatibility | uncertainty node on the relevant system |
| sensitive information appears | minimize/redirect collection | avoid rendering sensitive content unnecessarily |
| provider slow | continue truthful local/known-state interaction | visible active state; no frozen Canvas |
| AI provider fails | deterministic guided fallback | recovery scene, preserve confirmed graph |
| Workshop unavailable | continue fast path | approved concept scene instead of prototype |
| offline/reconnect | preserve client-safe state and explain limits | frozen truthful state, resumable affordance |
| mobile/coarse pointer | directed experience, keyboard-safe composer | vertical/stepwise camera path, optional manual gestures |
| reduced motion | remove camera animation/springs | equivalent focus through instant state/opacity changes |
| large process | prioritize topology and current focus | semantic zoom, clustering and incremental reveal |
| skeptical visitor | show evidence of understanding before claims | emphasize inspectable process facts and uncertainty |

The authorized Slice may deliberately implement only a subset, but its contract must specify what is required and what remains deferred. Planning for a scenario does not silently add it to a Slice.

## 10. State authority and event model

XState remains the owner of deterministic experience lifecycle. The current simple `origin/process/focus` machine should evolve through explicit states rather than scattered React local state.

Proposed state families:

- `origin`
- `discovering.idle`
- `discovering.requesting`
- `discovering.streaming`
- `discovering.validating`
- `discovering.revising`
- `discovering.awaiting_user`
- `workshop.requested`
- `workshop.running`
- `workshop.validating`
- `workshop.revealing`
- `recovery.ai`
- `recovery.workshop`
- later-slice handoff states

State context should hold normalized facts and identifiers, not model-specific opaque blobs.

Server/domain authority must validate every process mutation and scene proposal before application. The existing process graph validator should be strengthened rather than bypassed.

## 11. Security boundary

The public-facing agent is an untrusted-input system. Prompt instructions are never treated as a security boundary.

Required controls include:

- provider secrets server-side only;
- no raw provider secret or system instruction in browser responses;
- strict JSON/schema validation for model outputs;
- bounded text and collection sizes;
- sanitized IDs and labels;
- rate/abuse hooks;
- prompt-injection tests;
- explicit tool allowlists;
- Workshop filesystem confinement;
- no live-session access to the main repository;
- no production/customer datasets in the prototype workspace;
- restricted outbound network for tool execution where technically possible;
- dependency allowlist for generated prototypes;
- no arbitrary remote script/style injection;
- no `eval`, runtime JSX compilation from model output or model-controlled CSP weakening;
- prototype artifact validation before display;
- cleanup/expiry of ephemeral workspaces and artifacts;
- redacted diagnostics and telemetry.

## 12. Accessibility and mobile

ASK AI being central increases, rather than reduces, accessibility requirements.

The conversational control must maintain predictable focus, screen-reader status, keyboard access and IME-safe composition. Streaming content must not create continuous noisy announcements. Canvas changes need concise semantic announcements independent of animation.

Mobile uses the same underlying scene/state but a directed camera and vertically navigable reading order. Core completion cannot depend on precision pan/zoom. The composer must remain usable with the virtual keyboard open.

Reduced motion has feature parity. It removes spatial animation, not information.

## 13. Performance and rendering discipline

The adaptive system must preserve S001's performance intent.

- scene parsing/validation is pure and testable;
- unchanged graph nodes retain stable identities;
- camera commands are emitted only for changed intents;
- semantic zoom changes are bounded;
- streaming text should not trigger full Canvas recomputation per token;
- scene updates should batch meaningful deltas;
- prototype artifacts load lazily;
- expensive visual effects have device/motion fallbacks;
- component registry entries declare rendering/performance constraints;
- telemetry measures actual Canvas commits and camera commands.

## 14. Observability

Metrics should explain whether the experience feels intelligent without storing unnecessary visitor content.

Candidate events/measurements:

- `ask_submit_to_visual_ack_ms`
- `ask_submit_to_first_semantic_delta_ms`
- `ask_turn_to_useful_state_ms`
- `scene_proposed`
- `scene_rejected`
- `scene_rendered`
- `critic_pass/revise/block`
- `process_fact_proposed/confirmed/corrected`
- `camera_intent_applied/interrupted`
- `workshop_requested/started/reveal/fallback/failed`
- Workshop elapsed time and validation reason codes;
- AI fallback activation;
- mobile directed-mode activation;
- reduced-motion activation;
- render commit and semantic-zoom counters.

Do not place raw conversational PII in telemetry by default.

## 15. Testing and GAUNTLET expectations

An authorized implementation should prove behavior with:

- pure tests for scene schemas, process mutations, provenance and camera intents;
- XState transition tests including correction, retry, fallback and Workshop concurrency;
- model-contract fixtures for valid/malformed/hostile structured output;
- real-provider compatibility test for the chosen Mistral route outside ordinary trial-and-error CI;
- Harness lifecycle and restart/persistence tests;
- sandbox boundary tests;
- Critic verdict tests;
- component tests for ASK AI, scene registry and recovery states;
- Playwright desktop/mobile flows;
- keyboard and screen-reader-relevant interaction tests;
- axe accessibility checks;
- visual GAUNTLET for each major scene family and reduced-motion mode;
- performance instrumentation assertions;
- production bundle secret/provider scan;
- dependency license and vulnerability gates;
- failure injection for Mistral timeout/rate-limit/malformed output;
- failure injection for Workshop startup, timeout, invalid artifact and crash.

## 16. Architectural decisions captured

Founder-approved direction captured by this document:

- ASK AI is central, not a corner widget.
- The whole UI/UX reacts to ASK AI understanding.
- Infinite Canvas is the adaptive primary experience substrate.
- The system sells/qualifies automation, micro-SaaS, intelligent/agentic solutions, BI and training, including hybrids.
- Persuasion should come from spectacular but truthful demonstration of understanding.
- Generative UI follows strict UI rules and a closed runtime component registry.
- Hybrid mode is required: immediate approved composition plus exceptional live prototype generation.
- Long work must provide truthful visual feedback; the customer must not stare at an unexplained wait.
- DeepSeek Harness is the preferred Workshop harness with a real development environment, subject to compatibility and deployment proof.
- Mistral remains the planned model provider unless contract authority changes it.
- A highly critical independent agent evaluates requirements, truthfulness, persuasion, safety, UI/UX and runtime behavior.

## 17. Unverified decisions that must be resolved before authorization

These are explicit engineering unknowns, not invitations to guess during implementation:

- exact DeepSeek Harness release to pin;
- whether that release's provider catalog directly supports the selected Mistral model;
- whether `llm-pi-ai` passes the required Mistral streaming/tool/replay cases without an adapter;
- zero-cost production placement for a persistent/isolated Workshop runtime;
- exact live-prototype artifact transport and rendering boundary;
- exact server streaming protocol between Netlify Functions and browser;
- storage/expiry mechanism for any temporary prototype artifacts;
- authorized S002 identifiers, version, base SHA and GAUNTLET;
- product-contract amendment needed to formally expand the offer beyond custom automation.

## 18. Non-goals of this planning document

This document does not authorize deployment, create a long-lived public coding sandbox, expose repository access to visitors, add pricing logic, move later Slice ownership forward, create fake capability paths, or permit model-authored arbitrary runtime code.

The product must remain useful when the Workshop is absent. The Workshop amplifies the experience; it does not become a single point of failure for discovery.
