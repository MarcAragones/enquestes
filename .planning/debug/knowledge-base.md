# GSD Debug Knowledge Base

Resolved debug sessions. Used by `gsd-debugger` to surface known-pattern hypotheses at the start of new investigations.

---

## g-02-3-csv-parse-gap — CSV loader hardcoded ',' delimiter, real export used ';'
- **Date:** 2026-08-26
- **Error patterns:** Error tokenizing data, C error, Expected N fields in line M saw K, pandas ParserError, ragged CSV, CSV delimiter, semicolon-delimited, Spanish/Catalan locale export
- **Root cause(s):** `scripts/pipeline/load.py`'s `load_table()` hardcoded `sep=","` for all `.csv` files; the real export used `;` as its field delimiter (a common Spanish/Catalan-locale spreadsheet export convention). The comma-free header established a 1-field expectation that later rows (with incidental commas inside quote-less free text) violated, tripping pandas' C tokenizer.
- **Fix:** Added `_detect_csv_delimiter()`: sniffs `,` vs `;` from the header line, picks whichever occurs more often (ties default to `,`), always warns (never silent) when `;` is chosen. Also wrapped `pd.errors.ParserError` with a clearer, actionable `ValueError` (exact line + likely cause) as a safety net for genuinely ragged files, without attempting to guess/repair row alignment.
- **Files changed:** scripts/pipeline/load.py, scripts/pipeline_selftest.py
- **Why not caught:** No gate existed for this class — the pipeline's only prior CSV fixture (`mostra-tracer.csv`) used `,`, so no test exercised a `;`-delimited real-world export shape before this UAT run against real user data surfaced it.
- **Recurrence guard:** Regression tests in `scripts/pipeline_selftest.py::LoadTableTests` — `test_semicolon_delimited_csv_is_detected_and_warned`, `test_comma_delimited_csv_with_quoted_semicolon_stays_comma`, `test_tied_delimiter_counts_default_to_comma`, `test_ragged_csv_raises_actionable_value_error`.
---

