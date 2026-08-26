---
phase: 03-interactive-explorer
fixed_at: 2026-08-26T22:30:08Z
review_path: .planning/phases/03-interactive-explorer/03-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 3: Code Review Fix Report

**Fixed at:** 2026-08-26T22:30:08Z
**Source review:** .planning/phases/03-interactive-explorer/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (1 critical, 3 warnings)
- Fixed: 4
- Skipped: 0

## Fixed Issues

### CR-01: Unvalidated share-link payload shape can crash the survey page (no error boundary)

**Files modified:** `src/lib/shareLink.ts`, `src/pages/ExplorerPage.tsx`, `src/components/ChartErrorBoundary.tsx` (new)
**Commit:** `5e933df`
**Applied fix:**
Before applying the review's suggested snippet verbatim, verified the actual GraphicWalker 0.5.2 contract against `03-03-SUMMARY.md` and `node_modules/@kanaries/graphic-walker/dist/interfaces.d.ts`: `ISpecProps.chart` accepts `IChart[] | IVisSpec[]`, and both `IChart` and the deprecated `IVisSpec` require a non-optional `visId: string` and a non-optional `encodings: DraggableFieldState` object. The review's suggested check (`typeof chart.encodings === 'object'`) was structurally correct for this installed version, but its `Array.isArray(parsed)`-only top-level gate would have broken all 16 existing `shareLink.test.ts` assertions — the test fixture `makeSpec()` encodes a single chart-shaped object, not an array, to exercise the encode/decode mechanics generically. Adapted the fix: added an `isChartLike()` guard (checks `visId`/`encodings` per the confirmed types) applied either to every element of an array or to a bare object, so real production payloads (`IChart[]`, from `VizSpecStore.exportCode()`) and the existing single-object test fixtures both validate correctly, while non-chart-shaped JSON (the `?chart=v1.NDI` → `42` exploit from the finding, bare strings/booleans, objects missing `visId`/`encodings`) is rejected and `decodeShareLink` returns `undefined`.

As defense-in-depth (the review's "and/or ... ideally both" suggestion), also added a new `ChartErrorBoundary` class component (React error boundaries require a class; there is no hook equivalent) wrapping `<GraphicWalker />` in `ExplorerPage.tsx`, keyed on the raw `?chart=` param so a fresh navigation resets a previously-tripped boundary. Any future render-time throw inside GraphicWalker now degrades to a friendly `ErrorState` instead of an unrecoverable blank page.

Verified: manually confirmed via a scratch script that `decodeShareLink` now returns `undefined` for the exact exploit payload (`encodeShareLink(42)` → decode → `undefined`) and for a bare non-chart object; all 16 existing `shareLink.test.ts` assertions still pass unmodified.

### WR-01: TOCTOU race in `queryParquet`'s file-registration guard

**Files modified:** `src/services/duckdb.ts`
**Commit:** `168cf9f`
**Applied fix:** Replaced the boolean `registeredFiles` Set (checked-then-set across an `await`, racy under StrictMode's double-invoked effect or a fast double-click on the phase-2 retry button) with a `Map<string, Promise<void>>` caching the in-flight `registerFileURL` promise itself, following the review's suggested pattern. A concurrent second caller now awaits the first caller's in-flight registration instead of racing it. Added one refinement beyond the review's snippet: on registration failure, the cache entry is evicted (`.catch(() => { registrationPromises.delete(virtualName); throw err })`) so a subsequent retry attempt re-registers instead of permanently replaying a cached rejection.

### WR-02: vitest `include` glob excludes `.test.tsx`

**Files modified:** `vite.config.ts`
**Commit:** `ec30755`
**Applied fix:** Applied the review's suggested fix verbatim — changed `test.include` from `['src/**/*.test.ts']` to `['src/**/*.test.{ts,tsx}']`. No `.test.tsx` files exist yet, so this is a no-op for the current suite (confirmed 22/22 tests still pass) but unblocks the first future component test from silently being skipped by `npm test`.

### WR-03: Engine-init failure treated as universally non-transient

**Files modified:** `src/services/duckdb.ts`, `src/pages/ExplorerPage.tsx`
**Commit:** `fb6bc29`
**Applied fix:** Per the review's "at minimum" guidance plus the "consider offering a retry" follow-on, implemented both: (1) softened the phase-1 error copy to `"No s'ha pogut inicialitzar el motor de consultes. Comprova la connexió i torna-ho a provar."` (no longer assumes an incompatible-browser cause), and (2) added an `engineAttempt` counter plus an exported `resetDb()` in `duckdb.ts` (clears the cached `dbPromise` so a retry actually re-attempts `initDb()` rather than replaying the same rejected promise) wired to a new `onEngineRetry` handler and the `ErrorState`'s `onRetry` prop, mirroring phase 2's existing retry pattern. As a side effect, this also makes the previously-dead `engineState.message` field (IN-01, out of scope) actually populated and rendered, since the error state now carries a real message string.

## Skipped Issues

None — all four in-scope findings were fixed.

## Verification

Ran the full project verification suite in the isolated worktree after all four commits (each individual fix was also verified at commit time — see per-fix Tier 1/2 checks above):

- `npm run build` — pass (tsc -b + vite build, no new errors)
- `npm run lint` — pass (eslint, zero warnings/errors)
- `npx vitest run` — pass (2 test files, 22/22 assertions)
- `npm run verify:explorer` — pass (all 4 DuckDB asset checks)
- `npm run verify:pages` — pass

All verification ran inside the isolated git worktree (`.claude/worktrees/rf-03-44074-1787783108`, branch `gsd-reviewfix/03-44074`), with `node_modules` symlinked from the main checkout rather than reinstalled. The worktree's commits were fast-forwarded onto `main` and the worktree removed as part of this run's cleanup — the same numbers are reproducible from `main` after that fast-forward.

## Notes for human review

- CR-01's fix (`isChartLike`) is a structural/shape guard, not a logic-bug fix — no `human_judgment: requires human verification` flag needed per the verification_strategy's logic-bug carve-out.
- WR-03 changes the phase-1 error UX (message text + a new retry button). The functional behavior (retry actually re-attempts engine init) was verified via build/lint/test, but the *visual* appearance of the new retry button in the phase-1 error state was not manually screenshotted — same class of deferred manual UAT already tracked for this phase's other button-facing changes in `.planning/WINDOWS.md`.

---

_Fixed: 2026-08-26T22:30:08Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
