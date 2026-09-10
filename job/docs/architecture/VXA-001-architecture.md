# VXA-001 Architecture

Version: 1.0.0
Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`

## Selected stack

Frontend:
- Vite 8.x stable line;
- React 19.2;
- TypeScript strict;
- `@xyflow/react` 12.11.x;
- Motion 13.x stable;
- XState v5 stable.

AI:
- Mistral Medium 3.5;
- Structured Outputs / Function Calling;
- model output validated before state mutation.

Platform:
- Netlify Free;
- Netlify Functions;
- Netlify Blobs;
- Netlify environment variables;
- Git-connected deploys after deployment authorization.

Email:
- free-tier transactional provider selected during S005 implementation research; Resend is the current preference but must be reverified before binding credentials.

Testing:
- Vitest;
- Testing Library;
- Playwright;
- axe;
- visual capture/regression evidence.

## Why this architecture

The product has one public experience and small server-side authority boundaries. A monolithic deployable Vite application plus Netlify Functions minimizes operational complexity while keeping secrets, pricing and persistence off the browser. No database is required because each sealed request is an independent immutable-ish document bundle rather than a relational workflow.

## Runtime topology

Browser -> Vite SPA -> Netlify Functions -> Mistral / Netlify Blobs / email provider.

No browser request receives provider secrets. No AI response directly mutates durable state.

## Application authority

### XState owns
- funnel stage;
- readiness;
- local interaction state;
- AI request lifecycle;
- upload lifecycle;
- camera focus mode;
- estimate reveal state;
- review/submission state;
- recoverable failure state.

### Backend Functions own
- request validation;
- Mistral secret and invocation;
- schema validation;
- rate enforcement hooks;
- authoritative pricing;
- file acceptance policy;
- persistence;
- request ID generation;
- idempotent sealing;
- notification attempt.

### Mistral owns only
- language understanding;
- concise conversational response;
- proposed structured facts/mutations;
- next-question recommendation;
- truthful objection handling text;
- final internal summary proposal.

## Canvas model

Node classes:
- source;
- manual_action;
- transformation;
- system;
- output;
- evidence;
- effort;
- uncertainty;
- estimate;
- request_receipt.

Every extracted fact carries provenance:
- `user_stated`;
- `ai_inferred`;
- `user_confirmed`.

AI-inferred facts must be visually distinguishable until confirmed when material.

## Camera modes

- origin;
- ask_focus;
- process_focus;
- value_focus;
- evidence_focus;
- estimate_focus;
- review_focus;
- success_focus.

Desktop allows exploration. Mobile remains camera-directed and vertically navigable. No core task requires manual pan or pinch.

## Semantic zoom

Far: process topology only.
Medium: human-readable step labels and key effort.
Near: detailed evidence, provenance and editable facts.

Semantic zoom is required both for visual clarity and performance.

## Durable request model

Global production Blob store; deploy-scoped stores for non-production where practical.

Logical keys:
`requests/<internal-id>/manifest.json`
`requests/<internal-id>/files/<safe-name>`
`requests/<internal-id>/notification.json`

Manifest seal precedes success UI. Notification failure is recorded independently.

## Free-tier architecture lock

No paid services are required by design. Any future quota approach must prefer controlled degradation, abuse limiting and operational notification over automatic upgrade.

## Security baseline

- secrets only in Netlify runtime env;
- strict input schemas;
- same-origin APIs;
- XSS-safe rendering;
- no arbitrary HTML from model;
- upload extension/MIME/content-signature checks where feasible;
- normalized safe names and generated object keys;
- rate limiting / abuse controls;
- no model access to internal pricing constants;
- prompt injection treated as untrusted input, never authority;
- CSP and secure headers configured before production.

## Availability baseline

ASK AI outage must not prevent request submission. A deterministic guided fallback collects the minimum sufficient brief and closes the same durable request path.
