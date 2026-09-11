# VXA-S001 Slice Contract

slice_id: `VXA-S001`
slice_version: `1.0.0`
initiative_id: `VXA-001`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
status: `IN_PROGRESS`
predecessors: none
repository: `r-sudo-jeferson/vexryzer-automation`
product_root: `job`
base_sha: `d6a7e1d1994003dff1a9a6871fe1015a049ecdb8`
planning_bootstrap_sha: `1ebb32587bded772bbb18b053865bdfee00407bc`
gauntlet_id: `GNT-VXA-S001-001`

## Objective

Create the production-grade visual and state foundation for Vexryzer Automation: an ultra-premium Infinite Canvas shell that can later host ASK AI, process understanding, value and evidence without rewriting the interaction model.

## Observable result

A user can open the application on desktop or mobile, experience the premium origin state, move through scripted camera states, inspect representative process nodes, use keyboard navigation, opt into reduced motion and explore the canvas without any core action depending on pan/zoom.

## Scope

- Vite/React/TypeScript strict product foundation under `job/`;
- Netlify-compatible project configuration under `job/`;
- design token contract for Black Titanium / Liquid Graphite / Platinum surfaces and controlled spectral accents;
- typography and spacing system;
- React Flow canvas shell;
- typed domain node definitions;
- node visual primitives;
- deterministic sample process used only as a visual/interaction fixture;
- camera director modes;
- semantic zoom behavior;
- responsive desktop and mobile composition;
- keyboard navigation and visible focus;
- `prefers-reduced-motion` handling;
- initial error boundary and empty state;
- performance instrumentation and budget tests;
- visual stories/fixtures sufficient for GAUNTLET review.

## Exclusions

- live LLM requests;
- ASK AI production conversation;
- authoritative pricing;
- real uploads;
- durable submissions;
- email delivery.

These belong to later Slices. S001 must create no fake production path for them.

## Product Truth

The Canvas is the primary visual environment, but never a barrier to conversion. S001 proves that it can be beautiful, legible, responsive and accessible before AI complexity is introduced.

## Experience Truth

The first screen must feel like a high-end product immediately. The user sees one primary invitation, not a dashboard. The canvas camera can direct attention without disorienting the user. Motion must feel physical and intentional, never decorative noise.

## Engineering Truth

Canvas state, camera modes, node contracts and viewport behavior are typed and deterministic. Production code contains no LLM mock pretending to be real AI.

## Invariants

- all product files under `job/` except permitted glue;
- no Machina access/dependency;
- no paid infrastructure requirement;
- no horizontal scroll caused by layout bugs;
- no essential content only visible through animation;
- reduced motion preserves comprehension;
- mobile does not require pan or pinch;
- canvas nodes remain understandable under semantic zoom;
- no secret/env contract in client bundle;
- attribution/licensing requirements for third-party components are respected unless a free legal removal path exists.

## Non-regression contract

Later Slices may add intelligence and commercial surfaces but may not replace the Infinite Canvas with a conventional form, degrade accessibility/mobile/performance, move critical authority into the LLM, or weaken this GAUNTLET.

## Non-functional requirements

Performance target baseline:
- LCP p75 target < 2.5s on production-like build/network profile;
- INP p75 target < 200ms;
- CLS target < 0.1;
- viewport interaction remains visually smooth on representative modern mobile/desktop hardware;
- no decorative animation creates persistent main-thread long tasks.

Accessibility target:
- WCAG 2.2 AA behaviors applicable to this Slice;
- complete keyboard access to all S001 interactive controls;
- visible focus;
- reduced motion;
- usable zoom up to 200%;
- semantic labels for canvas controls/nodes.

## Acceptance criteria

1. `pnpm build` succeeds from `job/` with strict TypeScript gates.
2. Canvas renders without runtime errors at representative desktop and mobile sizes.
3. Origin, process and focus camera modes are deterministic and covered by tests.
4. Representative node classes support semantic zoom without content collisions at defined zoom bands.
5. Keyboard-only user can reach and inspect all interactive S001 controls.
6. Reduced-motion mode eliminates non-essential transforms/animated travel without breaking navigation.
7. Automated accessibility checks contain no serious/critical findings in defined fixtures.
8. Production build contains no provider secret or live AI dependency.
9. Visual evidence is captured for both premium themes/states defined in design contract.
10. GNT-VXA-S001-001 passes on the exact candidate SHA before S002 begins.
