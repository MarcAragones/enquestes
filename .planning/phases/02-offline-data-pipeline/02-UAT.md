---
status: testing
phase: 02-offline-data-pipeline
source: [02-VERIFICATION.md]
started: 2026-08-26T14:10:00Z
updated: 2026-08-26T14:20:00Z
---

## Current Test

number: 2
name: Real-export privacy threshold sanity check
expected: |
  Run `uv run scripts/convert_enquesta.py <your-real-export> --list-columns`, then a real
  conversion, and read the printed privacy checklist. Judge whether MIN_GROUP_SIZE=5 and
  UNIQUENESS_RATIO_THRESHOLD=0.9 (scripts/pipeline/privacy.py) flag sensibly on actual survey
  data, not just the synthetic fixtures. Either "thresholds fine" or updated threshold values
  reported by the developer.
awaiting: user response

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
result: [pending]
note: "Blocked on the --list-columns/--id bug (G-02-2), now fixed in commit c8edb19 and re-verified against the fixture. Re-run against your real export to complete this test."

## Summary

total: 2
passed: 1
issues: 0
pending: 1
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
