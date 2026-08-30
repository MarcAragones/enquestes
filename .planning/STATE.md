---
gsd_state_version: 1.0
milestone: v1.1
milestone_name: Publish Real Survey Data
current_phase: 4
current_phase_name: 1st of 2 phases in v1.1
status: planning
stopped_at: Phase 4 context gathered
last_updated: "2026-08-30T11:20:35.172Z"
last_activity: 2026-08-30
last_activity_desc: v1.1 roadmap created (Phases 4-5, PUB-01..PUB-05 mapped)
state_head: b1a26643e1955e1a50d94901126919cbff9573e2
progress:
  total_phases: 2
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-30)

**Core value:** Qualsevol persona pot explorar interactivament (arrossegar X/Y/Color/Mida/Filtres i crear gràfics propis) les dades d'una enquesta directament al navegador, sense servidor ni cost.
**Current focus:** Phase 4 — Real Survey Conversion & Publication (v1.1)

## Current Position

Phase: 4 of 5 (Real Survey Conversion & Publication) — 1st of 2 phases in v1.1
Plan: — (not yet planned)
Status: Ready to plan
Last activity: 2026-08-30 — v1.1 roadmap created (Phases 4-5, PUB-01..PUB-05 mapped)

Progress: [░░░░░░░░░░] 0% (v1.1)

## Performance Metrics

**Velocity:**

- Total plans completed: 14 (all v1.0)
- Average duration: ~16 min/plan (10 measured plans)
- Total execution time: ~2.6 hours (measured plans only)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 3 | 45min | 15min |
| 02 | 3 | - | - |
| 03 | 8 | 113min | 16min |
| 04 | TBD | - | - |
| 05 | TBD | - | - |

**Recent Trend:**

- Last 5 plans (Phase 03): 20, 12, 5, 8, 8 min
- Trend: Improving (gap-closure plans are small and targeted)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- [Phase 02]: `uv` + PEP 723 inline script metadata is the sole Python toolchain — always invoke the pipeline as `uv run scripts/convert_enquesta.py` (system `python3` is 3.6.10 and cannot install pandas/pyarrow).
- [Phase 02]: CSV delimiter auto-detection (`,` vs `;`) added to `load_table` after real-export bug G-02-3 — the reference class for the format gaps Phase 4 expects to hit.
- [Phase 02]: Privacy thresholds `MIN_GROUP_SIZE=5` / `UNIQUENESS_RATIO_THRESHOLD=0.9` validated against one real export (2000×320) and kept unchanged — revisit only if the new exports give evidence.
- [Phase 02]: D-02 free-text column exclusion is a permanent default with no opt-out flag; the privacy gate blocks by default and requires explicit approval per conversion.
- [Phase 01]: KPI suppression threshold `MIN_KPI_SAMPLE=10` in the summary modal — relevant when real surveys have small subgroups.

### Pending Todos

None yet.

### Blockers/Concerns

- [Phase 04]: Real survey exports live only on the operator's local machine; conversion and privacy review require the operator to run the pipeline locally before anything can be committed.
- [Phase 04]: `scripts/pipeline/index.py` only upserts by id — there is no removal path, so retiring `mostra-sintetica` in Phase 5 needs an explicit delete of both the index entry and the files under `public/data/enquestes/`.

## Deferred Items

Items acknowledged and deferred at milestone close, most recent first:

| Category | Item | Status | Deferred At | Milestone |
|----------|------|--------|-------------|-----------|
| debug_sessions | g-03-6-not-found-still-wrong | inconclusive | 2026-08-29 | v1.0 |
| requirements | DISC-01 catalog search/filter | deferred to v2 | 2026-08-30 | v1.1 |
| requirements | DISC-02 large-dataset strategies | deferred to v2 | 2026-08-30 | v1.1 |

Full v1.0 deferred debug-session ledger: `.planning/milestones/` and `.planning/WINDOWS.md`.

## Session Continuity

Last session: 2026-08-30T11:20:35.144Z
Stopped at: Phase 4 context gathered
Resume file: /Users/marcaragones/Github/enquestes/.planning/phases/04-real-survey-conversion-publication/04-CONTEXT.md

## Operator Next Steps

- `/gsd-plan-phase 4` — plan Real Survey Conversion & Publication
