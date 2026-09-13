# Vexryzer Multi-Tenancy Defensive Attack Matrix — PROPOSED

STATUS: PROPOSED / NOT AUTHORIZED FOR IMPLEMENTATION
PARENT_ARCHITECTURE: job/docs/architecture/VXA-MULTITENANCY-SECURITY-FOUNDATION.PROPOSED.md
SECURITY_CONTRACT: job/docs/security/VXA-TENANT-ISOLATION-SECURITY-CONTRACT.PROPOSED.md

This matrix is defensive verification design. Each future applicable row must map to a concrete control owner and RED test on the exact authorized candidate. NOT_APPLICABLE requires an explicit reason.

| ID | THREAT | TRUST BOUNDARY | PREVENTION | DETECTION | TEST | RECOVERY |
|---|---|---|---|---|---|---|
| TM-01 | BOLA/IDOR | API -> authorization | TenantContext + resource authorization | denied-access events | A cannot access B resource by id | deny; investigate repeated attempts |
| TM-02 | horizontal privilege escalation | authorization | capability/resource checks | decision telemetry | lower-role member denied peer-restricted action | revoke grant/session if compromised |
| TM-03 | vertical privilege escalation | authorization/admin | separate admin capabilities | privileged-denial alerts | normal member denied admin actions | revoke; policy correction |
| TM-04 | cross-session access | session -> domain | session ownership binding | session mismatch events | session A denied session B state | invalidate session |
| TM-05 | cross-tenant access | tenant boundary | server-verified tenant context + downstream isolation | cross-tenant denial event | A denied B data on every plane | security incident workflow |
| TM-06 | guessed identifiers | API -> resource | identifier never equals authority | enumeration telemetry | valid foreign ids remain denied | rate-limit/investigate |
| TM-07 | session fixation | browser -> session | server-issued session and rotation on auth transition | binding anomalies | preselected session cannot become authenticated authority | rotate session |
| TM-08 | session replay | browser -> session | expiry/revocation/security epoch | replay anomalies | revoked/expired session denied | invalidate sessions |
| TM-09 | stale membership | identity -> tenant | membership/security version | stale-version denial | revoked member loses access across requests | invalidate caches/sessions |
| TM-10 | revoked user retains async access | tenant -> worker | worker reauthorization where required | post-revoke job denial | job created before revoke cannot perform forbidden action | discard/cancel job |
| TM-11 | suspended/deleted tenant access | tenant lifecycle | tenant status checked at ingress and async execution | post-suspension activity | active session denied after suspend | suspend/cancel/revoke |
| TM-12 | confused deputy | service boundary | delegated authority envelope | service authorization logs | service cannot act for unrelated tenant | revoke delegation |
| TM-13 | SQL injection | app -> DB | parameterized SQL + bounded DSL + least privilege | DB anomaly/error telemetry | injection corpus causes no unauthorized DB action | rotate exposed credentials if needed |
| TM-14 | application omits tenant filter | app -> DB | RLS as independent barrier | RLS denial/zero-row evidence | foreign rows remain inaccessible | block release |
| TM-15 | RLS absent on tenant table | schema -> DB | schema classification gate | schema inventory drift | new tenant table without RLS fails gate | block/repair migration |
| TM-16 | RLS policy misconfiguration | DB policy | reviewed USING/WITH CHECK | policy inventory | A denied B on select/insert/update/delete | rollback/fix policy |
| TM-17 | runtime role BYPASSRLS | DB role | NOBYPASSRLS | role drift check | real DB privilege inspection | revoke attribute/rotate |
| TM-18 | runtime role owns protected table | DB ownership | separate owner role and FORCE decision | ownership inventory | protected table owner != runtime | change owner/fix role |
| TM-19 | runtime superuser | DB role | non-superuser runtime | connection identity check | fail gate if runtime is superuser | replace credential |
| TM-20 | cross-tenant foreign key | relational integrity | tenant-aware FK | constraint telemetry | A child cannot reference B parent | reject/fix schema |
| TM-21 | unsafe migration | migration boundary | separate migration role + post-migration isolation suite | schema/privilege diff | tenant table changes require classification/tests | rollback migration |
| TM-22 | SECURITY DEFINER misuse | DB function boundary | minimize; controlled owner/search_path; review | function inventory | foreign-tenant and privilege tests | revoke/drop/fix function |
| TM-23 | transaction tenant context missing | app -> DB | missing context fails closed | context failure event | tenant query without context returns denial | fix call path |
| TM-24 | connection-pool context leakage | DB pool | transaction-local context + commit/rollback before release | pool reuse suite | alternating A/B connections remain isolated | drain/fix pool design |
| TM-25 | pool mode incompatibility | DB pool | design against actual provider/pool mode | configuration drift | real pooling mode isolation suite | change mode/design |
| TM-26 | prepared statement context error | DB pool | policy evaluates current verified transaction context | reuse tests | prepared operation under A then B remains isolated | disable unsafe pattern |
| TM-27 | race/TOCTOU after authorization | authorization -> commit | security/policy version; recheck high-impact commit | stale-decision event | revoke between decision and commit | abort/retry |
| TM-28 | cache poisoning | cache | authorized producers + typed versioned entries | unexpected-write events | unauthorized actor cannot overwrite tenant cache | purge/fix producer |
| TM-29 | cache key collision | cache | tenant/policy/resource in canonical key | collision tests | A/B colliding resource names remain separated | purge/fix key schema |
| TM-30 | stale cache after revocation | cache | security epoch/TTL/invalidation | post-revoke hit metric | revoked access not served from cache | increment epoch/purge |
| TM-31 | queue/job poisoning | queue | authenticated producer + closed job schema | invalid job/DLQ event | foreign authority fields cannot create valid job | quarantine |
| TM-32 | stale background job | worker | expiry + reauthorization | stale-job denial | revoked creator's sensitive job denied | discard/requeue if authorized |
| TM-33 | cross-tenant job confusion | queue -> worker | verified tenant/authority reconstruction | mismatch event | mutated tenant/resource references denied | quarantine/investigate |
| TM-34 | noisy-neighbor worker exhaustion | shared compute | tenant concurrency/throughput quotas + global cap | per-tenant saturation | single tenant load does not starve others | throttle tenant |
| TM-35 | object storage key confusion/traversal | storage | server-generated/normalized keys | invalid-key events | malformed keys cannot escape tenant namespace | reject/quarantine |
| TM-36 | foreign object access | storage | exact object + operation authorization | denied object event | A denied B object | deny |
| TM-37 | presigned URL replay | storage -> browser | short TTL; method/object scope; revocation model | repeated/expired use telemetry | expired/revoked capability denied | revoke object/key if required |
| TM-38 | webhook spoofing | Internet -> webhook | provider signature verification before mutation | signature failures | unsigned/invalid webhook denied | rotate integration secret if compromised |
| TM-39 | webhook replay | Internet -> webhook | timestamp/nonce/idempotency | duplicate event metric | valid event replay does not duplicate mutation | deduplicate |
| TM-40 | webhook tenant confusion | webhook -> tenant | server integration binding; payload tenant id not authority | binding mismatch | foreign tenant reference denied | investigate integration |
| TM-41 | SSRF | integration -> network | destination policy/allowlist; revalidate redirects | outbound-denial events | disallowed internal/non-approved destinations denied | disable route/rotate exposed creds |
| TM-42 | OAuth token theft/overbroad scope | OAuth -> integration | server-only token store; narrow scope/audience; rotation | token-use anomalies | token cannot access unapproved resource/action | revoke/rotate |
| TM-43 | XSS reflected/stored/DOM | browser renderer | safe sinks; encoding/sanitization; CSP/Trusted Types defense-in-depth | CSP/client security reports | real-browser untrusted-content suite | quarantine content; patch sink |
| TM-44 | CSRF | browser -> API | session-appropriate anti-CSRF + SameSite/origin controls | failed CSRF event | cross-site state change denied | invalidate suspicious session |
| TM-45 | CORS misconfiguration | browser -> API | specific origins; authorization still server-side | configuration scan | untrusted origin cannot read protected API | tighten policy |
| TM-46 | CSP bypass/overreliance | browser | CSP as additional layer, not sole XSS control | CSP reports | unsafe script/content paths remain blocked by primary controls | fix sink/policy |
| TM-47 | arbitrary Experience code injection | Experience -> renderer | closed registered schema/catalog | validation reasons | executable/unregistered definitions rejected | reject version |
| TM-48 | unsafe iframe / external URL | Experience -> browser | default prohibit; explicit origin/sandbox policy if later allowed | policy violations | unapproved embed/navigation denied | disable surface |
| TM-49 | prototype pollution | JSON -> application | closed keys + dangerous-key rejection + normalization | validation event | malicious nested object keys rejected | reject document/schema |
| TM-50 | oversized/deep JSON resource exhaustion | JSON -> application | byte/depth/cardinality/type limits | limit metrics | oversized/deep payload rejected | throttle/reject |
| TM-51 | tenant enumeration/timing | API | non-enumerating errors; rate limits; normalize sensitive paths where practical | probe telemetry | foreign/unknown ids do not disclose useful distinction | throttle/investigate |
| TM-52 | secrets in logs | application -> telemetry | structured allowlist/redaction | secret scanning | sensitive canaries absent from logs | purge/rotate |
| TM-53 | secrets/proprietary data in bundle/source maps | server -> browser | server-only env and artifact scan | bundle scan | production artifacts contain no server secrets | remove artifact/rotate |
| TM-54 | mixed-tenant backup exposure | backup boundary | separate access, encryption, audit | backup access audit | unauthorized runtime identity cannot access backup | revoke/incident |
| TM-55 | tenant export leakage | export boundary | ownership-derived inventory + manifest + post-verification | export audit | A export excludes all B fixtures | discard/block |
| TM-56 | tenant restore leakage | restore boundary | isolated import + ownership validation | restore validation | foreign ownership package rejected | reject package |
| TM-57 | telemetry leakage | application -> observability | minimized schemas; no raw protected payloads by default | telemetry schema review | sensitive markers absent | purge/fix pipeline |
| TM-58 | AI cross-tenant memory | AI session | tenant-scoped memory/session | memory provenance | A cannot retrieve B prior conversation | purge/fix scope |
| TM-59 | RAG/vector filter bypass | search/RAG | mandatory server tenant namespace/filter | retrieval audit | foreign docs never returned when filter absent/manipulated | disable query path |
| TM-60 | prompt injection | untrusted content -> AI | treat content as data; downstream complete mediation | tool/policy anomaly | injected content cannot enlarge authority | deny tool/quarantine source |
| TM-61 | AI tool authorization bypass | AI -> tool | least-function tools + downstream authorization | denied tool calls | model request for foreign/high privilege action denied | review tool contract |
| TM-62 | supply-chain compromise | dependency boundary | locked/minimal dependencies; provenance/security review | advisory/SBOM signal | security-critical dependency review gate | pin/remove/rotate |
| TM-63 | support/admin impersonation | operator -> tenant | separate actor identity, capability, target, reason, TTL, audit | high-risk operator alerts | support denied unapproved tenant/action | revoke operator session |
| TM-64 | custom-domain host confusion | edge -> tenant resolution | verified DomainBinding + membership recheck | unknown/mismatch host event | spoofed/unverified host cannot grant tenant access | disable binding |
| TM-65 | data placement routing tamper | domain -> persistence | server-only placement resolution | route mismatch event | client/model placement hints ignored | deny/fix routing |
| TM-66 | placement split-brain | migration boundary | quiesce/generation/cutover/verification/rollback | generation mismatch | writes during migration follow explicit state machine | rollback |
| TM-67 | offboarding residual access | tenant lifecycle | suspend first; revoke sessions/jobs/integrations; retention workflow | completion report | old token/job/url denied after offboarding | revoke/purge |
| TM-68 | global/tenant classification error | schema/resource classification | mandatory classification gate | inventory drift | ambiguous new persistence fails review | reclassify/migrate |
| TM-69 | tenant switch retains stale local/server state | session/cache/search | tenant-scoped state + switch invalidation | cross-switch anomaly | A->B switch cannot display/use A data | clear/invalidate |
| TM-70 | service-to-service internal trust | service boundary | service identity + tenant authority + complete mediation | internal auth denials | internal call without valid tenant authority denied | fix service contract |
| TM-71 | authorization policy update not propagated | policy -> runtime | policy version/security epoch | version mismatch telemetry | role change invalidates old cached/job/session decision as designed | invalidate version |
| TM-72 | expensive tenant query / JSONB abuse | query layer -> DB | bounded DSL; statement/cost limits; index promotion policy | slow-query per tenant | adversarial filter/sort remains bounded | reject/throttle/promote index |
| TM-73 | one tenant exhausts DB connections | app -> DB pool | global + tenant concurrency budgets | pool saturation by tenant | single tenant burst cannot consume all capacity | throttle |
| TM-74 | RLS test inventory drift | schema -> verification | schema-derived tenant-table discovery | CI inventory diff | new table automatically enters isolation test inventory | fail release |
| TM-75 | public asset accidentally contains tenant data | build/storage -> Internet | explicit PUBLIC classification + artifact scan | public asset audit | tenant fixture cannot reach public path | remove/incident |
| TM-76 | debug/error leak | application -> browser/log | production-safe error envelope | error schema monitoring | forced errors do not expose foreign object/payload/secret | disable debug/rotate if needed |

## Required proof posture

Isolation claims require real infrastructure where provider semantics matter:
- real PostgreSQL with at least tenant A and B;
- real selected connection pool mode;
- real browser/API negative tests;
- real selected cache/storage/queue provider tests when introduced.

Mocks may support units but cannot be sole tenant-isolation evidence.

Independent Security Critic must attack the same candidate after the last correction. Two fresh consecutive critic PASSes are required by the proposed GAUNTLET before candidate freeze.
