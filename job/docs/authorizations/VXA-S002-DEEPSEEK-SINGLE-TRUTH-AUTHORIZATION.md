# VXA-S002 DeepSeek Single Truth Authorization

binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
slice_id: `VXA-S002`
slice_version: `1.0.0`
gauntlet_id: `GNT-VXA-S002-001`
authorized_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0a`
status: `AUTHORIZED / IN_PROGRESS`
authorized_at: `2026-09-11`
authority: `FOUNDER_EXPLICIT_DIRECTIVE`
architecture_amendment: `VXA-ARCH-A004`

## Authorized direction

The Founder explicitly directed Engineering to remove every other failed or alternative model/provider/harness and preserve a single mandatory AI truth.

The only authorized generative route is:
- provider: DeepSeek;
- model: `deepseek-v4-pro`;
- harness: DeepSeek Harness;
- target Harness version for fresh verification: `0.1.5-rc.2`;
- server credential: `DEEPSEEK_API_KEY`;
- API base: `https://api.deepseek.com`.

No other LLM provider, model, alias, fallback, standby route, model bakeoff, alternative harness or emergency model is authorized. Unavailability must produce deterministic guided recovery rather than provider substitution.

## Revoked current-state assumptions

The previous multi-provider/free-tier strategy and the previous alternative Harness selection are revoked as active architecture. Historical evidence remains in Git history but must not remain an eligible runtime/configuration path.

The earlier fixed-cost R$0 LLM requirement is superseded only for the Founder-authorized prepaid DeepSeek API balance. Automatic recharge, automatic upgrade, uncontrolled spending and hidden paid fallback remain forbidden.

## Canvas authority

The authorized agent is not merely a chat responder. It persistently coordinates the Infinite Canvas through validated semantic tools. The Canvas is part of the agent's commercial reasoning surface.

The model may decide what visual semantic action best increases truthful understanding or persuasion. Application code owns whether that action is valid, safe, accessible and consistent with canonical evidence.

## Integrity

This authorization does not waive any GAUNTLET requirement. It does not convert documentation claims into compatibility PASS. The exact DeepSeek Harness/model/account tuple remains NOT_VERIFIED until direct evidence proves the required agent, persistence, tool, restart, security and quality properties.
