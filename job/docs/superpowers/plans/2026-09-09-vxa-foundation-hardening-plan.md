# VXA Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the supplied planning bootstrap in GitHub and strengthen repository integrity without authorizing or scaffolding `VXA-S001` product implementation.

**Architecture:** Keep the Founder-supplied bootstrap as the canonical planning baseline on `main`, then apply foundation hardening on an isolated branch. Hardening consists only of repository contracts, deterministic validation and GitHub Actions provider glue; all executable validation logic and tests live under `job/`.

**Tech Stack:** Markdown contracts, Node.js standard library (`node:test`), GitHub Actions, GitHub repository API.

**Spec:** `job/docs/foundation/VXA-FOUNDATION-001.md`

## Global Constraints

- Binding remains exactly `FORGE-VEXRYZER-AUTOMATION-v1.0.0`.
- Repository remains exactly `r-sudo-jeferson/vexryzer-automation`.
- Product root remains exactly `job`.
- `VXA-S001@1.0.0` remains `PLANNED_NOT_AUTHORIZED`.
- No product scaffold, provider integration, dependency installation or production path is created.
- Machina repositories remain forbidden dependencies.
- No secrets, credentials, private evidence, customer data or PII are committed.

---

### Task 1: Persist canonical bootstrap

**Files:** existing bootstrap files only.

**Interfaces:**
- Consumes: Founder-supplied ZIP contents.
- Produces: exact bootstrap commit SHA used by all later metadata.

- [ ] Create the minimal remote seed only if required by the empty-repository GitHub API.
- [ ] Add the remaining supplied files without semantic edits.
- [ ] Fetch the resulting commit/tree and verify all ten supplied paths are present.
- [ ] Record the resulting complete-tree SHA as the canonical bootstrap SHA.

### Task 2: Add structural validator with TDD

**Files:**
- Create: `job/tests/foundation/foundation-validator.test.mjs`
- Create: `job/scripts/validate-foundation.mjs`

**Interfaces:**
- Consumes: repository root path.
- Produces: deterministic exit status and diagnostics for boundary/binding/authorization/bootstrap invariants.

- [ ] Write tests proving the validator rejects an unauthorized root product file, stale unestablished base SHA, mismatched binding, authorized S001 state, and forbidden Machina runtime/workflow dependency.
- [ ] Run tests before implementation and confirm RED because the validator module does not exist.
- [ ] Implement only the checks required by the tests plus canonical required-file checks.
- [ ] Run the tests and standalone validator and confirm GREEN.

### Task 3: Bind planning metadata to the real bootstrap

**Files:**
- Modify: `job/docs/slices/VXA-S001-contract.md`
- Modify: `job/docs/handoffs/ENGINEERING-START.md`
- Modify: `AGENTS.md`
- Modify: `README.md`
- Create: `job/docs/foundation/VXA-FOUNDATION-001.md`

**Interfaces:**
- Consumes: canonical bootstrap SHA from Task 1.
- Produces: explicit authorization/evidence contract tied to repository truth.

- [ ] Replace the planning placeholder base SHA with the exact canonical bootstrap SHA.
- [ ] Preserve S001 status as `PLANNED_NOT_AUTHORIZED`.
- [ ] Add repository-truth/evidence rules without changing Product or Experience Truth.
- [ ] Run the validator and tests.

### Task 4: Add CI integrity gate

**Files:**
- Create: `.github/workflows/foundation-integrity.yml`

**Interfaces:**
- Consumes: repository checkout and Node.js runtime.
- Produces: CI evidence for the same tests/validator used locally.

- [ ] Configure checkout with minimal permissions and Node.js 24.
- [ ] Run `node --test job/tests/foundation/foundation-validator.test.mjs`.
- [ ] Run `node job/scripts/validate-foundation.mjs`.
- [ ] Do not install product dependencies.
- [ ] Validate workflow YAML structure locally where tooling permits.

### Task 5: Freeze hardening candidate and review

**Files:** hardening branch tree only.

**Interfaces:**
- Consumes: all previous task outputs.
- Produces: exact candidate SHA and PR review surface.

- [ ] Re-run tests and standalone validator from a clean hardening tree.
- [ ] Scan committed text for obvious credential patterns and the obsolete base-SHA placeholder.
- [ ] Compare hardening tree against canonical bootstrap and verify changes are foundation-only.
- [ ] Create one candidate commit on an isolated branch.
- [ ] Open a PR against `main` and report candidate SHA, checks executed and checks not verified.
