# VXA-S002 Multi-Provider Free Tier Seller Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Mistral-primary S002 intelligence assumption with a provider-neutral, zero-payment multi-provider Seller architecture that preserves context, persuasion quality, strict generative UI, controlled code/UI Workshop capability and deterministic recovery.

**Architecture:** Canonical sales context and routing live in Vexryzer application/domain code; providers are capability adapters selected by a tested registry, quota governor and circuit breaker. Cloudflare Workers AI is primary, Groq is the independent external fallback, OpenRouter remains optional emergency-only, and Mistral is standby. Provider memory is never authoritative, customer attachments never enter the model path, and the experience remains usable when every LLM route is unavailable.

**Tech Stack:** Node 24, pnpm 11.25.0, TypeScript 5.9 strict, React 19.2, XState 5.32, React Flow 12.11, Vite 8.2, Netlify Functions under `job`, DeepSeek Harness `0.1.2-rc.1` / pi-ai `0.84.2` only after exact compatibility proof, Node test runner, Vitest, Playwright, axe.

**Spec:** `job/docs/superpowers/specs/2026-09-10-vxa-s002-multiprovider-free-tier-design.md`

## Global Constraints

- Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`.
- Slice: `VXA-S002@1.0.0`.
- GAUNTLET: `GNT-VXA-S002-001`.
- Authorized base: `6244a246d8faf73e772fc944a398a71a02fb97e0`.
- Architecture amendment: `VXA-ARCH-A002`.
- Product root is `job`; no product architecture or source may be created outside `job`.
- Never access or depend on either forbidden Machina repository.
- Fixed infrastructure cost remains `R$ 0`.
- An active AI route must work without registered payment method, paid subscription, prepaid credits or overage.
- Cloudflare Workers AI is the primary provider family; Groq is independent fallback; OpenRouter is optional emergency-only; Mistral is standby.
- Customer attachments are never model inputs in S002.
- Provider secrets remain server-side and never enter Vite client variables, repository source, logs or artifacts.
- ASK AI may persuade through truthful understanding but may not own price, durable state, feasibility truth, submission, authorization or upload success.
- Normal UI adaptation uses validated `ExperienceScene` data and the closed component registry; model-authored React/JS/CSS never executes directly in the visitor runtime.
- DeepSeek Harness is Workshop-only and cannot become a blocking dependency for ordinary discovery.
- Preserve S001 Canvas, accessibility, responsive, performance and interaction guarantees.
- CI policy is `OPTIMIZED_GATES_ONLY`; use an isolated staging branch for construction so intermediate commits do not trigger the Mistral-specific workflow on the Slice branch.
- Never combine PASS evidence from different SHAs.

---

### Task 0: Reverify authority, isolate construction and classify the existing Mistral evidence

**Files:**
- Read: `AGENTS.md`
- Read: `job/docs/slices/VXA-S002-contract.md`
- Read: `job/docs/authorizations/VXA-S002-PROVIDER-STRATEGY-AUTHORIZATION.md`
- Read: `job/docs/architecture/VXA-001-architecture-amendment-002.md`
- Read: `job/docs/gauntlets/GNT-VXA-S002-001.md`
- Read: `job/docs/handoffs/VXA-S002-TASK1-EXECUTION-NOTE.md`

**Interfaces:**
- Consumes: exact Slice authority and SHA evidence.
- Produces: one isolated construction branch rooted at the current authorized execution head and a recorded provider-gate matrix with all new routes `NOT_VERIFIED`.

- [ ] **Step 1: Verify the execution branch and authority.**

Run:

```bash
git rev-parse HEAD
git show --no-patch --format=%H 6244a246d8faf73e772fc944a398a71a02fb97e0
```

Expected: current branch head is a descendant of the authorized base; authority documents identify `VXA-S002@1.0.0` and `GNT-VXA-S002-001`.

- [ ] **Step 2: Create an isolated construction branch from the current Slice head.**

```bash
git switch -c staging/vxa-s002-multiprovider-free-tier
```

Expected: no remote CI is triggered merely by local branch creation.

- [ ] **Step 3: Record Run #20 as historical evidence, not an active blocker.**

The handoff must retain that `34466683049` at `835ba25446051ce597b27eae29ac18ea2538c16a` proved persistence and canonical tool-result presence while semantic nonce recall failed. Do not re-run the unchanged tuple.

- [ ] **Step 4: Confirm credential names only, never values.**

Required GitHub Environment `s002-spike` names for the first gate:

```text
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
GROQ_API_KEY
```

`OPENROUTER_API_KEY` is optional and must not block Tasks 1–7.

---

### Task 1: Generalize provider compatibility evidence without triggering speculative CI

**Files:**
- Create: `job/tools/workshop-spike/provider-candidates.ts`
- Create: `job/tools/workshop-spike/provider-evidence.ts`
- Create: `job/tools/workshop-spike/run-provider-screen.mjs`
- Create: `job/tests/pure/workshop-provider-candidates.node.test.ts`
- Create: `job/tests/pure/workshop-provider-evidence.node.test.ts`
- Modify: `job/tools/workshop-spike/spike-config.ts`
- Modify: `job/tools/workshop-spike/harness-evidence.ts`
- Do not modify yet: `.github/workflows/s002-harness-mistral-spike.yml`

**Interfaces:**
- Consumes: provider metadata and environment-variable names only.
- Produces: `ProviderScreenResult` and a provider-neutral `WorkshopProviderCompatibility` summary.

```ts
export type ProviderId = 'cloudflare-workers-ai' | 'groq' | 'openrouter' | 'mistral';

export interface ProviderCandidate {
  provider: ProviderId;
  modelId: string;
  roles: readonly ('seller' | 'critic' | 'composer' | 'workshop_code')[];
  credentialRefs: readonly string[];
  noPaymentRequired: true;
  optional: boolean;
}

export interface ProviderScreenResult {
  provider: ProviderId;
  modelId: string;
  authenticated: boolean;
  streaming: boolean;
  toolCall: boolean;
  toolReplay: boolean;
  errorClass: 'NONE' | 'AUTH' | 'RATE_LIMIT' | 'CAPACITY' | 'TIMEOUT' | 'PROTOCOL' | 'UNKNOWN';
}
```

- [ ] **Step 1: Write candidate-registry tests first.**

Tests must require exact model ids, forbid `-latest`, reject routes marked payment-required, keep OpenRouter optional and keep Mistral standby.

Run:

```bash
cd job && node --test tests/pure/workshop-provider-candidates.node.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 2: Implement the candidate definitions with no credentials or URLs containing secrets.**

Initial candidates:

```ts
export const providerCandidates = [
  { provider: 'cloudflare-workers-ai', modelId: '@cf/zai-org/glm-4.7-flash', roles: ['seller', 'composer'], credentialRefs: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'], noPaymentRequired: true, optional: false },
  { provider: 'cloudflare-workers-ai', modelId: '@cf/google/gemma-4-26b-a4b-it', roles: ['critic'], credentialRefs: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'], noPaymentRequired: true, optional: false },
  { provider: 'cloudflare-workers-ai', modelId: '@cf/openai/gpt-oss-120b', roles: ['workshop_code'], credentialRefs: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'], noPaymentRequired: true, optional: false },
  { provider: 'cloudflare-workers-ai', modelId: '@cf/nvidia/nemotron-3-120b-a12b', roles: ['seller', 'critic'], credentialRefs: ['CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'], noPaymentRequired: true, optional: false },
  { provider: 'groq', modelId: 'openai/gpt-oss-120b', roles: ['seller', 'critic', 'workshop_code'], credentialRefs: ['GROQ_API_KEY'], noPaymentRequired: true, optional: false },
] as const satisfies readonly ProviderCandidate[];
```

- [ ] **Step 3: Write redaction/error-classification tests.**

Prove that provider payload text, authorization headers, account ids and API keys never enter result JSON; only bounded status/error classes are emitted.

- [ ] **Step 4: Implement direct provider screening with serialized requests.**

For each candidate, perform the minimum role-relevant sequence: tiny streamed completion, one structured forced tool call, one tool-result replay. Respect live `Retry-After`/rate headers and do not blind-retry `401/403`.

- [ ] **Step 5: Run all Workshop pure tests locally.**

```bash
cd job && pnpm test:pure
```

Expected: all existing and new pure tests PASS without real provider calls.

- [ ] **Step 6: Commit the provider-neutral local contracts on the staging branch.**

```bash
git add job/tools/workshop-spike job/tests/pure
git commit -m "test(s002): generalize free-tier provider compatibility contracts"
```

---

### Task 2: Build the Canonical Sales Context domain with provenance-preserving corrections

**Files:**
- Create: `job/src/ai/context/canonical-sales-context.ts`
- Create: `job/src/ai/context/context-reducer.ts`
- Create: `job/src/ai/context/session-digest.ts`
- Test: `job/tests/pure/canonical-sales-context.node.test.ts`
- Test: `job/tests/pure/context-reducer.node.test.ts`
- Test: `job/tests/pure/session-digest.node.test.ts`
- Modify later through adapter only: `job/src/app/experience-state.ts`

**Interfaces:**
- Consumes: validated user statements, validated model proposals and existing process graph/provenance identifiers.
- Produces: `CanonicalSalesContext`, `SalesFact`, `SalesObjection`, `SolutionHypothesis`, `SessionDigest`.

- [ ] **Step 1: Write failing domain tests.**

Required cases:

```ts
test('user confirmation upgrades a proposed fact without losing provenance', () => {});
test('correction supersedes the prior fact and invalidates dependent hypothesis', () => {});
test('model inference can never create confirmed source=user evidence', () => {});
test('digest preserves proposed confirmed and conflicted distinctions', () => {});
test('attachment content is not representable in canonical model context', () => {});
```

- [ ] **Step 2: Run tests and confirm RED.**

```bash
cd job && node --test tests/pure/canonical-sales-context.node.test.ts tests/pure/context-reducer.node.test.ts tests/pure/session-digest.node.test.ts
```

- [ ] **Step 3: Implement immutable reducers and bounded validators.**

Use discriminated unions; do not use opaque `Record<string, unknown>` state for facts/objections/hypotheses. Every mutation increments `revision` and retains evidence ids.

- [ ] **Step 4: Add stale-revision protection.**

A model proposal generated for revision `N` cannot mutate revision `N+1` after a user correction. Return a typed stale-proposal result instead.

- [ ] **Step 5: Run pure tests.**

```bash
cd job && pnpm test:pure
```

- [ ] **Step 6: Commit the canonical-context domain.**

```bash
git add job/src/ai/context job/tests/pure
git commit -m "feat(s002): add canonical provider-neutral sales context"
```

---

### Task 3: Implement deterministic Context Packager and emergency continuation capsule

**Files:**
- Create: `job/src/ai/context/context-packager.ts`
- Create: `job/src/ai/context/token-budget.ts`
- Create: `job/src/ai/context/emergency-capsule.ts`
- Test: `job/tests/pure/context-packager.node.test.ts`
- Test: `job/tests/pure/emergency-capsule.node.test.ts`

**Interfaces:**
- Consumes: `CanonicalSalesContext`, recent turns, `SessionDigest`, provider route budget.
- Produces: `ContextPack` with included/omitted turn ids and bounded token estimate.

- [ ] **Step 1: Write compaction-priority tests.**

Tests must prove current user input and confirmed facts survive before old conversational prose; no fact appears both as raw-history duplication and digest duplication; secrets/attachments cannot enter a pack.

- [ ] **Step 2: Write fallback capsule test.**

Construct a long session and assert that the emergency capsule contains current pain, confirmed facts, current objection, current solution hypothesis, last relevant exchanges and current question while remaining below an injected small token budget.

- [ ] **Step 3: Implement a deterministic estimator abstraction.**

Do not add a provider tokenizer dependency yet. Define:

```ts
export interface TokenEstimator {
  estimate(text: string): number;
}
```

Use a conservative implementation that can later be replaced per provider without changing packing semantics.

- [ ] **Step 4: Implement one-pass pack, then bounded recompaction.**

Expose a pure `packContext(request)` and `repackAfterOverflow(request)`; the overflow path must record `compacted: true` and cannot recurse indefinitely.

- [ ] **Step 5: Run pure tests and commit.**

```bash
cd job && pnpm test:pure
git add job/src/ai/context job/tests/pure
git commit -m "feat(s002): package bounded seller context for provider fallback"
```

---

### Task 4: Add Provider Capability Registry, Router, quota policy and circuit breaker

**Files:**
- Create: `job/src/ai/providers/provider-types.ts`
- Create: `job/src/ai/providers/provider-registry.ts`
- Create: `job/src/ai/providers/router.ts`
- Create: `job/src/ai/providers/quota-governor.ts`
- Create: `job/src/ai/providers/circuit-breaker.ts`
- Test: `job/tests/pure/provider-registry.node.test.ts`
- Test: `job/tests/pure/provider-router.node.test.ts`
- Test: `job/tests/pure/quota-governor.node.test.ts`
- Test: `job/tests/pure/circuit-breaker.node.test.ts`

**Interfaces:**
- Consumes: requested AI role, tested capability matrix, context budget, provider health/rate evidence.
- Produces: one eligible route or typed `DETERMINISTIC_RECOVERY` result.

- [ ] **Step 1: Write fail-closed registry tests.**

Reject a route if `noPaymentEligible !== true`, compatibility is not `PASS`, required credential references are absent, or required role/capability is missing.

- [ ] **Step 2: Write routing-order tests.**

Prove Cloudflare primary selection, alternate-Cloudflare selection for model-specific failure, Groq selection for provider-family failure, optional OpenRouter exclusion when disabled, and deterministic recovery when no route is eligible.

- [ ] **Step 3: Write failure-policy tests.**

```ts
401/403 -> no blind retry
429 -> retry only when Retry-After fits budget, otherwise fallback
5xx/capacity -> bounded retry then provider-family fallback
timeout -> abort + alternate route
context overflow -> one repack only
```

- [ ] **Step 4: Implement registry/router with dependency-injected clock/health state.**

Keep provider-specific HTTP logic out of the router. The router chooses route ids; adapters perform network calls.

- [ ] **Step 5: Implement conservative quota policy.**

Seller traffic outranks Critic; Critic outranks Workshop. Never treat process-local quota estimates as global durable truth. Provider headers and explicit compatibility evidence remain higher confidence.

- [ ] **Step 6: Run tests and commit.**

```bash
cd job && pnpm test:pure
git add job/src/ai/providers job/tests/pure
git commit -m "feat(s002): route free-tier AI with fail-closed quota policy"
```

---

### Task 5: Define the provider-neutral Seller contract and persuasion quality evaluator

**Files:**
- Create: `job/src/ai/seller/seller-contract.ts`
- Create: `job/src/ai/seller/seller-validation.ts`
- Create: `job/src/ai/seller/seller-system-contract.ts`
- Create: `job/src/ai/seller/seller-eval-rubric.ts`
- Create: `job/tests/pure/seller-contract.node.test.ts`
- Create: `job/tests/pure/seller-validation.node.test.ts`
- Create: `job/tests/pure/seller-eval-rubric.node.test.ts`
- Create: `job/tests/fixtures/seller-evals/*.json`

**Interfaces:**
- Consumes: `ContextPack` and current validated Canvas/process state.
- Produces: validated `SellerTurnProposal` with narration, persuasion moves, proposed facts, process mutations, solution hypotheses, next question, scene proposal and `criticRequired`.

- [ ] **Step 1: Write hostile/invalid proposal tests.**

Reject fabricated authoritative prices, model-confirmed user facts, unbounded narration, unknown persuasion moves, arbitrary scene component kinds, attachments, unsupported feasibility assertions and stale canonical revisions.

- [ ] **Step 2: Create evaluation fixtures for all required sales scenarios.**

Fixtures must cover vague pain, detailed process, skeptical user, direct price question, reconciliation pain, AI-agent request, training/no-software fit, correction, contradiction, trust objection, free-consulting request, provider switch and all-provider failure/recovery.

- [ ] **Step 3: Implement deterministic rubric scoring.**

Score dimensions separately: understanding, information gain, concision, credible persuasion, objection handling, truthfulness, provenance, solution-fit breadth, scene quality and provider-switch continuity.

- [ ] **Step 4: Define primary-Seller eligibility.**

A provider/model must pass protocol gates and the Seller eval threshold. Tool compatibility alone cannot activate it as primary/fallback Seller.

- [ ] **Step 5: Run pure tests and commit.**

```bash
cd job && pnpm test:pure
git add job/src/ai/seller job/tests/pure job/tests/fixtures/seller-evals
git commit -m "feat(s002): define truthful persuasive seller contract"
```

---

### Task 6: Create the server-only AI boundary and Cloudflare/Groq adapters

**Files:**
- Create: `job/netlify/functions/ask-ai.ts`
- Create: `job/netlify/functions/_shared/ai/runtime.ts`
- Create: `job/netlify/functions/_shared/ai/cloudflare-adapter.ts`
- Create: `job/netlify/functions/_shared/ai/groq-adapter.ts`
- Create: `job/netlify/functions/_shared/ai/provider-http.ts`
- Create: `job/netlify/functions/_shared/ai/redaction.ts`
- Create: `job/tsconfig.functions.json`
- Modify: `job/tsconfig.json`
- Modify: `job/package.json`
- Modify: `job/netlify.toml`
- Test: `job/tests/pure/provider-http.node.test.ts`
- Test: `job/tests/pure/provider-redaction.node.test.ts`
- Test: `job/tests/unit/ask-ai-runtime.test.ts`

**Interfaces:**
- Consumes server environment references and validated `SellerRequest` only.
- Produces a streaming response protocol containing narration deltas and validated final proposal metadata.

- [ ] **Step 1: Add function TypeScript project before provider code.**

`tsconfig.functions.json` must use Node 24-compatible strict options and include only `netlify/functions/**/*.ts` plus explicitly shared server-safe domain files. Add it to root TS project references so `pnpm typecheck` covers Functions.

- [ ] **Step 2: Write secret-boundary tests.**

Prove adapters throw `MissingCredential` when required env references are absent and that no credential value can appear in serialized public errors.

- [ ] **Step 3: Implement raw `fetch`-based provider adapters first.**

Do not add Cloudflare/Groq SDK dependencies unless direct HTTP proves insufficient. This minimizes bundle size, dependency risk and provider lock-in. Keep exact endpoint construction in server-only code and never export secret-bearing request objects to the client.

- [ ] **Step 4: Implement a normalized provider event stream.**

```ts
export type AiStreamEvent =
  | { type: 'text_delta'; requestId: string; delta: string }
  | { type: 'tool_call'; requestId: string; callId: string; name: string; argumentsJson: string }
  | { type: 'final'; requestId: string; proposal: SellerTurnProposal }
  | { type: 'recovering'; requestId: string; reason: PublicRecoveryReason }
  | { type: 'error'; requestId: string; code: PublicAiErrorCode };
```

- [ ] **Step 5: Implement abort/idempotency.**

Every request carries a request id plus canonical revision. Abort an old upstream request when superseded; never commit a late result for a stale revision.

- [ ] **Step 6: Update CSP only for same-origin Function calls.**

Browser remains `connect-src 'self'`; do not expose provider origins to client CSP because provider calls are server-side.

- [ ] **Step 7: Run local verification.**

```bash
cd job && pnpm typecheck && pnpm test:pure && pnpm test:unit && pnpm build && pnpm verify:bundle
```

- [ ] **Step 8: Commit.**

```bash
git add job/netlify job/tsconfig.functions.json job/tsconfig.json job/package.json job/netlify.toml job/tests
git commit -m "feat(s002): add server-only multiprovider AI boundary"
```

---

### Task 7: Integrate canonical context, Seller stream and deterministic fallback into XState/Canvas

**Files:**
- Create: `job/src/ai/client/ask-ai-client.ts`
- Create: `job/src/ai/client/ai-stream-protocol.ts`
- Create: `job/src/experience/deterministic-recovery.ts`
- Modify: `job/src/app/experience-state.ts`
- Modify: `job/src/app/app-machine.ts`
- Modify: `job/src/app/App.tsx`
- Modify: existing/new S002 scene projector/registry files from the primary plan
- Test: `job/tests/unit/experience-machine.test.ts`
- Test: `job/tests/component/ask-ai-seller.test.tsx`
- Test: `job/tests/e2e/ask-ai-fallback.spec.ts`

**Interfaces:**
- Consumes: normalized same-origin stream and validated Seller proposal.
- Produces: XState transitions, canonical-context revisions, validated process/scene updates and truthful recovery UI.

- [ ] **Step 1: Write state tests before UI implementation.**

Cover request → streaming → validation → Critic/revision → awaiting user; provider fallback without duplicate assistant turn; user correction while a request is in flight; all-provider deterministic recovery; successful AI recovery after outage.

- [ ] **Step 2: Integrate canonical state into XState rather than React local state.**

React components render/select state but do not become the source of provider conversation memory.

- [ ] **Step 3: Batch semantic UI updates.**

Do not recompute the full Canvas on every text token. Stream narration independently and apply graph/scene proposals only after structural validation.

- [ ] **Step 4: Implement deterministic recovery controls.**

Recovery must show confirmed understanding, allow correction/confirmation and preserve progress. Do not pretend canned recovery content is a model response.

- [ ] **Step 5: Verify accessibility and mobile.**

Streaming uses bounded live-region announcements; focus remains predictable; fallback controls are keyboard accessible; reduced-motion behavior preserves information.

- [ ] **Step 6: Run unit/component/e2e slices and commit.**

```bash
cd job && pnpm test:unit && pnpm test:component && pnpm test:e2e

git add job/src job/tests
git commit -m "feat(s002): integrate resilient persuasive ASK AI runtime"
```

---

### Task 8: Prove credentialed Cloudflare/Groq routes and Workshop Harness compatibility

**Files:**
- Create: `.github/workflows/s002-harness-provider-spike.yml` as provider-test glue only
- Modify: `job/tools/workshop-spike/run-provider-screen.mjs`
- Create or modify: `job/tools/workshop-spike/run-harness-provider.mjs`
- Update: `job/docs/handoffs/VXA-S002-TASK1-EXECUTION-NOTE.md`

**Interfaces:**
- Consumes: protected GitHub Environment `s002-spike` secrets.
- Produces: exact-SHA bounded artifacts for direct provider screens and Harness/Workshop tuples.

- [ ] **Step 1: Verify the workflow has no automatic speculative trigger on the staging branch.**

Use `workflow_dispatch` for credentialed gates. If a push trigger is retained for the Slice branch, path-filter it to the provider workflow/spike files and trigger only after the candidate is stabilized.

- [ ] **Step 2: Run Cloudflare direct screening in this order.**

```text
@cf/zai-org/glm-4.7-flash
@cf/google/gemma-4-26b-a4b-it
@cf/openai/gpt-oss-120b
@cf/nvidia/nemotron-3-120b-a12b
```

Record exact access, streaming, structured tool call, replay, error mapping and bounded usage/rate evidence. A `403` on a model is an access result, not a reason to enable billing.

- [ ] **Step 3: Run Groq `openai/gpt-oss-120b` direct screen.**

Use the compact emergency capsule and account-specific rate headers. Do not size production behavior from documentation alone.

- [ ] **Step 4: Run Seller quality evals only for protocol-capable Seller candidates.**

Primary/fallback Seller eligibility requires both protocol and persuasion quality PASS.

- [ ] **Step 5: Run Harness compatibility only for Workshop candidates.**

Required six properties remain:

```text
streaming/events
tool calls
structured arguments
multi-turn tool-result replay
timeout/error mapping
restart/session behavior
```

- [ ] **Step 6: Preserve exact artifact hashes and candidate SHA.**

Do not expose raw prompts, responses or credentials. Store only bounded evidence needed for the compatibility decision.

- [ ] **Step 7: Update the execution handoff with exact results.**

Classify each route `PASS`, `FAIL`, `BLOCKED` or `NOT_VERIFIED`; do not collapse provider access failure and semantic quality failure into the same diagnosis.

---

### Task 9: Integrate controlled Workshop code/UI specialization without making it a discovery dependency

**Files:**
- Use/modify the Workshop files defined by the original S002 plan under `job` only
- Create: `job/src/workshop/code-capsule.ts`
- Create: `job/src/workshop/workshop-provider-policy.ts`
- Test: `job/tests/pure/code-capsule.node.test.ts`
- Test: `job/tests/pure/workshop-provider-policy.node.test.ts`

**Interfaces:**
- Consumes: validated prototype objective and approved component/design contracts.
- Produces: bounded untrusted prototype candidate passed into existing Workshop verification/publication gates.

- [ ] **Step 1: Write code-capsule confinement tests.**

Reject secrets, customer attachments, repository-wide dumps, unknown package authority and paths outside the isolated workspace.

- [ ] **Step 2: Route code generation only to verified `workshop_code` candidates.**

Prefer verified Cloudflare GPT-OSS 120B; use another candidate only if it independently passed the Workshop role gate.

- [ ] **Step 3: Keep Workshop quota subordinate to Seller availability.**

If quota/capacity is insufficient, emit `workshop_fallback` and use approved generative UI; never drain the remaining Seller reserve for a prototype.

- [ ] **Step 4: Verify generated artifact publication gates.**

Typecheck, static analysis, tests, browser render, accessibility, visual review and Critic must pass before reveal.

- [ ] **Step 5: Run Workshop pure/unit tests and commit.**

```bash
cd job && pnpm test:pure && pnpm test:unit
git add job/src/workshop job/tests
git commit -m "feat(s002): specialize bounded workshop code generation"
```

---

### Task 10: Independent critique, full verification, GAUNTLET and candidate freeze

**Files:**
- Update only evidence/handoff documents required by the existing S002 GAUNTLET.
- No requirement or expected result may be edited to accommodate implementation behavior.

**Interfaces:**
- Consumes: one exact stabilized candidate SHA.
- Produces: review verdict, verification evidence and only then possible GAUNTLET PASS/candidate freeze.

- [ ] **Step 1: Run independent Critic review.**

Review provider routing, no-payment enforcement, context correctness, fallback continuity, persuasion safety/quality, prompt injection, secrets, stale responses, races, accessibility, mobile, rendering, performance and Workshop confinement.

- [ ] **Step 2: Run local/full verification available in the execution environment.**

```bash
cd job && pnpm verify:foundation && pnpm typecheck && pnpm test && pnpm build && pnpm verify:bundle && pnpm test:e2e && pnpm test:visual
```

Unavailable checks remain `NOT_VERIFIED`; never weaken them.

- [ ] **Step 3: Freeze the exact candidate SHA before final remote gates.**

```bash
git rev-parse HEAD
```

Record it as `github_candidate_sha`. Any subsequent candidate change invalidates candidate-specific PASS evidence.

- [ ] **Step 4: Run the optimized final hosted provider/integration gates once on the exact candidate.**

No blind retries. A changed external condition or diagnostic need is required before re-running an unchanged failure.

- [ ] **Step 5: Execute `GNT-VXA-S002-001` exactly.**

Do not rewrite the GAUNTLET to match the new provider architecture. Where an older provider-specific wording conflicts with the later Founder authorization, document the authority resolution and preserve equivalent-or-stronger behavioral evidence.

- [ ] **Step 6: Report status precisely.**

`PASS` only after every material S002 criterion is evidenced for the exact candidate. `COMPLETE` remains unavailable until all completion requirements applicable to this repository/Slice are actually satisfied.

---

## Self-review coverage

This plan covers the authorized provider switch, context ownership, compaction, fallback continuity, no-payment enforcement, persuasive Seller behavior, Critic independence, strict generative UI, code/UI Workshop specialization, attachment exclusion, server-side secret boundary, quota/rate handling, outage recovery, stale-response protection, observability, accessibility, testing and exact-candidate evidence.

No task authorizes S003 pricing, durable file delivery, durable request sealing, production payment, unrestricted live code execution, arbitrary model-generated runtime JS/CSS, customer attachment ingestion by AI or a paid provider fallback.
