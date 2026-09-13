# Multi-Tenancy Security Foundation — Ordered Implementation Plan (PROPOSED)

STATUS: PROPOSED / NOT AUTHORIZED
FORGE_BINDING_ID: FORGE-VEXRYZER-AUTOMATION-v1.0.0
PARENT_ARCHITECTURE: job/docs/architecture/VXA-MULTITENANCY-SECURITY-FOUNDATION.PROPOSED.md
SECURITY_CONTRACT: job/docs/security/VXA-TENANT-ISOLATION-SECURITY-CONTRACT.PROPOSED.md
CURRENT_SLICE: VXA-S002@1.0.0
CURRENT_SLICE_MUTATION: PROHIBITED

## 1. Purpose

This plan decomposes the future foundation into Experience Slices. It does not authorize any Slice. Each Slice must receive a Founder-authorized contract, exact base SHA and binding GAUNTLET before implementation.

The order is security-driven: identity and tenant authority must exist before tenant-owned data; database isolation must be proven before business modules depend on it; declarative experiences depend on the same ownership model; asynchronous/storage/integration/AI planes follow after the core authority contract is stable.

## 2. Migration from current anonymous state

Current durable truth:
- anonymous AgentSession;
- session token digest;
- lease/request/revision;
- compare-and-set persistence;
- deterministic canonical/reactive state;
- DeepSeek single truth;
- closed Experience/AgentIntent contracts.

Migration principle:
Anonymous sessions remain valid pre-auth state. Authentication does not overwrite the anonymous record in place without an explicit attach/claim transaction.

Proposed attach flow:
1. anonymous visitor creates/uses existing AgentSession;
2. future user authenticates;
3. server establishes PrincipalContext;
4. user creates/selects a tenant or redeems membership;
5. server constructs verified TenantContext;
6. explicit AttachAnonymousSession transaction validates session ownership, freshness and target tenant;
7. canonical/session data eligible for attachment is copied/linked under a tenant-owned record with provenance;
8. operation is idempotent and recorded;
9. original anonymous token is invalidated or narrowed according to the final design;
10. foreign tenant/session attachment attempts fail closed.

No client-side change of tenant_id migrates data.

## 3. Proposed Slice sequence

### VXA-MT-S001 — Identity + Tenant Authority Kernel
Status: PROPOSED / NOT AUTHORIZED.

Scope:
- identities;
- tenants;
- memberships;
- capabilities/roles;
- PrincipalContext;
- TenantContext;
- membership/security version;
- session revocation;
- tenant suspend/delete state;
- explicit support/admin authority model;
- anonymous->authenticated attach contract.

RED first:
- foreign tenant selector;
- revoked membership;
- tenant switch without membership;
- guessed resource id;
- stale session after role change;
- support access without explicit capability.

Exit:
Server-side authority exists independently of frontend state. No tenant-owned business data beyond what is necessary to prove authority.

### VXA-MT-S002 — PostgreSQL Tenant Isolation Kernel
Status: PROPOSED / NOT AUTHORIZED.

Scope:
- PostgreSQL provider selection;
- schema ownership classification;
- runtime/migration roles;
- RLS design;
- tenant-aware FK/unique constraints;
- chosen transaction tenant-context mechanism;
- real connection-pool proof;
- database privilege inspection.

RED first:
- cross-tenant read/write/update/delete;
- omitted application tenant filter;
- missing DB context;
- runtime role owner/BYPASSRLS;
- connection reuse A->B;
- cross-tenant FK;
- unsafe migration.

Exit:
Real PostgreSQL demonstrates isolation for >=2 tenants with application authorization plus database barrier.

### VXA-MT-S003 — Declarative Experience Persistence + Private Delivery
Status: PROPOSED / NOT AUTHORIZED.

Scope:
- Experience aggregate;
- immutable ExperienceVersion;
- registered components/actions/data sources/themes;
- safe renderer projection;
- rollback/version activation;
- tenant ownership;
- private server-side logic boundary.

RED first:
- executable fields;
- unknown component/action;
- cross-tenant Experience id;
- version tampering;
- stale publish;
- unsafe URL;
- browser attempts privileged action directly.

Exit:
Personalized experiences can differ deeply by tenant without separate SPA or proprietary backend delivery.

### VXA-MT-S004 — Custom Data Collections
Status: PROPOSED / NOT AUTHORIZED.

Scope:
- collection schemas;
- documents JSONB;
- schema validation/versioning;
- byte/depth/cardinality limits;
- safe query DSL;
- promoted relational fields/index policy;
- tenant-aware constraints and RLS.

RED first:
- dangerous object keys;
- oversized/deep documents;
- raw SQL attempts;
- cross-tenant collection/document ids;
- expensive unbounded query shapes.

Exit:
Tenant-custom data is flexible but remains bounded, queryable and isolated.

### VXA-MT-S005 — Storage + Cache + Async Isolation
Status: PROPOSED / NOT AUTHORIZED.

Scope:
- provider selection;
- cache key contract;
- object storage namespace/policy;
- signed URL contract;
- queue job authority envelope;
- replay/idempotency;
- tenant quotas/noisy-neighbor controls.

RED first:
- cache collision;
- stale cache after revocation;
- foreign object;
- stale signed URL;
- cross-tenant job;
- stale membership job;
- queue flooding.

Exit:
All non-DB persistence/async planes satisfy tenant isolation contract.

### VXA-MT-S006 — Integrations / OAuth / Webhooks
Status: PROPOSED / NOT AUTHORIZED.

Scope:
- encrypted credential store;
- OAuth flow;
- integration ownership;
- webhook signature/replay;
- outbound network policy/SSRF controls;
- tenant-specific integration rate limits.

RED first:
- foreign integration id;
- invalid/replayed callback;
- overbroad token;
- unapproved outbound destination;
- webhook tenant confusion.

Exit:
External integrations cannot cross tenant authority.

### VXA-MT-S007 — AI / RAG / Search Tenant Isolation
Status: PROPOSED / NOT AUTHORIZED.

Scope:
- tenant-scoped retrieval;
- vector/search ownership;
- authority-bound tool calls;
- prompt-injection boundaries;
- model/session memory isolation;
- tenant-aware AI quotas/evals.

RED first:
- foreign document/vector ids;
- missing tenant retrieval filter;
- prompt asks for another tenant;
- tool call without authority;
- cached model result reused across tenants.

Exit:
AI can operate on tenant data without becoming an authorization system or a cross-tenant memory channel.

### VXA-MT-S008 — Tenant Operations / Export / Restore / Placement
Status: PROPOSED / NOT AUTHORIZED.

Scope:
- DataPlacement runtime;
- shared->dedicated migration;
- tenant export;
- tenant restore;
- offboarding/deletion;
- backups;
- support/break-glass operational tooling.

RED first:
- export foreign rows/files;
- restore foreign ownership;
- placement switch with stale route;
- split-brain cutover;
- deleted tenant stale jobs/tokens.

Exit:
Enterprise placement and tenant lifecycle exist without bifurcating application/domain architecture.

## 4. RED-first verification strategy

Every Slice:
1. bind exact authorized base SHA;
2. classify all relevant security invariants;
3. build failing adversarial proof before implementation;
4. implement smallest root-cause fix preserving architecture;
5. run targeted tests;
6. run complete relevant suite;
7. run real provider/infrastructure tests where isolation depends on provider behavior;
8. run independent Security Critic;
9. correct findings and re-run;
10. freeze exact candidate SHA;
11. re-run candidate-specific gates.

Mocks may be used for deterministic units but cannot establish database/storage/cache/queue tenant isolation PASS.

## 5. Required PostgreSQL proof harness

The PostgreSQL Slice must provision a disposable real PostgreSQL environment matching the selected major version/provider semantics closely enough to test:
- roles/ownership;
- RLS enable/force state;
- policies;
- privileges;
- transactions;
- connection pooling mode;
- prepared statements where applicable;
- migration role behavior.

Fixtures:
Tenant A and Tenant B, each with at least two principals and resources with colliding human-readable names.

Attack operations:
- direct read;
- joined read;
- aggregate;
- insert;
- update;
- delete;
- upsert;
- bulk operation;
- relationship traversal;
- background-job transaction.

Expected result:
No operation by A can observe/mutate B unless an explicitly authorized cross-tenant administrative contract is being tested.

## 6. Browser/API proof

Future tests must use real browser/API behavior:
- DevTools-equivalent direct API calls;
- altered tenant/resource selectors;
- replay;
- role change while page open;
- tenant switch;
- stored/reflected/DOM content;
- CSRF/CORS policy;
- CSP/Trusted Types where adopted;
- browser storage inspection after logout/tenant switch.

The frontend is considered compromised for authorization tests.

## 7. Provider selection criteria

No provider is chosen by this planning artifact.

When selecting PostgreSQL/cache/storage/queue/auth providers, score:
- security controls;
- role/RLS semantics;
- connection pool behavior;
- backup/restore;
- regional placement;
- encryption/key integration;
- observability/audit;
- free-tier constraints without weakening security;
- operational reliability;
- portability cost;
- documented incident/recovery capabilities.

Provider convenience cannot weaken the Tenant Isolation Security Contract.

## 8. Evidence model

For every security gate record:
- execution plane;
- exact candidate SHA;
- test/command/run identifier;
- provider/version;
- tenant fixture identities without secrets;
- expected denial/allow behavior;
- observed result;
- artifacts/logs sanitized;
- remaining NOT_VERIFIED items.

Changed candidate invalidates candidate-specific PASS.

## 9. Planning risks

P1 Over-engineering tenancy before product need.
Control: shared DB first, explicit seams only, no premature dedicated infra.

P2 RLS creates false confidence.
Control: application authorization + DB privileges + RLS + tests.

P3 GUC/pooling context leaks.
Control: transaction-local candidate only after real pool proof; alternatives remain open.

P4 JSONB becomes schema avoidance.
Control: promotion policy and integrity-driven relational model.

P5 Experience configuration becomes code execution.
Control: closed registered grammar and safe projection.

P6 Authentication migration destroys anonymous-session invariants.
Control: explicit attach transaction and non-regression.

P7 Support becomes hidden superuser.
Control: explicit separate audited authority.

P8 AI sees everything because it is "internal".
Control: TenantContext-bound retrieval/tooling with complete mediation.

P9 Dedicated tenant requirement forks codebase.
Control: DataPlacement abstraction below domain repositories, same ownership model.

P10 Security tests become mock theater.
Control: mandatory real PostgreSQL/provider/browser negative proof.

## 10. Authorization boundary

None of VXA-MT-S001 through VXA-MT-S008 is authorized.

The Founder must choose the next Slice and bind it to the then-current exact repository SHA. The proposed GAUNTLET may be adopted, strengthened or replaced at authorization time; it cannot self-authorize implementation.
