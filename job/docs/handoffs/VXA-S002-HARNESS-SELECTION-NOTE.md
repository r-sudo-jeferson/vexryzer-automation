# VXA-S002 Real-Agent Harness Selection Note

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
gauntlet_id: `GNT-VXA-S002-001`
status: `IN_PROGRESS / NOT_VERIFIED`
architecture_amendment: `VXA-ARCH-A002`
selected_workshop_harness: `OpenCode 1.18.30`
selected_workshop_provider_tuple: `groq / openai/gpt-oss-120b`
selection_evidence_sha: `e8f627947dd0223dbf7237aa64d54687aab86c72`
selection_evidence_run: `34483101166`

## Founder direction

The Founder requires a real agent harness for controlled code/UI Workshop work and directed Engineering to prefer DeepSeek Harness, OpenHands or OpenCode rather than reducing the Workshop to prompt-only generation.

## Evaluation order

1. `DeepSeek Harness 0.1.2-rc.1` with the already reviewed `sdk-minimal` / `dsh-llm-pi-ai` stack.
2. OpenCode only if DeepSeek Harness fails a material compatibility/property gate for every usable free Workshop candidate.
3. OpenHands only if the first two paths are unsuitable and a maintained, security-compatible execution route can be proven.

This order minimizes new dependency/runtime surface and preserves the exact Harness evidence already accumulated. An access/rate-limit failure from one provider does not prove the Harness itself incompatible.

## Required meaning of agent compatibility

A Workshop harness compatibility PASS requires actual agent behavior, not merely a successful chat completion. The exact tuple must prove:

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

This compatibility PASS is a harness-selection gate only. It is not `GNT-VXA-S002-001` PASS and does not authorize live Workshop enablement without the later execution/egress/isolation gates required by the GAUNTLET.

## DeepSeek decision evidence

GitHub Actions run `34481065588` on candidate SHA `d023f91666da19e123cf1a1549ebe777c5cd4255` completed with the exact DeepSeek Harness `0.1.2-rc.1` agentic gate failing a mandatory property.

- Groq `openai/gpt-oss-120b` proved streaming, a real `str_replace_editor` filesystem edit, structured arguments, a second read tool round-trip, semantic use of that tool result, and timeout mapping. The persisted Harness data retained the nonce, but a recreated Harness using the same session identifier did not recall it without another filesystem read. `restartSafe=false`.
- Cloudflare Workers AI `@cf/openai/gpt-oss-120b` also did not prove restart safety and additionally encountered `CONTEXT_WINDOW_EXCEEDED` during the agent turns.
- Direct provider screening in the same run proved the Groq model can stream, call tools and replay a tool result, so the Groq DeepSeek failure is not reducible to isolated function-calling incompatibility.

The restart/session requirement was intentionally unchanged. The exact DeepSeek candidate therefore had a genuine material compatibility failure for every provider-accessible Workshop tuple tested. Per the pre-existing decision rule, OpenCode became the authorized next harness candidate. Re-running the unchanged DeepSeek candidate automatically would add CI cost without a new hypothesis; its probe remains available for explicit future re-verification after a material Harness change.

## OpenCode root-cause correction

The first complete OpenCode attempt, run `34482490384`, failed operationally before a harness-compatibility verdict. The initial custom provider configuration used `@ai-sdk/openai-compatible`, which replayed assistant reasoning to Groq as `reasoning_content`. Groq rejected that request. This was classified as integration/protocol failure, not OpenCode incompatibility, so it did not authorize skipping to OpenHands.

A regression test then required OpenCode's bundled Groq-native adapter. Run `34482982103` observed the intended RED state: `65/66` pure tests passed and the only failure was the exact adapter mismatch. The implementation was corrected minimally to `@ai-sdk/groq`, preserving the same provider/model, permissions, credential confinement and compatibility requirements.

## OpenCode compatibility PASS

GitHub Actions run `34483101166` on exact SHA `e8f627947dd0223dbf7237aa64d54687aab86c72` completed successfully with OpenCode `1.18.30` + Groq `openai/gpt-oss-120b`.

Observed bounded result:

- pure multiprovider/OpenCode contracts: `66/66 PASS`;
- exact OpenCode package/binary version: `1.18.30`;
- direct Groq protocol screen: authenticated, streaming, tool call and tool replay all `true`;
- real filesystem write/edit: PASS;
- real later `read` tool call: PASS;
- structured arguments: PASS;
- semantic use of the read tool result: PASS;
- explicit same-session continuation using fresh CLI processes: PASS;
- restart recall with no additional tool read: PASS;
- `restartSafe=true`;
- same session identity across fresh processes: PASS;
- process restarts proven: `2`;
- execution-plane wall-timeout mapping: PASS;
- bounded evidence artifact upload: PASS;
- artifact id: `10154543748`;
- artifact SHA-256 digest: `fb86de3a9c8c5d7f140a1892ba35705b32cc3aacd9963815a3e69ea540f52f6f`.

The timeout evidence proves the Workshop execution-plane can terminate and classify an over-budget OpenCode subprocess. It does not, by itself, prove every provider-native timeout mode; provider HTTP timeout/cancel semantics remain a separate application/runtime verification concern.

## Selection decision

OpenCode `1.18.30` with Groq `openai/gpt-oss-120b` is the selected Workshop harness tuple for the current S002 construction path because it is the first evaluated tuple to satisfy every mandatory real-agent compatibility property without weakening the gate.

OpenHands is not evaluated merely for comparison and is not part of the selected runtime surface. It becomes eligible for evaluation only if a future material OpenCode incompatibility appears and the existing decision rule authorizes that transition.

The normal ASK AI Seller remains provider-neutral and does not run inside a long-lived development harness. Canonical sales context belongs to Vexryzer. The selected harness is the controlled Workshop execution plane for code/UI adaptation and prototype generation.

## Financial and security boundary

All evaluated routes must remain usable without registered payment method, paid subscription, prepaid credits or overage. No harness receives customer attachments, production secrets, the live Vexryzer repository during a visitor session, arbitrary package/network authority or permission to publish generated code without validation.

The current OpenCode compatibility proof denies or omits Bash, subagents, web access, external directories, sharing and unrelated model credentials. That proof does not substitute for the GAUNTLET's later adversarial workspace escape, symlink, metadata-network, background-process, package-install, cleanup and egress verification before any live visitor Workshop is enabled.

## Exact-candidate semantics

The compatibility result above belongs exactly to SHA `e8f627947dd0223dbf7237aa64d54687aab86c72`. This documentation update necessarily creates a later SHA; therefore it must not be described as candidate-specific GAUNTLET evidence for that later state.

Before `GNT-VXA-S002-001` PASS, Engineering must freeze the final candidate and rerun all candidate-specific gates required by the authorized GAUNTLET on that exact SHA. Until then the Slice remains `IN_PROGRESS / NOT_VERIFIED`.
