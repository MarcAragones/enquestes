---
status: testing
phase: 03-interactive-explorer
source: [03-VERIFICATION.md]
started: 2026-08-27T00:40:00Z
updated: 2026-08-27T23:51:52Z
---

## Current Test

number: 5
name: SurveySummaryModal StrictMode lifecycle + fresh content on id change
expected: |
  1. Run `npm run dev`. On the homepage, click a survey card. The modal opens and STAYS open (no immediate flash-close).
  2. With the modal open, press Escape — it closes and the `?enquesta=` param is removed.
  3. Reopen it, click the backdrop (outside the dialog) — it closes the same way.
  4. Reopen it, click "Tanca" — it closes the same way.
  5. Navigate so two different `?enquesta=` history entries exist, then use the browser Back/Forward buttons to switch between them while the modal stays mounted — the modal should show a loading state for the new id, never the previous survey's stale content.
  6. Repeat step 1 against the production build (`npm run build && npm run preview:pages`) to confirm no regression there.
awaiting: user response

## Tests

### 1. Tracer end-to-end — loading phases, field typing, drag-and-drop, mark switching, full-width canvas, refresh-safe deep link
expected: See "Current Test" above (03-01-PLAN.md Task 3 human-check; WINDOWS.md id 2)
result: pass

### 2. Explorer header — single row in every state, back-link, dark-mode toggle, narrow-viewport wrap
expected: |
  1. Exactly one header row is visible: back-link on the left with the survey title beside it, dark-mode toggle on the right. No date, no description, no participant count.
  2. Clicking "← Torna al llistat d'enquestes" lands on the survey catalog.
  3. Toggling dark mode restyles the header and, if GraphicWalker's appearance prop was found, the canvas too — no light-panel-inside-dark-page mismatch.
  4. Narrow the window to ~375px and then ~768px: the header wraps or truncates but the back-link and toggle stay reachable and nothing overflows horizontally.
  5. Visit /enquesta/no-existeix-aquesta — the header still renders and the back-link still works alongside the "No s'ha trobat aquesta enquesta." copy.
result: issue
reported: "Veig dos errors. 1. Critic. Quan vaig a la pàgina inicial i clico una enquesta, s'obre el pop-up però es tanca immediatament. 2. Petit. Quan vaig a l'enllaç d'una enquesta que no existeix, l'error que surt és \"No s'han pogut carregar les enquestes\". Sembla que està intentant carregar una cosa que no existeix."
severity: blocker

### 3. Data dictionary panel — collapse/expand, field rendering, keyboard operability, narrow viewport, production build
expected: |
  1. A collapsed "Diccionari de dades (6)" control sits between the header and the canvas; the canvas is still the dominant element on first paint.
  2. Expanding it lists all six fields — edat, satisfaccio, recomanaria, segment, canal, territori — each showing its raw name and its type as `mesura` or `dimensió`, with no description line and no "undefined" text anywhere.
  3. Collapsing it restores the canvas position with no layout jump.
  4. It is keyboard operable: Tab to the summary, Enter/Space expands and collapses it.
  5. At ~375px width the panel and its rows stay readable with no horizontal overflow.
  6. Run `npm run build` + `npm run preview:pages` and repeat checks 1-5 against the production build served under /enquestes/, including a check that GraphicWalker's own canvas is not visually broken at ~375px and ~768px.
result: pass

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
result: issue
reported: "1. Si copio l'enllaç, no veig la gràfica que havia fet prèviament. 2. El bar chart no ocupa tot l'espai. Queda reduit a una petita part. Hauria de ser mes gran"
severity: major

### 5. SurveySummaryModal StrictMode lifecycle + fresh content on id change (G-03-2, WR-03 gap-closure fix)
expected: |
  1. Run `npm run dev`. On the homepage, click a survey card. The modal opens and STAYS open (no immediate flash-close).
  2. With the modal open, press Escape — it closes and the `?enquesta=` param is removed.
  3. Reopen it, click the backdrop (outside the dialog) — it closes the same way.
  4. Reopen it, click "Tanca" — it closes the same way.
  5. Navigate so two different `?enquesta=` history entries exist, then use the browser Back/Forward buttons to switch between them while the modal stays mounted — the modal should show a loading state for the new id, never the previous survey's stale content.
  6. Repeat step 1 against the production build (`npm run build && npm run preview:pages`) to confirm no regression there.
result: pending

### 6. Not-found vs load-failed error copy (G-03-2b gap-closure fix)
expected: |
  1. In the production preview, visit `/enquesta/no-existeix-aquesta` and a malformed id. Both should show "No s'ha trobat aquesta enquesta." with NO retry button.
  2. Confirm `mostra-sintetica` still loads normally (no regression).
  3. If you can force a genuine transient load failure (e.g. offline/throttled network on a valid id), confirm it still shows the load-failed heading WITH a working "Torna-ho a provar" retry — distinct from the not-found copy in step 1.
result: pending

### 7. Chart canvas fill + share-link round trip at full size (G-03-4, G-03-4b gap-closure fixes)
expected: |
  Run `npm run build` then `npm run preview:pages`, work against http://localhost:4173/enquestes/enquesta/mostra-sintetica:
  1. Build a bar chart (e.g. segment on X, satisfaccio on Y). Confirm it visually fills the canvas area — NOT a small box surrounded by empty space. Repeat for line and scatter mark types.
  2. Click "Copia l'enllaç", paste into a fresh tab. Confirm it reproduces the EXACT same chart (same fields/shelves/mark type) AND renders it at full size (not shrunk).
  3. Hand-edit the pasted URL's chart parameter to garbage, truncate it, and try a link built for a different survey id — each should land on a silent, blank, usable explorer with no error.
  4. At ~375px and ~768px widths, confirm the header, data dictionary, and canvas all stay reachable with no horizontal overflow, in both light and dark mode.
result: pending

## Summary

total: 7
passed: 2
issues: 2
pending: 3
skipped: 0
blocked: 0

## Deferred Follow-Ups

- test: 1
  idea: "Share-link URL is long (full GraphicWalker chart spec, base64url-encoded, no compression). User asked if it can be shortened. No backend available for a real short-link service (project is $0 static site); options for later: compress payload before base64, or trim spec to only non-default fields before encoding."
  deferred_at: 2026-08-27

## Gaps

- gap_id: G-03-2
  truth: "Clicking a survey card on the homepage opens SurveySummaryModal and it stays open until the user dismisses it"
  status: failed
  reason: "User reported: the popup opens then closes immediately when clicking a survey from the homepage"
  severity: blocker
  test: 2
  root_cause: "SurveySummaryModal.tsx splits the native <dialog> lifecycle across two effects that are not StrictMode-safe: one calls dialog.close() on cleanup, the other attaches a 'close' listener that invokes onClose (which deletes the ?enquesta= param that keeps the modal mounted, per HomePage.tsx). StrictMode's dev-only simulated mount/unmount/remount triggers the cleanup's dialog.close(), which fires the close listener, which deletes the URL param — a real, persistent state change caused by a simulated unmount. Pre-existing Phase 1 defect (HomePage.tsx/SurveySummaryModal.tsx unchanged since Phase 1); it was masked because Phase 1's own verification ran against a production preview build (no StrictMode double-invoke), and this UAT test ran via `npm run dev` (StrictMode active) without that call-out."
  artifacts:
    - path: "src/components/SurveySummaryModal.tsx"
      issue: "Two non-idempotent effects (imperative dialog.close() cleanup + close-event listener invoking onClose) fire a spurious close during StrictMode's simulated unmount"
    - path: "src/pages/HomePage.tsx"
      issue: "Modal's mounted state is driven entirely by the ?enquesta= URL param, so the spurious onClose is a real, persistent state change, not a harmless flicker"
  missing:
    - "Make the dialog lifecycle StrictMode-idempotent — e.g. guard cleanup so it doesn't unconditionally close on every simulated unmount, and/or distinguish user-initiated close from effect cleanup so onClose only fires for genuine dismissal"
  debug_session: ".planning/debug/g-03-2-modal-closes-immediately.md"

- gap_id: G-03-2b
  truth: "Visiting /enquesta/{invalid-id} shows the ExplorerPage's invalid-id copy ('No s'ha trobat aquesta enquesta.'), not the HomePage's list-load-failure copy"
  status: failed
  reason: "User reported: visiting a non-existent survey link shows \"No s'han pogut carregar les enquestes\" (the homepage's survey-list load-failure message) instead of the expected not-found message — looks like it's trying to fetch something that doesn't exist"
  severity: minor
  test: 2
  root_cause: "ExplorerPage.tsx's phase-2 (data-load) error branch renders <ErrorState message={...} onRetry={...}/> without a title prop, so it falls back to ErrorState.tsx's default title — character-identical to HomePage's own list-load-failure heading. 'no-existeix-aquesta' passes isValidEnquestaId's format-only regex (it doesn't check existence), so the dedicated not-found branch never fires; execution reaches phase 2, metaUrl(id) 404s, and lands in the title-less generic error branch. Traces back to 03-01-PLAN.md's task spec, which only specified a message for this branch, never a distinct title."
  artifacts:
    - path: "src/pages/ExplorerPage.tsx"
      issue: "Phase-2 data-error <ErrorState> render (line ~176) omits an explicit title prop, unlike the engine-error branch which passes one"
    - path: "src/components/ErrorState.tsx"
      issue: "Default title literal is shared verbatim with HomePage's list-load-failure heading"
  missing:
    - "Give ExplorerPage's phase-2 error branch its own explicit title, distinct from HomePage's"
    - "Consider a dedicated 'this survey doesn't exist' treatment for a metaUrl 404 specifically, distinct from generic transient-fetch-failure copy"
  debug_session: ".planning/debug/g-03-2b-wrong-error-copy.md"

- gap_id: G-03-4
  truth: "Pasting a copied share link into a fresh tab opens on the identical visualization the sharer had built (EXPL-11)"
  status: failed
  reason: "User reported: after copying the link, the chart they had previously built is not shown when the link is opened"
  severity: major
  test: 4
  root_cause: "decodeShareLink's schema-drift field-reference guard (step 6, built for T-03-11) recursively collects every 'fid' anywhere in the decoded JSON and rejects the whole payload if any fid is absent from knownFieldNames (the survey's real meta.json field names). GraphicWalker's real VizSpecStore.exportCode() always populates encodings.dimensions/measures with the full field catalogue PLUS three GraphicWalker-internal virtual field ids (gw_count_fid, gw_mea_key_fid, gw_mea_val_fid) that are never in any survey's meta.json. This rejects every real, valid chart spec unconditionally — not just hostile/stale links. shareLink.test.ts's hand-authored makeSpec() fixture only includes shelf-assigned fields and omits the virtual fids GraphicWalker always emits, so the 16-test suite never exercised this failure. Confirmed via direct reproduction (a throwaway test constructing a realistic exportCode() shape reproduced decodeShareLink returning undefined for it)."
  artifacts:
    - path: "src/lib/shareLink.ts"
      issue: "decodeShareLink step 6 validates fid references across the ENTIRE decoded object graph (including dimensions/measures catalogue arrays, which represent 'all available fields', not 'fields actually used'), rather than only the shelf-assignment channels (rows/columns/color/filters/etc.)"
    - path: "src/lib/shareLink.test.ts"
      issue: "makeSpec() fixture doesn't model GraphicWalker's real export shape (missing full field catalogue + gw_count_fid/gw_mea_key_fid/gw_mea_val_fid virtual fields), masking the bug"
  missing:
    - "Restrict the schema-drift fid check to shelf-assignment channels only, or allowlist GraphicWalker's known virtual field ids (gw_count_fid, gw_mea_key_fid, gw_mea_val_fid)"
    - "Update shareLink.test.ts's makeSpec() fixture to match a real exportCode() shape so this regression class is caught going forward"
  debug_session: ".planning/debug/g-03-4-share-link-restore.md"

- gap_id: G-03-4b
  truth: "The GraphicWalker chart canvas fills the available space rather than rendering small"
  status: failed
  reason: "User reported: the bar chart doesn't occupy all the space — it's reduced to a small part, should be bigger"
  severity: minor
  test: 4
  root_cause: "GraphicWalker defaults every newly-created chart to layout.size.mode 'auto' (fixed 320x200-ish shrink-to-content sizing) unless the host passes a defaultConfig prop setting layout.size.mode to 'full', which is the only mode that measures the container via useResizeDetector() and stretches the chart to fill it. ExplorerPage.tsx's <GraphicWalker> mount never passes defaultConfig, so every chart is created in the small, unconfigured 'auto' mode. Confirmed by reading the installed package's own source (utils/save.js's emptyVisualLayout default, renderer/specRenderer.js and vis/react-vega.js's mode-gated container measurement)."
  artifacts:
    - path: "src/pages/ExplorerPage.tsx"
      issue: "<GraphicWalker> mount (lines ~186-192) is missing a defaultConfig prop that would set layout.size.mode to 'full'"
  missing:
    - "Pass defaultConfig={{ layout: { size: { mode: 'full', width: 0, height: 0 } } }} (or equivalent) to <GraphicWalker> in ExplorerPage.tsx"
    - "Note: only affects newly-created charts — a chart restored via the chart={decodedChart} share-link prop carries its own serialized layout.size, so interacts with gap G-03-4's fix"
  debug_session: ".planning/debug/g-03-4b-graphicwalker-small-canvas.md"

Two backstop truths from the plans have no automatable test and no held-out fixture, and are not part of the 4 tests above since they require assets that don't exist yet:
- Zero-row Parquet rendering GraphicWalker's own empty canvas (03-01-PLAN.md backstop truth) — no zero-row Parquet fixture exists in the repo.
- GraphicWalker's own canvas responsiveness at small/medium viewports is exercised implicitly within tests 3 and 4 above (production-build viewport checks), not as a separate test.
