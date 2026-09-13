# Vexryzer Multi-Tenancy Security Foundation + Private Experience Delivery

STATUS: PROPOSED / PLANNING ONLY / NOT AUTHORIZED FOR IMPLEMENTATION
FORGE_BINDING_ID: FORGE-VEXRYZER-AUTOMATION-v1.0.0
REPOSITORY: r-sudo-jeferson/vexryzer-automation
BRANCH: staging/vxa-s002-agent-led-accounting-seller
PRODUCT_ROOT: job
CURRENT_SLICE: VXA-S002@1.0.0
CURRENT_GAUNTLET: GNT-VXA-S002-001
PLANNING_PARENT_SHA: 458a0f76b41004f8188ce997ebc11db281c10c57
FRONT: MULTITENANCY SECURITY FOUNDATION + PRIVATE EXPERIENCE DELIVERY
AUTHORITY: Founder planning directive
IMPLEMENTATION_AUTHORITY: NONE

## 1. Decision summary

Vexryzer should evolve toward a shared-platform, strongly isolated multi-tenant SaaS with a generic declarative experience renderer. The default data placement is a shared PostgreSQL deployment for ordinary tenants, protected by application authorization plus database-enforced isolation. Dedicated databases/clusters/regions remain future placement options behind an explicit routing seam, not today's default.

The browser is permanently untrusted and has no security authority. A tenant identifier, resource identifier, route, hostname, UI state, disabled button, Experience definition, browser token, or model instruction never grants authority by itself. Every privileged operation is authenticated, tenant-resolved, authorized, validated and minimally disclosed on the server.

The customer receives an experience, not Vexryzer's proprietary backend. Code and logic that must remain private stays server-side. Any JavaScript shipped to the browser is assumed inspectable. Minification and obfuscation are not intellectual-property boundaries.

The architecture deliberately rejects the shortcut "PostgreSQL + tenant_id + RLS + JSONB = secure". Security requires multiple independent barriers across identity, application authorization, database privileges/RLS, cache, storage, queues, integrations, AI retrieval/tooling, telemetry, rate limiting, backup/export/restore and support/admin workflows.

## 2. Current-state compatibility

VXA-S002 currently implements an anonymous visitor session model, not authenticated tenants. The active persistence seam is AgentSessionRepository with compare-and-set behavior; the Netlify Blobs implementation validates session keys, strongly reads back writes, and treats ambiguous writes as failure. Agent sessions bind token digest, request id, lease id and canonical revision and reject replay/stale revision. These are non-regression properties.

The Experience protocol is already a closed typed contract. AgentIntent rejects unknown shapes and obvious executable surfaces and bounds actions/evidence. The future Experience Engine must preserve and generalize that closed-contract posture rather than accept arbitrary code/configuration.

No identity provider, tenant database schema, PostgreSQL provider, cache provider, object-storage provider, queue provider or billing provider is selected by this planning artifact. Provider selection requires its own evidence and authorization.

## 3. Target trust architecture

Internet
-> CDN/WAF/Gateway
-> generic frontend/renderer
-> authenticated API boundary
-> server-side PrincipalContext
-> server-side TenantResolver
-> Authorization Engine
-> domain/application service
-> Experience Engine / Automation Engine
-> Data Placement Router
-> tenant-scoped data adapter
-> PostgreSQL / object storage / queues / integrations

Parallel controls:
- security event/audit pipeline;
- per-identity/per-tenant/per-resource rate limiting;
- secret management;
- policy/version invalidation;
- operational break-glass workflow;
- backup/export/restore controls.

Trust boundaries:
TB1 Browser <-> edge/API.
TB2 Authentication/session <-> application principal.
TB3 Principal + selected organization <-> server-verified TenantContext.
TB4 Authorization <-> domain operation.
TB5 Domain operation <-> data placement adapter.
TB6 Application role <-> PostgreSQL.
TB7 Application <-> cache/storage/queue/integration.
TB8 Application <-> DeepSeek/RAG/search/tooling.
TB9 Operator/support/admin <-> tenant resources.
TB10 Backup/export/restore <-> tenant data package.

## 4. PrincipalContext and TenantContext

A client-provided tenant id is a selector only. The server establishes authority using authenticated identity plus current membership/service authorization.

PrincipalContext conceptual fields:
- principal_id;
- authentication_method/session_id;
- assurance/session metadata;
- membership_version;
- security_epoch;
- actor_type: human | service | support;
- delegated authority where explicitly authorized.

TenantContext conceptual fields:
- tenant_id;
- membership_id or service-grant id;
- capability set;
- policy version;
- tenant status;
- data placement id;
- request correlation id;
- optional resource/attribute conditions.

TenantContext must be immutable for the request/transaction after server construction. Downstream code may consume it but may not replace it from headers, query strings, body fields, model output or cached data.

Failure to resolve a valid active membership/capability is deny-by-default. Suspended/deleted tenants and revoked memberships fail closed.

## 5. Authorization model

Use RBAC only as a coarse administrative vocabulary. The authorization engine should support capabilities plus resource ownership/relationship conditions and narrowly scoped attributes where required.

Every tenant-owned access path must be mediated. Authorization is evaluated for action + principal + tenant + resource + resource state + policy version. A valid resource id does not imply access.

Examples:
- experience.read on experience owned by selected tenant;
- experience.publish requires authoring capability and valid version transition;
- integration.execute requires integration binding owned by tenant and allowed operation;
- file.download requires exact object authorization;
- support.impersonate requires separate support role, explicit reason/ticket/TTL and immutable audit.

No application service may expose a generic "run as tenant" bypass path. Cross-tenant administration is a separate privileged product surface, not an unscoped variant of tenant APIs.

## 6. Private Experience Engine

Conceptual aggregate:
Experience
-> immutable ExperienceVersion
-> Pages/Regions
-> Canvas Nodes
-> registered UI Components
-> bounded Variables
-> declared Data Sources
-> typed Actions
-> typed Automations
-> permission references
-> Theme/Tokens.

Rules:
- published versions are immutable; edits create a new version;
- rollback selects a prior immutable version;
- version activation is transactional and auditable;
- draft/published/retired transitions are explicit;
- renderer consumes a normalized validated projection, not raw authoring JSON;
- every component/action/data-source kind is registered server-side and versioned;
- unknown kinds/keys fail closed;
- references are resolved server-side and tenant-scoped;
- model-generated composition passes the same validators as human-authored composition.

PROHIBITED execution surfaces:
- arbitrary JavaScript/JSX;
- executable HTML;
- arbitrary CSS;
- eval / Function;
- arbitrary dynamic imports;
- shell commands;
- client/model-generated SQL;
- unrestricted DOM selectors;
- unregistered components/actions;
- arbitrary network URLs or iframe origins;
- executable expressions stored in JSON.

Where limited rich text or URLs are needed, use safe structured formats and explicit allowlists/sanitization. Where iframe capability is ever authorized, require a separately reviewed sandbox/allowlist contract.

## 7. Proprietary-code delivery boundary

Browser may receive:
- generic renderer/runtime;
- registered visual component code intended for public execution;
- authorized Experience projection;
- minimum authorized data;
- signed/opaque references;
- safe UX state;
- API calls.

Server retains:
- authorization rules;
- tenant-resolution policy;
- proprietary algorithms;
- automation execution;
- integration credentials;
- secret material;
- DeepSeek/tool orchestration;
- sensitive transformations;
- data-access implementation;
- proprietary business rules;
- internal prompts/policies where useful, while never treating prompt secrecy as a security control.

Security objective is not "hide all frontend logic"; it is "frontend compromise cannot grant new server authority".

## 8. Conceptual data model

Structural relational entities:
- tenants;
- identities;
- memberships;
- roles;
- capabilities;
- role_capabilities;
- membership_roles or grants;
- experiences;
- experience_versions;
- automations;
- integrations;
- files;
- audit_events;
- security_events;
- data_placements;
- future billing entities only under later authorization.

Custom-data entities:
collections(
  tenant_id,
  id,
  experience_id,
  schema_version,
  schema_definition,
  metadata,
  lifecycle_state,
  timestamps
)

documents(
  tenant_id,
  id,
  experience_id,
  collection_id,
  schema_version,
  data_jsonb,
  timestamps
)

Every tenant-owned table has explicit ownership semantics. Shared-table designs should normally carry tenant_id NOT NULL and tenant-aware uniqueness/FKs. Global reference tables are explicitly classified GLOBAL and must never accidentally inherit tenant semantics.

## 9. JSONB promotion policy

JSONB is appropriate for bounded, tenant-defined document payloads whose shape legitimately varies and whose query/access patterns are not yet stable.

Promote a field/concept to relational table/column/index when one or more are true:
- it participates in authorization or ownership;
- it is a foreign-key target/reference;
- it participates in uniqueness/integrity rules;
- it drives high-frequency filtering/sorting/joining;
- it needs strong type/domain constraints;
- it is audited independently;
- it is involved in money, billing, identity, membership, placement or security;
- query plans require predictable indexes/statistics;
- update concurrency requires narrower locking semantics;
- retention/deletion rules differ materially.

Dynamic document controls:
- closed schema language;
- schema versioning/migration;
- maximum serialized bytes;
- maximum object/array depth;
- maximum property/array cardinality;
- allowed primitive types;
- dangerous-key rejection (__proto__, prototype, constructor and equivalent normalization cases);
- no executable expressions;
- allowlisted query DSL compiled server-side to parameterized queries;
- controlled index creation by platform policy, never tenant-provided raw DDL.

## 10. Data Placement Router

Concept:
Tenant -> DataPlacement -> adapter/connection target.

DataPlacement fields should express logical placement, not leak provider credentials:
- placement_id;
- mode: shared | dedicated_database | dedicated_cluster | dedicated_region;
- logical region;
- status;
- migration generation;
- connection profile reference;
- policy metadata.

Today: shared mode is the intended default.
Future: regulated/enterprise tenants may be moved without changing domain ownership semantics.

The domain layer must not construct provider-specific connection strings or branch behavior on tenant name. A tenant-scoped repository receives a verified TenantContext/DataPlacement and resolves a bounded data adapter.

Placement migration must have dual-read/write semantics only if separately designed and proven; the default migration plan should prefer explicit quiesce/copy/verify/cutover/rollback over long-lived split-brain.

## 11. PostgreSQL isolation design

Application authorization is barrier 1. PostgreSQL privileges/RLS are barrier 2.

For shared tenant-owned tables:
- tenant_id NOT NULL;
- RLS enabled;
- default deny relied upon when no applicable policy exists;
- FORCE ROW LEVEL SECURITY where table-owner bypass would otherwise matter;
- ordinary runtime role: NOSUPERUSER, NOBYPASSRLS, not table owner;
- migration/DDL owner role separated from runtime role;
- minimum GRANTs;
- policies cover SELECT/INSERT/UPDATE/DELETE using USING and WITH CHECK;
- tenant-aware unique constraints;
- tenant-aware foreign keys, typically composite (tenant_id, id) -> (tenant_id, id), where relationally appropriate;
- no SECURITY DEFINER function without explicit security review, fixed search_path strategy and least-privilege ownership.

A table classification gate must classify every table as TENANT_OWNED, GLOBAL_REFERENCE, SECURITY_INTERNAL or explicitly isolated by another boundary. New tenant-owned tables fail schema review if RLS/ownership constraints/tests are absent.

## 12. RLS tenant-context strategy

Do not blindly adopt session-scoped custom GUCs.

Preferred candidate for evaluation:
- application begins a transaction;
- server has already verified TenantContext;
- application sets a transaction-local tenant context using SET LOCAL / set_config(..., true);
- RLS policies read that transaction-local value;
- all tenant-scoped statements execute in the same transaction;
- transaction commits/rolls back before connection returns to pool;
- missing/invalid tenant setting yields zero rows/denial, never unscoped access.

Required attack analysis:
- session SET accidentally survives pooled reuse;
- transaction pooling changes connection association;
- SQL injection changes context;
- code executes statement before context establishment;
- nested transaction/savepoint behavior;
- prepared statement behavior;
- background job lacks verified context;
- privileged role bypass;
- migration code uses runtime credentials;
- connection reset failure.

Alternatives must be compared before implementation:
A) transaction-local GUC;
B) database roles keyed to tenant groups;
C) explicit policy predicates against server-controlled identity/session mappings;
D) separate schema/database for selected placements.

Decision criteria: fail-closed behavior, connection-pool compatibility, least privilege, operational complexity, performance and verifiability.

## 13. Cache isolation

Every cached value whose result varies by tenant includes tenant identity and relevant authorization/policy version in the key or is stored in an enforceably separate namespace.

Never:
cache(resource_id) for tenant-owned resource.

Prefer conceptual:
cache(tenant_id, policy_version, resource_type, resource_id, representation_version).

Authorization decisions require short bounded TTLs or event/version invalidation appropriate to risk. Revocation increments membership/policy/security version so stale authorized entries cannot remain silently valid.

Test deliberate key collisions, normalized-id collisions, stale policy versions and tenant-switch sequences.

## 14. Object storage isolation

Classify each object GLOBAL, TENANT or USER scoped.
Tenant objects use an enforceable tenant partition: prefix/bucket/account/policy depending provider.
Object keys are server-generated or strictly normalized; no path traversal semantics.
Authorize exact tenant + object + operation before returning content or signing a URL.
Signed URLs are short-lived, method-bound and object-bound. They are bearer capabilities and require a replay/expiry/revocation threat model.
Validate MIME by content where needed, filename metadata separately, size limits and malware/content policy for uploaded files.
Never trust tenant id encoded in object key as authorization proof.

## 15. Queue/worker isolation

Queued work carries:
- immutable job id;
- verified tenant id;
- principal/service authority reference;
- operation type;
- resource references;
- idempotency key;
- policy/membership/security version where required;
- creation/expiry time.

Producer path authenticates and authorizes enqueue.
Consumer validates schema and producer provenance, reconstructs TenantContext from trusted authority references and reauthorizes high-impact/stale operations.
Tenant id inside message is never sufficient authority.
Replay, duplicate delivery, poisoned job, stale membership and tenant deletion are explicit outcomes.
Use tenant-aware queue/concurrency quotas to prevent noisy-neighbor denial of service.

## 16. Integrations, OAuth and webhooks

Integration credentials remain server-side and should use envelope encryption/managed key material when selected provider supports it and risk justifies it.
Credentials are bound to tenant + integration + scopes + version/rotation metadata.

OAuth:
- Authorization Code + PKCE for browser/native public-client style flows;
- state/nonce/issuer validation as applicable;
- exact redirect URI allowlist;
- narrow scopes;
- token audience/resource validation;
- refresh-token rotation or sender-constraining where supported and justified.

Webhooks:
- tenant/integration endpoint binding;
- signature verification over raw canonical request representation as provider specifies;
- timestamp/nonce/replay window;
- idempotency/deduplication;
- body size/content-type limits;
- event allowlist;
- no authority inferred from payload tenant id.

Outbound integration/network actions use destination policy and SSRF controls. If destinations are known, allowlist. Redirects are disabled or revalidated hop-by-hop. Block loopback, link-local, metadata and internal ranges according to the selected network model.

## 17. Browser compromise model

Assume attacker:
- edits JavaScript/state/routes;
- removes disabled controls;
- changes tenant/resource ids;
- calls APIs directly;
- replays requests;
- uses valid stolen/captured tokens within their real authority;
- mutates Experience JSON;
- injects reflected/stored/DOM XSS;
- attempts CSRF/CORS abuse;
- injects prototype-pollution keys;
- runs malicious extensions;
- exploits third-party frontend dependencies.

Backend invariants:
- no privileged API trusts UI state;
- every request reauthenticates session/token as designed;
- every operation reauthorizes current principal/tenant/resource;
- Experience definitions are server-validated before publish/use;
- no renderer input becomes executable code;
- API errors do not confirm existence of foreign-tenant objects where avoidable;
- CORS is narrowly configured and never substitutes for authorization;
- CSRF protection matches chosen session/token transport;
- CSP/Trusted Types/output encoding/safe sinks reduce XSS impact but do not grant authority.

## 18. Custom domains / Host resolution

Host is routing input, not authority.

A verified server-side DomainBinding maps normalized host -> tenant_id + status + certificate/verification metadata.
Unknown/unverified hosts fail closed.
After host resolution, authenticated principal membership/capability is still checked for privileged operations.
Domain changes are versioned/audited and cached with revocation-aware invalidation.
Do not derive storage/database placement directly from raw Host.

## 19. AI / RAG / search isolation

DeepSeek and any future retrieval/search service operate under a server-verified authority envelope.

Rules:
- prompts do not carry raw untrusted tenant selectors as authority;
- context builder receives TenantContext from server;
- every retrieval namespace/filter is server-enforced;
- vector/document entries carry tenant ownership;
- retrieval filters are mandatory and fail closed if absent;
- tool calls carry authority context and are reauthorized by downstream service;
- model output is untrusted proposal, not policy;
- no arbitrary SQL/shell/filesystem/network tools in customer runtime;
- prompt injection is hostile content, including retrieved documents and integration payloads;
- no cross-tenant conversational memory;
- caches for model/retrieval outputs are tenant/policy scoped;
- logs/evals do not mix raw tenant-sensitive prompts by default.

System prompt secrecy is not a security boundary. Credentials, authorization rules and proprietary secrets must not be placed in prompts as if nondisclosure were enforceable.

## 20. Logs, audit and security events

Operational logs minimize PII and never contain secret values.
Tenant id may be included for authorized operational correlation but raw tenant payloads are excluded by default.
Security events include principal, verified tenant, action, target class/id where safe, decision, reason code, policy/version, request correlation and timestamp.
High-risk audit trails require tamper protection/append-only semantics proportional to risk.
Foreign-tenant denial should be observable without returning confirming details to the caller.

## 21. Support/admin and break-glass

Support/admin access is not a magical bypass.
Use separate identities/roles and explicit cross-tenant capabilities.
Require reason/ticket, target tenant, bounded TTL, optional approval for high-risk actions, prominent audit and customer-visible audit where product policy later requires.
No shared "support master tenant".
Break-glass credentials are separately protected, monitored, short-lived where possible and reviewed after use.
Impersonation must preserve actor identity; audit records both real actor and effective tenant context.

## 22. Backup, export, restore and deletion

Backups containing multiple tenants are a high-value mixed-tenant security boundary.
Access to backup systems is separate from runtime application access.
Encryption, retention, access audit and restore procedures must be designed before claiming tenant isolation complete.

Tenant export:
- server-authorized tenant;
- schema-derived inventory of tenant-owned records/objects;
- referential completeness checks;
- no global secrets/internal tables;
- deterministic manifest;
- post-build verification that every item belongs to requested tenant.

Tenant restore:
- restore into isolated staging or controlled import path;
- reject foreign ownership;
- remap identifiers only through explicit migration rules;
- re-run invariants/RLS tests before activation.

Tenant deletion/offboarding is asynchronous but stateful: suspend access first, cancel/reject stale jobs, revoke integrations/tokens, purge/retain according to policy, produce auditable completion evidence.

## 23. Rate limiting and noisy-neighbor containment

Limits exist at multiple dimensions:
- identity/session;
- tenant;
- endpoint/action;
- expensive AI/tool/integration operation;
- queue depth/concurrency;
- database/connection consumption;
- global service safety.

A single tenant must not monopolize shared worker/database/AI quotas. Limit failures remain tenant-scoped and should not leak the existence/activity of other tenants.

## 24. Security invariants

MT-I01 Browser input never grants tenant authority.
MT-I02 Every tenant-owned access path receives immutable server-verified TenantContext.
MT-I03 Authorization is checked for every privileged operation.
MT-I04 Resource id validity never substitutes for authorization.
MT-I05 Ordinary runtime DB role cannot bypass RLS.
MT-I06 Tenant-owned shared tables are classified and protected by database-enforced isolation.
MT-I07 Missing DB tenant context fails closed.
MT-I08 Cross-tenant relational references are structurally prevented where applicable.
MT-I09 Cache/storage/queue namespaces cannot collide across tenants.
MT-I10 Background work cannot reconstruct authority from tenant id alone.
MT-I11 Experience definitions cannot introduce executable code.
MT-I12 Model output cannot authorize tools/data.
MT-I13 Secrets/proprietary server logic never rely on browser secrecy.
MT-I14 Support/admin cross-tenant access is explicit and auditable.
MT-I15 Revocation has a version/epoch invalidation path.
MT-I16 Backup/export/restore preserves ownership isolation.
MT-I17 DataPlacement changes do not change domain ownership semantics.
MT-I18 Any unclassified new persistent table/resource fails security review.

## 25. Scope classification

CURRENT_ARCHITECTURE_REQUIREMENT:
- frontend-untrusted contract;
- server-side authority model;
- declarative non-executable Experience architecture;
- explicit tenant ownership semantics;
- defense-in-depth target including app authorization + DB isolation;
- DataPlacement seam;
- isolation requirements for cache/storage/queue/integration/AI/logging;
- migration design from anonymous sessions;
- RED-first proof requirements.

FUTURE_SLICE_REQUIRED:
- identities/authentication provider;
- tenants/memberships/roles/capabilities runtime;
- PostgreSQL provisioning/schema/migrations;
- RLS policies/runtime DB roles;
- DataPlacement implementation;
- ExperienceVersion persistence/runtime;
- object storage/queue/cache integration;
- OAuth/integration credential vault;
- RAG/vector storage;
- support/admin runtime;
- tenant export/restore/offboarding;
- billing.

COMPATIBILITY_SEAM:
- current AgentSessionRepository -> future principal/tenant-aware session storage;
- current closed AgentIntent/Experience validation -> future registered Experience Engine schemas;
- current Netlify deployment -> future provider-neutral repository/adapters where justified;
- logical DataPlacement interface;
- tenant/security policy version epochs.

PROHIBITED:
- trusting browser tenant_id;
- one database/app per tenant by default;
- arbitrary executable Experience code;
- model/client SQL;
- security based on minification/obfuscation;
- RLS-bypassing ordinary runtime role;
- session-scoped tenant context reused blindly across pooled connections;
- unscoped cache/storage/queues;
- hidden support bypass;
- cross-tenant AI memory/retrieval;
- implementation inside VXA-S002 without a future authorized Slice.

## 26. Required research baseline

Architecture decisions must be verified against current official material at implementation time:
- PostgreSQL 18 Row Security Policies: https://www.postgresql.org/docs/18/ddl-rowsecurity.html
- PostgreSQL 18 CREATE POLICY: https://www.postgresql.org/docs/18/sql-createpolicy.html
- PostgreSQL SET / SET LOCAL: https://www.postgresql.org/docs/current/sql-set.html
- PostgreSQL Function Security: https://www.postgresql.org/docs/18/perm-functions.html
- OWASP Multi-Tenant Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Multi_Tenant_Security_Cheat_Sheet.html
- OWASP Authorization Cheat Sheet
- OWASP Session Management Cheat Sheet
- OWASP SSRF Prevention Cheat Sheet
- OWASP XSS Prevention Cheat Sheet
- OWASP Content Security Policy Cheat Sheet
- OWASP OAuth2 Cheat Sheet
- OWASP ASVS 5.0.0
- OWASP API Security Top 10 2023
- OWASP GenAI Security Project current guidance
- NIST SP 800-207 and 800-207A.

## 27. Planning conclusion

The preferred architecture is shared-by-default with explicit isolation, not database-per-customer and not "tenant_id everywhere" as the only protection.

The highest-risk decision still requiring implementation-time proof is the PostgreSQL runtime tenant-context mechanism. Transaction-local GUC + RLS is a strong candidate because it is compatible with shared tables and pooling when rigorously transaction-scoped, but it is not frozen by this document until real provider/pool behavior and injection/failure modes are tested.

No implementation is authorized by this document. A future Slice must bind an exact base SHA, select concrete providers, materialize RED tests first and adopt the proposed security contract/GAUNTLET only after Founder authorization.
