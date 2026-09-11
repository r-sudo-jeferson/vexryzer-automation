# Vexryzer Automation — Engineering Start Handoff

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
initiative_id: `VXA-001`
next_slice: `VXA-S001@1.0.0`
gauntlet_id: `GNT-VXA-S001-001`
repository: `r-sudo-jeferson/vexryzer-automation`
product_root: `job`
base_sha: `d6a7e1d1994003dff1a9a6871fe1015a049ecdb8`
planning_bootstrap_sha: `1ebb32587bded772bbb18b053865bdfee00407bc`
status: `IN_PROGRESS`

## Absolute isolation

Do not access either Machina repository for any reason. This product is greenfield and isolated.

## Mandatory reads before implementation

1. `/AGENTS.md`
2. `job/docs/product/VXA-001-product-contract.md`
3. `job/docs/architecture/VXA-001-architecture.md`
4. `job/docs/slices/VXA-slice-map.md`
5. `job/docs/slices/VXA-S001-contract.md`
6. `job/docs/gauntlets/GNT-VXA-S001-001.md`
7. `job/docs/superpowers/specs/2026-09-09-vexryzer-automation-design.md`
8. `job/docs/superpowers/plans/2026-09-09-vxa-s001-implementation-plan.md`

## Canonical repository fact

The planning/bootstrap tree remains bound to `1ebb32587bded772bbb18b053865bdfee00407bc`. Foundation hardening was promoted to `main` as `d6a7e1d1994003dff1a9a6871fe1015a049ecdb8`. On 2026-09-09 the Founder explicitly authorized continued S001 construction from that hardened `main` state and directed remote CI to run only at the final gate.

## Stack direction

Vite 8.x stable line, React 19.2, strict TypeScript, `@xyflow/react` 12.11.x, Motion 13.x, XState v5, Netlify Free. S001 contains no live LLM integration.

## Stop conditions

Stop and report rather than improvising if:
- repository access exposes Machina;
- product work would be created outside `job/`;
- a paid plan/add-on becomes necessary;
- a dependency/license conflicts with free commercial deployment;
- an S001 requirement cannot be met without changing Product/Experience Truth;
- the GAUNTLET cannot produce truthful evidence.
