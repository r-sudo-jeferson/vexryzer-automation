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
