---
phase: 03-interactive-explorer
plan: 06
subsystem: explorer
tags: [graphic-walker, error-handling, layout, tailwind, gap-closure]

# Dependency graph
requires:
  - phase: 03-interactive-explorer
    provides: "shareLink.ts's shelf-scoped field-reference decode fix (plan 03-05), exercised by this plan's share-link-restores-large human check"
provides:
  - "A local ExplorerDataState discriminated union that distinguishes 'this survey does not exist' from 'the load failed', closing G-03-2b"
  - "GraphicWalker's defaultConfig wired to layout.size.mode 'full' plus a definite-height h-dvh flex-column ancestor chain, closing G-03-4b"
affects: []

# Actuals (#2632)
actuals:
  tokens: 2093
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Promise.allSettled + fixed-priority classification instead of Promise.all racing, whenever two concurrent requests can both fail for the same underlying reason and the caller needs to know WHICH one is authoritative (a metadata 404 must win over a Parquet-query failure, not whichever settles first)"
    - "A component-local, narrowly-scoped error class (SurveyNotFoundError) to carry a specific failure reason through Promise settlement, rather than string-matching a caught error's message"
    - "GraphicWalker's defaultConfig.layout.size.mode 'full' requires a definite-height ancestor chain (h-dvh flex column -> flex-1 min-h-0 child), not just min-height — a percentage height resolves against a parent's height, not its min-height"

key-files:
  created: []
  modified:
    - src/pages/ExplorerPage.tsx

key-decisions:
  - "Kept dataState's new discriminated union (ExplorerDataState) local to ExplorerPage.tsx rather than widening the shared FetchState<T> type, per the plan's explicit constraint that other pages depend on FetchState's message-string error shape"
  - "Classified the phase-2 settlement with a fixed priority (metadata-404 > any other rejection > parse failure) rather than the previous Promise.all race, so a well-formed-but-nonexistent survey id deterministically reaches the not-found branch regardless of which of the two concurrent requests fails first"
  - "Used the same NOT_FOUND_TITLE/NOT_FOUND_MESSAGE constants for both the !valid branch and the phase-2 not-found kind, matching the plan's instruction that a malformed id and a non-existent id must present identically to a visitor"

requirements-completed: [EXPL-02, EXPL-03, EXPL-06, EXPL-11]

coverage:
  - id: D1
    description: "A well-formed but non-existent survey id (metaUrl 404) shows a not-found heading distinct from HomePage's plural load-failure wording, with no retry button, while a genuine transient failure still shows survey-scoped load-failure copy with a working retry"
    requirement: EXPL-02
    verification:
      - kind: other
        ref: "npm run build (tsc -b exhaustiveness on the new discriminated union) && npx vitest run && npm run lint && grep -q \"No s'han pogut carregar les dades d'aquesta enquesta\" src/pages/ExplorerPage.tsx"
        status: pass
    human_judgment: true
    rationale: "The compile-time/lint/grep checks prove the classification logic and literal copy strings are correct and reachable, but confirming the rendered heading text and the absence of a retry button against a live production preview requires an interactive browser check. No browser automation tool was available in this execution environment (claude-in-chrome reported the extension is not installed) — recorded as an open unrun-verify item in .planning/WINDOWS.md (entry 6) for a human to confirm."
  - id: D2
    description: "A malformed id (fails isValidEnquestaId) presents the identical not-found treatment as a non-existent-but-valid id"
    requirement: EXPL-02
    verification:
      - kind: other
        ref: "npm run build && npm run lint"
        status: pass
    human_judgment: true
    rationale: "Same limitation as D1 — requires a live browser visit to a malformed-id URL to visually confirm identical treatment. Covered by the same WINDOWS.md entry 6."
  - id: D3
    description: "A newly built chart (any mark type) fills the explorer's canvas area instead of GraphicWalker's small unconfigured default size"
    requirement: EXPL-03
    verification:
      - kind: other
        ref: "npm run build && grep -q '100dvh' dist/assets/*.css && grep -q 'defaultConfig' src/pages/ExplorerPage.tsx && npm run lint"
        status: pass
    human_judgment: true
    rationale: "The compiled-CSS grep proves the h-dvh/flex-1/min-h-0 utilities actually compiled (not silently dropped by a Tailwind typo) and the defaultConfig prop is wired, but confirming the drawn Vega-Lite chart is visually large in a real browser requires an interactive check not available in this environment. Recorded as WINDOWS.md entry 7."
  - id: D4
    description: "A chart restored from a share link copied after plan 03-05's fix reproduces the sharer's visualization AND fills the canvas (composed EXPL-11 x EXPL-06 behaviour)"
    requirement: EXPL-11
    verification: []
    human_judgment: true
    rationale: "This is an end-to-end, real-browser round trip (copy link, paste in a fresh tab, visually confirm both exact reproduction and full size) explicitly called out by the plan as needing to be verified rather than assumed. No browser tool was available; recorded as WINDOWS.md entry 7."
  - id: D5
    description: "The explorer header, data dictionary and canvas all stay reachable and unbroken at ~375px and ~768px in the production build, including in dark mode"
    requirement: EXPL-06
    verification: []
    human_judgment: true
    rationale: "Responsive/dark-mode layout confirmation requires visual inspection at multiple viewport widths in a real browser. No browser tool was available; recorded as WINDOWS.md entry 7."

duration: 8min
completed: 2026-08-27
status: complete
---

# Phase 03 Plan 06: Explorer Error Copy and Canvas Sizing Gap Closure Summary

**Closed G-03-2b (not-found vs. load-failed error copy, EXPL-02) and G-03-4b (GraphicWalker canvas fills its container via `defaultConfig` + an `h-dvh` flex-column ancestor chain, EXPL-03/EXPL-06) — both fixes land entirely inside `src/pages/ExplorerPage.tsx`.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-08-27T20:32:11Z
- **Completed:** 2026-08-27T20:39:01Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Replaced `dataState`'s use of the shared `FetchState<ExplorerData>` with a local `ExplorerDataState` discriminated union carrying an error `kind` (`'not-found' | 'load-failed'`) instead of a message string, so `tsc -b`'s exhaustiveness check enforces handling both cases at every render branch
- Reworked the phase-2 effect to settle the metadata fetch and the Parquet query together via `Promise.allSettled` (never racing them via `Promise.all`), then classify with a fixed priority — a metadata 404 (raised as a local `SurveyNotFoundError`) always wins over any other concurrent rejection, so a non-existent survey id deterministically shows the not-found copy regardless of which request loses first
- Made the `!valid` branch and the phase-2 not-found branch render identically (same title/message constants, no retry button) — a malformed id and a non-existent-but-valid id are the same thing to a visitor
- Passed GraphicWalker a `defaultConfig` selecting `layout.size.mode: 'full'`, and changed the page root from `min-h-screen` to an `h-dvh` flex column with the canvas wrapper as a `flex-1 min-h-0` child — `'full'` mode is inert without a definite-height ancestor chain, since GraphicWalker's own root resolves a percentage height against a parent's *height*, not its *min-height*

## Task Commits

Each task was committed atomically:

1. **Task 1: Tell "this survey does not exist" apart from "the load failed"** - `331116f` (fix)
2. **Task 2: Make GraphicWalker fill a container that actually has a height** - `74880b9` (fix)

**Plan metadata:** (this commit) `docs(03-06): complete explorer error copy and canvas sizing gap closure plan`

## Files Created/Modified
- `src/pages/ExplorerPage.tsx` - Added `ExplorerDataState`, `SurveyNotFoundError`, four Catalan copy constants; reworked the phase-2 effect to `Promise.allSettled` + fixed-priority classification; updated the `!valid` and phase-2-error render branches; added `defaultConfig` to `<GraphicWalker>`; changed the page root to `flex h-dvh flex-col` and the canvas wrapper to `min-h-0 flex-1`

## Decisions Made
- Kept the new error-kind union local to `ExplorerPage.tsx` rather than widening `FetchState<T>`, per the plan's explicit instruction that other pages depend on `FetchState`'s message-string shape
- Settled both phase-2 requests via `Promise.allSettled` with fixed-priority classification (metadata-404 first) rather than continuing to race them with `Promise.all`, eliminating the timing-dependent behaviour that was the actual root cause underneath the missing-title symptom
- Reused the exact same not-found title/message constants for both the `!valid` guard and the phase-2 not-found kind, since the plan calls out that a malformed id and a non-existent id must be indistinguishable to a visitor

## Deviations from Plan

None - plan executed exactly as written. Both tasks' `<action>` sections were followed verbatim; no Rule 1-4 auto-fixes were needed.

## Issues Encountered

No browser automation tool was available in this execution environment to perform the plan's `<human-check>` verification blocks (the `claude-in-chrome` skill reported the Chrome extension is not installed/connected). All automated `<verify>` commands for both tasks were run and passed: `npm run build` (including the `tsc -b` exhaustiveness gate), `npx vitest run` (25/25 passing, unchanged), `npm run lint` (clean), and both tasks' load-bearing greps (`No s'han pogut carregar les dades d'aquesta enquesta` present in source; `100dvh` present in the compiled stylesheet, proving the Tailwind utility actually compiled rather than being silently dropped). The visual/interactive portions of both tasks' human-checks (rendered heading text, chart-fills-canvas, share-link round trip, responsive/dark-mode layout) were not performed and are recorded as two open `unrun-verify` entries in `.planning/WINDOWS.md` (entries 6 and 7) for a human to confirm against the running `npm run preview:pages` production preview, consistent with STATE.md's standing Phase 3 blocker requiring production-build verification.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Both G-03-2b and G-03-4b's code-level fixes are complete and pass every automated gate; Phase 3's remaining open item is the human verification of this plan's own `<human-check>` blocks (WINDOWS.md entries 6-7), which composes with plan 03-05's share-link fix already landed
- No other files were touched — `src/pages/ExplorerPage.tsx` was this plan's exclusive scope, matching its own success criteria

## Self-Check: PASSED

- FOUND: src/pages/ExplorerPage.tsx
- FOUND: .planning/phases/03-interactive-explorer/03-06-SUMMARY.md
- FOUND: 331116f (Task 1 commit)
- FOUND: 74880b9 (Task 2 commit)
- Full project test suite (`npx vitest run`): 2 files, 25/25 tests pass
- Full production build (`npm run build`, including `tsc -b`): passes clean
- Lint (`npm run lint`): passes clean
- `git log --oneline --all --grep="03-06"` returns both task commits above (message subjects use the `(03-06)` scope)

---
*Phase: 03-interactive-explorer*
*Completed: 2026-08-27*
