---
phase: 04-real-survey-conversion-publication
plan: 01
subsystem: infra
tags: [python, pandas, pyarrow, uv, cli, data-pipeline, privacy]

# Dependency graph
requires:
  - phase: 02-offline-data-pipeline
    provides: scripts/pipeline/infer.py (is_free_text_column, build_fields), scripts/convert_enquesta.py CLI, scripts/pipeline/privacy.py block-by-default checklist, scripts/pipeline_selftest.py unittest suite
provides:
  - "infer.MAX_DISTINCT_VALUES / is_high_cardinality_column / high_cardinality_columns / format_high_cardinality_report -- D-01/D-02/D-04 cardinality auto-selection primitives"
  - "convert_enquesta.py --max-cardinality and --include-columns flags, --columns now optional"
  - "--list-columns per-column cardinality threshold marker"
  - "17 new regression tests (IsHighCardinalityColumnTests, HighCardinalityColumnsTests, FormatHighCardinalityReportTests, ColumnSelectionIntegrationTests) plus one end-to-end conversion test"
  - "scripts/README.md documentation of the auto-selection default and the three-independent-filters rule"
affects: [04-02, 04-03]

# Actuals (#2632)
actuals:
  tokens: 6874
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure per-column predicate + selector + always-render formatter triad (is_high_cardinality_column / high_cardinality_columns / format_high_cardinality_report), sibling to the existing is_free_text_column contract: no exceptions, no I/O, operates only on already-loaded pandas objects"
    - "Detect -> always print -> then act, never silent drop/coerce, extended a third time (free-text D-02, cardinality D-01, privacy checklist) as three independent additive column-exclusion passes over df.columns"

key-files:
  created: []
  modified:
    - scripts/pipeline/infer.py
    - scripts/convert_enquesta.py
    - scripts/pipeline_selftest.py
    - scripts/README.md

key-decisions:
  - "MAX_DISTINCT_VALUES=20 is an absolute distinct-value count, not a ratio of row count -- a 24-row export and a 2000-row export drop a column at the same distinct-value count (D-02)."
  - "D-02 free-text drop runs strictly before the D-01 cardinality filter so every free-text column is attributed to D-02 in the printed output, never appears in the D-04 report, and can never be resurrected by --include-columns."
  - "format_high_cardinality_report's exempt line reports exactly the names passed via --include-columns (not recomputed against the pre-exemption high-cardinality set), keeping the formatter a pure function of (dropped, exempt) with no dependency on the source frame."
  - "--include-columns validation (unknown/duplicate names -> exit 1) runs against the frame as it stands after the optional --columns reduction, mirroring the existing --columns validation shape exactly."

requirements-completed: [PUB-01, PUB-05]

coverage:
  - id: D1
    description: "A no-`--columns` conversion of a raw export automatically keeps every column with <=20 distinct values and drops every column above that cutoff, with the drop reported by name and count before it takes effect."
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#EndToEndConversionTests.test_full_conversion_drops_high_cardinality_columns_by_default"
        status: pass
      - kind: unit
        ref: "scripts/pipeline_selftest.py#IsHighCardinalityColumnTests"
        status: pass
      - kind: unit
        ref: "scripts/pipeline_selftest.py#HighCardinalityColumnsTests"
        status: pass
    human_judgment: false
  - id: D2
    description: "The cardinality cutoff is a third independent filter: --include-columns exempts a named column from the cardinality cutoff only, never from the D-02 free-text exclusion, and the privacy checklist's block-by-default behavior (exit 2) is unaffected."
    requirement: PUB-05
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#ColumnSelectionIntegrationTests.test_include_columns_cannot_resurrect_free_text_column"
        status: pass
      - kind: unit
        ref: "scripts/pipeline_selftest.py#ColumnSelectionIntegrationTests.test_privacy_gate_untouched_by_new_filter"
        status: pass
      - kind: unit
        ref: "scripts/pipeline_selftest.py#ColumnSelectionIntegrationTests.test_all_columns_above_cutoff_returns_cardinality_specific_error"
        status: pass
    human_judgment: false
  - id: D3
    description: "Every cardinality exclusion report renders column names and integer counts only, never respondent-level cell values, and --list-columns exposes a per-column threshold marker plus the effective threshold before conversion."
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#FormatHighCardinalityReportTests.test_report_never_leaks_cell_values"
        status: pass
      - kind: other
        ref: "uv run scripts/convert_enquesta.py scripts/fixtures/raw/mostra-tracer.csv --list-columns (manual CLI run, verified marker output for all 6 fixture columns)"
        status: pass
    human_judgment: false
  - id: D4
    description: "scripts/README.md documents the auto-selection default, --max-cardinality, --include-columns, and the three-independent-filters rule; the recommended workflow leads with auto-selection instead of hand-enumeration."
    verification:
      - kind: manual_procedural
        ref: "scripts/README.md sections: ### Flags, ### Fluxos de treball recomanat, ### Les columnes de cardinalitat alta s'exclouen per defecte (D-01)"
        status: pass
    human_judgment: false

duration: ~15min
completed: 2026-08-30
status: complete
---

# Phase 4 Plan 1: Cardinality Auto-Selection Summary

**Pipeline now auto-selects columns by an absolute >20-distinct-value cutoff (D-01), replacing mandatory `--columns` hand-enumeration, with a printed exclusion report and an `--include-columns` per-column override that cannot reach the unconditional D-02 free-text exclusion.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-30 (approx, session start)
- **Completed:** 2026-08-30T14:02:56+02:00
- **Tasks:** 3 (1 tracer, 2 auto)
- **Files modified:** 4

## Accomplishments
- `scripts/pipeline/infer.py` gained `MAX_DISTINCT_VALUES`, `is_high_cardinality_column`, `high_cardinality_columns`, and `format_high_cardinality_report` — pure, I/O-free, mirroring the existing `is_free_text_column` contract exactly.
- `scripts/convert_enquesta.py` gained `--max-cardinality` (default 20) and `--include-columns`; `--columns` is now optional everywhere (not just `--list-columns` mode). The D-01 filter runs immediately after the untouched D-02 free-text drop, with its own zero-surviving-columns guard and an unconditionally printed exclusion report.
- `--list-columns` now prints the effective cardinality threshold once and appends a per-column "inside/above threshold" marker to the existing inspection line, without disturbing the existing `dtype`/`no-nuls`/`distints`/`ratio-unicitat`/`mostres` fields.
- `scripts/pipeline_selftest.py` grew from 40 to 57 tests: one end-to-end conversion test (Task 1) plus 16 targeted regression tests (Task 2) covering the boundary, the worked 0-10-plus-"no ho sé" example, the override's scope (cardinality only, never free-text), the report's no-cell-values guarantee, the all-above-cutoff error path, and confirmation the privacy gate (exit 2) is untouched.
- `scripts/README.md` rewritten to lead with auto-selection as the default workflow, document both new flags, and add a D-01 section stating the absolute-count rule and the three-independent-filters invariant.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end cardinality auto-selection — one conversion path, wired through every layer** - `c319419` (feat)
2. **Task 2: Regression coverage for the cutoff boundary, the override, and filter independence** - `ac826a6` (test)
3. **Task 3: Make the new default discoverable — inspection marker and operator docs** - `20384e8` (docs)

**Plan metadata:** pending (final docs commit follows this SUMMARY)

## Files Created/Modified
- `scripts/pipeline/infer.py` - Adds the D-01/D-02/D-04 cardinality predicate/selector/formatter triad
- `scripts/convert_enquesta.py` - New flags, optional `--columns`, wired cardinality filter, `--list-columns` threshold marker
- `scripts/pipeline_selftest.py` - 17 new tests (1 end-to-end + 16 unit/integration) across 4 new `TestCase` classes
- `scripts/README.md` - Flags table, rewritten recommended workflow, new D-01 documentation section

## Decisions Made
- Kept `format_high_cardinality_report`'s exempt line as a literal echo of the `--include-columns` argument rather than recomputing which exempted names actually exceeded the threshold — keeps the formatter a pure function of its two arguments with no dependency on the source frame, matching the plan's "pure formatter" contract.
- Validated `--include-columns` against the frame as it stands immediately after the (optional) `--columns` reduction, mirroring the existing `--columns` missing/duplicate-name error shape exactly, so an operator combining both flags gets the same class of error either way.

## Deviations from Plan

None - plan executed exactly as written. All `must_haves.truths` and acceptance criteria were verified directly against the CLI and the test suite during execution (see verification evidence in `coverage` above).

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- The pipeline can now convert a real export without hand-enumerating every kept column, which is the prerequisite PUB-01 needed before any real survey can be converted.
- `codi_postal` in the tracer fixture is read by pandas as `int64` (leading zeros dropped) and therefore classified as a `measure`, not a `dimension` — pre-existing v1.0 behavior, untouched by this plan, and not in scope here; flagged for awareness if a real export's postal-code column needs dimension treatment.
- No blockers for plan 04-02 or 04-03; `--max-cardinality`/`--include-columns` are available for any real export that needs a threshold or exemption different from the 20-value default.

## Self-Check: PASSED

- FOUND: scripts/pipeline/infer.py (MAX_DISTINCT_VALUES, is_high_cardinality_column, high_cardinality_columns, format_high_cardinality_report present)
- FOUND: scripts/convert_enquesta.py (--max-cardinality, --include-columns present; --columns optional)
- FOUND: scripts/pipeline_selftest.py (57 tests, 0 failures)
- FOUND: scripts/README.md (D-01 section, updated flags table, rewritten workflow)
- FOUND commit c319419 (feat(04-01): wire D-01 cardinality auto-selection end to end)
- FOUND commit ac826a6 (test(04-01): regression coverage for cardinality cutoff and override)
- FOUND commit 20384e8 (docs(04-01): document cardinality auto-selection and add inspection marker)

---
*Phase: 04-real-survey-conversion-publication*
*Completed: 2026-08-30*
