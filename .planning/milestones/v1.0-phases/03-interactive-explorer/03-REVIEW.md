---
phase: 03-interactive-explorer
reviewed: 2026-08-29T00:00:00Z
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
  warning: 4
  info: 4
  total: 8
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-29T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This is the current, post-gap-closure state of the interactive-explorer phase (after 03-08's `m-auto` fix for G-03-7). Overall the implementation is unusually careful: `dialogLifecycle.ts` and `shareLink.ts` in particular are backed by extensive adversarial test suites that already close out several previously-found defects (G-03-5's StrictMode close-suppression race, T-03-11's schema-drift check, T-03-12's DoS length cap, CR-01's array-normalization contract). `queryParquet`'s SQL construction was traced end-to-end against `isValidEnquestaId`'s `[A-Za-z0-9._-]{1,64}` allowlist and is not injectable. Dependency versions in `package.json`/`package-lock.json` are internally consistent (verified against installed `node_modules` metadata) and `apache-arrow` is correctly pinned to the exact version `@duckdb/duckdb-wasm` depends on.

No Critical/security findings were confirmed. The issues below are real robustness and quality gaps: an unguarded `decodeURIComponent` in the local preview server that crashes the whole Node process on one malformed request, a modal whose action buttons stay live regardless of load/validity state, an unchecked BigInt→Number narrowing with no bounds guard, and a complete absence of component-level tests for the phase's most stateful UI (despite exemplary unit coverage of the pure logic modules).

## Warnings

### WR-01: Malformed request URL crashes the entire local preview/verify server process

**File:** `scripts/gh-pages-preview.mjs:62`
**Issue:** `const pathname = decodeURIComponent(url.pathname)` is not wrapped in a try/catch. `decodeURIComponent` throws a `URIError` on a malformed percent-escape (e.g. a bare `%` in the request path). Because `handler` is an `async function` and `createServer(handler)` never attaches a `.catch()` to its returned promise, this throw becomes an unhandled promise rejection. Verified directly: a Node http server with the same shape terminates with exit code 1 on the very first malformed request (reproduced locally — no `unhandledRejection` listener installed, so Node's default "throw" behavior kills the process). This script backs `npm run preview:pages`, `npm run verify:pages`, and (via `verify-explorer-assets.mjs`) `npm run verify:explorer`; one malformed browser request during a local preview session (a stray `%`, a bad copy-pasted URL, a scanner/crawler hitting the dev port) kills the server outright, not just that one request.
**Fix:**
```js
const url = new URL(req.url, 'http://localhost')
let pathname
try {
  pathname = decodeURIComponent(url.pathname)
} catch {
  res.writeHead(400)
  res.end('Bad request')
  return
}
```

### WR-02: SurveySummaryModal's footer actions ignore load/validity state

**File:** `src/components/SurveySummaryModal.tsx:219-234`
**Issue:** The `Tanca` / `Explorar dades interactives` button row is rendered unconditionally, outside every `idValid`/`state.status` branch above it. This means "Explorar dades interactives" is clickable (and calls `handleExplore` → `navigate('/enquesta/...')`) while the id is known-invalid, while the summary is still loading, and after the summary fetch has failed (including the `SurveyNotFoundError` case). None of these crash — `ExplorerPage` independently re-validates and re-fetches — but the visitor is offered a live CTA into a destination that is already known to be broken or not yet confirmed to exist, which is a real UX/logic gap for a control the review is scoped to catch (missing edge-case handling on user-facing state).
**Fix:**
```tsx
<button
  type="button"
  onClick={handleExplore}
  disabled={!idValid || state.status !== 'success'}
  className="rounded-md bg-accent px-4 py-2 text-sm text-white hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
>
  Explorar dades interactives
</button>
```

### WR-03: BigInt→Number conversion has no bounds guard

**File:** `src/services/duckdb.ts:110-116`
**Issue:** Every `bigint`-typed column value returned by DuckDB is unconditionally narrowed with `Number(obj[key] as bigint)`. The comment justifies this as "safe for this dataset's value ranges... all far below Number.MAX_SAFE_INTEGER," but `queryParquet` is a generic, id-parameterised function reused for every survey published to `public/data/`, not just the one dataset the comment reasons about — and there is no runtime check enforcing that assumption. A future survey with a large int64 measure (e.g. a raw count or an accumulated total near or past 2^53) would silently lose precision with no error, warning, or fallback; GraphicWalker would then render a subtly wrong number to visitors.
**Fix:**
```ts
if (typeof obj[key] === 'bigint') {
  const big = obj[key] as bigint
  if (big > Number.MAX_SAFE_INTEGER || big < Number.MIN_SAFE_INTEGER) {
    console.warn(`queryParquet: value for column "${key}" exceeds Number.MAX_SAFE_INTEGER; precision may be lost`)
  }
  obj[key] = Number(big)
}
```

### WR-04: No automated test coverage for any stateful UI component in the phase

**File:** `src/components/SurveySummaryModal.tsx`, `src/pages/ExplorerPage.tsx`, `src/components/ExplorerHeader.tsx`
**Issue:** `dialogLifecycle.ts`, `graphicWalkerFields.ts`, and `shareLink.ts` each have thorough, hostile-input-aware test suites — but the components that actually wire this logic to the DOM and to network state (`SurveySummaryModal`'s render-phase id-reset + two-branch fetch classifier, `ExplorerPage`'s two-phase engine/data state machine with `Promise.allSettled` priority classification, `ExplorerHeader`'s copy-link timer) have zero tests. Compounding this, `vite.config.ts:10` sets `test: { environment: 'node' }`, which has no DOM — even if a component test were added today (e.g. via React Testing Library), it could not run against the current Vitest config without first switching to `jsdom`/`happy-dom`. Given the amount of subtle, previously-buggy state logic living in these components (G-03-5, G-03-2b, WR-03/WR-04 referenced in their own comments), this is the highest-risk untested surface in the phase.
**Fix:** Add `jsdom` (or `happy-dom`) as a devDependency, set `test.environment` per-file via a `// @vitest-environment jsdom` pragma or a second Vitest project/workspace entry scoped to `src/**/*.tsx`, and add at least: (1) a `SurveySummaryModal` test for the invalid-id branch, the not-found vs load-failed classification, and the id-change render-reset; (2) an `ExplorerPage` test for the not-found-takes-priority-over-load-failed classification in the `Promise.allSettled` handler.

## Info

### IN-01: Unchecked type assertion masks non-object array elements before runtime validation

**File:** `src/lib/shareLink.ts:253`
**Issue:** `const charts: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed]` asserts every element of `parsed` is a `Record<string, unknown>` at the type level before any runtime check has confirmed it — e.g. `parsed = [42, "x"]` type-checks here despite neither element being an object. It happens to be safe today only because `isChartLike` (called immediately after, at line 261) independently re-validates each element's actual runtime shape before anything downstream dereferences it — but the type annotation itself is currently making a claim the code hasn't earned yet, which could mislead a future edit that reads `charts[i]` between this line and the `isChartLike` check.
**Fix:** Type `charts` as `unknown[]` at declaration and narrow only after `isChartLike` has run, or have `isChartLike` act as a type predicate (`value is Record<string, unknown> & { visId: string; encodings: object }`) so the narrowing is enforced by the compiler rather than by ordering discipline.

### IN-02: `registrationPromises` cache is never invalidated by `resetDb()`

**File:** `src/services/duckdb.ts:54-56, 69`
**Issue:** `resetDb()` clears `dbPromise` but not the module-level `registrationPromises` map, which is keyed only by `virtualName` (derived from survey id), not by which `AsyncDuckDB` instance the registration happened against. Today this is unreachable in practice — `onEngineRetry` is only exposed while `engineState.status === 'error'`, a state phase 2 (and therefore `ensureRegistered`) never runs during — but the two caches have no structural coupling enforcing that invariant, so a future retry path or refactor that calls `queryParquet` for an id already registered against a since-discarded `AsyncDuckDB` would silently skip re-registering against the new instance.
**Fix:** Clear `registrationPromises` inside `resetDb()`, or key cache entries by a `(db, virtualName)` pair instead of `virtualName` alone.

### IN-03: `ExplorerHeader.handleClick` does not guard against a rejecting `onCopyLink`

**File:** `src/components/ExplorerHeader.tsx:35-41`
**Issue:** `handleClick` does `await onCopyLink()` with no `try`/`catch`. The `onCopyLinkProps` type (`() => void | Promise<void>`) does not promise the handler never rejects, and React's `onClick={handleClick}` does not await or catch the returned promise — a rejecting `onCopyLink` would surface as an unhandled promise rejection in the console, and `setCopied(true)` would never run. Currently unreachable because the only caller (`ExplorerPage.onCopyLink`) already wraps its `clipboard.writeText` in its own `try`/`catch`, but the component's own contract doesn't enforce that.
**Fix:** Wrap the await in a try/catch inside `handleClick` so the component is safe regardless of what a future caller passes:
```ts
const handleClick = async () => {
  if (!onCopyLink) return
  try {
    await onCopyLink()
  } catch {
    return
  }
  setCopied(true)
  ...
}
```

### IN-04: `SurveyNotFoundError` is duplicated verbatim across two files

**File:** `src/components/SurveySummaryModal.tsx:24`, `src/pages/ExplorerPage.tsx:42`
**Issue:** Both files independently declare `class SurveyNotFoundError extends Error {}` to classify a 404 from the same `metaUrl(id)` endpoint. Both files' own comments acknowledge this is a deliberate mirror of the other's classification — the duplication is self-aware, not accidental — but it's still the same class defined twice, and a future change to one classifier's semantics (e.g. adding a constructor field) won't propagate to the other.
**Fix:** Move `SurveyNotFoundError` into `src/lib/enquestes.ts` (already the shared module owning `metaUrl`/`parseEnquestaMeta`) and import it from both call sites.

---

_Reviewed: 2026-08-29T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
