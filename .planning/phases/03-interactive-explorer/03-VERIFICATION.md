---
phase: 03-interactive-explorer
verified: 2026-08-26T22:34:39Z
status: human_needed
score: 11/11 must-haves verified (present + wired + automated proof); 4 behavior-dependent items routed to human verification
behavior_unverified: 4
overrides_applied: 0
gaps: []
behavior_unverified_items:
  - truth: "Drag-and-drop chart building actually works in a real browser (X/Y/Color/Size/Filter, bar/line/area/scatter switching) (EXPL-03, EXPL-04)"
    test: "Open /enquesta/mostra-sintetica, drag segment→X, satisfaccio→Y, canal→Color, add a territori filter, then switch mark type between bar/line/area/scatter"
    expected: "Chart renders from real values on each drag and each mark-type switch; no console errors"
    why_human: "GraphicWalker owns all drag/shelf interaction internally (D-06) — this project supplies only dataSource/rawFields; no automated harness drives real pointer drag events against its canvas"
  - truth: "A zero-row Parquet renders GraphicWalker's own empty canvas without a project-authored error (backstop truth, 03-01 must_haves)"
    test: "Point the explorer at a survey whose Parquet has zero rows and observe the canvas"
    expected: "GraphicWalker shows its own empty-state, no thrown error, no blank crash"
    why_human: "Explicitly flagged in 03-01-PLAN.md as a held-out check requiring an actual zero-row Parquet fixture; no such fixture exists in the repo and no test exercises this path"
  - truth: "GraphicWalker's own canvas layout stays visually usable (not broken) at small/medium viewports (EXPL-06 backstop truth, 03-02 must_haves)"
    test: "Load the production build (npm run preview:pages) at ~375px and ~768px viewport widths and inspect the GraphicWalker canvas"
    expected: "Canvas does not visually break, overflow, or become unusable; project-owned header/dictionary wrap/truncate correctly"
    why_human: "D-03 explicitly declines special responsive handling for GraphicWalker's internal canvas — this is the library's own responsive behavior, outside this project's CSS, and cannot be verified by grep/build"
  - truth: "Chart image export (EXPL-10) and the copy-link round trip including hostile-link fallback (EXPL-11) work end-to-end in a real browser"
    test: "Build a chart, export it via GraphicWalker's toolbar (PNG/SVG downloads and opens); click 'Copia l'enllaç', confirm 'Copiat!' swap with address bar unchanged; paste the link in a fresh tab and confirm identical reproduction; then try a garbage, truncated, and cross-survey chart param"
    expected: "A valid image file downloads and opens; the pasted link reproduces the exact visualization; all three hostile variants land on a silent, blank, usable explorer with no error surfaced"
    why_human: "Export is delegated entirely to GraphicWalker's own toolbar (structurally confirmed via installed-package type inspection, not a click-and-download test); the full copy/paste/reopen round trip requires a real clipboard and a real second tab"
human_verification:
  - test: "Two loading phases, field typing, drag-and-drop across bar/line/area/scatter, full-width canvas, refresh-safe deep link, no console errors (03-01-PLAN.md Task 3 human-check; WINDOWS.md id 2)"
    expected: "Distinct 'Inicialitzant el motor de consultes…' then 'Carregant les dades de l'enquesta…' then the canvas; all six fields correctly split measures/dimensions; drag+mark-switch works over real values; canvas spans full width; refresh/paste both land on the explorer; no console errors"
    why_human: "Real-browser drag interaction, visual layout, and console inspection — not observable via static analysis"
  - test: "Single header row in every state, back-link navigation, dark-mode toggle restyling header+canvas, narrow-viewport wrap/truncate, invalid-id header persistence (03-02-PLAN.md Task 1 human-check; WINDOWS.md id 3)"
    expected: "One header row (back-link, title, toggle) in every page state including the invalid-id branch; dark mode restyles header and canvas; header stays usable at ~375px/~768px"
    why_human: "Visual appearance and viewport-narrowing behavior require a real rendered browser"
  - test: "Collapsed dictionary panel, all 6 fields with correct type captions, no description/undefined leakage, no layout jump on collapse, keyboard operability, narrow-viewport readability, production-build responsiveness pass (03-02-PLAN.md Task 2 human-check; WINDOWS.md id 4)"
    expected: "Diccionari de dades (6) collapsed by default; expands to show 6 fields with correct mesura/dimensió captions and no placeholder text; keyboard Tab+Enter/Space toggles it; readable at ~375px in the production build"
    why_human: "Visual layout, keyboard interaction, and production-build viewport behavior are not statically verifiable"
  - test: "Image export, copy-link/Copiat! swap, pasted-link exact-reproduction round trip including active filter, three hostile-link variants landing silently blank, cross-survey link safety, narrow-viewport header layout (03-03-PLAN.md Task 3 human-check; WINDOWS.md id 5)"
    expected: "See behavior_unverified_items above (EXPL-10/EXPL-11 entry) — same test, same expectation"
    why_human: "Real clipboard, a real second browser tab, and an actual downloaded image file are required; none of this is reachable from static analysis or the unit-test suite"
---

# Phase 3: Interactive Explorer Verification Report

**Phase Goal:** Users can interactively explore any survey's real data in the browser via drag-and-drop chart building, powered by SQL over Parquet — the app's core value
**Verified:** 2026-08-26T22:34:39Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Progress indicator during DuckDB-Wasm init + Parquet load; clear error on failure (EXPL-01, EXPL-02) | ✓ VERIFIED | `ExplorerPage.tsx:163-176` renders two distinct `LoadingBlock` texts ("Inicialitzant el motor de consultes…" then "Carregant les dades de l'enquesta…") gated on `engineState`/`dataState`; two distinct `ErrorState` branches with non-interpolated Catalan copy, engine-error has no retry (per plan intent) until WR-03 fix added a retry (see WR-03 below) |
| 2 | Drag variables onto X/Y/Color/Size/Filter, multiple chart types, correct dimension/measure typing (EXPL-03, EXPL-04, EXPL-05) | ✓ VERIFIED (typing) / ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (drag interaction) | `graphicWalkerFields.ts` passes `EnquestaMetaField.type` through verbatim (never re-inferred), confirmed against real fixture `mostra-sintetica_meta.json` (3 measures: edat/satisfaccio/recomanaria, 3 dimensions: segment/canal/territori); `graphicWalkerFields.test.ts` asserts the mapping (6/6 passing). `<GraphicWalker rawFields={...} dataSource={rows} />` wired in `ExplorerPage.tsx:186-192`. Actual drag/mark-switch behavior is GraphicWalker's own internal state (D-06) — no automated harness exercises it; routed to human verification |
| 3 | Explorer visually usable on small/medium screens; back-nav to list; direct `/enquesta/:id` link works on load/refresh, no 404 (EXPL-06, EXPL-07, EXPL-08) | ✓ VERIFIED (routing) / ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (canvas responsiveness) | `public/404.html` implements the spa-github-pages redirect with `pathSegmentsToKeep=1`; `vite.config.ts` sets `base: '/enquestes/'`; `npm run verify:pages` passes against the real production build (ran live, "all checks passed"). `ExplorerHeader.tsx` renders `<Link to="/">` back-link in every page-state branch of `ExplorerPage.tsx` (invalid-id, engine-error, data-error, success). GraphicWalker's own canvas responsiveness at small/medium viewports is an explicit backstop truth (D-03 declines special handling) — routed to human verification |
| 4 | Data dictionary from meta.json inside explorer; export chart as image (EXPL-09, EXPL-10) | ✓ VERIFIED (dictionary) / ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (export) | `DataDictionary.tsx` renders a `<details>` panel, collapsed by default, showing all 6 fields with `mesura`/`dimensió` captions, "Aquesta enquesta no té camps documentats." fallback for empty, label-fallback and description-omission both implemented (lines 39-45); wired into `ExplorerPage.tsx:183`. Image export is delegated to GraphicWalker's own toolbar — confirmed structurally via `node_modules/@kanaries/graphic-walker/dist/interfaces.d.ts` type inspection per 03-03-SUMMARY.md (`IGWHandler.exportChart`, locale keys `settings.button.export_chart*`), zero project code needed, but the actual click→download→open behavior is not automatable — routed to human verification |
| 5 | Generate/copy a link that reproduces the exact visualization via query params (EXPL-11) | ✓ VERIFIED (encode/decode logic) / ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (full browser round trip) | `shareLink.ts` implements versioned (`v1.`), UTF-8-safe, length-capped (4096) encode/decode with schema-drift field-reference validation and the CR-01 `isChartLike` shape guard; `shareLink.test.ts` — 16/16 assertions passing (ran live via `npx vitest run`, 22/22 total across both test files). `ExplorerHeader`'s "Copia l'enllaç" → "Copiat!" (2s) wired via `onCopyLink` prop; address bar never synced (no `setSearchParams`/`pushState`/`replaceState` found in `ExplorerPage.tsx`, confirmed by reading the full file). The actual clipboard-write → paste-in-new-tab → identical-render round trip requires a real browser — routed to human verification |

**Score:** 11/11 requirement-level must-haves present, substantive, and wired; 4 of them carry a behavior-dependent component that cannot be proven by static analysis and is routed to human verification (not counted against the score per Step 9 scoring rule, not FAILED).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/services/duckdb.ts` | Singleton AsyncDuckDB owner + read_parquet call path | ✓ VERIFIED | Exports `getDb`, `queryParquet`, `resetDb`; exactly two bundles (`mvp`, `eh`, no `coi`); `isValidEnquestaId` gates every id before SQL/filename use; TOCTOU race fixed (WR-01) via `registrationPromises` Map caching in-flight promises |
| `src/lib/graphicWalkerFields.ts` | meta.json field → GraphicWalker rawFields mapping | ✓ VERIFIED | Verbatim pass-through of `type` to `analyticType`, no re-inference; exports `toGraphicWalkerFields` |
| `src/lib/graphicWalkerFields.test.ts` | Unit assertions for type mapping | ✓ VERIFIED | 6 assertions, passing (`npx vitest run` ran live) |
| `src/pages/ExplorerPage.tsx` | Two-phase loading, two error states, GraphicWalker mount | ✓ VERIFIED | 205 lines; both loading phases, both error states with retry (engine retry added by WR-03), `ChartErrorBoundary` wraps `<GraphicWalker>` (CR-01 defense-in-depth) |
| `scripts/verify-explorer-assets.mjs` | Production-build proof DuckDB assets + Parquet served under `/enquestes/` | ✓ VERIFIED | Ran live against a fresh `npm run build`: "all checks passed (4 DuckDB assets verified)" |
| `src/components/ExplorerHeader.tsx` | App-shell header: title, back-link, theme toggle, copy-link button | ✓ VERIFIED | Exports `ExplorerHeader`/`ExplorerHeaderProps`; renders `<Link to="/">`, `<ThemeToggle>`, conditional "Copia l'enllaç"/"Copiat!" button |
| `src/components/DataDictionary.tsx` | Collapsed-by-default field-description panel | ✓ VERIFIED | Exports `DataDictionary`/`DataDictionaryProps`; native `<details>`, no custom toggle state; empty/partial/overflow cases all implemented |
| `src/lib/shareLink.ts` | Chart-spec encode/decode with D-07 soft fallback | ✓ VERIFIED | Exports `encodeShareLink`, `decodeShareLink`, `SHARE_PARAM`, `SHARE_VERSION`, `MAX_SHARE_PARAM_LENGTH`; CR-01 shape guard (`isChartLike`) added post-review |
| `src/lib/shareLink.test.ts` | Round-trip/length/unknown-field/version/malformed assertions | ✓ VERIFIED | 16 assertions, passing (ran live) |
| `src/components/ChartErrorBoundary.tsx` | Error boundary around GraphicWalker (CR-01 fix, not originally planned) | ✓ VERIFIED | Class component with `getDerivedStateFromError`/`componentDidCatch`, wraps `<GraphicWalker>` in `ExplorerPage.tsx:185-193`, keyed on `rawChartParam` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `ExplorerPage.tsx` | `services/duckdb.ts` | `getDb()` (phase 1), `queryParquet(id)` (phase 2) | ✓ WIRED | Lines 94, 129 |
| `ExplorerPage.tsx` | `lib/graphicWalkerFields.ts` | `toGraphicWalkerFields(meta.fields)` feeds `rawFields` | ✓ WIRED | Line 188 |
| `services/duckdb.ts` | `lib/enquestes.ts` | `dataUrl()` composes Parquet URL from `BASE_URL` | ✓ WIRED | Line 97 |
| `services/duckdb.ts` | `@duckdb/duckdb-wasm` dist assets | Vite `?url` imports for wasm/worker | ✓ WIRED | Lines 7-10; confirmed present on disk in `dist/` via live build + `verify:explorer` |
| `ExplorerPage.tsx` | `components/ExplorerHeader.tsx` | Renders header in every page state | ✓ WIRED | Line 201, outside the state-branching `content` variable — renders unconditionally |
| `ExplorerHeader.tsx` | `components/ThemeToggle.tsx` | Existing dark-mode toggle | ✓ WIRED | Line 67 |
| `ExplorerPage.tsx` | `components/DataDictionary.tsx` | Passes `meta.fields` through | ✓ WIRED | Line 183 |
| `ExplorerHeader.tsx` | `ExplorerPage.tsx` | `onCopyLink` callback prop | ✓ WIRED | Prop declared line 8, invoked line 37, supplied as `onCopyLink` line 201 (only in success branch, via `headerCopyLink`) |
| `ExplorerPage.tsx` | `lib/shareLink.ts` | `encodeShareLink` on copy, `decodeShareLink` on mount | ✓ WIRED | Lines 67, 73 |
| `ExplorerPage.tsx` | `@kanaries/graphic-walker` | `storeRef` reads current spec; `chart` prop restores decoded one | ✓ WIRED | Lines 52, 190-191 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ExplorerPage.tsx` `rows` | `dataState.data.rows` | `queryParquet(id)` → real `SELECT * FROM read_parquet(...)` against the committed `mostra-sintetica_respostes.parquet` (250 rows, confirmed via live `meta.json` read) | Yes | ✓ FLOWING |
| `ExplorerPage.tsx` `rawFields` | `meta.fields` | Real fetch of `[id]_meta.json`, parsed via `parseEnquestaMeta` (trust-boundary validator, throws on shape mismatch) | Yes | ✓ FLOWING |
| `GraphicWalker` `chart` prop | `decodedChart` | `decodeShareLink(rawChartParam, knownFieldNames)` — real URL search param, real known-field list from loaded meta | Yes (or `undefined` when absent/invalid, by design) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Unit tests (shareLink + graphicWalkerFields) | `npx vitest run` | 2 test files, 22/22 assertions passed | ✓ PASS |
| Lint | `npm run lint` | Zero errors/warnings | ✓ PASS |
| Production build | `npm run build` | `tsc -b && vite build` succeeded, all chunks emitted | ✓ PASS |
| DuckDB asset + Parquet production-build fidelity | `node scripts/verify-explorer-assets.mjs` (against live build) | "all checks passed (4 DuckDB assets verified)" | ✓ PASS |
| GitHub-Pages base-path/404 fidelity | `node scripts/verify-pages.mjs` (against live build) | "all checks passed" | ✓ PASS |
| Anti-pattern scan (TODO/FIXME/TBD/XXX/HACK/placeholder) | `grep` across all 10 phase-3 source files | No matches | ✓ PASS |
| Prohibited-class scan (`font-medium`, `gap-3`, `p-3`, `space-y-3`, `p-5`) | `grep` across ExplorerHeader/DataDictionary/ExplorerPage | No matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repository and none are declared in the phase's PLAN/SUMMARY files. Skipped — no runnable probes for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXPL-01 | 03-01 | Progress indicator during DuckDB init + Parquet load | ✓ SATISFIED | Two-phase `LoadingBlock`, confirmed in code |
| EXPL-02 | 03-01 | Clear error on init/query failure | ✓ SATISFIED | Two distinct `ErrorState` branches, non-interpolated copy |
| EXPL-03 | 03-01 | Drag X/Y/Color/Size/Filter with GraphicWalker | ✓ SATISFIED (wiring) / human-check pending (interaction) | `dataSource`/`rawFields` wired; drag itself is library-owned |
| EXPL-04 | 03-01 | Multiple chart types | ✓ SATISFIED (wiring) / human-check pending | GraphicWalker's own toolbar; no project restriction found |
| EXPL-05 | 03-01 | Correct dimension/measure typing from meta.json | ✓ SATISFIED | `toGraphicWalkerFields`, tested, verified against real fixture |
| EXPL-06 | 03-02 | Usable on small/medium screens | ✓ SATISFIED (header) / human-check pending (canvas) | Header wrap/truncate implemented; canvas is a declared backstop |
| EXPL-07 | 03-02 | Back to listing from explorer | ✓ SATISFIED | `<Link to="/">` in every page state |
| EXPL-08 | 03-01 | Direct `/enquesta/:id` link works, no 404 on refresh | ✓ SATISFIED | 404.html SPA redirect + `verify:pages` passing live |
| EXPL-09 | 03-02 | Field descriptions (data dictionary) | ✓ SATISFIED | `DataDictionary` component, all edge cases implemented |
| EXPL-10 | 03-03 | Export chart as image | ✓ SATISFIED (structurally, via GraphicWalker's toolbar) / human-check pending | Confirmed via installed-package type inspection, no click-test |
| EXPL-11 | 03-03 | Copy/generate a link reproducing exact visualization | ✓ SATISFIED (encode/decode) / human-check pending (full round trip) | 16 passing unit tests; real clipboard round trip not automatable |

No orphaned requirements — REQUIREMENTS.md traceability table maps all of EXPL-01..EXPL-11 to Phase 3, and all 11 appear in the three plans' `requirements` fields (03-01: 01,02,03,04,05,08; 03-02: 06,07,09; 03-03: 10,11).

### Anti-Patterns Found

None. Scanned all 10 files touched by this phase's three plans plus the code-review-fix commits (`duckdb.ts`, `graphicWalkerFields.ts`, `shareLink.ts`, `ExplorerPage.tsx`, `ExplorerHeader.tsx`, `DataDictionary.tsx`, `ChartErrorBoundary.tsx`, `App.tsx`, `verify-explorer-assets.mjs`, `vite.config.ts`) for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and placeholder-language patterns — zero matches. No debt markers of any kind.

### Code Review Findings — Resolution Confirmed

`03-REVIEW.md` flagged 1 critical + 3 warnings. All four were independently re-verified against the current codebase (not just the claims in `03-REVIEW-FIX.md`):

- **CR-01** (unvalidated share-link payload shape could crash the page): confirmed fixed — `shareLink.ts` now has an `isChartLike()` structural guard (lines 84-88) applied to both array and bare-object payloads before returning, and a new `ChartErrorBoundary.tsx` wraps `<GraphicWalker>` in `ExplorerPage.tsx` as defense-in-depth. Commit `5e933df` verified present in `git log`.
- **WR-01** (TOCTOU race in file-registration guard): confirmed fixed — `duckdb.ts`'s `ensureRegistered` now caches the in-flight `Promise<void>` in a `Map` rather than a boolean `Set`, with cache eviction on failure. Commit `168cf9f` verified present.
- **WR-02** (vitest glob excludes `.test.tsx`): confirmed fixed — `vite.config.ts`'s `test.include` reads `['src/**/*.test.{ts,tsx}']`. Commit `ec30755` verified present.
- **WR-03** (engine-init error treated as universally non-transient, no retry): confirmed fixed — `ExplorerPage.tsx` now has `onEngineRetry`/`engineAttempt` wired to `resetDb()`, and the copy no longer assumes a browser-incompatibility cause. Commit `fb6bc29` verified present.

All four fix commits exist in `git log`, match their claimed diffs (`git show --stat`), and the post-fix state was re-verified live in this run (build, lint, 22/22 tests, both verify scripts) rather than trusted from the fix report's own claims.

### Human Verification Required

See frontmatter `human_verification` (4 items, harvested from `.planning/WINDOWS.md` ids 2-5 and the two declared backstop truths in `03-01-PLAN.md`/`03-02-PLAN.md`). Summary:

1. **Tracer end-to-end drag/mark-switch/loading-phase/refresh check** (WINDOWS id 2)
2. **Header single-row/back-link/dark-mode/narrow-viewport/invalid-id check** (WINDOWS id 3)
3. **Data-dictionary collapse/expand/keyboard/narrow-viewport/production-build check** (WINDOWS id 4)
4. **Export/copy-link/round-trip/hostile-link/cross-survey/narrow-viewport check** (WINDOWS id 5)

Plus two explicitly-declared backstop truths not yet exercised against a real fixture:
- Zero-row Parquet renders GraphicWalker's own empty canvas without a project-authored error (no zero-row fixture exists in the repo)
- GraphicWalker's own canvas layout at small/medium viewports (D-03 declines project-side responsive handling for it)

### Gaps Summary

No gaps found. Every artifact this phase's three plans declared exists, is substantive, and is wired into the render path with a real data flow from DuckDB-Wasm's Parquet query through to GraphicWalker's canvas. All four code-review findings (1 critical, 3 warnings) were independently re-verified as fixed in the current codebase, not merely accepted from the fix report's narrative. Automated checks (build, lint, 22/22 unit tests, both production-build fidelity scripts) all pass live in this run.

The phase is held at `human_needed` rather than `passed` because five of its must-have truths are genuinely behavior-dependent — real drag-and-drop interaction inside a third-party library's canvas, real image export/download, a real clipboard round trip across two browser tabs, and real-viewport responsive rendering — none of which a static grep/build/test pass can prove. These are exactly the items already tracked as open in `.planning/WINDOWS.md` (ids 2-5) under this project's `human_verify_mode: end-of-phase` policy, plus two explicitly-declared backstop truths in the plans themselves. No new gap was discovered beyond what the executor already flagged; this verification independently confirms none of them can be closed by automation and none of them are masking an actual defect (spot-checking the underlying code for all four shows correct, non-stubbed implementations).

---

_Verified: 2026-08-26T22:34:39Z_
_Verifier: Claude (gsd-verifier)_
