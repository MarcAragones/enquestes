---
status: complete
phase: 02-offline-data-pipeline
source: [02-VERIFICATION.md]
started: 2026-08-26T14:10:00Z
updated: 2026-08-26T16:05:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Live homepage renders the synthetic survey card and KPI modal
expected: |
  Open the deployed homepage (https://marcaragones.github.io/enquestes/) in a real browser
  and confirm the "mostra-sintetica" survey card renders correctly (title, description,
  participant count) instead of the empty-catalog state, and that clicking it opens the KPI
  summary modal with sensible mean values for edat/satisfaccio/recomanaria. One survey card
  visible on the homepage; title/description visibly state the data is synthetic; KPI modal
  shows the three measure KPIs with plausible values (edat≈46, satisfaccio≈5.3,
  recomanaria≈53, matching public/data/enquestes/mostra-sintetica_meta.json).
result: pass

### 2. Real-export privacy threshold sanity check
expected: |
  Run `uv run scripts/convert_enquesta.py <your-real-export> --list-columns`, then a real
  conversion, and read the printed privacy checklist. Judge whether MIN_GROUP_SIZE=5 and
  UNIQUENESS_RATIO_THRESHOLD=0.9 (scripts/pipeline/privacy.py) flag sensibly on actual survey
  data, not just the synthetic fixtures. Either "thresholds fine" or updated threshold values
  reported by the developer.
result: issue
reported: "uv run scripts/convert_enquesta.py --list-columns /Users/marcaragones/Downloads/REO1167_microdades_anonimitzades.csv → ERROR: Error tokenizing data. C error: Expected 8 fields in line 4, saw 10"
severity: major

## Summary

total: 2
passed: 1
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- gap_id: G-02-2
  truth: "--list-columns is a read-only inspection mode that prints detected columns and exits without writing"
  status: resolved
  reason: "User reported: --list-columns requires --id even though it writes nothing, blocking column inspection of a real export before the user has decided on an --id"
  severity: major
  test: 2
  root_cause: "scripts/convert_enquesta.py argparse declared --id with required=True unconditionally; --id validation and output-path resolution also ran unconditionally before the --list-columns branch."
  artifacts:
    - path: "scripts/convert_enquesta.py"
      issue: "Fixed directly (not via gap-closure planner, given severity/scope): removed required=True from --id, added --id to the conditional missing-flags check, guarded id-validation/path-resolution to skip when --id is absent in --list-columns mode."
  missing: []
  resolved_by: "commit c8edb19"
  resolved_at: "2026-08-26"
  debug_session: ""

- gap_id: G-02-3
  truth: "load_table() reads any real CSV/TSV/Excel export named in DATA-01, with encoding fallback and shape-sanity warnings, never a raw crash"
  status: resolved
  reason: "User reported: uv run scripts/convert_enquesta.py --list-columns /Users/marcaragones/Downloads/REO1167_microdades_anonimitzades.csv → ERROR: Error tokenizing data. C error: Expected 8 fields in line 4, saw 10"
  severity: major
  test: 2
  root_cause: "load_table() hardcoded sep=\",\" for .csv files, but the real export uses ';' as its field delimiter -- a common Spanish/Catalan-locale spreadsheet export convention. The header line has 0 commas, so pandas' C parser expected exactly 1 comma-split field per row; later rows whose free-text cells happened to contain an incidental comma produced more comma-split tokens than the header, tripping the tokenizer. Confirmed empirically: pd.read_csv(path, sep=';', encoding='cp1252') parses the file cleanly end-to-end (2000 rows x 320 columns, zero errors) -- pandas' existing RFC4180 quoting already handles the free-text cells that legitimately embed ';'. This was a pipeline robustness gap (case b), not a malformed/ragged file."
  artifacts:
    - path: "scripts/pipeline/load.py"
      issue: "Added _detect_csv_delimiter(): sniffs ',' vs ';' from the header line (utf-8-then-cp1252 decode fallback), picks whichever occurs more often (ties default to ','), and appends a non-silent warning whenever ';' is chosen. load_table() now calls this for .csv (not .tsv, which stays hardcoded to tab). Also wrapped pd.errors.ParserError in _read_csv_with_fallback with a clearer, actionable ValueError (exact pandas-reported line + likely cause) as a safety net for genuinely ragged files, without attempting to guess/repair row alignment."
    - path: "scripts/pipeline_selftest.py"
      issue: "Added 4 regression tests on synthetic fixtures: semicolon delimiter is detected and warned; a comma-delimited file with ';' inside quoted text stays on ','; tied ',' vs ';' counts default to ','; a row with more fields than the header raises an actionable ValueError instead of crashing with pandas' raw traceback."
  missing: []
  resolved_by: "commit 9e72826"
  resolved_at: "2026-08-26"
  debug_session: ".planning/debug/resolved/g-02-3-csv-parse-gap.md"
