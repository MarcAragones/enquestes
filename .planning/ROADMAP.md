# Roadmap: Enquestes — Explorador Interactiu d'Enquestes

## Overview

The journey runs from a deployed, empty shell to a fully interactive survey explorer. Phase 1 stands up the Vite/React/Tailwind app, the GitHub Actions deploy pipeline, and a fast JSON-only homepage so the delivery pipeline and survey catalog browsing work end-to-end before any of the riskier integrations are touched. Phase 2 builds the offline Python pipeline that turns raw CSV/Excel survey exports into the Parquet + JSON artifacts the app consumes, including the privacy review gate that must exist before any real data is ever committed to the public repo. Phase 3 delivers the actual core value: DuckDB-Wasm querying Parquet directly in the browser, wired into GraphicWalker for free-form drag-and-drop exploration, plus the data dictionary, chart export, and shareable chart-state link that round out the v1 experience.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation & Survey Listing** - Deployed Vite/React shell with a JSON-only homepage listing surveys and KPI previews (completed 2026-08-26)
- [x] **Phase 2: Offline Data Pipeline** - Python scripts convert raw survey exports (and mock data) into Parquet + metadata, gated by a privacy review (completed 2026-08-26)
- [ ] **Phase 3: Interactive Explorer** - DuckDB-Wasm + GraphicWalker deliver drag-and-drop chart exploration over real survey data, with data dictionary, export, and shareable links

## Phase Details

### Phase 1: Foundation & Survey Listing

**Goal**: Users can visit the live, deployed site and browse a catalog of available surveys with quick KPI previews, before any interactive exploration exists
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: HOME-01, HOME-02, HOME-03, HOME-04, DEPLOY-01, DEPLOY-02
**Success Criteria** (what must be TRUE):

  1. User can visit the live GitHub Pages URL and see a grid of survey cards (title, date, description, participant count)
  2. User sees a clear error message instead of a blank screen if `enquestes_index.json` fails to load
  3. User can click a survey card and see a quick KPI summary (e.g. average age, satisfaction) loaded from `[id]_meta.json` before entering the full explorer
  4. User can click "Explorar dades interactives" from the summary to navigate toward the explorer route
  5. Every push to `main` automatically redeploys the site to GitHub Pages with the correct `base` path

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 01-01-PLAN.md — Walking Skeleton: Node 22 toolchain, Vite/React/TS/Tailwind scaffold, end-to-end tracer slice, and the GitHub Actions → GitHub Pages deploy (DEPLOY-01, DEPLOY-02)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 01-02-PLAN.md — Survey catalog: text-only card grid plus distinct loading, failure-with-retry, and empty-catalog states (HOME-01, HOME-02)

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 01-03-PLAN.md — Quick KPI summary modal with sample-size disclosure, and the hand-off to the explorer route (HOME-03, HOME-04)

**UI hint**: yes

### Phase 2: Offline Data Pipeline

**Goal**: Real and mock survey data can be safely and correctly converted into the Parquet/JSON artifacts the app consumes
**Mode:** mvp
**Depends on**: Nothing (independent of Phase 1; can run in parallel)
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):

  1. Running the conversion script on a raw CSV/Excel export produces `[id]_respostes.parquet` and `[id]_meta.json`, and upserts the corresponding entry into `enquestes_index.json`
  2. Running `generate_mock_parquet.py` produces a valid example Parquet dataset without needing any real survey data
  3. Before real data is published, the conversion process surfaces a privacy checklist that flags potential quasi-identifiers, not just name/email columns

**Plans**: 3/3 plans executed

Plans:
**Wave 1**

- [x] 02-01-PLAN.md — Conversion spine: `scripts/pipeline/` modules plus a tracer that takes one raw CSV end-to-end to Parquet + meta.json + upserted index, with the privacy gate blocking by default, under a runnable self-test (DATA-01, DATA-03)

**Wave 2** *(blocked on Wave 1 completion; 02-02 and 02-03 run in parallel)*

- [x] 02-02-PLAN.md — Full DATA-03 checklist (quasi-identifier name hints, small-group k-anonymity scan, honest reporting) plus real-export loading: `.xlsx`, encoding fallback, shape sanity (DATA-01, DATA-03)
- [x] 02-03-PLAN.md — Mock generator tracer, the committed synthetic demo dataset in `public/data/`, and the pipeline README (DATA-02)

### Phase 3: Interactive Explorer

**Goal**: Users can interactively explore any survey's real data in the browser via drag-and-drop chart building, powered by SQL over Parquet — the app's core value
**Mode:** mvp
**Depends on**: Phase 1, Phase 2
**Requirements**: EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05, EXPL-06, EXPL-07, EXPL-08, EXPL-09, EXPL-10, EXPL-11
**Success Criteria** (what must be TRUE):

  1. User sees a progress indicator while DuckDB-Wasm initializes and the Parquet file downloads/loads, and a clear error message if initialization or querying fails
  2. User can drag variables onto X/Y/Color/Size/Filter to build charts, choosing among multiple chart types (bars, lines, area, scatter), with fields correctly typed as dimension or measure
  3. The explorer stays visually usable and responsive on small/medium screens, lets the user navigate back to the survey list, and a direct link to `/enquesta/:id` works on load and on refresh without a 404
  4. User can view field descriptions (data dictionary) from `meta.json` inside the explorer, and export the current chart as an image (PNG/SVG)
  5. User can generate and copy a link that reproduces the exact current visualization (fields and active filters) via query params

**Plans**: 2/3 plans executed

Plans:
**Wave 1**

- [x] 03-01-PLAN.md — Tracer slice: DuckDB-Wasm singleton over the committed Parquet, verbatim meta.json field typing, two-phase loading with two distinct error states, GraphicWalker mounted full-width, plus a production-build proof that the wasm/worker assets and the Parquet are served under `/enquestes/` (EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05, EXPL-08)

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 03-02-PLAN.md — App-shell explorer header (title + back-link + dark-mode toggle) and the collapsed-by-default data dictionary sourced from `meta.json` (EXPL-06, EXPL-07, EXPL-09)

**Wave 3** *(blocked on Wave 2 completion)*

- [ ] 03-03-PLAN.md — Chart image export plus the versioned, UTF-8-safe shareable link with its silent D-07 fallback on malformed, stale or oversized params (EXPL-10, EXPL-11)

**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Survey Listing | 3/3 | Complete    | 2026-08-26 |
| 2. Offline Data Pipeline | 3/3 | Complete    | 2026-08-26 |
| 3. Interactive Explorer | 2/3 | In Progress|  |
