# VXA-S002 Authorization

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
gauntlet_id: `GNT-VXA-S002-001`
product_amendment_id: `VXA-PC-A001`
architecture_amendment_id: `VXA-ARCH-A001`
status: `AUTHORIZED`
authorized_at: `2026-09-10`
authority: `FOUNDER_EXPLICIT_DIRECTIVE`
planning_branch: `plan/vxa-s002-ask-ai-adaptive-experience`

## Authorization decision

The Founder approved the hybrid ASK AI direction, instructed Engineering to preserve the plan, and then explicitly directed Engineering to continue immediately after the coherent S002 authority package was presented as awaiting Founder authorization.

Engineering reverified repository `main` before materialization and confirmed the exact authorized base remains:

`6244a246d8faf73e772fc944a398a71a02fb97e0`

This authorizes implementation of `VXA-S002@1.0.0` only, governed by `GNT-VXA-S002-001`, with `VXA-PC-A001` and `VXA-ARCH-A001` active for this Slice.

## Authorized authority set

- `job/docs/product/VXA-001-product-contract-amendment-001.md`;
- `job/docs/architecture/VXA-001-architecture-amendment-001.md`;
- `job/docs/slices/VXA-S002-contract.md`;
- `job/docs/gauntlets/GNT-VXA-S002-001.md`;
- `job/docs/superpowers/specs/2026-09-10-ask-ai-adaptive-experience-design.md`;
- `job/docs/superpowers/plans/2026-09-10-vxa-ask-ai-adaptive-experience-plan.md`;
- `job/docs/superpowers/specs/2026-09-10-vxa-critic-adversarial-planning-review.md`.

The materialized Product, Architecture, Slice and GAUNTLET documents incorporate their reviewed proposal blobs in full. Proposal markers are superseded only for authority metadata; substantive requirements are not reduced.

## Mandatory first technical gate

Implementation begins with the DeepSeek Harness + selected Mistral compatibility spike described in Task 1 of the implementation plan.

No production dependency commitment may be inferred before real evidence proves the required provider behavior. Required evidence includes streaming/event delivery, tool calls, structured arguments, multi-turn tool replay, error/timeout mapping and restart/session behavior against an exact pinned Harness version and selected Mistral model/route.

## Preserved unknowns

- `SPIKE_REQUIRED`: exact DeepSeek Harness + Mistral compatibility.
- `NOT_VERIFIED`: zero-fixed-cost production placement of a persistent live visitor Workshop with adequate process/filesystem/network isolation.
- `NOT_VERIFIED`: production deployment until an actual authorized deployment environment exists and is verified.

These unknowns do not weaken S002. The customer-facing fast path must remain functional, truthful and high quality without the live Workshop.

## Non-negotiable boundaries

Authorization does not permit S003 or later roadmap implementation, arbitrary same-origin model-generated JavaScript, visitor access to the Vexryzer repository, production/customer secret exposure, unrestricted child-process environment inheritance, arbitrary package/network access, fake progress, unsupported feasibility claims, Critic bypass, weakening of S001 invariants, or moving pricing/upload/persistence/sealing authority into the LLM.

## Execution state

After this document and its referenced authority set are present and verified on the implementation branch, S002 may transition from `AUTHORIZED` to `IN_PROGRESS`. `PASS`, `PROMOTED`, and `COMPLETE` remain unavailable until their respective exact-candidate and integration evidence exists.
