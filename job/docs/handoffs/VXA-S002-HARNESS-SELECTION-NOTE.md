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

## DeepSeek decision evidence

GitHub Actions run `34481065588` on candidate SHA `d023f91666da19e123cf1a1549ebe777c5cd4255` completed with the exact DeepSeek Harness `0.1.2-rc.1` agentic gate failing a mandatory property.

- Groq `openai/gpt-oss-120b` proved streaming, a real `str_replace_editor` filesystem edit, structured arguments, a second read tool round-trip, semantic use of that tool result, and timeout mapping. The persisted Harness data retained the nonce, but a recreated Harness using the same session identifier did not recall it without another filesystem read. `restartSafe=false`.
- Cloudflare Workers AI `@cf/openai/gpt-oss-120b` also did not prove restart safety and additionally encountered `CONTEXT_WINDOW_EXCEEDED` during the agent turns.
- Direct provider screening in the same run proved the Groq model can stream, call tools and replay a tool result, so the Groq DeepSeek failure is not reducible to isolated function-calling incompatibility.

The restart/session requirement is intentionally unchanged. The exact DeepSeek candidate therefore has a genuine material compatibility failure for every provider-accessible Workshop tuple tested. Per the pre-existing decision rule, OpenCode is now the authorized next harness candidate. Re-running the unchanged DeepSeek candidate automatically would add CI cost without a new hypothesis; its probe remains available for explicit future re-verification after a material Harness change.

## OpenCode evaluation target

OpenCode is evaluated first as the exact immutable release `1.18.30` with Groq `openai/gpt-oss-120b`, because that provider/model tuple already proved the strongest successful agent behavior before the DeepSeek restart boundary.

The OpenCode gate must preserve the same strength. It uses fresh CLI processes with explicit `--session` continuation, requires a real filesystem write, a later `read` tool result used semantically, then another fresh-process recall with zero tool use. Bash, subagents, web access, external directories, sharing and unrelated provider credentials are denied or omitted. A PASS for OpenCode does not authorize OpenHands evaluation merely for comparison.

## Current candidates

The first DeepSeek Harness gate tested only models authorized for `workshop_code`:

- Cloudflare Workers AI `@cf/openai/gpt-oss-120b`;
- Groq `openai/gpt-oss-120b`.

The active next harness candidate is OpenCode `1.18.30` with Groq `openai/gpt-oss-120b`.

The normal ASK AI Seller remains provider-neutral and does not run inside a long-lived development harness. Canonical sales context belongs to Vexryzer. The harness is the controlled Workshop execution plane for code/UI adaptation and prototype generation.

## Financial and security boundary

All evaluated routes must remain usable without registered payment method, paid subscription, prepaid credits or overage. No harness receives customer attachments, production secrets, the live Vexryzer repository during a visitor session, arbitrary package/network authority or permission to publish generated code without validation.

## Decision rule

If at least one exact DeepSeek Harness/provider/model tuple passes every required agent property, DeepSeek Harness remains the selected Workshop harness and Engineering does not spend CI evaluating OpenCode/OpenHands merely for comparison.

If every provider-accessible DeepSeek tuple fails a genuine Harness compatibility/property gate, preserve evidence and evaluate OpenCode next. This condition is satisfied by run `34481065588` for the exact DeepSeek candidate above. Do not weaken the gate to retain a preferred harness.

If the exact OpenCode/provider/model tuple passes every required property, OpenCode becomes the selected Workshop harness. If it fails a genuine material harness property, preserve evidence and evaluate OpenHands next; infrastructure or transient provider failures are not evidence that the harness itself is unsuitable.
