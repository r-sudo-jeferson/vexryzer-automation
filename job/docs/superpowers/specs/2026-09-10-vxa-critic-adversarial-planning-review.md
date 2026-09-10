# VXA Critic — Adversarial Planning Review

review_id: `VXA-CRITIC-PLAN-001`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
status: `PLANNING REVIEW`
planning_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
planning_branch: `plan/vxa-s002-ask-ai-adaptive-experience`
subject: `ASK AI central experience + Infinite Canvas + DeepSeek Harness Workshop`

## Review posture

This review attacks the design before implementation. It is intentionally stricter than a feature checklist. The objective is to find requirements that can fail commercially, visually, operationally or technically even if individual components appear to work.

Review outcome: `READY_FOR_FOUNDER AUTHORIZATION DECISION WITH EXPLICIT GATES`.

This is not a Slice PASS and does not authorize implementation.

## Critical finding 1 — active Product Contract is narrower than the approved direction

Severity: `critical`

The current Product Contract frames the product as custom automation intake. The approved direction expands qualification into micro-SaaS, BI, agentic systems, training, prerequisite process/data work and no-software-fit.

Risk: Engineering could build a commercially broader product while claiming compliance with a narrower active contract, creating authority drift.

Required correction: adopt an explicit Product Contract amendment before implementation of broader solution classification.

Disposition in planning: proposed amendment `VXA-PC-A001` created.

## Critical finding 2 — existing pricing policy is not portable across solution classes

Severity: `critical`

The current recurring-automation pricing formula cannot be silently applied to micro-SaaS, BI, training or agentic systems.

Risk: inaccurate commercial estimates and false consistency.

Required correction: S002 must not calculate broader authoritative prices. Later pricing work must explicitly define class-specific deterministic authority or manual-review routing.

Disposition in planning: S002 proposal excludes authoritative pricing changes.

## Critical finding 3 — DeepSeek Harness developer preview is a dependency risk

Severity: `high`

Harness APIs, profiles, event shapes or provider adapters may change.

Risk: tying core discovery availability to a preview harness can make the sales path fragile.

Required correction: Harness is optional behind `WorkshopClient`; exact version/profile is pinned only after a real Mistral compatibility spike; upgrades rerun compatibility and sandbox tests.

Disposition in planning: gate added.

## Critical finding 4 — Harness filesystem sandbox does not prove network isolation

Severity: `critical`

A file/workspace sandbox and a network/egress boundary are different security claims.

Risk: a model-controlled development process could exfiltrate data or reach arbitrary hosts even while filesystem tests pass.

Required correction: live visitor Workshop enablement requires environment-level egress enforcement or equivalent proven isolation. No production-live claim based only on workspace-write mode.

Disposition in planning: explicit GAUNTLET attack and architecture gate added.

## Critical finding 5 — arbitrary dependency installation is both a latency and supply-chain hazard

Severity: `high`

Allowing the live Workshop to discover/install arbitrary packages increases execution time, nondeterminism, malicious-package risk and outbound-network requirements.

Required correction: prebundle the approved prototype kit and dependencies. Unknown packages are unavailable during live visitor generation.

Disposition in planning: live Workshop package installation prohibited by default.

## Critical finding 6 — generated React is not safe merely because it was generated in a sandbox

Severity: `critical`

Sandboxed generation does not make the artifact safe to execute in the customer application's origin.

Risk: XSS, data access, network exfiltration, DOM interference, misleading behavior and CSP weakening.

Required correction: live export prefers a declarative `PrototypeScene`/manifest or sanitized static artifact. Same-origin arbitrary generated JavaScript is excluded from S002. Any future executable prototype runtime requires an independent sandbox/origin contract.

Disposition in planning: hard boundary added.

## Critical finding 7 — Infinite Canvas can become an information-dump anti-pattern

Severity: `high`

More visual elements are not automatically more magical. Progressive materialization can degrade into clutter, camera thrash and loss of the conversational focal point.

Required correction: scene-level attention budget, one primary directed focus, bounded additions, stable background context, semantic zoom and camera commands only for material changes.

Disposition in planning: attention-budget architecture and GAUNTLET coverage added.

## Critical finding 8 — camera choreography can fight user agency

Severity: `high`

A highly adaptive Canvas may repeatedly move the viewport while a visitor is reading, scrolling or typing.

Required correction: preserve S001 user interruption authority; do not let every accepted token/fact trigger travel; no camera command may steal composer focus; stale camera targets fail closed.

Disposition in planning: camera attacks and acceptance criteria added.

## Critical finding 9 — truthful progress needs a real event model

Severity: `high`

Labels such as “analisando”, “criando” or progress percentages become deceptive if they are decorative timers.

Required correction: feedback is derived from actual runtime phases only; local acknowledgement is explicitly local; unknown progress has no percentage; every waiting state has a bounded exit.

Disposition in planning: closed event families and no-fake-progress gates added.

## Critical finding 10 — Critic-on-every-token would destroy latency

Severity: `high`

An independent model Critic is valuable but can double or triple model latency if invoked indiscriminately.

Required correction: deterministic hard gates run first; model Critic is reserved for material semantic, solution, scene and prototype decisions. Streaming prose may be bounded by deterministic policies while material state waits for validation.

Disposition in planning: selective Critic architecture added.

## Critical finding 11 — self-critique is not independence

Severity: `high`

A generator asked to “review your own answer” is not a credible independent control.

Required correction: VXA Critic uses a separate logical request/identity, separate rubric and bounded schema. Generator cannot assign its own verdict.

Disposition in planning: explicit independent Critic requirement added.

## Critical finding 12 — persuasion and truth can conflict under conversion pressure

Severity: `critical`

An agent optimized only for conversion can hide uncertainty, overstate ROI, force software recommendations or create urgency.

Required correction: truthfulness is a hard constraint; no-software-fit is valid; fabricated ROI, fake scarcity, fear/shame and unsupported feasibility are block conditions. Persuasion is based on demonstrated understanding and the user's own facts.

Disposition in planning: Product Contract and GAUNTLET rules added.

## Critical finding 13 — brand bias can cause “automation everywhere” recommendations

Severity: `high`

The product name can create an implicit prior that every pain should become an automation sale.

Required correction: Solution Strategist must compare multiple classes and include process/data remediation and no-software-fit. GAUNTLET fixtures must contain cases where automation is not the responsible recommendation.

Disposition in planning: required solution-class matrix added.

## Critical finding 14 — training can become an opportunistic cross-sell

Severity: `medium`

Adding training to the offer set risks recommending it without evidence.

Required correction: training is proposed only when adoption, operational skill, process discipline or safe AI/automation use is a material constraint.

Disposition in planning: training-fit fixture and anti-forced-cross-sell rule added.

## Critical finding 15 — provider-side conversation state can become accidental authority

Severity: `high`

Mistral Conversations or Harness session history are useful but can diverge from corrected application facts.

Required correction: normalized application facts and provenance remain authoritative. Provider conversation/session state is an implementation aid. Condensation cannot replace deterministic facts.

Disposition in planning: state/condensation contract added.

## Critical finding 16 — long conversations need bounded context

Severity: `high`

Sending the entire raw conversation indefinitely increases latency, token usage and risk of stale contradictions resurfacing.

Required correction: normalized facts + unresolved uncertainty + bounded recent turns + validated summary. Correction dependencies remain deterministic outside the summary.

Disposition in planning: context-management gate added.

## Critical finding 17 — async races can visibly lie to the visitor

Severity: `critical`

A slow model or Workshop result can arrive after the user corrected the premise or moved to another process.

Required correction: every request, proposal, graph revision and Workshop job has stable identity/version; stale events are rejected or revalidated before application.

Disposition in planning: race/idempotency GAUNTLET added.

## Critical finding 18 — a visually impressive prototype can imply production readiness

Severity: `critical`

High-fidelity demonstrations are persuasive precisely because they look real.

Required correction: prototype state is explicit in the data model and semantic UI. Integrations, live data and feasibility are never implied unless verified.

Disposition in planning: prototype-truth gates added.

## Critical finding 19 — Workshop generation budget is not credible as a blocking interaction

Severity: `high`

A real development agent may occasionally need materially longer than a normal conversational turn.

Required correction: Workshop is parallel; fast-path visual composition is always available; conversation can continue; over-budget result may be revealed later only if still relevant.

Disposition in planning: hybrid fast/slow path preserved.

## Critical finding 20 — mobile cannot inherit desktop spatial choreography

Severity: `high`

An Infinite Canvas designed around desktop camera motion can become unusable under a virtual keyboard and small viewport.

Required correction: directed mobile path, semantic reading order, composer visibility, no precision gesture requirement, and spatial meaning available in a semantic navigation representation.

Disposition in planning: mobile-specific GAUNTLET retained and expanded.

## Critical finding 21 — screen-reader users need semantic equivalence, not narration of animations

Severity: `high`

Announcing every Canvas mutation or streaming token creates noise and does not convey structure.

Required correction: semantic event announcements and an equivalent navigable representation of core facts/actions. Token-level streaming is not an `aria-live` feed.

Disposition in planning: accessibility gate added.

## Critical finding 22 — observability can accidentally collect the exact sensitive data the product is trying to understand

Severity: `high`

Operational pain descriptions can include PII, credentials, customer names or internal data.

Required correction: telemetry schema defaults to event codes, durations, counts and safe classifications. Raw prompts/messages/source are excluded unless separately authorized and privacy-reviewed.

Disposition in planning: privacy-safe observability contract added.

## Critical finding 23 — live Workshop hosting is unresolved under fixed R$0 infrastructure

Severity: `critical`

A persistent development-agent runtime has different lifecycle requirements from the selected Netlify Free customer runtime.

Required correction: production live Workshop remains capability-gated and `NOT_VERIFIED` until a compliant zero-fixed-cost execution environment is proven. The product remains fully functional through the fast path.

Disposition in planning: made explicit in Architecture Amendment and S002 proposal.

## Critical finding 24 — a failure can still feel slow even if technically recoverable

Severity: `medium`

A timeout followed by fallback after a long blank wait is operationally correct but experientially bad.

Required correction: immediate local acknowledgement, real activity events, bounded waiting, early fast-path composition, and no spinner-only states.

Disposition in planning: latency choreography and timing instrumentation required.

## Critical finding 25 — component learning loop can become a shadow deployment path

Severity: `critical`

If a live visitor agent can promote a newly generated component, model-authored code effectively bypasses engineering and GAUNTLET.

Required correction: live sessions can propose only artifacts within existing runtime contracts. New reusable React components are Design Lab outputs requiring engineering review, accessibility, security, browser/visual evidence and applicable GAUNTLET before registry promotion.

Disposition in planning: promotion prohibition made invariant.

## Critical finding 26 — “show of magic” can turn into decorative noise

Severity: `medium`

Particles, glow and gratuitous motion may feel impressive in isolation while reducing trust and comprehension.

Required correction: every major visual transition must map to understanding, uncertainty, relationship, solution comparison or decision. The user's process transformation is the spectacle.

Disposition in planning: visual-quality rejection criteria strengthened.

## Proposed Critic runtime rubric

The future `VxaCritic` should combine hard policy and graded judgment.

### Hard-block families

- authority violation;
- secret/data exfiltration;
- unauthorized tool capability;
- arbitrary executable scene/code path;
- false feasibility/production claim;
- fabricated pricing/discount/ROI authority;
- invalid provenance mutation;
- stale proposal application;
- prototype presented as completed production;
- manipulative prohibited persuasion.

Any hard-block condition yields `BLOCK` regardless of softer quality score.

### Graded dimensions

Evaluate material proposals on:

- problem fidelity;
- information gain;
- factual grounding;
- uncertainty honesty;
- solution-class fit;
- commercial progression;
- persuasion quality;
- cognitive load;
- scene coherence;
- Canvas usefulness;
- accessibility;
- mobile quality;
- latency/value tradeoff;
- Workshop necessity;
- visual polish;
- continuity with prior confirmed facts.

A low score yields `REVISE`, not automatic permission to broaden scope or collect more information.

## Authorization recommendation

Founder authorization should adopt the proposed Product Contract Amendment, Architecture Amendment, S002 contract and GAUNTLET together so Engineering does not begin with conflicting authority.

The authorization should explicitly acknowledge two unresolved gates rather than hiding them:

1. DeepSeek Harness + selected Mistral route compatibility is `SPIKE_REQUIRED`.
2. zero-fixed-cost production placement with sufficient Workshop isolation is `NOT_VERIFIED` and cannot become a blocking dependency of S002 core discovery.

If the Founder requires production-live Workshop as a mandatory S002 completion condition, authorization must also provide or authorize a compliant execution environment; otherwise S002 should require the Workshop substrate and controlled-environment proof while keeping production live enablement capability-gated.