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

## GitHub plugin execution baseline

GITHUB_PLUGIN_CAPABILITY_BASELINE: `VXA-GH-2026-09-10-v1`

This baseline records the GitHub connector/plugin surface that was explicitly exposed and inspected for `r-sudo-jeferson/vexryzer-automation` on 2026-09-10. Agents MUST use this baseline directly and MUST NOT repeat full capability discovery at the start of each execution.

Capability discovery is fallback behavior, not normal preflight. Re-discover only when at least one of these conditions is true:

- an operation required by the active work is not listed in this baseline;
- a listed action is unavailable at runtime;
- GitHub returns a permission/capability error inconsistent with this baseline;
- the repository connection or plugin permission configuration changed;
- the ChatGPT product/tool surface materially changed and the new capability is needed;
- the Founder explicitly requests a capability audit.

A destructive or consequential action may still require authorization from the active task/contract. That is an authorization question, not a reason to rediscover the plugin surface.

### Validated repository access

For `r-sudo-jeferson/vexryzer-automation`, the connected GitHub repository metadata reported:

- repository visibility: public;
- `pull=true`;
- `triage=true`;
- `push=true`;
- `maintain=true`;
- `admin=true`.

The ChatGPT GitHub plugin permission was inspected as allowing actions for the connection at the time this baseline was established. Repository permission does not create plugin operations that are absent from the connector surface.

### AVAILABLE_READ / inspection capabilities

Agents may use the following without rediscovering whether they exist:

- locate/search accessible repositories and read repository metadata/permissions;
- search repository code/files;
- fetch exact UTF-8 file content by path and optional branch/tag/commit ref;
- fetch blobs by SHA;
- fetch commit metadata/diff and search commits;
- search branches;
- compare two commits or refs with per-file change metadata;
- read public GitHub repository resources through the connector's approved GET surface, including supported repository, directory, code-search, issue, PR, commit, branch, workflow-run, release, Git-data, commit-status and ruleset endpoints when the connector permits that endpoint;
- search/fetch Issues and Issue comments;
- search/fetch PRs and PR metadata;
- enumerate changed PR filenames;
- fetch a complete PR patch/diff or the patch for an exact changed file;
- list PR review submissions and inline review threads;
- fetch merged PR discussion timelines;
- read combined commit status and individual status checks;
- fetch workflow runs associated with an exact commit where supported by the connector; the currently exposed wrapper is limited to pull-request-triggered runs on its first page;
- fetch workflow jobs and their step summaries;
- fetch decoded workflow job logs;
- list workflow-run artifacts;
- download workflow artifacts as reusable ZIP file references;
- inspect reactions where the corresponding Issue/PR/review capability exposes them.

### AVAILABLE_WRITE / construction capabilities

Agents may use these actions when the active task authorizes the underlying repository mutation:

#### Files and Git objects

- create a new UTF-8 repository file on an existing branch;
- replace an existing UTF-8 repository file using its current blob SHA for optimistic concurrency;
- delete an existing file using its current blob SHA;
- create Git blobs;
- create Git trees, optionally over a base tree;
- create Git commits from a tree and parent SHA, including additional parents when intentionally required;
- create a branch from an exact SHA or existing base ref;
- fast-forward/update a branch ref to an exact commit SHA; force updates are technically exposed but MUST NOT be used unless explicitly justified and authorized.

Use file create/update/delete for a truly isolated single-path change. For one logical multi-file change, prefer `blob(s) -> tree -> commit -> update_ref` when atomicity matters. Do not manufacture one commit per file merely because the Contents API is path-oriented.

#### Issues

- create Issues with body, labels, assignees and milestone number when valid;
- update Issue title/body/state/state reason/labels/assignees/milestone;
- add/remove assignees;
- add/remove labels;
- add/update top-level Issue/PR conversation comments where exposed;
- lock/unlock Issue or PR conversations;
- add/remove supported reactions to Issue comments.

Issue machinery is optional engineering traceability unless a higher-authority contract requires it. Never create bureaucracy merely because the action exists.

#### Pull requests and review

- create PRs, including draft PRs, from head to base;
- update PR title/body/base/open/closed state and maintainer modification setting;
- convert an open PR to draft;
- mark a draft PR ready for review;
- request/remove individual or team reviewers;
- label PRs;
- add top-level PR conversation comments;
- submit real PR reviews using `COMMENT`, `APPROVE` or `REQUEST_CHANGES`;
- attach inline file review comments to a review when supported by valid diff coordinates;
- reply to inline review threads;
- update inline review comments;
- resolve or unresolve review threads;
- dismiss submitted reviews when authorized and a valid review ID is available;
- add/remove supported PR/review-comment reactions.

Use `REQUEST_CHANGES` for material defects, `COMMENT` for non-blocking observations, and `APPROVE` only after sufficient independent evidence. Do not resolve a thread until its underlying issue is actually addressed.

#### GitHub Actions

- rerun one specific failed/cancelled workflow job when a valid job ID exists and repository Actions write permission permits it;
- rerun failed jobs from an existing workflow run.

Rerun is NOT the normal way to start CI and must not be used to brute-force deterministic failures. Diagnose `run -> job -> step -> logs/artifacts -> root cause` first.

#### Merge

- merge a PR using merge/squash/rebase where repository policy permits;
- pass `expected_head_sha` so the merge is rejected if the head changed after candidate validation;
- enable PR auto-merge when repository configuration supports it.

When direct merge is authorized, prefer race-safe merge with the frozen candidate SHA.

### PROVEN_IN_EXECUTION on this repository

The following are not merely present in the connector schema; they were actually exercised successfully while establishing or using this baseline:

- repository lookup and permission inspection;
- exact file read from `AGENTS.md`;
- repository branch/current-state reads;
- repository file update producing a real commit;
- fetch/verification of the resulting commit and diff;
- workflow-run job inspection on an existing Actions run;
- workflow step inspection through job data;
- workflow artifact enumeration tied to an exact `head_sha`;
- plugin permission inspection through Plugin Management.

Do not interpret this list as a requirement to re-prove these operations in each Slice.

### NOT_EXPOSED as dedicated write actions in this baseline

Do not spend execution time searching for these operations on every Slice. Treat them as `NOT_EXPOSED` unless fallback rediscovery is triggered by an actual need or product/tool change:

- generic GitHub Actions `workflow_dispatch` trigger;
- arbitrary new workflow-run dispatch through a dedicated action;
- GitHub Projects mutation/board management;
- Ruleset mutation;
- Branch Protection mutation;
- Release creation/update through a dedicated write action;
- tag creation through a dedicated high-level tag/release action;
- GitHub Environment configuration;
- deployment creation/management through a dedicated action;
- repository/org/user secrets management;
- arbitrary shell/terminal command execution on GitHub infrastructure.

Some of these resources may be readable through the connector's approved generic GET surface. Read availability must never be misreported as write capability.

Editing a workflow YAML file through repository file/Git primitives is available; manually dispatching that workflow is a separate capability and is not exposed in this baseline.

### Capability use by development phase

1. **Preflight / inspection:** use repository metadata, search, exact file/ref/commit reads and compare operations. Do not perform full plugin capability discovery.
2. **Isolation:** create/reuse the authorized Slice branch only after verifying its base/head identity.
3. **Construction:** use direct file writes for isolated changes or low-level Git objects for atomic multi-file commits. Capture every returned commit SHA.
4. **Checkpoint:** compare `base_sha -> candidate_sha`; inspect unexpected files/delta before spending CI.
5. **Verification:** run all available local/current-environment checks first. GitHub plugin itself is not an arbitrary shell runner.
6. **Hosted CI:** use naturally configured push/PR triggers when required by the repository. Since generic dispatch is not exposed, never claim a manual dispatch that did not happen.
7. **CI diagnosis:** inspect exact candidate -> run -> jobs -> steps -> logs/artifacts/status. Treat artifacts as first-class evidence bound to the workflow `head_sha`.
8. **Failure handling:** root-cause deterministic failures. Use targeted rerun only for evidenced transient/flaky/external failures or deliberate diagnostic reruns.
9. **Review:** enumerate changed files and inspect patches; use real GitHub review states and threads where useful.
10. **Post-review:** every code-changing review fix creates a new candidate. Recompare and rerun invalidated evidence.
11. **Freeze:** record the exact candidate SHA, checks, artifacts, review state, unresolved threads and `NOT_VERIFIED` items.
12. **Integration:** when authorized, use `expected_head_sha=<frozen_candidate>` for race-safe merge whenever the exposed merge action is used.
13. **Post-integration verification:** verify resulting merge/ref SHA and applicable checks before any completion claim.

### Test and evidence integrity while using GitHub

Tests represent the authorized behavioral contract, not the current implementation. Never change expected values/assertions merely because code failed them. A refactor with unchanged semantics does not need artificial test churn; a behavioral change must have proportional behavioral evidence.

Coverage and mutation testing are risk/evidence tools, not universal magic percentages. Preserve or strengthen justified baselines and investigate meaningful regressions/survivors. When the repository provides coverage, mutation, E2E, visual, security or dependency artifacts, inspect the actual candidate-bound evidence when required by the gate.

CI is an evidence and integration system, not the primary trial-and-error debugger. Never combine PASS evidence from different candidate SHAs.

### Operational GitHub loop

`VERIFY REPO/BASE -> INSPECT -> ISOLATE -> BUILD -> COMMIT ATOMICALLY -> CAPTURE SHA -> COMPARE CANDIDATE -> VERIFY -> INSPECT CI EVIDENCE -> INDEPENDENT REVIEW -> ROOT-CAUSE CONVERGENCE -> FREEZE SHA -> RACE-SAFE INTEGRATION -> VERIFY RESULT`

Notice that `DISCOVER CAPABILITIES` is intentionally absent from the normal loop. This baseline already supplies that knowledge. Discovery occurs only through the fallback conditions defined above.

This section governs how agents use the GitHub execution surface. It does not create product requirements, redefine an authorized Slice, replace GAUNTLET, authorize unrelated work, or weaken any higher-authority rule.

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
