# Tenant Isolation Security Contract — PROPOSED

STATUS: PROPOSED / NOT AUTHORIZED FOR IMPLEMENTATION
FORGE_BINDING_ID: FORGE-VEXRYZER-AUTOMATION-v1.0.0
PARENT_ARCHITECTURE: job/docs/architecture/VXA-MULTITENANCY-SECURITY-FOUNDATION.PROPOSED.md
PLANNING_PARENT_SHA: ae6f4cb99291ce74ec48435cec7a1149abf50c69

## 1. Purpose

This contract defines security properties that a future authorized multi-tenant foundation Slice must satisfy. It is deliberately stricter than "tenant_id is present" and deliberately independent of UI behavior.

The governing security statement is:

Even if the frontend is controlled by an attacker, it cannot obtain authority the backend did not grant.

Even if one application query omits an intended tenant filter, another independent isolation layer must materially reduce the probability of horizontal disclosure.

A single layer failure must not automatically become a platform-wide tenant breach.

## 2. Authority objects

Principal
- authenticated human/service/support identity;
- never derived from browser state alone.

TenantSelection
- user/request choice of organization/domain;
- selector only, never authority.

TenantContext
- server-verified immutable request/transaction authority context.

AuthorizationDecision
- action + tenant + principal + resource + policy-version decision.

DataPlacement
- logical location of tenant-owned persistence;
- not an authorization object.

## 3. Mandatory invariants

TIS-001 No tenant authority from unverified input.
Headers, host, URL, query, body, cookies, local storage, model output and Experience config cannot independently establish tenant authority.

TIS-002 Membership/service grant is current.
TenantContext can be constructed only from active membership or explicitly authorized service grant. Revocation/suspension invalidates subsequent requests.

TIS-003 Every privileged request is mediated.
Authorization must run for each privileged operation, including indirect paths such as batch endpoints, exports, background work, file URLs and tool calls.

TIS-004 Object lookup is tenant/resource authorized.
Knowing or guessing an id never grants access. APIs avoid lookup-then-authorize patterns that expose existence where a tenant-scoped lookup/authorization boundary can be used.

TIS-005 Server context is immutable downstream.
Once TenantContext is built, downstream layers consume the verified value; they cannot replace it with client/model input.

TIS-006 Runtime DB role cannot defeat row isolation.
Ordinary tenant-request database credentials are not superuser, do not have BYPASSRLS and are not owners where owner bypass would defeat RLS.

TIS-007 Shared tenant-owned tables are deny-by-default.
RLS is enabled for classified shared tenant tables, with policy coverage appropriate to SELECT/INSERT/UPDATE/DELETE and WITH CHECK for writes.

TIS-008 Missing tenant context fails closed.
A query path dependent on tenant context returns denial/zero tenant-owned rows rather than becoming unscoped.

TIS-009 Cross-tenant references are structurally blocked.
Tenant-owned relational references use constraints that prevent linking tenant A rows to tenant B rows where the relationship is tenant-scoped.

TIS-010 Migration privilege is separate.
DDL/migration identity is separate from runtime application identity. Production runtime cannot opportunistically acquire migration privileges.

TIS-011 New persistence is classified.
Every new table/index/object-store namespace/cache/queue/search index is explicitly classified GLOBAL, TENANT, USER, SECURITY_INTERNAL or another reviewed isolation class before merge.

TIS-012 Cache identity is complete.
Tenant-dependent cache entries include tenant scope and relevant authorization/policy versions. No global key can resolve tenant-owned data.

TIS-013 Storage identity is complete.
Object access is authorized for exact tenant + object + operation. Object-key possession or prefix does not imply authority.

TIS-014 Queue authority is complete.
Tenant id in a job message is not authority. Consumers reconstruct verified authority and reauthorize high-impact/stale operations.

TIS-015 Integration credentials are tenant bound.
Credential references resolve only inside the verified tenant/integration relationship and are never browser-readable.

TIS-016 AI authority is bounded.
LLM/RAG/tool output is proposal/data. Downstream systems perform complete mediation and server-side tenant authorization.

TIS-017 Search/retrieval is tenant isolated.
Search/vector/document retrieval cannot run without mandatory tenant scope or stronger placement isolation. Missing filters fail closed.

TIS-018 Experience definitions are non-executable.
Customer/model-authored experience data cannot create arbitrary JS/JSX/HTML/CSS/SQL/shell/network execution.

TIS-019 Support access is explicit.
Cross-tenant support/admin access uses separate capabilities, actor identity, target tenant, reason, TTL and audit. No silent master bypass.

TIS-020 Revocation propagates.
Membership, tenant, integration or support revocation has an explicit invalidation mechanism for sessions, caches, queued work and signed capabilities proportional to risk.

TIS-021 Error responses do not enumerate tenants.
Denials should avoid distinguishing "foreign tenant object exists" from "not accessible" unless product requirements explicitly require disclosure.

TIS-022 Audit preserves actor and tenant.
Security-sensitive events record real actor, verified tenant, decision/reason and request correlation without logging secrets.

TIS-023 Backup/export/restore preserves ownership.
Mixed-tenant backup privileges are isolated. Tenant export/restore has ownership verification and cannot silently include foreign records.

TIS-024 Custom domain does not become authority.
Host/domain maps to a candidate tenant through verified DomainBinding; privileged operations still validate principal membership/capability.

TIS-025 No security claim from identifier entropy.
Opaque UUIDs reduce enumeration but never replace authorization.

TIS-026 Tenant isolation is tested on real infrastructure.
Mocks cannot be the only evidence for database/cache/storage/queue isolation.

TIS-027 No current-Slice scope smuggling.
VXA-S002 remains anonymous-session scope. Future identities/tenants require a new Founder-authorized Slice.

## 4. Database contract

For every TENANT_OWNED shared PostgreSQL table, the implementation plan must specify:
- ownership column/key;
- RLS enablement;
- FORCE RLS decision;
- runtime role;
- owner/migration role;
- SELECT policy;
- INSERT/UPDATE WITH CHECK policy;
- DELETE policy;
- tenant-aware unique constraints;
- tenant-aware foreign keys;
- required indexes;
- cross-tenant denial tests.

Schema review fails if any item is omitted without a stronger documented isolation boundary.

## 5. PostgreSQL role contract

Expected logical roles:
- schema_owner / migration role: owns schema objects and performs controlled DDL; not used for tenant requests;
- application_runtime: minimal DML/EXECUTE grants; NOSUPERUSER; NOBYPASSRLS; non-owner for protected tables;
- operational_readonly or support roles only if later required and separately constrained/audited.

No application path may SET ROLE into a more privileged database role based on tenant input.

Any SECURITY DEFINER function must:
- have a narrowly scoped purpose;
- be owned by a controlled role;
- set or harden search_path as appropriate;
- reference trusted schemas explicitly;
- expose no generic SQL execution;
- be tested for cross-tenant access and injection;
- receive independent security review.

## 6. Tenant-context DB contract

If a custom PostgreSQL setting is selected:
- it is established only from server-verified TenantContext;
- it is transaction-local;
- the transaction begins before context is set;
- no tenant-sensitive statement runs before context is set;
- connection is returned only after commit/rollback;
- missing/invalid setting denies;
- callers cannot supply raw SET/SET LOCAL SQL;
- ordinary SQL injection must not be able to choose another tenant context;
- pooled reuse and transaction-pool behavior are explicitly tested;
- background jobs follow the same verified-context rule.

Session-scoped GUC reuse across requests is PROHIBITED unless a later architecture demonstrates an equivalent stronger reset/isolation model with adversarial tests.

## 7. Experience security contract

Published ExperienceVersion is immutable.

Experience definition grammar is closed and versioned. Unknown keys fail closed.

Registered surface/action/data-source ids are server-defined.

DataSource definitions contain logical references, not credentials or arbitrary URLs/SQL.

Actions resolve to a finite server-owned capability catalog.

Themes use bounded token schemas; no raw CSS injection.

Rich content uses safe structured data and context-correct encoding/sanitization.

Generated definitions are validated identically whether authored by humans or AI.

The renderer receives only an authorized projection.

## 8. Identity/session contract

Future authenticated session must bind:
- principal id;
- session id;
- security/membership version;
- authentication assurance metadata;
- active tenant selection where product UX supports switching;
- expiration/revocation semantics.

Tenant switching is a server-authorized state transition, not a client variable update.

The current anonymous AgentSession lease/revision/idempotency semantics should be preserved or consciously superseded with equivalent guarantees.

## 9. Cache contract

Cache namespaces/keys must include all dimensions that change authorization or representation:
- tenant;
- resource;
- representation/version;
- policy/security epoch where needed.

Negative authorization results may be cached only with careful TTL/version semantics.

Authentication or authorization cache invalidation must support revocation.

Cross-tenant key collision/property tests are mandatory.

## 10. Object storage contract

Signed URL generation is an authorization event.

Signed URL scope includes exact object and operation. TTL is minimized.

Uploads have server-created object identity or strict normalized key policy.

Download/upload authorization is repeated as required by the operation model.

File metadata cannot smuggle executable browser content into unsafe sinks.

Content-type, size and malware policy are explicit for each file class.

## 11. Async contract

Every queued job has idempotency/replay handling.

A stale membership/policy can invalidate execution.

High-impact jobs reauthorize at execution.

Global/system jobs use explicit service identity and scope rather than a fake tenant.

Queue fairness protects other tenants from one tenant's excessive load.

## 12. Integration contract

Secrets never enter client bundles, Experience definitions or model prompts.

OAuth/webhook/integration objects are tenant-owned.

OAuth redirect destinations are registered, exact and server-controlled.

Webhook signatures/replay windows are verified before tenant-domain mutation.

Outbound network actions are governed by destination policy/SSRF controls.

## 13. AI/RAG contract

Context/retrieval code receives server-verified TenantContext.

Model cannot select arbitrary tenant namespace.

Retrieval filters/namespace are mandatory.

Tool authorizer validates principal/tenant/action/resource separately from model intent.

Indirect prompt injection cannot grant tool or data authority.

Model caches and conversation memory do not cross tenants.

No secret is treated as protected merely because it is in a system prompt.

## 14. Verification gates

A future implementation cannot claim tenant-isolation PASS without:
- >=2 tenant fixtures on real PostgreSQL;
- foreign-id read/write/update/delete attacks;
- omitted-filter tests demonstrating DB barrier;
- RLS owner/BYPASSRLS privilege inspection;
- connection-pool reuse tests;
- missing-context tests;
- tenant-aware FK/unique constraint attacks;
- membership/session revocation;
- cache collision/revocation;
- storage foreign-object attacks;
- signed-URL expiry/replay;
- queue replay/stale membership/cross-tenant payload;
- webhook signature/replay and tenant binding;
- SSRF destination attacks;
- browser XSS/CSRF/CORS/CSP tests;
- Experience executable-surface rejection;
- AI/RAG foreign-tenant retrieval/tool attacks;
- backup/export/restore review;
- secret/bundle/source-map scan;
- independent Security Critic.

## 15. Failure and recovery

Isolation failures are security incidents, not generic validation errors.

Required operational capabilities for the eventual platform:
- revoke sessions/memberships;
- suspend tenant;
- invalidate policy/security epoch;
- stop/cancel queued work where possible;
- revoke integration credentials/tokens;
- disable compromised domain/integration binding;
- rotate secrets/keys;
- preserve forensic security events;
- identify potentially affected tenant sets;
- execute tenant-specific restore/export only through reviewed tooling.

## 16. Explicit non-goals

This contract does not:
- select an identity provider;
- select PostgreSQL/cache/storage/queue vendors;
- implement authentication;
- authorize database migrations;
- authorize dedicated tenant databases;
- authorize billing;
- change VXA-S002;
- claim production security PASS.
