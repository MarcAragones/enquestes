---
phase: 04-real-survey-conversion-publication
fixed_at: 2026-08-30T19:10:00Z
review_path: .planning/phases/04-real-survey-conversion-publication/04-REVIEW.md
iteration: 1
findings_in_scope: 9
fixed: 9
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-08-30T19:10:00Z
**Source review:** .planning/phases/04-real-survey-conversion-publication/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 9 (CR-01, CR-02, CR-03, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06)
- Fixed: 9
- Skipped: 0

IN-01 was excluded per `fix_scope: critical_warning`.

`uv run scripts/pipeline_selftest.py -v` was run after every fix and exits 0
(71 tests, all passing — 68 pre-existing + 3 new regression tests added
during this fix pass).

## Fixed Issues

### CR-01: Raw respondent rows are printed unconditionally on every conversion, before any privacy screening

**Files modified:** `scripts/pipeline/load.py`
**Commit:** `ccb985f`
**Applied fix:** `format_shape_report()` no longer appends `df.head(3)`/`df.tail(3)` raw row dumps. It now prints only column-level statistics (row count, column names/dtypes, warnings) — matching the no-sample-values discipline already established by `format_high_cardinality_report` in `pipeline/infer.py`. No test in `pipeline_selftest.py` asserted on the removed head/tail content, so no test updates were needed.

### CR-02: `--list-columns` prints raw per-column sample values before any privacy screening

**Files modified:** `scripts/convert_enquesta.py`
**Commit:** `2d6aac6`
**Applied fix:** Removed the `mostres=` field (up to 3 real distinct values per column) from the `--list-columns` inspection output. The printed line now reports dtype, non-null count, distinct count, uniqueness ratio, and cardinality marker only. No existing test asserted on the removed `mostres=` content.

### CR-03: README makes a false safety claim about the privacy checklist; `--skip-privacy-review` is undocumented

**Files modified:** `scripts/README.md`
**Commit:** `78f959b`
**Applied fix:** Added `--skip-privacy-review` to the flags table and amended the privacy-section safety claim to acknowledge the explicit, operator-invoked exception, using the exact wording proposed in the review.

### WR-01: Corrupted or malformed `enquestes_index.json` crashes with a raw traceback instead of a clean error

**Files modified:** `scripts/convert_enquesta.py`
**Commit:** `51fe4e3`
**Applied fix:** Wrapped `compute_upserted_index()`/`validate_index()` in a `try/except (json.JSONDecodeError, schema.SchemaError)` that prints an `ERROR: ...` message to stderr and returns exit code 1, matching the pattern used everywhere else in the script. Added the missing `import json`.

### WR-02: `verify_publicacio.py` silently skips the fields<->parquet check when `meta.fields` is absent

**Files modified:** `scripts/verify_publicacio.py`
**Commit:** `103fba5`
**Applied fix:** The fields<->parquet consistency check now records a failure (`"meta.fields és absent o no és una llista"`) when `meta.fields` is missing or not a list, instead of silently doing nothing. Verified no existing test relies on the previous silent-skip behavior (all existing fixtures always write `fields`).

### WR-03: CSV delimiter sniffing is not quote-aware, so a quoted comma can cause the wrong delimiter to be chosen silently

**Files modified:** `scripts/pipeline/load.py`
**Commit:** `4c31704`
**Applied fix:** `_detect_csv_delimiter` now uses `csv.Sniffer().sniff(header_line, delimiters=",;")` (quote-aware) instead of a raw `header_line.count(",")`/`count(";")`, falling back to the previous raw-count heuristic only when the sniffer can't determine a dialect at all (e.g. a single-column header). Verified against all three existing delimiter-detection tests (semicolon-detected, comma-with-quoted-semicolon, tied-defaults-to-comma) plus manually confirmed the exact quoted-header scenario from the review (`"Q1: valora, en general, el servei";Q2`) now correctly resolves to `;`.

### WR-04: Duplicate-column-name detection in `_shape_warnings` is effectively dead code

**Files modified:** `scripts/pipeline/load.py`, `scripts/pipeline_selftest.py`
**Commit:** `ef595a0`
**Applied fix:** Added `_read_raw_header_tokens()` which quote-aware-splits the raw CSV/TSV header line (already read once for delimiter sniffing) before pandas auto-mangles duplicate names. `_shape_warnings()` now scans these raw tokens for duplicates when available (CSV/TSV), falling back to the previous `df.columns`-based check only for `.xlsx` (unchanged, still effectively unreachable there, but no regression — out of scope for this pass per the review's own CSV/TSV-focused example). Added a new regression test (`test_truly_duplicated_raw_header_is_detected`) proving a genuinely duplicated raw header (`Q1,Q1,Q2`) is now caught even though pandas renames it to `Q1`/`Q1.1` in `df.columns`.

### WR-05: `--date` is never validated as a real date

**Files modified:** `scripts/convert_enquesta.py`, `scripts/pipeline_selftest.py`
**Commit:** `067fcbf`
**Applied fix:** Adapted the review's suggested regex fix to a stricter `datetime.strptime(args.date, "%Y-%m-%d")` validation, since a `^\d{4}-\d{2}-\d{2}$` regex (as literally proposed) would not reject the review's own motivating example (`2026-13-40`, an invalid month/day) — only `strptime` catches genuinely invalid dates, not just malformed shape. Invalid dates now fail via `parser.error()` (exit code 2). Added a regression test (`test_invalid_date_value_is_rejected_before_any_work`) using the exact `2026-13-40` example from the review.

### WR-06: Non-atomic writes of parquet/meta/index artifacts

**Files modified:** `scripts/pipeline/schema.py`, `scripts/convert_enquesta.py`
**Commit:** `9674f66`
**Applied fix:** `schema.write_json()` (used for both `meta.json` and `enquestes_index.json`, and also by `generate_mock_parquet.py`) now writes to a `.tmp` sibling file and `os.replace()`s it onto the final path. The Parquet write in `convert_enquesta.py` mirrors the same pattern (`df.to_parquet()` to a `.tmp` path, then `os.replace()`). Manually verified with a real end-to-end conversion (`scripts/fixtures/raw/mostra-tracer.csv`) that no `.tmp` files are left behind and all three artifacts are written correctly.

## Skipped Issues

None — all 9 in-scope findings were fixed.

---

_Fixed: 2026-08-30T19:10:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
