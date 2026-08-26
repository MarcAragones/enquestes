---
phase: 02-offline-data-pipeline
reviewed: 2026-08-26T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - .gitignore
  - public/data/enquestes/mostra-sintetica_meta.json
  - public/data/enquestes_index.json
  - scripts/README.md
  - scripts/convert_enquesta.py
  - scripts/fixtures/raw/mostra-privacitat.csv
  - scripts/fixtures/raw/mostra-tracer.csv
  - scripts/generate_mock_parquet.py
  - scripts/pipeline/__init__.py
  - scripts/pipeline/index.py
  - scripts/pipeline/infer.py
  - scripts/pipeline/load.py
  - scripts/pipeline/privacy.py
  - scripts/pipeline/schema.py
  - scripts/pipeline_selftest.py
findings:
  critical: 3
  warning: 7
  info: 1
  total: 11
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-08-26
**Depth:** standard
**Files Reviewed:** 15 (`public/data/enquestes/mostra-sintetica_respostes.parquet` noted as present/generated binary per instructions, not reviewed as text)
**Status:** issues_found

## Summary

This is the project's first Python code: an offline, `uv run`-only pipeline converting raw survey exports into the Parquet/JSON contract the React app already consumes. The module boundaries are clean (`schema` / `infer` / `load` / `privacy` / `index`), the privacy checklist is a genuine three-heuristic aggregator (not a placeholder), and the `_is_finite_number`/`validate_meta`/`validate_index` functions are a faithful line-for-line mirror of `src/lib/enquestes.ts`'s parsers.

However, three empirically-reproduced defects undermine the pipeline's core safety claim — that writes to `public/data/` (documented in `scripts/README.md` as an "irreversible publication") are gated by validation. All three were confirmed by actually running the scripts against this checkout, not just by reading the source:

1. An allow-list that reduces to zero columns (e.g. `--columns` naming only free-text columns, which D-02 then drops) silently produces a `meta.json`/`enquestes_index.json` claiming `n=24` rows next to a Parquet file that actually contains **0** rows — and all three files are left on disk even though the script's own internal consistency check catches the mismatch and exits 1.
2. A corrupted/malformed *existing* `enquestes_index.json` sibling entry gets rewritten to disk (as part of the same-file, whole-array upsert) before `schema.validate_index()` ever runs against it — confirmed by seeding a bad `"n": "not-a-number"` entry and watching it survive on disk after a crash.
3. Passing a duplicated column name in `--columns` (e.g. `--columns "segment,segment"`, an easy copy-paste mistake) crashes with a raw pandas `TypeError` traceback instead of the clean `ERROR: ...` messaging used everywhere else.

None of these are exploitable by an external attacker (this is a local-only CLI run by a trusted developer), but they are real data-integrity and UX defects that will produce broken or partially-written artifacts under realistic operator mistakes — exactly the class of bug DATA-03's "block by default" design intends to prevent.

## Critical Issues

### CR-01: Empty-allow-list edge case publishes an inconsistent meta.json/index.json/Parquet trio

**File:** `scripts/convert_enquesta.py:143-224`

**Issue:** If `--columns` resolves to columns that are *all* dropped as free text by D-02 (`scripts/convert_enquesta.py:145-151`), the DataFrame passed downstream has 0 columns but still `len(df)` rows (pandas preserves row count independent of column count). `n = len(df)` (line 184) is then baked into `meta.json` and `enquestes_index.json` as if real data existed, and both files are written (lines 206-210) **before** the round-trip Parquet check (lines 212-224) discovers that a 0-column DataFrame serializes to a Parquet file with **0 actual rows**. Reproduced directly:

```
$ uv run scripts/convert_enquesta.py scripts/fixtures/raw/mostra-tracer.csv \
    --id empty-cols --columns "comentari_lliure" --title T --description D \
    --out-dir /tmp/out --confirm-privacy-review
...
ERROR intern: files del parquet (0) no coincideixen amb n (24)
$ echo $?
1
$ cat /tmp/out/enquestes/empty-cols_meta.json
{ "id": "empty-cols", ..., "n": 24, "kpis": [], "fields": [] }
$ cat /tmp/out/enquestes_index.json
[ { "id": "empty-cols", ..., "n": 24 } ]
```

The process exits 1 (an "internal error"), yet `meta.json`, `enquestes_index.json`, and the (broken, 0-row) Parquet file are all left committed to the working tree, ready to be picked up by a subsequent `git add`/deploy. This is precisely the "irreversible publication" scenario `scripts/README.md` warns about, reached via a plausible operator mistake (choosing an allow-list that happens to be all free-text columns).

**Fix:** Guard against zero remaining columns immediately after the D-02 drop, before any output path work continues, and make the round-trip checks run before any file lands on disk (see CR-02 for the general pattern):

```python
df = df.drop(columns=dropped_free_text)
if df.shape[1] == 0:
    print(
        "ERROR: cap columna sobreviu després de descartar les de text lliure "
        "(D-02); tria un --columns amb almenys una columna no-text-lliure.",
        file=sys.stderr,
    )
    return 1
```

### CR-02: `enquestes_index.json` is validated *after* it has already been overwritten on disk

**File:** `scripts/pipeline/index.py:16-32`, `scripts/convert_enquesta.py:205-210`, `scripts/generate_mock_parquet.py:138-142`

**Issue:** `index_mod.upsert_index_entry()` loads the *entire* existing array, computes the new array, and **writes it to disk internally** (`schema.write_json(index_path, existing)` at `pipeline/index.py:31`) before returning. Both call sites then call `schema.validate_index(new_index)` **after** that write has already happened:

```python
new_index = index_mod.upsert_index_entry(index_path, index_entry)  # writes to disk here
schema.validate_index(new_index)                                    # too late — already persisted
```

This is the opposite of the pattern used for `meta.json`, where `schema.validate_meta(meta)` correctly runs *before* any write (`convert_enquesta.py:203-207`). Reproduced by seeding a malformed existing index (`"n": "not-a-number"` on a sibling entry) and running a normal conversion:

```
$ echo '[{"id":"bad","title":"T","date":"2026-01-01","description":"D","n":"not-a-number"}]' \
    > /tmp/out/enquestes_index.json
$ uv run scripts/convert_enquesta.py scripts/fixtures/raw/mostra-tracer.csv \
    --id new-survey --columns "segment" --title T --description D \
    --out-dir /tmp/out --confirm-privacy-review
...
pipeline.schema.SchemaError: 'n' must be a finite number
$ echo $?
1
$ cat /tmp/out/enquestes_index.json
[ {"id":"bad", ..., "n": "not-a-number"}, {"id":"new-survey", ..., "n": 24} ]
```

The process crashes (uncaught `SchemaError`, exit 1), but `enquestes_index.json` — the single shared file every survey's catalog entry lives in — has already been rewritten and now permanently contains the invalid sibling entry, indistinguishable from a "successful" partial write. Because this file is described as never rebuilt "from anything but the loaded array" (module docstring), any future run that loads this file inherits the corruption.

**Fix:** Split the upsert into a pure compute step and an explicit write step, and validate strictly between them, mirroring the `meta.json` pattern:

```python
# pipeline/index.py
def compute_upserted_index(index_path: Path, new_entry: dict) -> list:
    existing = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else []
    ...
    return existing  # no write here

# convert_enquesta.py / generate_mock_parquet.py
new_index = index_mod.compute_upserted_index(index_path, index_entry)
schema.validate_index(new_index)
schema.write_json(index_path, new_index)
```

### CR-03: Duplicate column names in `--columns` crash with an unhandled `TypeError`

**File:** `scripts/convert_enquesta.py:138-155`, `scripts/pipeline/infer.py:12-22,45-47`

**Issue:** `--columns` values are split and stripped but never checked for duplicates. `df = df[requested_columns].copy()` (line 143) silently produces a DataFrame with a duplicated column label when the same name appears twice. Any subsequent `df[name]` lookup for that label (`infer.build_fields` at `pipeline/infer.py:47`, and `infer.is_free_text_column` calls at `convert_enquesta.py:145`) then returns a 2-column **DataFrame** instead of a Series, and `pd.to_numeric(series, ...)` inside `infer_field_type` raises. Reproduced directly:

```
$ uv run scripts/convert_enquesta.py scripts/fixtures/raw/mostra-tracer.csv \
    --id dup-test --columns "segment,segment" --title T --description D \
    --out-dir /tmp/out --confirm-privacy-review
...
  File ".../pipeline/infer.py", line 19, in infer_field_type
    coerced = pd.to_numeric(series, errors="coerce")
TypeError: arg must be a list, tuple, 1-d array, or Series
$ echo $?
1
```

This is an easy operator mistake (copy-paste error while building `--columns`) that produces a raw pandas stack trace instead of the clean `ERROR: ...` + exit-1 pattern used consistently elsewhere in this script.

**Fix:**

```python
requested_columns = [c.strip() for c in args.columns.split(",") if c.strip()]
missing_columns = [c for c in requested_columns if c not in df.columns]
if missing_columns:
    ...
duplicate_columns = sorted({c for c in requested_columns if requested_columns.count(c) > 1})
if duplicate_columns:
    print(f"ERROR: columnes duplicades a --columns: {', '.join(duplicate_columns)}", file=sys.stderr)
    return 1
```

## Warnings

### WR-01: Non-`ValueError` I/O errors (missing file, permission error) crash with a raw traceback

**File:** `scripts/convert_enquesta.py:108-112`

**Issue:** Only `except ValueError` is caught around `load_mod.load_table(...)`. `pd.read_csv`/`pd.read_excel` raise `FileNotFoundError` (an `OSError` subclass, not `ValueError`) for a missing/unreadable path. Reproduced:

```
$ uv run scripts/convert_enquesta.py /no/such/file.csv --id foo --columns a --title T --description D
...
FileNotFoundError: [Errno 2] No such file or directory: '/no/such/file.csv'
$ echo $?
1
```

The exit code (1) happens to match the documented contract, but the output is an unhandled Python traceback rather than the `ERROR: {exc}` message format the README promises for "CSV il·legible".

**Fix:**
```python
try:
    df, load_warnings = load_mod.load_table(args.input_csv, args.sheet)
except (ValueError, OSError) as exc:
    print(f"ERROR: {exc}", file=sys.stderr)
    return 1
```

### WR-02: `scripts/README.md` documents `--sheet` as unused, but it is consumed

**File:** `scripts/README.md:41`, `scripts/pipeline/load.py:32`

**Issue:** The README's flag table says `--sheet` is "reservat; encara no consumit" (reserved, not yet consumed). This is stale: `load.py:32` already passes it through — `pd.read_excel(path, sheet_name=sheet or 0, engine="openpyxl")`. A developer reading only the README would wrongly assume `--sheet` has no effect on `.xlsx` conversions.

**Fix:** Update the table row to state `--sheet` selects the Excel worksheet by name for `.xlsx` inputs (defaulting to the first sheet), matching the CLI's own `--help` text in `convert_enquesta.py`.

### WR-03: `_resolve_output_paths` is duplicated verbatim between the two entry-point scripts

**File:** `scripts/convert_enquesta.py:77-90`, `scripts/generate_mock_parquet.py:50-63`

**Issue:** Identical function bodies. This isn't just style — it's the reason CR-02's ordering bug exists in both scripts simultaneously; a fix applied to one copy is easy to forget applying to the other.

**Fix:** Move `_resolve_output_paths` (and, per WR-05 below, the small-KPI warning loop) into a shared `pipeline` module (e.g. `pipeline/paths.py`) imported by both scripts.

### WR-04: `enquestes_index.json` on-disk shape is trusted without validation before iteration

**File:** `scripts/pipeline/index.py:16-27`

**Issue:** `upsert_index_entry` assumes `json.loads(index_path.read_text())` returns a list of dicts. If the existing file on disk is malformed (e.g. a JSON object instead of an array, or an array containing a non-dict element — plausible after manual editing or a bug elsewhere), `entry.get("id")` on line 24 raises an unhandled `AttributeError`/`TypeError` rather than a clear diagnostic.

**Fix:**
```python
if not isinstance(existing, list) or not all(isinstance(e, dict) for e in existing):
    raise schema.SchemaError(f"'{index_path}' existent no és un array d'objectes vàlid")
```

### WR-05: `generate_mock_parquet.py` skips the small-sample KPI warning that `convert_enquesta.py` prints

**File:** `scripts/generate_mock_parquet.py:110-113` vs `scripts/convert_enquesta.py:174-182`

**Issue:** `convert_enquesta.py` warns to stderr when a built KPI's `n` falls below `schema.MIN_KPI_SAMPLE`. `generate_mock_parquet.py` builds KPIs via the same `infer.build_kpis` but never runs the equivalent check, so `--n` values small enough to produce a low-sample KPI (e.g. `--n 5`) silently skip the warning the sibling script would print for the same data shape.

**Fix:** Factor the warning loop into a shared helper (e.g. `infer.warn_small_sample_kpis(kpis)`) and call it from both scripts.

### WR-06: No automated test coverage for `is_valid_enquesta_id` or the `run_privacy_checklist` aggregator

**File:** `scripts/pipeline_selftest.py` (whole file), `scripts/pipeline/schema.py:23-25`, `scripts/pipeline/privacy.py:201-216`

**Issue:** `is_valid_enquesta_id` is the trust-boundary function gating every output path composed from `--id` (mirroring the client-side `isValidEnquestaId`), yet `pipeline_selftest.py` has no test class for it — no regression coverage asserting rejection of a `/`-containing id, an all-dots id, an id over 64 characters, or an empty string. Similarly, `run_privacy_checklist` (the function that actually combines the three heuristics and decides what the CLI gate sees) has no direct test; only its three constituent helpers (`uniqueness_flags`, `name_hint_flags`, `small_group_flags`) are tested in isolation.

**Fix:** Add `IsValidEnquestaIdTests` (valid: `"a"`, `"a.b-c_1"`; invalid: `""`, `"a/b"`, `"." * 65`, `"a" * 65`) and a `RunPrivacyChecklistTests` class asserting the aggregator's `(findings, unevaluated)` tuple shape and that an unevaluated column never contributes a false "clear" result.

### WR-07: `scripts/fixtures/raw/mostra-privacitat.csv` is unused by any automated test

**File:** `scripts/fixtures/raw/mostra-privacitat.csv`, `scripts/pipeline_selftest.py`

**Issue:** This fixture (per the phase's own planning summary) was built specifically to exercise the name-hint and small-group privacy heuristics together, but `pipeline_selftest.py` never loads it — it's referenced only in manual verification transcripts under `.planning/`. The equivalent scenarios are covered by inline DataFrames in `SmallGroupFlagsTests`/`NameHintFlagsTests`, so the CSV file currently provides no regression protection tied to its specific column shapes.

**Fix:** Either wire an integration-style test (e.g. via `subprocess` invoking `convert_enquesta.py` against this fixture and asserting exit code 2) into `pipeline_selftest.py`, or remove the fixture if the inline unit tests are considered sufficient.

## Info

### IN-01: `ENQUESTA_ID_PATTERN` permits ids composed entirely of dots

**File:** `scripts/pipeline/schema.py:14-15`

**Issue:** `[A-Za-z0-9._-]{1,64}` accepts `"."` or `".."` as a fully valid `--id`. Because the id is always embedded as a filename prefix (`f"{survey_id}_respostes.parquet"`), this cannot escape the output directory (no path traversal), but it does produce a hidden-file-style artifact name (e.g. `._respostes.parquet`) that's easy to mistake for an accident.

**Fix (optional, low priority):** Require at least one alphanumeric character, e.g. `r"(?=.*[A-Za-z0-9])[A-Za-z0-9._-]{1,64}"`, and keep it in sync with `src/lib/enquestes.ts`'s `isValidEnquestaId` if changed.

---

_Reviewed: 2026-08-26_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
