---
status: testing
phase: 02-offline-data-pipeline
source: [02-VERIFICATION.md]
started: 2026-08-26T14:10:00Z
updated: 2026-08-26T14:10:00Z
---

## Current Test

number: 1
name: Live homepage renders the synthetic survey card and KPI modal
expected: |
  One survey card visible on the homepage; title/description visibly state the data is
  synthetic; KPI modal shows the three measure KPIs with plausible values
  (edat≈46, satisfaccio≈5.3, recomanaria≈53, matching
  public/data/enquestes/mostra-sintetica_meta.json).
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
result: [pending]

### 2. Real-export privacy threshold sanity check
expected: |
  Run `uv run scripts/convert_enquesta.py <your-real-export> --list-columns`, then a real
  conversion, and read the printed privacy checklist. Judge whether MIN_GROUP_SIZE=5 and
  UNIQUENESS_RATIO_THRESHOLD=0.9 (scripts/pipeline/privacy.py) flag sensibly on actual survey
  data, not just the synthetic fixtures. Either "thresholds fine" or updated threshold values
  reported by the developer.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
