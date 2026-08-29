---
status: complete
phase: 01-foundation-survey-listing
source: [01-VERIFICATION.md]
started: 2026-08-26T09:20:00Z
updated: 2026-08-26T09:40:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Live site + fixture-preview visual/responsive confirmation
expected: |
  Open the live GitHub Pages URL (https://marcaragones.github.io/enquestes/) in a real browser.
  Confirm the empty-catalog panel renders ("Encara no hi ha cap enquesta publicada"), toggle
  dark/light theme and reload to confirm it persists, then rebuild locally with
  `node scripts/gh-pages-preview.mjs --fixtures scripts/fixtures` and open
  http://localhost:4173/enquestes/. Catalog renders three-up on desktop, two-up on tablet,
  one-up on mobile. Zero-participant survey reads "0 participants", not blank. The title
  containing "<script>alert(1)</script>" renders as literal text, never executes and never
  appears as bold/markup. Theme toggle flips the whole page and the choice survives reload.
result: pass

### 2. Summary modal interaction (dialog focus, Back, Escape, CTA hand-off)
expected: |
  With the fixture preview server running, click the "demo-2024" card, inspect the opened
  summary panel, press the browser Back button, reopen and press Escape, then click "Explorar
  dades interactives". Summary opens as a modal dialog over the catalog with title/date/full
  description/participant count and three KPI tiles: an ordinary KPI with a unit, one with its
  own larger sample, and the below-threshold KPI showing "Mostra insuficient per publicar
  aquest valor" instead of a value — every non-suppressed KPI also shows its "n = ..." line.
  The address bar gains ?enquesta=demo-2024. Back and Escape both close the modal back to the
  plain catalog (not a blank page). The CTA navigates to /enquestes/enquesta/demo-2024, landing
  on the "encara no està disponible" page with a working link back — never a blank page, and
  reloading that URL does not 404.
result: pass

### 3. Sign-off on the 8 judgment-tier prohibitions
expected: |
  Confirm the eight must_haves.prohibitions recorded across the three plans (privacy: no
  respondent-level data on cards/deploy, exact unrounded participant counts, small-sample KPI
  suppression, sample size always shown, distinct failure-vs-empty presentation, honest
  not-yet-available explorer, and the redirect round trip never dropping the visitor's original
  path). Each prohibition holds by code inspection (see "Prohibitions Verification" in
  01-VERIFICATION.md); a human sign-off closes out the status: unverified/flagged: true markers
  the planner left in each plan's frontmatter.
result: pass

## Summary

total: 3
passed: 3
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
