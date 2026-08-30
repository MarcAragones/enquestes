---
status: testing
phase: 04-real-survey-conversion-publication
source: [04-VERIFICATION.md]
started: 2026-08-30T17:15:00Z
updated: 2026-08-30T17:15:00Z
---

## Current Test

number: 1
name: Homepage card rendering for each published survey
expected: |
  Each card's displayed title/date/description/participant count matches the operator-supplied
  metadata (REO1167, REO1151, REO1145, mostra-sintetica), with no cross-survey mixups.
awaiting: user response

## Tests

### 1. Homepage card rendering for each published survey
expected: Open the local preview and confirm, for each published survey card (REO1167, REO1151, REO1145, mostra-sintetica), that the title, date, description and participant count are the ones intended for that survey, and that no card shows another survey's details.
result: [pending]

### 2. Surviving column set matches operator expectations per survey
expected: For each of the three real surveys, confirm the surviving column list (REO1167 283 cols, REO1151 291 cols, REO1145 263 cols) is acceptable — no column considered essential was dropped by the free-text exclusion or the cardinality cutoff.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
