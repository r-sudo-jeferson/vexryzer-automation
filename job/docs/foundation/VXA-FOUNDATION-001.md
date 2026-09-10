# VXA-FOUNDATION-001 — Repository Foundation Hardening

Version: 1.0.0
Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
Status: FOUNDATION_ONLY
Repository: `r-sudo-jeferson/vexryzer-automation`
Bootstrap SHA: `1ebb32587bded772bbb18b053865bdfee00407bc`

## Purpose

Establish a durable, auditable planning foundation without authorizing product construction. This document hardens repository truth, isolation, evidence integrity and authorization boundaries before `VXA-S001` may move beyond `PLANNED_NOT_AUTHORIZED`.

## Canonical bootstrap

The bootstrap SHA above identifies the first commit whose tree contains the complete planning package supplied by the Founder. A connector-imposed seed commit may precede it when the remote repository was empty; that seed has no authority beyond enabling creation of the canonical bootstrap tree.

The bootstrap package is preserved semantically. Foundation hardening may strengthen process and verification but may not authorize S001, alter Product Truth, weaken the GAUNTLET, or introduce production product code.

## Authorization lock

`VXA-S001@1.0.0` remains `PLANNED_NOT_AUTHORIZED` until an explicit Founder authorization is recorded against an exact base SHA. Planning documents, dependency research, CI integrity checks and repository metadata do not constitute authorization.

When authorization occurs, Engineering must verify that the authorized base SHA is reachable from the protected repository state and must not silently substitute a newer commit.

## Evidence integrity

Every material verification record must bind to an exact commit SHA. Evidence collected from different candidate SHAs must not be combined to claim PASS. Any candidate modification invalidates prior candidate-specific PASS evidence until the relevant checks are rerun.

Required evidence metadata for future Slice execution:
- binding ID;
- slice ID and version;
- GAUNTLET ID;
- authorized base SHA;
- candidate SHA;
- commands/checks actually executed;
- passed, failed and not-verified checks;
- reviewer/critic findings when applicable.

## Repository boundary

Allowed top-level product-bearing location: `job/`.

Allowed outside `job/` only:
- `AGENTS.md`;
- `README.md`;
- `.github/` provider glue that operates on `job/` or repository integrity.

No second product architecture, source tree, package graph, schema set, tests or runtime configuration may be created outside `job/`.

## Isolation lock

The repository must remain operationally independent from both Machina repositories. Documentation may name the forbidden repositories to state the boundary, but build/runtime/package/submodule/workflow dependencies on them are prohibited.

## Toolchain policy

At the time of this hardening (2026-09-09), current research supports the selected major lines: React 19.2, Vite 8, `@xyflow/react` 12.11, Motion 13 and XState 5. Node.js 24 is the Active LTS line and pnpm 11 requires Node.js 22+.

This is not a dependency lock. Exact compatible patch versions must be resolved and frozen in the lockfile only after S001 authorization, with license/security review and a reproducible install check. No dependency installation is authorized by this foundation hardening.

## Security baseline for the repository

- no credentials, provider tokens, production/customer data or PII in repository content;
- no Git submodule or package/workflow dependency on forbidden repositories;
- CI must validate planning bindings and repository boundary before construction work is considered trustworthy;
- future client-exposed environment variables must never contain server secrets;
- no workflow may auto-upgrade paid infrastructure or bypass required gates.

## Foundation completion criteria

Foundation hardening is complete when:
1. the exact canonical bootstrap SHA is recorded in S001 and handoff metadata;
2. structural validation runs successfully on the hardening tree;
3. CI is configured to run the same validator without product dependencies;
4. S001 remains `PLANNED_NOT_AUTHORIZED`;
5. no production application scaffold, live provider integration or fake production path is introduced.

Foundation completion is not S001 PASS and is not product construction authorization.
