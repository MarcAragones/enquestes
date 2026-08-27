---
phase: 03-interactive-explorer
reviewed: 2026-08-27T23:10:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - src/components/SurveySummaryModal.tsx
  - src/lib/shareLink.test.ts
  - src/lib/shareLink.ts
  - src/pages/ExplorerPage.tsx
findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-08-27T23:10:00Z
**Depth:** standard
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Reviewed the four files touched by the G-03-2 / G-03-4 / G-03-2b / G-03-4b gap-closure fixes. The `SurveySummaryModal` StrictMode lifecycle fix (listener-detach-before-close ordering) is correct and well-reasoned; I traced the mount → simulated-unmount → remount sequence and it behaves exactly as documented. The `ExplorerPage` not-found/load-failed classification (G-03-2b) and the `defaultConfig.layout.size.mode: 'full'` canvas fix (G-03-4b) are both implemented correctly and match the root causes identified in the corresponding debug reports.

However, the G-03-4 schema-drift narrowing in `shareLink.ts` (restricting the known-field check to shelf channels only) introduced a validation gap in the same function: `decodeShareLink`'s existing shape guard (`isChartLike`, added for the prior phase's CR-01) does not actually enforce that the returned value matches the array shape `ExplorerPage.tsx` casts it to (`as IChart[] | undefined`) — a single, non-array chart-shaped payload is validated as if wrapped in an array but then returned unwrapped, silently violating the contract every caller relies on. I verified this and two related edge cases (an empty top-level array, and an array-typed `encodings`) by actually exercising `decodeShareLink` against the installed module rather than only reading the source. I also found a stale-state bug in `SurveySummaryModal` (not fixed by G-03-2, and not part of the original phase review's scope, since this file wasn't reviewed then) and a text-duplication defect in `ExplorerPage`'s engine-error message.

## Critical Issues

### CR-01: `decodeShareLink` can return a non-array value that violates the `IChart[]` contract every caller relies on

**File:** `src/lib/shareLink.ts:238,266` (also affects `src/pages/ExplorerPage.tsx:94`)
**Issue:**
Step 6 wraps a non-array `parsed` value in `[parsed]` *only* to run it through `isChartLike`/the shelf-field check:
```ts
const charts: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : [parsed]
if (!charts.every(isChartLike)) {
  return undefined
}
```
but step 8 returns the original `parsed` value verbatim, not `charts`:
```ts
return parsed
```
So a `?chart=` payload whose JSON is a single chart-shaped object (not wrapped in an array) — e.g. `{"visId":"v1","encodings":{"rows":[{"fid":"edat"}]}}` — passes validation (because `[parsed]` satisfies `isChartLike`) but is returned as that bare object, not an array. I confirmed this directly against the built module:
```
decoded is array? false {"visId":"v1","encodings":{"rows":[{"fid":"edat"}]}}
```
`ExplorerPage.tsx:94` then does an unchecked cast:
```ts
return decodeShareLink(rawChartParam, knownFieldNames) as IChart[] | undefined
```
and passes the result straight to `<GraphicWalker chart={decodedChart} />`, which requires `IChart[] | IVisSpec[]` (always an array — every real caller in this codebase only ever produces it via `VizSpecStore.exportCode(): IChart[]`). Handing GraphicWalker a bare object where it expects an array is exactly the class of defect the doc comment on `isChartLike` says it exists to prevent (CR-01 from the prior review), and it is reachable with a hand-typed URL, no special tooling — the client-side source (`visId`/`encodings` field names) is fully visible in the shipped bundle. In production this is currently caught by `ChartErrorBoundary` (degrades to a friendly error message instead of a blank crash), but the underlying decode function still violates its own return-type contract, and any future caller that doesn't wrap the render in an error boundary reintroduces the original CR-01 crash.
**Fix:** Always return the normalized array, not the raw `parsed` value:
```ts
// step 8
return charts
```
(and drop the "a bare single chart-shaped object is also accepted" allowance from the doc comment, or explicitly wrap it — but either way, the returned value must always be an array so it actually matches `IChart[] | undefined`.)

## Warnings

### WR-01: `isChartLike` accepts an array-typed `encodings`, silently disabling the T-03-11 schema-drift check for that payload

**File:** `src/lib/shareLink.ts:84-88`
**Issue:** `isChartLike` only checks `typeof candidate.encodings === 'object' && candidate.encodings !== null`. Since `typeof [] === 'object'`, a payload like `{"visId":"v1","encodings":[]}` passes this guard even though `DraggableFieldState` (the type the comment says is being validated) is never an array. Because `collectShelfFieldReferences` iterates `SHELF_CHANNEL_KEYS` with `key in encodings`, and none of those string keys are own properties of an array, the shelf-field-reference check silently finds zero references and lets the payload through with no field validation at all. I confirmed this directly:
```
array-encodings decoded -> [{"visId":"v1","encodings":[]}]
```
This is exactly the kind of decoded value the function's own doc comment says must never reach GraphicWalker unchecked. It's mitigated by `ChartErrorBoundary`, but the dedicated shape guard added to close this gap doesn't actually close it for this input class.
**Fix:**
```ts
function isChartLike(value: unknown): boolean {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.visId === 'string' &&
    typeof candidate.encodings === 'object' &&
    candidate.encodings !== null &&
    !Array.isArray(candidate.encodings)
  )
}
```

### WR-02: A top-level empty array (`?chart=v1.W10`, i.e. base64 of `"[]"`) is accepted as a valid decoded chart instead of falling back to `undefined`

**File:** `src/lib/shareLink.ts:238-241`
**Issue:** `charts.every(isChartLike)` on an empty array is vacuously `true` (`Array.prototype.every` returns `true` for an empty array), so `parsed = []` sails through step 6 with zero elements checked, and step 8 returns `[]`. I confirmed:
```
empty array decoded -> []
```
This is a real, trivially-reachable URL (`?chart=v1.W10`) and it is a different outcome from `undefined`: `ExplorerPage` distinguishes "no/invalid share param → let GraphicWalker create its own default chart" (`decodedChart === undefined`) from "a specific chart to restore" — the doc comment's design intent is explicit that a malformed/stale link should behave like there was no link at all. An empty array instead sets `chart={[]}`, which is neither of those two intended states and produces a survey view with zero chart tabs instead of a fresh default chart.
**Fix:** Reject an empty top-level array explicitly:
```ts
if (charts.length === 0 || !charts.every(isChartLike)) {
  return undefined
}
```

### WR-03: `SurveySummaryModal`'s fetch effect never resets `state` to `loading` when `enquestaId` changes, so a previous survey's summary can render as stale content

**File:** `src/components/SurveySummaryModal.tsx:69-98`
**Issue:** The data-fetch effect (`[enquestaId, idValid]`) only transitions `state` on success or failure — it never sets `{ status: 'loading' }` synchronously when `enquestaId` changes. `HomePage.tsx:88` renders `<SurveySummaryModal enquestaId={openEnquestaId} onClose={onCloseSummary} />` without a `key={openEnquestaId}`, so if `enquestaId` changes while the component instance stays mounted (e.g. the visitor uses the browser Back/Forward buttons to move between two different `?enquesta=A` / `?enquesta=B` history entries created by two separate `onSelect` calls — each `onSelect` pushes a new search-param via `setSearchParams`), the modal keeps displaying survey A's already-fetched title/description/KPIs while the fetch for survey B is in flight, instead of showing the loading skeleton. If the fetch for B later fails, the stale content for A is eventually replaced by the error state, but there is a window where the visitor is looking at the wrong survey's data under the new URL/dialog.
**Fix:** Reset to loading synchronously whenever the effect re-runs for a new id:
```ts
useEffect(() => {
  if (!idValid) return
  setState({ status: 'loading' })
  let cancelled = false
  fetch(metaUrl(enquestaId))
    // ...
```

### WR-04: `SurveySummaryModal` shows the same generic error message for "survey not found" and "load failed", reproducing the exact conflation G-03-2b fixed elsewhere

**File:** `src/components/SurveySummaryModal.tsx:86-92`
**Issue:** The fetch `.catch()` always sets `message: "No s'ha pogut carregar el resum d'aquesta enquesta."`, regardless of whether the fetch failed because the survey genuinely doesn't exist (`metaUrl` 404, e.g. a stale `?enquesta=` link to a removed survey) or because of a transient network failure. This is the identical pattern the `g-03-2b-wrong-error-copy.md` root-cause investigation diagnosed and fixed in `ExplorerPage` (distinct `not-found` vs `load-failed` kinds, per `DataErrorKind`), but the fix was scoped only to `ExplorerPage` — `SurveySummaryModal`, which hits the exact same `metaUrl(id)` endpoint, was never updated and still conflates the two cases.
**Fix:** Mirror `ExplorerPage`'s `DataErrorKind` classification here (distinguish `res.status === 404` and skip surfacing a misleading generic message for a survey that doesn't exist).

## Info

### IN-01: Engine-init error state renders the same sentence twice (title + message both start identically)

**File:** `src/pages/ExplorerPage.tsx:129,213`
**Issue:** The caught error sets:
```ts
message: "No s'ha pogut inicialitzar el motor de consultes. Comprova la connexió i torna-ho a provar."
```
and the render branch passes:
```tsx
<ErrorState title="No s'ha pogut inicialitzar el motor de consultes." message={engineState.message} onRetry={onEngineRetry} />
```
`ErrorState` renders `title` in bold above `message` — so the visitor sees "No s'ha pogut inicialitzar el motor de consultes." twice in a row (once as the heading, then again verbatim as the first sentence of the body text) before the actually-new "Comprova la connexió..." sentence.
**Fix:** Drop the duplicated lead sentence from the `message`, e.g. `message: "Comprova la connexió i torna-ho a provar."`.

### IN-02: `shareLink.test.ts` has no coverage for the shape edge cases that WR-01/WR-02/CR-01 exploit

**File:** `src/lib/shareLink.test.ts`
**Issue:** The hostile/stale-input test suite (`decodeShareLink hostile/stale input handling`) is thorough for the base64/JSON/version-tag/length layers and for shelf-field rejection, but it never exercises: a top-level empty array (`[]`), an `encodings` value that is itself an array, or a top-level single chart-shaped object rather than an array. All three are exactly the cases where the current implementation misbehaves (see CR-01, WR-01, WR-02) — none of the three fail a test today, so a regression here would ship silently.
**Fix:** Add cases such as:
```ts
it('returns undefined for a top-level empty array', () => {
  const encoded = encodeShareLink([])!
  expect(decodeShareLink(encoded, KNOWN_FIELDS)).toBeUndefined()
})
it('returns undefined for a chart with a non-object (array) encodings', () => {
  const encoded = encodeShareLink([{ visId: 'v1', encodings: [] }])!
  expect(decodeShareLink(encoded, KNOWN_FIELDS)).toBeUndefined()
})
it('normalizes a bare single chart object into an array, not returned as-is', () => {
  const spec = makeSpec()[0]
  const encoded = encodeShareLink(spec)!
  const decoded = decodeShareLink(encoded, KNOWN_FIELDS)
  expect(Array.isArray(decoded)).toBe(true)
})
```

---

_Reviewed: 2026-08-27T23:10:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
