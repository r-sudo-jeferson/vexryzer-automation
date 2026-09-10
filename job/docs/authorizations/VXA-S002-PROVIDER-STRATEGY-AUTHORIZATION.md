# VXA-S002 Provider Strategy Authorization

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
gauntlet_id: `GNT-VXA-S002-001`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
authorization_checkpoint_sha: `835ba25446051ce597b27eae29ac18ea2538c16a`
architecture_amendment_id: `VXA-ARCH-A002`
status: `AUTHORIZED`
authorized_at: `2026-09-10`
authority: `FOUNDER_EXPLICIT_DIRECTIVE`

## Authorization decision

The Founder explicitly authorizes `VXA-S002@1.0.0` to replace the previously Mistral-primary provider assumption with a multi-provider Free Tier strategy that requires no registered payment method for any active route.

The authorized provider hierarchy is:

1. Cloudflare Workers AI as the primary provider family;
2. Groq as the independent external fallback provider;
3. OpenRouter only as an optional emergency fallback after separate credential and no-payment verification;
4. Mistral in standby, excluded from the active runtime path until its access/capacity state changes and a fresh compatibility decision is justified.

The fixed-cost invariant remains `R$ 0`. No paid subscription, billing activation, prepaid wallet, automatic upgrade, overage, or payment method may be required for the active S002 architecture.

## Authorized model roles

The following are authorized as compatibility candidates, not pre-declared PASS states:

- `@cf/zai-org/glm-4.7-flash`: primary ASK AI seller/orchestrator and fast generative-UI composition candidate;
- `@cf/google/gemma-4-26b-a4b-it`: independent Critic / second-opinion candidate;
- `@cf/openai/gpt-oss-120b`: high-reasoning and Workshop code/UI candidate;
- `@cf/nvidia/nemotron-3-120b-a12b`: Cloudflare fallback-quality candidate;
- Groq `openai/gpt-oss-120b`: independent provider fallback candidate;
- OpenRouter: optional emergency provider only with an exact pinned `:free` model that passes the same product and security gates.

A candidate remains `NOT_VERIFIED` until the exact account, provider route and model pass the required compatibility and quality evidence. Documentation availability alone never constitutes provider PASS.

## Product-role clarification

ASK AI is the persuasive intelligence surface. It understands the visitor's operational pain, asks the next high-value question, structures confirmed facts and uncertainty, frames solution directions, handles objections truthfully, and proposes validated typed UI scenes.

Customer attachments are not model inputs. The visitor's eventual documents are intended for the human delivery workflow. S002 does not authorize model ingestion, OCR, vision processing, summarization, retrieval, or forwarding of attachment contents. Existing later-slice upload/request authority remains unchanged.

## Context and fallback authority

Conversation continuity must be provider-neutral. Canonical structured context belongs to Vexryzer application state, not to provider-side memory or DeepSeek Harness persistence. Provider changes must receive a bounded continuation capsule derived from the same canonical state so fallback does not reset the sales experience or silently change authoritative facts.

Fallback is capability- and failure-aware. It must not silently weaken validation, persuasion quality, provenance, security, generative-UI constraints, or commercial truthfulness. The final fallback is deterministic guided discovery with preserved state, never an automatic paid route.

## Non-degradation

This authorization changes provider strategy only. All other requirements of `VXA-S002@1.0.0`, `GNT-VXA-S002-001`, `VXA-PC-A001`, `VXA-ARCH-A001`, the authorized design, S001 non-regression surface, public-repository safety, accessibility, security, performance, Critic independence, strict generative UI and Workshop isolation remain in force.

Any conflict between an older S002 document that says Mistral is the planned/selected primary provider and this authorization is resolved in favor of this later Founder directive. Historical Mistral evidence must be preserved rather than rewritten.
