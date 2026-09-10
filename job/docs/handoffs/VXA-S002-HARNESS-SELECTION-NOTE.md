# VXA-S002 Real-Agent Harness Selection Note

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
gauntlet_id: `GNT-VXA-S002-001`
status: `IN_PROGRESS / NOT_VERIFIED`
architecture_amendment: `VXA-ARCH-A002`

## Founder direction

The Founder requires a real agent harness for controlled code/UI Workshop work and directed Engineering to prefer DeepSeek Harness, OpenHands or OpenCode rather than reducing the Workshop to prompt-only generation.

## Evaluation order

1. `DeepSeek Harness 0.1.2-rc.1` with the already reviewed `sdk-minimal` / `dsh-llm-pi-ai` stack.
2. OpenCode only if DeepSeek Harness fails a material compatibility/property gate for every usable free Workshop candidate.
3. OpenHands only if the first two paths are unsuitable and a maintained, security-compatible execution route can be proven.

This order minimizes new dependency/runtime surface and preserves the exact Harness evidence already accumulated. An access/rate-limit failure from one provider does not prove the Harness itself incompatible.

## Required meaning of agent compatibility

A Workshop harness PASS requires actual agent behavior, not merely a successful chat completion. The exact tuple must prove:

- streamed agent events;
- a real filesystem tool call;
- structured tool arguments;
- creation of the expected workspace artifact;
- a second tool round-trip that reads the artifact;
- semantic use of that tool result;
- persisted session state across harness restart;
- restart recall without another filesystem read;
- explicit timeout/error mapping;
- credential confinement and bounded diagnostics.

## Current candidates

The first DeepSeek Harness gate tests only models authorized for `workshop_code`:

- Cloudflare Workers AI `@cf/openai/gpt-oss-120b`;
- Groq `openai/gpt-oss-120b`.

The normal ASK AI Seller remains provider-neutral and does not run inside a long-lived development harness. Canonical sales context belongs to Vexryzer. The harness is the controlled Workshop execution plane for code/UI adaptation and prototype generation.

## Financial and security boundary

All evaluated routes must remain usable without registered payment method, paid subscription, prepaid credits or overage. No harness receives customer attachments, production secrets, the live Vexryzer repository during a visitor session, arbitrary package/network authority or permission to publish generated code without validation.

## Decision rule

If at least one exact DeepSeek Harness/provider/model tuple passes every required agent property, DeepSeek Harness remains the selected Workshop harness and Engineering does not spend CI evaluating OpenCode/OpenHands merely for comparison.

If every provider-accessible DeepSeek tuple fails a genuine Harness compatibility/property gate, preserve evidence and evaluate OpenCode next. Do not weaken the gate to retain a preferred harness.
