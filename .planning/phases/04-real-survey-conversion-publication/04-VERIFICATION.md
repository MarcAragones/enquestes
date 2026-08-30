---
phase: 04-real-survey-conversion-publication
verified: 2026-08-30T17:13:31Z
status: human_needed
score: 9/9 must-haves verified
behavior_unverified: 0
overrides_applied: 1
overrides:
  - must_have: "Each export's block-by-default privacy checklist is run and explicitly resolved before anything is committed: free-text columns excluded, flagged quasi-identifiers and small-group findings either dropped or consciously accepted with a recorded reason (roadmap success criterion 2)"
    reason: "Operator explicitly and traceably decided to skip the privacy checklist computation entirely for all three real surveys via a new --skip-privacy-review flag, because the source is official government-published, pre-anonymized microdata (Centre d'Estudis d'Opinió, https://web.gencat.cat/ca/generalitat/dades-indicadors/centre-estudis-opinio). Documented verbatim in 04-02-SUMMARY.md and 04-03-SUMMARY.md. This is a task-authorized deviation per the verification brief: the underlying intent (an explicit, traceable human privacy decision before anything is committed to public/data/) is satisfied via a different mechanism than the literal per-finding drop/accept/narrow flow. privacy.py's uniqueness/name-hint/small-group heuristics were independently confirmed unmodified (no commits touching scripts/pipeline/privacy.py since Phase 2) and remain fully available for any future survey that does not pass the flag."
    accepted_by: "marcaragones (operator, verbatim quotes recorded in 04-02-SUMMARY.md)"
    accepted_at: "2026-08-30 (per 04-02-SUMMARY.md checkpoint resolution)"
human_verification:
  - test: "Open the local preview with `npm run preview:pages` and confirm, for each published survey card on the homepage (REO1167, REO1151, REO1145, mostra-sintetica), that the title, date, description and participant count are the ones intended for that survey, and that no card shows another survey's details."
    expected: "Each card's displayed title/date/description/n matches the operator-supplied metadata recorded in 04-02-SUMMARY.md and confirmed present in enquestes_index.json; no cross-survey mixups."
    why_human: "04-03-PLAN.md's Task 3 explicitly specifies this as a `<human-check>`, and 04-03-SUMMARY.md explicitly states it was not run in the autonomous continuation (\"the operator's own local review is the deferred step\"). Visual rendering correctness on the homepage cannot be confirmed by grep/data checks alone, even though the underlying JSON values were independently verified correct by this verifier."
  - test: "For each of the three real surveys, confirm the recorded row count and surviving column list (from 04-02-SUMMARY.md's per-survey tables) match what the operator expects that survey to contain, and that no column considered essential was dropped by the free-text exclusion or the cardinality cutoff."
    expected: "Operator confirms the auto-selected column set (283/291/263 surviving columns respectively) is acceptable for publication, i.e. no essential question was inadvertently excluded by the D-01/D-02 filters."
    why_human: "04-02-PLAN.md's Task 2 specifies this as a `<human-check>`; the SUMMARY does not explicitly record the operator's confirmation of this specific check (as distinct from the separate privacy-skip decision), only the raw drop lists. Whether a specific dropped column is 'essential' is a domain judgment about the operator's own survey content, not a mechanically verifiable fact."
---

# Phase 4: Real Survey Conversion & Publication Verification Report

**Phase Goal:** The operator can take each of the user's real survey exports through the existing offline pipeline and end up with published, privacy-approved Parquet + metadata artifacts — with the pipeline handling the real-world format quirks that only real exports expose
**Verified:** 2026-08-30T17:13:31Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Operator runs the converter on each real export and every one completes, producing `[id]_respostes.parquet` + `[id]_meta.json`, no crashes or garbled columns (roadmap SC1) | ✓ VERIFIED | Re-ran `uv run scripts/convert_enquesta.py` directly against the three actual real export files at `/Users/marcaragones/Downloads/REO1167_microdades_anonimitzades.csv`, `REO1151_microdades_anonimitzades.csv`, `REO1145_microdades_anonimitzades.csv` into a fresh scratch dir during this verification. All three exited 0, produced both artifacts, and the reported free-text/cardinality drop lists matched 04-02-SUMMARY.md exactly (REO1167: 2 free-text/35 cardinality; REO1151: 4/39; REO1145: 3/34). |
| 2 | Each export's block-by-default privacy checklist is run and explicitly resolved before anything is committed (roadmap SC2) | PASSED (override) | See `overrides` in frontmatter. Operator explicitly, verbatim, and traceably chose to skip the checklist computation for all three surveys via `--skip-privacy-review` (source: official pre-anonymized government microdata). `privacy.py`'s three heuristics (`UNIQUENESS_RATIO_THRESHOLD`, `MIN_GROUP_SIZE`, `QUASI_IDENTIFIER_NAME_HINTS`, `uniqueness_flags`/`name_hint_flags`/`small_group_flags`) confirmed unmodified via `git log --oneline -- scripts/pipeline/privacy.py` (last touched in Phase 2, commit `5692d1a`) — fully intact for any future survey not using the flag. |
| 3 | All approved surveys are present under `public/data/` with a correct index entry (id, title, date, description, n), no entry lost or duplicated by the upsert (roadmap SC3) | ✓ VERIFIED | `uv run scripts/verify_publicacio.py` against real `public/data/` exits 0: "Totes les comprovacions han passat (4 enquestes verificades)" — mostra-sintetica (n=250, 6 cols), REO1167 (n=2000, 283 cols), REO1151 (n=6706, 291 cols), REO1145 (n=2000, 263 cols). No duplicate ids. `enquestes_index.json` inspected directly: 4 entries, mostra-sintetica values unchanged from pre-phase baseline recorded in 04-03-SUMMARY.md. |
| 4 | Every pipeline change made to accommodate a real export is covered by a regression case, and `scripts/pipeline_selftest.py` still passes end to end — v1.0's validated behaviour unchanged (roadmap SC4) | ✓ VERIFIED | `uv run scripts/pipeline_selftest.py -v` run directly during this verification: "Ran 71 tests in 0.596s / OK" — 0 failures. Includes regression tests for every fix made this phase (cardinality: `IsHighCardinalityColumnTests`, `HighCardinalityColumnsTests`, `FormatHighCardinalityReportTests`, `ColumnSelectionIntegrationTests`; `low_memory` bug: `test_wide_export_does_not_double_count_distinct_values_across_read_buffer`; `--skip-privacy-review`: `SkipPrivacyReviewTests`; publication verifier: `VerifyPublicacioTests` x9; post-review-fix additions: `test_truly_duplicated_raw_header_is_detected`, `test_invalid_date_value_is_rejected_before_any_work`, quote-aware delimiter fix coverage). Pre-existing v1.0 tests (`test_tied_delimiter_counts_default_to_comma`, `test_comma_delimited_csv_with_quoted_semicolon_stays_comma`, `test_ragged_csv_raises_actionable_value_error`) confirmed still present and passing. |
| 5 | Cardinality auto-selection (D-01/D-02/D-04) works as specified: ≤20 distinct values kept, >20 dropped, every drop reported by name+count, `--include-columns` exempts a column from the cardinality cutoff only (04-01) | ✓ VERIFIED | `infer.MAX_DISTINCT_VALUES`, `is_high_cardinality_column`, `high_cardinality_columns`, `format_high_cardinality_report` all present in `scripts/pipeline/infer.py` and wired into `convert_enquesta.py` main() (`infer.high_cardinality_columns` / `infer.format_high_cardinality_report` grep-confirmed at lines 259-260). Confirmed live: re-running against real REO1167 export printed `LLENGUA_PRIMERA_ALTRES_LITERALS: 38 valors distints (> 20)` etc. and `Columnes exemptes via --include-columns: cap.` |
| 6 | The pipeline gracefully handles real-world format quirks (wide-export `low_memory` pandas bug, non-quote-aware delimiter sniffing, dead duplicate-header detection, unvalidated `--date`, non-atomic writes) without weakening any v1.0 detection rule (PUB-05) | ✓ VERIFIED | All 6 fixes (CR-01, CR-02, CR-03, WR-01 through WR-06) confirmed present in current HEAD via direct code read: `format_shape_report` no longer dumps `df.head/tail` (load.py:225-244); `--list-columns` no longer prints `mostres=` (convert_enquesta.py:168-192); README documents `--skip-privacy-review` and corrected safety claim; `compute_upserted_index`/`validate_index` wrapped in try/except for corrupted JSON; `verify_publicacio.py` flags missing `meta.fields` as failure; `_detect_csv_delimiter` uses `csv.Sniffer` (quote-aware); `_read_raw_header_tokens` added for pre-pandas duplicate detection; `--date` validated via `datetime.strptime`; `schema.write_json` + Parquet write now use temp-file + `os.replace()`. All are pinned by named regression tests in the 71-test suite. |
| 7 | No unapproved real respondent data exists anywhere under `public/data/` or `scripts/fixtures/` outside the approved publication | ✓ VERIFIED | `git status --porcelain public/data/ scripts/fixtures/` clean at verification time (no drift since 04-03's commits). `public/data/enquestes/` contains exactly the expected 8 files (2 per survey x 4 surveys). No files under `scripts/fixtures/` reference real export content — regression tests build synthetic data inline or via `TemporaryDirectory()`. |
| 8 | Full requirements coverage: PUB-01, PUB-02, PUB-05 all traced to Phase 4 plans with no orphans | ✓ VERIFIED | `PUB-01`/`PUB-05` declared in 04-01-PLAN.md and 04-02-PLAN.md frontmatter; `PUB-01`/`PUB-02` declared in 04-03-PLAN.md frontmatter. REQUIREMENTS.md traceability table maps exactly PUB-01, PUB-02, PUB-05 to Phase 4 (PUB-03/PUB-04 correctly deferred to Phase 5). No orphaned requirement IDs for Phase 4. |
| 9 | The site builds and passes its automated preview/asset gates against the published real data | ✓ VERIFIED | Re-ran directly during this verification: `npm run build` (exit 0, tsc + vite build succeed), `npm run verify:pages` (exit 0, "verify:pages — all checks passed"), `npm run verify:explorer` (exit 0, "4 DuckDB assets verified"). |

**Score:** 9/9 must-haves verified (8 directly verified, 1 via accepted override)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/pipeline/infer.py` | `MAX_DISTINCT_VALUES`, `is_high_cardinality_column`, `high_cardinality_columns`, `format_high_cardinality_report` | ✓ VERIFIED | All 4 symbols present; wired into `convert_enquesta.py`; covered by `IsHighCardinalityColumnTests`/`HighCardinalityColumnsTests`/`FormatHighCardinalityReportTests`. |
| `scripts/convert_enquesta.py` | `--max-cardinality`, `--include-columns`, optional `--columns`, `--skip-privacy-review`, D-04 exclusion report, review-fix hardening | ✓ VERIFIED | All flags present via `--help` and source read; call sites wired; post-review-fix hardening (date validation, JSON error handling, atomic writes) present. |
| `scripts/pipeline/load.py` | Reactive format/encoding fixes for real exports, no raw-cell-value printing | ✓ VERIFIED | `low_memory=False` forced unconditionally; `format_shape_report` prints column-level stats only (no head/tail dump, per CR-01 fix); `csv.Sniffer`-based quote-aware delimiter detection (WR-03); raw-header duplicate detection (WR-04). |
| `scripts/pipeline_selftest.py` | Regression coverage for every fix | ✓ VERIFIED | 71 tests, 0 failures, includes all named test classes for D-01–D-04, the `low_memory` bug, `--skip-privacy-review`, `verify_publicacio.py`, and all 6 review-fix issues. |
| `scripts/verify_publicacio.py` | Standalone publication integrity checker reusing `schema.validate_index`/`validate_meta` | ✓ VERIFIED | File exists, `--data-dir`/`--expect-ids` flags present, reuses `schema.validate_index`/`validate_meta` (grep-confirmed), exits 0 against real `public/data/` reporting all 4 surveys, exits 1 on synthetic duplicate/mismatch/orphan/missing/expect-ids-mismatch cases (spot-checked live during this verification). |
| `public/data/enquestes_index.json` | One correct entry per real survey + untouched `mostra-sintetica` entry | ✓ VERIFIED | 4 entries present, values match 04-02-SUMMARY.md's operator-supplied metadata character-for-character, `mostra-sintetica` unchanged. |
| `scripts/README.md` | Documents cardinality cutoff, `--skip-privacy-review`, `verify_publicacio.py`, corrected privacy safety claim | ✓ VERIFIED | All sections present via grep; safety claim corrected per CR-03 fix. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `scripts/convert_enquesta.py` | `scripts/pipeline/infer.py` | `main()` calls `infer.high_cardinality_columns` / `infer.format_high_cardinality_report` | ✓ WIRED | Grep-confirmed at convert_enquesta.py:259-260; live-exercised in this verification's direct re-run. |
| `scripts/convert_enquesta.py` | `scripts/pipeline/load.py` | `main()` step 2 calls `load_mod.load_table` | ✓ WIRED | Grep-confirmed at convert_enquesta.py:154; exercised live against all three real exports during this verification. |
| `scripts/verify_publicacio.py` | `scripts/pipeline/schema.py` | reuses `validate_index`/`validate_meta` | ✓ WIRED | Grep-confirmed at verify_publicacio.py:99,167. |
| `public/data/enquestes_index.json` | `public/data/enquestes/` | each entry id resolves to its two artifact files | ✓ WIRED | Confirmed via live `verify_publicacio.py` run against real `public/data/` (exit 0, no orphan/missing findings). |

### Data-Flow Trace (Level 4)

Not applicable in the frontend-rendering sense (this phase is a Python CLI pipeline, not a UI component). The equivalent data-flow check — that published Parquet row counts and column names actually originate from the real export files rather than a static/mock source — was directly verified by re-running the converter against the operator's real Downloads files and diffing outputs against both `public/data/` and 04-02-SUMMARY.md's recorded figures (all matched exactly).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Real export conversion completes without crash | `uv run scripts/convert_enquesta.py <REO1167 real file> ... --skip-privacy-review` | exit 0, artifacts written | ✓ PASS |
| Real export conversion completes without crash (large 291-col file) | `uv run scripts/convert_enquesta.py <REO1151 real file> ... --skip-privacy-review` | exit 0, artifacts written | ✓ PASS |
| Real export conversion completes without crash | `uv run scripts/convert_enquesta.py <REO1145 real file> ... --skip-privacy-review` | exit 0, artifacts written | ✓ PASS |
| Full regression suite passes | `uv run scripts/pipeline_selftest.py -v` | "Ran 71 tests ... OK" | ✓ PASS |
| Publication integrity check passes on real data | `uv run scripts/verify_publicacio.py` | exit 0, "4 enquestes verificades" | ✓ PASS |
| Publication verifier fails on synthetic defects | `uv run scripts/pipeline_selftest.py -v VerifyPublicacioTests` (part of full suite) | duplicate-id/mismatch/orphan cases all correctly rejected | ✓ PASS |
| Site build succeeds | `npm run build` | exit 0 | ✓ PASS |
| Pages preview gate passes | `npm run verify:pages` | exit 0, "all checks passed" | ✓ PASS |
| Explorer asset gate passes | `npm run verify:explorer` | exit 0, "4 DuckDB assets verified" | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` convention used in this repository; no probes declared in any Phase 4 PLAN/SUMMARY. Skipped — not applicable.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PUB-01 | 04-01, 04-02, 04-03 | Each real survey converts correctly and passes privacy review before publishing | ✓ SATISFIED (override on the privacy-review-shape) | Conversion correctness independently re-verified; privacy resolution satisfied via authorized skip-decision override (see Truth #2). |
| PUB-02 | 04-03 | All approved real surveys published to `public/data/` with correct index entries | ✓ SATISFIED | Verified directly via `verify_publicacio.py` and manual index inspection. |
| PUB-05 | 04-01, 04-02 | Real export format/structure incompatibilities detected and corrected without breaking v1.0 behaviour | ✓ SATISFIED | All fixes (cardinality auto-selection, `low_memory`, delimiter sniffing, duplicate-header detection) confirmed present and regression-tested; pre-existing v1.0 tests confirmed still passing. |

No orphaned requirements found for Phase 4 (REQUIREMENTS.md traceability table maps exactly PUB-01/02/05 to Phase 4).

### Anti-Patterns Found

None. Scanned all phase-touched files (`scripts/pipeline/infer.py`, `scripts/convert_enquesta.py`, `scripts/pipeline_selftest.py`, `scripts/README.md`, `scripts/pipeline/load.py`, `scripts/verify_publicacio.py`, `scripts/pipeline/schema.py`) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`, placeholder-language, empty-implementation and hardcoded-empty-data patterns. No blockers or warnings found; the one `XXXX` grep hit is a docstring reference to Unicode escape notation (`\uXXXX`), not a debt marker.

### Human Verification Required

### 1. Homepage card rendering for each published survey

**Test:** Open the local preview with `npm run preview:pages` and confirm, for each published survey card (REO1167, REO1151, REO1145, mostra-sintetica), that the title, date, description and participant count are the ones intended for that survey, and that no card shows another survey's details.
**Expected:** Each card's displayed metadata matches the operator-supplied values, no cross-survey mixups.
**Why human:** 04-03-PLAN.md's Task 3 specifies this as an explicit `<human-check>`; 04-03-SUMMARY.md states it was not performed during the autonomous continuation. The underlying JSON data was independently confirmed correct by this verifier, but visual rendering correctness requires a human look.

### 2. Surviving column set matches operator expectations per survey

**Test:** For each of the three real surveys, review the recorded row count and surviving column list (04-02-SUMMARY.md's per-survey tables: REO1167 283 cols, REO1151 291 cols, REO1145 263 cols) and confirm no column the operator considers essential was dropped by the free-text exclusion or the cardinality cutoff.
**Expected:** Operator confirms the auto-selected column set is acceptable for publication.
**Why human:** 04-02-PLAN.md's Task 2 specifies this as an explicit `<human-check>`; the SUMMARY does not clearly record this specific confirmation separately from the privacy-skip decision. Judging whether a given dropped column is "essential" is a domain judgment about the operator's own survey content.

### Gaps Summary

No blocking gaps. All roadmap success criteria and plan-level must-haves are verified against the current (post-code-review-fix) codebase state, either directly or through an explicitly authorized, traceable, well-documented override for the privacy-checklist resolution shape. Two `<human-check>` items specified in the PLAN.md files were not confirmed as completed in the SUMMARYs and are carried forward here for the operator's end-of-phase review; neither blocks the phase goal being technically achieved, since the underlying data was independently verified correct by this verifier.

---

_Verified: 2026-08-30T17:13:31Z_
_Verifier: Claude (gsd-verifier)_
