# VXA-001 Product Contract

Version: 1.0.0
Binding: `FORGE-VEXRYZER-AUTOMATION-v1.0.0`
Status: PLANNED

## North Star

Transform a repetitive operational task into a qualified automation request in the fewest responsible interactions, while making the visitor feel that the process is being understood and structured in front of them.

## Primary outcome

Qualified Request Submission Rate.

A qualified request contains enough information to understand the process, contact the requester, and evaluate the automation without forcing a traditional long form.

## Product Truth

Vexryzer Automation sells custom automation development through a conversational and visual intake experience. It does not perform the requested automation in the intake, does not promise feasibility before validation, and does not present an estimate as a binding technical proposal.

## Experience Truth

The user enters with an imprecise problem and sees it become a structured process in an infinite canvas. ASK AI asks one principal question at a time, uses chips and constrained inputs when helpful, and never requires the user to understand diagramming. The canvas camera guides the experience; pan and zoom are enhancements, never prerequisites.

## Engineering Truth

Critical state is deterministic. The model proposes language and validated structured mutations; it never owns authoritative price, persistence, request sealing, upload truth, submission idempotency or security decisions.

## Target journey

1. Attract: one premium prompt asks what the team still does manually.
2. Discover: ASK AI understands the pain and creates a visual process map.
3. Qualify: recurrence, duration, people and desired outcome are clarified only as needed.
4. Quantify: monthly person-hours become annual and 24-month impact.
5. Evidence: relevant example files are requested contextually, but absence of a file does not dead-end the sale.
6. Estimate: deterministic pricing is shown when confidence is sufficient.
7. Decide: ASK AI handles objections truthfully and asks for the next commercial action.
8. Close: minimal contact data and a review surface are shown.
9. Seal: request and accepted files are durably recorded before success is claimed.
10. Notify: internal notification is attempted; notification failure must not erase the request.

## Pricing policy

Internal-only inputs:
- reference salary: R$ 5,000;
- annual salary multiplicity: 14;
- reference work month: 160 h;
- captured value share: 30%;
- standard recurring horizon: 24 months;
- initial minimum commercial estimate: R$ 2,500.

Reference hour = `(5000 * 14) / (12 * 160)`.

Recurring estimate = `max(2500, monthly_person_hours * reference_hour * 24 * 0.30)`.

The browser never owns this formula. The LLM never calculates authoritative price. Non-recurring or temporary work must not be forced through the recurring formula; it is routed to manual review or a bounded horizon when explicitly known.

## Minimum sufficient brief

The intake should stop asking questions once it has enough information to advance. Typical fields:
- current pain/process;
- desired outcome;
- recurrence or frequency;
- monthly person-hours, directly or derived;
- system involved if material;
- examples when available/needed;
- name;
- company;
- one contact channel.

## Persuasion policy

Persuasion is evidence-based. ASK AI may reflect the user’s own stated repetition and effort, quantify accumulated work, reduce technical uncertainty and ask for commitment. It must not use fake scarcity, false urgency, fabricated ROI, fake testimonials, invented compatibility, unapproved discounts or technical guarantees.

## File policy

Initial accepted families are office/business artifacts only: XLSX, CSV, TXT, XML, PDF, PNG and JPEG. Executables, scripts, HTML, macros and archives are rejected initially. Limits are configurable; initial planning target is 5 files, 20 MB each, 50 MB total per request.

Privacy copy must encourage sending only what is necessary and anonymizing personal data when possible.

## Success semantics

The UI may only show `request registered` after the durable request manifest has been persisted and required file references verified. Email delivery is a secondary notification state and may be pending.
