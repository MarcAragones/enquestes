---
phase: 03-interactive-explorer
plan: 02
subsystem: ui
tags: [react, tailwind, graphic-walker, dark-mode, data-dictionary]

requires:
  - phase: 03-interactive-explorer (plan 01)
    provides: "src/pages/ExplorerPage.tsx two-phase loading, src/hooks/useTheme.ts, src/components/ThemeToggle.tsx, src/types/enquesta.ts EnquestaMetaField contract"
provides:
  - "src/components/ExplorerHeader.tsx: single compact header row (back-link, truncating survey title, ThemeToggle) rendered in every ExplorerPage state"
  - "src/components/DataDictionary.tsx: collapsed-by-default native <details> panel listing meta.json field meanings"
  - "src/pages/ExplorerPage.tsx: wired to render both, plus GraphicWalker's appearance prop synced to useTheme()"
affects: [03-03-chart-export-and-share-link]

actuals:
  tokens: 1709
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Header title placeholder pattern: render the route param (survey id) as a non-empty placeholder title until the async meta.json load resolves, then swap to the real title — never an empty string, never a disappearing/reappearing header row"
    - "Native <details>/<summary> for collapse-by-default secondary panels — no React state, no custom disclosure widget"
    - "GraphicWalker's IThemeProps.appearance prop wired to the app's existing useTheme() hook for canvas/shell theme parity"

key-files:
  created:
    - src/components/ExplorerHeader.tsx
    - src/components/DataDictionary.tsx
  modified:
    - src/pages/ExplorerPage.tsx

key-decisions:
  - "Reused the ExplorerHeader.tsx and partial ExplorerPage.tsx import edits left in progress by the prior interrupted executor run rather than discarding them — verified them against the plan's acceptance criteria first and found no defects"
  - "Rendered ExplorerHeader once, outside the page's if/else content chain (wrapping `{content}`), rather than duplicating the render call inside all four branches — satisfies 'renders in every state' without repeating the same JSX four times"
  - "Confirmed GraphicWalker 0.5.2's installed TypeScript types (IThemeProps.appearance: IDarkMode = 'media' | 'light' | 'dark', extended by IVizAppProps) expose exactly the light/dark prop the plan anticipated — wired appearance={theme} from the existing useTheme() hook, no DOM/style reaching-in"

patterns-established:
  - "Placeholder-then-resolve header title: id ?? 'Enquesta' until meta.title is available"

requirements-completed: [EXPL-06, EXPL-07, EXPL-09]

coverage:
  - id: D1
    description: "ExplorerHeader renders one compact header row (back-link, truncating title with tooltip, ThemeToggle) in all four ExplorerPage states — invalid id, engine-init error, data-load error, success"
    requirement: EXPL-07
    verification:
      - kind: other
        ref: "node -e structural assert on src/components/ExplorerHeader.tsx (truncate/ThemeToggle/back-link text/single-prop interface) and src/pages/ExplorerPage.tsx (ExplorerHeader referenced, no leftover inline <header className=)"
        status: pass
      - kind: integration
        ref: "npm run build && npm run lint && npm run verify:explorer && npm run verify:pages"
        status: pass
    human_judgment: true
    rationale: "Visual/interaction claims (exactly one header row rendered, dark-mode toggle restyling both header and GraphicWalker canvas via the appearance prop, narrow-viewport wrap/truncate behavior, back-link navigation) require a rendered browser — not reproducible in this automated executor environment. Deferred to end-of-phase UAT per human_verify_mode: end-of-phase (WINDOWS.md id 3)."
  - id: D2
    description: "GraphicWalker's own light/dark appearance is wired to the app's theme via the installed package's IThemeProps.appearance prop (confirmed present in 0.5.2 types), not a DOM/style override"
    requirement: EXPL-06
    verification:
      - kind: other
        ref: "grep node_modules/@kanaries/graphic-walker/dist/interfaces.d.ts confirming IThemeProps.appearance?: IDarkMode extended by IVizAppProps, which GraphicWalker's ILocalVizAppProps/IRemoteVizAppProps both include"
        status: pass
      - kind: integration
        ref: "npm run build (type-checks appearance={theme} against installed types)"
        status: pass
    human_judgment: true
    rationale: "Whether the canvas actually re-renders in the correct theme on toggle is a runtime/visual claim; type-level wiring is proven, the rendered behavior is deferred to end-of-phase UAT (WINDOWS.md id 3)."
  - id: D3
    description: "DataDictionary lists every meta.json field (name/label fallback, dimensio/mesura caption, optional description) inside a collapsed-by-default native details/summary panel, sourced from the already-loaded meta with no second fetch"
    requirement: EXPL-09
    verification:
      - kind: other
        ref: "node -e structural assert on src/components/DataDictionary.tsx (details/summary present, no useState/useReducer, required copy strings present, no banned spacing/weight utilities) and src/pages/ExplorerPage.tsx (DataDictionary referenced, exactly 1 fetch() call)"
        status: pass
      - kind: integration
        ref: "npm run build && npm run lint && npm run test && npm run verify:explorer && npm run verify:pages"
        status: pass
    human_judgment: true
    rationale: "Whether the panel visually sits between header and canvas with no layout jump, is keyboard-operable, and reads correctly at narrow viewports is a rendered-browser claim. Deferred to end-of-phase UAT (WINDOWS.md id 4)."
  - id: D4
    description: "Empty/absent fields array renders the fixed 'Aquesta enquesta no té camps documentats.' copy; a field with no description omits the description line entirely rather than a placeholder/undefined"
    requirement: EXPL-09
    verification:
      - kind: other
        ref: "node -e structural assert confirming the empty-state copy string and max-h-/overflow-y-auto scroll containment are present in src/components/DataDictionary.tsx; component logic reviewed directly (fields?.length ?? 0, field.description && (...) conditional)"
        status: pass
    human_judgment: false

duration: 25min (resumed session; prior interrupted run left ExplorerHeader.tsx fully written and ExplorerPage.tsx import lines edited, with no commits)
completed: 2026-08-26
status: complete
---

# Phase 3 Plan 02: App-Shell Explorer Header and Data Dictionary Summary

**Extracted a reusable `ExplorerHeader` (title + back-link + dark-mode toggle, wired into all four page states) and added a collapsed-by-default `DataDictionary` panel reading field meanings straight from the already-loaded meta.json, plus GraphicWalker's own light/dark `appearance` prop synced to the app's theme.**

## Performance

- **Duration:** ~25 min this session (resumed from a prior interrupted executor run — see Continuation note below)
- **Started:** 2026-08-26T21:40:00Z (approx, this resumed session)
- **Completed:** 2026-08-26T21:58:55Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Continuation Note

A prior executor run was interrupted mid-Task-1 by a session/API limit before any commit was made. Uncommitted work was found and verified against the plan rather than discarded:
- `src/components/ExplorerHeader.tsx` — fully written, matched the plan's Task 1 spec exactly (header classes, back-link, truncating `<h1 title=...>`, `<ThemeToggle />`, single-prop `ExplorerHeaderProps`). Reused as-is, no defects found.
- `src/pages/ExplorerPage.tsx` — only import lines had been changed (old `Link`/`ThemeToggle` imports removed, `ExplorerHeader`/`useTheme` imported), leaving the file in a known-broken intermediate state (`npm run build` failed on `Cannot find name 'Link'`/`'ThemeToggle'` at the old inline header markup). This session finished wiring the body.

## Accomplishments
- Extracted the explorer's inline header row into `ExplorerHeader.tsx` and rendered it once, wrapping every page state (invalid id, engine-init error, data-load error, success) instead of only the success branch (EXPL-07)
- Header title placeholder pattern: the route's survey `id` stands in for the title until `meta.json` resolves (`headerTitle = id ?? 'Enquesta'`), then swaps to `meta.title` on success — never an empty string, never a disappearing header
- Confirmed `@kanaries/graphic-walker@0.5.2`'s installed types expose `appearance?: IDarkMode` (`'media' | 'light' | 'dark'`) via `IThemeProps`, extended by `IVizAppProps` which `GraphicWalker`'s props extend — wired `appearance={theme}` from the existing `useTheme()` hook so the canvas matches the app shell's light/dark mode
- Built `DataDictionary.tsx`: a native `<details>`/`<summary>` panel (no React state) listing every `meta.json` field — `label ?? name`, a lowercase `dimensió`/`mesura` caption, and an optional description line — with the empty-fields fallback copy, internal scroll (`max-h-64` + `overflow-y-auto`), and word-wrapping long descriptions
- Wired `DataDictionary` into `ExplorerPage.tsx`'s success branch, directly beneath the header and above the GraphicWalker canvas, reusing `meta.fields` from the already-fetched meta object (confirmed exactly one `fetch()` call remains in the file)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract the explorer app-shell header (title + back-link + theme toggle)** - `3f835b1` (feat)
2. **Task 2: Data dictionary panel — field meanings from meta.json inside the explorer** - `c0e0ec4` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified
- `src/components/ExplorerHeader.tsx` - Presentational header: back-link, truncating title with tooltip, ThemeToggle
- `src/components/DataDictionary.tsx` - Collapsed-by-default field-dictionary panel sourced from meta.json
- `src/pages/ExplorerPage.tsx` - Renders ExplorerHeader in every state, DataDictionary in the success state, GraphicWalker's `appearance` prop wired to `useTheme()`

## Decisions Made
- Reused the prior interrupted run's uncommitted `ExplorerHeader.tsx` and partial `ExplorerPage.tsx` import edits after verifying them against the plan's acceptance criteria — no rework needed for that file
- Rendered `ExplorerHeader` once outside the branchy `content` variable (wrapping it in the final `return`) rather than duplicating the render call in all four branches — still satisfies "renders in every state" per the acceptance criteria's grep check, with less duplication
- Split the already-combined edit into two atomic task commits by writing an intermediate Task-1-only version of `ExplorerPage.tsx` (verified build/lint clean independently), committing it with `ExplorerHeader.tsx`, then reapplying the `DataDictionary` wiring and committing Task 2 separately

## Deviations from Plan

None — plan executed exactly as written. The GraphicWalker `appearance` prop was found to exist in the installed types (as anticipated by the plan's conditional instruction), so it was wired per the "if it exists" branch of Task 1's action; no fallback-path was needed.

## Issues Encountered
None beyond the mid-Task-1 interruption itself, which was not a real failure (session/API limit) and left no defects to fix — see Continuation Note above.

## Known Stubs

None. Both components are fully wired to real data (`meta.title`/`meta.fields` from the already-fetched `meta.json`); no hardcoded empty values or placeholder text flow into either component's rendered output.

## Threat Flags

None. The only new rendering surface (`DataDictionary` rendering `meta.json` label/description text) is exactly the surface the plan's `<threat_model>` already registered and mitigated (T-03-07 through T-03-09) via ordinary JSX interpolation — no raw-HTML injection API introduced, no reach into GraphicWalker's DOM/chrome.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `ExplorerHeader` and `DataDictionary` are stable, reusable components; Plan 03 (chart export + shareable link) adds a "Copy link" button into the same header's reserved right-cluster slot next to `ThemeToggle`, per the header's own doc comment
- **Deferred to end-of-phase UAT** (`.planning/WINDOWS.md` ids 3 and 4, `unrun-verify`): both tasks' `<human-check>` blocks — single header row with no repeated metadata across all four page states, working back-link, dark-mode toggle restyling both header and GraphicWalker canvas, narrow-viewport (~375px/~768px) wrap/truncate behavior, collapsed dictionary panel with correct partial-field rendering (label fallback, missing-description omission), no layout jump on collapse/expand, keyboard operability, and a production-build responsiveness pass including GraphicWalker's own canvas at narrow widths. All automatable proxies (build, lint, the 6 existing unit tests, structural asserts on both new components and `ExplorerPage.tsx`, `verify:explorer`, `verify:pages`) passed in this run.
- The GraphicWalker canvas responsiveness backstop and the zero-row-Parquet backstop flagged in `03-UI-SPEC.md`'s UI Considerations remain unresolved held-out checks, carried forward from Plan 01 to end-of-phase UAT

## Self-Check: PASSED

All created files (`src/components/ExplorerHeader.tsx`, `src/components/DataDictionary.tsx`, this SUMMARY) exist on disk. Both commits (`3f835b1`, `c0e0ec4`) verified present in `git log --oneline --all`.

---
*Phase: 03-interactive-explorer*
*Completed: 2026-08-26*
