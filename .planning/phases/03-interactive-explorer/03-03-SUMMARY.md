---
phase: 03-interactive-explorer
plan: 03
subsystem: data-viz
tags: [graphic-walker, share-link, base64url, vitest, tdd, clipboard]

requires:
  - phase: 03-interactive-explorer (plan 01)
    provides: "src/pages/ExplorerPage.tsx two-phase loading + GraphicWalker mount, src/types/enquesta.ts EnquestaMetaField contract"
  - phase: 03-interactive-explorer (plan 02)
    provides: "src/components/ExplorerHeader.tsx (back-link, title, ThemeToggle) with a reserved slot for a Copy-link button"
provides:
  - "src/lib/shareLink.ts: encodeShareLink/decodeShareLink, versioned (v1) base64url+UTF-8 wire format, D-07 silent fallback on any hostile/stale input, schema-drift field-reference validation"
  - "src/components/ExplorerHeader.tsx: onCopyLink prop, 'Copia l'enllaç' -> 'Copiat!' (2s) confirmation button"
  - "src/pages/ExplorerPage.tsx: GraphicWalker's storeRef (VizSpecStore) wired for synchronous spec read-back on click; ?chart= query-param restore gated on the loaded meta's field list"
affects: []

actuals:
  tokens: 6088
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "storeRef (React.RefObject<VizSpecStore | null>) read synchronously inside a click handler, never mirrored into React state - avoids remounting the canvas on every chart edit"
    - "useMemo gating a decoded value on (raw query param, load-state object) so a third-party component's controlled prop keeps a stable reference across unrelated re-renders (theme toggle)"
    - "Recursive fid-collection over an unknown parsed structure for schema-drift validation, rather than a hardcoded path list - tolerates the chart shape's nesting without over-fitting to one GraphicWalker version"

key-files:
  created:
    - src/lib/shareLink.ts
    - src/lib/shareLink.test.ts
  modified:
    - src/components/ExplorerHeader.tsx
    - src/pages/ExplorerPage.tsx

key-decisions:
  - "Task 1 investigation replaced RESEARCH.md's LOW-confidence Assumption A2 with a fact: VizSpecStore.exportCode(): IChart[] (the exact pre-0.5 wiki method name) is still present, synchronous, and current in the installed @kanaries/graphic-walker@0.5.2 types - no fallback/escalation branch was needed"
  - "EXPL-10 verdict: GraphicWalker's own toolbar already exposes an image-export control (locale keys settings.button.export_chart/export_chart_as, backed by IGWHandler.exportChart('svg'|'data-url')) - Task 3 writes zero export code"
  - "Chose storeRef over a change-callback+useRef pattern for the encode side: exportCode() is synchronous and read only inside the click handler, which is a strictly simpler mechanism than subscribing to a per-edit callback and matches D-05's serialize-on-click model more directly"
  - "decodeShareLink's schema-drift check does a recursive scan for any 'fid' key rather than hardcoding DraggableFieldState's 16 channel names, so it keeps working if GraphicWalker adds/renames encoding channels in a future version"

patterns-established:
  - "Versioned share-link wire format: <SHARE_VERSION>.<base64url(UTF-8 JSON)>, TextEncoder/TextDecoder bridging JSON to btoa/atob rather than a raw btoa(JSON.stringify(...)) call (which throws on this survey's accented Catalan filter values)"

requirements-completed: [EXPL-10, EXPL-11]

coverage:
  - id: D1
    description: "Task 1's installed-package investigation names the exact GraphicWalker 0.5.2 read-back mechanism (storeRef -> VizSpecStore.exportCode()) and the exact restore-prop shape (chart?: IChart[] | IVisSpec[]), replacing RESEARCH.md's unconfirmed assumption with a fact from node_modules/@kanaries/graphic-walker/dist/*.d.ts"
    requirement: EXPL-11
    verification:
      - kind: other
        ref: "Direct reading of node_modules/@kanaries/graphic-walker/dist/interfaces.d.ts and dist/store/visualSpecStore.d.ts (IGWHandler, IVizStoreProps.storeRef, VizSpecStore.exportCode/currentVis/vizList, ISpecProps.chart) plus node -e verification script from the plan's Task 1 <automated> check"
        status: pass
    human_judgment: false
  - id: D2
    description: "shareLink.ts round-trips a representative spec (field references, mark type, an active filter with accented Catalan text) losslessly through a versioned, UTF-8-safe, URL-safe format, and every hostile/stale input class (null, empty, over-length, wrong version, non-base64, non-JSON, unknown field reference) returns undefined without throwing"
    requirement: EXPL-11
    verification:
      - kind: unit
        ref: "src/lib/shareLink.test.ts (16 assertions, TDD RED at 98df971 confirmed failing on missing module, GREEN at 9ead057 confirmed all 16 passing)"
        status: pass
      - kind: other
        ref: "node -e structural assert: no throw statement in the module, no React/DOM/document/window/navigator access, TextEncoder/TextDecoder present (not a raw btoa call)"
        status: pass
    human_judgment: false
  - id: D3
    description: "The 'Copia l'enllaç' button lives in the app-shell header beside ThemeToggle (never inside GraphicWalker's own toolbar), swaps to 'Copiat!' for two seconds on success, and the address bar is never synced during chart editing (no setSearchParams/pushState/replaceState anywhere in ExplorerPage.tsx)"
    requirement: EXPL-11
    verification:
      - kind: other
        ref: "node -e structural asserts on src/components/ExplorerHeader.tsx (onCopyLink/Copia l'.../Copiat!/font-semibold present, font-medium absent) and src/pages/ExplorerPage.tsx (encodeShareLink/decodeShareLink/onCopyLink/useSearchParams/clipboard present, setSearchParams/pushState/replaceState absent)"
        status: pass
      - kind: integration
        ref: "npm run build && npm run lint && npx vitest run && npm run verify:explorer && npm run verify:pages"
        status: pass
    human_judgment: true
    rationale: "Whether the button visually swaps its label for ~2 seconds, whether a pasted link actually reopens the identical visualization in a fresh tab (fields, mark type, active filter), and whether three hostile-link variants render a clean blank explorer are rendered-browser/round-trip claims not reproducible in this automated executor environment. Deferred to end-of-phase UAT (.planning/WINDOWS.md id 5) per config workflow.human_verify_mode: end-of-phase."
  - id: D4
    description: "EXPL-10: a visitor can export their chart as an image without this project writing an image exporter - GraphicWalker's own toolbar already offers this"
    requirement: EXPL-10
    verification:
      - kind: other
        ref: "grep of node_modules/@kanaries/graphic-walker/dist/locales/en-US.json confirming settings.button.export_chart ('Export') and export_chart_as ('Export as {{type}}') locale keys, cross-referenced against IGWHandler.exportChart(mode?: 'svg'|'data-url') in interfaces.d.ts"
        status: pass
      - kind: manual_procedural
        ref: "03-03-PLAN.md Task 3 <human-check> item 2 - deferred to end-of-phase UAT (WINDOWS.md id 5)"
        status: unknown
    human_judgment: true
    rationale: "That the visitor-facing toolbar button actually produces a valid, openable PNG/SVG file is a rendered-browser claim requiring an actual click-and-download; the automatable proxy (the control's existence and image-mode signature in the installed package) is confirmed."

duration: 20min
completed: 2026-08-27
status: complete
---

# Phase 3 Plan 03: Chart Export and Shareable Link Summary

**Investigated GraphicWalker 0.5.2's installed types to find a confirmed, synchronous chart-spec read-back mechanism (`storeRef` -> `VizSpecStore.exportCode()`), then built a versioned, UTF-8-safe `shareLink.ts` (TDD, 16 unit assertions) and wired "Copia l'enllaç" into the header plus `?chart=` restore into `ExplorerPage` — writing zero custom image-export code because GraphicWalker's own toolbar already has one.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-08-26T22:55:00Z (approx)
- **Completed:** 2026-08-26T22:12:03Z
- **Tasks:** 3
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- **Task 1 (investigation, no source changes):** Read `node_modules/@kanaries/graphic-walker/dist/interfaces.d.ts` and `dist/store/visualSpecStore.d.ts` directly rather than trusting RESEARCH.md's LOW-confidence guess. Found and classified every candidate surface:
  - `IGWHandler.exportChart(mode?: 'svg' | 'data-url'): Promise<IChartExportResult>` and `exportChartList` — confirmed **image** export, not spec data (RESEARCH.md's exact warning validated).
  - `IVizStoreProps.storeRef?: React.RefObject<VizSpecStore | null>` — confirmed present and current on the props `GraphicWalker` accepts.
  - `VizSpecStore.exportCode(): IChart[]` — the literal pre-0.5 wiki method name, still present and synchronous in 0.5.2. `currentVis: IChart` (single chart) and `vizList: IChart[]` (all charts, getter) also exist as alternatives.
  - `ISpecProps.chart?: IChart[] | IVisSpec[]` — confirmed exact restore-prop type, plural, matching the phase's own assumption-delta decision to carry GraphicWalker's plural container as-is.
  - `IChart.encodings: DraggableFieldState` — 16 channel arrays (`dimensions`, `measures`, `rows`, `columns`, `color`, `opacity`, `size`, `shape`, `theta`, `radius`, `longitude`, `latitude`, `geoId`, `details`, `filters`, `text`), each entry an `IViewField` whose field-reference position is its `fid: string` key — this is exactly what `decodeShareLink`'s schema-drift check walks.
  - **Chosen mechanism: Preferred (ref/store, synchronous).** No fallback or escalation branch was needed — RESEARCH.md's Assumption A2 (LOW confidence) is now a confirmed fact, not a guess.
  - **EXPL-10 verdict:** GraphicWalker's own toolbar already exposes an "Export" control (`settings.button.export_chart`/`export_chart_as` locale keys, backed by `IGWHandler.exportChart`'s `svg`/`data-url` modes) — Task 3 writes no export code.
- **Task 2 (TDD):** Wrote `src/lib/shareLink.test.ts` first (16 assertions covering round-trip, UTF-8 safety, version-prefix, unknown-version, length-cap, malformed-base64, malformed-JSON, unknown-field-reference, null/empty input, unserialisable-input, and a blanket never-throws check) — confirmed RED (module didn't exist). Implemented `src/lib/shareLink.ts` to satisfy it — confirmed GREEN (all 16 pass). The module encodes via `TextEncoder` → binary string → `btoa` → base64url (never a raw `btoa(JSON.stringify(...))`, which would throw on this survey's accented Catalan filter values), and `decodeShareLink` runs a fixed fail-soft sequence (length cap → version tag → guarded base64url/UTF-8 decode → guarded `JSON.parse` → recursive `fid`-reference validation against the loaded survey's field list) where every step returns `undefined` rather than throwing.
- **Task 3:** Added an optional `onCopyLink` prop to `ExplorerHeader` rendering a "Copia l'enllaç" / "Copiat!" button (2s label swap, cleanup-cleared timer) beside `ThemeToggle`, styled `font-semibold` per the UI-SPEC (not the older `font-medium` retry-button precedent). Wired `ExplorerPage.tsx`: a `storeRef` (`VizSpecStore`) attached to `<GraphicWalker />`, read only inside the click handler via `exportCode()` (never mirrored into React state), encoded with `encodeShareLink`, and written to the clipboard as an absolute URL built from `window.location.href` — the address bar itself is never touched by any search-param setter or history API. The restore half decodes `?chart=` via `useMemo` gated on `dataState` (so it never runs before `meta.json` resolves) and passes the result to GraphicWalker's `chart` prop.

## Task Commits

Each task was committed atomically:

1. **Task 1: Resolve GraphicWalker 0.5.2's spec read-back and image-export surface** — no commit (investigation only, no source files changed; findings recorded above and used directly by Tasks 2-3)
2. **Task 2: shareLink encode/decode with a versioned payload and the D-07 soft fallback** — `98df971` (test, RED) → `9ead057` (feat, GREEN)
3. **Task 3: Wire "Copia l'enllaç" into the header and restore a shared spec on load** — `1a17c48` (feat)

_TDD gate compliance: RED commit `98df971` (test) precedes GREEN commit `9ead057` (feat) — verified via `git log --oneline 475a151..1a17c48`. No REFACTOR commit was needed._

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `src/lib/shareLink.ts` - `encodeShareLink`/`decodeShareLink`, `SHARE_PARAM`/`SHARE_VERSION`/`MAX_SHARE_PARAM_LENGTH`, versioned base64url+UTF-8 wire format, D-07 silent fallback
- `src/lib/shareLink.test.ts` - 16 unit assertions (RED before GREEN)
- `src/components/ExplorerHeader.tsx` - `onCopyLink` prop, Copy-link button with 2s "Copiat!" confirmation
- `src/pages/ExplorerPage.tsx` - `storeRef` wiring, copy handler (encode + clipboard write), `?chart=` decode/restore memoised on load state

## Decisions Made

- Chose `storeRef` + `exportCode()` (Preferred mechanism) over a change-callback-in-a-ref fallback: it is synchronous, requires no subscription/cleanup, and reads the spec at the exact moment D-05 calls for (on click, not on every edit)
- Kept the schema-drift field check as a generic recursive `fid`-key scan rather than hardcoding `DraggableFieldState`'s 16 channel names, so a future GraphicWalker version adding/renaming an encoding channel doesn't silently bypass validation
- Built the absolute share URL from `new URL(window.location.href)` plus `.searchParams.set(...)` (a pure string-construction operation) rather than any navigation/history API, to keep D-05's "address bar never changes" guarantee structurally impossible to violate from this file

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Self-referential `fromBase64Url` helper caught during GREEN verification**
- **Found during:** Task 2, first `npx vitest run src/lib/shareLink.test.ts` pass after writing the initial implementation
- **Issue:** `fromBase64Url(base64url: string)` was originally written as `const base64 = base64.replace(...)` — referencing the not-yet-initialized `const base64` itself instead of the `base64url` parameter, a `ReferenceError: Cannot access 'base64' before initialization` swallowed silently by `decodeShareLink`'s own try/catch (by design, per D-07), which meant the two round-trip tests failed with `undefined` rather than a visible stack trace
- **Fix:** Corrected the right-hand side to reference the `base64url` parameter; isolated with a scratch debug test (deleted before commit, never part of any commit) that added temporary logging to pinpoint which decode step failed
- **Files modified:** `src/lib/shareLink.ts`
- **Verification:** `npx vitest run src/lib/shareLink.test.ts` — all 16 assertions pass; the fix was made before the Task 2 GREEN commit, so no broken version of `shareLink.ts` was ever committed
- **Committed in:** `9ead057` (Task 2 GREEN commit — the fix is part of the first working version, not a separate follow-up commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug fix, caught and resolved entirely within the TDD RED→GREEN cycle before any commit)
**Impact on plan:** No scope change. The bug never reached a commit or the SUMMARY's "GREEN" milestone in a broken state — it is reported here for transparency about the debugging path, not because a committed defect needed correcting afterward.

## Issues Encountered

None beyond the auto-fixed issue above, which was resolved before the GREEN commit was made.

## Known Stubs

None. `shareLink.ts`'s encode/decode are both real, tested implementations; `ExplorerPage.tsx`'s copy handler and restore path are wired to GraphicWalker's actual `storeRef`/`chart` prop surface, not a placeholder.

## Threat Flags

None. All new surface (the `?chart=` query-param trust boundary, the clipboard write, the decoded-spec-into-GraphicWalker boundary) is exactly the surface this plan's `<threat_model>` already registered and mitigated (T-03-10 through T-03-15) — no new trust boundary was introduced beyond what the plan anticipated.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

This is the final plan of Phase 3 (Interactive Explorer) — no downstream phase plan currently depends on this one's exports. Phase-close items:

- **Deferred to end-of-phase UAT** (`.planning/WINDOWS.md` id 5, `unrun-verify`): Task 3's `<human-check>` — image export via GraphicWalker's own toolbar producing an openable PNG/SVG, the "Copia l'enllaç" → "Copiat!" label swap with the address bar visibly unchanged, a pasted link reopening the identical visualization (fields, mark type, active `territori` filter) in a fresh tab, three hostile-link variants (garbage, truncated, cross-survey) all landing on a clean blank explorer with no error, and header layout integrity at ~375px width. All automatable proxies (16 unit tests, build, lint, structural asserts on both changed files, `verify:explorer`, `verify:pages`) passed in this run.
- This closes out Phase 3's `.planning/WINDOWS.md` open items (ids 2-5) as the set to resolve together at the phase's end-of-phase UAT pass, alongside the two still-unresolved backstops flagged in `03-UI-SPEC.md` (zero-row-Parquet rendering, GraphicWalker canvas responsiveness at narrow viewports) — none of those backstops were touched by this plan.

## Self-Check: PASSED

All created files (`src/lib/shareLink.ts`, `src/lib/shareLink.test.ts`, this SUMMARY) exist on disk. All commits (`98df971`, `9ead057`, `1a17c48`) verified present in `git log --oneline --all`.

---
*Phase: 03-interactive-explorer*
*Completed: 2026-08-27*
