# Phase 2: Offline Data Pipeline - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

A Python offline pipeline that converts raw survey exports (CSV/Excel) into the exact
on-disk data contract the deployed React app already reads: `[id]_respostes.parquet`,
`[id]_meta.json`, and an upserted entry in `enquestes_index.json`. Includes a mock-data
generator (`generate_mock_parquet.py`) that needs no real survey data, and a privacy
checklist that runs before any real data is published, flagging potential
quasi-identifiers beyond obvious name/email columns. This phase does not touch the React
app, does not run in the browser, and does not decide what the explorer (Phase 3) does
with the Parquet file — it only produces correct, safe artifacts for Phase 1's already-
locked contract to consume.

</domain>

<decisions>
## Implementation Decisions

### Real-data input format
- **D-01:** Raw CSV/Excel exports are one row per respondent, one column per question (standard Google Forms/Typeform export shape) — the conversion script targets this shape, not multi-sheet or pre-aggregated spreadsheets.
- **D-02:** Open-ended/free-text fields (free responses, comments) are excluded entirely from the pipeline — they never enter `[id]_respostes.parquet` or `[id]_meta.json`, not merely hidden from the UI. — **Reversibility:** costly — **rationale:** once a survey's Parquet file has shipped without a free-text column, adding it back requires reprocessing and republishing that survey's data artifacts; treat this as the default behavior for every conversion, not a per-run toggle.
- **D-03:** Column type for the `fields` array in `[id]_meta.json` (`dimension` vs `measure`) is inferred automatically from the data (numeric column → measure, text/low-cardinality column → dimension) — no manual per-column annotation step.
- **D-04:** The script targets a single export format for now (whatever the user's existing tool produces) — no multi-format (Google Forms vs Typeform vs manual Excel) abstraction layer in this phase.

### Claude's Discretion
- DATA-03's privacy checklist enforcement behavior (block conversion until reviewed vs. warn-and-allow-explicit-override) — user did not select this area to discuss; left to research/planning to resolve, informed by the project's existing privacy-first posture (Phase 1 already ships an empty placeholder rather than any early real data, and the app-side `MIN_KPI_SAMPLE = 10` suppression threshold sets a precedent for "err toward withholding, state why").
- KPI selection mechanism for `[id]_meta.json`'s `kpis` array (auto-computed from numeric columns vs. user-specified) — not discussed; left to research/planning.
- `generate_mock_parquet.py`'s realism/scope (minimal schema-exercising synthetic data vs. a plausible demo survey) — not discussed; left to research/planning. Note: Phase 1's `scripts/fixtures/` already contains hand-authored JSON fixtures with deliberately awkward edge cases (n=0, markup-in-title, below-suppression-threshold KPI) that this generator's *output shape* should remain consistent with, even if it doesn't reuse that exact data.
- Parquet-writing library choice (e.g., `pyarrow` vs `pandas` + engine), CLI argument design, and error-handling/reporting format for the conversion script — standard implementation choices, not user-facing product decisions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Locked data contract (Phase 1 — do not renegotiate)
- `src/types/enquesta.ts` — `EnquestaIndexEntry`, `EnquestaMeta`, `EnquestaMetaKpi`, `EnquestaMetaField` TypeScript interfaces this pipeline's JSON output must satisfy byte-for-byte (field names and types are fixed).
- `.planning/phases/01-foundation-survey-listing/01-01-SUMMARY.md` — "Interface contracts defined by this plan" section; original type definitions and the `dataUrl`/`parseEnquestesIndex` trust-boundary discipline the app applies to whatever this pipeline emits.
- `.planning/phases/01-foundation-survey-listing/01-03-SUMMARY.md` — "Next Phase Readiness" section: the final, locked `EnquestaMeta` field list and the on-disk `public/data/` layout (`enquestes_index.json`, `enquestes/<id>_meta.json`, `enquestes/<id>_respostes.parquet`) this phase's script must produce into.
- `src/lib/enquestes.ts` — `parseEnquestesIndex`/`parseEnquestaMeta` trust-boundary validators; `MIN_KPI_SAMPLE = 10` suppression constant (precedent for this phase's own privacy posture, even though enforcement lives client-side today).
- `scripts/fixtures/enquestes_index.json`, `scripts/fixtures/enquestes/demo-2024_meta.json` — existing hand-authored fixtures showing the exact expected JSON shape end-to-end, including edge cases (zero participants, below-threshold KPI, markup in text fields).

### Requirements
- `.planning/REQUIREMENTS.md` — DATA-01, DATA-02, DATA-03 (Dades / Pipeline offline section).
- `.planning/ROADMAP.md` — Phase 2 entry: goal, success criteria, `Mode: mvp`.

### General project research
- `.planning/research/STACK.md` — stack-level recommendations (may cover Python/Parquet tooling choices).
- `.planning/research/ARCHITECTURE.md` — architecture patterns referencing Parquet/data pipeline concerns.
- `.planning/research/PITFALLS.md` — known pitfalls that mention Parquet/pandas/Python.
- `.planning/research/FEATURES.md`, `.planning/research/SUMMARY.md` — feature landscape and synthesis, for any data-pipeline-adjacent findings.

### Project constraints
- `.planning/PROJECT.md` — Constraints section: "només dades no sensibles/anonimitzades es publiquen a `public/data/`" (privacy constraint this phase's checklist directly implements); Context section on the user's real CSV/Excel-exported data already being ready to convert.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/types/enquesta.ts` — the exact target schema; the Python script's JSON output should be validated against this shape (structurally) before being written.
- `scripts/fixtures/` (JSON fixtures from Phase 1) — reference examples of valid `meta.json`/`enquestes_index.json` shape, useful as golden-file test fixtures for the new Python script.

### Established Patterns
- Fetch trust-boundary discipline (`parseEnquestesIndex`/`parseEnquestaMeta` reject-early on any shape violation, fixed Catalan error copy, no interpolation of internals) — this phase's script is the *producer* side of that same contract; malformed output from this pipeline is exactly what those client-side validators exist to catch, so the pipeline should aim to never produce it in the first place.
- Upsert semantics are undecided here — `enquestes_index.json` currently holds a single empty-array placeholder (`[]`) committed in Phase 1; this phase's script is what will first mutate it with real entries.

### Integration Points
- Output directory: `public/data/` (repo-relative) — this is the only place this phase's script may write publishable artifacts; `scripts/fixtures/` remains the separate, never-deployed QA/test location established in Phase 1.
- No React/TypeScript code changes are anticipated in this phase — integration is purely file-based (this script's output files are what Phase 1's already-shipped fetch logic reads).

</code_context>

<specifics>
## Specific Ideas

No specific implementation examples given during discussion (e.g., no named library preference, no sample file shared). The user confirmed their real data is a standard one-row-per-respondent CSV/Excel export from a single source tool, with open-text fields that must never reach the published artifacts.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 2-offline-data-pipeline*
*Context gathered: 2026-08-26*
