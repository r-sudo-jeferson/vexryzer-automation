# Vexryzer Automation

Isolated product repository for the Vexryzer Automation commercial intake experience.

## Binding

`FORGE-VEXRYZER-AUTOMATION-v1.0.0`

## Product boundary

All product code, runtime configuration, tests, documentation, assets and infrastructure definitions live under `job/`.

Allowed outside `job/` only when structurally required:
- `AGENTS.md`
- `README.md`
- provider glue such as `.github/workflows/`

## Isolation

This repository must not read, write, import, synchronize with, or depend on:
- `r-sudo-jeferson/Machina`
- `machina-group/machina`

## Product

A premium single-page Automation Intake Canvas where a visitor describes a repetitive business process to ASK AI, sees the process materialize in an infinite canvas, quantifies effort, uploads examples, receives an initial deterministic commercial estimate, and submits a qualified automation request.

## Current status

Planning foundation initialized and repository integrity hardening defined. `VXA-S001` remains `PLANNED_NOT_AUTHORIZED`; no product construction is authorized by the bootstrap or hardening alone.
