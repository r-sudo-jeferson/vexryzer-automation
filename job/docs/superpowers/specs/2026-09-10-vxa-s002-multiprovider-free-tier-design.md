# VXA-S002 Multi-Provider Free Tier Seller Intelligence Design

Date: 2026-09-10
Status: `AUTHORIZED DESIGN AMENDMENT`
Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
Slice: `VXA-S002@1.0.0`
GAUNTLET: `GNT-VXA-S002-001`
Authorized base: `6244a246d8faf73e772fc944a398a71a02fb97e0`
Authorization checkpoint: `835ba25446051ce597b27eae29ac18ea2538c16a`
Architecture amendment: `VXA-ARCH-A002`
Supersedes: provider-specific portions of `job/docs/superpowers/specs/2026-09-10-ask-ai-adaptive-experience-design.md`

## 1. Design intent

ASK AI is the magical seller of Vexryzer Automation: persuasive because it demonstrates operational understanding, not because it uses pressure or unsupported claims. The model does not receive customer attachments. It conducts discovery, mirrors pain, reveals root causes, structures the process, handles objections, frames credible solution directions and adapts the Infinite Canvas through validated scene intents.

The design must survive provider failure without losing the visitor's story. The product owns canonical context, state, provenance, validation, scene safety and commercial authority. Providers supply bounded reasoning/language capabilities.

The active architecture must remain usable at fixed infrastructure cost `R$ 0` and without registering a payment method for any active AI route.

## 2. Experience principles

The Seller should create a sequence of perceived value:

1. `UNDERSTOOD`: the visitor sees their problem mirrored more clearly than they expressed it;
2. `STRUCTURED`: their operation becomes visible as actors, systems, handoffs, repetition, friction and uncertainty;
3. `INSIGHTFUL`: ASK AI exposes a defensible pattern or root cause rather than merely restating symptoms;
4. `POSSIBLE`: the Canvas shows credible solution directions without presenting hypotheses as guaranteed feasibility;
5. `DESIRABLE`: the visitor can imagine the operational future state and why it matters;
6. `SAFE_TO_ADVANCE`: uncertainty and objections are handled truthfully, and the next action feels responsible;
7. `READY_TO_REQUEST`: the visitor chooses to submit the opportunity and later attachments for human delivery.

The Seller should normally ask one principal question at a time. Controls, chips, visual comparisons or mini-forms may replace free text when they reduce cognitive load.

## 3. Non-goals and attachment boundary

This design does not add document understanding, OCR, retrieval-augmented generation, embeddings, attachment summarization or multimodal customer-file analysis.

Customer files are for the human fulfillment/request path. No active LLM provider receives file bytes, extracted text, screenshots, embeddings or summaries derived from those attachments.

S002 still does not authorize the later durable upload/request-sealing implementation. The architecture simply prevents future upload work from accidentally becoming an LLM ingestion path.

## 4. Provider portfolio

All provider/model rows begin `NOT_VERIFIED`. They become active only after credentialed evidence proves access with no registered payment method and the role-specific gates pass.

| Priority | Provider/model | Intended role | Failure domain |
| --- | --- | --- | --- |
| P0 | Cloudflare `@cf/zai-org/glm-4.7-flash` | primary Seller + Orchestrator + Process Architect + fast Composer | Cloudflare/model quota/capacity |
| P1 | Cloudflare `@cf/google/gemma-4-26b-a4b-it` | VxaCritic / second opinion | Cloudflare/model quota/capacity |
| P1 | Cloudflare `@cf/openai/gpt-oss-120b` | Workshop code/UI + hard reasoning | Cloudflare/model quota/capacity |
| P1 | Cloudflare `@cf/nvidia/nemotron-3-120b-a12b` | alternative quality fallback | Cloudflare/model quota/capacity |
| P2 | Groq `openai/gpt-oss-120b` | independent external continuity fallback | Groq quota/capacity |
| P3 | exact OpenRouter `:free` model | optional emergency only | OpenRouter/upstream free route |
| standby | Mistral | disabled active route | Mistral entitlement/capacity |
| final | deterministic Vexryzer | guided discovery/recovery | no LLM dependency |

The Router may choose a different eligible Cloudflare specialist for a specific role, but it must not silently turn a Critic-only route into the main Seller or a Seller route into a Workshop code executor without role evidence.

## 5. Canonical Sales Context

### 5.1 Ownership

Canonical context belongs to the application state machine and domain layer. Provider conversation ids, Harness sessions, prompt caches and provider histories are not authoritative.

### 5.2 Domain shape

The implementation should converge on a bounded shape equivalent to:

```ts
export type FactStatus = 'proposed' | 'confirmed' | 'conflicted' | 'superseded';
export type FactSource = 'user' | 'inference' | 'system';

export interface SalesFact {
  id: string;
  subject: string;
  predicate: string;
  value: string | number | boolean;
  status: FactStatus;
  source: FactSource;
  confidence: number | null;
  supportingTurnIds: readonly string[];
}

export interface SalesObjection {
  id: string;
  kind: 'price' | 'trust' | 'feasibility' | 'timing' | 'change' | 'security' | 'other';
  summary: string;
  status: 'open' | 'addressed' | 'resolved';
}

export interface SolutionHypothesis {
  id: string;
  kind: 'automation' | 'micro_saas' | 'bi' | 'agentic' | 'training' | 'process_data' | 'hybrid' | 'no_software_fit';
  rationale: string;
  confidence: number;
  missingEvidence: readonly string[];
  status: 'candidate' | 'preferred' | 'rejected';
}

export interface CanonicalSalesContext {
  schemaVersion: 1;
  sessionId: string;
  revision: number;
  turnIds: readonly string[];
  facts: readonly SalesFact[];
  primaryPain: string | null;
  desiredOutcome: string | null;
  knownConsequences: readonly string[];
  objections: readonly SalesObjection[];
  solutionHypotheses: readonly SolutionHypothesis[];
  currentQuestion: string | null;
  currentInsight: string | null;
  currentSceneId: string | null;
  discoveryState: 'origin' | 'discovering' | 'framing' | 'qualifying' | 'handoff_ready';
}
```

Exact names may follow existing domain conventions, but the semantics are mandatory: facts retain provenance/status and provider output never directly becomes confirmed truth.

### 5.3 Corrections

When a user corrects an earlier fact:

- preserve the earlier fact as superseded/history rather than mutating evidence invisibly;
- invalidate dependent inferences when necessary;
- rebuild solution hypotheses affected by the correction;
- update the Canvas causally;
- include the correction in the next Specialist Capsule.

## 6. Context layers and token discipline

### L0 — Authoritative State

Always eligible: normalized facts, provenance, corrections, process state, current objection, current solution direction and deterministic application state.

### L1 — Working Set

Recent exchanges and tool results required to understand the current question. The packager uses relevance and recency, not a blind last-N window.

### L2 — Session Digest

Older conversation is compressed into a schema-validated digest. The digest must preserve confirmed/proposed/conflicted distinctions. It cannot invent facts merely to shorten context.

### L3 — Specialist Capsule

Each role receives only what it needs:

- Seller: commercial state, relevant process facts, objection state, current visual context and last relevant dialogue;
- Critic: Seller proposal plus supporting facts/provenance and current product constraints;
- Composer: validated scene-relevant facts, graph ids and current camera/focus state;
- Workshop: bounded prototype objective, approved component kit/contracts, relevant files/artifacts, test/build feedback and no customer attachments.

### Budget policy

The target normal Seller request should usually remain well below the model's full context window. A useful initial engineering target is an 8k–16k request envelope for normal discovery, with larger envelopes reserved for genuinely complex turns.

Groq emergency fallback receives a deliberately compact capsule sized below the account's tested TPM ceiling. The exact ceiling is discovered at credentialed preflight and stored in configuration/evidence rather than hardcoded from marketing pages.

## 7. Context Packager behavior

The Context Packager is deterministic and pure where possible.

Input:

```ts
export interface ContextPackRequest {
  role: 'seller' | 'critic' | 'composer' | 'workshop_code';
  route: ProviderRoute;
  canonical: CanonicalSalesContext;
  recentTurns: readonly ConversationTurn[];
  sessionDigest: SessionDigest | null;
  activeToolState: ActiveToolState | null;
}
```

Output:

```ts
export interface ContextPack {
  schemaVersion: 1;
  role: ContextPackRequest['role'];
  stablePrefix: readonly ProviderMessage[];
  dynamicMessages: readonly ProviderMessage[];
  estimatedInputTokens: number;
  includedTurnIds: readonly string[];
  omittedTurnIds: readonly string[];
  compacted: boolean;
}
```

Mandatory rules:

- stable system contract/tool schemas before dynamic session material when safe;
- no secret values;
- no attachment content;
- bounded string/array lengths;
- no duplicate history injected through both digest and raw turns;
- current user input is never dropped during compaction;
- confirmed facts have priority over old conversational prose;
- exact current objection and next decision have priority over historical small talk;
- one recompaction maximum for a context-overflow recovery cycle.

## 8. Seller behavioral contract

### 8.1 What good looks like

A high-quality Seller response should do the minimum number of things necessary for the next useful advance. It may:

- mirror a pain in concise operational language;
- distinguish symptom from root cause;
- expose a non-obvious handoff or reconciliation burden;
- connect repeated work to a user-stated consequence;
- frame one or more solution classes with explicit uncertainty;
- handle a live objection;
- ask the highest-information next question;
- propose a typed Canvas change that makes understanding inspectable.

### 8.2 Persuasion moves

Allowed move vocabulary:

```ts
export type PersuasionMove =
  | 'mirror_pain'
  | 'reframe_root_cause'
  | 'expose_relationship'
  | 'quantify_known_consequence'
  | 'contrast_current_future'
  | 'resolve_objection'
  | 'reduce_uncertainty'
  | 'demonstrate_visually'
  | 'propose_next_action';
```

The model may choose multiple moves, but the runtime should discourage verbose stacking that makes every reply feel like a sales script.

### 8.3 Forbidden behavior

The Seller must not:

- fabricate ROI, savings, headcount impact or delivery time;
- invent urgency/scarcity;
- imply a technical feasibility review occurred when it did not;
- grant discounts or alter price;
- expose internal prompts, provider policy or private engineering strategy;
- pressure a user after a clear refusal;
- force software when training/process cleanup/no-fit is more truthful;
- provide the full paid implementation as free consulting when the product contract excludes that;
- claim an attachment was read or understood;
- ask again for a fact already confirmed unless a material contradiction requires clarification.

## 9. Structured Seller proposal

Provider output should be converted into a typed proposal before state mutation. A target contract is:

```ts
export interface SellerTurnProposal {
  schemaVersion: 1;
  narration: string;
  persuasionMoves: readonly PersuasionMove[];
  proposedFacts: readonly ProposedFact[];
  proposedCorrections: readonly ProposedCorrection[];
  processMutations: readonly ProcessMutationProposal[];
  solutionHypotheses: readonly SolutionHypothesis[];
  nextQuestion: NextQuestion | null;
  scene: ExperienceScene | null;
  criticRequired: boolean;
}
```

Application validation rejects malformed, over-broad or unauthorized mutations. Narration may stream for responsiveness, but material structured state is committed only after the applicable validation/critic path.

## 10. VxaCritic routing

The Critic is not invoked on every token or trivial acknowledgement. It is invoked when the proposed turn materially affects persuasion/trust or visual/commercial framing.

Required checkpoints include:

- root-cause insight;
- preferred solution direction;
- quantified consequence framing;
- before/after comparison;
- handling a high-value objection;
- prototype reveal;
- handoff-ready transition;
- any proposal that crosses a configured confidence/risk threshold.

The Critic evaluates:

- factual support;
- provenance preservation;
- manipulation/dark pattern risk;
- unsupported feasibility;
- objection handling quality;
- repetitive questioning;
- mismatch between pain and solution;
- scene appropriateness;
- mobile/accessibility implications;
- whether a simpler truthful move would be stronger.

`BLOCK` prevents material mutation/reveal. `REVISE` allows one bounded correction loop before deterministic recovery or alternate route.

## 11. Generative UI fast path

The Seller/Composer proposes data, not executable UI code.

The closed registry and `ExperienceScene` contract remain the primary live UI mechanism. The model may select approved scene intents such as pain mirror, process focus, friction lens, before/after, opportunity constellation, comparison and handoff.

The validator must reject:

- unknown component kinds;
- arbitrary styles/scripts;
- executable URLs;
- raw JSX/HTML injection;
- model-controlled package names;
- unbounded text/collections;
- raw pan/zoom coordinates outside the camera-intent contract;
- inaccessible control definitions.

This fast path must remain sufficient for the entire discovery journey when Workshop is unavailable.

## 12. Workshop code/UI path

The Workshop is exceptional and budgeted. Its purpose is a persuasive demonstration when the existing registry cannot communicate the solution strongly enough.

### Input capsule

Only the minimum safe engineering material is provided:

- prototype objective;
- current validated solution hypothesis;
- approved prototype SDK/component kit;
- design tokens;
- exact TypeScript/runtime versions;
- relevant interface contracts;
- bounded existing prototype files if adapting an artifact;
- test/build/browser feedback from the isolated workspace.

It receives no customer attachment content, no production secrets, no live Vexryzer repository access during a visitor session and no unrestricted package/network authority.

### Candidate model

Cloudflare GPT-OSS 120B is the first code-capable candidate. Gemma/Nemotron/GLM may be evaluated as bounded fallback only if they pass the same Workshop role gates. Groq GPT-OSS can be used for a compact development capsule when Cloudflare is unavailable and the task fits its tested free limits.

### Publication gate

Generated artifacts are untrusted until they pass the Workshop validator, typecheck, static checks, tests, browser render, accessibility and visual critique. Failing artifacts are never presented as working functionality.

## 13. Provider capability registry

Target domain:

```ts
export type AiRole = 'seller' | 'critic' | 'composer' | 'workshop_code';
export type CompatibilityVerdict = 'NOT_VERIFIED' | 'PASS' | 'FAIL' | 'BLOCKED';

export interface ProviderRoute {
  id: string;
  provider: 'cloudflare-workers-ai' | 'groq' | 'openrouter' | 'mistral';
  modelId: string;
  roles: readonly AiRole[];
  credentialRefs: readonly string[];
  noPaymentEligible: boolean;
  optional: boolean;
  compatibility: CompatibilityVerdict;
  maxContextTokens: number | null;
  testedInputBudgetTokens: number | null;
  supportsStreaming: boolean | null;
  supportsTools: boolean | null;
  supportsStructuredArguments: boolean | null;
}
```

Unknown capability values remain `null`/`NOT_VERIFIED`; they are not optimistically inferred into PASS.

## 14. Routing policy

The Router takes:

- required role;
- required capabilities;
- context pack size;
- current route health;
- current quota/rate evidence;
- latency budget;
- privacy classification;
- whether independent-provider recovery is required.

Selection hierarchy for ordinary Seller turns:

1. eligible tested primary Cloudflare Seller route;
2. eligible tested alternate Cloudflare Seller route when the failure is model-specific;
3. eligible tested Groq Seller fallback with EmergencyContinuationCapsule when Cloudflare/provider-family recovery is needed;
4. optional exact OpenRouter free route only if separately enabled and tested;
5. deterministic guided discovery.

No route may be selected if `noPaymentEligible !== true`.

## 15. Failure semantics

### Access errors (`401/403`)

Treat as configuration/entitlement, not transient load. Avoid repeated retries. Mark the route unavailable for the current circuit interval and choose another eligible free route.

### Rate limits (`429`)

Honor `Retry-After` or provider rate metadata if present. Retry only when the delay fits the UX budget and request idempotency is preserved. Otherwise route to another provider.

### Capacity/5xx

One bounded retry policy may apply. Provider-family fallback follows when service health remains degraded.

### Timeout/cancel

Abort the upstream call, do not leak a late response into newer state, and preserve the user's current context. Fallback can proceed under a new request id.

### Malformed structured/tool output

One bounded repair attempt is allowed for a compatible provider when cheaper than rerouting. Repair never authorizes invalid mutation. After the bound, choose alternate route or deterministic recovery.

### Context overflow

Rebuild one smaller pack. If it still cannot fit, use an eligible route with a larger tested budget or deterministic recovery. Never silently delete the current user input or confirmed core facts.

## 16. Quota governor

The QuotaGovernor exists to preserve discovery availability and avoid accidental exhaustion of the free pool.

It tracks bounded runtime evidence where available:

- provider/model;
- request timestamp;
- estimated and reported tokens;
- provider quota/rate headers;
- recent `429`/capacity events;
- role;
- whether the request was Workshop or customer-facing discovery.

Policy priority:

1. preserve Seller turns;
2. preserve recovery/fallback capability;
3. allow Critic calls at material checkpoints;
4. allow Workshop only when sufficient headroom exists;
5. never purchase capacity or activate billing automatically.

Because Netlify Functions are not assumed to provide durable shared in-memory quota state, S002 must not pretend a process-local counter is globally authoritative. Provider response headers and conservative request-local policy are authoritative signals until a later zero-cost shared quota store is explicitly selected and verified.

## 17. Deterministic fallback experience

If every LLM route is unavailable, the experience continues with application-owned state and a bounded guided flow.

Examples:

- present previously confirmed process facts;
- offer a small set of context-aware clarification chips generated from deterministic state rules;
- allow correction/confirmation of visible nodes;
- explain that intelligent assistance is temporarily unavailable without fabricating progress;
- preserve the user's place and resume normal Seller behavior when an eligible route becomes healthy.

The deterministic path must not impersonate AI or display canned claims as if newly reasoned.

## 18. Provider-switch continuity

Every provider request receives a `continuationId` tied to the canonical revision and user turn. The response is rejected if it targets a stale revision after the user has already corrected/advanced state.

A provider switch must not duplicate a committed assistant turn. The Router/orchestrator owns idempotency for retries/fallbacks through request ids and accepted-response state.

The user should not see provider names or fallback mechanics unless a service explanation is genuinely necessary.

## 19. Security and privacy

Mandatory controls:

- secrets server-side only;
- credentials referenced by environment variable name, never stored in registry values;
- browser never talks directly to provider APIs with secret-bearing headers;
- no prompt/system-secret echo in public diagnostics;
- no customer attachments to LLMs;
- bounded/sanitized provider errors;
- strict tool allowlists;
- no model-authored arbitrary runtime code;
- no public CI artifact containing prompt/response payloads by default;
- no provider route requiring payment registration;
- circuit/fallback logic must not circumvent security policy.

## 20. Seller quality evaluation suite

A route cannot be `seller: PASS` based only on protocol compatibility. It must pass an evaluation matrix with deterministic scoring/rubric review.

Required scenarios:

1. vague operational pain;
2. detailed process supplied upfront;
3. skeptical visitor;
4. direct price question;
5. repeated manual reconciliation;
6. user asks specifically for AI agent;
7. training/process improvement is a better fit than software;
8. user corrects an earlier fact;
9. material contradiction;
10. explicit objection about trust/feasibility;
11. user wants free implementation recipe;
12. provider fallback mid-conversation;
13. all-provider failure and later recovery.

Evaluation dimensions:

- demonstrated understanding;
- next-question information gain;
- concision;
- persuasive credibility;
- objection handling;
- truthfulness;
- no fabricated metric/ROI;
- no repetitive questioning;
- provenance consistency;
- solution-fit breadth;
- scene proposal quality;
- continuity after provider switch.

A candidate that passes tools/streaming but fails persuasive quality is not eligible as the primary Seller.

## 21. Provider compatibility gates

### Runtime provider gate

For each active Seller/Critic/Composer route verify:

- authenticated access without payment registration;
- exact model id;
- streaming behavior where used;
- structured JSON/schema/tool arguments required by its role;
- multi-turn continuation using application-supplied canonical context;
- timeout/cancel behavior;
- `401/403/429/5xx` mapping;
- no raw secret leakage;
- tested context size and rate limits.

### Harness/Workshop gate

For any route used through DeepSeek Harness verify on the exact pinned Harness/pi-ai tuple:

- streaming/events;
- canonical tool call/result correlation;
- structured arguments;
- multi-turn tool-result replay;
- timeout mapping;
- restart/session behavior.

Harness persistence success alone does not replace response-semantic verification.

## 22. Mistral evidence preserved

The final pre-amendment Mistral diagnostic, run `34466683049` at SHA `835ba25446051ce597b27eae29ac18ea2538c16a`, showed:

- `38/38` pure Workshop tests PASS;
- streaming PASS;
- tool calls PASS;
- structured arguments PASS;
- timeout mapping PASS;
- nonce present in second tool result PASS;
- marker present in session JSONL before and after restart PASS;
- second assistant response nonce recall FAIL;
- restarted assistant response nonce recall FAIL.

This evidence is retained as a model-suitability/replay result for that exact tuple. It does not block the newly authorized provider matrix and must not be re-run unchanged absent a changed external condition.

## 23. Delivery and operational status

This design authorizes implementation under `VXA-S002@1.0.0`; it does not assert compatibility or GAUNTLET PASS.

Current state after materialization remains:

- Slice: `IN_PROGRESS`;
- provider matrix: `NOT_VERIFIED` until credentials are configured and exact probes run;
- GAUNTLET: `NOT_RUN`;
- candidate freeze: `NOT_STARTED`;
- promotion: `NOT_STARTED`.

The first next external dependency is safe configuration of the Cloudflare and Groq free-tier credentials in GitHub Environment `s002-spike`, without exposing values to the repository or chat.
