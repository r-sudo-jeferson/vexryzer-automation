# VXA-S002 Agent-Led Accounting Seller Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an improvisational, accounting-native ASK AI Seller whose strategy is agent-led while truth, quantitative claims, security, state integrity and publication remain inside a minimal deterministic Trust Kernel.

**Architecture:** Canonical application state stores durable truth and quantitative evidence, not a prescribed sales path. The Seller emits broad semantic `AgentIntent`/`ExperienceProposal` data; deterministic code verifies revisions, provenance, calculations, execution boundaries and publication. The Infinite Canvas and artifact surfaces react to accepted intent rather than to a fixed funnel or token stream.

**Tech Stack:** Node 24, pnpm 11.25.0, TypeScript 5.9 strict, React 19.2, XState 5.32, React Flow 12.11, Vite 8.2, Vitest 5, Playwright 1.62, OpenCode 1.18.30 + Groq `openai/gpt-oss-120b` for the separately gated Workshop.

**Spec:** `job/docs/superpowers/specs/2026-09-10-vxa-s002-agent-led-accounting-seller-design.md`

## Global Constraints

- Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`.
- Slice: `VXA-S002@1.0.0`.
- GAUNTLET: `GNT-VXA-S002-001`.
- Authorized base remains `6244a246d8faf73e772fc944a398a71a02fb97e0`.
- Product root is `job`; product code, tests, scripts and product documentation remain under `job`.
- Construction branch: `staging/vxa-s002-agent-led-accounting-seller`, rooted at Founder-approved design SHA `a98432c75ba7bf94c11e04bf591ab50f27392307`.
- Remote CI remains `OPTIMIZED_GATES_ONLY`; no PR or provider workflow merely for intermediate development.
- The Seller is specialized for accounting firms but may not infer user facts from industry stereotypes.
- Agent strategy must remain improvisational: no mandatory question order, fixed solution classifier, fixed scene sequence or Critic-enforced funnel.
- Deterministic code owns confirmed truth, provenance, correction history, arithmetic, stale-event rejection, idempotency, security, tool permissions and executable/publication boundaries.
- Material numeric claims must come from canonical observations and deterministic calculations. No invented ROI, savings, labor cost, payback, productivity percentage, feasibility or tax/accounting consequence.
- Capabilities are composable means, not mutually exclusive solution classes.
- Customer attachment content is not representable in S002 model context.
- OpenCode Workshop compatibility evidence remains exact to run `34483101166` / SHA `e8f627947dd0223dbf7237aa64d54687aab86c72`; runtime changes do not upgrade that historical evidence into final candidate PASS.
- Every final candidate SHA change invalidates candidate-specific GAUNTLET evidence.

---

### Task 0: Materialize Founder-approved authority without changing Slice identity

**Files:**
- Create: `job/docs/product/VXA-001-product-contract-amendment-002.md`
- Create: `job/docs/architecture/VXA-001-architecture-amendment-003.md`
- Create: `job/docs/authorizations/VXA-S002-AGENT-LED-ACCOUNTING-SELLER-AUTHORIZATION.md`
- Modify: `job/docs/slices/VXA-S002-contract.md`

**Interfaces:**
- Consumes: Founder-approved design SHA `a98432c75ba7bf94c11e04bf591ab50f27392307`.
- Produces: durable Product/Architecture authority for the implementation below while retaining `VXA-S002@1.0.0` and `GNT-VXA-S002-001`.

- [ ] **Step 1: Materialize product scope.** State that accounting firms are the vertical focus; Vexryzer may combine operational objects, imports/transforms, presentations, BI, training, automation/integration, internal tools, AI/agentic and process/data work; these are capabilities, not a required classification funnel.
- [ ] **Step 2: Materialize architecture.** Define `Agent-Led Experience + Deterministic Trust Kernel`, strongest-truthful-next-move orchestration, deterministic numeric authority and reactive semantic UI.
- [ ] **Step 3: Materialize authorization.** Reference the exact approved design path/SHA and explicitly preserve all stricter existing S002 and GAUNTLET controls.
- [ ] **Step 4: Extend the S002 contract references.** Add the new product/architecture/authorization/design paths; do not change id/version/base/GAUNTLET.
- [ ] **Step 5: Inspect the resulting diff.** Reject any wording that moves price, persistence, upload truth, unrestricted execution or later-Slice scope into S002.

---

### Task 1: Build canonical truth and quantitative evidence domain

**Files:**
- Create: `job/src/ai/context/canonical-sales-context.ts`
- Create: `job/src/ai/context/context-reducer.ts`
- Create: `job/src/ai/context/session-digest.ts`
- Test: `job/tests/pure/canonical-sales-context.node.test.ts`
- Test: `job/tests/pure/context-reducer.node.test.ts`
- Test: `job/tests/pure/session-digest.node.test.ts`

**Interfaces:**
- Produces `CanonicalSalesContext`, `SalesFact`, `SalesObjection`, `QuantitativeObservation`, `VerifiedCalculation`, `OpportunityRecord`, `ArtifactRecord`, `ContextMutation`, `applyContextMutation`, `createSessionDigest`.

Target core types:

```ts
export type EvidenceStatus = 'proposed' | 'confirmed' | 'conflicted' | 'superseded';
export type EvidenceSource = 'user' | 'inference' | 'system';

export interface QuantitativeObservation {
  id: string;
  metric: string;
  value: number;
  unit: 'occurrence' | 'minute' | 'hour' | 'day' | 'client' | 'person' | 'document' | 'entry' | 'currency' | 'percent' | 'other';
  period: 'event' | 'day' | 'week' | 'month' | 'quarter' | 'year' | null;
  status: EvidenceStatus;
  source: EvidenceSource;
  supportingTurnIds: readonly string[];
}

export interface VerifiedCalculation {
  id: string;
  kind: 'time_cost' | 'capacity' | 'volume' | 'rework' | 'delay' | 'custom';
  inputObservationIds: readonly string[];
  expression: string;
  resultValue: number;
  resultUnit: string;
  computedBy: 'application';
  basedOnRevision: number;
}
```

- [ ] **Step 1: Write RED tests for domain invariants.** Require unique bounded ids, finite numeric observations, explicit provenance/status, immutable creation, no attachment-content field and no single mandatory `preferredSolutionKind`.
- [ ] **Step 2: Write RED reducer tests.** Prove user confirmation can confirm a proposed fact without losing provenance; model inference cannot forge `source=user`; correction supersedes history; correction invalidates dependent calculations/opportunities; `baseRevision` mismatch returns typed `STALE_REVISION`; every accepted mutation increments revision exactly once.
- [ ] **Step 3: Write RED digest tests.** Prove digest preserves confirmed/proposed/conflicted distinctions, quantitative observations and unresolved objections without converting inference into user truth.
- [ ] **Step 4: Observe RED in the nearest available executable environment.** Preferred: local `node --test` if dependencies/runtime are available. If unavailable, preserve `NOT_VERIFIED` and use one bounded hosted pure-test checkpoint only after all three RED files are present.
- [ ] **Step 5: Implement immutable bounded domain and reducer.** No opaque `Record<string, unknown>` escape hatch for canonical evidence.
- [ ] **Step 6: Re-run pure tests.** `cd job && pnpm test:pure`. Require all prior pure tests plus new domain tests green before Task 2.
- [ ] **Step 7: Independent review.** Attack authority escalation, stale races, provenance laundering, accidental solution-class funnel and correction invalidation.

---

### Task 2: Implement deterministic quantitative calculation kernel

**Files:**
- Create: `job/src/ai/quant/quantity-types.ts`
- Create: `job/src/ai/quant/calculation-engine.ts`
- Create: `job/src/ai/quant/calculation-validation.ts`
- Test: `job/tests/pure/quantitative-calculation.node.test.ts`

**Interfaces:**
- Consumes canonical `QuantitativeObservation[]`.
- Produces validated `CalculationRequest`, `VerifiedCalculation` or typed rejection.

```ts
export type CalculationRequest =
  | { kind: 'monthly_time'; occurrenceObservationId: string; minutesObservationId: string }
  | { kind: 'capacity'; peopleObservationId: string; timeObservationId: string }
  | { kind: 'monthly_cost'; hoursObservationId: string; hourlyCostObservationId: string }
  | { kind: 'rework_volume'; volumeObservationId: string; reworkRateObservationId: string };
```

- [ ] **Step 1: Write RED tests.** Cover `3 people × 40 minutes/day × 22 days = 44 hours/month`, unit mismatch, missing observation, proposed/conflicted input policy, non-finite values, stale revision and correction invalidation.
- [ ] **Step 2: Implement unit-aware arithmetic.** Do not allow model-supplied result values; the request references canonical observations only.
- [ ] **Step 3: Add claim-boundary validation.** Verified calculation may support rhetoric but cannot imply savings/ROI/payback unless those values themselves are deterministically computable from authorized canonical inputs.
- [ ] **Step 4: Run pure tests and review precision/rounding semantics.** Store canonical numeric result; formatting/rounding belongs to presentation.

---

### Task 3: Define improvisational AgentIntent and composable capability contracts

**Files:**
- Create: `job/src/experience/agent-intent.ts`
- Create: `job/src/experience/experience-proposal.ts`
- Create: `job/src/experience/artifact-intent.ts`
- Create: `job/src/experience/experience-validation.ts`
- Test: `job/tests/pure/agent-intent.node.test.ts`
- Test: `job/tests/pure/experience-proposal.node.test.ts`

**Interfaces:**
- Produces `AgentIntent`, `ExperienceAction`, `CapabilityKind`, `ArtifactIntent`, `ExperienceProposal`, `validateExperienceProposal`.

```ts
export type CapabilityKind =
  | 'operational_artifact'
  | 'data_import_transform'
  | 'presentation'
  | 'bi_decision_intelligence'
  | 'training_enablement'
  | 'automation_integration'
  | 'internal_tool'
  | 'ai_agentic'
  | 'process_data_improvement';
```

- [ ] **Step 1: Write RED tests proving freedom.** Accept zero/one/many capabilities; accept a turn with no question; accept multiple coordinated semantic actions; reject any validator requiring one solution class or one fixed action order.
- [ ] **Step 2: Write RED security/bounds tests.** Reject unknown executable component/module paths, raw HTML/JS/CSS, unbounded arrays/text, duplicate action ids, raw viewport coordinates and unauthorized external executable URLs.
- [ ] **Step 3: Implement a closed semantic action vocabulary with extensible application-owned registry.** The model chooses combinations; application owns validation/rendering.
- [ ] **Step 4: Run pure tests and review for hidden funnel reconstruction.**

---

### Task 4: Package provider-neutral context for strongest-next-move reasoning

**Files:**
- Create: `job/src/ai/context/context-packager.ts`
- Create: `job/src/ai/context/token-budget.ts`
- Create: `job/src/ai/context/emergency-capsule.ts`
- Test: `job/tests/pure/context-packager.node.test.ts`
- Test: `job/tests/pure/emergency-capsule.node.test.ts`

**Interfaces:**
- Consumes canonical truth, recent turns, digest, current visual/artifact state and provider route budget.
- Produces bounded role-specific `ContextPack` without provider conversation ids as authority.

- [ ] **Step 1: Write priority tests.** Current user intent, confirmed facts, objections and quantitative evidence survive before old prose; no duplicate digest/raw history; no attachment content.
- [ ] **Step 2: Write improvisation-preservation test.** Packager must not inject a mandatory solution class, question sequence or sales stage instructions beyond safety/truth constraints.
- [ ] **Step 3: Implement one-pass packing and one bounded recompaction.** No recursive overflow loop.
- [ ] **Step 4: Build Groq emergency capsule under injected token budget and verify provider switch preserves canonical truth.

---

### Task 5: Implement Seller/Critic proposal authority without a hidden funnel

**Files:**
- Create: `job/src/ai/seller/seller-contract.ts`
- Create: `job/src/ai/seller/accounting-language.ts`
- Create: `job/src/ai/critic/critic-contract.ts`
- Create: `job/src/ai/critic/hard-blocks.ts`
- Test: `job/tests/pure/seller-contract.node.test.ts`
- Test: `job/tests/pure/critic-contract.node.test.ts`

**Interfaces:**
- Seller produces an `ExperienceProposal` and may request deterministic calculations.
- Critic consumes proposal + evidence projection and returns `PASS | REVISE | BLOCK` with bounded findings.

- [ ] **Step 1: Encode hard blocks in application code.** Unsupported numeric claim, forged confirmation, authoritative price/discount, fake feasibility, attachment-read claim, secret/tool escalation and production-prototype confusion fail before model Critic.
- [ ] **Step 2: Test Critic novelty freedom.** A novel capability combination or skipped question cannot be rejected merely for deviating from a funnel.
- [ ] **Step 3: Add accounting-native behavior/eval vocabulary as guidance, not hardcoded reply text.** No canned sales responses in production.
- [ ] **Step 4: Enforce one bounded REVISE cycle for material proposals; stale Critic verdict cannot commit against a newer revision.

---

### Task 6: Project accepted agent strategy into reactive UI/artifacts

**Files:**
- Create/modify under `job/src/experience/` for safe registry/projector primitives.
- Modify: `job/src/app/experience-state.ts` or superseding XState experience authority.
- Modify only as required: `job/src/app/App.tsx`, `job/src/canvas/*`.
- Test: `job/tests/component/*`, `job/tests/unit/*`, browser/visual tests under `job/tests/e2e` and `job/tests/visual`.

**Interfaces:**
- Consumes validated `ExperienceProposal` only.
- Produces semantic Canvas/artifact changes; no model-authored executable runtime code.

- [ ] **Step 1: Write component/state RED tests.** Turn with no question remains valid; multiple semantic effects commit atomically; repeated equivalent intent deduplicates; stale scene rejected; correction removes/marks an invalidated displayed calculation.
- [ ] **Step 2: Implement semantic projection.** No relayout/camera motion per streamed token; user interaction interrupts non-essential choreography.
- [ ] **Step 3: Add safe artifact surfaces for operational object, import preview, presentation, BI dashboard, training module, workflow concept and prototype.
- [ ] **Step 4: Verify keyboard, focus, reduced motion, mobile and semantic alternatives for spatial information.

---

### Task 7: Integrate provider routing, Seller turns and optional Workshop

**Files:**
- Reuse/extend provider-neutral work under `job/src/ai/providers/` according to `VXA-ARCH-A002`.
- Create server-side adapters/functions under `job` only.
- Integrate OpenCode Workshop only behind the already proven optional boundary.

**Interfaces:**
- Cloudflare primary Seller family; Groq independent fallback; deterministic guided recovery when no eligible route exists.

- [ ] **Step 1: Require role-specific compatibility evidence before route eligibility.** Protocol PASS alone is not Seller-quality PASS.
- [ ] **Step 2: Preserve canonical context across provider switch.** Provider session id is never authoritative.
- [ ] **Step 3: Keep Workshop exceptional and non-blocking.** Fast path remains fully usable when Workshop unavailable.
- [ ] **Step 4: Preserve R$0/no-payment policy and server-only credentials.

---

### Task 8: Accounting-native persuasion battery, Critic review and final GAUNTLET

**Files:**
- Create deterministic scenario/eval fixtures under `job/tests/` and bounded evidence scripts under `job/scripts/`.
- Extend `GNT-VXA-S002-001` execution evidence only; do not weaken its authorized source.

**Interfaces:**
- Produces exact-candidate evidence for quality, safety, accessibility, performance and provider behavior.

- [ ] **Step 1: Build accounting scenarios.** Reconciliation, document collection, closing compression, import/reclassification, payroll/fiscal handoff, portfolio visibility, team-already-does-it, price objection, change-complexity, training-first, multi-capability and no-software-fit.
- [ ] **Step 2: Evaluate improvisation.** Comparable scenarios must allow materially different strong strategies; fail if a hidden fixed question sequence dominates.
- [ ] **Step 3: Evaluate quantitative persuasion.** Use supplied numbers correctly; identify high-value missing variables; zero invented ROI/savings/percentages.
- [ ] **Step 4: Execute deterministic verification.** Foundation validator, TypeScript strict, pure/unit/component, production build, bundle secret scan, dependency/license/audit, browser E2E, accessibility and visual matrix.
- [ ] **Step 5: Independent Critic review.** Attack security, authority, races, corrections, arithmetic, provider fallback, persuasion truth, novelty freedom, mobile/accessibility, performance and Workshop isolation/egress assumptions.
- [ ] **Step 6: Freeze `github_candidate_sha`.** Any subsequent change invalidates candidate-specific PASS.
- [ ] **Step 7: Run `GNT-VXA-S002-001` plus strengthened agent-led accounting attacks on that exact SHA.
- [ ] **Step 8: Report `PASS` only if every required gate is evidenced.** Missing environment/provider/browser/deployment/isolation evidence stays `NOT_VERIFIED`.
