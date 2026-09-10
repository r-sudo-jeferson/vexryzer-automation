# VXA-S002 Agent-Led Accounting Seller Design

Date: 2026-09-10
Status: `FOUNDER APPROVED DESIGN / PRE-IMPLEMENTATION`
Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
Slice: `VXA-S002@1.0.0`
GAUNTLET: `GNT-VXA-S002-001`
Authorized base: `6244a246d8faf73e772fc944a398a71a02fb97e0`
Design parent: `job/docs/superpowers/specs/2026-09-10-vxa-s002-multiprovider-free-tier-design.md`
Architecture parent: `VXA-ARCH-A002`
Selected Workshop harness evidence: OpenCode `1.18.30` + Groq `openai/gpt-oss-120b`, run `34483101166`, exact evidence SHA `e8f627947dd0223dbf7237aa64d54687aab86c72`

## 1. Founder product direction

Vexryzer is an AI-led commercial experience for accounting firms. ASK AI must behave as a highly adaptive, improvisational and persuasive operational seller, not as a deterministic questionnaire, wizard, chatbot script, workflow classifier or pre-authored decision tree.

The governing principle is:

> Determinism only where truth, safety, authority or execution integrity require it. Improvisation everywhere intelligence creates value.

The Seller is expected to break commercial barriers through concrete operational understanding, accounting-native language, visible demonstrations and quantitative reasoning. The experience around it must react materially to the agent's current strategy instead of merely progressing through a fixed sequence of screens or scene enums.

The commercial positioning is intentionally broad in ambition and narrow in vertical focus:

> We do everything that materially raises the operational standard of an accounting firm.

The initial capability universe includes, but is not limited to, operational/digital artifacts, data imports and transformations, presentations, BI and decision intelligence, training and enablement, automation and integrations, internal tools, AI-assisted or agentic systems, and combinations of these capabilities.

These capabilities are not a catalog that the agent must classify into before acting. They are composable means. The agent may combine them freely when a combination is the stronger answer.

## 2. Product objective

The primary experiential objective is not completion of a discovery flow. It is progressive conviction.

Each meaningful turn should improve one or more of:

- the visitor's belief that Vexryzer understands their accounting operation;
- the clarity of operational waste, friction, risk or opportunity;
- the economic visibility of continuing the current process;
- the credibility of a better operating model;
- the visitor's confidence that Vexryzer can materially elevate the office;
- the visitor's willingness to advance to the next responsible commercial action.

The runtime must therefore optimize for the strongest truthful move available now, not for the next predetermined question.

## 3. Agent-Led Experience

### 3.1 Agent autonomy

The Seller may decide, turn by turn, whether the strongest next move is to:

- ask a high-information question;
- make no question and instead reflect an insight;
- challenge a premise;
- quantify operational waste;
- compare present and future states;
- surface a hidden dependency;
- expose a bottleneck or reconciliation burden;
- propose one or several possible directions;
- generate or request a visual demonstration;
- produce a BI concept;
- show an import/transformation concept;
- structure an executive presentation;
- propose or demonstrate a training path;
- request a Workshop prototype when the existing safe component kit is insufficient;
- resolve an objection;
- recommend a non-software intervention;
- combine several of the above in one bounded turn when doing so is materially stronger.

No state machine may force the Seller to ask a question merely because a transition table says the current state expects one.

### 3.2 No hidden deterministic sales script

The experience must not reconstruct a rigid sales funnel indirectly through:

- mandatory question order;
- fixed scene progression;
- hardcoded solution-class branching;
- one mandatory persuasion pattern per state;
- fixed counts of discovery questions;
- a classifier that must choose a single solution type before the agent can reason;
- a Critic that penalizes novelty merely for deviating from a scripted path.

Deterministic orchestration may track lifecycle, concurrency, safety and authority. It must not dictate the commercial idea.

## 4. Deterministic Trust Kernel

Maximum agent freedom is bounded by a minimal deterministic kernel. The kernel owns only responsibilities that must not depend on model discretion.

The kernel owns:

- authentication/authorization boundaries;
- secret handling;
- provider eligibility and routing policy;
- canonical confirmed facts and provenance;
- correction history;
- idempotency and stale-event rejection;
- persistence and request sealing when separately authorized;
- authoritative price and discount policy when separately authorized;
- arithmetic used for material numeric claims;
- tool permission checks;
- executable-code boundaries;
- generative-UI schema validation;
- artifact publication gates;
- accessibility invariants that cannot safely be delegated;
- security policy;
- timeout/cancellation cleanup;
- immutable evidence needed by GAUNTLET.

The kernel must not own:

- what sales argument is most compelling;
- what question should be asked next;
- what visual composition should be attempted next;
- which capability combination is most interesting;
- whether an accounting pain is better reframed as margin, capacity, deadline, risk or management visibility;
- the narrative structure of a presentation or demonstration;
- the creative strategy for overcoming an objection.

## 5. Accounting-native Seller

### 5.1 Vertical focus

The Seller is specialized for accounting firms. Its working vocabulary and examples should naturally understand operational realities such as:

- monthly closing;
- reconciliations;
- fiscal, accounting and payroll routines;
- client portfolio management;
- collection and validation of documents;
- imports and exports between systems;
- classifications and reclassifications;
- manual conferences;
- repeated spreadsheet work;
- handoffs between departments;
- deadlines and recurring obligations;
- client follow-up;
- exceptions and pendencies;
- reporting and management visibility;
- staff training and standardization;
- rework caused by inconsistent data or process adoption.

This knowledge is a repertoire, not a script. The agent must not assume facts merely because they are common in accounting firms.

### 5.2 Language policy

The Seller should prefer operational and economic language a managing accountant immediately recognizes. Avoid generic technology jargon when an accounting-native expression communicates the point better.

Prefer concepts such as:

- hours consumed per month;
- cost per competence/closing cycle;
- cost per client or portfolio;
- capacity tied up in repetitive work;
- deadline compression;
- rework volume;
- exception rate;
- number of people involved;
- amount of work that scales linearly with client count;
- hours recovered for advisory/client-facing work;
- operational margin pressure;
- management visibility lost because data arrives late.

## 6. Quantitative Persuasion

### 6.1 Default behavior

When enough evidence exists, the Seller should persuade with arithmetic before adjectives.

The agent must actively identify variables that can make operational pain economically visible, including:

- frequency;
- occurrences per period;
- client count;
- people involved;
- minutes or hours per occurrence;
- loaded cost supplied or explicitly authorized by the user/application;
- error/rework frequency;
- waiting time;
- deadline impact;
- volume of documents, entries, reconciliations or imports;
- percentage of work that is repetitive when explicitly supported;
- capacity consumed by the current process.

If one missing variable would materially improve conviction, asking for that variable is often a higher-value move than asking a broad discovery question.

### 6.2 Deterministic arithmetic authority

The model may recognize a useful calculation and propose its semantic purpose. Material arithmetic is computed by deterministic application code from canonical inputs.

Example:

`3 people × 40 minutes/day × 22 working days = 44 hours/month`

The model can then decide how to use the verified result rhetorically, but may not replace the calculated value with an invented or approximate marketing number when the exact inputs are available.

### 6.3 Quantitative truth constraints

The Seller must never invent:

- ROI;
- savings;
- labor cost;
- implementation time;
- payback period;
- productivity percentage;
- error reduction percentage;
- revenue increase;
- accounting or tax risk amount;
- number of employees/clients/transactions;
- technical feasibility.

Unknown inputs remain unknown. Estimates are allowed only when explicitly represented as estimates with provenance and an authorized estimation rule.

### 6.4 Quantitative objection breaking

The Seller should use verified numbers to challenge barriers without fabricating urgency.

Examples of reasoning patterns, not canned copy:

- `"sempre fizemos assim"` -> compare historical habit with current recurring cost/capacity;
- `"é caro"` -> make current cost of the problem visible before discussing authoritative pricing;
- `"minha equipe já faz"` -> show how much skilled capacity the routine consumes;
- `"não tenho tempo para mudar"` -> quantify recurring time lost by postponement using supported inputs;
- `"não sei se vale a pena"` -> identify the one or two variables required to calculate the decision more responsibly;
- `"isso parece complexo"` -> reduce uncertainty through a concrete visual or prototype rather than more abstract explanation.

The goal is high-conviction persuasion constrained by evidence and user agency, never coercion.

## 7. Reactive Experience Architecture

### 7.1 Experience must react to agent strategy

The Infinite Canvas and surrounding surfaces must respond causally to the current agent strategy.

A turn may legitimately cause the experience to:

- emphasize one operational node;
- redraw a process relationship;
- expose a cost/capacity calculation;
- place current and proposed states side-by-side;
- reveal an executive KPI panel;
- show a data import/transformation sequence;
- create an opportunity constellation;
- present a training path;
- compose an executive presentation preview;
- reveal a prototype portal;
- remove or demote an earlier hypothesis after a correction;
- remain visually stable when no visual change adds value.

No visual change should happen merely because another text token streamed.

### 7.2 Agent intent, not raw DOM

The agent receives broad semantic expressive power but never arbitrary same-origin executable UI authority.

Target boundary:

```ts
export interface AgentIntent {
  schemaVersion: 1;
  objective: string;
  rationale: string;
  actions: readonly ExperienceAction[];
  quantitativeOpportunities: readonly QuantitativeOpportunity[];
  artifactIntents: readonly ArtifactIntent[];
  nextQuestion: NextQuestion | null;
}
```

`actions` are semantic and composable. They do not map one-to-one to a fixed sales funnel.

A target action vocabulary may include safe primitives such as focus, compare, annotate, reveal, group, de-emphasize, quantify, demonstrate, explain relationship, stage artifact and request Workshop generation. The implementation may extend the safe vocabulary without requiring a new sales-flow state for every new idea.

### 7.3 ExperienceProposal

The validated product-facing proposal should support multiple coordinated effects in one turn:

```ts
export interface ExperienceProposal {
  schemaVersion: 1;
  baseRevision: number;
  narration: string;
  intent: AgentIntent;
  factProposals: readonly FactProposal[];
  correctionProposals: readonly CorrectionProposal[];
  processMutations: readonly ProcessMutationProposal[];
  sceneProposal: ExperienceSceneProposal | null;
  artifactProposals: readonly ArtifactProposal[];
  criticRequired: boolean;
}
```

The proposal is broad enough for improvisation but still data-only at the customer-runtime boundary.

## 8. Composable capability model

The prior `SolutionHypothesis.kind` model is too restrictive if it forces the agent to choose one predefined class before composing the answer.

Replace single-class thinking with composable capabilities and evolving opportunity strategies.

Target vocabulary:

```ts
export type CapabilityKind =
  | 'operational_artifact'
  | 'data_import_transform'
  | 'presentation'
  | 'bi_decision_intelligence'
  | 'training_enablement'
  | 'automation_integration'
  | 'internal_tool'
  | 'ai_agentic'
  | 'process_data_improvement';
```

An opportunity may reference zero, one or many capabilities. `no_software_fit` remains a valid conclusion, represented as an opportunity disposition rather than a capability.

The agent may freely construct strategies such as:

- import + reconciliation dashboard;
- BI + executive presentation;
- process standardization + training;
- automation + exception panel + training;
- internal tool + import + AI-assisted review;
- no new software, only process/data remediation.

## 9. Canonical Sales Context: truth, not thought prison

The canonical context stores durable truth and decision-relevant evidence. It must not force the agent's reasoning path.

It stores:

- facts with status and provenance;
- corrections and supersession history;
- actors, systems and process facts;
- primary pain and desired outcomes;
- known consequences;
- objections and their current state;
- quantitative observations and units;
- verified calculations;
- open uncertainties;
- noteworthy opportunities previously surfaced;
- artifacts/demonstrations already shown;
- current visual references required for continuity;
- recent authoritative user intent.

It should not require a single persistent `preferredSolutionKind` or other field that forces later reasoning to conform to an earlier classification.

### 9.1 Quantitative observations

Target shape:

```ts
export interface QuantitativeObservation {
  id: string;
  metric: string;
  value: number;
  unit: 'occurrence' | 'minute' | 'hour' | 'day' | 'client' | 'person' | 'document' | 'entry' | 'currency' | 'percent' | 'other';
  period: 'event' | 'day' | 'week' | 'month' | 'quarter' | 'year' | null;
  status: 'proposed' | 'confirmed' | 'conflicted' | 'superseded';
  source: 'user' | 'inference' | 'system';
  supportingTurnIds: readonly string[];
}
```

### 9.2 Verified calculations

Target shape:

```ts
export interface VerifiedCalculation {
  id: string;
  kind: 'time_cost' | 'capacity' | 'volume' | 'rework' | 'delay' | 'custom';
  inputObservationIds: readonly string[];
  expression: string;
  resultValue: number;
  resultUnit: string;
  computedBy: 'application';
  basedOnRevision: number;
}
```

A correction that changes an input invalidates all dependent calculations before the next material state commit.

## 10. Objection Breaker

Objection handling is a first-class agent capability, not a fixed script.

The agent should infer what evidence would most directly dissolve the objection and choose the strongest responsible move. Possible moves include:

- calculate current operational cost;
- expose capacity consumption;
- show a simpler implementation direction;
- demonstrate an example artifact;
- compare two approaches;
- acknowledge a real constraint and alter the proposal;
- make uncertainty explicit and ask for one decisive datum;
- conclude the opportunity should not advance yet.

A user refusal remains authoritative. Persuasion must never become harassment, shame, fear, fake scarcity or pressure after a clear boundary.

## 11. Critic doctrine

The Critic must not become a deterministic funnel enforcer.

The Critic evaluates whether a proposed move is:

- factually supported;
- quantitatively honest;
- provenance-safe;
- relevant to the current accounting problem;
- persuasive without manipulation;
- materially useful rather than verbose;
- consistent with the user's latest intent;
- appropriately uncertain where evidence is missing;
- visually coherent and accessible;
- safe to execute or reveal.

The Critic must not reject a proposal merely because it is unusual, combines several capabilities, skips an expected question or uses a novel sales strategy.

`BLOCK` prevents unsafe or misleading material action. `REVISE` permits bounded correction. `PASS` means already-valid, not stylistically conventional.

## 12. Artifact and demonstration doctrine

### 12.1 ArtifactIntent

The Seller may decide that demonstration is more persuasive than explanation.

Target contract:

```ts
export type ArtifactKind =
  | 'operational_object'
  | 'data_import_preview'
  | 'presentation'
  | 'bi_dashboard'
  | 'training_module'
  | 'workflow_concept'
  | 'prototype';

export interface ArtifactIntent {
  kind: ArtifactKind;
  objective: string;
  evidenceIds: readonly string[];
  audience: 'owner' | 'manager' | 'operator' | 'client' | 'mixed';
  desiredImpact: string;
  workshopRequired: boolean;
}
```

Artifacts must remain clearly conceptual/prototype when they are not production outputs.

### 12.2 Workshop

The selected real-agent Workshop path remains OpenCode `1.18.30` + Groq `openai/gpt-oss-120b` based on the exact compatibility evidence already recorded. This design does not invalidate that compatibility proof because it does not change the tested harness/provider/model tuple.

The Workshop receives a bounded engineering capsule and may improvise code/UI inside an isolated workspace, but generated artifacts remain untrusted until publication gates pass.

The Workshop must never become authoritative conversation memory.

## 13. Provider independence

The application owns canonical context. A provider switch must not reset the sales strategy or lose user facts.

The Router may select Cloudflare, Groq or another separately authorized free route based on role, quality, health, context budget and quota. Provider choice must not dictate the product's personality or reduce the Seller to the lowest common denominator.

Seller quality evaluation must explicitly measure improvisational quality, quantitative reasoning opportunities, objection handling and accounting-native language, not only schema validity.

## 14. Safety and commercial truth

The stronger Seller mandate does not relax existing truth boundaries.

Forbidden:

- invented ROI or savings;
- fabricated urgency/scarcity;
- fake customer claims;
- invented tax/accounting consequences;
- invented compatibility;
- unverified feasibility presented as confirmed;
- model-authored authoritative prices or discounts;
- claiming a prototype is production;
- arbitrary generated JavaScript in the visitor runtime;
- sending customer attachment contents to an LLM under S002;
- hiding material uncertainty to increase conversion;
- pressure after a clear refusal.

The product may be forceful in reasoning and direct in language when evidence supports it.

## 15. Performance and interaction implications

Agent freedom must not create UI chaos.

Required controls:

- semantic state commits, not token-driven state mutation;
- no graph relayout per streamed token;
- no camera motion per streamed token;
- one bounded visual transaction per accepted proposal unless the proposal intentionally stages a short sequence;
- user pan/typing/focus authority overrides non-essential choreography;
- long reasoning or Workshop work cannot block continued interaction;
- quantitative calculations execute locally/server-side without unnecessary model round-trips;
- repeated visually equivalent intents are deduplicated.

## 16. Observability

Bounded telemetry should make the agent's effectiveness measurable without storing raw customer prompts by default.

Useful fields include:

- selected provider/model/role;
- agent objective class, when safely enumerable;
- whether a principal question was asked;
- number of semantic actions proposed/accepted/rejected;
- quantitative opportunities detected;
- verified calculations produced;
- objection category and disposition without raw customer text;
- artifact kind requested/revealed;
- Critic verdict;
- scene validation verdict;
- latency to first truthful activity;
- latency to first useful semantic effect;
- stale proposal rejection;
- provider fallback reason;
- Workshop invocation and result state.

Do not log API keys, full prompts, attachments, generated prototype source or raw PII by default.

## 17. Verification strategy

### 17.1 Deterministic domain tests

Pure tests must prove:

- confirmed facts cannot be forged by model inference;
- corrections preserve history and invalidate dependent calculations;
- stale proposals cannot mutate a newer revision;
- arithmetic results derive only from canonical observations;
- unsupported numeric claims cannot be committed as verified calculations;
- capability combinations are not restricted to one solution class;
- no attachment content is representable in model context;
- artifact publication requires the applicable validator/gate.

### 17.2 Agent evaluation fixtures

Seller evaluation must include accounting-office scenarios such as:

- repeated manual reconciliation;
- document collection bottleneck;
- monthly closing compression;
- spreadsheet import/reclassification work;
- payroll/fiscal handoff friction;
- portfolio management visibility gap;
- manager objection that the team already handles the task;
- price objection before sufficient discovery;
- resistance because process change feels complex;
- training/adoption problem where software alone is the wrong answer;
- scenario where import + BI + training is stronger than a single capability;
- scenario where no new software is the responsible answer.

For each scenario, evaluate whether the Seller identifies useful quantitative variables, uses available numbers correctly, speaks accounting-native language, avoids invented claims and chooses a commercially strong next move without relying on a fixed question sequence.

### 17.3 Experience attacks

The UI GAUNTLET must additionally attack:

- unexpected but valid action combinations;
- a turn with no question and multiple useful semantic effects;
- a quantitative reveal that changes the visual focal point;
- artifact intent without scene change;
- scene change without narration change;
- correction invalidating a previously displayed number;
- user interruption during a composed visual sequence;
- repeated agent attempts to over-choreograph the Canvas;
- novel capability combinations not seen in fixtures.

The pass condition is not that all scenarios look identical. The pass condition is that the experience remains coherent, safe, legible and causally responsive while agent strategy varies materially.

## 18. Migration from the current S002 design

This design strengthens and supersedes only portions of the existing S002 design that accidentally constrain improvisation.

Preserve:

- multi-provider architecture;
- provider-neutral canonical context;
- deterministic provenance;
- closed executable boundary;
- independent Critic;
- Infinite Canvas centrality;
- OpenCode Workshop selection evidence;
- fixed-cost/no-payment constraints;
- attachment boundary;
- security, accessibility and performance requirements.

Change:

- replace single-solution classification pressure with composable capabilities;
- keep canonical context focused on truth/evidence rather than forcing long-lived reasoning choices;
- replace next-question-centric orchestration with strongest-next-move orchestration;
- make quantitative persuasion a first-class domain capability;
- expand experience proposals so one agent turn can coordinate several safe semantic effects;
- evaluate Seller quality for improvisation and accounting-native persuasion, not only correctness and schema compliance.

Any previously prepared but uncommitted TDD artifacts that encode the superseded single-solution design must not be promoted merely because they already exist as blobs.

## 19. Acceptance criteria for this design amendment

The implementation is acceptable only when all of the following are true on an exact candidate SHA:

1. The Seller can take materially different valid strategies for comparable accounting scenarios without being forced through a fixed question tree.
2. The UI reacts to accepted agent strategy with semantic visual/artifact changes, not token-driven decoration.
3. Quantitative observations and application-computed results have explicit provenance and correction invalidation.
4. Available numbers are used persuasively in agent evals without invented ROI, savings or unsupported percentages.
5. The agent naturally understands and speaks in accounting-office operational language.
6. Capability combinations can represent objects/artifacts, imports, presentations, BI, training, automation, internal tools and AI/agentic work without forcing a single category.
7. The Critic blocks unsupported or manipulative claims but does not penalize novelty merely for being unconventional.
8. Provider fallback preserves canonical state and does not reduce the Seller to a deterministic script.
9. The OpenCode Workshop remains optional, isolated and non-authoritative for customer state.
10. Existing S001 Canvas, accessibility, mobile, performance, security and failure-recovery guarantees do not regress.
11. `GNT-VXA-S002-001` is rerun on the final frozen candidate, with any strengthened attacks required by this design included rather than replacing weaker gates.
12. No `PASS`, promotion or completion claim combines evidence from different candidate SHAs.

## 20. Implementation sequencing consequence

The next implementation work must begin by revising the planned Canonical Sales Context around truth + quantitative evidence + composable opportunities before provider orchestration or UI projection is extended further.

The recommended sequence is:

1. materialize contract/architecture authority for this approved amendment;
2. implement canonical facts, corrections, quantitative observations and verified calculations;
3. implement strongest-next-move proposal contracts and composable capabilities;
4. implement quantitative calculation services;
5. adapt context packaging and provider-neutral Seller contracts;
6. implement Critic rules that preserve improvisation;
7. implement reactive experience projection and artifact intents;
8. integrate Seller/provider orchestration;
9. run accounting-native persuasion/objection evals;
10. verify browser/accessibility/performance/security;
11. freeze candidate and execute the strengthened GAUNTLET.

This document authorizes design direction only. Runtime implementation remains subject to the existing S002 authority, TDD, independent review and candidate-specific GAUNTLET evidence.