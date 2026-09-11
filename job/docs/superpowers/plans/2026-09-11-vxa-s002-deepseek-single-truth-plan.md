# VXA-S002 DeepSeek Single Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Apply test-driven-development to behavior changes.

**Goal:** Remove every active alternative model/provider/harness and converge S002 on DeepSeek Harness + `deepseek-v4-pro` + `DEEPSEEK_API_KEY`, with the agent coordinating the Infinite Canvas through bounded semantic tools.

**Architecture:** Keep the existing Agent-Led Experience and Deterministic Trust Kernel. Narrow the provider plane to one DeepSeek route, then adapt the wire/runtime and Harness integration without weakening canonical truth, Critic, session, Canvas or recovery boundaries.

**Tech Stack:** TypeScript, React, XState, React Flow, Netlify Functions/Blobs, DeepSeek API, DeepSeek Harness.

**Spec:** `job/docs/superpowers/specs/2026-09-11-vxa-s002-deepseek-single-truth-design.md`

## Global constraints

- Active model id: exactly `deepseek-v4-pro`.
- Harness: exactly DeepSeek Harness, pinned exact version.
- Credential: exactly `DEEPSEEK_API_KEY`, server-only.
- No LLM/provider/harness fallback.
- Provider failure => deterministic guided recovery.
- Canonical Vexryzer state outranks model/Harness memory.
- Canvas changes require validated semantic intent bound to exact revision.
- No arbitrary model-authored executable browser code.
- No automatic recharge or uncontrolled spend.
- Do not trigger remote CI until a coherent candidate is locally/proportionally stabilized; unavailable local checks are `NOT_VERIFIED`.

---

### Task 1: Materialize DeepSeek single-truth authority

**Files:**
- Create: `job/docs/architecture/VXA-001-architecture-amendment-004.md`
- Create: `job/docs/authorizations/VXA-S002-DEEPSEEK-SINGLE-TRUTH-AUTHORIZATION.md`
- Modify: `job/docs/slices/VXA-S002-contract.md`
- Modify: `AGENTS.md`

- [ ] Remove active references that authorize alternative providers/models/harnesses.
- [ ] Replace R$0 LLM policy with bounded Founder-authorized prepaid DeepSeek balance.
- [ ] Preserve deterministic recovery and all non-AI free-tier constraints.
- [ ] Commit the authority checkpoint.

### Task 2: RED — forbid provider/model plurality

**Files:**
- Modify: `job/tests/pure/provider-router.node.test.ts`
- Modify: `job/tests/pure/provider-dispatch.node.test.ts`
- Modify: `job/tests/pure/provider-test-fixtures.ts`
- Modify or replace obsolete multiprovider tests.

- [ ] Write tests requiring one provider family `deepseek`, one model `deepseek-v4-pro`, one server credential `DEEPSEEK_API_KEY`, one primary route and zero fallback/standby tiers.
- [ ] Write a test proving unavailable DeepSeek returns deterministic recovery instead of selecting another route.
- [ ] Write a source-tree guard that rejects forbidden alternative provider/model/harness identifiers in active runtime/config surfaces.
- [ ] Run focused tests and observe the expected RED before production edits.

### Task 3: GREEN — narrow provider registry and routing

**Files:**
- Modify: `job/src/ai/providers/provider-registry.ts`
- Modify: `job/src/ai/providers/provider-router.ts`
- Modify: `job/src/ai/providers/route-eligibility.ts`
- Modify: `job/src/ai/providers/provider-dispatch.ts`

- [ ] Replace provider-family union with `deepseek`.
- [ ] Replace route tiers with a single active route concept.
- [ ] Remove fallback reason semantics and emergency-provider selection.
- [ ] Replace no-payment eligibility with explicit Founder-authorized prepaid billing eligibility.
- [ ] Keep server credential, protocol, role-quality, capability, context, circuit and runtime-activation gates fail-closed.
- [ ] Run focused tests to GREEN.

### Task 4: Delete obsolete provider/harness artifacts

**Files:**
- Delete superseded multi-provider authority/spec/plan/handoff files from the active tree.
- Delete Mistral/Groq/Cloudflare/OpenRouter/OpenCode-specific workflows, probes, bakeoffs and tests.
- Preserve only generic diagnostics that still directly test DeepSeek behavior; rename them when provider-plural naming would mislead.

- [ ] Audit the repository tree for forbidden runtime/config identifiers.
- [ ] Delete or rewrite every active occurrence.
- [ ] Keep historical evidence only in Git history.
- [ ] Re-run source-tree guard.

### Task 5: RED — DeepSeek wire contract

**Files:**
- Add/modify focused wire tests under `job/tests/pure/`.
- Narrow server provider adapter files under `job/src/server/ai/providers/`.

- [ ] Test exact base URL and model id.
- [ ] Test server-only bearer credential handling.
- [ ] Test streaming SSE assembly.
- [ ] Test tool-call argument validation.
- [ ] Test DeepSeek thinking-mode tool replay requirements without exposing hidden reasoning as application truth.
- [ ] Test timeout/cancel/rate/balance/malformed classifications.
- [ ] Observe RED before implementation.

### Task 6: GREEN — DeepSeek API adapter

- [ ] Implement the minimum DeepSeek-specific request/stream adapter needed by Seller/Critic.
- [ ] Keep reasoning protocol state separate from canonical sales context.
- [ ] Keep secret and payload diagnostics bounded.
- [ ] Run focused wire/runtime tests to GREEN.

### Task 7: DeepSeek Harness core-agent integration

**Files:**
- Add Harness adapter/config under `job/src/server/ai/harness/` or the nearest existing server-owned agent boundary.
- Add exact-version configuration under `job/`.
- Add focused Harness tests/probes under `job/tests/` and `job/tools/`.

- [ ] Pin exact DeepSeek Harness version selected for the candidate.
- [ ] Bind one Harness session to one Vexryzer session without making Harness memory canonical.
- [ ] Register only Vexryzer semantic tools required by S002.
- [ ] Map Harness events into bounded application telemetry.
- [ ] Prove restart/session continuity before activation.
- [ ] Fail closed when Harness compatibility is not proven.

### Task 8: Agent-as-Canvas-coordinator strengthening

**Files:**
- Preserve and strengthen `job/src/experience/agent-intent.ts`
- Preserve and strengthen `job/src/experience/experience-projector.ts`
- Preserve and strengthen `job/src/canvas/reactive-graph-adapter.ts`
- Add focused tests.

- [ ] Ensure current visual state is part of every agent turn.
- [ ] Ensure semantic Canvas tool output is revision-bound and validated.
- [ ] Preserve user-interaction priority over choreography.
- [ ] Reject arbitrary executable UI payloads.
- [ ] Prove correction invalidation propagates through calculations, projections and Canvas.

### Task 9: Persuasion GAUNTLET strengthening

- [ ] Add accounting-native scenarios that require quantitative opportunity detection.
- [ ] Require correct deterministic calculation use.
- [ ] Require commercially strong objection handling.
- [ ] Require causal Canvas manipulation when it improves conviction.
- [ ] Require no visual mutation when mutation would be gratuitous.
- [ ] Reject invented ROI, false urgency, unsupported feasibility and pressure after explicit refusal.

### Task 10: Credential, cost and deployment activation

- [ ] Confirm production secret exists under the exact name `DEEPSEEK_API_KEY` without reading or logging its value.
- [ ] Add bounded token/cost telemetry.
- [ ] Prohibit automatic recharge and alternate-provider fallback in code/config.
- [ ] Verify browser bundles and artifacts contain no secret.
- [ ] Keep production runtime fail-closed until exact tuple evidence passes.

### Task 11: Candidate convergence

- [ ] Run focused pure/unit/component verification.
- [ ] Run TypeScript strict/typecheck.
- [ ] Run production build and bundle/secret scan.
- [ ] Run applicable browser/accessibility/visual checks without weakening existing requirements.
- [ ] Execute exact DeepSeek Harness + V4 Pro compatibility evidence.
- [ ] Execute strengthened S002 GAUNTLET.
- [ ] Independent Critic reviews contract, security, Canvas authority, persuasion truth, accessibility and deployment.
- [ ] Freeze one exact candidate SHA only after all required evidence is green.
- [ ] Report any unavailable gate as `NOT_VERIFIED`; never manufacture PASS.
