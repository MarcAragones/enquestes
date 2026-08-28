---
phase: 03-interactive-explorer
reviewed: 2026-08-28T17:06:13Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - package-lock.json
  - package.json
  - scripts/gh-pages-preview.mjs
  - scripts/verify-explorer-assets.mjs
  - src/App.tsx
  - src/components/DataDictionary.tsx
  - src/components/ErrorState.tsx
  - src/components/ExplorerHeader.tsx
  - src/components/SurveySummaryModal.tsx
  - src/lib/dialogLifecycle.test.ts
  - src/lib/dialogLifecycle.ts
  - src/lib/graphicWalkerFields.test.ts
  - src/lib/graphicWalkerFields.ts
  - src/lib/shareLink.test.ts
  - src/lib/shareLink.ts
  - src/pages/ExplorerPage.tsx
  - src/services/duckdb.ts
  - vite.config.ts
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-28T17:06:13Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Focused review of the G-03-5 dialog-lifecycle gap-closure module (`src/lib/dialogLifecycle.ts`) plus the full listed file set. `npx vitest run` (46/46 passing across 3 files), `npx tsc -b --noEmit` (clean), and `npx eslint .` (clean) were all re-run as part of this review rather than trusted at face value.

**`src/lib/dialogLifecycle.ts` — no defect found.** I traced the suppression-counter design by hand against all three dispatch-timing schedulers (immediate/microtask/macrotask) the test file already exercises, plus two scenarios the tests don't cover directly (a real user dismissal racing the still-pending StrictMode-artifact dispatch; a genuine unmount with no subsequent remount). Both traces resolve correctly: the counter always drains to exactly zero across a StrictMode double-invoke, and a genuine-unmount's non-zero leftover counter is inert because the ref (and the whole component instance) is discarded with it. The fix's core claim — ordering the increment before `close()`, and reading a shared caller-owned counter rather than the listener identity, makes the fix independent of *when* the browser dispatches the queued `close` event — holds under manual trace. This is solid, well-reasoned, and well-tested work; I found nothing to fault here after deliberately trying to break it.

The issues below are outside `dialogLifecycle.ts`, in the surrounding files: two real inconsistencies (a stale-cache correctness gap in `duckdb.ts`, and a lockfile/manifest range mismatch introduced by this phase's `package.json` diff) and one UX/error-classification gap that mirrors a pattern this codebase otherwise cares about (G-03-2b) but misses one case of it.

## Warnings

### WR-01: `resetDb()` does not clear the stale Parquet file-registration cache

**File:** `src/services/duckdb.ts:54-56` (cache populated at `src/services/duckdb.ts:69-84`)
**Issue:** `resetDb()` clears the module-level `dbPromise` singleton so the next `getDb()` call spins up a fresh `AsyncDuckDB` + `Worker`. But `registrationPromises` — the separate module-level cache keyed by virtual filename, used by `ensureRegistered()` to skip re-calling `registerFileURL` — is never cleared. If `resetDb()` is ever called *after* a virtual file has already been successfully registered against the old `AsyncDuckDB`/worker pair, the next `queryParquet()` call reuses the cached (already-resolved) registration promise and skips `registerFileURL` entirely on the *new* db/worker, which never actually has that file registered. The resulting `read_parquet('<virtualName>')` query would fail against the new engine with a "file not found"-class error, and the only recourse exposed to the visitor is the same retry button that just triggered the problem.

Today this is not reachable through the shipped UI: `resetDb()` is only invoked from `onEngineRetry` in `ExplorerPage.tsx`, which is only rendered while `engineState.status === 'error'` — a state that, by construction, precedes any successful `queryParquet()` call (phase 2 / registration only runs after phase 1 succeeds). So no registration can exist in the cache at the moment `resetDb()` is currently called. This is a latent inconsistency between two caches that are supposed to be describing the same underlying resource, not an active bug — but it will silently misbehave the moment either (a) the retry UX is extended (e.g. a "reset explorer engine" affordance reachable after a successful load), or (b) engine-failure detection is added for a *previously working* engine (e.g. a crashed worker).

**Fix:**
```ts
export function resetDb(): void {
  dbPromise = null
  registrationPromises.clear()
}
```

### WR-02: `package.json` and `package-lock.json` disagree on the `styled-components` version range

**File:** `package.json:25`, `package-lock.json:14` (root manifest `dependencies.styled-components`)
**Issue:** This phase's diff adds `"styled-components": "^6.1.19"` to `package.json` (matching the range recorded in the phase's own task notes: "styled-components@^6.1.19"), but the corresponding lockfile entry added in the same diff records `"styled-components": "^6.5.3"` in `package-lock.json`'s root package manifest, and the resolved package is pinned at `6.5.3`. Verified independently:
```
package.json declares:       ^6.1.19
package-lock.json declares:  ^6.5.3
resolved node_modules version: 6.5.3
```
`6.5.3` does satisfy `^6.1.19`, so `npm ci` currently succeeds (verified locally with a clean `npm ci` run) and CI is not currently broken by this. But the lockfile does not actually reflect what `package.json` asks for — someone ran `npm install styled-components` (grabbing latest-matching-`^6`, `6.5.3`) and then hand-edited `package.json`'s range down to `^6.1.19` without regenerating the lockfile, or vice versa. This is a real, verifiable drift between the two files this phase's diff introduced together, and it will produce confusing/unexpected diffs the next time anyone runs a plain `npm install` locally (npm will try to reconcile the two disagreeing sources).
**Fix:** Run `npm install` (or `npm install styled-components@^6.1.19`) and commit the regenerated `package-lock.json` so both files agree, or update `package.json` to `"styled-components": "^6.5.3"` if `6.5.3` was the intended floor.

### WR-03: `ExplorerPage`'s `load-failed` data error offers a Retry button even for a permanently-malformed `meta.json`

**File:** `src/pages/ExplorerPage.tsx:172-182`, retry button at `:225-230`
**Issue:** The Phase-2 classifier explicitly special-cases a `meta.json` 404 as `kind: 'not-found'` (no retry offered — "retrying a survey that does not exist cannot succeed", per the comment at line 221) specifically *because* G-03-2b already established that offering a retry for a permanent failure misleads the visitor. But the same classifier collapses a *different* permanent failure into the generic `'load-failed'` kind, which *does* render a Retry button:
```ts
try {
  const meta = parseEnquestaMeta(metaResult.value)
  setDataState({ status: 'success', data: { meta, rows: rowsResult.value } })
} catch {
  setDataState({ status: 'error', kind: 'load-failed' })   // <-- retry offered
}
```
If `metaResult.value` is valid JSON but fails `parseEnquestaMeta`'s schema validation (a genuinely malformed/corrupt published `meta.json` — e.g. a bad hand-edit, a broken publish step), that is exactly as permanent a failure as the 404 case: retrying will re-fetch the same malformed file and fail identically every time, forever. The visitor is shown "Comprova la connexió i torna-ho a provar" (check your connection and try again) and a working-looking retry button for a failure that has nothing to do with connectivity and can never be resolved by retrying.
**Fix:** Add a third `DataErrorKind` (e.g. `'invalid-data'`) for the schema-validation-failure branch specifically, and don't pass `onRetry` for it — mirroring exactly the treatment already given to `'not-found'`:
```ts
type DataErrorKind = 'not-found' | 'load-failed' | 'invalid-data'
// ...
try {
  const meta = parseEnquestaMeta(metaResult.value)
  setDataState({ status: 'success', data: { meta, rows: rowsResult.value } })
} catch {
  setDataState({ status: 'error', kind: 'invalid-data' })
}
// ...
content = dataState.kind === 'not-found' || dataState.kind === 'invalid-data'
  ? <ErrorState title={NOT_FOUND_TITLE} message={LOAD_FAILED_MESSAGE} />
  : <ErrorState title={LOAD_FAILED_TITLE} message={LOAD_FAILED_MESSAGE} onRetry={onDataRetry} />
```

## Info

### IN-01: Array index used as React `key` for the KPI grid

**File:** `src/components/SurveySummaryModal.tsx:180-185`
**Issue:** `state.data.kpis.map((kpi, i) => (<div key={i} ...>`. Each KPI has a stable, unique `label` already available; using the array index as the key is a well-known React footgun if the list is ever filtered/reordered/spliced (stale DOM state attached to the wrong item). Not currently exploitable since the KPI array is static per fetch, but it's a one-line fix and a common source of subtle bugs if this component is extended later.
**Fix:** `key={kpi.label}` (or `${kpi.label}-${i}` if labels aren't guaranteed unique).

### IN-02: Transitive dependency tree carries 10 known high-severity advisories

**File:** `package.json` / `package-lock.json` (via `@kanaries/graphic-walker` → `vega`/`vega-functions`/`vega-lite`/`vega-expression` → `nanoid`, and `vega-webgl-renderer` → `d3-color`)
**Issue:** `npm audit --omit=dev` reports 10 high-severity advisories, all transitive from the mandated `@kanaries/graphic-walker` dependency: a `d3-color` ReDoS, three `vega`-family XSS-via-`toString`-under-`VEGA_DEBUG` advisories, and a `nanoid` predictable-output advisory. These are not introduced by a choice this phase's author made — `@kanaries/graphic-walker` is a project-mandated dependency and no non-breaking upgrade path exists yet (`npm audit fix --force` would downgrade `@kanaries/graphic-walker` to `0.2.18`, a breaking change). The `VEGA_DEBUG`-gated XSS advisories are not exploitable in this app as shipped (the app never sets that global). Flagging for tracking/awareness only — worth revisiting when `@kanaries/graphic-walker` publishes a release with patched `vega`/`nanoid` transitive versions.
**Fix:** No action required now; track upstream `@kanaries/graphic-walker` releases and re-run `npm audit` after future version bumps.

### IN-03: Hardcoded exact byte-length assertion in the asset-verification script

**File:** `scripts/verify-explorer-assets.mjs:109-113`
**Issue:** `if (parquetBody.byteLength !== 5597) throw ...` asserts the fixture Parquet file is *exactly* 5597 bytes. This is a deliberate, narrow verification (proving the file is served byte-identical, not truncated/corrupted by the build+serve pipeline), but it's brittle: regenerating the fixture with a different Parquet writer version, compression setting, or even row-group metadata ordering would change the byte count by a few bytes and fail this script even though nothing is actually broken.
**Fix:** No change required for correctness, but consider deriving the expected size from a checked-in fixture stat (e.g. read the size of `public/data/enquestes/mostra-sintetica_respostes.parquet` from disk before the build) rather than a bare literal, so the assertion tracks the fixture instead of needing manual updates whenever it's regenerated.

---

_Reviewed: 2026-08-28T17:06:13Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
