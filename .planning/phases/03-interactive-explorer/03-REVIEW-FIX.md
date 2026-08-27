---
phase: 03-interactive-explorer
fixed_at: 2026-08-27T21:02:29Z
review_path: .planning/phases/03-interactive-explorer/03-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 5
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-08-27T21:02:29Z
**Source review:** .planning/phases/03-interactive-explorer/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 5 (fix_scope: critical_warning — CR-01, WR-01 through WR-04; IN-01 and IN-02 skipped by scope)
- Fixed: 5
- Skipped: 0

**Verification environment:** All fixes were made and verified inside an isolated git worktree (`workflow.use_worktrees` was not disabled), with `node_modules` symlinked from the main checkout (no reinstall). `npx tsc --noEmit -p .`, `npx tsc -b` (full build typecheck), `npx eslint .`, and `npx vitest run` were all re-run clean after the last commit — results should reproduce identically from the main checkout after this worktree's commits are merged in.

## Fixed Issues

### CR-01: `decodeShareLink` can return a non-array value that violates the `IChart[]` contract every caller relies on

**Files modified:** `src/lib/shareLink.ts`
**Commit:** `102c659`
**Applied fix:** Step 8 now returns `charts` (the normalized array built at step 6 — either `parsed` itself when it was already an array, or `[parsed]` when it was a bare single chart-shaped object) instead of returning the raw `parsed` value verbatim. This guarantees the function's return value always matches the `IChart[] | undefined` shape every caller (and `ExplorerPage.tsx`'s `as IChart[] | undefined` cast) relies on. Updated the doc comments on `decodeShareLink` and the step-6 inline comment to accurately describe the normalization instead of claiming "no wrapping, no normalisation." Existing round-trip tests in `shareLink.test.ts` all pass unchanged (they already exercise array-shaped specs, for which `charts === parsed` by reference, so behavior is identical for every existing test case).

### WR-01: `isChartLike` accepts an array-typed `encodings`, silently disabling the T-03-11 schema-drift check for that payload

**Files modified:** `src/lib/shareLink.ts`
**Commit:** `59d840b`
**Applied fix:** Added `!Array.isArray(candidate.encodings)` to `isChartLike`'s guard, applied exactly as suggested in REVIEW.md. `{"visId":"v1","encodings":[]}` (and any array-typed `encodings`) is now correctly rejected, so `collectShelfFieldReferences`'s `key in encodings` check can no longer be silently bypassed by handing it an array.

### WR-02: A top-level empty array is accepted as a valid decoded chart instead of falling back to `undefined`

**Files modified:** `src/lib/shareLink.ts`
**Commit:** `21af62f`
**Applied fix:** Step 6's guard is now `if (charts.length === 0 || !charts.every(isChartLike))`, applied exactly as suggested in REVIEW.md. A top-level empty array (e.g. `?chart=v1.W10`) now correctly returns `undefined` instead of `[]`, matching the documented "malformed/stale link behaves like no link at all" contract.

### WR-03: `SurveySummaryModal`'s fetch effect never resets `state` to `loading` when `enquestaId` changes

**Files modified:** `src/components/SurveySummaryModal.tsx`
**Commits:** `0965305` (initial fix, following REVIEW.md's suggested `setState({ status: 'loading' })` call at the top of the effect), `3012a49` (follow-up correction)
**Applied fix:** The initial fix applied REVIEW.md's suggestion literally (`setState({ status: 'loading' })` as the first line inside the fetch effect), but this project's ESLint config enforces `react-hooks/set-state-in-effect`, which flags exactly this pattern (a synchronous `setState` call inside an effect body causes an avoidable cascading render) — this was the only lint error in the entire repository after the first commit, so it was corrected in a same-session follow-up commit rather than left broken. The final implementation follows React's own recommended "adjusting state when a prop changes" pattern instead: a `trackedEnquestaId` state variable is compared against `enquestaId` during render, and if they differ, both `setTrackedEnquestaId` and `setState({ status: 'loading' })` are called synchronously during the render body (not inside `useEffect`) — this bails out and re-renders immediately with the reset state before the fetch effect even runs, with no extra flicker and no lint violation. `npx eslint .` is clean across the whole project after this correction.

### WR-04: `SurveySummaryModal` shows the same generic error message for "survey not found" and "load failed"

**Files modified:** `src/components/SurveySummaryModal.tsx`
**Commit:** `b4e9382`
**Applied fix:** Mirrored `ExplorerPage.tsx`'s `SurveyNotFoundError`/classification pattern for the identical `metaUrl(id)` endpoint: added a local `SurveyNotFoundError` class, thrown when `res.status === 404`; the `.catch()` handler now sets `NOT_FOUND_MESSAGE` ("Aquesta enquesta ja no existeix o l'enllaç no és correcte.") for that case and `LOAD_FAILED_MESSAGE` ("No s'ha pogut carregar el resum d'aquesta enquesta. Comprova la connexió i torna-ho a provar.") for any other failure. `FetchState<T>`'s shared error shape (`{ status: 'error'; message: string }`) was kept as-is — only the message text is now conditional — since that type is also used by `HomePage.tsx` and widening it was out of scope for this fix.

## Skipped Issues (out of fix_scope)

The following findings from REVIEW.md were Info-tier and excluded by `fix_scope: critical_warning`; they were not attempted:

### IN-01: Engine-init error state renders the same sentence twice

**File:** `src/pages/ExplorerPage.tsx:129,213`
**Reason:** Out of scope (`fix_scope: critical_warning` excludes Info-tier findings).

### IN-02: `shareLink.test.ts` has no coverage for the shape edge cases that WR-01/WR-02/CR-01 exploit

**File:** `src/lib/shareLink.test.ts`
**Reason:** Out of scope (`fix_scope: critical_warning` excludes Info-tier findings). Note: since CR-01/WR-01/WR-02 are now fixed, the three suggested test cases in REVIEW.md's IN-02 fix section would all pass against the corrected implementation if added later.

---

_Fixed: 2026-08-27T21:02:29Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
