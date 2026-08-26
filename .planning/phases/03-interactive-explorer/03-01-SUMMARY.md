---
phase: 03-interactive-explorer
plan: 01
subsystem: data-viz
tags: [duckdb-wasm, graphic-walker, parquet, vitest, tdd, vite, sql-in-browser]

requires:
  - phase: 02-offline-data-pipeline
    provides: "public/data/enquestes/mostra-sintetica_respostes.parquet (5597 bytes, 250 rows) and mostra-sintetica_meta.json (6 fields) — the real dataset this plan queries and renders"
provides:
  - "src/services/duckdb.ts: singleton AsyncDuckDB owner (getDb) and the sole read_parquet call path (queryParquet), self-hosted mvp/eh bundles"
  - "src/lib/graphicWalkerFields.ts: verbatim EnquestaMetaField -> GraphicWalker IMutField mapping, unit-tested"
  - "src/pages/ExplorerPage.tsx: two-phase loading (engine init, data load), two distinct error states, GraphicWalker mounted full-width"
  - "src/App.tsx: route-aware shell (no header/max-w-3xl on /enquesta/:id)"
  - "scripts/verify-explorer-assets.mjs + npm run verify:explorer: production-build proof that DuckDB assets and the Parquet are served base-prefixed under /enquestes/"
affects: [03-02-app-shell-explorer-header, 03-03-chart-export-and-share-link]

actuals:
  tokens: 6301
  tasks: 4
  commits: 5

tech-stack:
  added: ["@duckdb/duckdb-wasm@1.32.0 (exact)", "apache-arrow@^17.0.0", "@kanaries/graphic-walker@^0.5.2", "styled-components@^6.1.19", "vitest@^4.1.11 (dev)"]
  patterns:
    - "Singleton service tier (src/services/) memoising an async engine handle behind a module-level promise, mirroring src/lib/enquestes.ts's single-function-owns-this-concern discipline"
    - "Two independent FetchState<T> cycles in one page component for two genuinely different failure points (engine init vs. data load), each with its own Catalan copy and only the transient one offering retry"
    - "Route-aware app shell via useLocation().pathname.startsWith(...) to opt a single route out of shared chrome/width constraints"

key-files:
  created:
    - src/services/duckdb.ts
    - src/lib/graphicWalkerFields.ts
    - src/lib/graphicWalkerFields.test.ts
    - scripts/verify-explorer-assets.mjs
  modified:
    - src/components/ErrorState.tsx
    - src/pages/ExplorerPage.tsx
    - src/App.tsx
    - scripts/gh-pages-preview.mjs
    - package.json
    - package-lock.json
    - vite.config.ts

key-decisions:
  - "Approved both [SUS]-flagged packages (@kanaries/graphic-walker, styled-components) after human review confirmed both flags were heuristic false positives (missing repository metadata field; too-new-patch heuristic on a 10-year-old package) with no viable alternative for either"
  - "Corrected styled-components' saved range from npm's auto-recorded ^6.5.3 (the resolved installed version) back to the plan-specified ^6.1.19 (GraphicWalker's declared peer floor)"
  - "Dropped a redundant synchronous setDataState call at the top of the data-load effect (react-hooks/set-state-in-effect lint violation) — dataState already defaults to loading and onDataRetry already sets it before bumping the attempt counter"

patterns-established:
  - "DuckDB-Wasm bundle registration: exactly {mvp, eh}, never a coi/threaded entry — GitHub Pages cannot set COOP/COEP headers"
  - "BigInt-safe Arrow row conversion: result.toArray().map(toJSON) then walk own keys converting bigint -> Number"

requirements-completed: [EXPL-01, EXPL-02, EXPL-03, EXPL-04, EXPL-05, EXPL-08]

coverage:
  - id: D1
    description: "Field typing (measure/dimension) maps verbatim from meta.json to GraphicWalker's rawFields, never re-inferred from Parquet dtype"
    requirement: EXPL-05
    verification:
      - kind: unit
        ref: "src/lib/graphicWalkerFields.test.ts#toGraphicWalkerFields (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Production build emits, base-prefixes, and serves the DuckDB wasm/worker assets and the committed Parquet under /enquestes/"
    requirement: EXPL-08
    verification:
      - kind: integration
        ref: "npm run verify:explorer (scripts/verify-explorer-assets.mjs)"
        status: pass
      - kind: integration
        ref: "npm run verify:pages (scripts/verify-pages.mjs)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Visitor opens /enquesta/mostra-sintetica, watches two distinct loading phases, and lands in a working drag-and-drop GraphicWalker over the 250 real rows with four switchable mark types"
    requirement: EXPL-01
    verification:
      - kind: manual_procedural
        ref: "03-01-PLAN.md Task 3 <human-check> — deferred to end-of-phase UAT (WINDOWS.md id 2)"
        status: unknown
    human_judgment: true
    rationale: "Requires a real browser (WASM Worker instantiation, drag-and-drop interaction, visual full-width layout) — not reproducible in this automated executor environment. All automatable proxies (build, lint, structural asserts on duckdb.ts, verify:pages, verify:explorer) pass; deferred per config workflow.human_verify_mode: end-of-phase."
  - id: D4
    description: "Two distinct EXPL-02 error states: engine-init failure has no retry, data-load failure has a working retry"
    requirement: EXPL-02
    verification:
      - kind: other
        ref: "grep of src/pages/ExplorerPage.tsx for the four exact Catalan strings and onRetry presence/absence (Task 3 acceptance criteria, checked directly)"
        status: pass
    human_judgment: false
  - id: D5
    description: "GraphicWalker canvas renders full viewport width, outside App.tsx's max-w-3xl cap, with exactly one header row"
    requirement: EXPL-03
    verification:
      - kind: manual_procedural
        ref: "03-01-PLAN.md Task 3 <human-check> item 4 — deferred to end-of-phase UAT (WINDOWS.md id 2)"
        status: unknown
    human_judgment: true
    rationale: "Visual layout claim requiring a rendered browser viewport; App.tsx's conditional logic (no header/no max-w-3xl on /enquesta/) is proven by source inspection but the actual rendered result needs a human eye."

duration: 35min
completed: 2026-08-26
status: complete
---

# Phase 3 Plan 01: Interactive Explorer Tracer Summary

**DuckDB-Wasm queries the committed mostra-sintetica Parquet via SQL in a Worker, and a working drag-and-drop GraphicWalker mounts full-width over the 250 real rows with verbatim-typed fields — proven against a real production build, not just `vite dev`.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-08-26T22:00:00Z (approx, continuation resumed at Task 2)
- **Completed:** 2026-08-26T22:40:03Z
- **Tasks:** 4 (Task 1 checkpoint approved by user; Tasks 2-4 executed)
- **Files modified:** 11

## Accomplishments
- Installed and pinned the full explorer dependency set (`@duckdb/duckdb-wasm@1.32.0` exact, `apache-arrow@^17.0.0`, `@kanaries/graphic-walker@^0.5.2`, `styled-components@^6.1.19`, `vitest@^4.1.11`) after re-verifying against the live npm registry — pins were still current (no newer stable duckdb-wasm tag cut, `apache-arrow: ^17.0.0` unchanged)
- Wired `vitest` into `vite.config.ts` with the smallest possible surface and added `npm run test`
- Built `src/services/duckdb.ts`: a memoised singleton `AsyncDuckDB` (`getDb`) using only `mvp`/`eh` bundles (never `coi`/threaded — GitHub Pages cannot set COOP/COEP headers), and `queryParquet` as the sole `read_parquet` call path, re-asserting `isValidEnquestaId` and converting `BigInt` measure columns to plain numbers
- TDD'd `src/lib/graphicWalkerFields.ts`: wrote the six-assertion failing test first (RED, confirmed failing on missing module), then implemented the verbatim `EnquestaMetaField.type` → GraphicWalker `analyticType` pass-through (GREEN, all 6 assertions pass)
- Rewrote `src/pages/ExplorerPage.tsx` with two sequential `FetchState` cycles (engine init, then meta.json + Parquet), each with fixed non-interpolated Catalan copy, cancelled-flag guards, and only the data-load phase offering retry
- Widened `src/components/ErrorState.tsx` additively (`title?`, `onRetry?`) so one component covers both EXPL-02 error shapes without touching `HomePage.tsx`'s existing call site
- Made `src/App.tsx` route-aware via `useLocation()` so `/enquesta/:id` skips the shared header and 768px width cap, letting GraphicWalker use the full viewport
- Extended `scripts/gh-pages-preview.mjs`'s content-type map (`.wasm` → `application/wasm`, `.parquet` → `application/octet-stream`) and wrote `scripts/verify-explorer-assets.mjs`, proving against a real `vite build` that all four DuckDB dist assets and the committed Parquet/meta.json are emitted, base-prefixed, and served correctly — including a verified negative case (deleting one asset makes the script fail by name)

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy gate** — no commit (pure checkpoint; user responded "approved")
2. **Task 2: Pin and install the explorer dependency set, wire vitest** - `a756dfc` (feat)
3. **Task 3: End-to-end tracer** - `4d54bcc` (test, RED) → `934de43` (feat, GREEN) → `61ee3ca` (feat, full tracer wiring)
4. **Task 4: Prove DuckDB assets survive a real production build** - `aa5b0f0` (feat)

_TDD gate compliance: RED commit `4d54bcc` (test) precedes GREEN commit `934de43` (feat) — verified via `git log`. No REFACTOR commit was needed._

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/services/duckdb.ts` - Singleton DuckDB-Wasm engine + the only permitted `read_parquet` call path
- `src/lib/graphicWalkerFields.ts` - `EnquestaMetaField[]` → GraphicWalker `rawFields` verbatim mapping
- `src/lib/graphicWalkerFields.test.ts` - 6 unit assertions (RED before GREEN)
- `src/pages/ExplorerPage.tsx` - Two-phase loading, two error states, GraphicWalker mount, owned header row
- `src/App.tsx` - Route-aware shell (no header/max-w-3xl on the explorer route)
- `src/components/ErrorState.tsx` - `title`/`onRetry` now optional
- `scripts/verify-explorer-assets.mjs` - Production-build proof of DuckDB asset + Parquet serving
- `scripts/gh-pages-preview.mjs` - `.wasm`/`.parquet` content-type entries added
- `package.json` / `package-lock.json` - New deps, `test` and `verify:explorer` scripts
- `vite.config.ts` - `defineConfig` from `vitest/config`, `test` block added

## Decisions Made
- Approved both `[SUS]`-flagged packages after the user reviewed and confirmed both flags were heuristic false positives (RESEARCH.md's Package Legitimacy Audit already judged this); no alternative existed for either
- Corrected `styled-components`'s npm-recorded range (`^6.5.3`, the resolved installed version) back to the plan-specified `^6.1.19` to match GraphicWalker's declared peer floor exactly
- Used `min-h-screen` (a standard Tailwind utility, not an arbitrary pixel value) for the GraphicWalker wrapper's minimum height, per the plan's "4-multiple spacing utilities only" constraint

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed synchronous setState at the top of the data-load effect**
- **Found during:** Task 3 (`npm run lint`)
- **Issue:** `eslint-plugin-react-hooks`'s `set-state-in-effect` rule flagged a synchronous `setDataState({ status: 'loading' })` call at the top of the Parquet/meta.json-loading effect as a cascading-render risk
- **Fix:** Removed the call — `dataState` already initializes to `{ status: 'loading' }`, and `onDataRetry` already sets it to loading before bumping the `dataAttempt` counter, so the effect-body call was redundant
- **Files modified:** `src/pages/ExplorerPage.tsx`
- **Verification:** `npm run lint` exits 0; behavior unchanged (loading state is still shown correctly on both first load and retry)
- **Committed in:** `61ee3ca` (Task 3 commit)

**2. [Rule 1 - Bug] Corrected styled-components' saved semver range**
- **Found during:** Task 2, post-install `package.json` inspection
- **Issue:** `npm install styled-components@^6.1.19` recorded `^6.5.3` (the resolved installed version) in `package.json` rather than the specified `^6.1.19` range — npm's default save behavior when no exact range is pinned
- **Fix:** Edited `package.json` directly to restore `^6.1.19`, matching the plan's exact specifier shape and GraphicWalker's declared peer dependency floor
- **Files modified:** `package.json`
- **Verification:** `npm run build` and `npm run lint` both still exit 0 after the edit (no re-install needed, range widening doesn't change the already-resolved `node_modules` tree)
- **Committed in:** `a756dfc` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - bug fixes, no scope creep)
**Impact on plan:** Both fixes were small, mechanical corrections required for lint-clean code and exact specifier-shape compliance. Neither changed behavior or scope.

## Issues Encountered
None beyond the two auto-fixed deviations above.

## Known Stubs

None. `queryParquet`/`getDb` are real implementations wired to the committed Parquet; no hardcoded empty data flows into GraphicWalker's `dataSource`/`rawFields`.

## Threat Flags

None. All new surface (`queryParquet`'s SQL composition, Parquet URL composition, `meta.json` re-fetch) is exactly the surface the plan's `<threat_model>` already registered and mitigated (T-03-01 through T-03-06, T-03-SC) — no new trust boundary was introduced beyond what the plan anticipated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `src/services/duckdb.ts` (`getDb`, `queryParquet`) and `src/lib/graphicWalkerFields.ts` (`toGraphicWalkerFields`) are stable exports Plan 02 (`ExplorerHeader`, data dictionary) and Plan 03 (chart export, shareable link) can build on directly
- `src/pages/ExplorerPage.tsx` currently renders its own minimal header row (back-link + `ThemeToggle`) inline — the plan document already flags that Plan 02 extracts this into a dedicated `ExplorerHeader` component and adds the survey title; no action needed here, just noting the extraction point
- **Deferred to end-of-phase UAT** (`.planning/WINDOWS.md` id 2, `unrun-verify`): Task 3's `<human-check>` — two visible loading phases, correct field typing in GraphicWalker's own field list, drag-and-drop across bar/line/area/scatter mark types, full-width canvas with exactly one header row, refresh-safe deep link, and a console free of styled-components/apache-arrow/Worker-construction errors. All automatable proxies for these claims (build, lint, the six unit tests, `verify:pages`, `verify:explorer`, and direct source/structural inspection of `ExplorerPage.tsx`/`App.tsx`/`duckdb.ts`) passed in this run.
- The zero-row-Parquet backstop and the small/medium-screen responsiveness backstop flagged in `03-UI-SPEC.md`'s UI Considerations remain unresolved held-out checks — not addressed by this plan, carried forward to end-of-phase UAT alongside the human-check above

## Self-Check: PASSED

All created files (`src/services/duckdb.ts`, `src/lib/graphicWalkerFields.ts`, `src/lib/graphicWalkerFields.test.ts`, `scripts/verify-explorer-assets.mjs`, this SUMMARY) exist on disk. All commits (`a756dfc`, `4d54bcc`, `934de43`, `61ee3ca`, `aa5b0f0`, `4d21902`) verified present in `git log --oneline --all`.

---
*Phase: 03-interactive-explorer*
*Completed: 2026-08-26*
