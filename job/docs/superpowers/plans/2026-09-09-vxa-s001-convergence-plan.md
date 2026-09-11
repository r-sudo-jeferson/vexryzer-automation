# VXA-S001 Convergence Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use Superpowers TDD for behavioral corrections, systematic debugging for failures, independent critique, and verification-before-completion before any PASS claim.

**Goal:** Converge the current `VXA-S001@1.0.0` checkpoint toward the exact Product/Experience/Engineering Truth and `GNT-VXA-S001-001` without introducing S002 behavior.

**Architecture:** Preserve the existing Vite/React/XState/React Flow foundation. Correct contract drift at typed-domain and UX boundaries, make GAUNTLET fixtures explicit, keep mobile navigation camera-directed and non-gesture-dependent, keep performance probing disabled by default, and strengthen Playwright/visual evidence generation.

**Tech Stack:** Vite 8.x, React 19.2, TypeScript strict, `@xyflow/react` 12.11.x, Motion 13.x, XState v5, Node test runner, Vitest, Playwright, axe.

**Spec:** `job/docs/slices/VXA-S001-contract.md`

## Global constraints

- Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`.
- Authorized base: `d6a7e1d1994003dff1a9a6871fe1015a049ecdb8`.
- GAUNTLET: `GNT-VXA-S001-001`.
- Product root: `job`.
- Never access Machina repositories.
- No live ASK AI, LLM, pricing, upload, submission, email or provider path.
- No paid infrastructure.
- Do not create a lockfile unless dependencies are resolved by a real package-manager install.
- Remote CI remains `OPTIMIZED_GATES_ONLY`.

---

### Task 1 — Canonical provenance + missing GAUNTLET fixtures

**Files:**
- Modify: `job/src/canvas/domain.ts`
- Modify: `job/src/canvas/fixtures.ts`
- Modify: `job/src/canvas/nodes/ProcessNode.tsx`
- Modify: `job/src/app/App.tsx`
- Modify: `job/tests/pure/domain.node.test.ts`
- Modify: `job/tests/pure/fixtures.node.test.ts`
- Modify: `job/tests/e2e/foundation.spec.ts`

**Interfaces:**
- `PROVENANCE_VALUES` remains exactly the architecture vocabulary: `user_stated | ai_inferred | user_confirmed`.
- `ProcessFixture['id']` gains deterministic `duplicateLabels` and `provenance` fixtures only.
- Query fixture resolution remains local/static and never creates a network path.

- [ ] Change the provenance vocabulary test first so `fixture` is rejected as non-canonical; verify RED against the current domain.
- [ ] Add fixture-contract tests requiring duplicate labels with distinct IDs and representation of all three canonical provenance states; verify RED.
- [ ] Replace fixture-only provenance values with canonical sample provenance and remove the presentation label for `fixture`.
- [ ] Add `duplicateLabels` and `provenance` deterministic fixtures and expose them through existing fixture resolution.
- [ ] Extend E2E coverage so duplicate labels remain individually addressable and provenance/uncertainty fixtures are reachable without canvas gestures.

### Task 2 — Public experience surface + skip-target correctness

**Files:**
- Modify: `job/src/app/App.tsx`
- Modify: `job/src/app/ErrorBoundary.tsx`
- Modify: `job/src/app/app.css`
- Create: `job/tests/pure/public-experience-contract.node.test.ts`
- Modify: `job/tests/e2e/accessibility.spec.ts`

**Interfaces:**
- Public copy must not expose Slice IDs, engineering checkpoint labels or infrastructure implementation details.
- The origin keeps exactly one primary CTA.
- `#vxa-primary` is a valid keyboard skip destination.

- [ ] Write a pure source-contract test that fails while public UI contains `S001`, `VISUAL FOUNDATION`, `FREE-TIER ARCHITECTURE` or `nenhum dado é enviado nesta Slice`, and while the main skip target lacks `tabIndex={-1}`; verify RED.
- [ ] Replace engineering-facing chrome with product-facing local-demo/privacy copy without adding a second primary CTA.
- [ ] Add `tabIndex={-1}` to the main skip target and verify the skip link transfers focus in Playwright.
- [ ] Keep error recovery factual and product-facing; remove internal recovery marker copy.

### Task 3 — Directed mobile navigation without horizontal dependence

**Files:**
- Modify: `job/src/app/app.css`
- Modify: `job/tests/e2e/foundation.spec.ts`

**Interfaces:**
- Mobile process-step navigation is vertical and independently usable.
- No core step requires horizontal swiping, canvas pan or pinch.

- [ ] Add mobile E2E coverage that reaches a late stress-fixture step at 360/390/430 widths through ordinary button navigation and asserts document horizontal overflow is absent.
- [ ] Replace the <=980px horizontal step carousel with a bounded vertical list using vertical scrolling only.
- [ ] Preserve touch targets, focus visibility and the three focus navigation controls.

### Task 4 — Performance instrumentation opt-in

**Files:**
- Modify: `job/src/performance/usePerformanceInstrumentation.ts`
- Create: `job/tests/pure/performance-instrumentation.node.test.ts`

**Interfaces:**
- `window.__VXA_PERF__` is absent during normal production use.
- `?perf=1` enables the existing long-task probe for GAUNTLET measurement.

- [ ] Write a pure source-contract test requiring an explicit `perf=1` opt-in and absence of unconditional global initialization; verify RED.
- [ ] Gate initialization/observer setup on the explicit local query flag while preserving current budgets.
- [ ] Preserve unsupported-browser behavior without exceptions or network calls.

### Task 5 — GAUNTLET visual/accessibility matrix

**Files:**
- Modify: `job/tests/visual/s001.visual.spec.ts`
- Modify: `job/tests/e2e/accessibility.spec.ts`
- Modify: `job/tests/e2e/foundation.spec.ts`

**Interfaces:**
- Required responsive matrix: 1440x1080, 1366x768, 1024x768, 768x1024, 430x932, 390x844, 360x800.
- Visual evidence includes origin, process, focus, keyboard focus, reduced motion, long content, duplicate labels, provenance/uncertainty and empty state.
- Accessibility covers keyboard journey, visible focus, reduced motion and 200% browser zoom where Playwright supports deterministic automation.

- [ ] Expand visual tests to capture the required states deterministically with animations disabled.
- [ ] Add 200% zoom/no-horizontal-overflow and complete keyboard-step navigation assertions.
- [ ] Keep axe serious/critical = 0 across origin, standard, long-content and provenance fixtures.

### Task 6 — Static security/repository regression checks

**Files:**
- Modify only if needed after inspection: `job/tests/pure/security-surface.node.test.ts`, `job/scripts/validate-foundation.mjs`.

- [ ] Preserve no `fetch`, XHR, WebSocket, EventSource, raw HTML injection or client-secret contract in S001 source.
- [ ] Preserve root/product boundary and optimized CI policy validation.
- [ ] Recheck changed files for credential/token patterns before publishing.

### Task 7 — Local/proportional verification and checkpoint

- [ ] Run dependency-free Node tests possible in the sandbox against exact edited source/test snapshots.
- [ ] Attempt real package installation from `job/package.json`; if DNS remains unavailable, record dependency install, lockfile generation, Vitest, build and Playwright as `NOT_VERIFIED` rather than weakening gates.
- [ ] Inspect the final diff for S001-only scope, `job/` boundary, no provider code and no secrets.
- [ ] Persist a coherent checkpoint on `slice/vxa-s001-foundation-canvas`.

### Task 8 — Candidate freeze + hosted convergence gate

- [ ] Resolve `job/pnpm-lock.yaml` only through a real package-manager resolution in an environment with registry access.
- [ ] Run foundation validator, pure/unit/component tests, strict typecheck, production build, Playwright desktop/mobile, axe, visual matrix and security scans on one exact candidate SHA.
- [ ] Perform independent experience critique on captured states.
- [ ] Freeze `github_candidate_sha` only after all candidate-specific evidence is consistent.
- [ ] Execute `GNT-VXA-S001-001` and final hosted CI on that exact SHA; a changed candidate invalidates prior PASS.
- [ ] Keep final state `IN_PROGRESS`/`NOT_VERIFIED` unless the exact candidate has proportional PASS evidence.
