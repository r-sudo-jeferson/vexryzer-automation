# Issue #3 — Infinite Value Canvas Engineering / GAUNTLET Handoff

STATUS: PLANNED
FORGE_BINDING_ID: FORGE-VEXRYZER-AUTOMATION-v1.0.0
REPOSITORY: r-sudo-jeferson/vexryzer-automation
PRODUCT_ROOT: job
BRANCH: staging/vxa-s002-agent-led-accounting-seller
RELATED_ISSUE: #3
CURRENT_SLICE: VXA-S002@1.0.0
CURRENT_GAUNTLET: GNT-VXA-S002-001
AUTHORIZED_BASE_SHA: 6244a246d8faf73e772fc944a398a71a02fb97e0a
SOURCE_DOCUMENT: job/docs/product/INFINITE-VALUE-CANVAS-ORCHESTRATOR.md
SOURCE_UPLOAD_SHA256: 8ca23fb7dd63cc1311706b5ac46f908ff470d5c1c8edb88980ef2c0496115eba
SOURCE_BIND_COMMIT: c9962ebc3a56dd5e97769c4fcd0900bfc710d05b

## Purpose

This handoff binds the complete Infinite Value Canvas Orchestrator product reference to GitHub issue #3 without reducing, rewriting or replacing that source.

The source document is product/experience intent. It is not permission to bypass the current Slice contract, AGENTS.md, Trust Kernel, DeepSeek single-provider truth, attachment boundary, security boundary, test integrity, accessibility, performance or existing validated behavior.

The next engineering phase must transform the source into repository-aware architecture and implementation, contract-to-code.

## Authority and interpretation

Read in this order before material implementation:

1. Founder instructions for Vexryzer Automation.
2. AGENTS.md on the exact active branch.
3. Authorized Slice VXA-S002@1.0.0 and GNT-VXA-S002-001.
4. Existing product/architecture truth under job/docs/.
5. GitHub issue #3.
6. The complete source document at job/docs/product/INFINITE-VALUE-CANVAS-ORCHESTRATOR.md.
7. Existing implementation and tests.

Lower authority never weakens higher authority.

The source document must be preserved in full as design/product input. Where it describes future-state capabilities not yet authorized by the current Slice, Astra must design compatible seams and record them as future contract work instead of silently implementing unauthorized roadmap scope.

## Non-negotiable semantic correction

"Objects" in the Infinite Canvas are primarily UI/UX objects and interaction surfaces, not 3D meshes or generated 3D assets.

Examples include cards, nodes, connectors, panels, proof blocks, metrics, charts, simulations, forms, timelines, process maps, CTAs, executive surfaces, protected previews and other approved generative UI components.

Depth, perspective, motion and 2.5D treatment may be used when they improve comprehension and premium quality. Real 3D technology is not mandatory and must not be introduced merely because an external concept used it.

## Role split

### GPT Astra — Lead Architect / Engineering Designer

Astra owns the architecture pass before implementation.

Astra must inspect the real repository and current remote HEAD, then produce a complete repository-aware engineering design covering:

- current architecture and non-regression surface;
- exact files/modules/packages that should change;
- existing components, stores, state machines, runtime boundaries and test harnesses to preserve;
- Infinite Canvas scene/state model;
- UI intent schema and UI Adaptation Gate;
- approved model catalog, component catalog and token resolution;
- camera/focus/choreography contract;
- agent-to-canvas semantic action protocol;
- business/context state model;
- artifact intake architecture;
- BusinessAsset structural and business representations;
- deterministic value engine and provenance;
- protected demonstration / disclosure enforcement;
- entitlement model;
- tool broker and approval policy;
- DeepSeek Harness integration boundaries;
- Trust Kernel and authoritative deterministic execution boundaries;
- tenant isolation and security;
- persistence, revision, idempotency and concurrency;
- responsive desktop/mobile behavior;
- accessibility and keyboard/touch semantics;
- performance and virtualization strategy;
- observability and telemetry;
- agent evaluation;
- browser/E2E/visual testing;
- failure and recovery states;
- after-sale evolution path without creating a second product architecture.

Astra must prefer preservation and extension of the existing stack. Any replacement of a major subsystem requires evidence that the current subsystem cannot satisfy the contract without disproportionate fragility.

Astra must explicitly classify each capability as one of:

- CURRENT_SLICE_REQUIRED
- CURRENT_SLICE_COMPATIBILITY_SEAM
- FUTURE_SLICE_REQUIRED
- PROHIBITED_BY_CURRENT_BOUNDARY

No future roadmap capability may be smuggled into the current Slice as accidental scope.

### ChatGPT / Work — Execution Lead and GAUNTLET Coordinator

ChatGPT owns execution control after Astra's architecture is reviewed against repository truth.

Responsibilities:

- verify Astra's plan against code and contracts;
- convert architecture into ordered vertical work packages;
- identify attack surfaces before code;
- define RED evidence for missing capability or risk;
- route implementation tasks to the smallest sufficient specialist/subagent;
- direct Muse Code in the Remote Desktop Commander workspace when native execution is materially limited;
- integrate and review every change;
- preserve exact candidate SHA evidence;
- keep issue #3 synchronized with material decisions/findings;
- run or coordinate independent Critic review;
- refuse PASS when evidence is incomplete or candidate SHA changed;
- keep CI optimized and use it only when it adds independent or provider-specific proof.

ChatGPT is not allowed to accept a visually attractive result that violates product truth, security, accessibility, performance, deterministic truth or current contracts.

### Muse Code — Implementation Subagent in Remote Desktop Commander

Muse Code is an execution subagent, not the final judge.

When used, it operates inside the dedicated Alpine workspace:

/workspace/vexryzer-automation

Operational expectations:

- work autonomously inside the authorized task instead of waiting for step-by-step approvals;
- obey AGENTS.md, Slice, GAUNTLET, issue #3 and Astra's accepted architecture;
- inspect before editing;
- do not create arbitrary branches or worktrees;
- do not leave product code, tests, docs, runtime config or assets outside job/;
- do not access Machina repositories or artifacts;
- never read, print, commit or expose secret values;
- never add alternate LLM providers or fallback models;
- never weaken assertions, tests, accessibility or security to make a gate pass;
- reproduce failures, isolate root cause, implement the smallest coherent correction, and re-run the relevant gates;
- produce concise machine-verifiable evidence for ChatGPT/Critic review;
- stop only on true authorization, credential, infrastructure or contract blockers that cannot be resolved inside the authorized environment.

Muse may implement aggressively; it may not redefine product scope or self-certify final PASS.

### Independent Critic

The Critic must be distinct from the implementation judgment.

The Critic attacks:

- contract misses;
- product drift;
- "generic AI UI" visual language;
- unauthorized 3D interpretation;
- chat-sidebar regression;
- arbitrary generative UI without model/token gates;
- hallucinated business value;
- leakage of protected assets;
- disclosure failures;
- tenancy and authorization gaps;
- prompt injection / external-content-as-instruction;
- DeepSeek boundary violations;
- deterministic truth violations;
- race/idempotency/revision problems;
- inaccessible camera choreography;
- mobile degradation;
- performance regressions;
- visual polish that hides missing behavior;
- unverified provider/runtime assumptions.

Any material finding returns the work to BUILD/VERIFY. Builder confidence is not evidence.

## Execution plane routing

1. CHATGPT/WORK native plane first for repository inspection, planning, connector operations, analysis and validations it can perform correctly.
2. On any material native limitation, move only that operation to Remote Desktop Commander Alpine at /workspace/vexryzer-automation.
3. GitHub connector is used for GitHub-native operations.
4. Hosted CI is reserved for clean-checkout independence, GitHub Actions semantics, protected secret/provider proof, hosted browser/runtime differences, deployment or other remote-only evidence.
5. CI is not the inner edit/test loop.
6. Every PASS must record execution plane, exact command/run and exact candidate SHA.

A limitation changes the plane, never the required quality.

## GAUNTLET loop

For every material work package:

INSPECT
→ MODEL CURRENT TRUTH
→ PLAN
→ ATTACK PLAN
→ DEFINE RED
→ IMPLEMENT
→ TARGETED VERIFY
→ VISUAL/BROWSER REVIEW WHEN APPLICABLE
→ FULL RELEVANT VERIFY
→ INDEPENDENT CRITIQUE
→ FIX ROOT CAUSE
→ REVERIFY
→ FREEZE CANDIDATE
→ REMOTE/PROVIDER PROOF IF NEEDED

If a candidate changes after a PASS, candidate-specific PASS evidence is invalid until rerun.

Use visual inspection at each UX-relevant increment to ensure the implementation is still converging toward issue #3 rather than merely satisfying static tests.

Browser proof is required where behavior is browser-visible. Playwright may be used when effective; if it is unavailable or unsuitable, use an equivalent evidence path rather than treating that tool as a blocker.

## Architecture work packages Astra must resolve

### A. Living Canvas Runtime

Define the canonical representation of:

- viewport;
- focus;
- spatial regions;
- UI/UX objects;
- relationships;
- grouping;
- reveal state;
- scene revision;
- user interaction priority;
- agent-directed choreography.

The design must support smooth pan/zoom/focus without allowing the model to execute arbitrary DOM/JS/CSS.

### B. UI Intent and Adaptation Gate

Define a typed semantic UI intent contract.

The model proposes intent. Deterministic application code validates and resolves:

- model;
- component;
- token;
- variant;
- disclosure;
- entitlement;
- data binding;
- revision;
- accessibility;
- responsive presentation;
- safety.

The renderer receives approved presentation state, not arbitrary generated production code.

### C. Model / Component / Token Catalogs

Map the source catalogs to the existing design system.

Astra must determine:

- what already exists;
- what can become variants;
- what genuinely requires a new component/model;
- how to prevent uncontrolled component proliferation;
- how usage telemetry can expose catalog gaps.

### D. Agent Presence and Camera Director

Define an agent presence that lives in the Canvas rather than a fixed chat sidebar.

Define semantic camera actions such as focus, reveal, compare, frame, de-emphasize and guided transition.

User input, accessibility and explicit navigation outrank non-essential choreography.

### E. Business Context and Commercial State Engine

Model structured state for:

TenantContext
UserContext
SessionContext
AssetContext
BusinessContext
OpportunityContext
EvidenceContext
WorkflowContext
CommercialContext
EntitlementContext
DecisionContext

Commercial states from the source must be represented without relying only on raw chat history.

### F. Artifact Intake and BusinessAsset

Design the full future intake pipeline:

INPUT
→ QUARANTINE
→ TYPE VALIDATION
→ SECURITY CHECK
→ SENSITIVITY CLASSIFICATION
→ PARSER SELECTION
→ STRUCTURE EXTRACTION
→ DATA PROFILING
→ BUSINESS INTERPRETATION
→ OPPORTUNITY DISCOVERY
→ PRESENTATION

Important current-Slice constraint:

While VXA-S002 retains its attachment boundary, no customer attachment bytes, OCR, extracted text, embeddings, screenshot-derived content or attachment summaries may be sent to DeepSeek.

Astra must design this boundary explicitly so future artifact intelligence can be added without violating the current Slice.

### G. Value Engine

Authoritative arithmetic is deterministic.

Every material value output must preserve:

- source;
- assumption;
- period;
- confidence;
- verified-versus-estimated status.

The LLM may interpret and narrate. It may not become the authoritative calculator for regulated or commercial truth.

### H. Protected Demonstration and Disclosure

Execution model and presentation model must be separated.

Never rely on client-side blur for secrecy.

Define server-side disclosure enforcement for:

PUBLIC
DEMO
PARTIAL
LOCKED
ENTITLED
INTERNAL

Only the minimum data required for the current presentation may reach the client.

### I. Tool Broker and Approval Policy

Define typed tool proposals and policy gates:

MODEL
→ TOOL PROPOSAL
→ SCHEMA VALIDATION
→ POLICY
→ ENTITLEMENT
→ RISK CHECK
→ APPROVAL IF REQUIRED
→ EXECUTION
→ AUDIT

Risk metadata must include tenant scope, read/write classification, demo allowance, approval requirement, data classification, timeout, rate limit and audit level.

### J. Security / Tenancy / Trust Kernel

Preserve:

- DeepSeek as the only active LLM truth;
- server-only DEEPSEEK_API_KEY;
- prompt-injection resistance;
- external content treated as data;
- least privilege;
- tenant isolation;
- protected server-side assets;
- canonical deterministic truth;
- authorization;
- revision;
- idempotency;
- concurrency;
- provenance;
- auditability.

### K. Experience Modes and Lifecycle Continuity

Architect how the same underlying business objects can render as:

EXECUTIVE
ARCHITECT
OPERATIONS
IMPLEMENTATION
VALUE

and evolve:

DISCOVERY CANVAS
→ COMMERCIAL CANVAS
→ IMPLEMENTATION CANVAS
→ OPERATIONS CANVAS
→ VALUE REALIZATION CANVAS

without forked products or duplicated architectures.

### L. Telemetry and Agent Evaluation

Instrument product and commercial truth without leaking sensitive data.

At minimum design for the source metrics and for:

- UI model reuse rate;
- new component request rate;
- agent retry rate;
- tool error rate;
- evidence completeness;
- human override rate;
- time to first insight;
- time to first wow;
- conversion stage transitions;
- realized versus estimated value.

Agent evaluation must include accuracy and claim support, not conversion alone.

## Required deliverables from Astra before BUILD

Astra must leave a repository-grounded architecture pack containing:

1. current-state architecture map;
2. non-regression map;
3. target architecture;
4. exact module/file change map;
5. data/state contracts;
6. semantic UI intent schema;
7. UI Adaptation Gate design;
8. security and tenancy model;
9. DeepSeek/Trust Kernel boundary;
10. performance strategy;
11. accessibility strategy;
12. telemetry/evaluation strategy;
13. test strategy and RED cases;
14. migration/compatibility strategy;
15. ordered implementation plan;
16. risk register;
17. explicit CURRENT_SLICE_REQUIRED vs FUTURE_SLICE_REQUIRED classification.

No BUILD starts merely because this handoff exists. BUILD starts only when the architecture has been checked against the active repository and current authorization.

## Acceptance / evidence expectations

Do not close issue #3 merely because documents exist.

A later implementation must prove, with exact candidate evidence:

- the Canvas is the primary experience;
- the seller no longer behaves as a conventional side chat;
- the agent can safely coordinate focus and presentation;
- adaptive UI/UX objects are materialized through approved models/components/tokens;
- pipelines/processes are represented coherently;
- value claims remain evidence-backed;
- protected assets remain server-side;
- DeepSeek remains the sole active LLM provider/harness path;
- Trust Kernel boundaries remain intact;
- desktop and mobile both work;
- keyboard/touch/accessibility remain valid;
- performance targets are measured;
- real browser visual evidence is reviewed;
- existing tests remain green;
- new behavior is covered by appropriate tests;
- independent Critic has no unresolved material finding.

Final project COMPLETE remains subject to the active Slice/GAUNTLET state. Issue #3 completion is not equivalent to Slice COMPLETE.

## Integrity note

This document is an execution binding and pre-organization layer. It does not reduce the source. The complete product reference remains the file identified above and must be read in full by Astra, ChatGPT, Muse Code and Critic before they make decisions in this workstream.
