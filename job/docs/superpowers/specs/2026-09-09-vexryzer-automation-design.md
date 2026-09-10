# Vexryzer Automation Design

Date: 2026-09-09
Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`

## Problem

Accounting-office clients have repetitive operational work but often cannot specify an automation technically. The current commercial failure mode is informal requests that become unpaid technical effort. Vexryzer Automation must turn the first conversation into a professional paid-development funnel without requiring login, a portal or a traditional requirements form.

## Design thesis

The page is an Infinite Canvas whose content is progressively materialized from a guided ASK AI conversation. The visual system makes understanding tangible; a deterministic commercial engine quantifies human effort and presents an initial estimate; contextual evidence uploads reduce technical uncertainty; the request is durably sealed before the UI declares success.

## UX acts

1. Fascination: one question, premium spatial environment.
2. Understanding: process nodes appear as the conversation clarifies the flow.
3. Qualification: ASK AI asks only the next highest-value question.
4. Value: person-hours become accumulated operational effort through a Value Lens.
5. Evidence: files are requested in context and represented on the process map.
6. Estimate: deterministic server-side estimate appears only when responsible.
7. Commitment: ASK AI handles truthful objections and asks for a commercial decision.
8. Close: minimal contact, review, seal and receipt.

## ASK AI interaction policy

ASK AI must cover, among others:
- clear or vague problem;
- technical/non-technical user;
- immediate price question;
- unknown effort;
- multiple people;
- multiple processes;
- recurring, seasonal, temporary and one-time work;
- unknown software/system;
- missing files;
- invalid uploads;
- changed facts after estimate;
- price objection;
- discount request;
- request for free technical instructions;
- request for human contact;
- prompt injection/system-prompt extraction attempts;
- Mistral timeout/rate limit/malformed output;
- offline/reconnect;
- fallback without AI.

One principal question per turn is the default. Prefer chips/structured controls where they reduce cognitive load. Stop asking when the minimum sufficient brief exists.

## Commercial interaction

ASK AI may say what the user’s own numbers imply, e.g. 10 person-hours/month = 120/year = 240 over 24 months. It may not claim all hours will be eliminated before technical validation.

The authoritative estimate is calculated server-side from internal policy. Formula details are not client-facing.

## Visual language

Black Titanium / Liquid Graphite / Platinum base. Spectral accent only for intelligence, state change, evidence and success. Machined, sculptural depth without excessive glass, neon or gamer/cyberpunk treatment.

Motion is spring-based, sparse and purposeful. Camera motion communicates stage transition. Reduced motion substitutes instant/short opacity/state changes.

## Mobile design

Mobile is not desktop shrunk. It uses the same world but a directed vertical camera/reading path. Composer remains reachable above the keyboard. Pan/zoom remains optional.

## Failure design

Every external provider has a visible bounded failure state. AI failure can fall back to deterministic guided intake. Upload failure never erases conversation. Email failure never erases a sealed request. No indefinite spinner.

## Architecture summary

Vite/React client, XState orchestration, React Flow canvas, Motion transitions. Netlify Functions own server authority and secrets. Netlify Blobs provide request/file storage. Mistral Medium 3.5 provides structured conversational intelligence. Transactional email provides notification only.

## Deferred intentionally

No account system, customer portal, admin dashboard, relational database, payment checkout, automation marketplace or job execution engine. These are different products unless later justified by actual volume.
