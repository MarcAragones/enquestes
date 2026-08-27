---
phase: 03-interactive-explorer
plan: 05
subsystem: explorer
tags: [graphic-walker, share-link, tdd, schema-drift, security]

# Dependency graph
requires:
  - phase: 03-interactive-explorer
    provides: "src/lib/shareLink.ts encode/decode module and its 16-test suite (plan 03-03)"
provides:
  - "decodeShareLink() that actually restores a real GraphicWalker-produced chart spec, closing gap G-03-4 (EXPL-11 was 0% functional before this plan)"
  - "shareLink.test.ts fixture (makeSpec()) that mirrors VizSpecStore.exportCode()'s real runtime shape, preventing this fixture/reality mismatch from recurring"
  - "shelf-scoped schema-drift check with a GraphicWalker virtual-fid allowlist (T-03-11, narrowed not weakened)"
affects: [03-06]

# Actuals (#2632)
actuals:
  tokens: 3686
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Shelf-scoped field-reference validation: schema-drift guards over a GraphicWalker DraggableFieldState must walk shelf channels (rows/columns/color/.../filters/text) only, never the dimensions/measures catalogue, which enumerates dataset availability rather than chart content"
    - "Virtual-fid allowlisting: library-internal computed field ids (gw_count_fid/gw_mea_key_fid/gw_mea_val_fid) that a survey's data can never produce are allowlisted explicitly rather than excluded via broader/weaker matching"

key-files:
  created: []
  modified:
    - src/lib/shareLink.ts
    - src/lib/shareLink.test.ts

key-decisions:
  - "Reordered decodeShareLink's structural guard (isChartLike) to run before the field-reference guard, so the narrower check can assume every inspected value already has a confirmed encodings object (CR-01 strengthened by ordering, not just narrowed by scope)"
  - "Implemented both halves of G-03-4's fix (shelf-scoping AND virtual-fid allowlisting) rather than either alone, per the plan's objective: shelf-scoping alone still rejects a chart that shelves gw_count_fid; allowlisting alone still rejects a stale-catalogue-but-clean-shelves link"

requirements-completed: [EXPL-11]

coverage:
  - id: D1
    description: "A chart spec shaped like a real VizSpecStore.exportCode() output (full field catalogue including GraphicWalker's three virtual fids, four fields on shelves) round-trips losslessly through encodeShareLink -> decodeShareLink"
    requirement: EXPL-11
    verification:
      - kind: unit
        ref: "src/lib/shareLink.test.ts#round-trips a representative spec (fields, mark, filter) losslessly"
        status: pass
      - kind: unit
        ref: "src/lib/shareLink.test.ts#round-trips accented Catalan filter text byte-identically (UTF-8 safety)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A chart that legitimately places a GraphicWalker virtual field (Number of records) on a shelf survives the round trip"
    requirement: EXPL-11
    verification:
      - kind: unit
        ref: "src/lib/shareLink.test.ts#round-trips a chart that places a GraphicWalker virtual field on a shelf (e.g. Number of records on rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "A spec whose catalogue lists a stale field absent from knownFieldNames, while every shelf holds only known fields, is accepted (catalogue exclusion works as intended)"
    requirement: EXPL-11
    verification:
      - kind: unit
        ref: "src/lib/shareLink.test.ts#accepts a spec whose catalogue lists a stale field absent from knownFieldNames, as long as every shelf holds only known fields"
        status: pass
    human_judgment: false
  - id: D4
    description: "The T-03-11 schema-drift control still rejects a spec that places a field absent from the current survey's meta.json on any shelf channel — the narrowing does not weaken the security control"
    requirement: EXPL-11
    verification:
      - kind: unit
        ref: "src/lib/shareLink.test.ts#returns undefined for a spec that places a field absent from knownFieldNames directly on a shelf channel"
        status: pass
      - kind: unit
        ref: "src/lib/shareLink.test.ts#returns undefined for a spec referencing a field name absent from knownFieldNames"
        status: pass
    human_judgment: false
  - id: D5
    description: "decodeShareLink still returns undefined and never throws for every pre-existing hostile input class (null, empty, oversized, wrong version tag, non-base64, non-JSON)"
    requirement: EXPL-11
    verification:
      - kind: unit
        ref: "src/lib/shareLink.test.ts (decodeShareLink hostile/stale input handling describe block, 9 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "End-to-end restoration in a real browser (paste a copied link into a fresh tab, see the identical chart)"
    verification: []
    human_judgment: true
    rationale: "This plan fixes the unit-level defect only; the plan's own <verification> section explicitly defers real-browser confirmation to plan 03-06's human check, which runs after this plan lands."

duration: 5min
completed: 2026-08-27
status: complete
---

# Phase 03 Plan 05: Share Link Shelf-Scoped Field Check Summary

**Fixed G-03-4 (EXPL-11 was 0% functional): decodeShareLink now walks only GraphicWalker's shelf channels for its schema-drift check, with an explicit allowlist for the library's three internal virtual field ids, so every real shared chart link restores correctly instead of silently failing 100% of the time.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-08-27T20:25:50Z
- **Completed:** 2026-08-27T20:30:41Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Rewrote `shareLink.test.ts`'s `makeSpec()` fixture to model GraphicWalker's real `VizSpecStore.exportCode()` output shape (array-wrapped, full field catalogue including `gw_count_fid`/`gw_mea_key_fid`/`gw_mea_val_fid`, shelf assignments independent of the catalogue) — the mismatch between this fixture and reality is precisely what let G-03-4 ship undetected
- Reordered `decodeShareLink`'s structural guard (`isChartLike`) ahead of the field-reference guard, and rewrote the field-reference guard to walk only `DraggableFieldState`'s 14 shelf-channel keys, excluding `dimensions`/`measures` (the field catalogue)
- Added a `GRAPHIC_WALKER_VIRTUAL_FIDS` allowlist so a chart that legitimately drags a GraphicWalker virtual field (e.g. "Number of records") onto a shelf still round-trips
- Full RED -> GREEN TDD cycle: 4 tests failed exactly as predicted after the fixture rewrite (Task 1), all 19 `shareLink.test.ts` tests plus the full 25-test suite pass after the fix (Task 2), with lint and `tsc -b`/`vite build` clean

## Task Commits

Each task was committed atomically:

1. **Task 1: Model GraphicWalker's real export shape in the test fixture (RED)** - `ddd7632` (test)
2. **Task 2: Scope the schema-drift check to shelf channels with a virtual-fid allowlist (GREEN)** - `14a0788` (feat)

_TDD plan: RED and GREEN gate commits both present and correctly ordered (verified via `git log --oneline --grep`)._

## Files Created/Modified
- `src/lib/shareLink.ts` - Reordered structural guard ahead of field-reference guard; added `GRAPHIC_WALKER_VIRTUAL_FIDS` allowlist, `SHELF_CHANNEL_KEYS` list, and `collectShelfFieldReferences()`; rewrote decode steps 6-7 to validate shape first then walk only shelf channels
- `src/lib/shareLink.test.ts` - Rewrote `makeSpec()` to return an array shaped like a real `exportCode()` output with a full field catalogue; added 3 new tests (virtual field on shelf, stale catalogue acceptance, unknown shelf-field rejection) plus updated the accented-filter assertion for the array wrapper; typed shelf/catalogue arrays (`SpecField`/`SpecFilterField`) to satisfy `tsc -b`

## Decisions Made
- Reordered the chart-shape guard ahead of the field-reference guard (plan-specified) — this both simplifies the narrower check (it can assume a confirmed `encodings` object) and strengthens CR-01 (a non-chart-shaped payload is now rejected before any field logic runs)
- Implemented both halves of the fix (shelf-scoping AND allowlisting) as the plan required — neither alone fully restores EXPL-11 without either re-opening a false-rejection case or weakening the schema-drift control

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed a `tsc -b` type error in the rewritten test fixture**
- **Found during:** Task 2 verification (`npm run build`)
- **Issue:** The rewritten `makeSpec()`'s empty shelf-channel arrays (e.g. `size: []`) inferred as `never[]`, so assigning a field object to `spec[0].encodings.size` in the new "unknown shelf-field" test failed to typecheck
- **Fix:** Added `SpecField`/`SpecFilterField` type aliases and annotated every shelf/catalogue array in `makeSpec()` with them
- **Files modified:** src/lib/shareLink.test.ts
- **Verification:** `npm run build` (tsc -b + vite build) passes
- **Committed in:** 14a0788 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Necessary for the build to typecheck; no scope creep — purely a test-fixture typing fix required by the plan's own fixture rewrite.

## Issues Encountered
- The RED-phase commit's message body (`ddd7632`) has a stray trailing `EOF`/`)` artifact from a shell heredoc-quoting interaction when the message text contained apostrophes (e.g. `exportCode()'s`). The first line (`test(03-05): ...`) and all substantive content are intact and the TDD gate grep (`git log --oneline --grep="^test(03-05)"`) matches correctly; only cosmetic trailing lines in the commit body are affected. Left as-is per the git-safety protocol (no amend/rebase of a commit that already has a dependent commit on top) rather than rewriting history for a cosmetic issue.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- EXPL-11 (shareable link) is now functionally restored at the unit level; plan 03-06's human verification step is the last remaining check (real-browser paste-and-restore) before this requirement can be marked fully validated
- No other files were touched — `src/pages/ExplorerPage.tsx` remains plan 03-06's exclusive scope, as this plan's success criteria required

---
*Phase: 03-interactive-explorer*
*Completed: 2026-08-27*
