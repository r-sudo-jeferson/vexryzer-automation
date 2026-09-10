# VXA ASK AI Adaptive Experience Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an ASK AI-centered adaptive sales/discovery experience in which Mistral-driven agentic reasoning progressively transforms the Infinite Canvas, uses a strict generative-UI contract, invokes an isolated DeepSeek Harness development Workshop when a custom live prototype is worth the latency, and gates material proposals through an independent critical agent.

**Architecture:** Use a dual-plane architecture. The customer-facing Experience Runtime remains a fast React/XState/Netlify/Mistral path that accepts only validated process mutations and typed scene intents. The optional Workshop runs DeepSeek Harness in an isolated development workspace behind a narrow `WorkshopClient` boundary; it may create prototype artifacts but cannot directly mutate production state or execute arbitrary model-authored React in the visitor runtime.

**Tech Stack:** Node 24, pnpm 11.25.0, TypeScript strict, React 19.2, Vite 8, XState 5, `@xyflow/react` 12.11, Motion 13, Netlify Functions, Mistral, DeepSeek Harness after compatibility proof, Vitest, Node test runner, Playwright, axe.

**Spec:** `job/docs/superpowers/specs/2026-09-10-ask-ai-adaptive-experience-design.md`

## Global Constraints

- Status at plan creation: `PLANNED / NOT_AUTHORIZED`.
- Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`.
- Planning base: `6244a246d8faf73e772fc944a398a71a02fb97e0`.
- Product root is `job`; product code, tests, scripts, runtime configuration and product documentation stay under `job`.
- Do not access, import, synchronize, copy from or depend on `r-sudo-jeferson/Machina` or `machina-group/machina`.
- Do not begin Task 1 or later until a material authorized Slice, Slice version, authorized base SHA and matching GAUNTLET exist and the base is verified.
- Preserve the completed S001 Infinite Canvas behavior unless the authorized Slice explicitly requires a change.
- ASK AI is central to the experience; it is not a floating corner widget.
- XState owns deterministic experience lifecycle. AI proposes language, facts, scene intents and tool actions; validated application code owns mutation.
- Provider secrets remain server-side. No model response directly executes JavaScript/JSX/CSS or weakens CSP.
- Live Workshop failure or absence cannot block the discovery/sales path.
- A visitor-session Workshop has no access to the Vexryzer repository, production secrets or production/customer datasets.
- Pricing authority remains outside this work unless the authorized Slice explicitly moves it.
- Remote CI remains `OPTIMIZED_GATES_ONLY`; use local/evidence-driven loops first and remote integration gates only when justified.
- Every candidate SHA change invalidates prior candidate-specific PASS evidence.
- No claim of PASS, promotion or COMPLETE without fresh verification evidence.

---

### Task 0: Authorization and contract preflight gate

**Files:**
- Read: `AGENTS.md`
- Read: `job/docs/product/VXA-001-product-contract.md`
- Read: `job/docs/architecture/VXA-001-architecture.md`
- Read: `job/docs/slices/VXA-slice-map.md`
- Read: future authorized Slice contract under `job/docs/slices/`
- Read: future authorization under `job/docs/authorizations/`
- Read: future GAUNTLET under `job/docs/gauntlets/`
- Modify only if separately authorized: product/architecture contract documents that formally adopt the expanded commercial scope.

**Interfaces:**
- Consumes: Founder-approved design spec above.
- Produces: verified `slice_id`, `slice_version`, `gauntlet_id`, `authorized_base_sha`, and an explicit execution boundary.

- [ ] **Step 1: Re-read repository authority before any code work.**

Run repository reads and confirm `FORGE-VEXRYZER-AUTOMATION-v1.0.0`, `PRODUCT_ROOT=job`, isolation boundary and CI policy.

- [ ] **Step 2: Verify material authorization exists.**

Required evidence is an actual authorization document and actual GAUNTLET document, not the roadmap entry in `VXA-slice-map.md`.

Expected if absent: stop with `BLOCKED NO AUTHORIZED SLICE` and do not execute Task 1.

- [ ] **Step 3: Verify the authorized base SHA against the repository ref/commit.**

Expected: exact SHA match. Any mismatch is `CONFIGURATION_DRIFT`.

- [ ] **Step 4: Reconcile expanded product direction with contract authority.**

The authorized contract must state whether S002 may qualify automation, micro-SaaS, BI, intelligent/agentic solutions and training. If the old automation-only contract still has authority, stop with `BLOCKED CONTRACT DECISION REQUIRED` rather than silently broadening runtime behavior.

- [ ] **Step 5: Freeze the implementation scope for one Slice.**

Record required scenario families, explicit deferrals, performance budgets, Workshop requirements and GAUNTLET gates. Do not import later pricing/evidence/sealing scope unless the Slice requires it.

---

### Task 1: Prove DeepSeek Harness + Mistral compatibility before dependency commitment

**Files:**
- Create: `job/tools/workshop-spike/README.md`
- Create: `job/tools/workshop-spike/run-harness-mistral.mjs`
- Create: `job/tools/workshop-spike/fixtures/tool-contract.json`
- Create: `job/tests/pure/workshop-provider-contract.node.test.ts`
- Modify only after proof: `job/package.json`
- Modify only after proof: `job/pnpm-lock.yaml`

**Interfaces:**
- Consumes: real selected Mistral model/provider credentials through environment only.
- Produces: `WorkshopProviderCompatibility` evidence consumed by the Workshop integration task.

```ts
export interface WorkshopProviderCompatibility {
  providerRoute: string;
  modelId: string;
  streaming: boolean;
  toolCalls: boolean;
  multiTurnToolReplay: boolean;
  structuredArguments: boolean;
  timeoutMapped: boolean;
  restartSafe: boolean;
}
```

- [ ] **Step 1: Write the provider-contract test first.**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';

const required = ['streaming', 'toolCalls', 'multiTurnToolReplay', 'structuredArguments', 'timeoutMapped', 'restartSafe'] as const;

test('Workshop provider compatibility requires every material capability', () => {
  const result = Object.fromEntries(required.map((key) => [key, true]));
  assert.equal(required.every((key) => result[key] === true), true);
});
```

- [ ] **Step 2: Run the pure test and verify the harness proof fixture does not yet exist.**

Run: `cd job && pnpm test:pure`

Expected: existing suite remains green; no real-provider PASS may be claimed yet.

- [ ] **Step 3: Implement the one-purpose spike runner.**

The runner must create one isolated workspace, send a tool-call task, collect streamed events, continue the same session after the tool result, close/restart the harness, continue a persisted session, and emit a redacted JSON result matching `WorkshopProviderCompatibility`.

No API key may be written to disk or command arguments.

- [ ] **Step 4: Evaluate provider routes in strict order.**

Try the pinned Harness release's Mistral catalog route first; then a configured `llm-pi-ai` Mistral route; implement a custom Mistral Harness adapter only if the compatible route fails a required behavior.

- [ ] **Step 5: Record exact version and evidence.**

`README.md` must state exact Harness version, provider route, model id, tested OS/runtime, which capabilities passed, which failed and whether an adapter is required.

- [ ] **Step 6: Add the Harness dependency only after the compatibility evidence passes.**

Run after dependency change: `cd job && pnpm install --lockfile-only && pnpm typecheck && pnpm test:pure`

Expected: lockfile is deterministic and no production dependency is added merely to preserve a failed spike.

- [ ] **Step 7: Commit the compatibility decision.**

```bash
git add job/tools/workshop-spike job/tests/pure/workshop-provider-contract.node.test.ts job/package.json job/pnpm-lock.yaml
git commit -m "test: prove workshop provider compatibility"
```

---

### Task 2: Define the adaptive experience domain and closed scene contract

**Files:**
- Create: `job/src/experience/scene-domain.ts`
- Create: `job/src/experience/scene-validation.ts`
- Create: `job/src/experience/experience-events.ts`
- Create: `job/src/experience/process-mutations.ts`
- Create: `job/src/experience/critic-domain.ts`
- Test: `job/tests/pure/scene-domain.node.test.ts`
- Test: `job/tests/pure/process-mutations.node.test.ts`
- Test: `job/tests/pure/critic-domain.node.test.ts`
- Modify: `job/src/canvas/domain.ts`

**Interfaces:**
- Consumes: existing `ProcessGraph`, `ProcessNodeModel`, `Provenance`.
- Produces: `ExperienceScene`, `SceneElement`, `CameraIntent`, `ProcessMutationProposal`, `CriticVerdict`.

```ts
export type SceneIntent =
  | 'ask_origin'
  | 'pain_mirror'
  | 'process_reveal'
  | 'process_focus'
  | 'uncertainty_focus'
  | 'friction_lens'
  | 'before_after'
  | 'opportunity_constellation'
  | 'automation_concept'
  | 'micro_saas_concept'
  | 'bi_concept'
  | 'agentic_concept'
  | 'training_path'
  | 'hybrid_solution'
  | 'prototype_preparing'
  | 'prototype_reveal'
  | 'comparison'
  | 'recovery'
  | 'handoff';

export type SceneElementKind =
  | 'ask_nucleus'
  | 'process_node'
  | 'pain_marker'
  | 'uncertainty_marker'
  | 'opportunity_card'
  | 'comparison_card'
  | 'prototype_portal'
  | 'training_path'
  | 'annotation';
```

- [ ] **Step 1: Write rejection tests for untrusted scene input.**

Tests must reject unknown element kinds, arbitrary style objects, script-like fields, external executable URLs, duplicate element ids, missing focus targets, excessive text, invalid node references and unsupported camera intents.

- [ ] **Step 2: Run the tests and verify they fail because validators do not exist.**

Run: `cd job && node --test tests/pure/scene-domain.node.test.ts`

Expected: FAIL at missing module/export.

- [ ] **Step 3: Implement the smallest closed TypeScript unions and validator that satisfy the tests.**

Keep model-authored values data-only. Do not add `Record<string, unknown>` escape hatches for element props.

- [ ] **Step 4: Add immutable process mutation proposals.**

```ts
export type ProcessMutationProposal =
  | { type: 'add_node'; node: ProcessNodeModel }
  | { type: 'replace_node'; nodeId: string; next: ProcessNodeModel }
  | { type: 'add_edge'; edge: ProcessEdgeModel }
  | { type: 'remove_edge'; edgeId: string }
  | { type: 'confirm_provenance'; nodeId: string };
```

The applier must clone, apply and call `validateProcessGraph`; invalid proposals return issues and leave the original graph unchanged.

- [ ] **Step 5: Add Critic verdict types with bounded findings.**

```ts
export type CriticVerdict = 'PASS' | 'REVISE' | 'BLOCK';
export interface CriticFinding {
  code: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  evidence: string;
  correction: string;
}
```

- [ ] **Step 6: Run all pure tests.**

Run: `cd job && pnpm test:pure`

Expected: PASS with new domain tests included.

- [ ] **Step 7: Commit the domain contract.**

```bash
git add job/src/experience job/src/canvas/domain.ts job/tests/pure
git commit -m "feat: define adaptive experience contracts"
```

---

### Task 3: Expand XState into the deterministic experience authority

**Files:**
- Create: `job/src/app/experience-machine.ts`
- Create: `job/src/app/experience-machine.types.ts`
- Modify: `job/src/app/app-machine.ts`
- Modify: `job/src/app/App.tsx`
- Test: `job/tests/unit/experience-machine.test.ts`
- Test: `job/tests/pure/experience-state.node.test.ts`

**Interfaces:**
- Consumes: `ExperienceScene`, validated process-mutation results, Workshop status, Critic verdicts.
- Produces: deterministic experience state and commands for view projection.

- [ ] **Step 1: Write transition tests covering the complete authorized lifecycle.**

At minimum test origin → submit → requesting → streaming → validating → awaiting user; correction; AI timeout → recovery; Critic `REVISE`; Critic `BLOCK`; Workshop request running in parallel with continued conversation; Workshop failure → fast-path fallback; reduced-motion state remains orthogonal.

- [ ] **Step 2: Run the state tests and confirm failure before implementation.**

Run: `cd job && pnpm vitest run tests/unit/experience-machine.test.ts`

- [ ] **Step 3: Implement explicit nested states instead of boolean flags.**

Required state families from the spec are modeled through XState states/parallel regions. Context stores normalized graph/facts, current scene id, request ids and Workshop job ids; it does not store secrets or raw provider internals.

- [ ] **Step 4: Keep backward compatibility for S001 view-state restoration where contractually required.**

Existing `#origin`, process and focused-node navigation must either remain compatible or receive an explicit migration path proven by tests.

- [ ] **Step 5: Run unit + pure tests.**

Run: `cd job && pnpm test:pure && pnpm test:unit`

- [ ] **Step 6: Commit orchestration.**

```bash
git add job/src/app job/tests/unit job/tests/pure
git commit -m "feat: orchestrate adaptive ASK AI lifecycle"
```

---

### Task 4: Build the strict component registry and scene projector

**Files:**
- Create: `job/src/experience/registry/component-registry.ts`
- Create: `job/src/experience/registry/scene-projector.ts`
- Create: `job/src/experience/components/AskNucleus.tsx`
- Create: `job/src/experience/components/PainMarker.tsx`
- Create: `job/src/experience/components/UncertaintyMarker.tsx`
- Create: `job/src/experience/components/OpportunityCard.tsx`
- Create: `job/src/experience/components/ComparisonCard.tsx`
- Create: `job/src/experience/components/PrototypePortal.tsx`
- Create: `job/src/experience/components/TrainingPath.tsx`
- Create: `job/src/experience/components/SceneAnnotation.tsx`
- Create: `job/src/experience/components/experience-components.css`
- Test: `job/tests/component/experience-registry.test.tsx`

**Interfaces:**
- Consumes: validated `ExperienceScene` only.
- Produces: React elements from an allowlisted registry and no executable model-authored code.

```ts
export interface RegistryEntry<K extends SceneElementKind> {
  kind: K;
  maxInstances: number;
  render: (element: Extract<SceneElement, { kind: K }>) => React.ReactNode;
}
```

- [ ] **Step 1: Write tests that prove unknown components cannot render.**

Test known kind success, unknown kind rejection, instance limits, deterministic keys, bounded content and no `dangerouslySetInnerHTML` path.

- [ ] **Step 2: Run component test and verify failure.**

Run: `cd job && pnpm vitest run tests/component/experience-registry.test.tsx`

- [ ] **Step 3: Implement the registry with explicit imports and no dynamic module path from model data.**

- [ ] **Step 4: Implement baseline components using existing design tokens and semantic HTML.**

Every interactive component has keyboard behavior, visible focus and an accessible name.

- [ ] **Step 5: Run component and accessibility-relevant unit tests.**

Run: `cd job && pnpm test:component`

- [ ] **Step 6: Commit registry and approved primitives.**

```bash
git add job/src/experience/registry job/src/experience/components job/tests/component
git commit -m "feat: add closed generative UI registry"
```

---

### Task 5: Turn the Infinite Canvas into the adaptive experience stage

**Files:**
- Modify: `job/src/canvas/AutomationCanvas.tsx`
- Modify: `job/src/canvas/camera.ts`
- Modify: `job/src/canvas/layout.ts`
- Modify: `job/src/canvas/semantic-zoom.ts`
- Modify: `job/src/canvas/canvas.css`
- Create: `job/src/canvas/scene-projection.ts`
- Create: `job/src/canvas/scene-layout.ts`
- Test: `job/tests/pure/camera.node.test.ts`
- Test: `job/tests/pure/scene-layout.node.test.ts`
- Test: `job/tests/component/adaptive-canvas.test.tsx`

**Interfaces:**
- Consumes: process graph + validated scene projection + `CameraIntent`.
- Produces: stable React Flow nodes/edges, semantic zoom bands and interruptible camera commands.

- [ ] **Step 1: Write camera tests before expanding camera vocabulary.**

Tests prove each camera intent resolves to validated node targets, reduced motion resolves to zero-duration movement, missing targets fail closed, repeated identical intent emits no redundant camera command, and a user interruption prevents automatic refit until intent changes.

- [ ] **Step 2: Write scene-layout tests for process, opportunity and prototype regions.**

Cover single process, long process, branches, multiple process clusters, opportunity constellation, large labels, mobile directed layout and stable positioning under incremental node addition.

- [ ] **Step 3: Refactor `CameraMode` into camera intent without removing interruption behavior.**

The browser never accepts raw x/y/zoom authored by the model. It resolves a semantic target through application code.

- [ ] **Step 4: Add scene nodes to React Flow using the closed registry.**

Preserve stable ids for unchanged process nodes so streaming narration does not remount the whole graph.

- [ ] **Step 5: Batch meaningful streaming changes.**

Do not mutate graph/layout on every token. Only accepted fact/scene deltas trigger Canvas projection.

- [ ] **Step 6: Prove S001 navigation and camera non-regression.**

Run: `cd job && pnpm test:pure && pnpm test:component`

- [ ] **Step 7: Commit Canvas adaptation.**

```bash
git add job/src/canvas job/tests/pure job/tests/component
git commit -m "feat: make infinite canvas adaptive"
```

---

### Task 6: Build ASK AI as the central conversational surface with truthful streaming feedback

**Files:**
- Create: `job/src/ask/AskAiSurface.tsx`
- Create: `job/src/ask/AskComposer.tsx`
- Create: `job/src/ask/AskActivity.tsx`
- Create: `job/src/ask/ask.css`
- Create: `job/src/ask/stream-protocol.ts`
- Create: `job/src/ask/stream-reducer.ts`
- Modify: `job/src/app/App.tsx`
- Modify: `job/src/app/app.css`
- Test: `job/tests/pure/stream-reducer.node.test.ts`
- Test: `job/tests/component/ask-ai-surface.test.tsx`

**Interfaces:**
- Consumes: typed stream events from the server.
- Produces: user input events, accessible narration, Canvas/state actions.

```ts
export type AskStreamEvent =
  | { type: 'request.accepted'; requestId: string }
  | { type: 'activity'; requestId: string; phase: 'understanding' | 'structuring' | 'checking' | 'composing' }
  | { type: 'text.delta'; requestId: string; text: string }
  | { type: 'fact.proposed'; requestId: string; proposal: ProcessMutationProposal }
  | { type: 'scene.proposed'; requestId: string; scene: ExperienceScene }
  | { type: 'critic.verdict'; requestId: string; verdict: CriticVerdict }
  | { type: 'request.completed'; requestId: string }
  | { type: 'request.failed'; requestId: string; code: string };
```

- [ ] **Step 1: Write reducer tests for out-of-order/duplicate/terminal events.**

Duplicate terminal events must not duplicate UI. Unknown request ids are ignored or fail closed according to the authorized protocol. Activity labels are accepted only from the closed phase union.

- [ ] **Step 2: Build immediate local acknowledgement independent of provider response.**

Submitting input updates local state immediately and starts a truthful `request accepted locally` visual state; it must not invent server activity phases before receiving them.

- [ ] **Step 3: Render streaming text without continuous screen-reader spam.**

Use a stable visible streaming region and a separately throttled/terminal `aria-live` summary.

- [ ] **Step 4: Keep the composer available when the Canvas changes.**

Desktop and mobile must preserve focus/IME behavior. Camera transitions cannot steal keyboard focus from active composition.

- [ ] **Step 5: Run component tests.**

Run: `cd job && pnpm test:pure && pnpm test:component`

- [ ] **Step 6: Commit ASK AI surface.**

```bash
git add job/src/ask job/src/app job/tests
git commit -m "feat: center ASK AI in the adaptive experience"
```

---

### Task 7: Implement the server-side Mistral Experience Orchestrator

**Files:**
- Create: `job/netlify/functions/ask.ts`
- Create: `job/src/server/agent/mistral-client.ts`
- Create: `job/src/server/agent/orchestrator.ts`
- Create: `job/src/server/agent/agent-contracts.ts`
- Create: `job/src/server/agent/roles/process-architect.ts`
- Create: `job/src/server/agent/roles/solution-strategist.ts`
- Create: `job/src/server/agent/roles/experience-composer.ts`
- Create: `job/src/server/agent/stream-writer.ts`
- Modify: `job/netlify.toml`
- Test: `job/tests/unit/agent-orchestrator.test.ts`
- Test: `job/tests/unit/ask-function.test.ts`

**Interfaces:**
- Consumes: bounded visitor message + normalized conversation/fact state.
- Produces: `AskStreamEvent` sequence. No provider-native response object crosses into the browser.

- [ ] **Step 1: Write server tests around a fake Mistral client.**

Cover valid structured extraction, malformed model output, provider timeout, rate limit, contradiction, prompt injection attempt and user correction.

- [ ] **Step 2: Define a provider-neutral client seam.**

```ts
export interface AgentModelClient {
  runTurn(input: AgentTurnInput, signal: AbortSignal): AsyncIterable<AgentModelEvent>;
}
```

The adapter owns Mistral wire details; orchestration owns product behavior.

- [ ] **Step 3: Implement one principal-question policy and bounded agent loop.**

A turn has an explicit maximum number of internal specialist/critic steps. Exceeding the bound returns a recoverable failure rather than recursive model churn.

- [ ] **Step 4: Validate every structured fact and scene before streaming it as accepted state.**

Malformed model output becomes a typed error/revision path; never cast untrusted JSON to domain types.

- [ ] **Step 5: Emit only truthful activity events.**

`structuring` is emitted when the Process Architect step is active; `checking` when Critic/validation is active; `composing` when a scene is being created.

- [ ] **Step 6: Enforce server-side secret boundary.**

Tests inspect serialized responses and production bundle output for provider keys, environment dumps and system-prompt leakage.

- [ ] **Step 7: Run unit tests and production build.**

Run: `cd job && pnpm test:unit && pnpm build && pnpm verify:bundle`

- [ ] **Step 8: Commit server orchestration.**

```bash
git add job/netlify job/src/server job/netlify.toml job/tests/unit
git commit -m "feat: add Mistral experience orchestrator"
```

---

### Task 8: Implement the independent VXA Critic gate

**Files:**
- Create: `job/src/server/agent/critic/vxa-critic.ts`
- Create: `job/src/server/agent/critic/critic-rubric.ts`
- Create: `job/src/server/agent/critic/critic-policy.ts`
- Test: `job/tests/unit/vxa-critic.test.ts`
- Test: `job/tests/pure/critic-policy.node.test.ts`

**Interfaces:**
- Consumes: user turn, normalized facts, process proposal, scene proposal, solution framing and Workshop proposal.
- Produces: validated `PASS | REVISE | BLOCK` with bounded findings.

- [ ] **Step 1: Encode deterministic hard-block rules before model critique.**

Hard blocks include executable scene content, secret requests, unsupported guaranteed outcomes, prototype-as-production misrepresentation, invalid provenance mutation and tool action outside allowlist.

- [ ] **Step 2: Write rubric fixtures for high-risk commercial/UX cases.**

Include manipulative scarcity, invented ROI, premature software recommendation, repeated questions, ignored correction, inaccessible control, needless Workshop invocation and visually noisy scene.

- [ ] **Step 3: Implement Critic as a separate model call/session boundary.**

The same proposal generator cannot self-approve. The Critic may share the provider but uses separate instructions, output schema and request identity.

- [ ] **Step 4: Enforce verdict semantics in orchestration.**

`PASS` permits application; `REVISE` permits one bounded revision cycle; `BLOCK` prevents mutation/publication and selects a safe recovery response.

- [ ] **Step 5: Run critic tests.**

Run: `cd job && pnpm test:pure && pnpm test:unit`

- [ ] **Step 6: Commit Critic.**

```bash
git add job/src/server/agent/critic job/tests
git commit -m "feat: gate agent proposals with independent critic"
```

---

### Task 9: Model corrections, provenance, ambiguity and multiple processes on the Canvas

**Files:**
- Create: `job/src/experience/facts/fact-store.ts`
- Create: `job/src/experience/facts/dependency-index.ts`
- Create: `job/src/experience/facts/correction.ts`
- Create: `job/src/canvas/process-clusters.ts`
- Modify: `job/src/canvas/domain.ts`
- Modify: `job/src/canvas/AutomationCanvas.tsx`
- Test: `job/tests/pure/fact-store.node.test.ts`
- Test: `job/tests/pure/process-clusters.node.test.ts`
- Test: `job/tests/e2e/adaptive-discovery.spec.ts`

**Interfaces:**
- Consumes: validated fact proposals and user confirmations/corrections.
- Produces: stable confirmed/proposed fact graph and invalidation set for dependent AI inferences.

- [ ] **Step 1: Write correction tests.**

If the user changes a system name or process step, dependent `ai_inferred` facts become invalid/proposed again; unrelated confirmed facts remain unchanged.

- [ ] **Step 2: Write multi-process clustering tests.**

Shared systems may connect clusters without merging process identity. Focus/camera can target one process while preserving the broader map.

- [ ] **Step 3: Implement provenance-aware immutable fact storage.**

Never overwrite confirmed history in place. Corrections create a new current fact version and deterministic invalidation result.

- [ ] **Step 4: Project uncertainty and corrections visibly.**

The Canvas must distinguish `user_stated`, `ai_inferred`, `user_confirmed` and conflict/revision state without relying on color alone.

- [ ] **Step 5: Run pure and focused E2E tests locally.**

Run: `cd job && pnpm test:pure && pnpm playwright test tests/e2e/adaptive-discovery.spec.ts`

- [ ] **Step 6: Commit fact/provenance behavior.**

```bash
git add job/src/experience/facts job/src/canvas job/tests
git commit -m "feat: preserve provenance and corrections"
```

---

### Task 10: Create the WorkshopClient boundary and isolated DeepSeek Harness development workspace

**Files:**
- Create: `job/src/server/workshop/workshop-client.ts`
- Create: `job/src/server/workshop/workshop-policy.ts`
- Create: `job/src/server/workshop/deepseek-harness-client.ts`
- Create: `job/src/server/workshop/workspace.ts`
- Create: `job/src/server/workshop/artifact-contract.ts`
- Create: `job/workshop-kit/package.json`
- Create: `job/workshop-kit/src/index.ts`
- Create: `job/workshop-kit/src/components.ts`
- Create: `job/workshop-kit/src/tokens.ts`
- Create: `job/workshop-kit/README.md`
- Test: `job/tests/unit/workshop-client.test.ts`
- Test: `job/tests/pure/workshop-policy.node.test.ts`

**Interfaces:**
- Consumes: bounded `PrototypeBrief` created by the Experience Orchestrator.
- Produces: status events and `PrototypeArtifact` only.

```ts
export interface WorkshopClient {
  createPrototype(brief: PrototypeBrief, signal: AbortSignal): AsyncIterable<WorkshopEvent>;
}

export type WorkshopEvent =
  | { type: 'started'; jobId: string }
  | { type: 'phase'; jobId: string; phase: 'scaffolding' | 'building' | 'checking' | 'rendering' }
  | { type: 'artifact'; jobId: string; artifact: PrototypeArtifact }
  | { type: 'failed'; jobId: string; code: string };
```

- [ ] **Step 1: Write policy tests proving the Workshop is optional and capability-gated.**

Tests reject repository paths, secret names, unrestricted dependency requests, arbitrary network targets and unsupported artifact types.

- [ ] **Step 2: Build a minimal public prototype kit.**

The kit contains only approved tokens/primitives needed to demonstrate a concept. It does not contain production business rules, hidden prompts or credentials.

- [ ] **Step 3: Implement ephemeral workspace creation/cleanup.**

Workspace path is freshly generated per job, contains only the kit + brief, and is removed on success, failure, timeout and cancellation according to the selected artifact retention policy.

- [ ] **Step 4: Bind the proven DeepSeek Harness configuration behind `WorkshopClient`.**

Pin the version proven in Task 1. Configure workspace-write confinement, explicit tool allowlist and bounded execution. Do not use the example `danger-full-access` composition for live customer work.

- [ ] **Step 5: Scrub child-process environment.**

Pass only the model credential references and runtime variables required by the harness. Do not inherit the entire server environment.

- [ ] **Step 6: Run policy/unit tests including forced process failure.**

Run: `cd job && pnpm test:pure && pnpm test:unit`

- [ ] **Step 7: Commit Workshop boundary.**

```bash
git add job/src/server/workshop job/workshop-kit job/tests
git commit -m "feat: isolate DeepSeek Harness workshop"
```

---

### Task 11: Implement live prototype decision policy, progress choreography and safe reveal

**Files:**
- Create: `job/src/server/workshop/invocation-policy.ts`
- Create: `job/src/experience/prototype/prototype-state.ts`
- Create: `job/src/experience/prototype/artifact-validator.ts`
- Create: `job/src/experience/prototype/PrototypeReveal.tsx`
- Create: `job/src/experience/prototype/prototype.css`
- Modify: `job/src/server/agent/orchestrator.ts`
- Modify: `job/src/app/experience-machine.ts`
- Test: `job/tests/pure/workshop-invocation.node.test.ts`
- Test: `job/tests/component/prototype-reveal.test.tsx`
- Test: `job/tests/e2e/live-prototype.spec.ts`

**Interfaces:**
- Consumes: solution opportunity, confidence, expected persuasive value, latency/capability state.
- Produces: `fast_path | workshop` decision and validated prototype reveal scene.

- [ ] **Step 1: Define deterministic reasons to avoid Workshop.**

Avoid Workshop when the approved registry can communicate the same idea, the brief lacks enough facts, current latency/health budget is exhausted, mobile/device constraints make the reveal low-value, or a previous Workshop attempt failed in the session.

- [ ] **Step 2: Define reasons that permit Workshop.**

Permit when a concrete BI/dashboard, micro-SaaS screen, agentic workflow visualization or other custom concept is likely to materially improve understanding and the required facts are present.

- [ ] **Step 3: Write fallback tests before integrating live execution.**

A Workshop timeout/crash/invalid artifact must transition to fast-path generative UI without losing user input, confirmed process facts or conversational continuity.

- [ ] **Step 4: Map real Workshop events to truthful Canvas activity states.**

Use only actual phases emitted by the Workshop. Do not display fabricated percentages.

- [ ] **Step 5: Validate artifacts before render.**

Reject scripts, remote executable dependencies, arbitrary iframe privileges, URLs outside the explicit policy, oversized payloads and missing demo/concept labeling.

- [ ] **Step 6: Make reveal interruptible and non-blocking.**

The conversation remains usable while the Workshop runs. A reveal cannot steal focus from typing.

- [ ] **Step 7: Run E2E with fake fast, slow, timeout and invalid Workshop backends.**

Run: `cd job && pnpm playwright test tests/e2e/live-prototype.spec.ts`

- [ ] **Step 8: Commit live-prototype path.**

```bash
git add job/src/server/workshop job/src/experience/prototype job/src/server/agent/orchestrator.ts job/src/app/experience-machine.ts job/tests
git commit -m "feat: add bounded live prototype reveals"
```

---

### Task 12: Implement deterministic AI/Workshop recovery and latency feedback budgets

**Files:**
- Create: `job/src/experience/recovery/recovery-policy.ts`
- Create: `job/src/experience/recovery/GuidedFallback.tsx`
- Create: `job/src/performance/experience-timing.ts`
- Modify: `job/src/performance/usePerformanceInstrumentation.ts`
- Modify: `job/src/app/experience-machine.ts`
- Test: `job/tests/pure/recovery-policy.node.test.ts`
- Test: `job/tests/component/guided-fallback.test.tsx`
- Test: `job/tests/e2e/failure-recovery.spec.ts`

**Interfaces:**
- Consumes: typed provider/workshop failure and elapsed timing events.
- Produces: recoverable user-facing state with preserved confirmed understanding.

- [ ] **Step 1: Write failure matrix tests.**

Cover provider timeout, rate limit, malformed output, network failure, Workshop startup failure, Workshop over-budget, invalid artifact, browser reconnect and duplicate retry.

- [ ] **Step 2: Implement deterministic guided discovery fallback.**

The fallback asks only for fields needed by the authorized Slice and can continue the same process/fact model without AI.

- [ ] **Step 3: Instrument the experience budgets.**

Measure submit→visual ack, submit→first semantic delta, turn→useful state, Workshop elapsed time, fallback time, Canvas commits and camera commands.

- [ ] **Step 4: Enforce no indefinite spinner.**

Every waiting state has a timeout or explicit recoverable continuation path.

- [ ] **Step 5: Run recovery E2E.**

Run: `cd job && pnpm playwright test tests/e2e/failure-recovery.spec.ts`

- [ ] **Step 6: Commit recovery path.**

```bash
git add job/src/experience/recovery job/src/performance job/src/app/experience-machine.ts job/tests
git commit -m "feat: add truthful adaptive recovery"
```

---

### Task 13: Harden mobile, accessibility, motion and semantic announcements

**Files:**
- Modify: `job/src/accessibility/motion-policy.ts`
- Modify: `job/src/accessibility/useReducedMotionPolicy.ts`
- Create: `job/src/accessibility/experience-announcer.ts`
- Modify: `job/src/canvas/AutomationCanvas.tsx`
- Modify: `job/src/ask/AskAiSurface.tsx`
- Modify: `job/src/ask/AskComposer.tsx`
- Test: `job/tests/e2e/accessibility.spec.ts`
- Test: `job/tests/e2e/mobile-adaptive.spec.ts`
- Test: `job/tests/visual/adaptive-scenes.spec.ts`

**Interfaces:**
- Consumes: same experience state/scene as desktop.
- Produces: equivalent keyboard, screen-reader, reduced-motion and directed-mobile interaction.

- [ ] **Step 1: Add keyboard/focus tests.**

Verify ASK composer focus survives scene changes, every actionable scene element is reachable, Escape/back behavior is deterministic, and camera changes do not steal focus.

- [ ] **Step 2: Add screen-reader announcement policy.**

Announce semantic events such as `2 etapas novas identificadas` or `hipótese precisa de confirmação`; do not announce every animation/token.

- [ ] **Step 3: Add reduced-motion visual cases.**

All spatial meaning has an opacity/focus/state equivalent with zero or minimal camera animation.

- [ ] **Step 4: Add mobile directed flow.**

Core completion is possible without manual pan/pinch. The virtual keyboard cannot cover the active composer or required next control.

- [ ] **Step 5: Run axe, mobile and visual tests.**

Run: `cd job && pnpm test:a11y && pnpm playwright test tests/e2e/mobile-adaptive.spec.ts && pnpm test:visual`

- [ ] **Step 6: Commit accessibility/mobile hardening.**

```bash
git add job/src/accessibility job/src/canvas job/src/ask job/tests
git commit -m "feat: harden adaptive experience accessibility"
```

---

### Task 14: Add security, abuse and public-boundary verification

**Files:**
- Create: `job/src/server/security/input-policy.ts`
- Create: `job/src/server/security/tool-policy.ts`
- Create: `job/src/server/security/redaction.ts`
- Create: `job/tests/unit/prompt-injection.test.ts`
- Create: `job/tests/unit/tool-policy.test.ts`
- Create: `job/tests/unit/redaction.test.ts`
- Modify: `job/scripts/scan-production-bundle.mjs`
- Modify: `job/netlify.toml`

**Interfaces:**
- Consumes: untrusted user input, model proposals, Workshop briefs/artifacts and diagnostics.
- Produces: accepted/rejected typed results with stable non-sensitive reason codes.

- [ ] **Step 1: Write adversarial tests before policy implementation.**

Include system-prompt extraction, instruction override, secret exfiltration, repository path request, shell/network escalation, script-bearing scene, prototype dependency injection and oversized payloads.

- [ ] **Step 2: Implement strict bounds and redaction.**

Do not log full environment variables, provider headers, raw secrets or unrestricted conversation text.

- [ ] **Step 3: Enforce Workshop tool policy outside the prompt.**

A model instruction can never expand filesystem/network/tool authority.

- [ ] **Step 4: Keep browser CSP least-privilege.**

Provider calls stay server-side. Add browser origins only if an authorized artifact delivery path requires them and tests prove the exact need.

- [ ] **Step 5: Run security tests and bundle scan.**

Run: `cd job && pnpm test:unit && pnpm build && pnpm verify:bundle && pnpm audit --prod --audit-level high`

- [ ] **Step 6: Commit security boundary.**

```bash
git add job/src/server/security job/tests/unit job/scripts/scan-production-bundle.mjs job/netlify.toml
git commit -m "security: harden adaptive agent boundaries"
```

---

### Task 15: Add privacy-safe observability and performance regression gates

**Files:**
- Create: `job/src/observability/experience-events.ts`
- Create: `job/src/observability/experience-metrics.ts`
- Modify: `job/src/performance/usePerformanceInstrumentation.ts`
- Create: `job/tests/pure/experience-metrics.node.test.ts`
- Create: `job/tests/e2e/performance-adaptive.spec.ts`

**Interfaces:**
- Consumes: timestamps and stable event codes only by default.
- Produces: local/provider-neutral metrics without raw PII.

- [ ] **Step 1: Write metric-schema tests.**

Reject arbitrary message text, email, phone, prompt content, environment values and full prototype source from telemetry payloads.

- [ ] **Step 2: Implement the minimum useful metrics from the spec.**

Include visual ack, first semantic delta, useful-state time, scene accept/reject, Critic verdict, Workshop lifecycle, fallback, camera interruptions, Canvas commits, mobile mode and reduced-motion mode.

- [ ] **Step 3: Add performance E2E assertions with deterministic fake streams.**

Streaming text must not cause graph layout or camera commands per token. Unchanged scene ids must not recreate Canvas topology.

- [ ] **Step 4: Run performance tests.**

Run: `cd job && pnpm playwright test tests/e2e/performance-adaptive.spec.ts`

- [ ] **Step 5: Commit observability/performance gates.**

```bash
git add job/src/observability job/src/performance job/tests
git commit -m "test: gate adaptive experience performance"
```

---

### Task 16: Build the high-value scenario and visual GAUNTLET matrix

**Files:**
- Create: `job/tests/e2e/scenarios/vague-pain.spec.ts`
- Create: `job/tests/e2e/scenarios/detailed-process.spec.ts`
- Create: `job/tests/e2e/scenarios/multiple-processes.spec.ts`
- Create: `job/tests/e2e/scenarios/solution-classes.spec.ts`
- Create: `job/tests/e2e/scenarios/corrections.spec.ts`
- Create: `job/tests/e2e/scenarios/workshop-fallback.spec.ts`
- Create: `job/tests/e2e/scenarios/adversarial.spec.ts`
- Modify/Create according to authorized GAUNTLET: `job/tests/visual/adaptive-scenes.spec.ts`
- Modify/Create according to authorized GAUNTLET: workflow/provider glue outside `job` only when technically mandatory.

**Interfaces:**
- Consumes: production build with deterministic fake provider/workshop fixtures plus separately gated real-provider evidence.
- Produces: executable acceptance evidence for the authorized scenario subset.

- [ ] **Step 1: Encode only scenarios required by the authorized Slice as release blockers.**

The broader design matrix remains planning coverage. Do not fail a Slice for an intentionally deferred future scenario unless its contract requires it.

- [ ] **Step 2: Add deterministic fixtures for every release-blocking scene.**

Each fixture identifies expected process facts, scene intent, camera target, provenance, Critic verdict and visible user-facing result.

- [ ] **Step 3: Capture desktop, mobile and reduced-motion visual evidence.**

Visual assertions include ASK AI centrality, process transformation, opportunity reveal, uncertainty, recovery and any authorized live-prototype state.

- [ ] **Step 4: Run the local/full verification stack before remote CI.**

Run:

```bash
cd job
pnpm verify:foundation
pnpm typecheck
pnpm test
pnpm build
pnpm verify:bundle
pnpm test:e2e
pnpm test:visual
pnpm audit --prod --audit-level high
```

Expected: all applicable gates pass locally/available environment before optimized remote integration CI is used.

- [ ] **Step 5: Execute the exact authorized GAUNTLET without weakening assertions.**

Any failure requires evidence → root cause → correction → fresh verification → new GAUNTLET run.

- [ ] **Step 6: Commit acceptance coverage.**

```bash
git add job/tests job/scripts job/docs
git commit -m "test: add adaptive ASK AI gauntlet coverage"
```

---

### Task 17: Independent critique, candidate freeze and exact repository integration

**Files:**
- Review: all files changed by the authorized Slice.
- Update only as required by evidence: relevant files under `job`.
- No product duplication outside `job`.

**Interfaces:**
- Consumes: fully verified candidate content.
- Produces: frozen `github_candidate_sha`, independent review verdict, GAUNTLET evidence and exact main integration result.

- [ ] **Step 1: Run an independent Critic/engineering review.**

Review contract misses, regression, authorization bypass, prompt injection, secrets, sandbox escape, latency, race/cancellation, idempotency, accessibility, mobile, Canvas performance, visual persuasion, misleading prototype semantics, deployment and unnecessary complexity.

- [ ] **Step 2: Correct findings at root cause and rerun affected gates.**

Do not change expected outputs or test assertions merely to accommodate implementation.

- [ ] **Step 3: Run `verification-before-completion` and the full applicable GAUNTLET.**

Fresh evidence must refer to the exact candidate that will be frozen.

- [ ] **Step 4: Resolve and freeze `github_candidate_sha`.**

After freeze, any content change creates a new candidate and invalidates previous candidate-specific PASS.

- [ ] **Step 5: Integrate through the repository's authorized PR/main workflow.**

Vexryzer remains GitHub-isolated. Do not promote to or consult Machina repositories.

- [ ] **Step 6: Verify exact post-merge content and required post-merge gates.**

Compare candidate/result tree or equivalent exact-content evidence and verify main ref after merge.

- [ ] **Step 7: Report final truth.**

Report Slice id/version, authorized base SHA, candidate SHA, checks performed/not performed, GAUNTLET, Critic review, integration result SHA, failures, risks, `NOT_VERIFIED` items and final state. `PASS` is not `COMPLETE`; use `COMPLETE` only if every contractually required integration/post-integration condition is verified.

---

## Plan self-review record

### Spec coverage

The tasks cover ASK AI centrality, Infinite Canvas adaptation, strict generative UI, Mistral Experience Runtime, independent Critic, DeepSeek Harness Workshop, live/fast hybrid prototypes, corrections/provenance, multiple processes, latency feedback, deterministic fallback, security, public-boundary isolation, accessibility, mobile, performance, observability, testing and exact candidate verification.

### Explicitly gated unknowns

DeepSeek Harness version/provider compatibility and zero-cost persistent Workshop deployment are not guessed. Task 1 converts provider compatibility into evidence; production Workshop placement remains capability-gated so the fast path can ship independently if the authorized Slice permits it.

### Non-regression intent

The plan extends existing `ProcessGraph`, camera interruption behavior, semantic zoom, React Flow foundation, XState authority, accessibility and verification infrastructure rather than rewriting them for fashion.

### Scope integrity

The plan does not move authoritative pricing, evidence upload, request sealing or later conversion responsibilities into S002 by default. The authorized Slice remains the final scope authority.
