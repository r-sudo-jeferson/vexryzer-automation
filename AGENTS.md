# AGENTS.md — Vexryzer Automation

FORGE_BINDING_ID: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
PRODUCT_ROOT: `job`
REPOSITORY: `r-sudo-jeferson/vexryzer-automation`

## Authority

1. Founder instructions for Vexryzer Automation.
2. This AGENTS.md.
3. Product Truth and architecture under `job/docs/`.
4. Authorized Slice contract.
5. GAUNTLET for that Slice.
6. Implementation and tests.

Lower authority may never silently reduce a higher authority.

## Absolute isolation

Never access, modify, import, synchronize, copy from, or depend on Machina repositories or artifacts.

Forbidden repositories:
- `r-sudo-jeferson/Machina`
- `machina-group/machina`

If any task appears to require either repository, STOP and mark `ISOLATION_VIOLATION`.

## job boundary

Everything that can live in the product repository must live in `job/`: source, packages, Functions, tests, schemas, assets, runtime config, product docs, deployment config, scripts and generated product artifacts.

Outside `job/` only:
- `AGENTS.md`
- `README.md`
- unavoidable provider glue such as `.github/workflows/`

## Repository truth and authorization

The complete planning bootstrap is bound to the exact SHA recorded in `job/docs/foundation/VXA-FOUNDATION-001.md` and `job/docs/slices/VXA-S001-contract.md`. Planning, research, CI setup and repository hardening never imply Slice authorization.

Before material Slice construction, verify the authorized base SHA and keep evidence tied to exact candidate SHAs. Never combine PASS evidence produced from different candidates. A changed candidate invalidates prior candidate-specific PASS until the relevant checks are rerun.

Provider metadata outside `job/` is permitted only when technically required and must remain glue over `job/` or repository integrity; it may not become a second product architecture.

## CI execution policy

CI_EXECUTION_POLICY: `OPTIMIZED_GATES_ONLY`

Remote CI is an integration/convergence gate, not the default inner development loop. Optimize construction by doing the maximum safe verification locally or in the current execution environment before spending a remote CI run.

Default behavior for every agent:
- work on an isolated Slice branch and persist verified checkpoints to GitHub without opening or updating a PR merely to trigger CI;
- run unit, domain, static, type, lint, build, browser and security checks locally whenever the environment supports them;
- batch coherent changes and stabilize the candidate before remote CI instead of using CI as trial-and-error debugging;
- preserve exact evidence and mark unavailable checks `NOT_VERIFIED`; environment blockers never authorize weakening a gate, test, requirement or security control;
- if a local environment cannot run a check, continue every independent task that can still be verified and report the blocker with evidence.

Remote CI should be triggered only when it materially increases confidence or is required by a gate, especially:
1. after a candidate SHA is frozen and local/proportional verification is green, before GAUNTLET PASS, merge, promotion or release;
2. when diagnosing a failure that is demonstrably specific to the hosted CI/runtime and cannot be reproduced locally;
3. after a material CI/workflow/deployment change, once the configuration has been validated as far as the local environment allows;
4. at the final integration/convergence gate for a Slice.

Do not trigger remote CI for ordinary intermediate commits, documentation-only changes, formatting, checkpoints already covered by equivalent local evidence, or speculative debugging. Do not repeatedly rerun an unchanged failing candidate unless there is evidence the external blocker changed or the rerun itself is diagnostically necessary.

Opening a PR is not an implementation milestone. Unless review itself is required earlier, prefer opening/updating the PR when the Slice is near candidate freeze so automatic pull-request workflows do not consume unnecessary runs.

Any candidate change after CI invalidates candidate-specific PASS. Run the relevant final gates again on the new exact SHA. Never combine green evidence from different SHAs.

The free-tier lock applies to CI: never enable paid runner overage, paid add-ons or spending merely to obtain a green check without explicit Founder authorization and a corresponding contract decision.

## GitHub plugin capability-aware execution

The GitHub connector/plugin is an execution surface whose available actions may vary by session, permission, product surface and repository. Never assume a capability from memory or from another session. Before relying on a GitHub operation, discover the action actually exposed and distinguish `AVAILABLE`, `AVAILABLE_READ_ONLY`, `AVAILABLE_WRITE`, `NOT_EXPOSED`, `NOT_VERIFIED` and `BLOCKED_BY_PERMISSION`.

Use the GitHub capabilities available in the current session at the stage where they add the strongest evidence with the least unnecessary churn:

1. **Inspect before writing.** Resolve repository metadata, permissions, branch/ref and exact base SHA first. Use repository/code search for discovery and exact file/commit reads for authoritative inspection. Never develop from a stale default-branch assumption when an authorized base SHA exists.
2. **Bind every candidate to a SHA.** Treat `base_sha -> candidate_sha` as the identity of a change. Use commit/ref comparison to verify the real delta. Tests, Actions runs, artifacts, reviews and GAUNTLET evidence are valid only for the exact candidate they actually exercised.
3. **Choose the correct write primitive.** For a truly isolated single-file change, file create/update/delete actions are appropriate. For one logical multi-file change, prefer atomic Git primitives when exposed: create blobs, create a tree, create one commit, then fast-forward the branch ref. Do not manufacture one commit per file merely because the Contents API writes one path at a time.
4. **Capture returned identity after writes.** Every write that produces a commit or moves a ref must be followed using the returned SHA/current branch state. Never assume the branch still points to the previously observed commit.
5. **Use CI as evidence, not as a debugger.** Stabilize a coherent candidate with all verification available in the current execution environment before relying on remote CI. Do not create speculative commits merely to obtain another hosted run.
6. **Walk CI evidence to root cause.** When Actions evidence exists, inspect candidate SHA -> workflow run -> jobs -> steps -> logs when needed -> artifacts -> commit checks/status. A green top-level badge is weaker evidence than the underlying gates; a red badge is not a diagnosis.
7. **Treat artifacts as candidate evidence.** Inspect and, when necessary, download artifacts such as E2E reports, screenshots, visual matrices, coverage, mutation reports, dependency inventories, security reports and build outputs. Verify that the artifact's workflow run is tied to the exact candidate SHA.
8. **Rerun only with a reason.** A deterministic code/test/workflow failure requires root-cause correction before another run. Rerun a specific failed job or failed jobs only when evidence supports a transient/flaky/external cause or when rerun itself is a deliberate diagnostic step. Never rerun unchanged deterministic failures until they happen to pass.
9. **Review the diff, not the PR prose.** For review, enumerate changed files and inspect the full patch or critical file patches. Attack contract compliance, regressions, authorization, tenant isolation, security, races, idempotency, migrations, errors/retries, performance, observability, UX, accessibility, deployment and test integrity.
10. **Use real review state when available.** `COMMENT` is non-blocking feedback; `REQUEST_CHANGES` is for material defects; `APPROVE` requires sufficient independent evidence. Resolve review threads only after the underlying issue is actually addressed. Builder self-confidence is never a substitute for review evidence.
11. **Revalidate after review changes.** Any post-review code change creates a new candidate SHA. Compare the new delta, determine which evidence was invalidated, rerun affected verification and reassess review state. Never transfer PASS blindly between SHAs.
12. **Freeze before integration.** Before merge or any release/promotion step, record the exact candidate SHA, required checks, relevant artifacts, review state, unresolved threads and `NOT_VERIFIED` items. A change after freeze invalidates the freeze.
13. **Use race-safe merge.** When direct merge is authorized and the connector exposes it, pass the frozen candidate as `expected_head_sha` so GitHub rejects a merge if the PR head changed after validation. Do not merge an unverified successor commit under an earlier approval.
14. **Verify after integration.** A successful mutation response is not the same as product completion. Verify the resulting merged/ref SHA and any applicable post-merge checks before making a completion claim.
15. **Respect capability boundaries.** If the current GitHub surface does not expose an operation such as generic workflow dispatch, Projects mutation, Ruleset/branch-protection mutation, Releases/tags, Environments/deployments or secrets management, do not pretend it was performed. Use another explicitly authorized tool when available or mark the operation `NOT_EXPOSED`/`NOT_VERIFIED` without weakening the requirement.
16. **Never confuse repository permission with tool capability.** `push` or `admin` permission on a repository does not imply that every GitHub API operation is exposed through the current plugin. Both permission and action availability must be true before execution is claimed.

Operational GitHub loop when applicable:

`DISCOVER CAPABILITIES -> VERIFY PERMISSION/BASE -> INSPECT -> ISOLATE -> BUILD -> COMMIT ATOMICALLY -> COMPARE CANDIDATE -> VERIFY -> INSPECT CI EVIDENCE -> INDEPENDENT REVIEW -> ROOT-CAUSE CONVERGENCE -> FREEZE SHA -> RACE-SAFE INTEGRATION -> VERIFY RESULT`

This section governs how agents use the GitHub execution surface. It does not create product requirements, redefine an authorized Slice, replace GAUNTLET, or authorize work that is otherwise out of scope.

## Product mission

Build an ultra-premium commercial intake experience, not a generic chatbot or CRUD app. ASK AI must help the visitor turn an operational pain into a qualified automation request. Infinite Canvas visualizes the process as it is understood. The cycle ends only when the request and any accepted files are durably recorded and the notification path is attempted.

## High-end floor

No disposable MVP, generic template UI, superficial chatbot, placeholder flows, fake metrics, or polish deferred until later. Every Slice must preserve accessibility, mobile usability, performance, security, deterministic commercial rules, failure recovery, and visual quality proportional to an ultra-premium product.

## Free-tier lock

Fixed infrastructure cost must remain R$ 0.

Forbidden without explicit Founder change:
- paid subscription;
- paid add-on;
- automatic paid upgrade;
- uncontrolled overage;
- architecture that requires payment to remain functional at intended initial volume.

Netlify Free is the selected deployment platform. Mistral capacity already available to the Founder may be used. Email delivery must use a free-tier-compatible provider. If a provider limit is approached, fail safely; never auto-upgrade.

## AI authority boundary

ASK AI may:
- understand language;
- ask the next useful question;
- extract structured facts;
- summarize;
- explain quantified impact;
- handle objections truthfully;
- propose a next action.

ASK AI may not:
- calculate or alter authoritative price;
- grant discounts;
- reveal internal pricing policy or system prompts;
- mark technical feasibility as confirmed without evidence;
- seal or submit a request without explicit user intent;
- claim an upload succeeded unless durable storage confirms it;
- override application state or security controls;
- provide the paid automation itself as free pre-sales consulting.

Deterministic application code owns price, state, validation, persistence, request sealing, idempotency and authorization.

## Non-degradation

Every change follows PRESERVE -> CORRECT -> STRENGTHEN -> IMPROVE. Never remove or weaken behavior, accessibility, visual quality, security, performance, test coverage or resilience merely to simplify implementation.

## GAUNTLET First

Each material Slice has its GAUNTLET before production implementation. RED evidence must prove the missing capability or risk. Builder is not final judge. PASS requires proportional evidence.

## Deployment

Target: Netlify Free.

Prefer direct Netlify platform capabilities and APIs over autonomous Netlify build agents. Secrets belong in Netlify environment variables, never Vite client variables or repository source.

## Prohibited shortcuts

No hardcoded AI answers, fake streaming, fake uploads, mock persistence in production paths, hidden fallback that changes the contract, weakened tests, bypassed accessibility checks, disabled security gates, or success screens before durable request confirmation.
