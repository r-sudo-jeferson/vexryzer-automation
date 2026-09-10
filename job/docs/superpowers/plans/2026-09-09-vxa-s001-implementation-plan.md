# VXA-S001 Foundation + Infinite Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use disciplined task-by-task execution, TDD, independent review and verification before completion.

**Goal:** Build the permanent production-grade visual/state foundation for the Vexryzer Automation Infinite Canvas without implementing live ASK AI yet.

**Architecture:** Vite + React + strict TypeScript renders a React Flow canvas. A small typed application-state layer defines camera modes and node contracts; Motion provides non-essential physical transitions while reduced-motion mode preserves equivalent comprehension. All product files live under `job/`.

**Tech Stack:** Vite 8.x, React 19.2, TypeScript, @xyflow/react 12.11.x, Motion 13.x, XState v5, Vitest, Testing Library, Playwright, axe, pnpm.

**Spec:** `job/docs/superpowers/specs/2026-09-09-vexryzer-automation-design.md`

## Global constraints

- Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`.
- Never access Machina repositories.
- All product files under `job/` except unavoidable provider glue.
- No live Mistral integration in S001.
- No fake production AI, upload or submission paths.
- Free-tier-compatible dependencies only.
- TypeScript strict; no `any` escape hatches without explicit reviewed justification.
- Accessibility and reduced motion are part of S001, not deferred polish.

## Planned file map

- `job/package.json`: scripts/dependencies for product.
- `job/pnpm-lock.yaml`: immutable dependency graph.
- `job/vite.config.ts`: Vite + Netlify-compatible plugin configuration when required.
- `job/tsconfig*.json`: strict browser/test configuration.
- `job/src/main.tsx`: client bootstrap only.
- `job/src/app/App.tsx`: top-level composition.
- `job/src/app/app-machine.ts`: deterministic high-level experience/camera state.
- `job/src/design/tokens.css`: product design tokens.
- `job/src/design/global.css`: reset/global surfaces/accessibility defaults.
- `job/src/canvas/AutomationCanvas.tsx`: React Flow boundary.
- `job/src/canvas/domain.ts`: typed node/edge/provenance contracts.
- `job/src/canvas/nodes/*`: focused node components.
- `job/src/canvas/camera.ts`: camera command abstraction.
- `job/src/canvas/semantic-zoom.ts`: zoom band policy.
- `job/src/canvas/fixtures.ts`: explicitly non-production GAUNTLET fixtures.
- `job/src/accessibility/useReducedMotionPolicy.ts`: central reduced-motion adaptation.
- `job/tests/unit/*`: pure contracts/machine/zoom tests.
- `job/tests/component/*`: node/canvas interaction tests.
- `job/tests/e2e/*`: keyboard/responsive/camera journeys.
- `job/tests/visual/*`: deterministic visual-state capture configuration.

## Task 1 — Repository/product foundation

Reviewer-rejectable outcome: `job/` builds a minimal strict React app and contains no product files outside the boundary.

Steps:
1. Write structural tests/scripts that fail if product source/config escapes `job/` except the permitted root files/glue.
2. Scaffold Vite React TypeScript inside `job/` using current stable compatible versions.
3. Enable strict TS, deterministic pnpm install and explicit build/typecheck/test scripts.
4. Add `.gitignore` rules including `.netlify/` and `node_modules/`.
5. Run install, typecheck, unit placeholder harness and production build; capture RED before scaffold and GREEN after.
6. Commit only this independently verifiable foundation.

## Task 2 — Design system contract

Reviewer-rejectable outcome: tokens and primitives render Black Titanium / Liquid Graphite / Platinum surfaces with accessible contrast and no generic template styling.

Steps:
1. Define token contract tests for required semantic variables and reduced-motion policy hooks.
2. Implement tokens for background/surface/text/border/depth/focus/accent/status/spacing/radius/type/motion.
3. Implement global CSS with accessible focus and selection states.
4. Create deterministic visual fixture page/states for review.
5. Run component/a11y checks and capture visual evidence.
6. Commit independently.

## Task 3 — Typed canvas domain and node primitives

Reviewer-rejectable outcome: representative source/manual/system/output/uncertainty nodes render from typed contracts and provenance is explicit.

Steps:
1. Write failing contract tests for node kinds, required IDs, provenance values and invalid combinations.
2. Implement discriminated-union domain contracts.
3. Implement focused node components with no business logic inside presentation.
4. Test long labels, missing optional metadata and provenance states.
5. Run unit/component/a11y tests.
6. Commit independently.

## Task 4 — Infinite Canvas shell

Reviewer-rejectable outcome: React Flow renders typed fixtures with controlled pan/zoom and no accidental editing affordances that imply the user is building a diagram.

Steps:
1. Write failing interaction tests for viewport behavior, node focus and disabled editing behaviors.
2. Implement AutomationCanvas with only required React Flow features.
3. Configure touch/mouse/trackpad interaction intentionally.
4. Verify 1-node, standard and 20-node fixtures.
5. Profile rerenders during viewport movement; remove unnecessary subscriptions.
6. Commit independently.

## Task 5 — Semantic zoom

Reviewer-rejectable outcome: far/medium/near zoom bands progressively disclose content without unreadable scaling or layout collisions.

Steps:
1. Write pure failing tests for zoom-band thresholds and boundary values.
2. Implement stable zoom-band policy with hysteresis if required by flicker testing.
3. Connect node presentation to semantic bands without global rerender storms.
4. Test long labels and 20-node fixture at each band.
5. Capture visual evidence.
6. Commit independently.

## Task 6 — Camera director and state machine

Reviewer-rejectable outcome: origin/process/focus camera states are deterministic, interruptible safely and independently testable.

Steps:
1. Write failing XState transition tests for allowed/forbidden camera-state events.
2. Implement app machine and camera command abstraction.
3. Test duplicate events, rapid transitions, interruption and resize during transition.
4. Connect to canvas viewport without letting viewport state become business authority.
5. Run unit/e2e interaction tests.
6. Commit independently.

## Task 7 — Mobile directed experience

Reviewer-rejectable outcome: mobile provides a directed reading/interaction path and no core action requires pinch/pan.

Steps:
1. Write mobile E2E tests for representative 360/390/430 widths.
2. Implement responsive composition and safe viewport/keyboard behavior.
3. Validate touch pan does not conflict with vertical page interaction.
4. Run mobile visual/a11y tests.
5. Commit independently.

## Task 8 — Accessibility + reduced motion

Reviewer-rejectable outcome: keyboard, visible focus, semantic labels and reduced-motion equivalent journey pass the S001 contract.

Steps:
1. Write failing keyboard and reduced-motion E2E scenarios.
2. Implement central motion policy and focus behavior.
3. Ensure camera focus changes do not steal/lose semantic focus.
4. Run axe across defined fixtures and resolve all serious/critical findings.
5. Validate 200% zoom and text enlargement manually/automatically where feasible.
6. Commit independently.

## Task 9 — Performance/visual GAUNTLET harness

Reviewer-rejectable outcome: repeatable evidence can be generated for GNT-VXA-S001-001.

Steps:
1. Add production-build E2E launch path and deterministic fixtures.
2. Add render-count/performance observation hooks that do not ship enabled to production.
3. Add screenshot matrix for required desktop/mobile/focus/reduced-motion states.
4. Run browser matrix available in CI/local environment.
5. Produce GAUNTLET evidence manifest tied to exact SHA.
6. Commit independently.

## Task 10 — S001 convergence

Reviewer-rejectable outcome: exact candidate SHA satisfies every S001 acceptance criterion and GAUNTLET item or remains explicitly NOT VERIFIED.

Steps:
1. Run clean frozen install.
2. Run unit/component/e2e/accessibility suites.
3. Run strict typecheck and production build.
4. Run visual/performance matrix and inspect captures independently.
5. Check repository boundary, dependency licenses and absence of provider secrets.
6. Resolve findings without weakening tests/contracts.
7. Freeze candidate SHA only after all evidence corresponds to the same commit.
8. Do not start S002 until GNT-VXA-S001-001 is accepted.
