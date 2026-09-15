# UXR5-00 Experience Truth Baseline Evidence

Issue: #41
Master: #40
Spatial authority: #25
Portfolio authority: #36
Baseline product SHA: `c791ae6e15502eecf41370cae2d0b907c9632f09`
Branch: `staging/vxa-s002-agent-led-accounting-seller`

This pack records truthful RED evidence for the rejected baseline. It proves gate installation, not product correction and not #42 completion.

## Preflight

- `/workspace/AGENTS.md` and repository `AGENTS.md` were read before mutation.
- Branch remained `staging/vxa-s002-agent-led-accounting-seller`.
- HEAD remained the rejected baseline SHA above.
- `git diff --check` was clean before and during harness work.
- Existing untracked S007/private-solutions files remained excluded and untouched.
- Production source was not modified by UXR5-00.
- Browser/vision processes were cleaned after targeted runs.

## Harness correction

Independent Critic review found the first RED harness disproportionate even though it was semantically RED. The corrected harness preserves existing S001/S002 contracts instead of replacing them.

- ARRIVE no longer requires renaming the existing `origin` token.
- `EVIDENCE_STATUSES = proposed/confirmed/conflicted/superseded` is preserved; #40 truth class is additive.
- Existing capability kinds are preserved; solution-family routing is additive and cannot use `preferredSolutionKind`.
- CHALLENGE proves invalidation plus no revival on the next projection; it does not force `reconcileReactiveExperience` to arbitrarily recompose.
- DEMONSTRATE covers automation, BI and agent demonstrators with alias-tolerant, non-vacuous semantics.
- PROVE requires an evidence-bound, non-vacuous reasoning/uncertainty/consequence chain without forcing one field layout.
- VALIDATE requires a revision-bound POV contract with explicit `PASS | FAIL | INCONCLUSIVE`.
- COMMIT requires the exact authorized presales allowlist, with no extra authority.
- HANDOFF requires blueprint revision/family plus full provenance and lineage preservation.
- CONTINUE makes `HANDOFF_READY` the honest presales boundary and gates fulfillment authority.
- RECOVERY covers network, retryable failure, correction transient failure, accepted-world preservation and hard-validation non-retryability.
- E2E manipulation now performs a deterministic accepted ASK turn and proves a real graph mutation before requiring causal Spatial Conductor agency.
- Ownership reuses real pan/interruption/no-reclaim behavior instead of a single wheel oracle.
- A11Y requires semantic outline/focus/live-state accessibility semantics rather than word matching.
- ARRIVE/mobile use structural world-context and first-viewport semantics rather than percentage/overlap thresholds.

## Pure lifecycle RED

Command:

```sh
node --test tests/pure/uxr5-lifecycle-baseline-red.node.test.ts
```

Observed corrected result: **17 tests; 2 PASS guards; 15 contract REDs; 0 cancelled; 0 skipped**.

The PASS guards are intentional:
1. Canvas-as-world does not require renaming `origin`.
2. Hard validation failure remains `error` and preserves accepted Canon rather than masquerading as retryable recovery.
The 15 REDs fail on missing semantic capabilities, not import/syntax failures:

| Contract area | Corrected baseline RED |
|---|---|
| DISCOVER | no separate application-owned truth-class dimension |
| FRAME | no complete correctable current-state semantic frame |
| DESIGN | no additive routing surface for all nine solution families |
| DEMONSTRATE | no heterogeneous non-vacuous family demonstrator contracts |
| PROVE | seller contract still accepts a material claim with no inspectable proof chain |
| CHALLENGE | later projection still presents invalidated evidence as current scene truth |
| VALIDATE | no revision-bound POV contract |
| DECIDE | decision frame remains incomplete |
| COMMIT | exact authorized commitment allowlist absent |
| HANDOFF | application-owned versioned handoff builder absent |
| CONTINUE | application-owned buyer-state/presales policy absent |
| CONDUCTOR | #25 semantic action vocabulary absent |
| RECOVERY / network | accepted world survives, but status becomes `error` instead of `recovery` |
| RECOVERY / retryable store-provider | same deterministic recovery gap |
| RECOVERY / correction transient | same deterministic recovery gap |

`git diff --check` remained clean after the targeted pure run.

## Static E2E verification

```sh
pnpm exec tsc -p tsconfig.e2e.json --pretty false
```

Result: exit 0.

The UXR5 E2E spec is untracked by design during #41 gate installation, so whitespace validation used `git diff --check --no-index /dev/null <file>`; it produced no whitespace errors.
## Browser Experience Truth RED

The first Playwright attempt was **rejected as environment evidence** because Playwright 1.62.1 expected a bundled headless shell that was not installed. No product conclusion was drawn from those launch failures.

The Alpine already had system Chromium:

```text
Chromium 152.0.7977.82 Alpine Linux
```

A temporary non-repository Playwright config under `/tmp` pointed `launchOptions.executablePath` to `/usr/bin/chromium`. It was removed after the runs. No browser download or rebuild was performed.

Desktop command used the existing production `dist`, one worker, zero retries, and only the six desktop UXR5 gates.

Observed result: **6/6 contract REDs**.

- ARRIVE heading: visible invitation is outside Canvas world region `section.vxa-stage`.
- ARRIVE composer: composer is in a separate co-primary region, not the Canvas world.
- CONDUCTOR: no application-owned `data-spatial-conductor` semantic actuator exists.
- OWNERSHIP: real pan/interruption and no-reclaim checks complete before RED; missing Conductor DEFER is the failure.
- MANIPULATION: deterministic ASK turn materially creates `manual-closing` before RED; missing physicalized causal Conductor agency is the failure.
- A11Y: no semantic Canvas outline exists.

No desktop failure occurred in browser launch, ASK mock application, graph mutation, pan/interruption, or other harness setup after the system-Chromium correction.

## Mobile Experience Truth RED

Single mobile gate, one worker, zero retries:

- viewport: 390×844
- observed Canvas top: `1175.28125`
- result: **1/1 contract RED**
- reason: Canvas is wholly below the first viewport, so the baseline requires page-stack traversal rather than spatial-native world access.
## Founder visual truth artifacts

Existing real screenshots were preserved and not recaptured:

- `baseline-desktop-arrive.png`
  - SHA-256 `f2a7b7664797b370e521cd0723f9b34700eb1133bf2851e998596a9e99bee139`
- `baseline-mobile-arrive.png`
  - SHA-256 `8c39e66f76f55df517bfd80230b4cdbcfeba7c5b8edc28fe0daac170cf43da12`

## Gap ownership

| Gap | Owner stage |
|---|---|
| Canvas-as-world, single Conductor, ownership, manipulation | #42 |
| adaptive discovery/current-state truth frame | #43 |
| adaptive portfolio routing/blueprints | #44 |
| heterogeneous demonstrators | #45 |
| inspectable proof/value | #46 |
| challenge/correction, risk, POV | #47 |
| decision/authorized commitment | #48 |
| handoff/continuation integrity | #49 |
| mobile, accessibility, deterministic recovery | #50 |
| premium visual convergence / Founder visual truth | #51 |

## Independent Critic

Final read-only Critic result after the last PROVE/CONDUCTOR corrections:

- CRITICAL: none
- HIGH: none
- MEDIUM: none
- verdict: **NO CRITICAL/HIGH/MEDIUM MATERIAL FINDINGS**

The final Critic specifically confirmed that PROVE rejects proof-less claims as a gate requirement and that CONDUCTOR requires runtime presence output to use the #25 semantic vocabulary, not merely export it.

## Integrity

- No forced 44 h/month, ROI, money or savings value.
- No `preferredSolutionKind`.
- No DeepSeek/provider change and no live provider call.
- No product code change made to force #41 GREEN; the baseline remains intentionally RED.
- No assertion was weakened merely to pass.
- Existing S001/S002 evidence statuses/capabilities were preserved additively.
- S007/private-solution material remains outside this execution chain.
- Browser processes were cleaned after targeted execution.
- #42 remains NOT STARTED until #41 passes as **EXPERIENCE TRUTH GATES INSTALLED AND BASELINE LEGITIMATELY RED**.
