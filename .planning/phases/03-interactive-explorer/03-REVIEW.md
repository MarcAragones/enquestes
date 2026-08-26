---
phase: 03-interactive-explorer
reviewed: 2026-08-26T22:21:24Z
depth: standard
files_reviewed: 14
files_reviewed_list:
  - package.json
  - scripts/gh-pages-preview.mjs
  - scripts/verify-explorer-assets.mjs
  - src/App.tsx
  - src/components/DataDictionary.tsx
  - src/components/ErrorState.tsx
  - src/components/ExplorerHeader.tsx
  - src/lib/graphicWalkerFields.test.ts
  - src/lib/graphicWalkerFields.ts
  - src/lib/shareLink.test.ts
  - src/lib/shareLink.ts
  - src/pages/ExplorerPage.tsx
  - src/services/duckdb.ts
  - vite.config.ts
findings:
  critical: 1
  warning: 3
  info: 3
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-26T22:21:24Z
**Depth:** standard
**Files Reviewed:** 14
**Status:** issues_found

## Summary

Reviewed the interactive-explorer phase: the DuckDB-Wasm data layer (`src/services/duckdb.ts`), the share-link encode/decode module and its tests, the GraphicWalker field-mapping shim, `ExplorerPage` and its supporting components, and the local GitHub-Pages-fidelity tooling (`scripts/gh-pages-preview.mjs`, `scripts/verify-explorer-assets.mjs`).

The SQL-injection and path-traversal surfaces are handled carefully and correctly: `isValidEnquestaId` gates every id before it reaches a virtual filename or a SQL string, and `gh-pages-preview.mjs`'s `resolveSafe` correctly contains any `../` escape attempt within its root. `decodeShareLink`'s hostile-input handling (length cap, version tag, base64/JSON error paths) is genuinely well-tested and never throws, as advertised.

The one finding that must block ship is that `decodeShareLink`'s "never throws" contract stops at the JSON/field-reference level — it does not validate that the decoded value is actually shaped like a GraphicWalker `IChart[]` before `ExplorerPage` type-asserts it and hands it straight to `<GraphicWalker chart={...} />`, and the app has no error boundary anywhere to catch what happens next. A handful of warnings (a real TOCTOU race in the Parquet file-registration guard, a vitest include-glob that silently excludes `.test.tsx`, and an engine-init failure message that assumes a non-transient cause) and minor info items round out the report.

## Critical Issues

### CR-01: Unvalidated share-link payload shape can crash the survey page (no error boundary)

**File:** `src/lib/shareLink.ts:110-169`, `src/pages/ExplorerPage.tsx:62-66,174`
**Issue:**
`decodeShareLink` validates the raw string length, the version tag, base64/UTF-8 decoding, JSON parsing, and that every nested `fid` value is a known field name — but it never validates that the *top-level* decoded value is actually an array of GraphicWalker chart specs. `collectFieldReferences` only walks into objects/arrays it finds; a JSON value that contains no nested `fid` key at all (e.g. a bare number, string, boolean, or an object without the expected `encodings`/`config`/`layout` structure) passes every check trivially, because the "referenced field names" set is empty and an empty set is vacuously a subset of `knownFieldNames`.

`ExplorerPage.tsx` then does:
```ts
return decodeShareLink(rawChartParam, knownFieldNames) as IChart[] | undefined
```
— an unchecked `as` cast from `unknown` straight into the type GraphicWalker's `chart` prop expects — and renders `<GraphicWalker ... chart={decodedChart} />` unconditionally once data has loaded.

Concretely, a URL such as `.../enquesta/mostra-sintetica?chart=v1.NDI` (base64url of the JSON value `42`) decodes to the number `42`, passes `decodeShareLink` cleanly, and is passed to GraphicWalker as `chart={42}`. GraphicWalker's internals assume an array of chart specs (`.map`/`.find`/property access on each entry); feeding it a non-array, non-chart-shaped value is very likely to throw during render. There is no `ErrorBoundary`/`componentDidCatch` anywhere in `src/` (confirmed via search), so this throw is not contained — it crashes past the nearest React root, producing a blank/broken page for that route. Because the bad state lives in the URL itself, a reload does not recover; the visitor must manually edit the address bar. Any survey link shared with a truncated, hand-edited, or stale `?chart=` value that happens to still parse as valid JSON reproduces this.

**Fix:** Add a minimal runtime shape check to `decodeShareLink` before returning, and reject anything that doesn't look like a chart-spec array (or wrap the render in an error boundary as defense in depth — ideally both):
```ts
// in shareLink.ts, replace step 7:
if (!Array.isArray(parsed)) return undefined
for (const chart of parsed) {
  if (
    typeof chart !== 'object' || chart === null ||
    typeof (chart as Record<string, unknown>).encodings !== 'object'
  ) {
    return undefined
  }
}
return parsed
```
and/or add a top-level `<ErrorBoundary>` around `<GraphicWalker />` in `ExplorerPage.tsx` so a shape mismatch degrades to a friendly `ErrorState` instead of a blank crash.

## Warnings

### WR-01: TOCTOU race in `queryParquet`'s file-registration guard — the exact scenario its own comment claims to prevent

**File:** `src/services/duckdb.ts:46-70`
**Issue:** The `registeredFiles` Set is meant to stop a virtual filename from being registered twice (the comment explicitly cites "React StrictMode's double-invoked effect... which would otherwise throw on the second `registerFileURL` call for the same name"). But the guard is check-then-act across an `await`, not atomic:
```ts
if (!registeredFiles.has(virtualName)) {
  await db.registerFileURL(virtualName, url, duckdb.DuckDBDataProtocol.HTTP, false)
  registeredFiles.add(virtualName)
}
```
`main.tsx` does wrap the app in `<StrictMode>`, and `ExplorerPage`'s phase-2 effect calls `queryParquet(id)` directly from the effect body (not gated behind any mutex). Under StrictMode's mount→cleanup→mount double-invoke, both invocations begin executing `queryParquet` synchronously up to their own `await getDb()`; once `getDb()`'s cached promise resolves, both resume and both read `registeredFiles.has(virtualName)` as `false` before either has reached the `.add()` call, so both proceed to call `db.registerFileURL` for the same name. The same race is reachable in production too: `onDataRetry` re-triggers the phase-2 effect without actually cancelling the in-flight promise from the previous attempt (the `cancelled` flag only suppresses the resulting `setState`, it does not abort `queryParquet` itself), so a visitor double-clicking "Torna-ho a provar" quickly can trigger the identical race.
**Fix:** Cache the in-flight registration promise instead of a boolean, so concurrent callers await the same registration rather than racing:
```ts
const registrationPromises = new Map<string, Promise<void>>()

async function ensureRegistered(db: duckdb.AsyncDuckDB, virtualName: string, url: string) {
  let p = registrationPromises.get(virtualName)
  if (!p) {
    p = db.registerFileURL(virtualName, url, duckdb.DuckDBDataProtocol.HTTP, false)
    registrationPromises.set(virtualName, p)
  }
  await p
}
```

### WR-02: vitest `include` glob excludes `.test.tsx`, silently dropping future component tests

**File:** `vite.config.ts:10`
**Issue:** `test.include: ['src/**/*.test.ts']` matches only `.test.ts` files. Today's two test files (`graphicWalkerFields.test.ts`, `shareLink.test.ts`) are unaffected since they're plain `.ts`, but this project ships React components (`ExplorerHeader`, `DataDictionary`, `ErrorState`, `ExplorerPage`) with no test coverage yet. The very first component test added as `Foo.test.tsx` (the conventional extension for a `.tsx`-adjacent test, and the one Vitest's own docs/templates use) will not be picked up by `npm test` at all — it will pass CI by simply never running, with no warning.
**Fix:**
```ts
test: {
  environment: 'node',
  include: ['src/**/*.test.{ts,tsx}'],
},
```
(Component tests will also need `environment: 'jsdom'` or a per-file `// @vitest-environment jsdom` pragma, which is a separate follow-up once such tests are added.)

### WR-03: Engine-init failure is treated as universally non-transient, masking network-caused failures with a misleading message and no retry path

**File:** `src/pages/ExplorerPage.tsx:86-101,150-156`, `src/services/duckdb.ts:26-33`
**Issue:** Phase 1's `.catch(() => setEngineState({ status: 'error', message: '' }))` swallows the actual error and always renders the same static message: *"Prova-ho amb un altre navegador; aquesta aplicació necessita compatibilitat amb WebAssembly."* But `initDb()`'s failure modes are not limited to "this browser lacks WASM support" — `db.instantiate(bundle.mainModule, ...)` fetches and compiles the ~multi-MB DuckDB wasm binary over the network, which can fail transiently (flaky connection, CDN hiccup, GitHub Pages blip) with the exact same rejection shape as a genuine incompatible-browser failure. The code has no way to distinguish the two, yet tells every visitor who hit a transient network failure to go install a different browser, and (by design, per the code comment) offers no retry button — the only recovery is a full page reload, which is not surfaced to the visitor anywhere in the error UI.
**Fix:** At minimum, soften the copy to not assume a browser-capability cause (e.g. "No s'ha pogut inicialitzar el motor de consultes. Comprova la connexió i torna-ho a provar."), and consider offering a retry action for phase 1 the same way phase 2 already does, since a fresh `initDb()` call is cheap and `dbPromise` can simply be reset (`dbPromise = null`) before retrying.

## Info

### IN-01: `FetchState<true>` error branch's `message` is always the empty string and never rendered

**File:** `src/pages/ExplorerPage.tsx:95`
**Issue:** `setEngineState({ status: 'error', message: '' })` populates the `message` field of `FetchState`, but the render branch for `engineState.status === 'error'` (line 150) uses a hardcoded string and never reads `engineState.message`. The field is effectively dead weight that could mislead a future maintainer into thinking the message is dynamic.
**Fix:** Either drop `message` from the phase-1 error state entirely (e.g. `{ status: 'error' }` if `FetchState` is loosened for this use, or reuse a dedicated non-generic type), or actually surface the caught error's message for debugging (behind a dev-only flag, since the intended UX is a static message).

### IN-02: `duckdb.ConsoleLogger()` logs engine/query activity to the browser console unconditionally, including in production

**File:** `src/services/duckdb.ts:29`
**Issue:** `new duckdb.ConsoleLogger()` is wired with no log-level or environment gate, so every visitor's production console receives DuckDB-Wasm's internal logging (bundle selection, query execution, etc.) on every page load. Not a security issue (survey data is public/anonymised per project constraints), but it is unnecessary console noise in a shipped build.
**Fix:** Gate verbosity behind `import.meta.env.DEV`, e.g. `new duckdb.ConsoleLogger(import.meta.env.DEV ? duckdb.LogLevel.WARNING : duckdb.LogLevel.SILENT)` (adjust to the actual `LogLevel` enum exposed by the installed `@duckdb/duckdb-wasm` version).

### IN-03: `verify-explorer-assets.mjs` hardcodes exact fixture byte-count and field-count as pass/fail assertions

**File:** `scripts/verify-explorer-assets.mjs:109-124`
**Issue:** The script asserts the committed sample Parquet is *exactly* 5597 bytes and that `mostra-sintetica_meta.json`'s `fields` array has *exactly* 6 entries. Any future regeneration of the sample data (even a semantically-identical rebuild via a newer DuckDB/pyarrow version that changes Parquet footer padding by a few bytes, or adding a 7th documented field) will fail this check with an error message that gives no hint the failure is expected/benign, rather than a real asset-pipeline regression.
**Fix:** Either derive the expected byte count/field count from the fixture at build time (e.g. read `public/data/enquestes/mostra-sintetica_meta.json` directly and compare `fields.length` against that, instead of a literal `6`), or add a comment at the assertion site noting these numbers must be updated in lockstep with `public/data/enquestes/mostra-sintetica_*` changes.

---

_Reviewed: 2026-08-26T22:21:24Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
