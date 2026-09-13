# VXA Multitenancy Threat Matrix (PROPOSED)

Status: `PROPOSED / NOT_AUTHORIZED`
Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
Companions: architecture foundation + tenant-isolation contract (same `.PROPOSED` set).
Scope: planning only. Each row names the planned mitigation and the GAUNTLET gate that must prove it. Nothing here is claimed mitigated today.

Conventions: `Attacker` = capability assumed. `Impact` = worst case if unmitigated. `Gate` = GAUNTLET id in `GNT-VXA-MULTITENANCY-FOUNDATION-001.PROPOSED.md`.

## A. Authorization and session grafting

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| A1 | Client-supplied `tenant_id` accepted as authority | Authenticated user of tenant A sends tenant B id | Full cross-tenant read/write | Server-derived active tenant only; hint must equal derived or fail closed | MT-G01 |
| A2 | Anonymous session grafted into victim tenant | Observer of session A id (logs, shared device, URL) claims it into attacker tenant | History theft / pollution | Single-use 15-min promotion bound to (sessionId + session-secret possession at claim); anonymous session consumed on success; CAS single winner on the session record | MT-G12 |
| A3 | Promotion replay / fixation / double-promotion | Attacker replays consumed token, fixes victim's session id, or promotes A→T1 then A→T2 | Account/tenant takeover assist | Possession-bound claim; consumed record unclaimable (double-promotion fails closed); fixation refused without current-session re-proof; replay fails closed; claim outcomes indistinguishable under uniform denial + `T_deny` (no issuance/session-existence oracle — HSC8-02/NIT10-6) | MT-G12 |
| A4 | Stale membership after removal | Removed member reuses live lease/request | Continued access post-revocation | Membership re-resolved per request; revocation invalidates projection + session binding + purges cached entries | MT-G01 |
| A5 | Tenant-id enumeration | Any client probes sequential/guessable ids | Target discovery for A1-class attacks | CSPRNG ≥128-bit ids, min 25 chars, server-side length rejection; uniform denied responses, no existence oracle | MT-G07 |
| A6 | Invite-token forgery / guessing / lockout-oracle | Attacker mints or guesses invitation tokens; probes invitation outcomes | Unauthorized tenant entry, privilege acquisition; existence oracle via lockout state | Server-issued single-use ≥128-bit invite tokens, 24-h expiry, tenant+matrix-role-bound (`owner`→{`member`,`admin`}, `admin`→{`member`}, `member`→{}, never `owner` — F-08), single-winner concurrent-accept contention on the invitation record with consume-first order (F-09), bounded attempts with per-invitation-only lockout (blast-radius limitation — tenant-wide lockout refused, per-invitee onboarding denial accepted as residual risk with issuer-visible lockout signal + rate-bounded re-issuance); ALL invitation outcomes (invalid/expired/locked/consumed/wrong-tenant) under uniform denial + `T_deny`; acceptance proves invitee subject identity under the companion-architecture §9.12 authN authority AND re-validates the issuer still holds matrix-sufficient role inside the consuming transaction (issuer demoted/revoked since issuance fails closed — HSC9-02); delivery is human-relayed out-of-band copy by the issuer (no product notification channel per S002); lockout-driven re-issuance draws from the separately-bounded replacement reserve (NIT-2). Named residual: the human-relayed channel can be intercepted/forwarded, and acceptance proves AN authenticated identity, not necessarily the INTENDED invitee — binding the token to the intended invitee's identity at issuance (where the issuer knows it) is a Slice-level hardening option, otherwise this residual is accepted and recorded | MT-G01 |
| A7 | Intra-tenant role escalation / self-promotion / grantor revoked mid-grant | Member raises own role to admin/owner; grantor demoted/revoked between check and commit | Full tenant takeover from inside | Closed owner/admin/member roles, server-evaluated per request; self-promotion fails closed; scoped two-party rule for owner-conferring grants (member-invite by owner/admin is not an owner grant; no Slice-level waiver — Founder decision only) with grantor-status re-evaluated inside the committing transaction for every grant/upgrade mutation (HSC9-01/HSC12-01 — request-time-only evaluation fails the gate) | MT-G01 |
| A8 | Last-owner removal/demotion bricks tenant (incl. concurrent final-owner race) | Owner error, compromised owner, or two owners concurrently removing each other (both pre-checks observe ≥2 owners, both commit) | Unadministrable tenant (even deletion ritual unrunnable); zero-owner tenant via TOCTOU | Fail-closed last-owner guard with in-transaction re-evaluation against the contended membership set (pre-check alone insufficient — concurrent contenders serialize, all but at most one fail closed); break-glass-only recovery re-establishing exactly one owner | MT-G01 |
| A9 | Sybil / open-registration tenant provisioning; insider/abuse mass-provisioning on the closed path | Any visitor mass-creates tenants; compromised provisioner credential mass-provisions | Resource exhaustion on Netlify Free; abuse staging; uncontrolled tenant fleet | Closed provisioning by default (operator-provisioned); self-serve only under explicit Founder authorization with rate limits + quota accounting; closed path itself under provisioning ceremony (designated provisioner identity, pre-provisioning approval record at break-glass tamper-evidence bar, full audit, per-provisioner rate limit + live-tenant cap) | MT-G01 |
| A10 | Imported turn references dangle (or tombstone-oracle) after session destruction | Promotion lifecycle gap (any `supportingTurnIds`/`confirmedByTurnId` carrier left unmapped) | Confirmation/history provenance resolving to nothing or a recycled session; cross-tenant tombstone read | Single adopted disposition (remap/tombstone/retain-archive) covering EVERY turn-reference field with membership-gated reads; dangling or globally-addressable tombstone fails closed | MT-G12 |

## B. RLS / pooling / relational

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| B1 | Missing RLS / permissive policy | Misconfig or migration gap | Silent cross-tenant rows | Default-deny RLS on all tenant tables; migration lands column+backfill+RLS together | MT-G02 |
| B2 | Pooler context bleed (session-scoped context leaks to next checkout) | Normal traffic under pooling | Random cross-tenant reads | Transaction-local context only, transaction-wrapped, checkout reset verified | MT-G02 |
| B3 | Statement-mode pooling without transaction | Latency "optimization" | Tenant predicate detached from query | Statement-mode forbidden on tenant paths | MT-G02 |
| B4 | Single-column FK into tenant rows | crafted write referencing other tenant's row id | Cross-tenant linkage / exfil via join | Composite `(tenant_id, id)` FKs everywhere into tenant data | MT-G03 |
| B5 | JSONB-only tenant predicate | Query omits real-column predicate | Bypass via crafted JSONB facet | Real `tenant_id` column + generated-column index; GIN never authoritative | MT-G03 |
| B6 | Trusted-resolver over-privilege | Resolver role granted broader-than-membership read (convenience creep) | Silent cross-tenant rows via the bypass designed to establish the predicate | Dedicated resolver role reads membership/tenant-identity tables ONLY (least privilege); any broader grant refused at review | MT-G02 |
| B7 | Seed-table over-grant to tenant runtime role | Migration/convenience grant of INSERT/UPDATE/DELETE/TRUNCATE on seed | Tenant-path seed pollution escaping the read-only assumption | Seed owned by non-login role; tenant roles SELECT-only; dedicated migration role; exact grant set recorded | MT-G03 |
| B8 | Elevated execution past RLS (TRUNCATE, owner-view, DEFINER hijack, missing-RLS table) | Tenant-path code or compromised member invokes TRUNCATE / queries a privileged-owner view / abuses an unpinned DEFINER function | Whole-table wipe or silent cross-tenant rows outside every policy | Tenant roles hold no TRUNCATE (not subject to RLS) and no DDL on tenant schemas; views over tenant tables security_invoker or forbidden; DEFINER functions pin search_path; catalog assertion proves RLS+FORCE on every tenant table (HSC9-03) | MT-G02 |

## C. Experience RCE via tenant content

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| C1 | Script/markup smuggled in tenant label or annotation | Tenant member authors process content | Stored XSS in victim's Canvas | Executable-surface rejection + closed-key validation before projection | MT-G04 |
| C2 | Cross-tenant target ids in semantic actions | Tenant A references tenant B node/artifact ids | Cross-tenant read or layout pollution | Tenant-scope check at Gate BEFORE evidence/disclosure; uniform client denial with `tenant-scope-denied` as server-side telemetry code only | MT-G04 |
| C3 | Catalog escape via tenant artifact fields | crafted component/URL/import reference | Arbitrary render / exfil | Explicit versioned catalog resolution; no invention by model or tenant data | MT-G04 |
| C4 | Stale projection replayed under another tenant | Replay of captured batch | Cross-tenant state commit | Projection chains partitioned by tenant; cross-tenant replay rejected | MT-G04 |

## D. Cache / storage / queue / integrations

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| D1 | Unkeyed shared cache serves A's artifact to B | Normal use of shared cache | Cross-tenant disclosure | Structured-pair `(tenant_id, …)` key namespacing (never naive concatenation — N9); no unkeyed tenant-path cache; bounded TTL (≤15-min default) | MT-G05 |
| D1b | Revoked member served cached artifact past revocation | Removed member replays cached URL/entry | Continued access post-revocation | Revocation-purge of subject's tenant entries (never TTL-reliance); global flush governed as break-glass | MT-G05 |
| D2 | Storage path traversal out of tenant namespace | Signed-URL / key manipulation | Read/write outside namespace | Server-minted short-lived access (≤15-min default, M3 TTL bar); traversal fails closed | MT-G05 |
| D2b | Bearer cross-session presentation (URL minted for A served to B's session) | Holder of A's signed URL presents it from B's session | Cross-tenant file/artifact read past mint-time binding | Bind-at-serve (serve-time active-tenant re-validation, mismatch fails closed) or explicitly restated expiry-bounded-bearer with the residual window recorded; revocation effective for bearer artifacts within ≤15 min (accepted residual, never instant revocation) | MT-G05 |
| D3 | Queue tenant binding checked only at enqueue | Membership revoked before dequeue | Job executes with stale authority | Re-resolve + re-check at dequeue; retries keep original binding; terminal state drop-with-audit; namespaced `(tenant_id, key)` idempotency | MT-G06 |
| D4 | Webhook secret selected by client field / no rotation | Spoofed tenant field selects weak/known secret; stale secret abused | Forged inbound events | Normative ingress order (route → server table → HMAC verify → attribute); per-tenant versioned secrets with rotation + revocation | MT-G06 |
| D5 | Secrets/customer content in logs or telemetry | Log aggregation access | Credential / PII disclosure | No secrets/tokens/raw content in logs; tenant-safe reason codes only (server-side, never client-visible) | MT-G05 |
| D6 | Cross-tenant starvation / probing-by-load | Tenant floods shared request/compute/queue budget | Degradation or timing oracle against other tenants | Per-tenant quotas with throttle-then-deny under uniform denial shape AND `T_deny` timing discipline (quantized throttle buckets, no 429 oracle); per-tenant queue/webhook budgets; enforcement audited | MT-G14 |
| D7 | Denial-hold amplification via the E2 mitigation itself | Attacker spams failing tenant-path requests, each held open until `T_deny` | Billed Function-duration burn + concurrency saturation manufacturing the D6 starvation the hold was meant to prevent | Billed-duration + concurrency accounting under adversarial denial rates; per-source denial-rate cap with NAT/shared-egress collateral keying stated (N-i); `T_deny` value + free-tier feasibility proof as Founder input — infeasible returns to decision, never to distinguishable fast-denials | MT-G14 |

## E. Browser-untrusted model

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| E1 | Client-local tenant toggle | Malicious browser state | UI shows B's data under A's authority (then served if server trusts hint) | Server round-trip switch; client state never authoritative | MT-G07 |
| E2 | Tenant enumeration via error oracle | Probing unknown vs forbidden (shape, status, timing) | Target discovery | Single uniform client denial shape + `T_deny` minimum-latency bucket on all tenant-path denials (unknown/forbidden cost difference unobservable); throttle quantized to `T_deny` buckets; precise reason codes server-side only | MT-G07 |
| E3 | Cached tenant-B view surviving switch to A | Shared device / fast switch / back-button | Visual cross-tenant leak | Per-tenant projection partition + per-store purge inventory (reactive store, Canvas graph, Harness handle, packs, SW caches, bfcache opt-out / `pageshow` re-validation) | MT-G07 |
| E4 | Switch-endpoint CSRF / confused deputy | Attacker induces victim's browser to call the tenant-switch endpoint (or replays a switch intent) | Victim silently re-scoped into attacker-chosen tenant; subsequent acts misattributed | Switch is a state-changing server round-trip requiring the live session credential (same Bearer/[REDACTED] presentation as any mutation — no cookie-only or GET-triggered switch), re-issues authority server-side, and purges per the E3 inventory; cross-site switch requests without the session credential fail closed | MT-G07 |
| E5 | Leased turn silently continued across tenant switch | Switch during a live leased turn | Cross-partition turn continuation under the wrong tenant | Live leased turn invalidated at switch with deterministic guided re-issue under the new tenant (symmetric to the promotion lease rule); silent continuation fails closed | MT-G07 |

## F. AI / RAG isolation

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| F1 | Cross-tenant retrieval into seller context | Normal RAG over shared namespace | B's facts narrated to A | Per-tenant retrieval namespaces; active-tenant filter pre-budget | MT-G08 |
| F2 | Model-emitted tenant id steers tool access | Prompt injection in tenant content | Tool reads other tenant | Tool args tenant refs untrusted; re-validated server-side | MT-G08 |
| F3 | Attachment content of B reaches model via A's turn | Shared ingestion path | Boundary violation + disclosure | Attachment boundary preserved independent of tenancy (no customer attachment content to DeepSeek, per-tenant or otherwise). `Per-tenant ingestion keys` name a future upload pipeline scoped NOWHERE in §§2–7 — explicitly OUT of this foundation (companion-architecture §9.15): no design may assume ingestion keys exist; the upload pipeline needs its own Slice | MT-G08 |
| F4 | Tenant data leaks via error/diagnostic narration | Verbose tool errors echoed by model | Indirect disclosure | Bounded diagnostics; redaction before model-visible text | MT-G08 |
| F5 | Harness-handle cross-tenant resume | Attacker presents tenant A's Harness session handle under tenant B | Resumed foreign Harness session; cross-tenant tool/state continuity | Harness session state partitioned by active tenant (contract §8); handles are never accepted across partitions — resume/replay/continue under a different tenant fails closed; canonical Vexryzer state authoritative on divergence | MT-G12 |

## G. Backups / export / restore

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| G1 | Export of tenant B by member of A | Export endpoint with hint trust | Bulk exfil | Membership re-verified at export; per-tenant scope | MT-G09 |
| G2 | Cross-tenant restore (A's backup as B) | Restore flag abuse | Bulk overwrite / disclosure | Blocked operation; staging + re-key + re-proof before promotion | MT-G09 |
| G3 | Backup key material exposure | Artifact/log access | Decrypt all tenants | Keys outside backup; never logged or client-exposed | MT-G09 |
| G4 | Mid-export revocation keeps streaming | Membership revoked mid-export; stream never re-validated | Bulk bytes past revocation | Chunked/periodic re-validation (or short-lived tickets re-checked at serve); abort-on-revocation with server-side partial discard; Slice-bounded duration | MT-G09 |

## H. Support / admin

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| H1 | Standing super-read abused | Compromised/insider support account | Bulk cross-tenant access | No standing super-read; break-glass only, time-bound with auto-expiry (overrun fails closed), tenant-scoped, approval-recorded BEFORE access in a hash-chained log with approver-held duplicate (chain recompute + duplicate compare at review; forged/backdated record refused), post-access review by a party other than the actor (actor≠reviewer — HSC6-02; no alert-channel dependency — S002 prohibits notification delivery) | MT-G10 |
| H2 | Raw cross-tenant queries in support tooling | Convenience query path | Silent bulk read | Tenant-scoped projections only | MT-G10 |
| H3 | Rogue legitimate owner (insider abuse within granted privilege) | Duly-authorized `owner` exfiltrates or sabotages their own tenant | Tenant-internal damage within authorized scope | EXPLICITLY DEFERRED as accepted residual risk: break-glass (companion-architecture §9.4) constrains the support plane, not the tenant's own owner — no control in this foundation second-guesses legitimate owner privilege. Detection surface is audit completeness (owner acts fully audited) for post-hoc review, not prevention. A future insider-threat Slice may take this up; no gate claims it mitigated | — (deferred, audited) |

## I. DataPlacement

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| I1 | Model or client steers placement | Injected instruction / crafted request | Data lands in wrong region/store | Placement from server config by active tenant only | MT-G11 |
| I2 | Partial move leaves split-brain tenant | Interrupted migration | Inconsistent reads | Per-tenant completeness verification before source decommission | MT-G11 |

## J. Anonymous-session preservation (regression threats)

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| J1 | Tenancy code alters anonymous paths | N/A (regression) | S002 breakage | Anonymous paths behavior-identical with tenancy present-but-inert; tenancy additive-only, proven by diff-scoped review (no tenant-branch code in anonymous Gate paths) | MT-G13 |
| J2 | Silent merge of expired anonymous data | Lifecycle bug | Wrongful retention / pollution | Expire-and-destroy; never silent merge | MT-G12 |

## K. Tenant lifecycle / deletion

| # | Threat | Attacker | Impact | Planned mitigation | Gate |
|---|--------|----------|--------|--------------------|------|
| K1 | Partial deletion (rows gone, backups/caches/exports linger) | Lifecycle bug or operator shortcut | Wrongful retention; erasure-request failure | Freeze→erase→purge→backup-expiry ritual; partial deletion is a defined gated failure | MT-G15 |
| K2 | Restore of deleted tenant via routine path | Backup operator / compromised tooling | Resurrection of erased tenant data | Deleted-tenant restore requires fresh Founder-level re-authorization; backups unrestorable past retention window | MT-G15 |
| K3 | Compromised tenant cannot be deprovisioned cleanly | Attacker-held membership | Persistent foothold | Owner-confirmed freeze revokes all memberships and drains conditional queue depth to drop-with-audit (assumes ≥1 honest owner to confirm — a sole-hostile-owner tenant falls under deferred H3, not this row) | MT-G15 |
| K4 | Abandoned Harness segments retained servable outside any partition | Promotion lifecycle bug (history persists past abandonment) | Cross-partition history retention contradicting K1 logic | Destroy at promotion-commit where the store supports delete; else destruction timestamp enforced server-side at read/serve time (no assumed store TTL); physical reclamation via companion-architecture §9.16 feasibility | MT-G12 |

## Reasoning effort record

- Authoring model: Muse Spark (Muse Code). Correction pass: single-model deep review + edit in this runtime; the wrapper requested reasoning-effort `ultra`; the runtime reported `ultra_reasoning_effort` closed and executed `xhigh`. This fallback is material execution evidence and must not be represented as `ultra`.
- GAUNTLET correction round: same runtime; wrapper requested `ultra`, runtime executed `xhigh` because `ultra_reasoning_effort` was closed. A-section renumbered sequential (A8 last-owner race, A9 provisioning); D7 (denial-hold amplification), E4 (switch CSRF), F5 (Harness-handle resume) added; H3 (rogue owner) explicitly deferred, not claimed; F3 ingestion keys scoped out to companion-architecture §9.15.
- Critic-11 correction round (HSC9-01…04): same runtime; wrapper requested `ultra`, runtime executed `xhigh` because `ultra_reasoning_effort` was closed. A7 extended with grantor-revoked-mid-grant (in-transaction rule); A6 extended with issuer-still-authorized re-validation; B8 added for elevated execution past RLS (TRUNCATE/views/DEFINER/missing-RLS).
- Critic-12 correction round: same runtime; wrapper requested `ultra`, runtime executed `xhigh` because `ultra_reasoning_effort` was closed. No matrix change required — A7's in-transaction mitigation already reads on every grant/upgrade mutation; HSC12-01 recorded as the generalizing norm in arch/contract/gates/plan.
- Finding-ID legend (N14): H/M/L = round-1 HIGH gate-correctness / MEDIUM design / LOW findings; F-## = round-2/3 follow-up findings; N/N-a…/N-i…/N1… = round-2…5 corrective + nit IDs (each bare-N ID names exactly one norm — split/E4/M1/M3/N-i tags were disambiguated in the HSC6 round; legacy N-d reads N-i); HSC4/HSC5/HSC6/HSC7/HSC8/HSC9/HSC12 = hostile-critic rounds 4/5/6/7/8/9/12.
