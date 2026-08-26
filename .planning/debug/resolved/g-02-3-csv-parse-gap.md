---
status: resolved
trigger: "UAT gap G-02-3: --list-columns fails with 'Expected 8 fields in line 4, saw 10' on REO1167_microdades_anonimitzades.csv"
created: 2026-08-26T00:00:00Z
updated: 2026-08-26T00:00:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: "load_table() hardcodes sep=',' for .csv files; the real export uses ';' as delimiter (Spanish/Catalan-locale convention), causing pandas' C parser to mis-tokenize whenever a free-text cell happens to contain a literal comma."
  confirming_evidence:
    - "Every raw line has exactly 319 semicolons at fixed positions consistent with a 320-column header; comma counts vary per line (0-9) because they're incidental characters inside free-text cells, not the real delimiter."
    - "uv run --with pandas python3 -c \"pd.read_csv(path, sep=';', encoding='cp1252')\" succeeds cleanly: shape (2000, 320), zero ParserError -- pandas' RFC4180 quoting already handles the free-text cells that legitimately contain embedded ';'."
  falsification_test: "If pd.read_csv with sep=';' still raised ParserError, delimiter alone would not be the root cause and the file would be genuinely ragged (case a)."
  fix_rationale: "Detect ',' vs ';' from the header line and use the winner; this is a real, safe pipeline robustness gap (case b) -- no data is dropped or guessed, the existing encoding-fallback and shape-warning machinery is untouched."
  blind_spots: "Only sniffs ',' vs ';' (not tab or other dialects) per D-04 scope; assumes header line alone is representative of the whole file's delimiter."
  candidate_causes:
    - "code: hardcoded sep=\",\" in load_table() for .csv suffix"
    - "data: real export file uses ';' delimiter convention, not ','"
  and_gate: "no -- single root cause (hardcoded delimiter assumption); the data shape itself is valid CSV once the correct delimiter is used, confirmed by a clean pandas parse"

## Symptoms

expected: "uv run scripts/convert_enquesta.py --list-columns <real REO1167 CSV> should load the file and list its columns"
actual: "ERROR: Error tokenizing data. C error: Expected 8 fields in line 4, saw 10"
errors: "pandas.errors.ParserError via pd.read_csv(path, sep=',') -- header line has 0 commas -> 1 field per pandas' comma-split view; but free-text cells with incidental commas make later lines have more comma-split tokens, so pandas errors on the 3rd data row parsed."
reproduction: "uv run scripts/convert_enquesta.py --list-columns /Users/marcaragones/Downloads/REO1167_microdades_anonimitzades.csv"
started: "Always broken for this real file -- delimiter was never detected, only ever hardcoded to comma"

## Eliminated

(none -- root cause found on first hypothesis, confirmed empirically before any fix)

## Evidence

- timestamp: 2026-08-26T00:00:00Z
  checked: "Raw bytes of REO1167_microdades_anonimitzades.csv, first 6 lines, byte-level delimiter counts"
  found: "319 semicolons on every one of the first 6 lines (header included); comma counts vary 0-9 per line, all inside free-text answer cells"
  implication: "File is semicolon-delimited; comma is incidental content, not the delimiter"
- timestamp: 2026-08-26T00:00:00Z
  checked: "uv run --with pandas python3 -c pd.read_csv(path, sep=';', encoding='utf-8'/'cp1252')"
  found: "utf-8 fails (expected, non-UTF-8 bytes present -- existing cp1252 fallback already handles this); cp1252 with sep=';' succeeds: shape (2000, 320), no ParserError at all"
  implication: "Once the correct delimiter is used, the file parses cleanly end-to-end -- confirms case (b), pure delimiter-detection gap, not a genuinely ragged file"

## Resolution

root_cause: "scripts/pipeline/load.py's load_table() hardcoded sep=\",\" for all .csv files; the real export (REO1167_microdades_anonimitzades.csv) uses ';' as its field delimiter, a common convention for Spanish/Catalan-locale spreadsheet export tools. pandas' C parser mis-tokenized rows whenever a free-text cell happened to contain an incidental comma, since the header (0 commas) established a 1-field expectation that later rows (with commas inside quote-less free text) violated."
fix: "Added _detect_csv_delimiter() to scripts/pipeline/load.py: sniffs ',' vs ';' from the header line (utf-8-then-cp1252 fallback for decoding), picks whichever occurs more often (ties default to ','), and appends a non-silent warning whenever ';' is chosen. load_table() now calls this for .csv (not .tsv, which stays hardcoded to tab). Also wrapped pd.errors.ParserError in _read_csv_with_fallback with a clearer, actionable ValueError (line number + likely cause) as a safety net for genuinely ragged files, without attempting any row realignment/repair."
verification: >
  Signal 1 (original repro): re-ran the exact reported command against the
  real file -- exit code 0, 320 columns / 2000 rows listed, no error.
  Signal 2 (mechanism): confirmed via reasoning_checkpoint above, backed by
  direct pd.read_csv(sep=';') success before any code change.
  Signal 3 (mutation guardrail): reverted only load.py (kept new tests) --
  both new regression tests failed as expected (proves they exercise the
  fix, not vacuously true); re-applied fix -- both pass.
  Signal 4 (regression): full self-test suite 35 -> 39 tests, all green,
  including existing comma-delimited fixture tests (mostra-tracer.csv)
  unaffected by the delimiter-sniff change.
  Signal 5 (never-silent): delimiter-detection warning is printed to both
  stdout (shape report) and stderr (AVÍS line) on the real file run.
  guardrail_verdict: accepted
files_changed:
  - scripts/pipeline/load.py
  - scripts/pipeline_selftest.py
