---
phase: 04-real-survey-conversion-publication
reviewed: 2026-08-30T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - scripts/README.md
  - scripts/convert_enquesta.py
  - scripts/pipeline/infer.py
  - scripts/pipeline/load.py
  - scripts/pipeline_selftest.py
  - scripts/verify_publicacio.py
findings:
  critical: 3
  warning: 6
  info: 1
  total: 10
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-08-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 6
**Status:** issues_found

## Summary

Reviewed the phase-04 offline data pipeline additions: cardinality-based column
auto-selection (D-01, `pipeline/infer.py`), the `low_memory=False` fix for
`pipeline/load.py`, the `--skip-privacy-review` operator bypass in
`convert_enquesta.py`, and the new `verify_publicacio.py` integrity checker.

The `--skip-privacy-review` flag itself is well-scoped: it defaults to
`False`, cannot be inferred from any other flag or environment state, and is
required on every single invocation. However, three **critical** issues were
found, all related to real respondent data being exposed or misrepresented
around the privacy boundary this phase is explicitly supposed to protect:

1. `convert_enquesta.py`'s default run path prints raw respondent rows
   (head/tail, every column, unfiltered) to stdout on *every* conversion,
   before any privacy screening happens.
2. `--list-columns` inspection mode prints up to 3 raw sample values per
   column, again before any privacy screening, directly contradicting the
   no-sample-values discipline the codebase itself establishes and documents
   for the D-01 cardinality report.
3. `scripts/README.md` asserts the privacy checklist can never be skipped
   "without reading the report first" — a claim `--skip-privacy-review`
   (undocumented in the README) now makes false.

Given this project's own established habit of pasting console output
(cardinality/privacy reports) into `SUMMARY.md` files that get committed to
a public repo, these are not theoretical risks.

Several further robustness and code-quality warnings were found in
`load.py`, `verify_publicacio.py`, and `convert_enquesta.py`'s error
handling.

## Critical Issues

### CR-01: Raw respondent rows are printed unconditionally on every conversion, before any privacy screening

**File:** `scripts/pipeline/load.py:187-190` (rendered), called unconditionally from `scripts/convert_enquesta.py:156`

**Issue:** `format_shape_report()` always appends `df.head(3).to_string()` and
`df.tail(3).to_string()` — full rows, every original column, real cell
values — to the report that `convert_enquesta.py` prints at line 156. This
happens for **every** run of the script, before the D-02 free-text drop, the
D-01 cardinality drop, and the privacy checklist have even executed. There is
no flag to suppress it and no redaction.

This directly conflicts with the discipline the same codebase documents and
enforces elsewhere: `pipeline/infer.py`'s `format_high_cardinality_report`
explicitly states its rationale for *never* printing sample/cell values —
"since these are precisely the columns most likely to hold identifying
values and this output is read, pasted, and committed into SUMMARY files."
`format_shape_report` violates that exact principle from the very first line
printed for a real conversion.

**Fix:**
```python
# pipeline/load.py — replace raw row dumps with column-level statistics only
def format_shape_report(df: "pd.DataFrame", warnings: list) -> str:
    lines = ["=== Forma de les dades carregades ==="]
    lines.append(f"Files: {len(df)}")
    lines.append("Columnes:")
    for col in df.columns:
        lines.append(f"  - {col}: {df[col].dtype}")
    # Removed: df.head(3)/df.tail(3).to_string() — never print raw cell
    # values from a real respondent export. If a human sanity check of
    # actual rows is needed, require an explicit, clearly-labelled
    # --show-raw-sample flag that is off by default and warns loudly that
    # its output must never be pasted into a committed file.
    if warnings:
        lines.append("Avisos:")
        for warning in warnings:
            lines.append(f"  ! {warning}")
    return "\n".join(lines)
```

### CR-02: `--list-columns` prints raw per-column sample values before any privacy screening

**File:** `scripts/convert_enquesta.py:175, 181-185`

**Issue:** In `--list-columns` inspection mode:
```python
samples = list(non_null.astype(str).unique()[:3])
...
print(
    f"- {col}: dtype={series.dtype}, no-nuls={len(non_null)}, "
    f"distints={distinct}, ratio-unicitat={ratio:.2f}, mostres={samples}, "
    f"cardinalitat={marker}"
)
```
this prints up to 3 real distinct values from every column — including
columns that will later be flagged as free text (D-02) or near-unique/
quasi-identifier by the privacy checklist (D-03). This mode is explicitly
recommended in `scripts/README.md` step 1 of the "recommended workflow" as
the *first* thing an operator runs against a real export, i.e. before any
privacy review has happened at all.

This is the same category of leak as CR-01, and again contradicts the
no-sample-values precedent set by `format_high_cardinality_report` in the
same module (`pipeline/infer.py`).

**Fix:**
```python
# Drop `samples`/`mostres=` entirely from the --list-columns line, matching
# the column-level-only discipline already used for the D-01 report:
print(
    f"- {col}: dtype={series.dtype}, no-nuls={len(non_null)}, "
    f"distints={distinct}, ratio-unicitat={ratio:.2f}, "
    f"cardinalitat={marker}"
)
```

### CR-03: README makes a false safety claim about the privacy checklist; `--skip-privacy-review` is undocumented

**File:** `scripts/README.md:57-65` (privacy section), `:32-46` (flags table)

**Issue:** The README states:

> Cada execució contra dades reals corre `pipeline.privacy.run_privacy_checklist`, que **sempre imprimeix** el seu informe [...] **No hi ha manera de saltar-se aquest pas sense llegir l'informe primer.**

Both claims ("always runs/prints", "no way to skip without reading the
report first") are now false: `convert_enquesta.py --skip-privacy-review`
(added this phase, lines 85-95 and 282-286) skips the checklist computation
entirely — the report is never computed, let alone printed. The flag itself
is well-scoped (defaults to `False`, requires explicit opt-in every run,
never inferred from other flags), but it is **absent from the README's flags
table** and the privacy section's safety claim was never updated to
acknowledge the exception. A reviewer or future operator reading only the
README would reasonably believe this bypass path doesn't exist.

**Fix:** Add `--skip-privacy-review` to the flags table and correct the
privacy section, e.g.:
```markdown
| `--skip-privacy-review` | no | Omet completament el càlcul del checklist de privacitat (no només el bloqueig); només per a fonts ja anonimitzades i verificades per l'operador. S'ha de passar explícitament a cada execució. |
```
and amend the safety claim:
```markdown
... No hi ha manera de saltar-se aquest pas sense llegir l'informe primer,
**tret que s'invoqui explícitament amb `--skip-privacy-review`** (vegeu la
taula de flags): en aquest cas el checklist ni tan sols es calcula, i és
responsabilitat exclusiva de l'operador haver-ne verificat la font per
endavant.
```

## Warnings

### WR-01: Corrupted or malformed `enquestes_index.json` crashes with a raw traceback instead of a clean error

**File:** `scripts/convert_enquesta.py:334-335`

**Issue:** `index_mod.compute_upserted_index(index_path, index_entry)` reads
and `json.loads()`s an existing `enquestes_index.json` and raises
`schema.SchemaError` if it isn't a list of dicts; a syntactically invalid
JSON file raises `json.JSONDecodeError`. Neither is caught here (only
`load_mod.load_table`'s `ValueError`/`OSError` is caught, at line
147-151). If a previous run left a corrupted index (e.g. an interrupted
write — see WR-06), the next conversion crashes with an unhandled Python
traceback instead of the `ERROR: ...` message pattern used consistently
everywhere else in this script.

**Fix:**
```python
try:
    new_index = index_mod.compute_upserted_index(index_path, index_entry)
    schema.validate_index(new_index)
except (json.JSONDecodeError, schema.SchemaError) as exc:
    print(f"ERROR: {index_path} és invàlid: {exc}", file=sys.stderr)
    return 1
```
(requires `import json` at the top of `convert_enquesta.py`)

### WR-02: `verify_publicacio.py` silently skips the fields\<->parquet check when `meta.fields` is absent

**File:** `scripts/verify_publicacio.py:200-207`

**Issue:**
```python
meta_fields = meta_obj.get("fields")
if isinstance(meta_fields, list):
    meta_field_names = {f.get("name") for f in meta_fields if isinstance(f, dict)}
    if meta_field_names != set(written_names):
        failures.append(...)
```
`schema.validate_meta` treats `fields` as optional (`total=False` /
"if present"), so a `meta.json` lacking the `fields` key entirely passes
schema validation, and this block then silently does nothing — no failure
is recorded for a survey with no way to verify its published column
contract against the Parquet file. `scripts/README.md` documents this
checker as verifying "que el conjunt de noms de `fields` del meta coincideix
amb l'esquema de columnes del Parquet" without qualification, implying this
check always runs. `convert_enquesta.py` always writes `fields`, so in
practice this gap is latent, but the checker's contract as documented and
tested doesn't match its actual behavior for a hand-edited or foreign
`meta.json`.

**Fix:**
```python
meta_fields = meta_obj.get("fields")
if not isinstance(meta_fields, list):
    failures.append((survey_id, "meta.fields és absent o no és una llista"))
else:
    meta_field_names = {f.get("name") for f in meta_fields if isinstance(f, dict)}
    if meta_field_names != set(written_names):
        failures.append(
            (survey_id, "els noms de 'fields' del meta no coincideixen amb les columnes del parquet")
        )
```

### WR-03: CSV delimiter sniffing is not quote-aware, so a quoted comma can cause the wrong delimiter to be chosen silently

**File:** `scripts/pipeline/load.py:57-86`

**Issue:** `_detect_csv_delimiter` picks `,` vs `;` by raw
`header_line.count(",")` / `.count(";")`, with no awareness of quoted
fields. A header such as `"Q1: valora, en general, el servei";Q2` (a
genuinely `;`-delimited export whose first header cell is quoted free text
containing commas) would count 2 commas vs 1 semicolon and incorrectly
select `,` as the delimiter. The file would then be parsed with the wrong
separator for every row, silently producing a corrupted column split
(comment text bleeding across "columns") rather than raising an error —
exactly the kind of shifted/garbled structure this module's own docstring
says it wants to catch "on sight." Real survey headers (Google
Forms/Typeform question text) are precisely the kind of long, comma-laden
quoted strings that trigger this.

**Fix:** Use a quote-aware count (or `csv.Sniffer`) instead of a raw
character count, e.g.:
```python
import csv

def _count_unquoted(line: str, char: str) -> int:
    return sum(1 for row in csv.reader([line]) for cell in row for c in cell if False) # placeholder
```
More simply, delegate to `csv.Sniffer().sniff(header_line, delimiters=",;")`
wrapped in a try/except that falls back to the current default-to-comma
behavior on `csv.Error`.

### WR-04: Duplicate-column-name detection in `_shape_warnings` is effectively dead code

**File:** `scripts/pipeline/load.py:156-167`

**Issue:**
```python
seen: dict = {}
blank = []
for col in df.columns:
    name = str(col)
    if name.strip() == "":
        blank.append(col)
        continue
    seen[name] = seen.get(name, 0) + 1
duplicated = [name for name, count in seen.items() if count > 1]
```
`pd.read_csv` and `pd.read_excel` both auto-mangle duplicate header names by
default (e.g. two raw `Q1` headers become `Q1` and `Q1.1`) before this
function ever sees `df.columns`. As a result the `duplicated` branch can
essentially never fire for genuinely duplicated raw headers — the very
"shifted header" scenario the module's docstring cites as the reason this
sanity check exists. There is no test in `pipeline_selftest.py` exercising a
truly-duplicated-header input (only the blank-header case is tested at
`pipeline_selftest.py:316-321`), which is consistent with this branch being
unreachable in practice.

**Fix:** Detect duplicates from the raw header line (already read once for
delimiter sniffing) before pandas mangles it, e.g. pass the raw header
tokens through `_shape_warnings` or a dedicated pre-parse check, rather than
inspecting `df.columns` after pandas has already disambiguated them.

### WR-05: `--date` is never validated as a real date

**File:** `scripts/convert_enquesta.py:68-72`

**Issue:** `--date` defaults to today's UTC date but accepts any string when
passed explicitly; `schema.validate_meta`/`validate_index` only check that
`date` is a `str`, not that it matches `YYYY-MM-DD`. A typo'd date (e.g.
`2026-13-40`, or an accidentally swapped day/month) is written straight into
the public `meta.json`/`enquestes_index.json` with no complaint from this
tool or `verify_publicacio.py`.

**Fix:**
```python
import re as _re
_DATE_RE = _re.compile(r"^\d{4}-\d{2}-\d{2}$")
...
args = parser.parse_args(argv)
if not _DATE_RE.match(args.date):
    parser.error(f"--date '{args.date}' ha de tenir el format YYYY-MM-DD")
```

### WR-06: Non-atomic writes of parquet/meta/index artifacts

**File:** `scripts/convert_enquesta.py:338-341`

**Issue:**
```python
parquet_path.parent.mkdir(parents=True, exist_ok=True)
df.to_parquet(parquet_path, engine="pyarrow", index=False)
schema.write_json(meta_path, meta)
schema.write_json(index_path, new_index)
```
None of these writes are atomic (write-to-temp-then-rename). An interruption
mid-write (Ctrl-C, disk full, power loss) can leave a truncated/corrupt
Parquet or JSON file on disk. `verify_publicacio.py` would likely catch this
before commit (per the documented workflow), and `compute_upserted_index`
would then hit the corrupted-index case described in WR-01 on the next run
— but a cleaner failure mode (atomic replace) would avoid ever producing a
half-written file in the first place, and would avoid a second `uv run`
invocation being needed just to recover.

**Fix:** Write to `path.with_suffix(path.suffix + ".tmp")` (or use
`tempfile.NamedTemporaryFile` in the same directory) and `os.replace()` /
`Path.replace()` onto the final path once the write completes successfully,
for all three artifacts.

## Info

### IN-01: `assessed_count` recomputes `unevaluated_columns` redundantly

**File:** `scripts/convert_enquesta.py:289`

**Issue:**
```python
findings, unevaluated = privacy.run_privacy_checklist(df, dimension_columns)
assessed_count = len(df.columns) - len(privacy.unevaluated_columns(df))
```
`run_privacy_checklist` already computes `unevaluated_columns(df)` internally
(via `pipeline/privacy.py`'s `run_privacy_checklist`) as part of building its
`unevaluated` return value; calling `privacy.unevaluated_columns(df)` again
here duplicates that work and couples `convert_enquesta.py` to an internal
helper of `pipeline.privacy` that it otherwise treats as a black box.

**Fix:** Have `run_privacy_checklist` return (or expose via a small
dataclass) the assessed/unevaluated-per-column count directly, so callers
don't need to re-derive it by calling a second internal function with the
same input.

---

_Reviewed: 2026-08-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
