# GNT-VXA-MULTITENANCY-FOUNDATION-001.PROPOSED — Tenant Isolation Foundation GAUNTLET

STATUS: PROPOSED / NOT AUTHORIZED
FORGE_BINDING_ID: FORGE-VEXRYZER-AUTOMATION-v1.0.0
TARGET_SLICE: FUTURE / NOT YET AUTHORIZED
CURRENT_SLICE: VXA-S002@1.0.0 — MUST NOT BE MUTATED BY THIS PROPOSAL
PARENT_ARCHITECTURE: job/docs/architecture/VXA-MULTITENANCY-SECURITY-FOUNDATION.PROPOSED.md
SECURITY_CONTRACT: job/docs/security/VXA-TENANT-ISOLATION-SECURITY-CONTRACT.PROPOSED.md
PLAN: job/docs/superpowers/plans/2026-09-13-vxa-multitenancy-security-foundation-plan.PROPOSED.md

## Authority

This is a proposed future gate. It has no implementation authority until the Founder authorizes a concrete Slice with an exact base SHA.

No PASS in this document applies to VXA-S002 or to production.

## Gate model

A future foundation candidate fails if any mandatory gate is FAIL or NOT_VERIFIED without an explicitly authorized deferral.

### GMT-01 Authority / exact candidate
Correct repository, branch, Slice, base SHA, candidate SHA and write-set. Any candidate mutation invalidates candidate-specific evidence.

### GMT-02 Current-product non-regression
Anonymous session lease/revision/idempotency, DeepSeek single truth, deterministic Trust Kernel, current Canvas behavior and security boundaries are preserved until explicitly migrated.

### GMT-03 Frontend-untrusted contract
Direct API calls, changed ids/routes/state and disabled-control bypass do not grant additional authority.

### GMT-04 Principal authentication
Authenticated principal is server-established and session/token validation is fail-closed.

### GMT-05 Tenant resolution
Client tenant selector is validated against active membership/service grant; unknown, suspended or unauthorized tenant fails closed.

### GMT-06 Tenant switching
Switching tenant is an authorized server transition and invalidates tenant-specific client/server state as required.

### GMT-07 Capability/resource authorization
Every tenant-owned API action is mediated for principal + tenant + action + resource + policy version.

### GMT-08 BOLA/IDOR
Foreign tenant resource ids cannot be read, mutated, deleted, linked, exported or inferred through ordinary APIs.

### GMT-09 Revocation
Membership/role/session/tenant revocation becomes effective within the designed security window across request, cache and async planes.

### GMT-10 PostgreSQL role separation
Runtime role is not superuser, has no BYPASSRLS and does not own protected tables where owner bypass would apply. Migration/owner identity is separate.

### GMT-11 RLS inventory
Every shared TENANT_OWNED table is discovered from schema and proves RLS/policy state. An unclassified table fails the gate.

### GMT-12 RLS read isolation
Tenant A cannot read tenant B through direct lookup, joins, aggregates, list endpoints or omitted application filters.

### GMT-13 RLS write isolation
INSERT/UPDATE/DELETE/UPSERT cannot create or mutate foreign-tenant rows. USING/WITH CHECK behavior is proven.

### GMT-14 Missing DB tenant context
Tenant-scoped database access without verified tenant context denies; no unscoped fallback exists.

### GMT-15 Pool reuse
Real pooled connections alternate tenants repeatedly without tenant-context leakage.

### GMT-16 Pool mode / prepared statements
Selected pool mode and prepared-statement behavior are proven compatible with the isolation design.

### GMT-17 Tenant-aware relational integrity
Unique constraints and foreign keys prevent cross-tenant references while allowing legitimate same-value data in different tenants.

### GMT-18 Migration safety
Migrations cannot silently create tenant-owned persistence without classification, isolation controls and tests. Runtime cannot execute DDL.

### GMT-19 Function/trigger safety
SECURITY DEFINER, triggers and policy helper functions receive explicit hostile review for privilege/search_path/isolation problems.

### GMT-20 Declarative Experience safety
Experience definitions reject arbitrary executable JS/JSX/HTML/CSS, arbitrary imports/URLs, raw SQL, shell, unrestricted selectors and unregistered components/actions.

### GMT-21 Experience version integrity
Published versions are immutable, tenant-owned, revision-safe and rollback-safe. Cross-tenant version references fail.

### GMT-22 Dynamic document safety
Collection/document schemas enforce size/depth/cardinality/type limits and dangerous-key rejection. Query DSL is bounded and parameterized.

### GMT-23 Cache isolation
Tenant-dependent keys cannot collide; revocation/policy-version invalidates stale authorization-dependent entries.

### GMT-24 Object storage isolation
Foreign object access, key confusion, signed URL scope/expiry and content-type handling are tested against the real selected provider where relevant.

### GMT-25 Queue/worker isolation
Jobs carry verified authority references, reject stale/foreign authority, are idempotent/replay-safe and cannot let one tenant exhaust the worker fleet without limits.

### GMT-26 OAuth/integration isolation
Credentials are server-only and tenant-bound; redirect/state/PKCE/audience/scope and rotation controls match the selected integration design.

### GMT-27 Webhook isolation
Signature, replay, event schema and tenant binding are enforced before domain mutation.

### GMT-28 SSRF / egress policy
Outbound destinations obey the selected allowlist/policy; redirects and non-public destinations cannot bypass controls.

### GMT-29 Browser security
Stored/reflected/DOM injection, CSRF, CORS and CSP/Trusted Types posture are tested in a real browser. CSP is not treated as sole XSS defense.

### GMT-30 AI/RAG isolation
Retrieval/memory/search is tenant-bound; missing tenant scope fails; no foreign vector/document retrieval is possible.

### GMT-31 AI tool authority
Model intent never authorizes an action. Downstream tool authorizer validates principal/tenant/action/resource and applies least privilege.

### GMT-32 Prompt-injection containment
Untrusted user/retrieved/integration content cannot enlarge data/tool authority or exfiltrate another tenant's data.

### GMT-33 Logging/telemetry privacy
Secrets, raw protected payloads and inappropriate PII do not appear in logs/metrics/traces; tenant correlation is bounded and safe.

### GMT-34 Rate/noisy-neighbor isolation
Identity/tenant/resource/global quotas prevent one tenant from consuming disproportionate DB/queue/AI/integration capacity.

### GMT-35 Custom-domain tenant routing
Host resolves only through verified DomainBinding; unknown/dangling domain fails and Host never substitutes for membership authorization.

### GMT-36 Support/admin isolation
Cross-tenant operator access requires separate capability, actor identity, target tenant, reason/TTL and audit. No silent bypass.

### GMT-37 Backup security
Mixed-tenant backup access, encryption, retention and restore permissions are independently reviewed.

### GMT-38 Tenant export
Export inventory is ownership-derived and post-verified; fixtures prove tenant A export excludes every tenant B record/object.

### GMT-39 Tenant restore
Restore/import validates ownership in isolated staging/control path and cannot activate foreign records.

### GMT-40 Offboarding
Suspension, session revocation, job cancellation/rejection, integration revocation and retention/deletion workflow are proven.

### GMT-41 DataPlacement routing
Client/model cannot choose a placement. Shared/dedicated routing preserves identical domain authorization semantics.

### GMT-42 Placement migration
Cutover has generation/state, verification and rollback; no silent split-brain or mixed placement writes.

### GMT-43 Secret confinement
No server secret appears in browser bundles, source maps, Experience definitions, AI prompts, logs or public artifacts.

### GMT-44 Dependency/supply-chain
Lockfile, provenance/license/security review and vulnerability scanning cover new security-critical dependencies.

### GMT-45 Real infrastructure proof
Tenant-isolation PASS cannot rely exclusively on mocks. Real PostgreSQL plus real selected provider/browser proof is mandatory for controls whose behavior is provider-dependent.

### GMT-46 Independent Security Critic
A critic independent from the builder attacks authorization, RLS, pooling, tenancy across all planes, Experience RCE surfaces, AI isolation, operations and recovery.

### GMT-47 Recovery readiness
Security incident paths can revoke sessions/memberships, suspend tenant, disable integrations/domains, invalidate security epochs and preserve forensic events.

### GMT-48 Candidate freeze
Exact candidate SHA frozen after corrections; all affected gates rerun; evidence is bound to that SHA.

## Mandatory adversarial fixture

At minimum:
- tenant A and tenant B;
- two users in A with different capabilities;
- at least one user in B;
- colliding human-readable resource names across A/B;
- active then revoked membership;
- active then suspended tenant;
- queued work created before revocation;
- objects/cache/search records for both tenants.

## Convergence

Builder is never final judge.

After the last material correction:
1. run full affected verification;
2. run independent Security Critic;
3. correct root cause for every valid finding;
4. repeat until no material finding;
5. obtain two fresh independent consecutive critic PASSes on the same candidate bytes;
6. freeze candidate SHA;
7. rerun candidate-specific gates if freeze changes bytes.

No document-only review can produce production tenant-isolation PASS.
