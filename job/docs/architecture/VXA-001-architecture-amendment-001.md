# VXA-001 Architecture Amendment 001 — Adaptive Agent + Workshop

amendment_id: `VXA-ARCH-A001`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
parent_architecture: `job/docs/architecture/VXA-001-architecture.md`
status: `AUTHORIZED`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
authorized_at: `2026-09-10`
authority: `FOUNDER_EXPLICIT_DIRECTIVE`
source_proposal_path: `job/docs/architecture/VXA-001-architecture-amendment-001.PROPOSED.md`
source_proposal_blob_sha: `f47c59ea374884ace539adc1262efbb03d4f45a8`

## Authority decision

The Founder authorized continuation after reviewing and approving the hybrid ASK AI / Infinite Canvas / DeepSeek Harness direction. This document activates `VXA-ARCH-A001` for `VXA-S002@1.0.0` without weakening the reviewed architecture proposal.

## Normative incorporation

The complete UTF-8 content identified by source proposal blob SHA `f47c59ea374884ace539adc1262efbb03d4f45a8` is incorporated here as normative architecture in its entirety. Every responsibility boundary, provider seam, agent-role boundary, strict generative-UI rule, Workshop isolation rule, concurrency rule, recovery rule, privacy requirement, latency principle, and deployment constraint in that immutable proposal remains binding.

For authority resolution only:

- `status: PROPOSED / NOT_AUTHORIZED` becomes `status: AUTHORIZED`;
- language describing the amendment as planning-only is superseded;
- the planning base becomes the exact authorized base SHA above.

No substantive requirement is relaxed by this materialization.

## Active architecture decision

VXA-S002 adopts a dual-plane architecture:

1. `Experience Runtime`: the low-latency customer-facing React/XState/React Flow/Netlify/Mistral path. It owns deterministic lifecycle, normalized facts, provenance, validation, semantic scene projection, camera policy, Critic enforcement, Workshop invocation policy, recovery, and privacy-safe telemetry.
2. `Agent Workshop`: a capability-gated DeepSeek Harness development environment behind a narrow `WorkshopClient` interface. It may create controlled prototype artifacts when the expected persuasive or explanatory benefit justifies the latency.

The customer experience remains complete without a live Workshop. Workshop timeout, failure, missing hosting capability, or invalid output must degrade to the fast approved generative-UI path without losing confirmed understanding.

## Security and execution boundary

The model never gains authority over raw DOM, CSS, JavaScript, arbitrary module loading, raw camera coordinates, application permissions, pricing, durable persistence, or feasibility truth. Visitor-session Workshop execution must not receive the Vexryzer repository, unrestricted server environment, production/customer secrets, or arbitrary network/package authority.

Filesystem sandboxing is not evidence of network isolation. Production-live Workshop enablement requires explicit proof of its execution and egress boundary under the fixed-cost R$0 constraint.
