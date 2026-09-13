# Issue #3 — Infinite Value Canvas Architecture + Execution Pack

STATUS: PLANNED / ARCHITECTURE_READY_FOR_EXECUTION_REVIEW
FORGE_BINDING_ID: FORGE-VEXRYZER-AUTOMATION-v1.0.0
REPOSITORY: r-sudo-jeferson/vexryzer-automation
BRANCH: staging/vxa-s002-agent-led-accounting-seller
PRODUCT_ROOT: job
SLICE: VXA-S002@1.0.0
GAUNTLET: GNT-VXA-S002-001
AUTHORIZED_BASE_SHA: 6244a246d8faf73e772fc944a398a71a02fb97e0a
PLANNING_HEAD_INSPECTED: d62887550d1a54d43df6cf95d60b2086f17c348f
ISSUE: #3
SOURCE: job/docs/product/INFINITE-VALUE-CANVAS-ORCHESTRATOR.md
HANDOFF: job/docs/handoffs/ISSUE-003-INFINITE-VALUE-CANVAS-GAUNTLET.md

## Continuity note

GPT-6 Astra completed a planning pass in chat while the Desktop Commander plane was disconnected. The repository therefore contains the handoff but not the later Architecture + Execution Pack.
Recovered durable facts: the planning matrix converged to 29 cumulative GAUNTLETs and 16 execution packages; critique strengthened pagination/API semantics, typed spatial actions, disclosure revocation, and DeepSeek Harness activation boundaries.
The original labels of those chat-only items are not durably retrievable. This file materializes the continuation against repository truth without pretending that reconstructed labels are verbatim Astra output.

## Current architecture truth

The implementation already has one canonical React/TypeScript Infinite Canvas based on @xyflow/react. It must be evolved in place; no parallel Vivarium/app/canvas architecture is authorized.
`src/canvas/domain.ts` owns validated process graph truth and must remain the deterministic graph boundary.
`src/canvas/camera.ts` already owns deterministic fit/focus planning and reduced-motion behavior. It is the seam for Camera Director, not a subsystem to replace.
`src/experience/agent-intent.ts` already rejects executable surfaces and exposes typed semantic actions. It is the base protocol for spatial agent authority.
The active actions already include focus, compare, annotate, reveal, group, de_emphasize, quantify, demonstrate, explain_relationship, stage_artifact and request_workshop.
`src/server/ai/seller/seller-wire-tools.ts` exposes the agent-intent contract to the sole AI provider path while application code remains authoritative.
`src/server/session/agent-session.ts` already protects session token digest, lease ownership, revision, replay/idempotency and completion semantics.
The Trust Kernel, deterministic calculations, canonical evidence, correction/reconciliation and tenant/security boundaries are non-regression surfaces.
DeepSeek is the only authorized LLM truth. No alternate model/provider/fallback or client-side secret path may be introduced.
The current attachment boundary remains closed to customer attachment bytes, OCR, extracted text, embeddings, screenshot-derived content and attachment summaries sent to DeepSeek.
The current DeepSeek Harness direct activation remains NOT_VERIFIED until exact runtime/provider/environment evidence proves it; developer-preview SDK existence is not production activation evidence.

## Target architecture

One Living Canvas Runtime coordinates canonical graph state, approved presentation state, viewport/camera state, agent presence, transient choreography, disclosure state and user interaction priority.
The model never writes DOM, CSS, JSX, arbitrary coordinates, arbitrary component names, executable code or direct camera transforms.
The model emits semantic intents. Deterministic application code validates identity, revision, evidence, entitlement, disclosure, component/model/token catalog membership, accessibility constraints and responsive policy.
Approved intents are resolved into a Presentation Plan, then into existing Canvas nodes/surfaces and camera commands.
Canonical business truth and presentation truth remain separate. Presentation can be revoked or recomputed without mutating canonical evidence.
User navigation, keyboard focus, touch gestures, reduced-motion policy and explicit user interruption outrank agent choreography.
Camera motion is an explanation/persuasion primitive, never autonomous spectacle.

## Typed semantic UI intent

Extend the existing `AgentIntent` rather than create a second protocol.
Spatial actions must remain a closed discriminated union. Every action carries a stable id and is bounded by schema limits.
New current-slice candidate actions are semantic, not coordinate-level: `frame_region`, `sequence_focus`, `present_comparison`, `surface_evidence`, `surface_value`, `present_next_step`, `restore_user_view`.
Each action resolves targets by canonical object ids or approved region ids. Unknown or stale targets fail closed.
An action must include the expected canonical revision and presentation revision before application; stale actions are rejected rather than replayed against a changed Canvas.
Action application is transactional at the presentation layer: validate whole action batch, resolve catalog entries, then publish one presentation revision.
The semantic protocol must preserve provenance/evidence references for every commercial claim surfaced in UI.
No action may directly reveal protected payloads; it can only request a disclosure transition that the server-side Disclosure Gate authorizes.

## UI Adaptation Gate

Flow: MODEL INTENT → SCHEMA VALIDATION → REVISION CHECK → TARGET RESOLUTION → EVIDENCE CHECK → DISCLOSURE → ENTITLEMENT → COMPONENT/MODEL/TOKEN CATALOG → A11Y/RESPONSIVE POLICY → PRESENTATION PLAN → RENDER.
Reject unknown keys, unknown action kinds, executable text, unauthorized components, arbitrary tokens, unsafe URLs, missing evidence, stale revisions and disclosure escalation.
Catalog resolution is explicit and versioned. New visual primitives require code review and tests; the agent can compose but cannot invent executable production components.
The Gate records non-sensitive rejection reason codes for evaluation and debugging without logging private customer content.

## Camera Director

Preserve `camera.ts` as the deterministic planner and evolve its semantic vocabulary.
Required intents: focus object, frame region, compare targets, reveal sequence, process overview, origin reset, restore prior user view and guided transition.
The Director owns bounded duration, zoom limits, padding, transition interruptibility, reduced-motion zero-duration behavior and focus restoration.
The model proposes narrative intent; the Director computes geometry from current Canvas state.
Any pointer/touch/wheel/keyboard input cancels or yields non-essential choreography immediately.
Programmatic focus must synchronize visual framing and accessible focus without trapping keyboard users.
Mobile receives a distinct framing policy; it must not be a desktop viewport scaled down.

## Agent presence

The seller is a spatial participant, not a persistent side-chat panel.
Presence is rendered as an approved Canvas surface anchored to the currently relevant region/evidence and can migrate through semantic transitions.
Narration, evidence, question and next action remain readable without motion dependency.
The agent cannot occlude the currently focused user control, hide required evidence or steal focus while the user is interacting.
## Visual system

Target language: continuous machined-metal Canvas, physically legible relief, recessed/raised surfaces, selective optical glass, controlled specular depth, premium typography and restrained high-value motion.
Neumorphism/glass/2.5D are techniques, not decoration quotas. Every depth cue must improve hierarchy, affordance or focus.
No generic AI gradient dashboard, floating-chat shell, card-grid dashboard, excessive glow, ornamental 3D mesh or cinematic motion detached from information.
Desktop and mobile are separately composed experiences over the same contracts.
The Canvas must visibly make proof, process, value, objection handling and next action feel spatially related.

## Disclosure and protected demonstration

Server-side disclosure states: PUBLIC, DEMO, PARTIAL, LOCKED, ENTITLED, INTERNAL.
Disclosure is monotonic only within one authorized request. A later entitlement change, session change, asset sensitivity change or policy decision can revoke previously presented access.
Revocation must invalidate presentation state and remove protected payload availability; hiding with CSS is never sufficient.
Client receives only the minimum fields authorized for the exact presentation. Locked previews receive safe derived metadata/placeholders, never the secret payload.
Pagination and list APIs must enforce disclosure per item and per page cursor; an authorized first page never authorizes later pages implicitly.
Cursors must be opaque, tenant-bound, policy-bound and invalidated when the relevant authorization/disclosure revision changes.

## DeepSeek Harness boundary

The official Harness/SDK remains behind a server-side broker boundary.
The broker owns environment construction, allowed tools, timeout, cancellation, session mapping, error normalization and audit metadata.
`DEEPSEEK_API_KEY` is server-only and never inherited implicitly into arbitrary child/tool environments.
Developer-preview package availability is not evidence of production suitability. Activation remains gated until the exact pinned version, provider/model/account, confinement, restart/session behavior and target deployment environment pass.
The Harness is non-canonical memory; Vexryzer canonical session/evidence state remains authoritative after restart.
No shell/filesystem/code-runtime/attachment content capability becomes production-authorized merely because the Harness exposes it.

## Security / tenancy

All ids used by spatial actions, disclosure, cursors, sessions and tools resolve inside the authenticated tenant scope.
External/customer content is data, never trusted instruction.
Tool proposals are typed, least-privilege and carry tenant scope, read/write class, demo allowance, approval requirement, data classification, timeout, rate limit and audit level.
No browser-only authorization or entitlement decision is authoritative.
Presentation telemetry must avoid raw prompts, attachment contents, secret values and protected commercial payloads.

## Performance

Keep React Flow and current virtualization/rendering architecture unless measurement proves a blocking limit.
Separate canonical state updates from high-frequency viewport/pointer state so camera motion does not re-render business state.
Batch semantic action application into one presentation revision.
Set budgets from measured current hardware/browser baselines before final PASS; record p75/p95 where meaningful rather than inventing targets.
Test dense graphs, rapid zoom/pan, repeated agent choreography, mobile memory pressure and long sessions.
Animation must degrade gracefully under reduced motion and constrained devices.

## Accessibility

Every meaningful UI object has accessible name/role/state independent of visual depth.
All agent-driven reveal/focus operations have deterministic keyboard equivalents and do not create focus traps.
Announcements distinguish narration, state change and action result without flooding live regions.
Color/lighting never carry the only meaning; focus visibility and text contrast remain valid across Silver/Space Black presentation variants.
Touch targets, pinch/scroll behavior and safe viewport insets are verified on mobile.

## Observability and evaluation

Capture non-sensitive events for semantic intent accepted/rejected, action kind, camera interruption, catalog miss, disclosure denial/revocation, stale revision, tool failure, agent retry, human override and recovery.
Measure time-to-first-insight, time-to-first-wow, evidence completeness, UI model reuse, catalog gap rate, conversion-state transition, realized-vs-estimated value and accessibility/interaction errors.
Agent quality evaluation weights factual support, evidence completeness, safe tool use, useful spatial orchestration and calibrated persuasion; conversion alone cannot define quality.

## Scope classification

CURRENT_SLICE_REQUIRED: living Canvas presentation layer; spatial agent presence; typed semantic actions; deterministic Camera Director; UI Adaptation Gate; evidence-backed proof/value surfaces; pipeline/process visualization; desktop/mobile/a11y behavior; disclosure enforcement required by presented data; tests/visual/E2E proof.
CURRENT_SLICE_COMPATIBILITY_SEAM: versioned UI model/component/token catalogs; protected-demo state machine; generic tool-broker metadata; lifecycle mode identifiers; telemetry fields needed for later expansion.
FUTURE_SLICE_REQUIRED: full artifact intake/parsing/OCR; BusinessAsset extraction; arbitrary BI generation from customer files; live execution Workshop; enterprise operational twin; role twins; implementation/operations lifecycle modules; broad entitlement commerce.
PROHIBITED_BY_CURRENT_BOUNDARY: alternate LLMs/fallbacks; customer attachment content sent to DeepSeek; arbitrary model-generated DOM/JS/CSS/JSX; direct arbitrary shell/filesystem execution; client-side-only secrecy; uncontrolled 3D asset/model generation; hidden paid fallback.
## Exact module/file change map

Preserve/extend: `src/experience/agent-intent.ts` for closed semantic spatial actions and revision metadata.
Preserve/extend: `src/canvas/camera.ts` for deterministic Director planning and interruption-safe semantic commands.
Preserve/extend: `src/canvas/domain.ts` only when new approved UI object semantics genuinely belong to canonical process graph truth.
Add under `src/experience/`: presentation-plan types, UI Adaptation Gate, catalog resolver, disclosure presentation policy and spatial-action application.
Extend `src/canvas/AutomationCanvas.tsx`: consume approved presentation plan, spatial agent presence and Director commands; keep rendering passive to authority decisions.
Extend existing node/surface files before creating new components; new components must map to approved catalog gaps.
Extend `src/server/ai/seller/seller-wire-tools.ts`: expose only the final closed semantic schema; no arbitrary presentation code.
Extend `src/server/ai/agent/agent-led-turn-runtime.ts`: validate and commit approved presentation revisions alongside canonical/reactive state without making presentation canonical truth.
Extend `src/server/session/agent-session.ts` or adjacent versioned session presentation record only if persistence of presentation revision is required; do not overload canonical business evidence.
Tests: extend pure agent-intent/camera/runtime tests; add pure Adaptation Gate/disclosure tests; extend component Canvas tests; extend E2E interaction/visual/mobile/performance proof.
Docs: keep Issue #3 architecture/evidence under `job/docs`; no product architecture outside `job`.

## Sixteen ordered execution packages

WP01 — Current-truth lock: add RED characterization for existing chat-like seller placement, current camera limits and presentation gaps without changing behavior.
WP02 — Spatial action contract: extend the closed intent union with revision-aware semantic actions and fail-closed validation.
WP03 — Presentation state: introduce versioned non-canonical Presentation Plan/Revision separate from canonical evidence.
WP04 — UI Adaptation Gate: deterministic validation/catalog/evidence/disclosure/a11y/responsive resolution.
WP05 — Camera Director: semantic framing, user interruption, restore-view and mobile/reduced-motion policy.
WP06 — Spatial agent presence: move seller presence into Canvas while preserving narration/question/recovery semantics.
WP07 — Proof/value surfaces: materialize evidence, deterministic calculations, uncertainty and provenance as adaptive approved UI.
WP08 — Process/pipeline composition: strengthen graph grouping/relationship/flow presentation without arbitrary graph mutation.
WP09 — Protected demonstration: server-side disclosure state, revocation and safe preview behavior required by current experience.
WP10 — API pagination hardening: tenant/policy/disclosure-bound cursor semantics for any paginated protected presentation endpoint introduced/used.
WP11 — Objection/next-step orchestration: typed presentation patterns for compare, risk reduction, proof and next action without scripted fake persuasion.
WP12 — Desktop premium composition: continuous high-end spatial hierarchy, tokenized materials, transitions and visual proof.
WP13 — Mobile premium composition: mobile-native framing, touch navigation, agent placement, safe insets and performance.
WP14 — Observability/evals: non-sensitive orchestration telemetry and agent-quality evaluation hooks.
WP15 — E2E persuasive experience GAUNTLET: exercise full discovery → proof → objection → next-step flow with real browser visual inspection and interruption/accessibility attacks.
WP16 — Candidate convergence: full relevant verification, independent Critic, root-cause loop, candidate freeze and remote/provider proof required by the active Slice.

## Twenty-nine cumulative GAUNTLETs

G03-01 Authority/branch/base/issue binding; fail on wrong repo/branch/base or unauthorized scope.
G03-02 Existing-contract non-regression; fail on weakened Trust Kernel, revision, idempotency, corrections or deterministic calculation.
G03-03 Sole-provider integrity; fail on any alternate provider/model/fallback or leaked DEEPSEEK_API_KEY.
G03-04 Semantic-intent schema; fuzz unknown keys/actions, executable payloads, oversized arrays/text and duplicate ids.
G03-05 Spatial target integrity; reject missing, cross-tenant, stale, hidden or unauthorized target ids.
G03-06 Presentation revision races; attack stale action batches, concurrent user interaction and replay.
G03-07 UI Adaptation catalog; reject arbitrary components/models/tokens/URLs and catalog bypass.
G03-08 Evidence/provenance; every material commercial claim must resolve to canonical evidence/calculation/explicit uncertainty.
G03-09 Camera determinism; attack invalid targets, extreme graph bounds, repeated transitions and geometry churn.
G03-10 User-control priority; wheel, pan, pinch, pointer, keyboard and explicit navigation interrupt choreography safely.
G03-11 Reduced motion/focus; zero/limited motion, focus restoration, keyboard traversal and live-region behavior.
G03-12 Spatial-agent anti-chat regression; prove primary seller interaction lives in Canvas and remains usable without a fixed side-chat dependency.
G03-13 Pipeline semantics; reject dangling/duplicate/unsafe graph relations and misleading flow presentation.
G03-14 Disclosure minimum-data; inspect network/client state for forbidden protected payloads.
G03-15 Disclosure revocation; revoke entitlement/policy/session and prove client cannot continue reading stale protected content.
G03-16 Pagination/cursor authorization; attack page-boundary leakage, cursor replay, tenant switch and policy-revision change.
G03-17 Prompt injection/external-data; customer/external strings cannot become system/tool instructions.
G03-18 Tool broker; unknown tool, unsafe risk metadata, timeout, cancellation, approval and tenant-scope attacks fail closed.
G03-19 Harness confinement; explicit child environment, allowed plugin/tool set, no inherited secret spread, restart/session authority remains Vexryzer.
G03-20 Harness activation truth; no PASS from package presence/local mock; exact provider/model/account/deployment proof required.
G03-21 Attachment boundary; verify no attachment bytes/OCR/text/embeddings/screenshot-derived summaries reach DeepSeek.
G03-22 Desktop visual quality; real captures attacked for generic AI UI, dashboard fragmentation, hierarchy, clipping, contrast and motion excess.
G03-23 Mobile visual/interaction quality; touch, viewport, safe insets, readable agent presence, camera framing and no desktop-shrink artifact.
G03-24 Accessibility; keyboard-only, screen-reader semantics, contrast, target size, motion policy and focus-visible attacks.
G03-25 Performance; dense graph, long session, repeated choreography, memory, long tasks and measured responsiveness.
G03-26 Recovery/error truth; provider error, denied intent, stale revision, unavailable protected content and partial state recover deterministically.
G03-27 Persuasion integrity E2E; diagnose → prove → compare/simulate → objection → next step while every claim stays supported and user control remains primary.
G03-28 Independent Critic; attack product drift, genericness, security, tenancy, a11y, performance, unsupported persuasion and future-scope leakage.
G03-29 Candidate freeze/evidence; exact SHA only, all candidate-specific gates rerun after mutation, hosted/provider evidence attached where required.

## RED-first acceptance

Before implementation of each WP, add or identify a failing proof that demonstrates the missing behavior/risk; never manufacture failure by weakening existing expectations.
A gate turns green only from root-cause correction on the same contract.
Visual acceptance requires actual browser captures at representative desktop and mobile sizes and inspection against Issue #3; static DOM tests are insufficient.
Provider/Harness activation remains NOT_VERIFIED unless the exact environment proves it.
Issue #3 may be closed only after WP01–WP16 relevant current-slice work passes G03-01–G03-29 with no unresolved material Critic finding.
Slice VXA-S002 remains governed by GNT-VXA-S002-001 and is not COMPLETE merely because Issue #3 passes.
## Risk register

R1 scope explosion from source vision — controlled by four-way scope classification and WP boundaries.
R2 arbitrary generative UI — controlled by closed semantic intent + Adaptation Gate + catalogs.
R3 persuasive hallucination — controlled by canonical evidence/provenance and deterministic Value Engine.
R4 camera motion harms control/a11y — controlled by user priority, reduced motion, focus contract and mobile policy.
R5 protected-data leakage — controlled server-side, including revocation and pagination cursor binding.
R6 DeepSeek Harness preview maturity — broker boundary and NOT_VERIFIED activation until exact proof.
R7 React Flow performance under richer presentation — preserve architecture, measure before replacement, batch presentation updates.
R8 visual polish masks missing behavior — E2E persuasion and independent Critic remain hard gates.
R9 future artifact features violate attachment boundary — compatibility seams only; current data egress remains prohibited.
R10 chat-sidebar regression — spatial-agent anti-regression gate and visual/browser proof.

## Execution decision

Architecture planning is sufficiently grounded to enter ATTACK/RED preparation, not unconditional BUILD.
The next execution action is WP01 + WP02 RED definition against the exact current HEAD, followed by independent architecture critique.
No candidate is frozen. No Issue #3 PASS, Slice PASS, promotion or COMPLETE is claimed by this planning artifact.
## Independent architecture critique resolution

CRIT-01 — HIGH — The first reconstruction under-specified two semantics already authorized by the Slice: process mutation and scene composition.
Resolution: WP02 must model both as closed semantic operations. Process mutation is proposal-only until application validation proves graph invariants, evidence authority, revision and tenant scope. Scene composition selects approved regions/surfaces/catalog entries; it never means arbitrary layout code or unrestricted coordinates.

CRIT-02 — HIGH — The Slice requires current visual state to feed the next agent turn.
Resolution: Presentation/Canvas state must expose a bounded, data-minimized Visual Context Snapshot containing presentation revision, visible approved object ids, focused region/object, zoom band, user-interaction epoch, disclosure-safe surface states and recent choreography outcome. It must never serialize raw DOM, CSS, screenshots or protected payloads to DeepSeek.

CRIT-03 — HIGH — Historical GAUNTLET wording includes compatibility attacks for superseded providers/models.
Resolution: Founder-authorized DeepSeek single truth and VXA-ARCH-A004 supersede any historical multi-provider compatibility assumption. Equivalent structural attacks remain mandatory, but they apply only to the exact DeepSeek/deepseek-v4-pro/DeepSeek Harness tuple. No Mistral/OpenAI/Anthropic path may be revived to satisfy an old heading.

CRIT-04 — MEDIUM — Protected-demonstration architecture risks smuggling future entitlement commerce into S002.
Resolution: current Slice implements only disclosure enforcement necessary for surfaces actually exposed by S002. Generic entitlement/catalog interfaces are compatibility seams. Payment, account/portal and broad commercial entitlement systems remain FUTURE_SLICE_REQUIRED.

CRIT-05 — MEDIUM — Spatial persuasion could become scripted funnel behavior.
Resolution: WP11 may provide typed presentation primitives, never a fixed five-act state machine. The Seller chooses the truthful next move from canonical evidence + bounded visual context; no validator, scene enum or Critic policy may force a sales sequence.

CRIT-06 — MEDIUM — Camera/presentation revision must not compete with canonical session lease semantics.
Resolution: presentation revision is subordinate non-canonical state. Canonical session revision/lease remains authoritative; committing a presentation plan cannot advance or rewrite canonical evidence by itself.

These findings are resolved at planning level. Independent implementation critique remains required after BUILD and cannot be replaced by this architecture review.
