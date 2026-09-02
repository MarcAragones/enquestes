# Roadmap: Enquestes — Explorador Interactiu d'Enquestes

## Milestones

- ✅ **v1.0 MVP** — Phases 1-3 (shipped 2026-08-29)
- 🚧 **v1.1 Publish Real Survey Data** — Phases 4-5 (in progress)

## Overview (v1.1)

v1.0 proved the whole machine works, but the only dataset on the live site is synthetic. v1.1 replaces it with the user's real surveys. Phase 4 is operational and pipeline-facing: run the existing `convert_enquesta.py` against each of the 2-5 real exports already in hand, fix whatever real-world format quirks they surface (the same class of bug as the v1.0 `;`-delimiter gap G-02-3), clear the block-by-default privacy checklist for each, and commit the approved artifacts. Phase 5 is the cutover: retire `mostra-sintetica` and confirm that the homepage grid and the explorer — both already built to handle multiple cards — actually behave correctly with several real surveys live at once. No new features are built in this milestone; the deliverable is real data on the public site.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

<details>
<summary>✅ v1.0 MVP (Phases 1-3) — SHIPPED 2026-08-29</summary>

- [x] Phase 1: Foundation & Survey Listing (3/3 plans) — completed 2026-08-26
- [x] Phase 2: Offline Data Pipeline (3/3 plans) — completed 2026-08-26
- [x] Phase 3: Interactive Explorer (8/8 plans) — completed 2026-08-29

Full phase details: `.planning/milestones/v1.0-ROADMAP.md`

</details>

### 🚧 v1.1 Publish Real Survey Data (In Progress)

**Milestone Goal:** The live site publishes 2-5 of the user's real, privacy-reviewed surveys instead of a synthetic demo, with the pipeline hardened against whatever the real exports throw at it.

- [x] **Phase 4: Real Survey Conversion & Publication** - Convert every real export through the existing pipeline, fixing real-world format gaps, and commit the privacy-approved artifacts to `public/data/` (completed 2026-09-02)
- [ ] **Phase 5: Catalog Cutover to Real Data** - Retire the synthetic dataset and confirm the catalog and explorer behave correctly with multiple real surveys live at once

## Phase Details

### Phase 4: Real Survey Conversion & Publication

**Goal**: The operator can take each of the user's real survey exports through the existing offline pipeline and end up with published, privacy-approved Parquet + metadata artifacts — with the pipeline handling the real-world format quirks that only real exports expose
**Depends on**: Phase 2 (v1.0 offline pipeline, complete)
**Requirements**: PUB-01, PUB-02, PUB-05
**Success Criteria** (what must be TRUE):

  1. Operator runs `uv run scripts/convert_enquesta.py` on each of the 2-5 real exports and every one completes, producing `[id]_respostes.parquet` + `[id]_meta.json` — no crashes or garbled columns from its delimiter, encoding, file format, or column types
  2. Each export's block-by-default privacy checklist is run and explicitly resolved before anything is committed: free-text columns excluded, flagged quasi-identifiers and small-group findings either dropped or consciously accepted with a recorded reason
  3. All approved surveys are present under `public/data/` and each has a correct entry (id, title, date, description, n) in `enquestes_index.json`, with no entry lost or duplicated by the upsert
  4. Every pipeline change made to accommodate a real export is covered by a regression case, and `scripts/pipeline_selftest.py` still passes end to end — v1.0's validated behaviour is unchanged

**Plans**: 3 plans

Plans:
**Wave 1**

- [x] 04-01-PLAN.md — Cardinality-based column auto-selection (D-01..D-04): cutoff, override flag, exclusion report, regression coverage, operator docs

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 04-02-PLAN.md — Convert every real export to a scratch directory, fix format gaps reactively with a regression test each, resolve every privacy finding with the operator

**Wave 3** *(blocked on Wave 2 completion)*

- [x] 04-03-PLAN.md — Publish the approved surveys to `public/data/`, add and prove the publication integrity verifier, run the full build and preview gate

### Phase 5: Catalog Cutover to Real Data

**Goal**: A visitor to the live site sees only real surveys, and can move between several of them in the catalog and the explorer without anything breaking or bleeding across surveys
**Depends on**: Phase 4
**Requirements**: PUB-03, PUB-04
**Success Criteria** (what must be TRUE):

  1. `mostra-sintetica` is gone: no entry in `enquestes_index.json`, no leftover files under `public/data/enquestes/`, and the deployed homepage lists only real surveys
  2. Visitor sees a grid of all the published real surveys on the homepage and can open each one's quick summary, showing that survey's own participant count and KPIs (with suppression applied where the sample is too small)
  3. Visitor can open any real survey's `/enquesta/:id`, drag fields, and get charts built from that survey's own data and data dictionary — navigating from one survey to another shows the new survey's fields, never the previous one's
  4. A `?chart=` link copied from one real survey restores that exact chart when reopened, and fails gracefully (rather than erroring or rendering a wrong chart) if pasted onto a different survey
  5. A deep link to a survey id that does not exist still shows the not-found message, unaffected by the removal of the synthetic dataset

**Plans**: TBD
**UI hint**: yes

*(Phase 5's UI work is verification and content removal against v1.0's existing homepage/explorer components — no new interface is designed. Skip `/gsd-ui-phase` unless multi-survey verification reveals a real layout gap.)*

## Progress

**Execution Order:**
Phases execute in numeric order: 4 → 5

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Foundation & Survey Listing | v1.0 | 3/3 | Complete | 2026-08-26 |
| 2. Offline Data Pipeline | v1.0 | 3/3 | Complete | 2026-08-26 |
| 3. Interactive Explorer | v1.0 | 8/8 | Complete | 2026-08-29 |
| 4. Real Survey Conversion & Publication | v1.1 | 3/3 | Complete    | 2026-09-02 |
| 5. Catalog Cutover to Real Data | v1.1 | 0/TBD | Not started | - |
