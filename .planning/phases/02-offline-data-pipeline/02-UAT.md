---
status: partial
phase: 02-offline-data-pipeline
source: [02-VERIFICATION.md]
started: 2026-08-26T14:10:00Z
updated: 2026-08-26T14:35:00Z
---

## Current Test

[testing paused — 1 item outstanding: G-02-3, a CSV parse error against the user's real export, not yet diagnosed]

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
  status: failed
  reason: "User reported: uv run scripts/convert_enquesta.py --list-columns /Users/marcaragones/Downloads/REO1167_microdades_anonimitzades.csv → ERROR: Error tokenizing data. C error: Expected 8 fields in line 4, saw 10"
  severity: major
  test: 2
  root_cause: "NOT YET DIAGNOSED. pandas' C CSV parser rejects the file outright (ragged row shape — line 4 has 2 more fields than the header). load.py currently has no fallback for this (only encoding fallback and post-load shape-sanity warnings, which never run because the read itself throws). Needs investigation against the actual file: could be an unescaped delimiter inside an unquoted field, a stray extra column on some rows, or a genuinely different delimiter/dialect than assumed. This surfaced against the user's real export, not a fixture -- this is exactly the 'real-world data shape' class of gap the phase's own STATE.md concern flagged as unverified."
  artifacts: []
  missing:
    - "Diagnose the actual malformed row in the user's CSV (line 4 vs header) to determine whether this is a data problem (recommend the user re-export/fix) or a pipeline robustness gap (e.g. pandas engine='python' with on_bad_lines handling, or csv.Sniffer-based dialect detection)"
  debug_session: ""
