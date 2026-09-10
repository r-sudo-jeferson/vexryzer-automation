# VXA-S002 Authorization Proposal

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
proposed_slice_version: `1.0.0`
proposed_authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
proposed_gauntlet_id: `GNT-VXA-S002-001`
status: `AWAITING_FOUNDER_EXPLICIT_AUTHORIZATION`
proposal_branch: `plan/vxa-s002-ask-ai-adaptive-experience`

## Proposed authority package

This proposal requests one explicit Founder decision over the following documents as a coherent authority set:

- `job/docs/product/VXA-001-product-contract-amendment-001.PROPOSED.md`;
- `job/docs/architecture/VXA-001-architecture-amendment-001.PROPOSED.md`;
- `job/docs/slices/VXA-S002-contract.PROPOSED.md`;
- `job/docs/gauntlets/GNT-VXA-S002-001.PROPOSED.md`;
- `job/docs/superpowers/specs/2026-09-10-ask-ai-adaptive-experience-design.md`;
- `job/docs/superpowers/plans/2026-09-10-vxa-ask-ai-adaptive-experience-plan.md`;
- `job/docs/superpowers/specs/2026-09-10-vxa-critic-adversarial-planning-review.md`.

## Proposed authorization decision

Authorize implementation of `VXA-S002@1.0.0` only, based on the exact repository `main` SHA `6244a246d8faf73e772fc944a398a71a02fb97e0`, governed by `GNT-VXA-S002-001`, with the Product and Architecture amendments above adopted for this initiative.

The authorization would permit Engineering to begin with the compatibility spike and then execute the implementation plan contract-to-code, one Slice at a time.

It would not authorize S003 or later roadmap work.

## Explicitly acknowledged unknowns

Authorization should preserve these as evidence gates rather than assumptions:

- `SPIKE_REQUIRED`: exact DeepSeek Harness + selected Mistral route/model compatibility;
- `NOT_VERIFIED`: zero-fixed-cost production placement for a persistent live visitor Workshop with sufficient process/filesystem/network isolation;
- `NOT_VERIFIED`: production deployment itself until an actual Netlify project/environment is linked and deployment is explicitly authorized.

These unknowns do not authorize weakening the fast-path ASK AI experience, security controls, Workshop isolation, latency feedback or GAUNTLET.

## Workshop completion semantics

Unless the Founder explicitly changes this point during authorization, S002 completion requires:

- real DeepSeek Harness + Mistral compatibility proof in a controlled environment;
- implemented and tested `WorkshopClient` boundary;
- isolated ephemeral Workshop workspace and tool policy;
- deterministic fast-path fallback;
- controlled live-prototype behavior proven with deterministic/fake backends and controlled Harness evidence;
- production-live Workshop enablement only if its zero-fixed-cost execution boundary is actually verified.

A missing compliant production Workshop host is not permission to run an unsafe Harness process inside the normal customer request path.

## Product authority semantics

Adopting the Product Contract amendment permits S002 discovery to identify automation, micro-SaaS, BI, agentic/AI, process/data improvement, training, hybrid and no-software-fit opportunities.

It does not authorize authoritative pricing formulas for those expanded classes. Pricing remains a later deterministic contract decision.

## Non-negotiable boundaries

Authorization must not be interpreted as permission to:

- execute arbitrary model-generated JavaScript in the same-origin visitor application;
- expose provider or production credentials;
- grant the visitor Workshop access to the Vexryzer repository;
- use prompt text as the only sandbox/security control;
- inherit unrestricted server environment into the Harness process;
- use arbitrary live package installation/network targets;
- fake progress or prototype state;
- claim technical feasibility without evidence;
- bypass the independent Critic;
- weaken S001 accessibility/mobile/performance/security invariants;
- move pricing, upload truth, durable request sealing or notification authority into the model.

## Base verification rule

The proposed base SHA was the verified `main` SHA when this planning package was created.

Before converting this proposal into `AUTHORIZED`, Engineering must re-read `main` and confirm it still equals `6244a246d8faf73e772fc944a398a71a02fb97e0`.

If `main` moved, do not authorize against a stale base. Reconcile the planning package against the new Canon and update the proposed base with evidence.

## Authorization conversion rule

This file is not itself authorization.

After an explicit Founder directive, Engineering should:

1. verify `main` SHA;
2. rename/materialize the proposed Slice contract and GAUNTLET as authoritative documents without weakening them;
3. adopt the Product/Architecture amendments explicitly;
4. replace this proposal with a `VXA-S002-AUTHORIZATION.md` carrying `status: AUTHORIZED`, exact version/base/GAUNTLET and `authority: FOUNDER_EXPLICIT_DIRECTIVE`;
5. start implementation only after that repository state is verified.

Until those steps occur, implementation status remains `BLOCKED NO AUTHORIZED SLICE`.