---
phase: 02-offline-data-pipeline
plan: 02
subsystem: data-pipeline
tags: [python, pandas, pyarrow, openpyxl, privacy, k-anonymity, csv, excel]

requires:
  - phase: 02-offline-data-pipeline
    provides: "scripts/pipeline/{schema,infer,index,privacy}.py, scripts/convert_enquesta.py, scripts/pipeline_selftest.py (plan 02-01 tracer)"
provides:
  - "scripts/pipeline/privacy.py — full DATA-03 checklist: uniqueness ratio, quasi-identifier name hints, small-group k-anonymity scan, unevaluated-column reporting, thresholds-and-assessed-count report"
  - "scripts/pipeline/load.py — CSV/TSV/Excel loading with utf-8→cp1252 encoding fallback and shape-sanity warnings"
  - "scripts/fixtures/raw/mostra-privacitat.csv — never-deployed fixture exercising both new privacy heuristics"
  - "scripts/convert_enquesta.py — wired to load_table and the dimension-aware privacy checklist"
affects: [02-03]

actuals:
  tokens: 6480
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "run_privacy_checklist(df, dimension_columns) returns (findings, unevaluated) — a column or combination the heuristics could not assess is always reported, never silently folded into a clean result"
    - "load_table(path, sheet) returns (df, warnings) — shape-sanity issues are warnings, never auto-corrected (no header/footer stripping, D-04)"
    - "Column-name quasi-identifier matching normalises accents+case, substring match for long hints, whole-token match for short hints (cp/zip/age) to avoid false positives"

key-files:
  created:
    - scripts/pipeline/load.py
    - scripts/fixtures/raw/mostra-privacitat.csv
  modified:
    - scripts/pipeline/privacy.py
    - scripts/convert_enquesta.py
    - scripts/pipeline_selftest.py

key-decisions:
  - "Interpreted the plan's 'skip a combination whose group count exceeds the row count' literally as impossible (distinct-group count can never exceed row count) and implemented the intended degenerate-near-unique cap as group_count >= n instead — the only combination for which every row forms its own group. Documented inline in small_group_flags's docstring."
  - "assessed_count in the report is computed from privacy.unevaluated_columns(df) alone (real per-column skips), not from the combined unevaluated list returned by run_privacy_checklist (which also carries combination-level skip notices) — keeps 'columns actually assessed' numerically honest rather than conflating column-level and combination-level skips."
  - "Removed the now-unused `import pandas as pd` from convert_enquesta.py after step 2/3 moved into load_table — no remaining direct pd. usage in that file."

patterns-established: []

requirements-completed: [DATA-01, DATA-03]

coverage:
  - id: D1
    description: "name_hint_flags catches quasi-identifier column names (Catalan and English) independent of a column's uniqueness ratio or inferred type"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#NameHintFlagsTests.test_catches_known_quasi_identifier_names"
        status: pass
      - kind: unit
        ref: "scripts/pipeline_selftest.py#NameHintFlagsTests.test_short_hint_guard_does_not_flag_capacitat_on_cp"
        status: pass
      - kind: integration
        ref: "manual uv run scripts/convert_enquesta.py scripts/fixtures/raw/mostra-privacitat.csv --columns codi_postal,departament,franja_edat,satisfaccio (no ack) — exit 2, codi_postal flagged as quasi-identifier-name, verified this session"
        status: pass
    human_judgment: false
  - id: D2
    description: "small_group_flags flags 2/3-column dimension combinations containing a group below MIN_GROUP_SIZE, emitting at most one finding per combination and recording unevaluated skips (fewer than 2 dimension columns, zero rows, degenerate near-unique combination) rather than a pass"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#SmallGroupFlagsTests (3 cases: two-row-group finding, no-finding-above-threshold, single-dimension-frame unevaluated)"
        status: pass
      - kind: integration
        ref: "manual: mostra-privacitat.csv full run reports [small-group] departament, franja_edat, verified this session"
        status: pass
    human_judgment: false
  - id: D3
    description: "format_checklist_report renders thresholds in effect, per-finding kind/subject/detail, an unevaluated section, and an explicit assessed-column count whenever findings is empty — never a bare 'clear'"
    requirement: DATA-03
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#FormatChecklistReportTests.test_empty_findings_states_assessed_column_count"
        status: pass
    human_judgment: false
  - id: D4
    description: "The privacy gate reads the acknowledgement only from the parsed CLI namespace — CONFIRM_PRIVACY_REVIEW set in the environment does not pre-satisfy it"
    requirement: DATA-03
    verification:
      - kind: integration
        ref: "manual: CONFIRM_PRIVACY_REVIEW=1 uv run scripts/convert_enquesta.py ... (flag omitted) — exit 2, verified this session"
        status: pass
    human_judgment: false
  - id: D5
    description: "load_table reads .csv/.tsv/.xlsx through one function, falls back utf-8->cp1252 on UnicodeDecodeError with a visible warning, and reports shape-sanity issues (Unnamed: columns, blank/duplicate names, zero rows) as warnings without auto-correcting anything"
    requirement: DATA-01
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#LoadTableTests (5 cases: tracer CSV no-warnings, cp1252 fallback+accent preservation, xlsx column parity, blank-header Unnamed warning, unsupported-suffix ValueError)"
        status: pass
      - kind: integration
        ref: "manual: .xlsx derived from mostra-tracer.csv converted end-to-end, parquet verified 24 rows / [satisfaccio, segment] columns, this session"
        status: pass
    human_judgment: false
  - id: D6
    description: "Every run prints the shape report (columns+dtypes, row count, first/last 3 rows) before any other work, and convert_enquesta.py calls load_table rather than pd.read_csv directly"
    requirement: DATA-01
    verification:
      - kind: integration
        ref: "manual: both the .xlsx and cp1252 CLI runs printed the shape report before the 'Columnes detectades' / privacy checklist output, this session"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-08-26
status: complete
---

# Phase 2 Plan 2: Offline Data Pipeline — Privacy Checklist & Real-Export Loading Summary

**Extended `scripts/pipeline/privacy.py` with quasi-identifier name-hint matching and a 2/3-column small-group k-anonymity scan, and added `scripts/pipeline/load.py` for `.csv`/`.tsv`/`.xlsx` loading with utf-8→cp1252 encoding fallback and a shape-sanity report printed on every run.**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-08-26T13:10:00Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- `privacy.name_hint_flags` flags a column by name (postal code, birth date, job title, municipality, department, age, gender — both Catalan and English spellings) regardless of its uniqueness ratio or inferred type, catching the classic zip/birthdate/gender re-identification vector a ratio-only check cannot see. Short hints (`cp`, `zip`, `age`) require a whole-token match to avoid false positives like `capacitat`.
- `privacy.small_group_flags` scans every 2- and 3-column combination of dimension-typed columns, emitting at most one finding per combination naming the count of undersized groups and the smallest group found — proven against the `mostra-privacitat.csv` fixture's `departament`×`franja_edat` two-row group.
- `privacy.unevaluated_columns` and the aggregator `run_privacy_checklist(df, dimension_columns)` now return `(findings, unevaluated)` — a column the heuristics could not assess (all-null, unhashable dtype) or a combination skipped for degeneracy is always reported, never silently counted as clear.
- `format_checklist_report` now prints the effective `UNIQUENESS_RATIO_THRESHOLD`/`MIN_GROUP_SIZE`, per-finding kind/subject/detail, an explicit "no avaluades" section, and — whenever findings is empty — the exact count of columns actually assessed.
- `convert_enquesta.py` now builds `fields`/`dimension_columns` before running the checklist (small-group scan needs the typed column list) and confirmed the gate still reads only the parsed CLI namespace: `CONFIRM_PRIVACY_REVIEW=1` in the environment does not pre-satisfy it.
- `scripts/pipeline/load.py`'s `load_table(path, sheet)` branches on file suffix (`.csv`/`.tsv` via `pd.read_csv`, `.xlsx` via `pd.read_excel(engine="openpyxl")`), falls back to `cp1252` on `UnicodeDecodeError` with a visible warning, and reports shape-sanity issues (`Unnamed:` columns, blank/duplicate names, zero rows) as warnings without ever auto-stripping anything (D-04).
- `format_shape_report` prints columns+dtypes, row count, and the first/last three rows before any other work runs — proven against both the `.xlsx`-converted tracer fixture and a synthetic `cp1252` CSV this session.
- 35-case `scripts/pipeline_selftest.py` (up from 24 after plan 02-01) — 11 new cases across name-hint matching, small-group scanning, report formatting, and `load_table`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Complete the DATA-03 checklist — name hints, small-group scan, honest reporting** — `5692d1a` (feat)
2. **Task 2: Load real exports — Excel, encoding fallback, shape sanity** — `962a2db` (feat)

## Files Created/Modified

- `scripts/pipeline/privacy.py` — added `QUASI_IDENTIFIER_NAME_HINTS`, `MAX_COMBINATION_SIZE`, `name_hint_flags`, `small_group_flags`, `unevaluated_columns`; `run_privacy_checklist` now takes `dimension_columns` and returns `(findings, unevaluated)`; `format_checklist_report` rewritten to take `(findings, unevaluated, assessed_count)`
- `scripts/pipeline/load.py` (new) — `load_table(path, sheet=None) -> (df, warnings)`, `format_shape_report(df, warnings) -> str`
- `scripts/convert_enquesta.py` — loads via `load_table`, prints the shape report before anything else, builds `fields`/`dimension_columns` before the checklist, wires `--sheet`; dropped the now-unused `import pandas as pd`
- `scripts/pipeline_selftest.py` — 11 new cases (`NameHintFlagsTests`, `SmallGroupFlagsTests`, `FormatChecklistReportTests`, `LoadTableTests`); added `openpyxl` to the script's PEP 723 dependencies for the `.xlsx` round-trip test
- `scripts/fixtures/raw/mostra-privacitat.csv` (new) — 30-row fixture: `codi_postal` (3 distinct 5-digit values, low uniqueness ratio, only catchable by name hint), `departament` (4 values), `franja_edat` (3 values, one `Direccio`/`31-50` pair with exactly 2 rows), `satisfaccio` (integers 1–10)

## Decisions Made

- **`small_group_flags`'s degenerate-combination cap uses `group_count >= n`, not a literal `>`.** The plan's action text said "skip any combination whose group count exceeds the row count," but the number of distinct groups in a `groupby` can never exceed the row count (each row contributes at most one group) — a literal `>` check would be permanently dead code. Interpreted the intent (skip a combination that is itself degenerately near-unique, a case the per-column uniqueness check already covers) as `>=`, which fires only when every row forms its own group. Documented in the function's docstring; flagged here since this reinterprets ambiguous plan wording rather than following it literally.
- **`assessed_count` in the printed report is computed from `privacy.unevaluated_columns(df)` alone**, called separately from `run_privacy_checklist`'s combined `unevaluated` list (which also carries combination-level skip notices that are not single column names). This keeps "columns actually assessed" numerically honest instead of conflating column-count and combination-count semantics — a minor duplication (calling `unevaluated_columns` twice) traded for report-number correctness.
- **`import pandas as pd` removed from `convert_enquesta.py`.** After step 2/3 moved entirely into `load_table`, no remaining code in that file referenced `pd.` directly; kept as a small cleanup rather than leaving a dead import.

## Deviations from Plan

None — plan executed as written, aside from the two documented interpretive decisions above (both flagged as ambiguous-wording resolutions rather than bugs/blockers, so not filed under the Rule 1–4 deviation taxonomy).

## Human-Check Item (RESEARCH assumptions A1/A2)

The plan's `<human-check>` step asks the developer to run the conversion against their own real export and judge whether `MIN_GROUP_SIZE=5` and `UNIQUENESS_RATIO_THRESHOLD=0.9` flag sensibly. This plan shipped both thresholds unchanged at their plan-02-01 defaults (5 and 0.9 respectively) — **no real survey export was available in this execution session** to run the human-check against, so this remains an open item for the developer's first real conversion, consistent with STATE.md's existing "real-world Parquet file sizes are unverified" blocker for this phase. No code change is implied unless the developer reports the defaults flag badly on real data.

## Issues Encountered

None beyond the two ambiguous-plan-wording interpretations documented under Decisions Made above.

## User Setup Required

None — `uv` (0.9.16) was already present and working; `openpyxl` resolves automatically via `uv run`'s PEP 723 metadata.

## Next Phase Readiness

- Plan 02-03 (mock data generator) is unaffected by this plan's changes — `pipeline/schema.py`, `pipeline/infer.py`, and `pipeline/index.py` (its stated dependencies) were not touched here.
- `scripts/convert_enquesta.py` now has full DATA-01 (Excel/encoding/shape-sanity) and DATA-03 (name-hint + small-group privacy checklist) coverage; both requirements can be marked complete for this plan.
- Open item carried forward: sanity-check `MIN_GROUP_SIZE`/`UNIQUENESS_RATIO_THRESHOLD` against a real survey export once one is available (RESEARCH A1/A2, plan's human-check step) — no blocker, just unverified against real data.

---
*Phase: 02-offline-data-pipeline*
*Completed: 2026-08-26*

## Self-Check: PASSED

All created files verified present on disk (`scripts/pipeline/load.py`, `scripts/fixtures/raw/mostra-privacitat.csv`, this SUMMARY.md); both task commit hashes (`5692d1a`, `962a2db`) verified present in git log.
