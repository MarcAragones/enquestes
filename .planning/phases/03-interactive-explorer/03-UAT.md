---
status: testing
phase: 03-interactive-explorer
source: [03-VERIFICATION.md]
started: 2026-08-27T00:40:00Z
updated: 2026-08-27T00:40:00Z
---

## Current Test

number: 1
name: Tracer end-to-end — loading phases, field typing, drag-and-drop, mark switching, full-width canvas, refresh-safe deep link
expected: |
  Open /enquesta/mostra-sintetica and confirm:
  1. "Inicialitzant el motor de consultes…" appears, then "Carregant les dades de l'enquesta…", then the GraphicWalker canvas — two visibly distinct phases, not one spinner.
  2. The field list shows all six fields, with edat/satisfaccio/recomanaria under measures and segment/canal/territori under dimensions.
  3. Dragging segment to X and satisfaccio to Y draws a chart from real values, and the toolbar can switch that chart between bar, line, area and scatter/point marks.
  4. The canvas spans the full browser width — not boxed inside a ~768px column — and exactly one header row is visible above it.
  5. Refreshing the page and pasting the URL into a new tab both land on the explorer, never a 404 or a blank screen.
  6. The browser console shows no errors mentioning styled-components, apache-arrow, or a failed Worker construction.
awaiting: user response

## Tests

### 1. Tracer end-to-end — loading phases, field typing, drag-and-drop, mark switching, full-width canvas, refresh-safe deep link
expected: See "Current Test" above (03-01-PLAN.md Task 3 human-check; WINDOWS.md id 2)
result: [pending]

### 2. Explorer header — single row in every state, back-link, dark-mode toggle, narrow-viewport wrap
expected: |
  1. Exactly one header row is visible: back-link on the left with the survey title beside it, dark-mode toggle on the right. No date, no description, no participant count.
  2. Clicking "← Torna al llistat d'enquestes" lands on the survey catalog.
  3. Toggling dark mode restyles the header and, if GraphicWalker's appearance prop was found, the canvas too — no light-panel-inside-dark-page mismatch.
  4. Narrow the window to ~375px and then ~768px: the header wraps or truncates but the back-link and toggle stay reachable and nothing overflows horizontally.
  5. Visit /enquesta/no-existeix-aquesta — the header still renders and the back-link still works alongside the "No s'ha trobat aquesta enquesta." copy.
result: [pending]

### 3. Data dictionary panel — collapse/expand, field rendering, keyboard operability, narrow viewport, production build
expected: |
  1. A collapsed "Diccionari de dades (6)" control sits between the header and the canvas; the canvas is still the dominant element on first paint.
  2. Expanding it lists all six fields — edat, satisfaccio, recomanaria, segment, canal, territori — each showing its raw name and its type as `mesura` or `dimensió`, with no description line and no "undefined" text anywhere.
  3. Collapsing it restores the canvas position with no layout jump.
  4. It is keyboard operable: Tab to the summary, Enter/Space expands and collapses it.
  5. At ~375px width the panel and its rows stay readable with no horizontal overflow.
  6. Run `npm run build` + `npm run preview:pages` and repeat checks 1-5 against the production build served under /enquestes/, including a check that GraphicWalker's own canvas is not visually broken at ~375px and ~768px.
result: [pending]

### 4. Chart export, copy-link round trip, and hostile-link fallback (production build)
expected: |
  Run `npm run build` then `npm run preview:pages` and work against the production build at http://localhost:4173/enquestes/enquesta/mostra-sintetica:
  1. Build a chart: segment on X, satisfaccio on Y, canal on Color, and add a filter on territori. Switch the mark to a line, then to a scatter/point.
  2. Export it as an image using GraphicWalker's own toolbar control. A PNG or SVG downloads and opens correctly.
  3. Click "Copia l'enllaç". The label swaps to "Copiat!" and reverts after about two seconds. The address bar has NOT changed.
  4. Paste the copied link into a fresh tab. It opens on the identical visualization — same fields on the same shelves, same mark type, and the territori filter still applied.
  5. Hand-edit the pasted URL's chart parameter to garbage and load it. The explorer opens blank and usable, with no error message, no alert box, and no red console exception.
  6. Truncate the chart parameter to a few characters and load it. Same silent blank result.
  7. Paste a link built for a different survey id and confirm it opens that survey's explorer without applying a spec referencing fields that survey does not have.
  8. At ~375px width the header still wraps or truncates without pushing the Copy-link button off-screen.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps

Two backstop truths from the plans have no automatable test and no held-out fixture, and are not part of the 4 tests above since they require assets that don't exist yet:
- Zero-row Parquet rendering GraphicWalker's own empty canvas (03-01-PLAN.md backstop truth) — no zero-row Parquet fixture exists in the repo.
- GraphicWalker's own canvas responsiveness at small/medium viewports is exercised implicitly within tests 3 and 4 above (production-build viewport checks), not as a separate test.
