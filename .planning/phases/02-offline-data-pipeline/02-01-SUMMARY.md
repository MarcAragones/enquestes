---
phase: 02-offline-data-pipeline
plan: 01
subsystem: data-pipeline
tags: [python, uv, pep723, pandas, pyarrow, parquet, privacy]

requires: []
provides:
  - "scripts/pipeline/schema.py — TypedDict mirror of src/types/enquesta.ts plus write-time structural validators (validate_meta, validate_index)"
  - "scripts/pipeline/infer.py — D-03 dimension/measure inference and D-02 free-text detection"
  - "scripts/pipeline/index.py — enquestes_index.json match-by-id upsert"
  - "scripts/pipeline/privacy.py — DATA-03 privacy checklist aggregator (uniqueness_flags today; extensible for plan 02-02)"
  - "scripts/convert_enquesta.py — DATA-01 CLI: raw CSV to the three published artifacts, privacy-gated"
  - "scripts/pipeline_selftest.py — 24-case stdlib unittest suite over the pure-logic modules"
affects: [02-02, 02-03]

actuals:
  tokens: 7823
  tasks: 2
  commits: 2

tech-stack:
  added: ["uv (PEP 723 script runner)", "pandas 3.0.5", "pyarrow 25.0.1", "openpyxl 3.1.5 (declared, unused until plan 02-02's .xlsx branch)"]
  patterns:
    - "PEP 723 inline script metadata (# /// script) — no venv, no requirements.txt, invoked only via `uv run`"
    - "Block-by-default privacy gate: run_privacy_checklist always prints, exits 2 on unconfirmed findings, writes nothing until the gate passes"
    - "Structural validation runs in-process before any file write touches disk (validate_meta/validate_index)"
    - "Write-then-read-back Parquet integrity check at the end of the CLI run"

key-files:
  created:
    - scripts/pipeline/__init__.py
    - scripts/pipeline/schema.py
    - scripts/pipeline/infer.py
    - scripts/pipeline/index.py
    - scripts/pipeline/privacy.py
    - scripts/convert_enquesta.py
    - scripts/pipeline_selftest.py
    - scripts/fixtures/raw/mostra-tracer.csv
  modified:
    - .gitignore

key-decisions:
  - "pandas 3.0.5 defaults text columns to its StringDtype backend, not the legacy `object` dtype — is_free_text_column uses pd.api.types.is_string_dtype instead of `series.dtype == object`, or every real CSV text column would silently never match on this pandas version (found and fixed during Task 1 verification, Rule 1)"
  - "Added __pycache__/*.pyc to .gitignore — first Python code in this repo, uv run generates a __pycache__ directory that must not be committed (Rule 2)"

patterns-established:
  - "scripts/pipeline/ shared-helper modules imported by both the CLI and the self-test, both resolving `import pipeline.X` because they live alongside pipeline/ under scripts/"
  - "Every pipeline script opens with a PEP 723 header; scripts/pipeline/*.py (imported, never run directly) intentionally carry none"

requirements-completed: [DATA-01, DATA-03]

coverage:
  - id: D1
    description: "Raw CSV export converts end-to-end into <id>_respostes.parquet, <id>_meta.json, and an upserted enquestes_index.json entry"
    requirement: DATA-01
    verification:
      - kind: integration
        ref: "manual uv run scripts/convert_enquesta.py ... --confirm-privacy-review against scripts/fixtures/raw/mostra-tracer.csv, verified this session"
        status: pass
    human_judgment: false
  - id: D2
    description: "Privacy checklist always prints and blocks writes by default when findings exist, requiring --confirm-privacy-review to proceed"
    requirement: DATA-03
    verification:
      - kind: integration
        ref: "manual uv run scripts/convert_enquesta.py ... --columns id_resposta,segment (no --confirm-privacy-review), verified exit 2 and no files written"
        status: pass
    human_judgment: false
  - id: D3
    description: "Free-text columns are dropped unconditionally even when named in --columns, with no override flag (D-02)"
    verification:
      - kind: integration
        ref: "manual uv run scripts/convert_enquesta.py ... --columns satisfaccio,segment,comentari_lliure --confirm-privacy-review, verified parquet columns are exactly satisfaccio,segment"
        status: pass
    human_judgment: false
  - id: D4
    description: "Index upsert replaces the matching id in place and leaves sibling entries untouched"
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#UpsertIndexEntryTests.test_replacing_existing_id_leaves_siblings_untouched"
        status: pass
      - kind: integration
        ref: "manual: converted mostra-tracer then mostra-tracer-2 into the same --out-dir, verified both entries present"
        status: pass
    human_judgment: false
  - id: D5
    description: "Pure-logic modules (schema, infer, index, privacy) covered by a green self-test suite"
    verification:
      - kind: unit
        ref: "uv run scripts/pipeline_selftest.py -v — 24 tests, 0 failures"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-08-26
status: complete
---

# Phase 2 Plan 1: Offline Data Pipeline — Tracer Summary

**End-to-end raw CSV to published artifacts conversion (`convert_enquesta.py`) with a block-by-default DATA-03 privacy checklist, D-02 free-text exclusion, D-03 type inference, and a 24-case self-test suite over the pure-logic modules.**

## Performance

- **Duration:** ~45 min
- **Completed:** 2026-08-26T12:06:50Z
- **Tasks:** 2
- **Files modified:** 9 (8 created, 1 modified — `.gitignore`)

## Accomplishments

- One working end-to-end path: `uv run scripts/convert_enquesta.py <csv> --id <id> --columns <allow-list> --title <t> --description <d> [--confirm-privacy-review]` writes `<id>_respostes.parquet`, `<id>_meta.json`, and upserts `enquestes_index.json`.
- DATA-03 privacy checklist runs on every real-data invocation, always prints a report (including a "cap indici detectat" line when clean), and blocks all writes by default when it finds a near-unique column — requires `--confirm-privacy-review` to proceed.
- D-02 free-text exclusion is a hard default: a column detected as free text (mean string length > 60, or near-unique text averaging >25 chars) is dropped even when explicitly named in `--columns`, with no flag to re-admit it.
- D-03 field-type inference implemented literally: numeric coerces cleanly → `measure`, everything else → `dimension`, with no cardinality-based override (verified against a synthetic 5-point Likert integer series).
- `--id` is validated against `^[A-Za-z0-9._-]{1,64}$` before any output path is composed; output paths are additionally asserted to stay inside the resolved `--out-dir`.
- `enquestes_index.json` upsert matches by `id` and replaces in place, never rebuilding the file from anything but the loaded array — proven both by manual two-id conversion and by a dedicated self-test.
- 24-case `scripts/pipeline_selftest.py` (stdlib `unittest`, PEP 723) covers upsert idempotency, UTF-8 JSON round-trip, both structural validators against the golden fixtures and their documented rejection conditions, D-03 inference, D-02 detection, KPI sample sizes, and the uniqueness heuristic.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "convert one raw export into three published artifacts"** — `0987dc2` (feat)
2. **Task 2: Prove index upsert and write-time validation under a runnable self-test** — `02b4e03` (test)

## Files Created/Modified

- `scripts/pipeline/__init__.py` — empty package marker
- `scripts/pipeline/schema.py` — TypedDict mirror of `src/types/enquesta.ts`; `SchemaError`, `validate_meta`, `validate_index`, `write_json`, `is_valid_enquesta_id`, `ENQUESTA_ID_PATTERN`, `MIN_KPI_SAMPLE`
- `scripts/pipeline/infer.py` — `infer_field_type`, `is_free_text_column`, `build_fields`, `build_kpis`, `FREE_TEXT_MEAN_LENGTH`
- `scripts/pipeline/index.py` — `upsert_index_entry`
- `scripts/pipeline/privacy.py` — `Finding`, `uniqueness_flags`, `run_privacy_checklist`, `format_checklist_report`, `UNIQUENESS_RATIO_THRESHOLD`, `MIN_GROUP_SIZE`
- `scripts/convert_enquesta.py` — DATA-01 CLI entry point
- `scripts/pipeline_selftest.py` — self-test suite
- `scripts/fixtures/raw/mostra-tracer.csv` — 24-row never-deployed raw fixture
- `.gitignore` — added `__pycache__/`, `*.pyc`

## Interface contracts defined by this plan

Every symbol below is a contract plans 02-02 and 02-03 build directly on.

### `scripts/pipeline/schema.py`
- `ENQUESTA_ID_PATTERN: str` — `r"[A-Za-z0-9._-]{1,64}"`
- `MIN_KPI_SAMPLE: int` — `10`
- `class SchemaError(Exception)`
- `is_valid_enquesta_id(value: str) -> bool`
- `validate_meta(obj: Any) -> None` — raises `SchemaError` on any shape `parseEnquestaMeta` would reject
- `validate_index(obj: Any) -> None` — raises `SchemaError` on any shape `parseEnquestesIndex` would reject
- `write_json(path: Path, obj: Any) -> None` — UTF-8, `ensure_ascii=False`, trailing newline
- `EnquestaIndexEntry`, `EnquestaMetaKpi`, `EnquestaMetaField`, `EnquestaMeta` — `TypedDict`s mirroring the four TS interfaces field-for-field

### `scripts/pipeline/infer.py`
- `FREE_TEXT_MEAN_LENGTH: int` — `60`
- `infer_field_type(series: pd.Series) -> str` — returns `"measure"` or `"dimension"`, D-03's literal rule
- `is_free_text_column(series: pd.Series) -> bool` — D-02 detector; uses `pd.api.types.is_string_dtype`, not `dtype == object` (see Deviations)
- `build_fields(df: pd.DataFrame) -> list[dict]` — one `{"name", "type"}` dict per column
- `build_kpis(df: pd.DataFrame, fields: list[dict]) -> list[dict]` — one `{"label", "value", "n"}` dict per measure column with non-null values

### `scripts/pipeline/index.py`
- `upsert_index_entry(index_path: Path, new_entry: dict) -> list` — loads, replaces-or-appends by `id`, writes back via `schema.write_json`, returns the resulting array

### `scripts/pipeline/privacy.py`
- `UNIQUENESS_RATIO_THRESHOLD: float` — `0.9`
- `MIN_GROUP_SIZE: int` — `5` (reserved; not yet consumed — plan 02-02's small-group scan)
- `@dataclass Finding(kind: str, subject: str, detail: str)`
- `uniqueness_flags(df: pd.DataFrame) -> list[Finding]`
- `run_privacy_checklist(df: pd.DataFrame) -> list[Finding]` — today calls `uniqueness_flags` only; plan 02-02 extends this same aggregator
- `format_checklist_report(findings: list[Finding]) -> str` — always includes a header line; explicit "Cap indici detectat." when empty

### `scripts/convert_enquesta.py`
- CLI flags: `input_csv` (positional), `--id`, `--columns`, `--title`, `--description`, `--date`, `--out-dir`, `--sheet` (accepted, unused until plan 02-02), `--list-columns`, `--confirm-privacy-review`
- Exit codes: `0` success/inspection, `1` usage/input error, `2` unconfirmed privacy findings
- `main(argv: list | None = None) -> int` — importable entry point

## Decisions Made

- **`pd.api.types.is_string_dtype` over `dtype == object` for free-text detection.** pandas 3.0.5 (the version `uv` resolved) defaults CSV text columns to its dedicated `StringDtype` backend rather than the legacy `object` dtype. The plan's literal spec said "an object-dtype column" — implementing it literally silently never matched any real text column on this pandas version, discovered during Task 1's own verification run (a supposedly near-unique free-text column was reported as a privacy finding instead of being dropped). Fixed inline before commit; see Deviations.
- **KPI `label` is the column name, matching the plan's literal instruction** — `build_fields` never sets a `label` key (left for the developer to hand-add later), so `build_kpis` cannot fall back to one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `is_free_text_column` never matched real CSV text columns on pandas 3.0.5**
- **Found during:** Task 1, verification step (D-02 free-text-drop test)
- **Issue:** The plan's literal spec ("an object-dtype column") checked `series.dtype != object`. pandas 3.0.5 defaults string columns to its `StringDtype` backend, not `object` — `comentari_lliure` (24 unique, long Catalan sentences) was never recognized as free text; it survived into the reduced frame and was instead reported as a `near-unique` privacy finding, silently changing D-02's behavior into a DATA-03 block on data that should have been dropped outright.
- **Fix:** Switched the dtype check to `pd.api.types.is_string_dtype(series)`, which correctly matches both the legacy `object` dtype and pandas 3.x's `StringDtype` backend.
- **Files modified:** `scripts/pipeline/infer.py`
- **Verification:** Re-ran the `--columns satisfaccio,segment,comentari_lliure` command; `comentari_lliure` is now printed as dropped, and the resulting Parquet's columns are exactly `satisfaccio, segment`.
- **Committed in:** `0987dc2` (Task 1 commit — fixed before commit, not a follow-up)

**2. [Rule 2 - Missing Critical] Added `__pycache__/`/`*.pyc` to `.gitignore`**
- **Found during:** Task 2, post-commit untracked-file check
- **Issue:** This is the project's first Python code; running the self-test generates `scripts/pipeline/__pycache__/`, which would otherwise sit untracked (or get accidentally committed) forever.
- **Fix:** Added a two-line Python section to `.gitignore`.
- **Files modified:** `.gitignore`
- **Verification:** `git status --short` shows a clean tree with no `__pycache__` entries after the fix.
- **Committed in:** `02b4e03` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 missing critical)
**Impact on plan:** Both fixes were necessary for correctness (D-02's total-exclusion guarantee) and repo hygiene. No scope creep — no functionality was added beyond what the plan specified.

## Known Stubs

None. `--sheet` is accepted but unused (documented in the plan as "reserved for plan 02-02's `.xlsx` branch") — this is a stated future extension point, not a stub blocking this plan's own goal.

## Issues Encountered

None beyond the pandas 3.x dtype deviation documented above.

## User Setup Required

None — `uv` (0.9.16) was already present on this machine; no manual setup needed.

## Next Phase Readiness

- Plan 02-02 (deeper privacy heuristics: name-pattern hints, small-group k-anonymity scan) extends `privacy.run_privacy_checklist`'s existing list-returning signature and can wire the `.xlsx` branch behind the already-accepted `--sheet` flag.
- Plan 02-03 (mock data generator) can reuse `pipeline/schema.py`, `pipeline/infer.py`, and `pipeline/index.py` directly — none of those modules have any real-data-only assumption baked in.
- No blockers.

---
*Phase: 02-offline-data-pipeline*
*Completed: 2026-08-26*
