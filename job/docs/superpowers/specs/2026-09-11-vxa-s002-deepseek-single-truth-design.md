# VXA-S002 DeepSeek Single Truth Agent Runtime Design

## Status

AUTHORIZED design for `VXA-S002@1.0.0` under Founder direction dated 2026-09-11.

## Goal

Converge Vexryzer S002 from experimental multi-provider routing into one production AI truth: DeepSeek Harness coordinating `deepseek-v4-pro`, with the Infinite Canvas as the agent's persistent visual workspace and the existing Deterministic Trust Kernel as the non-model authority.

## Invariants

1. Exactly one active generative model id exists: `deepseek-v4-pro`.
2. Exactly one LLM credential name exists: `DEEPSEEK_API_KEY`.
3. Exactly one agent harness is eligible: DeepSeek Harness.
4. No model/provider/harness fallback exists.
5. DeepSeek failure yields deterministic guided recovery.
6. No secret reaches browser code, logs, artifacts or source.
7. Canonical Vexryzer state outranks Harness/model memory.
8. Material arithmetic remains deterministic.
9. Model-authored UI is semantic, typed and bounded; never arbitrary executable UI code.
10. The Canvas is part of the agent loop and persists causal visual state across turns.

## Runtime composition

The target runtime has five responsibilities.

### DeepSeek agent plane

DeepSeek Harness owns the agent loop, session continuity, tool invocation and operational agent memory. The exact Harness version is pinned; it is never consumed through an unbounded latest tag.

`deepseek-v4-pro` owns language, strategy, sales improvisation, objection handling, tool choice and semantic visual intent.

### Canonical truth plane

Existing Vexryzer canonical sales context remains durable product truth. User facts, AI inferences, corrections, supersession, uncertainty and verified calculations continue to use provenance-aware application types.

Harness session data may improve continuity but cannot promote itself into canonical evidence.

### Tool plane

The agent receives Vexryzer-owned tools rather than raw browser/runtime authority. The tool vocabulary maps to semantic actions such as focus, reveal, compare, annotate, quantify, group, process mutation, relationship explanation and artifact staging.

Every tool request is parsed as untrusted model output. Unknown fields, stale revisions, invalid evidence references, invalid calculation references, unsafe executable content and capacity overflow fail closed.

### Canvas plane

Accepted semantic intent is projected into ReactiveExperienceState and then into the Infinite Canvas. Canvas changes are transactionally associated with the canonical revision that justified them.

Visual state is supplied back to the next agent turn so the agent reasons about the world it has already constructed.

### Recovery plane

There is no LLM fallback. Credential failure, balance/rate/capacity failure, timeout, malformed output, incompatible Harness behavior or circuit failure yields bounded deterministic recovery while preserving session state.

## DeepSeek wire requirements

The product uses the DeepSeek API at `https://api.deepseek.com` with model `deepseek-v4-pro`.

The implementation must support DeepSeek thinking-mode tool-call continuity correctly. When the selected API mode requires reasoning-content replay around tool calls, the wire adapter must preserve protocol-required data without treating hidden reasoning as canonical application truth or exposing it to the user.

The application validates all tool arguments independently because schema-conforming provider output is not a security boundary.

## Reasoning policy

Reasoning effort stays on the same model and may be selected deterministically:
- `low`: trivial continuation or low-risk wording;
- `high`: normal accounting discovery, objection handling and visual coordination;
- `max`: complex multi-evidence synthesis, high-impact reframing or multi-tool Canvas composition.

This policy is cost/latency tuning, not model routing.

## Persuasion quality

The Seller is expected to be commercially strong. It should transform supported accounting-office evidence into specific operational tension and concrete economic visibility.

A high-quality turn should prefer supported numbers over vague adjectives when the necessary canonical inputs exist. When one missing numeric fact would materially increase conviction, requesting that fact may be the strongest next move.

The agent may challenge habits and expose the cost of delay. It may not invent facts, urgency, scarcity, ROI, feasibility, accounting consequences or discounts.

## Cost control

Founder-authorized prepaid DeepSeek balance replaces the old R$0 LLM assumption.

The runtime records bounded usage telemetry sufficient to estimate cost per turn/session without logging prompts, secrets or hidden reasoning. There is no automatic recharge and no alternate paid provider.

## Migration

The current tree contains obsolete multi-provider and alternative-harness authority, tests, workflows and utilities. Migration removes them rather than preserving dormant fallbacks.

Generic protocol code may remain only when it is genuinely a DeepSeek protocol implementation detail. Names and contracts that imply provider plurality should be narrowed or renamed when doing so reduces ambiguity without destabilizing unrelated code.

## Verification

The implementation cannot be called PASS until exact tuple evidence proves DeepSeek Harness restart/session behavior, streaming, structured tool use, multi-turn replay, timeout/cancellation, secret confinement, Canvas semantic tools and Seller persuasion quality.

Historical evidence from different Harness versions or different providers is not transferable.
