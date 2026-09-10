# VXA-001 Architecture Amendment 001 — Adaptive Agent + Workshop

amendment_id: `VXA-ARCH-A001`
binding_id: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
parent_architecture: `job/docs/architecture/VXA-001-architecture.md`
status: `PROPOSED / NOT_AUTHORIZED`
planning_base_sha: `6244a246d8faf73e772fc944a398a71a02fb97e0`
planning_branch: `plan/vxa-s002-ask-ai-adaptive-experience`

> This amendment is planning material. It does not alter the active architecture until explicitly authorized.

## Architecture decision

Adopt a dual-plane architecture for future ASK AI work:

1. `Experience Runtime`: low-latency customer-facing orchestration using React, XState, React Flow, Netlify Functions and Mistral through a provider-neutral server seam.
2. `Agent Workshop`: an isolated DeepSeek Harness development environment used only when a custom prototype materially improves understanding or persuasion.

The Experience Runtime remains complete without the Workshop. Workshop unavailability, timeout or hosting constraints must degrade to approved generative UI rather than interrupt discovery.

## Experience Runtime responsibilities

The Experience Runtime owns:

- browser interaction and accessibility;
- XState lifecycle and deterministic state transitions;
- normalized process/fact state;
- provenance and correction invalidation;
- Mistral request lifecycle;
- bounded specialist routing;
- scene-schema validation;
- Infinite Canvas projection;
- semantic camera resolution;
- Critic policy application;
- Workshop invocation policy;
- timeout/retry/fallback behavior;
- privacy-safe telemetry.

The browser never receives provider credentials or provider-native privileged objects.

## Model integration seam

Mistral remains the planned intelligence provider unless a later authorized contract changes the stack.

Use a provider-neutral interface such as:

```ts
export interface AgentModelClient {
  runTurn(input: AgentTurnInput, signal: AbortSignal): AsyncIterable<AgentModelEvent>;
}
```

The Mistral adapter translates provider events into bounded application events. Model-native messages never directly mutate application state.

## Mistral agent strategy

Mistral Agents/Conversations, function calling and custom structured output are eligible implementation mechanisms, not sources of product authority.

Evaluation order after authorization:

1. prove direct Mistral structured output and tool-calling behavior needed by the Experience Runtime;
2. evaluate Mistral Agents/Conversations only where they improve tool routing, specialist separation or lifecycle without weakening application-owned state;
3. keep normalized facts, process state and commercial authority in application state regardless of provider conversation facilities.

Provider-side persistence is not required for correctness. Prefer no unnecessary provider storage unless the privacy contract explicitly accepts it.

## Agent roles

Logical roles:

- `ExperienceOrchestrator` — chooses the next discovery action;
- `ProcessArchitect` — extracts process facts, actors, systems, handoffs and uncertainty;
- `SolutionStrategist` — compares automation, micro-SaaS, BI, agentic, training, process/data and no-fit options;
- `ExperienceComposer` — proposes typed visual scenes;
- `VxaCritic` — independently attacks material proposals;
- `WorkshopAgent` — develops controlled prototype artifacts through DeepSeek Harness.

Roles may share one provider/model deployment for cost/latency, but proposal generation and Critic approval must remain separate logical calls/identities where the contract requires independence.

## Bounded orchestration

Agent loops are explicitly bounded by:

- maximum internal steps per visitor turn;
- maximum Critic revision cycles;
- maximum parallel tool calls;
- maximum scene mutations per accepted turn;
- request timeout and cancellation policy;
- Workshop invocation count per session;
- context/token budget policy.

Exceeding a bound produces a recoverable application state, never silent recursion.

## Generative UI contract

Customer runtime accepts only typed, validated scene intents from a closed schema.

The model cannot provide:

- arbitrary React component imports;
- arbitrary HTML/JS/CSS execution;
- arbitrary x/y/zoom camera coordinates;
- external executable URLs;
- unbounded text or element counts;
- direct design-token overrides;
- unknown animation primitives.

The application maps semantic scene/camera intents to approved components and tokens.

## Infinite Canvas projection

React Flow remains the spatial substrate. Preserve S001 user interruption authority and semantic zoom behavior while expanding camera semantics.

The Canvas projector should support at least these region classes:

- ASK AI nucleus;
- process clusters;
- friction/uncertainty regions;
- solution opportunity constellations;
- comparison regions;
- prototype reveal regions;
- history/detail-on-demand regions.

Stable process and scene element identities are required so streaming text does not remount or relayout the whole Canvas.

## Attention budget

The Canvas must not become an uncontrolled visualization dump.

Each scene transition should enforce an attention budget:

- one primary focus target;
- a bounded number of newly introduced elements;
- background context visually de-emphasized rather than removed when continuity matters;
- no camera movement for every token or minor fact;
- user-interrupted camera authority remains respected until a new material intent;
- semantic zoom hides detail before it hides meaning.

Exact numerical bounds are established by authorized tests and usability evidence rather than model preference.

## DeepSeek Harness Workshop

DeepSeek Harness is the preferred Workshop harness subject to a real compatibility spike with the selected Mistral route/model.

The Workshop is a genuine development environment. It may receive:

- a bounded prototype brief;
- a prebuilt Vexryzer prototype kit;
- workspace-scoped filesystem editing;
- sandboxed command execution;
- local test/static-check tools;
- controlled rendering/export tools;
- a Critic/evaluation step.

It must not receive:

- the live Vexryzer repository during a customer session;
- production/customer secrets;
- unrestricted environment inheritance;
- production datasets;
- unrestricted package installation;
- arbitrary network targets;
- deployment credentials.

## DeepSeek Harness risk posture

DeepSeek Harness is developer-preview software. Therefore:

- pin the exact proven Harness/runtime versions;
- pin the Cordis composition/profile used;
- treat upgrades as compatibility changes requiring rerun of provider, tool, session, persistence and sandbox tests;
- never use the example `danger-full-access` composition for visitor work;
- do not assume `cwd` alone is a security boundary.

Harness file sandbox semantics do not by themselves prove network isolation. Live visitor Workshop requires an environment-level egress policy or equivalent strong boundary. If that cannot be proven under the free-tier lock, keep live Workshop disabled and use the fast path.

## Live Workshop dependency policy

For latency and security, live Workshop workspaces should use prebundled dependencies and a fixed prototype kit. A customer turn must not wait for arbitrary `npm install`, package discovery or remote dependency resolution.

Any dependency not already allowlisted and available in the Workshop image/kit is unavailable to the live prototype path.

The offline Design Lab may have a broader engineering profile, but it is a separate trust boundary.

## Prototype artifact boundary

A Workshop may write arbitrary scratch code inside its isolated workspace, but the customer runtime does not trust that code.

Preferred live export order:

1. validated declarative `PrototypeScene`/manifest rendered by approved runtime components;
2. sanitized static visual artifact when a declarative interactive representation is insufficient;
3. executable interactive artifact only after a separate explicitly authorized sandbox/origin design proves isolation, CSP, network denial, data isolation and cleanup.

S002 must not introduce same-origin execution of arbitrary model-generated JavaScript.

## Workshop transport and placement

Do not assume DeepSeek Harness runs inside the normal Netlify Function request lifecycle.

A persistent Harness runtime uses process/session semantics that are operationally different from an ephemeral serverless function. Production placement remains `NOT_VERIFIED` until a zero-fixed-cost environment is proven.

The integration boundary should therefore be transport-neutral:

```ts
export interface WorkshopClient {
  createPrototype(brief: PrototypeBrief, signal: AbortSignal): AsyncIterable<WorkshopEvent>;
}
```

Local/CI Harness, future remote Harness and a disabled/fallback implementation all satisfy the same application contract.

## Latency architecture

No external operation may create an empty waiting screen.

Required event families:

- local submit acknowledgement;
- server accepted;
- semantic agent activity;
- accepted fact/scene mutation;
- Critic validation;
- Workshop started/phase/artifact/failure;
- request terminal result.

Activity labels are emitted only when the corresponding work is actually occurring.

Workshop is parallel and non-blocking. If it exceeds its product budget, the Experience Runtime publishes the best approved fast-path scene and may reveal a later prototype only if it remains contextually useful.

## Context management

Do not resend an ever-growing raw conversation indefinitely.

Maintain:

- normalized current facts;
- explicit unresolved uncertainty;
- provenance/correction history needed for reasoning;
- bounded recent conversational context;
- a validated condensed summary when context exceeds the configured threshold.

Condensation never replaces deterministic facts or authority-bearing state.

## Critic architecture

Run deterministic hard gates before model critique.

Hard gates reject executable scene content, invalid provenance mutations, unknown tools, secret access, unsupported guaranteed claims and unauthorized Workshop capabilities without paying model latency.

The model Critic is invoked for material semantic/visual/commercial proposals where judgment adds value. It uses a separate prompt/schema/identity and returns bounded `PASS | REVISE | BLOCK` findings.

A turn has a bounded revision loop. `BLOCK` selects a deterministic recovery path.

## Concurrency and race policy

Every request, scene proposal and Workshop job has a stable id.

Late events from superseded requests must not overwrite newer state. Cancellation, user corrections, navigation and retries require explicit stale-event rejection.

Workshop completion after the visitor has moved to a different intent is either revalidated against current state or discarded.

## Privacy-safe observability

Telemetry uses stable event codes, durations, counts and non-sensitive classifications by default.

Do not log raw provider credentials, environment snapshots, full prompts, full customer messages or generated source code merely for observability.

## Deployment and free-tier gate

Netlify Free remains the selected customer web deployment platform.

No amendment authorizes paid infrastructure, paid autonomous build agents, uncontrolled overage or an architecture that requires a paid long-lived Workshop runtime to keep the core product functional.

## Adoption gate

This architecture amendment becomes active only after explicit Founder authorization tied to an authorized Slice and GAUNTLET.