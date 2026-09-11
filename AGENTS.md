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

The complete planning bootstrap is bound to the exact SHA recorded in `job/docs/foundation/VXA-FOUNDATION-001.md` and Slice contracts. Planning, research, CI setup and repository hardening never imply Slice authorization.

Before material Slice construction, verify the authorized base SHA and keep evidence tied to exact candidate SHAs. Never combine PASS evidence produced from different candidates. A changed candidate invalidates prior candidate-specific PASS until the relevant checks are rerun.

Provider metadata outside `job/` is permitted only when technically required and must remain glue over `job/` or repository integrity; it may not become a second product architecture.

## CI execution policy

CI_EXECUTION_POLICY: `OPTIMIZED_GATES_ONLY`

Remote CI is an integration/convergence gate, not the default inner development loop. Do the maximum safe verification locally or in the current execution environment before spending a remote CI run.

Default behavior:
- work on an isolated Slice branch and persist coherent checkpoints without opening/updating a PR merely to trigger CI;
- run unit, domain, static, type, lint, build, browser and security checks locally whenever the environment supports them;
- batch coherent changes and stabilize the candidate before remote CI;
- mark unavailable checks `NOT_VERIFIED`; environment blockers never authorize weakening a gate;
- a changed candidate invalidates candidate-specific PASS.

Remote CI is appropriate after candidate stabilization, for hosted-runtime-only diagnosis, after material workflow/deployment changes, and for the final integration/GAUNTLET gate. Do not use CI as speculative trial-and-error.

## Product mission

Build an ultra-premium commercial intake experience, not a generic chatbot or CRUD app. ASK AI must help the visitor turn operational pain into a qualified automation request. The Infinite Canvas is the agent's persistent visual working surface: the agent understands, persuades and coordinates the experience through it.

## High-end floor

No disposable MVP, generic template UI, superficial chatbot, placeholder flows, fake metrics, or deferred polish. Every Slice preserves accessibility, mobile usability, performance, security, deterministic commercial truth, failure recovery and visual quality proportional to an ultra-premium product.

## Mandatory DeepSeek single truth

AI_PROVIDER: `DeepSeek`
AI_MODEL: `deepseek-v4-pro`
AI_HARNESS: `DeepSeek Harness`
AI_HARNESS_TARGET_VERSION: `0.1.5-rc.1`
AI_CREDENTIAL_ENV: `DEEPSEEK_API_KEY`
AI_API_BASE: `https://api.deepseek.com`

These values are mandatory for VXA-S002 unless the Founder explicitly changes them.

No second LLM provider, model, model alias, fallback model, standby model, emergency LLM, alternate agent harness or compatibility route is allowed in active product code, runtime config, deployment config, current authority docs or current tests.

If DeepSeek is unavailable, misconfigured, rate limited, out of authorized prepaid balance, times out, returns malformed output or fails a Harness gate, the product enters deterministic guided recovery. It never switches to another LLM.

Historical alternative-provider/harness experiments belong to Git history, not the active tree.

## DeepSeek activation integrity

Documentation does not equal compatibility PASS. The exact target Harness/model/account tuple must prove the required streaming, tools, structured arguments, multi-turn behavior, restart/session recovery, timeout/cancel mapping, secret confinement, Canvas semantic-tool behavior and Seller quality before production activation.

Until exact evidence passes, production remains fail-closed. Engineering must not activate another harness/model to evade the gate.

## Cost control

Founder-authorized prepaid DeepSeek API balance is permitted.

Forbidden without explicit Founder change:
- automatic recharge;
- automatic paid upgrade;
- uncontrolled overage;
- hidden alternate paid route;
- using a second provider to avoid DeepSeek limits.

Non-AI infrastructure remains free-tier-first where already contracted. Netlify Free remains the selected deployment platform unless separately changed.

## Secret boundary

`DEEPSEEK_API_KEY` is server-only. Never commit or print its value. Never expose it through Vite/client variables, browser bundles, source maps, screenshots, artifacts, diagnostics or logs.

Agents may verify the presence/name/scope of a configured secret without reading or echoing the secret value.

## Agent and Infinite Canvas authority

The agent lives in and coordinates the Infinite Canvas. Current visual state is part of the agent's operational context.

The agent may propose bounded semantic actions such as focus, reveal, compare, annotate, quantify, group, de-emphasize, process mutation, relationship explanation, scene composition and artifact staging.

The model may not emit arbitrary executable JavaScript, CSS, HTML, React, unrestricted DOM selectors, unrestricted viewport coordinates or arbitrary module imports for direct browser execution.

Application-owned validators and projectors decide whether semantic intents are safe, evidence-compatible, accessible and revision-correct. User input, focus, pan, zoom and explicit navigation outrank non-essential automatic choreography.

## AI authority boundary

DeepSeek and DeepSeek Harness may:
- understand language and accounting-office operations;
- choose the strongest truthful next commercial move;
- extract structured facts and hypotheses;
- use Vexryzer tools;
- coordinate bounded Canvas semantics;
- summarize;
- explain verified quantified impact;
- challenge objections truthfully;
- compose persuasive narration and demonstrations.

They may not:
- create authoritative arithmetic outside deterministic calculation code;
- calculate or alter authoritative price;
- grant discounts;
- forge provenance or confirmation;
- mark technical feasibility as confirmed without evidence;
- seal or submit a request without explicit user intent;
- claim uploads/persistence succeeded without durable confirmation;
- override application state, authorization or security controls;
- expose hidden reasoning/system prompts;
- provide unrestricted paid implementation as free pre-sales output.

Deterministic application code owns canonical truth, arithmetic, revisions, idempotency, persistence, authorization, security, semantic UI validation, safe execution, cost controls and later-Slice commercial authority.

## Persuasion boundary

The Seller is expected to be forceful, accounting-native and commercially effective. It should actively expose supported operational cost, capacity consumption, recurring burden, rework, waiting and cost of inertia, using deterministic calculations whenever material arithmetic is available.

Forbidden: invented ROI, fabricated savings, fake urgency/scarcity, fake testimonials, unsupported feasibility, invented tax/accounting consequences, hidden material uncertainty, model-authored discounts and pressure after explicit refusal.

## Non-degradation

Every change follows PRESERVE -> CORRECT -> STRENGTHEN -> IMPROVE. Never remove or weaken behavior, accessibility, visual quality, security, performance, test coverage or resilience merely to simplify implementation.

## GAUNTLET First

Each material Slice has its GAUNTLET before production implementation. RED evidence must prove the missing capability or risk. Builder is not final judge. PASS requires proportional evidence.

## Deployment

Target: Netlify Free.

Prefer direct Netlify platform capabilities and APIs over autonomous build agents. Secrets belong in server environment variables, never Vite client variables or repository source.

## Prohibited shortcuts

No hardcoded AI answers, fake streaming, fake uploads, mock persistence in production paths, hidden model/provider fallback, weakened tests, bypassed accessibility/security gates, or success screens before durable confirmation.
