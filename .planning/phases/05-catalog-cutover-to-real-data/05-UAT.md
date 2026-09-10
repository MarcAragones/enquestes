---
status: testing
phase: 05-catalog-cutover-to-real-data
source: [05-VERIFICATION.md]
started: 2026-09-10T07:35:00Z
updated: 2026-09-10T07:35:00Z
---

## Current Test

number: 1
name: Homepage shows exactly three real survey cards
expected: |
  Exactly three survey cards render — the two Baròmetre d'Opinió Política waves and the Enquesta longitudinal — with no synthetic/demo card and no stray text referencing generated/sample data.
awaiting: user response

## Tests

### 1. Homepage shows exactly three real survey cards
expected: Open a production preview build (`npm run preview:pages`, http://localhost:4173/enquestes/) and view the homepage. Exactly three survey cards render — the two Baròmetre d'Opinió Política waves and the Enquesta longitudinal — with no synthetic/demo card and no stray text referencing generated/sample data.
result: [pending]

### 2. Each survey's summary modal shows its own data
expected: Click each of the three cards' summary modal in turn. Each modal shows that survey's own title, date, description, participant count (2.000 / 6.706 / 2.000) and its own KPI tiles (6 / 1 / 4), never another survey's, and never a suppression placeholder.
result: [pending]

### 3. Explorer loads each survey's own fields; no bleed when switching surveys
expected: From each summary, open the explorer, drag a field onto X and another onto Y to build a chart, then navigate back to the catalog and open a different survey's explorer. Each explorer's data dictionary and GraphicWalker field list show only that survey's own fields; dragging fields produces a real chart; no trace of the previously viewed survey's fields appears after switching.
result: [pending]
priority: high

### 4. Share-link restores on same survey, degrades silently on a different one
expected: On REO1151, build a chart using IDENTIFICADOR_COMPLET, click "Copia l'enllaç", open the copied URL in a new tab, then edit only the survey id in that URL to REO1167 and open it. The REO1151 tab restores the exact chart. The edited REO1167 URL loads normally with an empty default chart — no error banner, no blank canvas, no chart built from REO1151's fields.
result: [pending]

### 5. Not-found message renders for a non-existent survey id
expected: Open http://localhost:4173/enquestes/enquesta/no-existeix-aquesta directly in a browser. The not-found message renders with no retry button — not a spinner, not a load-failure message.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
