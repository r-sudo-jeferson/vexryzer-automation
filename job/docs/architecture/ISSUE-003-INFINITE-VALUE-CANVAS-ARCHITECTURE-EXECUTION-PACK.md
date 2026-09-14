# Issue #3 — Infinite Value Canvas Architecture + Execution Pack

STATUS: PLANNED / ARCHITECTURE_READY_FOR_EXECUTION_REVIEW
FORGE_BINDING_ID: FORGE-VEXRYZER-AUTOMATION-v1.0.0
REPOSITORY: r-sudo-jeferson/vexryzer-automation
BRANCH: staging/vxa-s002-agent-led-accounting-seller
PRODUCT_ROOT: job
SLICE: VXA-S002@1.0.0
GAUNTLET: GNT-VXA-S002-001
AUTHORIZED_BASE_SHA: 6244a246d8faf73e772fc944a398a71a02fb97e0
SOURCE_CODE_STATE_INSPECTED: d62887550d1a54d43df6cf95d60b2086f17c348f
FIRST_PACK_COMMIT: 79b6487ec5ae1bdafb75149440c49a2a882192f9
ISSUE: #3
SOURCE: job/docs/product/INFINITE-VALUE-CANVAS-ORCHESTRATOR.md
HANDOFF: job/docs/handoffs/ISSUE-003-INFINITE-VALUE-CANVAS-GAUNTLET.md

## 0. Candidate / SHA semantics (binding)

- `AUTHORIZED_BASE_SHA` (`6244a24…`, canonical 40-char form) is the Slice-authorized base. It never changes in this pack. Both `git rev-parse --verify` forms resolve to the identical commit object, but only the 40-char form byte-matches the binding GAUNTLET; the 41-char variant copied in the Slice contract and DeepSeek authorization is reported to the Founder for correction there (this pack does not edit higher-authority docs).
- `SOURCE_CODE_STATE_INSPECTED` (`d628875…`) is the source/code state inspected before first pack materialization. It is a provenance record, not an approval.
- `FIRST_PACK_COMMIT` (`79b6487…`) is the first pack commit and the current review-start state.
- Verified diff `d628875..79b6487`: exactly one file added — this architecture document (254 lines in that commit); no source, test, workflow, or runtime change. Source-code truth is therefore unchanged by the pack itself.
- This document MUST NOT contain its own final/corrected commit SHA as a requirement: requiring a document to embed the SHA of the commit that contains it is self-referential and unsatisfiable. The corrected candidate SHA is recorded by the review/freeeze process (WP16 / G03-29), not by a clause inside the reviewed text.
- G03-01 checks repository identity, branch, authorized base reachability, and current execution parent — never impossible self-SHA embedding.

## Continuity note

GPT Astra completed a planning pass in chat while the Desktop Commander plane was disconnected. The repository therefore contains the handoff but not the later Architecture + Execution Pack.
Recovered working context (unattested, not authority): the planning matrix reportedly converged to 29 cumulative GAUNTLETs and 16 execution packages; critique strengthened pagination/API semantics, typed spatial actions, disclosure revocation, and DeepSeek Harness activation boundaries.
The original labels of those chat-only items are not durably retrievable. This file materializes the continuation against repository truth without pretending that reconstructed labels are verbatim Astra output; nothing in this note authorizes any non-DeepSeek model or route.

## Current architecture truth

The implementation already has one canonical React/TypeScript Infinite Canvas based on @xyflow/react. It must be evolved in place; no parallel Vivarium/app/canvas architecture is authorized.
`src/canvas/domain.ts` owns validated process graph truth and must remain the deterministic graph boundary (node kinds: source, manual_action, transformation, system, output, evidence, effort, uncertainty, estimate, request_receipt; invariants reject duplicate/dangling/self-loop/duplicate-connection and invalid ids/labels/effort).
`src/canvas/camera.ts` already owns deterministic fit/focus planning and reduced-motion behavior. It is the seam for Camera Director, not a subsystem to replace. Current truth: `CameraMode = origin|process|focus`; `CameraPlan = fit-all|fit-nodes` with bounded padding/zoom/duration; `reducedMotion → durationMs 0`.
`src/experience/agent-intent.ts` already rejects executable surfaces and exposes the closed typed semantic action union (exactly 11 kinds): focus, compare, annotate, reveal, group, de_emphasize, quantify, demonstrate, explain_relationship, stage_artifact, request_workshop. It is the base protocol for spatial agent authority. No new model-visible wire action is authorized by default (see §Typed semantic UI intent).
`src/experience/experience-validation.ts` already bounds proposals (`processMutations` ≤ 16, scene id arrays ≤ 16) over closed keys. `src/experience/experience-projector.ts` + `src/experience/reactive-experience-state.ts` already own `basedOnRevision` / `projectionRevision` and `choreography.generation/intentKey`. There is no independent presentation revision (see §Revision/state model).
`src/ai/context/context-packager.ts` already owns `CurrentExperienceState` with enforced bounds (`VISUAL_ID_LIMIT` 32, `VISUAL_NODE_LIMIT` 48, label 120, kind 48, `RECENT_TURN_LIMIT` 12) plus closed `RECENT_TURN_KEYS`, token-budget accounting, and attachment-key rejection. There is no parallel Visual Context Snapshot (see §Visual context).
`src/server/ai/seller/seller-wire-tools.ts` exposes the agent-intent contract to the sole AI provider path while application code remains authoritative.
`src/server/session/agent-session.ts` (+ `ask-ai-http.ts`, `session-repository.ts`) already protects the anonymous visitor session tuple: sessionId + session token digest (SHA-256 hex) / Bearer token + leaseId + requestId + canonical/expected revision, with closed turn/correction keys, replay/idempotency, lease ownership, and completion semantics. S002 current authority is anonymous visitor session scope — there is no current tenant truth (see §Session authority).
The Trust Kernel, deterministic calculations (`src/ai/quant/`), canonical evidence, correction/reconciliation, and session/tool-authorizer boundaries are non-regression surfaces.
DeepSeek is the only authorized LLM truth. No alternate model/provider/fallback or client-side secret path may be introduced.
The current attachment boundary remains closed to customer attachment bytes, OCR, extracted text, embeddings, screenshot-derived content and attachment summaries sent to DeepSeek.
The current DeepSeek Harness direct activation remains NOT_VERIFIED until exact runtime/provider/environment evidence proves it; developer-preview SDK existence is not production activation evidence.

## Target architecture

One Living Canvas Runtime coordinates canonical graph state, approved presentation state, viewport/camera state, agent presence, transient choreography, disclosure state and user interaction priority.
The model never writes DOM, CSS, JSX, arbitrary coordinates, arbitrary component names, executable code or direct camera transforms.
The model emits semantic intents from the existing closed union. Deterministic application code validates identity, revision, evidence, disclosure, component/model/token catalog membership, accessibility constraints and responsive policy.
Approved intents are resolved into a Presentation Plan, then into existing Canvas nodes/surfaces and camera commands.
Canonical business truth and presentation truth remain separate. Presentation can be revoked or recomputed without mutating canonical evidence.
User navigation, keyboard focus, touch gestures, reduced-motion policy and explicit user interruption outrank agent choreography.
Camera motion is an explanation/persuasion primitive, never autonomous spectacle.
Deliberately leaving the Canvas unchanged is a valid, first-class outcome: when the strongest truthful move is narration/question/calculation without visual change, the runtime records a no-op presentation decision with provenance instead of forcing motion. No validator, scene enum, Critic policy, or WP may impose a fixed sales funnel or mandatory visual act.
The runtime MUST NOT do graph/camera work per streamed token. Streaming is transport only; application code applies one completed, validated semantic proposal per turn — never token-by-token UI mutation.

## Typed semantic UI intent

Extend the existing `AgentIntent`, never create a second protocol.
Spatial actions remain the closed discriminated union of exactly 11 kinds in `agent-intent.ts` (focus, compare, annotate, reveal, group, de_emphasize, quantify, demonstrate, explain_relationship, stage_artifact, request_workshop). Every action carries a stable id and is bounded by schema limits (`ACTION_KEYS` closed sets per kind).
`processMutations` and `sceneProposal` (with `focusIds`/`comparisonIds` ≤ 16) are the existing closed channels for process mutation and scene composition. Process mutation is proposal-only until application validation proves closed-key validation (`experience-validation.ts`), graph invariants (`domain.ts`), reference/stale-revision checks (`experience-projector.ts`), evidence authority, revision, and session authority. Scene composition selects approved regions/surfaces/catalog entries; it never means arbitrary layout code or unrestricted coordinates.
Concepts such as `frame_region`, `sequence_focus`, `present_comparison`, `surface_evidence`, `surface_value`, `present_next_step`, `restore_user_view` are INTERNAL projector/director commands derived from validated existing semantics — not new model-visible wire actions — unless RED evidence proves a new wire action is required and it passes the closed-union change bar (schema, validation, projector, tests, catalog, GAUNTLET update).
Each action resolves targets by canonical object ids or approved region ids. Unknown or stale targets fail closed.
An action must include the expected canonical revision before application; stale actions are rejected rather than replayed against a changed Canvas (projector `basedOnRevision` / reference checks).
Action application is transactional at the presentation layer: validate whole action batch, resolve catalog entries, then publish one `projectionRevision`.
The semantic protocol must preserve provenance/evidence references for every commercial claim surfaced in UI.
No action may directly reveal protected payloads; it can only request a disclosure transition that the WP09 server-side Disclosure Gate authorizes once built — no disclosure-enforcement module exists in current code, so WP09 RED must first prove that absence.

## Revision/state model

There is NO independent presentation revision. The single model is: authoritative canonical revision + `ReactiveExperienceState.basedOnRevision` / `projectionRevision` + `choreography.generation` / `intentKey` / camera target ids / interrupted flag.
Atomic flow per turn: validate proposal against the canonical revision → resolve references/catalog/policies → project once → increment `projectionRevision` exactly once → derive/render passive presentation.
Canonical revision/lease remains authoritative; committing a presentation plan cannot advance or rewrite canonical evidence by itself, and projection never mutates canonical evidence.
Replay/rollback/stale behavior reuses existing projector/session invariants: canonical rollback is rejected (`REVISION_ROLLBACK`); stale batches fail closed; correction history drives dependency invalidation; camera/choreography identity is `choreography.generation` + `intentKey`, never a parallel revision counter.

## Visual context

There is NO parallel unbounded Visual Context Snapshot. Visual context extends/reuses `CurrentExperienceState` in `context-packager.ts` and feeds the next seller turn.
Preserved bounds (hard): visual ids 32, visual nodes 48, node label 120 chars, node kind 48 chars, recent turns 12, closed `RECENT_TURN_KEYS`, token-budget accounting, attachment-key rejection (`attachment|file|document|ocr|embedding|upload|byte|blob`); never raw DOM/CSS/screenshots/protected payloads/attachment content.
If zoom band, user-interaction epoch, or choreography outcome are surfaced, they MUST be bounded/minimized enumerations packaged server-side (never raw viewport coordinates, CSS, screenshots, or protected payloads) and bound to the next seller turn only.

## UI Adaptation Gate

Flow: MODEL INTENT → SCHEMA VALIDATION → REVISION CHECK → TARGET RESOLUTION → EVIDENCE CHECK → DISCLOSURE → SESSION-AUTHORITY CHECK → COMPONENT/MODEL/TOKEN CATALOG → A11Y/RESPONSIVE POLICY → PRESENTATION PLAN → RENDER.
Reject unknown keys, unknown action kinds, executable text, unauthorized components, arbitrary tokens, unsafe URLs, missing evidence, stale revisions and disclosure escalation.
Exact module mapping: `src/experience/artifact-registry.ts` (surface catalog) + `src/experience/experience-validation.ts` (closed keys/limits) + `src/experience/experience-projector.ts` (reference/stale checks, single projection increment) + `src/canvas/reactive-graph-adapter.ts` (graph adaptation) + `src/design/tokens.css` (token truth) + `src/canvas/nodes/*.css` and app surfaces (rendering only, never authority).
Catalog resolution is explicit and versioned. New visual primitives require code review and tests; the agent can compose but cannot invent executable production components. No arbitrary component/model/token/URL escape; catalog bypass is a RED case with rejection-reason telemetry.
The Gate records non-sensitive rejection reason codes from a fixed taxonomy (unknown-kind, unknown-key, stale-revision, missing-evidence, disclosure-denied, catalog-miss, unsafe-url, a11y-violation, responsive-violation) for evaluation and debugging without logging private customer content. New-component request telemetry (catalog gap rate, UI model reuse rate) is instrumented from WP01 hooks, not invented in WP14.

## Camera Director

`camera.ts` remains the deterministic planner; the Director is application-owned semantic resolution OVER the current planner, never direct model coordinates.
Backward compatibility is mandatory: `CameraMode origin|process|focus` and `fit-all|fit-nodes` plans keep their current contract; the Director maps narrative intent (focus object, frame region, compare targets, reveal sequence, process overview, origin reset, restore prior user view, guided transition) onto `createCameraPlan` inputs.
Interruption matrix (any of these cancels or yields non-essential choreography immediately, and marks `choreography.interrupted`): mouse move/click, pointer down, touch start, wheel, pinch, keydown, explicit navigation (route/pan/zoom command), focus change to a user control.
Focus contract: programmatic focus synchronizes visual framing with accessible focus, restores the prior user view on demand, and never traps keyboard users.
Reduced motion: `reducedMotion → durationMs 0`; one duration-policy owner (the Director; `camera.ts` stays the single geometry/duration computer — no second duration source).
Bounds: zoom stays within plan `minZoom/maxZoom`, padding within plan policy, durations within the current 360/460/520 ms family unless measurement justifies change.
Mobile framing is a distinct policy (viewport, safe insets, touch reachability, condensed agent placement, shorter/zero-motion defaults) — never a desktop viewport scaled down, never only a column-count change.

## Agent presence

The seller is a spatial participant hosted/contextualized in the Canvas, not a persistent side-chat panel. "Primary in Canvas" means the Canvas is the primary interaction surface; it does NOT authorize deletion of the reachable composer capability — the composer (input, corrections, reset, recovery, live regions) remains reachable by keyboard and touch.
Non-regression matrix (AskAiPanel / App / app-machine / ask-ai-client, all preserved): IME/composition handling in the composer; 4000-char input limit (`maxLength={4000}`); error/recovery messaging; correction proposal apply flow (`correctionId` validation, session/request binding); artifact presentation (proposal statuses `conceptual|prototype` with `truthStatus active|invalidated`; truthful phase-only progress, never fabricated percentages); machine `agentStatus idle|requesting|correcting|awaiting_user|recovery|error`; verified-calculation status `valid|invalidated`; session reset (`ASK_SESSION_RESET`/`resetAgent`); `aria-live="polite" aria-atomic` response region; keyboard traversal with no traps; touch reachability and target sizes.
Narration, evidence, question and next action remain readable without motion dependency.
The agent cannot occlude the currently focused user control, hide required evidence or steal focus while the user is interacting.
Deterministic guided recovery is preserved: provider/Harness failure, denied intent, stale revision, or unavailable protected content returns the user to a usable, truthful state with canonical/session state intact — never a dead end, never a provider switch.

## Visual system

Target language: continuous machined-metal Canvas, physically legible relief, recessed/raised surfaces, selective optical glass, controlled specular depth, premium typography and restrained high-value motion.
Neumorphism/glass/2.5D are techniques, not decoration quotas. Every depth cue must improve hierarchy, affordance or focus.
No generic AI gradient dashboard, floating-chat shell, card-grid dashboard, excessive glow, ornamental 3D mesh or cinematic motion detached from information. "Objects" are UI/UX objects and interaction surfaces (cards, nodes, connectors, panels, proof blocks, metrics, charts, simulations, forms, timelines, process maps, CTAs, executive surfaces, protected previews) — never 3D meshes or generated 3D assets.
Desktop and mobile are separately composed experiences over the same contracts.
The Canvas must visibly make proof, process, value, objection handling and next action feel spatially related.

## Disclosure and protected demonstration

Design-seam disclosure vocabulary to be built in WP09 (handoff §H: `Define server-side disclosure enforcement for:`): PUBLIC, DEMO, PARTIAL, LOCKED, ENTITLED, INTERNAL. No disclosure-state machine exists in current code (verified: zero disclosure tokens in `job/src`); none of the six states is currently populated, so every state beyond actually-presented demo minimum-data is a compatibility-seam value only with no current producer, engine, or endpoint.
Disclosure is monotonic only within one authorized request once the gate lands. A later session-authority change, asset sensitivity change or policy decision can revoke previously presented access.
Revocation must invalidate presentation state and remove protected payload availability; hiding with CSS is never sufficient.
Client receives only the minimum fields authorized for the exact presentation. Locked previews receive safe derived metadata/placeholders, never the secret payload.
No runtime entitlement/disclosure/pagination subsystem is CURRENT_SLICE_REQUIRED: S002 has no proven paginated protected surface, no pricing/account/portal/entitlement engine. Server-side minimum-data/prototype-truth/disclosure concepts survive only as compatibility/design seams where the current experience needs them.
WP09 is a boundary/seam package: it protects current prototype/demo truth and minimum-data behavior actually presented by S002 — never a pricing/account/portal/entitlement engine.
WP10 is an explicit boundary disposition: no paginated protected endpoint exists in current code, so cursor implementation is NOT_APPLICABLE to the current tree / FUTURE_SLICE_REQUIRED until separately authorized. The pack-defined pagination/cursor attack (page-boundary leakage, cursor replay, authority switch, policy-revision change; cursors opaque, authority-bound, invalidated on authorization/disclosure revision change) is held as deferred — never silently deleted. It is pack-original, not binding-GAUNTLET provenance: the incorporated GAUNTLET proposal contains no pagination/cursor attack.

## DeepSeek Harness boundary

The official Harness/SDK remains behind a server-side broker boundary.
The broker owns environment construction, allowed tools, timeout, cancellation, session mapping, error normalization and audit metadata.
`DEEPSEEK_API_KEY` is server-only and never inherited implicitly into arbitrary child/tool environments.
Developer-preview package availability is not evidence of production suitability. Activation remains gated until the exact pinned version, provider/model/account, confinement, restart/session behavior and target deployment environment pass.
The Harness is non-canonical memory; Vexryzer canonical session/evidence state remains authoritative after restart.
No shell/filesystem/code-runtime/attachment content capability becomes production-authorized merely because the Harness exposes it.
The Harness activation gate (G03-20) is expanded into the explicit Slice-mandatory sub-gates (each must pass on the exact Founder account + exact candidate + target deployment; default for every sub-gate is NOT_VERIFIED): (a) access through `DEEPSEEK_API_KEY` without exposing the value; (b) exact model `deepseek-flash`; (c) streaming; (d) structured tool calling; (e) multi-tool continuation; (f) multi-turn continuation; (g) correct tool-result replay; (h) durable session identity; (i) process restart/session recovery; (j) timeout/cancellation/error mapping; (k) bounded diagnostics with no secret leakage; (l) context/token behavior; (m) accounting-native seller quality; (n) persuasive use of deterministic calculations; (o) semantic Canvas tool execution; (p) deterministic recovery on route failure.
Binding: `src/ai/providers/provider-registry.ts` (single `deepseek-flash-agent` route), `src/server/ai/harness/deepseek-harness-official-contract.ts`, `src/server/ai/providers/deepseek-chat-wire.ts`, `src/server/ai/harness/deepseek-harness-visitor-policy.ts`, `src/server/ai/harness/deepseek-harness-tool-authorizer.ts`, `src/server/ai/harness/deepseek-harness-session-store.ts`, `src/server/session/*` (session/runtime authority).

## Session authority (current scope)

S002 current authority is anonymous visitor session scope. There is NO current tenant truth: no tenant claim appears in the Slice contract, authorizations, session records, or canonical context (`createCanonicalSalesContext({ sessionId })`).
The current authorization tuple is sessionId + session token digest / Bearer token + leaseId + requestId + canonicalRevision, enforced through the existing session and tool-authorizer paths (`agent-session.ts` lease/request/replay rules, `ask-ai-http.ts` Bearer parse + closed turn/correction keys, `session-repository.ts`, `deepseek-harness-tool-authorizer.ts`).
Security attacks therefore target cross-session / cross-authority confusion, never cross-tenant leakage: session-id guessing, Bearer token substitution, leaseId confusion, requestId replay, expected/canonical revision confusion, stale-lease commit, unauthorized target/session ids in spatial actions and cursors.
Multi-tenancy is future compatibility only: designs must not preclude it (authority-scoped ids, server-side checks, opaque cursors), but S002 implements and claims nothing tenant-shaped unless separately authorized.

## Workshop / prototype disposition (binding GAUNTLET preserved)

The incorporated GAUNTLET proposal (`GNT-VXA-S002-001.PROPOSED.md`, blob `d79ca6f…`) remains fully binding. No Workshop security/latency or prototype-truth attack is silently dropped.
Live Workshop is FUTURE_SLICE_REQUIRED / NOT_VERIFIED under the current boundary: it cannot be enabled in production merely because filesystem confinement passes; real execution/egress isolation, cleanup, and latency/fallback behavior are unproven, and production placement is outside the authorized Slice.
Disposition matrix: attacks requiring live execution (repository read, path escape, traversal, symlink escape, environment read, out-of-workspace execution, arbitrary package install, arbitrary network/cloud-metadata contact, post-cleanup persistence, surviving background processes, executable-artifact return, script smuggling, oversized/malformed artifacts, secret-like output, shell timeout/cancel, crash-during-cleanup; latency/fallback sequences immediate success / 1–2 s / 3–8 s / over-budget / timeout / crash / invalid artifact / Critic rejection / duplicate artifact event / stale completion after direction change / completion after browser disconnect/reconnect) remain NOT_VERIFIED/deferred with fast-path ASK AI as the production-safe path.
Current-slice truth attacks apply in full now: no fake progress or fabricated percentages; no production wording for prototype; no misleading synthetic success data; no implied completed integration; no unsupported ROI; no hidden uncertainty; no same-origin arbitrary generated JS; no generated code receiving user state/credentials without explicit need/authorization.
Historical Mistral wording is superseded by DeepSeek-only authority (`VXA-ARCH-A004` + DeepSeek single-truth authorization revoke prior multi-provider assumptions), but every equivalent structural compatibility attack now applies to the exact DeepSeek / `deepseek-flash` / DeepSeek Harness `0.1.5-rc.2` tuple. Explicit preflight disposition: the binding proposal's "exact Mistral model/provider route used for real-provider checks" bullet is SUPERSEDED/PROHIBITED — Mistral-route evidence must never be produced; real-provider proof is the exact DeepSeek tuple under G03-20 only.

## Performance

Keep React Flow and current virtualization/rendering architecture unless measurement proves a blocking limit.
Separate canonical state updates from high-frequency viewport/pointer state so camera motion does not re-render business state.
Batch semantic action application into one projection increment (`projectionRevision`).
Binding budgets (`src/performance/budgets.ts` `PERFORMANCE_BUDGETS`): LCP 2500 ms, INP 200 ms, CLS 0.1, long task 50 ms. G03-25 measures dense graphs, long sessions, repeated choreography, mobile memory pressure, long tasks, and p75/p95 responsiveness against these budgets — no invented targets.
Test dense graphs, rapid zoom/pan, repeated agent choreography, mobile memory pressure and long sessions.
Animation must degrade gracefully under reduced motion and constrained devices.

## Accessibility

Every meaningful UI object has accessible name/role/state independent of visual depth.
All agent-driven reveal/focus operations have deterministic keyboard equivalents and do not create focus traps; focus is restored after choreography.
Announcements distinguish narration, state change and action result without flooding live regions (`aria-live="polite"`, atomic response region).
Color/lighting never carry the only meaning; focus visibility and text contrast remain valid across Silver/Space Black presentation variants.
Touch targets, pinch/scroll behavior, safe viewport insets, and mobile framing are verified on device sizes — mobile is a distinct composition, not a scaled desktop.

## Observability and evaluation

Capture non-sensitive events for semantic intent accepted/rejected, action kind, camera interruption, catalog miss, disclosure denial/revocation, stale revision, tool failure, agent retry, human override and recovery. Telemetry avoids raw prompts, attachment contents, secret values, and protected commercial payloads.
Measure time-to-first-insight, time-to-first-wow, evidence completeness, UI model reuse, catalog gap rate, conversion-state transition, realized-vs-estimated value and accessibility/interaction errors.
Agent quality evaluation weights factual support, evidence completeness, safe tool use, useful spatial orchestration and calibrated persuasion; conversion alone cannot define quality.
Instrumentation hooks begin in WP01 (baseline) and every WP emits its evidence; WP14 consolidates observability/evals/performance evidence — it does not first introduce instrumentation.

## Scope classification

CURRENT_SLICE_REQUIRED: living Canvas presentation layer; spatial agent presence; typed semantic actions over the existing closed union; deterministic Camera Director over `camera.ts`; UI Adaptation Gate; evidence-backed proof/value surfaces; pipeline/process visualization; desktop/mobile/a11y behavior; disclosure enforcement required by data actually presented; no-op/leave-unchanged semantics; tests/visual/E2E proof.
CURRENT_SLICE_COMPATIBILITY_SEAM: versioned UI model/component/token catalogs; protected-demo state machine; generic tool-broker metadata; lifecycle mode identifiers; telemetry fields needed for later expansion; minimum-data/prototype-truth/disclosure seams; future-pagination cursor shape (undefined behavior until authorized).
FUTURE_SLICE_REQUIRED: full artifact intake/parsing/OCR; BusinessAsset extraction; arbitrary BI generation from customer files; live execution Workshop; enterprise operational twin; role twins; implementation/operations lifecycle modules; broad entitlement commerce; paginated protected endpoints with cursor authorization; multi-tenancy.
PROHIBITED_BY_CURRENT_BOUNDARY (Slice §boundary + authorizations, complete): alternate LLMs/fallbacks/standby/emergency models; customer attachment content sent to DeepSeek; arbitrary model-generated DOM/JS/CSS/JSX; direct arbitrary shell/filesystem execution; client-side-only secrecy; uncontrolled 3D asset/model generation; hidden paid fallback; S003 pricing implementation; real evidence uploads; durable request sealing; notification delivery; payment; account/portal functionality; unrestricted visitor code execution; LLM ingestion of customer attachments.

## Exact module/file change map

Preserve/extend: `src/experience/agent-intent.ts` (closed 11-kind union, quantitative-opportunity + missingInputs, no new wire kinds by default).
Preserve/extend: `src/canvas/camera.ts` (deterministic Director planning, interruption-safe semantic commands, single duration/geometry owner).
Preserve/extend: `src/canvas/domain.ts` only when new approved UI object semantics genuinely belong to canonical process graph truth (graph invariants stay the mutation gate).
Preserve/extend: `src/experience/experience-validation.ts` (closed keys, processMutations ≤ 16, scene id arrays ≤ 16) and `src/experience/experience-projector.ts` + `src/experience/reactive-experience-state.ts` (basedOnRevision/projectionRevision, choreography.generation/intentKey, single-increment atomic projection).
Preserve/extend: `src/experience/accepted-experience-transaction.ts` (transactional apply), `src/experience/artifact-registry.ts` (surface catalog), `src/canvas/reactive-graph-adapter.ts` (graph adaptation).
Preserve/extend: `src/app/app-machine.ts`, `src/app/App.tsx`, `src/app/AskAiPanel.tsx` (composer, corrections, reset, live regions — reachable, never deleted), `src/app/ask-ai-client.ts` (closed keys, correction binding).
Preserve/extend: `src/ai/context/context-packager.ts` (CurrentExperienceState visual bounds, recent-turn 12, token accounting, attachment rejection), `src/ai/context/token-budget.ts`, `src/ai/context/canonical-sales-context.ts`.
Preserve/extend: `src/canvas/AutomationCanvas.tsx` (consume approved presentation plan, spatial presence, Director commands; rendering stays passive), `src/canvas/layout.ts`, `src/canvas/semantic-zoom.ts`, `src/canvas/nodes/*`, `src/canvas/canvas.css`, `src/canvas/nodes/nodes.css`.
Preserve/extend: `src/ai/seller/seller-contract.ts` (material-claim + calculation-request validation; quantitativeOpportunity + missingInputs live in `agent-intent.ts`, no fixed funnel), `src/server/ai/seller/seller-wire-tools.ts` (final closed semantic schema only), `src/server/ai/seller/seller-turn-runtime.ts` + `src/server/ai/agent/agent-led-turn-runtime.ts` (validate/commit approved revisions without making presentation canonical).
Preserve/extend: `src/ai/critic/hard-blocks.ts` (8 hard blocks), `src/ai/critic/critic-contract.ts`, `src/server/ai/critic/critic-turn-runtime.ts`, `src/server/ai/critic/critic-wire-tools.ts`.
Preserve/extend: `src/ai/providers/provider-registry.ts` (single deepseek route), `src/ai/providers/provider-router.ts`, `src/ai/providers/provider-dispatch.ts`, `src/server/ai/providers/deepseek-chat-wire.ts`, `src/server/ai/harness/deepseek-harness-official-contract.ts`, `src/server/ai/harness/deepseek-harness-visitor-policy.ts`, `src/server/ai/harness/deepseek-harness-tool-authorizer.ts`, `src/server/ai/harness/deepseek-harness-session-store.ts`.
Preserve/extend: `src/server/session/agent-session.ts`, `src/server/session/session-repository.ts`, `src/server/session/stored-agent-turn-service.ts`, `src/server/session/stored-user-correction-service.ts`, `src/server/session/ask-ai-http.ts`, `src/server/netlify/ask-ai-netlify-runtime.ts` (session authority, persistence, correction invalidation).
Preserve/extend: `src/design/tokens.css`, `src/design/global.css` (token truth), `src/performance/budgets.ts` (LCP 2500 / INP 200 / CLS 0.1 / long task 50).
Tests: extend pure suites (`agent-intent`, `camera`, `domain`, `context-packager`, `deepseek-*`, `critic-*`, `agent-session`, `ask-ai-*` node tests); add pure Adaptation Gate/disclosure tests; extend component Canvas tests; extend E2E (`ask-ai`, `canvas-interactions`, `focus-autopan`, `accessibility`, `performance`, `security-runtime` specs) plus visual/mobile suites with real captures.
Docs: keep Issue #3 architecture/evidence under `job/docs`; no product architecture outside `job`.

## Sixteen ordered execution packages

WP01 — Current-truth lock + RED + baseline observability hooks: RED characterization for existing chat-like seller placement, current camera limits, and presentation gaps without behavior change; install non-sensitive instrumentation hooks every later WP uses.
WP02 — Semantic proposal/action contract: fail-closed validation over the existing closed intent union + processMutations/sceneProposal; internal projector/director commands only; no new wire kinds without RED proof.
WP03 — Reactive projection/revision + bounded visual context: atomic validate→resolve→project-once→single-increment flow; extend `CurrentExperienceState` within existing bounds; server-packaged minimized visual context for the next seller turn.
WP04 — UI Adaptation Gate/catalog/rejection telemetry: deterministic resolution pipeline, versioned catalogs, fixed rejection taxonomy, catalog-bypass RED, gap telemetry.
WP05 — Camera Director: semantic resolution over `camera.ts`, interruption matrix, focus restoration/no-trap, reduced-motion zero-duration, single duration owner, mobile framing policy.
WP06 — Spatial seller presence: host seller presence in Canvas; preserve composer/corrections/reset/live-region non-regression matrix and deterministic guided recovery.
WP07 — Evidence/proof/value surfaces: materialize evidence, deterministic calculations with provenance/uncertainty, quantitativeOpportunity+missingInputs behavior, no invented numbers.
WP08 — Process/pipeline composition: strengthen grouping/relationship/flow presentation through `domain.ts` invariants; reject dangling/duplicate/unsafe relations and misleading flow.
WP09 — Prototype/protected-demo/current minimum-data boundary + Workshop disposition: protect actually-presented demo truth and minimum-data behavior; record live-Workshop and entitlement-commerce deferrals; no pricing/account/portal engine.
WP10 — Concurrency/recovery + future pagination/cursor boundary disposition: full race/replay/cancellation matrix on current paths; explicit NOT_APPLICABLE/FUTURE disposition for paginated protected cursors with the pack-defined attack held as deferred.
WP11 — Persuasive objection/next-step orchestration without fixed funnel: typed presentation primitives (compare, risk reduction, proof, next action); seller chooses the truthful next move; manual-effort/volume/waiting/closing-pressure/capacity/recurring-burden/rework dimensions preserved; no scripted sequence.
WP12 — Desktop premium composition: continuous high-end spatial hierarchy, tokenized materials, transitions, visual proof with real captures.
WP13 — Mobile premium composition: mobile-native framing, touch navigation, agent placement, safe insets, performance within budgets.
WP14 — Consolidation of observability/evals/performance evidence: gather WP01–WP13 hooks into eval dashboards and performance reports (instrumentation began in WP01).
WP15 — Full persuasive E2E GAUNTLET + visual/a11y/perf attacks: discovery → proof → objection → next-step with real browser inspection, interruption/accessibility attacks, prototype-truth attacks.
WP16 — Convergence/candidate freeze/remote-provider proof: full relevant verification, independent Critic loop, root-cause correction, candidate freeze with exact SHA, hosted/provider evidence where required.

## Twenty-nine cumulative GAUNTLETs

G03-01 Authority/branch/base/issue binding; fail on wrong repo/branch/authorized base/execution parent or unauthorized scope. Never requires self-SHA embedding.
G03-02 Existing-contract non-regression; fail on weakened Trust Kernel, revision, idempotency, corrections/correction-invalidation, deterministic calculation, or provenance.
G03-03 Sole-provider integrity; fail on any alternate provider/model/fallback or leaked DEEPSEEK_API_KEY.
G03-04 Semantic-intent schema; fuzz unknown keys/actions, executable payloads, oversized arrays/text and duplicate ids against the closed 11-kind union.
G03-05 Spatial target integrity; reject missing, cross-session/cross-authority, stale, hidden or unauthorized target ids (no tenant truth claimed).
G03-06 Projection/revision races; attack double submit, retry-after-timeout, out-of-order events, correction-while-inflight, stale Critic verdict, stale scene after graph revision, duplicate terminal event, reconnect replay, cancellation before/after tool dispatch, new request while a prior Workshop runs, and Workshop-completion-after-state-change (the two Workshop items deferred/NOT_VERIFIED while live Workshop is absent). Bind each to canonical lease, reactive projection, choreography, and Critic proposal binding.
G03-07 UI Adaptation catalog; reject arbitrary components/models/tokens/URLs and catalog bypass; check versioning, token resolution, rejection taxonomy, and gap telemetry.
G03-08 Evidence/provenance; every material commercial claim must resolve to canonical evidence/calculation/explicit uncertainty; quantitativeOpportunity without numeric evidence must carry missingInputs and never invent numbers.
G03-09 Camera determinism; attack invalid targets, extreme graph bounds, repeated transitions and geometry churn within bounded zoom/padding/duration.
G03-10 User-control priority; wheel, pan, pinch, pointer, keyboard and explicit navigation interrupt choreography safely per the interruption matrix.
G03-11 Reduced motion/focus; zero/limited motion, focus restoration, keyboard traversal and live-region behavior; no traps.
G03-12 Spatial-agent anti-chat regression; prove primary seller interaction lives in Canvas and remains usable without a fixed side-chat dependency, with the composer/corrections/reset matrix intact.
G03-13 Pipeline semantics; reject dangling/duplicate/unsafe graph relations and misleading flow presentation via `domain.ts` invariants.
G03-14 Disclosure minimum-data; inspect network/client state for forbidden protected payloads on actually-presented surfaces. WP09 RED first proves the current absence of protected payloads there; a vacuous pass requires that absence evidence, never an assumption.
G03-15 Disclosure revocation; revoke session-authority/policy/sensitivity and prove client cannot continue reading stale protected content — validated once the Disclosure Gate lands; until then NOT_APPLICABLE/deferred with RED.
G03-16 Pagination/cursor authorization (pack-defined deferred attack, not binding-GAUNTLET provenance); attack page-boundary leakage, cursor replay, authority switch and policy-revision change — deferred/NOT_VERIFIED until an authorized paginated protected endpoint exists; never silently deleted.
G03-17 Prompt injection/system boundary; attack "ignore previous instructions", system/developer prompt reveal, environment-variable print, API-key exposure, malicious process-description content, quoted email/file-like injection, unauthorized-tool instruction, repository-path access, Critic/validation disable, prototype-as-production labeling, tool-result indirect injection, and repeated attempts after refusal. Policy never relies on prompt obedience.
G03-18 Tool broker; unknown tool, unsafe risk metadata, timeout, cancellation, approval and session-authority-scope attacks fail closed. Layer ownership: the broker proposes/enforces policy; the Harness surface below only confines execution.
G03-19 Harness confinement; explicit child environment, allowed plugin/tool set, no inherited secret spread, restart/session authority remains Vexryzer. Layer ownership: runtime confinement of an already-authorized tool call — never policy itself.
G03-20 Harness activation truth; no PASS from package presence/local mock; the 16 Slice-mandatory sub-gates (§DeepSeek Harness boundary) must each pass on the exact Founder account + candidate + target deployment; default NOT_VERIFIED.
G03-21 Attachment boundary; verify no attachment bytes/OCR/text/embeddings/screenshot-derived summaries reach DeepSeek.
G03-22 Desktop visual quality; real captures attacked for generic AI UI, dashboard fragmentation, hierarchy, clipping, contrast, motion excess against `tokens.css`/node CSS; anti-generic criteria explicit.
G03-23 Mobile visual/interaction quality; touch targets, viewport, safe insets, readable agent presence, distinct mobile camera framing, no desktop-shrink artifact.
G03-24 Accessibility; keyboard-only, screen-reader semantics, contrast, target size, motion policy and focus-visible attacks.
G03-25 Performance; dense graph, long session, repeated choreography, memory, long tasks and measured responsiveness against PERFORMANCE_BUDGETS (LCP 2500, INP 200, CLS 0.1, long task 50); p75/p95 recorded.
G03-26 Recovery/error truth; provider error, denied intent, stale revision, unavailable protected content and partial state recover deterministically with canonical/session state intact.
G03-27 Persuasion integrity E2E; diagnose → prove → compare/simulate → objection → next step while every claim stays supported (8 hard blocks: UNSUPPORTED_NUMERIC_CLAIM, FORGED_CONFIRMATION, AUTHORITATIVE_PRICE_OR_DISCOUNT, UNSUPPORTED_FEASIBILITY, ATTACHMENT_ACCESS_CLAIM, SECRET_OR_TOOL_ESCALATION, PRODUCTION_PROTOTYPE_CONFUSION, FREE_IMPLEMENTATION_SUBSTITUTION), quantitativeOpportunity missing-input behavior holds, deterministic calculations stay authoritative, and no fixed funnel exists in validators, scenes, prompts, routing, or Critic policy.
G03-28 Independent Critic; attack product drift, genericness, security, session-authority gaps, a11y, performance, unsupported persuasion and future-scope leakage.
G03-29 Candidate freeze/evidence; exact SHA only, all candidate-specific gates rerun after mutation, hosted/provider evidence attached where required. Overlap with foundation evidence-integrity is deliberate candidate-freeze proof, not a substitute.

Additional risk coverage (no new top-level gates; the count stays 29): deployment target (Netlify Free) and license review for any new dependency; Content-Security-Policy posture for Canvas/generated surfaces; telemetry privacy (no raw prompts/attachments/secrets/protected payloads); prototype-truth wording review; cost controls (Founder-authorized prepaid balance only — no auto-recharge, auto-upgrade, uncontrolled overage, or hidden paid route).

## RED-first acceptance

Before implementation of each WP, add or identify a failing proof that demonstrates the missing behavior/risk; never manufacture failure by weakening existing expectations.
A gate turns green only from root-cause correction on the same contract.
Visual acceptance requires actual browser captures at representative desktop and mobile sizes and inspection against Issue #3; static DOM tests are insufficient.
Provider/Harness activation remains NOT_VERIFIED unless the exact environment proves it.
No graph/camera work per streamed token: streaming transport is never UI-application evidence.
Issue #3 may be closed only after WP01–WP16 relevant current-slice work passes G03-01–G03-29 with no unresolved material Critic finding.
Slice VXA-S002 remains governed by GNT-VXA-S002-001 and is not COMPLETE merely because Issue #3 passes.
## Risk register

R1 scope explosion from source vision — controlled by four-way scope classification and WP boundaries.
R2 arbitrary generative UI — controlled by closed semantic intent + Adaptation Gate + catalogs.
R3 persuasive hallucination — controlled by canonical evidence/provenance and deterministic Value Engine.
R4 camera motion harms control/a11y — controlled by user priority, reduced motion, focus contract and mobile policy.
R5 protected-data leakage — controlled server-side, including revocation and deferred-pagination attack preservation.
R6 DeepSeek Harness preview maturity — broker boundary and NOT_VERIFIED activation until exact proof.
R7 React Flow performance under richer presentation — preserve architecture, measure before replacement, batch presentation updates.
R8 visual polish masks missing behavior — E2E persuasion and independent Critic remain hard gates.
R9 future artifact features violate attachment boundary — compatibility seams only; current data egress remains prohibited.
R10 chat-sidebar regression — spatial-agent anti-regression gate and visual/browser proof.
R11 session-authority confusion — controlled by sessionId/token-digest/lease/requestId/revision tuple with cross-session attack coverage.
R12 deployment/license/CSP/telemetry drift — controlled by Netlify Free target, license review, CSP posture, and telemetry-privacy gates.

## Execution decision

Architecture planning is sufficiently grounded to enter ATTACK/RED preparation, not unconditional BUILD.
The next execution action is WP01 + WP02 RED definition against the exact current HEAD, followed by independent architecture critique.
No candidate is frozen. No Issue #3 PASS, Slice PASS, promotion or COMPLETE is claimed by this planning artifact.
## Independent architecture critique resolution

CRIT-01 — HIGH — The first reconstruction under-specified two semantics already authorized by the Slice: process mutation and scene composition.
Resolution: WP02 must model both as closed semantic operations. Process mutation is proposal-only until application validation proves graph invariants, evidence authority, revision and session authority. Scene composition selects approved regions/surfaces/catalog entries; it never means arbitrary layout code or unrestricted coordinates.

CRIT-02 — HIGH — The Slice requires current visual state to feed the next agent turn.
Resolution: visual context extends `CurrentExperienceState` in `context-packager.ts` within existing bounds (ids 32, nodes 48, turns 12, token accounting, attachment-key rejection). It must never serialize raw DOM, CSS, screenshots or protected payloads to DeepSeek.

CRIT-03 — HIGH — Historical GAUNTLET wording includes compatibility attacks for superseded providers/models.
Resolution: Founder-authorized DeepSeek single truth and VXA-ARCH-A004 supersede any historical multi-provider compatibility assumption. Equivalent structural attacks remain mandatory, but they apply only to the exact DeepSeek/deepseek-flash/DeepSeek Harness tuple. No Mistral/OpenAI/Anthropic path may be revived to satisfy an old heading.

CRIT-04 — MEDIUM — Protected-demonstration architecture risks smuggling future entitlement commerce into S002.
Resolution: current Slice implements only disclosure enforcement necessary for surfaces actually exposed by S002 (WP09 boundary/seam). Generic entitlement/catalog interfaces are compatibility seams; pagination cursors are NOT_APPLICABLE/FUTURE. Payment, account/portal and broad commercial entitlement systems remain FUTURE_SLICE_REQUIRED.

CRIT-05 — MEDIUM — Spatial persuasion could become scripted funnel behavior.
Resolution: WP11 may provide typed presentation primitives, never a fixed five-act state machine. The Seller chooses the truthful next move from canonical evidence + bounded visual context; no validator, scene enum or Critic policy may force a sales sequence.

CRIT-06 — MEDIUM — Camera/presentation revision must not compete with canonical session lease semantics.
Resolution: there is no independent presentation revision. Canonical session revision/lease remains authoritative; `basedOnRevision`/`projectionRevision`/`choreography.generation` implement the subordinate, single-increment projection flow; committing a presentation plan cannot advance or rewrite canonical evidence by itself.

CORR-01 — Corrected HEAD semantics: removed self-referential final-SHA requirement; recorded SOURCE_CODE_STATE_INSPECTED (d628875), FIRST_PACK_COMMIT (79b6487), and the verified d628..79b diff (pack document only); G03-01 checks repo/branch/base/parent.
CORR-02 — Corrected authorization scope: anonymous visitor session scope with the sessionId/token-digest/Bearer/leaseId/requestId/canonicalRevision tuple; cross-session/cross-authority attacks replace invented tenant truth; multi-tenancy is future compatibility only.
CORR-03 — Corrected disclosure/pagination scope: no CURRENT_SLICE_REQUIRED entitlement/pagination subsystem and no existing disclosure-state machine (Disclosure Gate is WP09 to-build with absence-RED); WP09 seam, WP10 NOT_APPLICABLE/FUTURE disposition with the pack-defined pagination attack held as deferred (no GAUNTLET pagination provenance); PROHIBITED list completed from Slice §boundary.
CORR-04 — Corrected Harness gate: G03-20 expanded to the 16 Slice-mandatory sub-gates bound to current provider/harness/session files; default NOT_VERIFIED.
CORR-05 — Corrected Workshop/prototype binding: incorporated GAUNTLET fully preserved; live Workshop FUTURE/NOT_VERIFIED; disposition matrix added; Mistral wording superseded with structural attacks rebound to the DeepSeek tuple.
CORR-06 — Corrected semantic actions: 11-kind closed union + processMutations/sceneProposal reused; frame_region-family concepts are internal projector/director commands unless RED proves otherwise; no-op outcome and no-funnel rule explicit.
CORR-07 — Corrected revision model: no independent presentation revision; canonical + basedOnRevision/projectionRevision + generation/intentKey with the atomic single-increment flow.
CORR-08 — Corrected visual context: reuse of CurrentExperienceState with exact bounds; server-packaged minimized additions only; bound to the next seller turn.
CORR-09 — Corrected Camera Director: backward-compatible modes/plans; application-owned resolution; interruption matrix; focus/no-trap; single duration owner; bounded zoom/padding/duration; distinct mobile framing.
CORR-10 — Corrected spatial seller: AskAiPanel/App/app-machine non-regression matrix; composer preserved; deterministic guided recovery preserved.
CORR-11 — Corrected Adaptation Gate/catalog: exact module mapping; versioning; token resolution; rejection taxonomy; bypass RED; gap telemetry; no escape.
CORR-12 — Corrected concurrency: G03-06 restores all 11 proposal race attacks with lease/projection/choreography/Critic binding.
CORR-13 — Corrected omissions: no-op semantics; waiting/closing/capacity/recurring/rework dimensions; cost controls + Netlify Free; no per-token UI work; provenance/correction invalidation in G03-02.
CORR-14 — Corrected WP order: exactly 16 WPs in dependency order with observability hooks from WP01 and consolidation in WP14.
CORR-15 — Corrected file map: full exact module list bound to current tree.
CORR-16 — Corrected attack detail: G03-17/G03-27/G03-22/23/25 expansions, G03-18 vs G03-19 ownership, added risk coverage, G03-29 overlap note; gate count stays 29.
CORR-17 — Corrected disclosure existence framing (independent critique round 2, HIGH): the six disclosure states are handoff-defined to-build vocabulary, not existing truth — no disclosure-state machine exists in current code (zero disclosure tokens in `job/src`); Disclosure Gate is WP09 to-build with absence-RED; G03-14 requires absence evidence for any vacuous pass; G03-15 is NOT_APPLICABLE/deferred until the gate lands.
CORR-18 — Corrected artifact-state truth (round 2, MEDIUM): removed phantom preparing/ready/fallback states; non-regression matrix now cites real proposal statuses `conceptual|prototype` with `truthStatus active|invalidated` and phase-only progress.
CORR-19 — Corrected seller-contract attribution (round 2, MEDIUM): quantitativeOpportunity + missingInputs ownership is `agent-intent.ts`; `seller-contract.ts` is material-claim + calculation-request validation (resolves the map self-contradiction).
CORR-20 — Corrected pagination provenance (round 2, LOW): the pagination/cursor attack is pack-defined and held as deferred — the incorporated GAUNTLET proposal contains no pagination/cursor attack, so no binding-GAUNTLET preservation is claimed; NOT_APPLICABLE/FUTURE disposition unchanged.
CORR-21 — Corrected Workshop latency matrix (round 2, LOW): added the two omitted proposal cases — immediate success, and completion after browser disconnect/reconnect — so the eleven-case latency/fallback disposition is complete.
CORR-22 — Corrected base-SHA byte identity (round 3, MEDIUM): pack `AUTHORIZED_BASE_SHA` is now the canonical 40-char form byte-matching the binding GAUNTLET; both 41-char (Slice contract, DeepSeek authorization) and 40-char forms resolve via `git rev-parse --verify` to the identical commit object, so no authority is forked — the upstream one-char variant is reported to the Founder for correction in those docs (not edited here).
CORR-23 — Explicit Mistral preflight disposition (round 3, MEDIUM): the binding proposal's "exact Mistral model/provider route used for real-provider checks" bullet is SUPERSEDED/PROHIBITED by DeepSeek single truth; Mistral-route evidence must never be produced; real-provider proof is the exact DeepSeek tuple under G03-20 only.
CORR-24 — Corrected chat provenance (round 3, LOW): planner name matches the handoff's "GPT Astra"; irretrievable chat convergence is marked unattested working context, not durable fact; the note authorizes no non-DeepSeek route. Non-regression matrix additionally binds real machine `agentStatus` and verified-calculation `valid|invalidated` enums.

These findings are resolved at planning level. Independent implementation critique remains required after BUILD and cannot be replaced by this architecture review.