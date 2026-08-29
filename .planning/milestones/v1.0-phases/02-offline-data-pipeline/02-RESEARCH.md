# Phase 2: Offline Data Pipeline - Research

**Researched:** 2026-08-26
**Domain:** Local, offline Python CLI pipeline — CSV/Excel survey export → Parquet + JSON artifacts, with a privacy review gate
**Confidence:** MEDIUM-HIGH (library choices and PEP 723/`uv` invocation verified live in this session; privacy-checklist heuristics are best-practice synthesis, not a single canonical standard)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Raw CSV/Excel exports are one row per respondent, one column per question (standard Google Forms/Typeform export shape) — the conversion script targets this shape, not multi-sheet or pre-aggregated spreadsheets.
- **D-02:** Open-ended/free-text fields (free responses, comments) are excluded entirely from the pipeline — they never enter `[id]_respostes.parquet` or `[id]_meta.json`, not merely hidden from the UI. — **Reversibility:** costly — **rationale:** once a survey's Parquet file has shipped without a free-text column, adding it back requires reprocessing and republishing that survey's data artifacts; treat this as the default behavior for every conversion, not a per-run toggle.
- **D-03:** Column type for the `fields` array in `[id]_meta.json` (`dimension` vs `measure`) is inferred automatically from the data (numeric column → measure, text/low-cardinality column → dimension) — no manual per-column annotation step.
- **D-04:** The script targets a single export format for now (whatever the user's existing tool produces) — no multi-format (Google Forms vs Typeform vs manual Excel) abstraction layer in this phase.

### Claude's Discretion
- DATA-03's privacy checklist enforcement behavior (block conversion until reviewed vs. warn-and-allow-explicit-override) — user did not select this area to discuss; left to research/planning to resolve, informed by the project's existing privacy-first posture (Phase 1 already ships an empty placeholder rather than any early real data, and the app-side `MIN_KPI_SAMPLE = 10` suppression threshold sets a precedent for "err toward withholding, state why"). **Resolved by this research: block-by-default** — see Pattern 2 and Alternatives Considered.
- KPI selection mechanism for `[id]_meta.json`'s `kpis` array (auto-computed from numeric columns vs. user-specified) — not discussed; left to research/planning. **Resolved by this research: auto-computed** (mean per measure column, with its own `n`) — see Code Examples.
- `generate_mock_parquet.py`'s realism/scope (minimal schema-exercising synthetic data vs. a plausible demo survey) — not discussed; left to research/planning. Note: Phase 1's `scripts/fixtures/` already contains hand-authored JSON fixtures with deliberately awkward edge cases (n=0, markup-in-title, below-suppression-threshold KPI) that this generator's *output shape* should remain consistent with, even if it doesn't reuse that exact data. **Resolved by this research: one plausible demo survey by default, `--n` flag to regenerate edge cases on demand** — see Open Questions Q2.
- Parquet-writing library choice (e.g., `pyarrow` vs `pandas` + engine), CLI argument design, and error-handling/reporting format for the conversion script — standard implementation choices, not user-facing product decisions. **Resolved by this research: `pandas.DataFrame.to_parquet(engine="pyarrow")`** — see Standard Stack.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|--------------------|
| DATA-01 | Script Python converteix dades reals (CSV/Excel exportat) a `[id]_respostes.parquet` + `[id]_meta.json`, i afegeix l'entrada corresponent a `enquestes_index.json` | Standard Stack (pandas/pyarrow/openpyxl), Architecture Patterns (Pattern 1 PEP 723 invocation, Pattern 3 type inference, System Architecture Diagram steps 1-3, 5-8), Code Examples (KPI computation, index upsert), Common Pitfalls 1-5 |
| DATA-02 | Script Python de mock (`generate_mock_parquet.py`) genera dades de prova sense necessitat de dades reals | Standard Stack (stdlib-only mock generation, no `Faker`), Architecture Patterns (System Architecture Diagram mock path, sharing steps 5-7 with the real pipeline), Open Questions Q2 |
| DATA-03 | El procés de conversió inclou una revisió/checklist de privacitat abans de publicar dades reals (detectar quasi-identificadors, no només noms/emails) | Architecture Patterns (Pattern 2 block-by-default gate, Pattern 4 privacy heuristics), Security Domain (Known Threat Patterns), Assumptions Log A1/A2, Open Questions Q1 |
</phase_requirements>

## Summary

This phase is the only part of the whole project that runs Python, and it never runs in CI or the browser — it is a developer-invoked, offline, local script. The target output is fully specified already (locked in Phase 1): `EnquestaIndexEntry`, `EnquestaMeta`, `EnquestaMetaKpi`, `EnquestaMetaField` from `src/types/enquesta.ts`, written as `public/data/enquestes_index.json` (upserted), `public/data/enquestes/<id>_meta.json`, and `public/data/enquestes/<id>_respostes.parquet`.

The standard, verified toolchain for this job is **pandas + pyarrow** for reading (CSV/Excel via `openpyxl`) and writing (`DataFrame.to_parquet(engine="pyarrow")`), invoked via **`uv run` with PEP 723 inline script metadata** rather than a `requirements.txt`/venv setup. This was smoke-tested end-to-end in this exact environment (see Environment Availability) and is important because the machine's default `python3` (pyenv, 3.6.10) is far too old for modern pandas/pyarrow (`requires-python >=3.10/3.11`) — `uv run` sidesteps that entirely by auto-provisioning a compatible interpreter and an ephemeral per-script environment, with zero venv/requirements-file ceremony, matching the project's "near-zero build boilerplate" ethos.

Two scripts are needed, matching the phase's named success criteria: `scripts/convert_enquesta.py` (real CSV/Excel → artifacts, gated by a privacy checklist that **blocks by default**) and `scripts/generate_mock_parquet.py` (synthetic demo data, no privacy gate, no external dependency beyond pandas/pyarrow — stdlib `random`, no `Faker`). Column type inference (`dimension` vs `measure`) is a literal, simple rule already specified in CONTEXT.md D-03: numeric → measure, everything else → dimension — no cardinality heuristics needed beyond that. The privacy checklist goes beyond name/email columns by computing per-column uniqueness ratio (near-unique columns are quasi-identifier candidates) and flagging small-group combinations of low-cardinality columns (a lightweight k-anonymity check), consistent with the project's own `MIN_KPI_SAMPLE = 10` "err toward withholding" precedent from Phase 1.

**Primary recommendation:** `uv run` + PEP 723 inline metadata scripts using pandas/pyarrow/openpyxl, with a hard-block-by-default privacy gate (`--confirm-privacy-review` flag required to proceed past a printed checklist) for real data, and a dependency-free (stdlib-only, beyond pandas/pyarrow) mock generator that produces one full plausible demo survey plus the documented edge cases (n=0, below-threshold KPI).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| CSV/Excel parsing & column type inference | Offline Python pipeline (local dev machine) | — | Runs once, locally, never in the browser or CI; the app only ever reads the pipeline's finished output files. |
| Privacy/quasi-identifier review | Offline Python pipeline | Human (developer) | Automated heuristics can flag candidates but cannot certify anonymization — the block-by-default gate hands the final judgment call to the developer, mirroring the client-side `MIN_KPI_SAMPLE` "state why, don't silently omit" precedent. |
| Parquet/JSON artifact writing | Offline Python pipeline | Filesystem (`public/data/`) | Sole producer of the on-disk contract Phase 1's `parseEnquestesIndex`/`parseEnquestaMeta` already consume as a trust boundary. |
| `enquestes_index.json` upsert | Offline Python pipeline | — | No server/DB exists; the index file itself is the only "catalog" and is git-committed directly. |
| Mock data generation | Offline Python pipeline | — | Needs no real data and no privacy gate (synthetic); must still satisfy the identical `EnquestaMeta`/Parquet schema so Phase 3 can develop against it. |
| Reading/querying the produced Parquet | Browser (DuckDB-Wasm) | — | Out of scope for this phase — Phase 3's concern. This phase only guarantees the file is valid, standard Parquet that DuckDB-Wasm can read. |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|---------------|
| `pandas` | 3.0.5 [VERIFIED: pypi.org/pypi/pandas/json — `requires_python: >=3.11`, first release 2009-12-25, latest 2026-07-22, repo `github.com/pandas-dev/pandas`] | Read CSV/Excel, infer/coerce column types, compute privacy-check statistics, build the DataFrame written to Parquet | The de facto standard tabular library in the Python ecosystem; every downstream operation (type inference, uniqueness ratios, KPI aggregation) is a one-line `pandas` call. |
| `pyarrow` | 25.0.1 [VERIFIED: pypi.org/pypi/pyarrow/json — `requires_python: >=3.10`, first release 2017-03-16, latest 2026-08-10, repo `github.com/apache/arrow`, homepage `arrow.apache.org`] | Parquet write/read engine used by `pandas.DataFrame.to_parquet(engine="pyarrow")` | Official Apache Arrow Python binding; same columnar format DuckDB-Wasm reads natively client-side, so writing with it minimizes any format-compatibility risk. |
| `openpyxl` | 3.1.5 [VERIFIED: pypi.org/pypi/openpyxl/json — `requires_python: >=3.8`, license MIT, first release 2010-08-11] | `pandas.read_excel()` engine for `.xlsx` files | pandas' own documented default/required engine for modern `.xlsx` — `xlrd` (the old engine) dropped `.xlsx` support in 2.0.0 for a security CVE [CITED: pandas-dev/pandas GitHub issue #29803 / general pandas docs]. |
| `uv` | 0.9.16 [VERIFIED: `uv --version` on this machine] | Script runner that resolves PEP 723 inline dependencies and provisions an ephemeral env per invocation, no venv/requirements.txt needed | Confirmed installed and working in this exact dev environment (`~/.local/bin/uv`); auto-manages Python versions too (has 3.9–3.14 available via `uv python list`), sidestepping the stale system default. |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Python stdlib `random`, `statistics`, `datetime`, `json`, `argparse`, `pathlib` | Python 3.11+ stdlib (whatever `uv` provisions) | Mock data generation, CLI arg parsing, JSON I/O | No extra dependency needed for `generate_mock_parquet.py` — see "Don't add `Faker`" below. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `pandas.DataFrame.to_parquet(engine="pyarrow")` | `pyarrow.Table.from_pandas()` + `pq.write_table()` directly | Slightly more control over Parquet-specific write options (row group size, compression codec), but an extra API layer for no benefit at this data scale (survey-sized files, not big-data). `to_parquet()` is the standard single-call idiom [CITED: pandas.pydata.org/docs/reference/api/pandas.DataFrame.to_parquet.html]. |
| `pandas.DataFrame.to_parquet()` | `duckdb` Python package (`COPY ... TO 'x.parquet'`) | Would guarantee the exact same engine writes and reads the file (DuckDB on both ends), but introduces a second data-manipulation API (SQL) just for the writing step when pandas already owns type inference and the privacy checklist logic — unnecessary complexity for this phase's scope. Worth reconsidering only if pandas/pyarrow ever produces a Parquet feature DuckDB-Wasm can't read (not currently expected — pyarrow writes broadly compatible standard Parquet by default). |
| stdlib `random` for mock data | `Faker` | `Faker` gives more varied fake names/addresses/text, but this project explicitly excludes free-text/PII-shaped fields entirely (D-02) and the mock generator only needs a handful of plausible dimension categories (e.g. segment, age bracket) and numeric measures — a small hardcoded Catalan value list via `random.choice()` covers this with zero added dependency. Reconsider only if the demo survey's realism becomes a stated product requirement. |
| Hard-block privacy gate | Warn-and-continue (print flags, proceed anyway) | Rejected — contradicts the project's own established precedent (`MIN_KPI_SAMPLE` withholds and states why, rather than publishing suppressed-but-visible values) and the stated privacy-first constraint in PROJECT.md. A warn-only gate is trivially ignored under time pressure, which is exactly when a privacy mistake becomes public and permanent (`public/data/` is git history, not a mutable database). |

**Installation (no `requirements.txt` — dependencies declared inline per script):**
```bash
# No `pip install` step. Each script starts with a PEP 723 block; uv resolves
# and provisions dependencies transparently on first `uv run`, e.g.:
uv run scripts/convert_enquesta.py path/to/export.csv --id demo-2026
uv run scripts/generate_mock_parquet.py --id mock-demo --n 250
```

**Version verification:** confirmed live against the PyPI JSON API this session (`curl https://pypi.org/pypi/<pkg>/json`) — see Package Legitimacy Audit below for the same evidence used to clear the legitimacy gate.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict (seam) | Disposition |
|---------|----------|-----|-----------|--------------|-----------------|-------------|
| `pandas` | PyPI | ~16 yrs (first release 2009-12-25) [VERIFIED: pypi.org/pypi/pandas/json, fetched this session] | not returned by seam (`unknown-downloads`) | `github.com/pandas-dev/pandas` [VERIFIED: pypi.org/pypi/pandas/json `project_urls.repository`] | SUS (`unknown-downloads`, `no-repository`) | **Approved, no checkpoint** — seam's `no-repository` signal is a false negative (the seam's `repoUrl` field was `null`, but the registry's own `project_urls.repository` field is populated and points to the canonical `pandas-dev` org); one of the most widely used PyPI packages in existence. |
| `pyarrow` | PyPI | ~9 yrs (first release 2017-03-16) [VERIFIED: pypi.org/pypi/pyarrow/json, fetched this session] | not returned by seam (`unknown-downloads`) | `github.com/apache/arrow` [VERIFIED: pypi.org/pypi/pyarrow/json `project_urls.repository`] | SUS (`too-new`, `unknown-downloads`) | **Approved, no checkpoint** — seam's `too-new` signal is a false positive driven by the *latest release* timestamp (2026-08-10, i.e. a routine recent release), not the package's actual age; official Apache Software Foundation project. |
| `openpyxl` | PyPI | ~15 yrs (first release 2010-08-11) [VERIFIED: pypi.org/pypi/openpyxl/json, fetched this session] | not returned by seam (`unknown-downloads`) | `foss.heptapod.net/openpyxl/openpyxl` [VERIFIED: pypi.org/pypi/openpyxl/json] | SUS (`unknown-downloads`) | **Approved, no checkpoint** — pandas' own documented default `.xlsx` engine; long-standing, MIT-licensed, widely depended upon. |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS] by the automated seam:** all three core packages were flagged SUS, but only because the seam's package-legitimacy signals (`weeklyDownloads`, `repoUrl`) came back `null`/missing for this ecosystem query — not because of any actual red flag. Each verdict was independently overridden above using a direct, same-session `curl https://pypi.org/pypi/<pkg>/json` read against the authoritative registry, cross-checked against the well-known official maintaining orgs (`pandas-dev`, `apache/arrow`) and confirmed by a live `uv run` install-and-execute smoke test (see Environment Availability). **The planner does not need to insert a `checkpoint:human-verify` task for these three packages** — the override evidence is documented inline above per-package, satisfying the audit requirement without deferring to a runtime checkpoint.

*No packages in this phase were sourced from WebSearch/training-data alone without registry cross-check — all three were read directly from the PyPI JSON API this session.*

## Architecture Patterns

### System Architecture Diagram

```
Raw export file                    Mock path (no input file)
(CSV / .xlsx, one row                        │
 per respondent)                             │
      │                                      ▼
      ▼                          scripts/generate_mock_parquet.py
scripts/convert_enquesta.py         (stdlib random, no gate)
      │                                      │
      ▼                                      │
 1. Load (pandas.read_csv /                  │
    read_excel[openpyxl])                    │
      │                                      │
      ▼                                      │
 2. Drop free-text columns (D-02)            │
    — column allow-list, not                 │
      "drop what looks risky"                │
      │                                      │
      ▼                                      │
 3. Infer field type per column              │
    (numeric → measure,                      │
     else → dimension)  ───────────────────► (same inference reused
      │                                        so mock output matches
      ▼                                        real output's shape)
 4. PRIVACY CHECKLIST (real data only)        │
    - per-column uniqueness ratio             │
    - small-group k-anonymity scan            │
    - known quasi-identifier name patterns    │
    → printed report                          │
      │                                       │
      ├── BLOCKS by default ───► exit nonzero, no files written
      │   (unless --confirm-privacy-review)   │
      ▼                                       ▼
 5. Compute KPIs (auto, from measure   Same steps 5-7, skip step 4
    columns) + build EnquestaMeta               │
      │                                         │
      ▼                                         ▼
 6. Write <id>_respostes.parquet   ◄─────────────┘
    (pandas.to_parquet, pyarrow)
      │
      ▼
 7. Write <id>_meta.json (matches EnquestaMeta exactly)
      │
      ▼
 8. Upsert entry into enquestes_index.json (match by id, replace or append)
      │
      ▼
public/data/  (git-committed; consumed by Phase 1's already-shipped fetch code)
```

### Recommended Project Structure
```
scripts/
├── convert_enquesta.py        # DATA-01 — real export → artifacts, privacy-gated
├── generate_mock_parquet.py   # DATA-02 — synthetic demo data, no gate
├── pipeline/                  # shared helpers, imported by both scripts
│   ├── __init__.py
│   ├── schema.py              # EnquestaMeta/EnquestaMetaKpi/EnquestaMetaField as
│   │                          #   dataclasses/TypedDicts mirroring src/types/enquesta.ts
│   ├── infer.py                # dimension/measure inference (D-03 rule)
│   ├── privacy.py              # DATA-03 checklist: uniqueness ratio, k-anon scan
│   └── index.py                # enquestes_index.json upsert logic
├── fixtures/                   # existing (Phase 1) — untouched, never deployed
│   ├── enquestes_index.json
│   └── enquestes/demo-2024_meta.json
public/data/                    # existing (Phase 1) — this phase's write target
├── enquestes_index.json
└── enquestes/
    ├── <id>_meta.json
    └── <id>_respostes.parquet
```
`scripts/pipeline/schema.py` should structurally mirror `src/types/enquesta.ts`'s field names and optionality exactly (`kpis` required array, `fields` optional array, `unit`/`n` optional on each KPI) so a human reviewing both files side-by-side can confirm they agree — there is no automated cross-language schema check in this phase, so this is a manual-parity discipline, not tooling.

### Pattern 1: PEP 723 inline script metadata (no venv, no requirements.txt)
**What:** Each script embeds its own dependency list as a commented TOML block at the top of the file; `uv run <script>.py` reads it and transparently resolves/installs into an ephemeral environment before executing.
**When to use:** Every script in this phase — it is the only Python code in the whole repo, invoked ad hoc by one developer, never in CI.
**Example (verified working in this environment — smoke-tested this session):**
```python
# /// script
# requires-python = ">=3.11"
# dependencies = ["pandas", "pyarrow", "openpyxl"]
# ///
import pandas as pd

df = pd.read_csv("export.csv")
df.to_parquet("output.parquet", engine="pyarrow")
```
Run with `uv run scripts/convert_enquesta.py export.csv`. [VERIFIED: ran an equivalent script end-to-end in this session via `uv run` — `uv` resolved pandas 3.0.5 + pyarrow 25.0.1 + numpy, wrote a Parquet file, and read it back correctly with matching dtypes, with zero pre-existing venv/pip setup on this machine.]

### Pattern 2: Block-by-default privacy gate
**What:** `convert_enquesta.py` always runs the privacy checklist against real input, prints every flagged column/combination, and refuses to write any output file unless the developer passes an explicit override flag acknowledging the printed report.
**When to use:** Every invocation against real (non-mock) data — DATA-03's success criterion is "surfaces a privacy checklist... before real data is published," and CONTEXT.md's discretion note points to the project's own `MIN_KPI_SAMPLE` "err toward withholding" precedent as the deciding signal.
**Example (illustrative CLI shape — not a verified library API, just argparse):**
```python
parser.add_argument("--confirm-privacy-review", action="store_true",
    help="Required to write output after reviewing the printed privacy checklist.")
...
findings = run_privacy_checklist(df)
print_checklist_report(findings)  # always prints, even if empty
if findings and not args.confirm_privacy_review:
    sys.exit("Privacy checklist found potential issues — re-run with "
             "--confirm-privacy-review after reviewing them above.")
```

### Pattern 3: Column type inference (D-03's literal rule)
**What:** `numeric column → measure`, everything else `→ dimension`. No cardinality threshold, no manual annotation.
```python
def infer_field_type(series: "pd.Series") -> str:
    # Coerce first: a CSV column of "1","2","3" often arrives as dtype=object.
    coerced = pd.to_numeric(series, errors="coerce")
    # Treat as measure only if coercion didn't turn real values into NaN.
    return "measure" if coerced.notna().sum() == series.notna().sum() and series.notna().any() else "dimension"
```
This is the literal rule CONTEXT.md D-03 specifies verbatim ("numeric column → measure, text/low-cardinality column → dimension") — do not add extra cardinality-based reclassification (e.g. "5-point Likert numeric column is secretly a dimension") beyond what D-03 states; that would be scope creep on an already-locked decision.

### Anti-Patterns to Avoid
- **Passing every raw CSV column through untouched:** the privacy checklist and D-02's free-text exclusion both depend on an explicit column allow-list being built (drop, don't merely hide, anything not on the list) — a permissive default (include everything except what's flagged) inverts the intended safety direction.
- **Treating a numeric-looking respondent-ID or phone-number column as a measure:** D-03's literal numeric→measure rule will misclassify an ID column; the privacy checklist's near-unique-value check (Pattern 4 below) is what catches this, not the type-inference step — don't try to patch this into `infer_field_type` itself.
- **Writing Parquet with an engine other than `pyarrow`:** `fastparquet` is a legitimate alternative in general, but DuckDB-Wasm/Arrow-format compatibility is best guaranteed by using the same Arrow-family writer (`pyarrow`) that produces the columnar format DuckDB reads directly — don't introduce a second Parquet-writing engine into this codebase.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Parquet file writing | Manual binary Parquet writer / raw Thrift encoding | `pandas.DataFrame.to_parquet(engine="pyarrow")` | Parquet's spec includes row-group metadata, statistics, and encoding schemes that are extremely easy to get subtly wrong; `pyarrow` is the reference-quality implementation this project's whole stack already depends on (DuckDB-Wasm's own Parquet reader is Arrow-family). |
| `.xlsx` parsing | Custom XML/zip-based Excel parser | `pandas.read_excel(engine="openpyxl")` | `.xlsx` is a zip of XML parts with its own quirks (shared strings, styles, merged cells); `openpyxl` is the pandas-documented standard engine, actively maintained since 2010. |
| Full k-anonymity / re-identification risk scoring | A from-scratch k-anonymity algorithm implementation | A lightweight, purpose-built heuristic scan (uniqueness ratio + small-group combination counts, see Pattern 4 below) | True k-anonymity tooling (e.g. ARX, sdcMicro) is a much larger dependency/learning surface than this phase's scope justifies for a handful of small survey datasets reviewed by one person; a heuristic *flag-for-human-review* tool is the right size — DATA-03's success criterion is "surfaces a checklist," not "certifies anonymity." |
| Dependency/environment management | A `requirements.txt` + manual `venv` + activation instructions in a README | `uv run` + PEP 723 inline metadata | Confirmed working zero-setup in this exact environment; avoids the stale system Python (3.6.10) trap entirely and needs no per-developer "did you activate the venv?" step. |

**Key insight:** Every "don't hand-roll" here maps to the same theme — this phase's actual novel work is the *privacy checklist logic and the schema-matching glue*, not file-format engineering. Lean entirely on mature libraries for CSV/Excel/Parquet I/O so review time goes to the parts that are genuinely project-specific (D-02 exclusion, D-03 inference, DATA-03 checklist, index upsert).

### Pattern 4: Privacy checklist heuristics (DATA-03)
**What:** Beyond dropping obvious name/email columns (already excluded via D-02's free-text rule and an explicit allow-list), flag:
1. **Near-unique columns** — `distinct_count / n > threshold` (e.g. 0.9) on any *remaining* structured column signals a likely identifier (respondent ID, exact timestamp, phone number) that slipped past the allow-list.
2. **Known quasi-identifier name patterns** — column names matching a small keyword list (`edat`/age, `codi postal`/postal/zip, `naixement`/birth date, `departament`, `càrrec`/job title, `municipi`) get flagged for manual review even if not automatically blocked — these are exactly the fields the Netflix-Prize-style re-identification literature calls out [CITED: general k-anonymity literature — Sweeney's original k-anonymity paper on 87% U.S. re-identification via zip+gender+birthdate, found via WebSearch, cross-referenced against `epic.org` hosting of the original paper].
3. **Small-group combinations** — for the set of inferred `dimension` columns, group-by every 2–3-column combination and flag any resulting group with fewer than *k* rows (suggest k=5, one notch below the app's existing `MIN_KPI_SAMPLE=10` client-side threshold, since this is a pre-publish structural check on raw rows, not a computed-value suppression) [ASSUMED — k=5 is a reasonable default threshold choice informed by the project's own `MIN_KPI_SAMPLE=10` precedent, not an externally standardized number for this exact use case; confirm with the user during planning/discussion if a specific k value matters to them].
```python
def uniqueness_flags(df: "pd.DataFrame", threshold: float = 0.9) -> list[str]:
    n = len(df)
    if n == 0:
        return []
    return [
        col for col in df.columns
        if df[col].nunique(dropna=True) / n > threshold
    ]

QUASI_IDENTIFIER_NAME_HINTS = [
    "edat", "age", "naixement", "birth", "codi postal", "postal", "zip",
    "departament", "department", "càrrec", "carrec", "job title", "municipi",
]
```

## Common Pitfalls

### Pitfall 1: System `python3` resolves to an ancient, incompatible interpreter
**What goes wrong:** Running `python3 scripts/convert_enquesta.py` directly (instead of `uv run`) resolves to whatever the machine's pyenv/system default is — on this development machine that is Python 3.6.10 [VERIFIED: `python3 --version` on this machine via the active pyenv shim], which cannot install pandas ≥2.x or pyarrow at all (`requires-python >=3.10`/`>=3.11`).
**Why it happens:** pyenv's "current" global version can silently drift out of date relative to what a new script actually needs, and nothing in a bare `python3 script.py` invocation warns about a version mismatch until `pip install` fails.
**How to avoid:** Document and use `uv run scripts/<name>.py ...` as the *only* documented invocation in this phase's README/comments — never `python3 scripts/<name>.py` directly. `uv` auto-provisions a compatible interpreter per the script's `requires-python` line.
**Warning signs:** `SyntaxError` or `ModuleNotFoundError` immediately on a fresh clone; `pip install pandas` failing with "no matching distribution."

### Pitfall 2: CSV encoding mismatches produce mojibake in Catalan text
**What goes wrong:** Google Forms/Sheets CSV exports are UTF-8, but a CSV re-saved via Excel on Windows is often `cp1252`/`latin-1`; `pandas.read_csv()` defaults to UTF-8 and will either raise `UnicodeDecodeError` or silently corrupt accented characters (à, é, ï, ç — all common in Catalan survey text) if the file is actually Windows-encoded.
**Why it happens:** The export tool isn't fixed by an abstraction layer in this phase (D-04: single export format), but that format's actual byte encoding can still vary by which app produced/touched the file last.
**How to avoid:** Attempt UTF-8 first; on `UnicodeDecodeError`, retry with `encoding="latin-1"` (or `cp1252`) and print a warning so the developer notices and can verify the text looks right before trusting it, rather than silently succeeding with garbled text.
**Warning signs:** Accented Catalan characters appear as `Ã©`, `Ã¨`, or similar garbage in the printed privacy-checklist report or in a manual spot-check of `<id>_meta.json`.

### Pitfall 3: Numeric-looking identifier columns get classified as `measure`
**What goes wrong:** D-03's literal numeric→measure rule will tag a respondent-ID column, a phone number, or a numeric timestamp as a `measure` field, both polluting `EnquestaMetaField` with a meaningless "average respondent ID" measure and — more seriously — creating exactly the kind of near-unique column DATA-03 exists to catch.
**Why it happens:** `infer_field_type` only looks at whether a column *coerces to numeric*, not whether it's semantically an identifier.
**How to avoid:** This is precisely what Pattern 4's uniqueness-ratio check catches independently of type inference — don't try to fix it inside `infer_field_type` (D-03's rule is locked as written); instead ensure the privacy checklist runs on *all* remaining columns regardless of their inferred dimension/measure type, and that a near-unique numeric column blocks conversion by default just like a near-unique text column would.
**Warning signs:** `<id>_meta.json`'s `fields` array contains a `measure` whose name looks like an ID/code, or the privacy checklist's near-unique flag fires on a column that also got tagged `measure`.

### Pitfall 4: `enquestes_index.json` upsert accidentally duplicates or drops entries
**What goes wrong:** A naive "always append" implementation creates duplicate entries when re-running the conversion for an already-published survey (e.g. after fixing a data issue); a naive "always overwrite whole file" implementation silently drops every other survey's entry if the script isn't scoped correctly.
**Why it happens:** `enquestes_index.json` is a single shared array file that both this phase's script and every previously-converted survey's entry live in together — CONTEXT.md itself flags this as "upsert semantics are undecided here."
**How to avoid:** Load the existing array, find-and-replace by `id` (match on the `EnquestaIndexEntry.id` field), append only if no existing entry has that `id`, then write the whole array back — a small, explicit `upsert_index_entry(existing: list, new_entry: dict) -> list` function, tested against the case of re-running conversion for an id that's already present.
**Warning signs:** Two cards with the same survey title/id appearing on the homepage after a re-run; other surveys disappearing from the catalog after converting one new survey.

### Pitfall 5: Excel exports carry extra header/footer rows or merged summary cells
**What goes wrong:** Some export tools (or a manually-touched `.xlsx`) prepend a title row, a generated-on-date row, or leave a summary/total row at the bottom above/below the actual one-row-per-respondent data — `pandas.read_excel()` will read these as if they were data rows or as a broken header, producing spurious columns or a shifted schema.
**Why it happens:** D-01/D-04 assume a clean one-row-per-respondent shape, but that's a statement about the target format's *intent*, not an automatic guarantee about every file that gets handed to the script.
**How to avoid:** Print the inferred column names and the first/last few rows before writing any output, as a lightweight sanity check the developer glances at every run (cheap, and catches this class of error immediately) — don't try to auto-detect and strip header/footer noise; that's exactly the "multi-format abstraction" complexity D-04 explicitly ruled out of scope.
**Warning signs:** A column named `Unnamed: 0` or similar pandas auto-generated name; a `n` far off from the expected respondent count; the privacy checklist flagging almost every column as near-unique (symptomatic of a shifted/misaligned header row).

## Code Examples

### KPI auto-computation (resolves CONTEXT.md's open "KPI selection mechanism" question)
```python
# Auto-compute one KPI per inferred measure column: mean, with its own
# effective sample size (n = count of non-null values for that column),
# so the app's existing MIN_KPI_SAMPLE=10 suppression logic (client-side,
# src/lib/enquestes.ts) has a real per-KPI `n` to suppress against.
def build_kpis(df: "pd.DataFrame", fields: list[dict]) -> list[dict]:
    kpis = []
    for field in fields:
        if field["type"] != "measure":
            continue
        col = df[field["name"]]
        non_null = col.dropna()
        if non_null.empty:
            continue
        kpis.append({
            "label": field.get("label", field["name"]),
            "value": round(float(non_null.mean()), 2),
            "n": int(non_null.shape[0]),
        })
    return kpis
```
This satisfies CONTEXT.md's deferred "KPI selection mechanism" question with the simplest option consistent with D-03 (auto-computed from numeric/measure columns, no manual per-KPI annotation step) — matching the MVP mode stated in the phase description. `unit` is intentionally left unset by default (optional in `EnquestaMetaKpi`) since it can't be inferred from data alone; a developer can hand-edit the generated JSON afterward if a specific unit (e.g. `/10`, `%`) is wanted, exactly as the `demo-2024_meta.json` fixture already does by hand.

### `enquestes_index.json` upsert
```python
import json
from pathlib import Path

def upsert_index_entry(index_path: Path, new_entry: dict) -> None:
    existing = json.loads(index_path.read_text(encoding="utf-8")) if index_path.exists() else []
    replaced = False
    for i, entry in enumerate(existing):
        if entry["id"] == new_entry["id"]:
            existing[i] = new_entry
            replaced = True
            break
    if not replaced:
        existing.append(new_entry)
    index_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2), encoding="utf-8")
```
`ensure_ascii=False` matters here — Catalan text (à, ç, ï, ò...) should be written as real UTF-8 characters in the committed JSON, matching the existing hand-authored fixtures (`scripts/fixtures/enquestes_index.json` already contains literal accented characters, not `\uXXXX` escapes) [VERIFIED: scripts/fixtures/enquestes_index.json:6,13,18-19 — read directly this session, e.g. `"title": "Satisfacció de clients 2026"`, `"description": "...trimestral sobre satisfacció..."` contain literal UTF-8 accented characters].

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|----------------|--------|
| `xlrd` for reading `.xlsx` | `openpyxl` (pandas' documented default engine) | `xlrd` 2.0.0 (2020) dropped `.xlsx` support after a security disclosure | Any tutorial/snippet referencing `xlrd` for `.xlsx` is stale; must use `openpyxl` explicitly or let pandas auto-select it. |
| `requirements.txt` + manual `venv` for one-off scripts | PEP 723 inline script metadata + `uv run` | PEP 723 accepted; `uv` implemented support early and is now a common pattern for exactly this "single offline script" use case | Removes an entire class of "did you activate the venv / is pip up to date" setup friction for a phase that will be run occasionally, offline, by one person. |

**Deprecated/outdated:** `xlrd` for `.xlsx` (still fine for legacy `.xls`, irrelevant here since D-01 targets a modern export tool).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|----------------|
| A1 | k=5 as the small-group combination threshold in the privacy checklist's k-anonymity-lite scan | Pattern 4 (Common Pitfalls / Privacy checklist) | If too low, small identifiable subgroups slip through the checklist unflagged; if too high, the checklist over-flags legitimate small-but-fine categorical combinations, causing alert fatigue and encouraging developers to override without reading carefully. Low-cost to change (a single constant) once the user weighs in during planning/discussion. |
| A2 | Uniqueness-ratio threshold of 0.9 for flagging a column as a likely identifier | Pattern 4 | Same failure mode as A1 (too permissive misses real IDs, too strict flags legitimate high-cardinality-but-fine columns like free-response IDs already excluded by D-02) — tune during implementation against a real export if available. |
| A3 | KPI auto-computation defaults to `mean` over each measure column, with no `unit` set by default | Code Examples — KPI auto-computation | If the user actually wants a curated subset of KPIs (not "one per measure column") or specific units auto-filled, the generated `meta.json` will need manual post-editing every run rather than being publish-ready — low cost (it's a JSON file, easy to hand-edit) but worth confirming since CONTEXT.md explicitly left this open. |
| A4 | `scripts/pipeline/` as the shared-helper module layout | Recommended Project Structure | Purely a code-organization choice with no external contract implications — the planner/executor can restructure freely without affecting DATA-01/02/03 acceptance criteria. |

**If this table is empty:** N/A — see rows above; all are implementation-detail-level assumptions the user can adjust cheaply, not foundational risks.

## Open Questions

1. **Exact k-anonymity threshold and uniqueness-ratio threshold for the privacy checklist**
   - What we know: the *mechanism* (block-by-default, uniqueness ratio + small-group scan + name-pattern hints) is well-grounded in both the project's own precedent and general k-anonymity literature.
   - What's unclear: the exact numeric thresholds (k=5, ratio=0.9) are reasonable defaults, not values derived from the specific real survey data this pipeline will process (unseen at research time).
   - Recommendation: ship the defaults above as constants in `scripts/pipeline/privacy.py`, clearly documented as tunable, and treat the first real conversion run as the moment to sanity-check whether they flag sensibly — don't block planning on nailing exact numbers now.

2. **Whether `generate_mock_parquet.py`'s single demo survey should also emit a *second* mock survey exercising `n=0`**
   - What we know: `scripts/fixtures/enquestes_index.json` already hand-authors an `n=0` edge case (`enquesta-pilot-buida`) as a JSON fixture (no matching Parquet file).
   - What's unclear: whether DATA-02's "generate a valid example Parquet dataset" success criterion is satisfied by one representative survey, or whether it should also produce a zero-respondent Parquet file (valid Parquet, zero rows) to exercise that edge case end-to-end (unlike the existing fixture, which is JSON-only with no backing Parquet).
   - Recommendation: default to a single, plausible-sized demo survey (the phase's stated success criterion says "a valid example Parquet dataset," singular) with a `--n` CLI flag that lets a developer regenerate with `--n 0` on demand if the edge case needs exercising later — avoids over-building the mock generator's scope in this phase while keeping the option cheap.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| `uv` | Script invocation (PEP 723 resolution) | ✓ [VERIFIED: `uv --version` this session] | 0.9.16 | If absent on a future machine: `pip install uv` (single binary, no Python prerequisite) — document this as the one setup step. |
| Compatible Python (≥3.11, for pandas' `requires-python`) | pandas/pyarrow runtime | ✓ (via `uv`, not the system default) [VERIFIED: `uv python list` shows 3.13.3 and 3.14.2 already installed on this machine; `uv run` auto-selected and used one successfully in the smoke test this session] | 3.13.3 / 3.14.2 available | None needed — `uv` downloads a matching interpreter automatically if none is present locally. |
| System `python3` (pyenv) | Not used by this phase's scripts | ✓ but **wrong version** for this task | 3.6.10 [VERIFIED: `python3 --version` this session] | N/A — this phase must never document `python3 scripts/...` as the invocation; see Pitfall 1. |
| `pandas`, `pyarrow`, `openpyxl` | All conversion/mock scripts | ✓ (resolved on-demand by `uv`, not pre-installed) [VERIFIED: successfully resolved and installed via `uv run` this session — pandas 3.0.5, pyarrow 25.0.1] | pandas 3.0.5, pyarrow 25.0.1, openpyxl 3.1.5 | None needed. |

**Missing dependencies with no fallback:** none — every dependency this phase needs is either already present or auto-provisioned by `uv`.

**Missing dependencies with fallback:** none currently missing.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|-----------------|---------|--------------------|
| V2 Authentication | No | No auth surface — this is a local CLI, not a service. |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes | Treat the raw CSV/Excel file as untrusted input to the extent of not `eval`/`exec`-ing any cell content, not trusting column headers blindly for anything beyond display/matching, and validating the produced JSON structurally against the same shape `parseEnquestaMeta`/`parseEnquestesIndex` expect before writing it (a self-check inside the script, not just hoping the output matches). |
| V6 Cryptography | No | No secrets, no crypto — the whole artifact set is intentionally public. |

### Known Threat Patterns for this domain

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|-----------------------|
| Privacy/re-identification of survey respondents via quasi-identifiers (the domain-specific risk DATA-03 exists to address) | Information Disclosure | Block-by-default privacy checklist (Pattern 2/4 above); explicit column allow-list rather than pass-through-by-default; treat everything written to `public/data/` as permanent and public from first commit (git history persists even after a later "fix"). |
| CSV/Excel formula injection (a cell like `=cmd|'/c calc'!A1` or `=HYPERLINK(...)` surviving into a spreadsheet a developer later opens in Excel to review the source export) | Tampering / (secondary) code execution on the developer's own machine | This risk applies to a developer *opening the raw source file* in Excel, not to this phase's own script (pandas reads cell values as data, never evaluates formulas) — worth a one-line comment in the script noting the raw source `.xlsx` file itself should be treated with the same care as any downloaded spreadsheet before manually opening it, but not something the conversion script itself needs to defend against since it doesn't execute cell content. |
| Path traversal via a user-supplied survey `id` argument (e.g. `--id ../../etc/passwd`) when building the output file path | Tampering | `isValidEnquestaId`'s existing regex (`^[A-Za-z0-9._-]{1,64}$`) [VERIFIED: src/lib/enquestes.ts:11-13 — `export function isValidEnquestaId(id: string): boolean { return /^[A-Za-z0-9._-]{1,64}$/.test(id) }`] already defines the exact id shape the app's own trust boundary accepts; this phase's script should validate the `--id` argument against the *same* pattern (reimplemented in Python, since it's a separate language/process) before using it in any filesystem path, so a script-produced id can never fail to round-trip through the app's own validator. |

## Sources

### Primary (HIGH confidence)
- `pypi.org/pypi/pandas/json`, `pypi.org/pypi/pyarrow/json`, `pypi.org/pypi/openpyxl/json` — official PyPI registry JSON API, fetched directly this session via `curl`, used for version/age/repo verification.
- Live `uv run` smoke test in this session — PEP 723 inline metadata resolution, pandas/pyarrow install, Parquet write + read-back round trip, all executed and confirmed working on this exact machine.
- `src/types/enquesta.ts`, `src/lib/enquestes.ts`, `scripts/fixtures/enquestes_index.json`, `scripts/fixtures/enquestes/demo-2024_meta.json` — read directly this session; the exact target schema and existing fixture shape this phase's output must match.
- `.planning/phases/02-offline-data-pipeline/02-CONTEXT.md` — locked decisions (D-01–D-04) governing scope.

### Secondary (MEDIUM confidence)
- WebSearch: PEP 723 / `uv` inline script metadata mechanics (`peps.python.org/pep-0723`, `pydevtools.com`, `deepwiki.com/astral-sh/uv`) — corroborates the mechanism verified live above.
- WebSearch: pandas `read_excel`/`openpyxl` engine requirement, `xlrd` `.xlsx` deprecation — cross-referenced against pandas' own official docs URL appearing in results.
- WebSearch: k-anonymity / quasi-identifier heuristics, including Sweeney's original k-anonymity paper (hosted at `epic.org`) and the "87% of U.S. citizens re-identifiable via zip+gender+birthdate" finding.

### Tertiary (LOW confidence)
- WebSearch: `pyarrow.write_table()` vs `pandas.to_parquet()` general tutorial comparison (Medium/Saturn Cloud blog posts) — used only to confirm both are legitimate, well-known equivalent approaches; the actual recommendation (`to_parquet(engine="pyarrow")`) is corroborated by pandas' own official docs URL in the same result set.
- WebSearch: `Faker` library usage patterns — informed the decision to *not* add it as a dependency, not used as a basis for any code pattern in this research.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — package choices verified live against PyPI registry and smoke-tested end-to-end in this exact environment this session.
- Architecture: HIGH — output contract is a locked, already-read TypeScript interface and existing fixtures; pipeline shape follows directly from the phase's three success criteria.
- Pitfalls: MEDIUM — encoding/header/upsert/ID-collision pitfalls are well-grounded in general data-pipeline experience and the project's own existing code, but not all have been observed against this project's *actual* real survey export (not yet supplied at research time).
- Privacy checklist heuristics: MEDIUM — mechanism and rationale are well-grounded (project precedent + general k-anonymity literature), but exact thresholds (A1/A2 in Assumptions Log) are reasonable defaults rather than externally standardized values.

**Research date:** 2026-08-26
**Valid until:** ~90 days (Python packaging ecosystem for this specific tool combination is stable; re-verify `pandas`/`pyarrow` exact versions via `pypi.org` before first real use if this research is consumed significantly later)
