# Phase 3: Interactive Explorer - Pattern Map

**Mapped:** 2026-08-26
**Files analyzed:** 9 (5 new, 1 rewritten, 3 unchanged-reused)
**Analogs found:** 8 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|--------------------|------|-----------|-----------------|----------------|
| `src/services/duckdb.ts` | service | request-response (singleton engine + query) | `src/lib/enquestes.ts` (`dataUrl`, fetch-and-parse discipline) | role-match (no prior service/ tier exists; nearest is `lib/`'s fetch-boundary pattern) |
| `src/lib/graphicWalkerFields.ts` | utility/transform | transform (pure mapping fn) | `src/lib/enquestes.ts` (`formatDate`/`formatCount` pure transforms) | exact (same file, same role) |
| `src/lib/shareLink.ts` | utility/transform | transform + soft-fallback validation | `src/lib/enquestes.ts` (`formatDate` graceful-fallback pattern; `isValidEnquestaId` regex-guard pattern) | exact (D-07 explicitly names `formatDate` as the precedent) |
| `src/pages/ExplorerPage.tsx` (rewrite) | component/page | request-response (fetch meta + parquet, staged loading) | `src/pages/HomePage.tsx` (`FetchState` loading/error/success cycle) + `src/components/SurveySummaryModal.tsx` (fetch → `parseEnquestaMeta` → staged states) | exact |
| `src/components/ExplorerHeader.tsx` | component | request-response (presentational, event handlers) | `src/App.tsx` header block (lines 6-10) | role-match (App's `<header>` is the only header-shaped precedent) |
| `src/components/DataDictionary.tsx` | component | CRUD-adjacent (static render of `meta.json` fields) | `src/components/SurveySummaryModal.tsx` (KPI grid render, lines 119-151) | role-match |
| `src/components/ErrorState.tsx` (reused, 2 instances for EXPL-02 init/data errors) | component | request-response | itself — reused as-is | exact (no new file, direct reuse per two-phase loading) |
| `src/components/LoadingSkeleton.tsx`-style loading UI for explorer | component | request-response | `src/components/LoadingSkeleton.tsx` | role-match (new dedicated skeleton likely needed since GraphicWalker's canvas shape differs from card grid) |
| `src/router.tsx` (no change expected) | route | — | n/a | not modified — `ExplorerPage` already lazy-loaded |

## Pattern Assignments

### `src/services/duckdb.ts` (service, request-response / engine lifecycle)

**Analog:** `src/lib/enquestes.ts` (fetch/trust-boundary discipline) — no true "service" tier exists yet in this codebase; this is a new architectural tier introduced by RESEARCH.md's Recommended Project Structure. Pattern to copy is *discipline*, not literal code shape:

**Trust-boundary / single-purpose-function discipline** (`src/lib/enquestes.ts` lines 23-31):
```typescript
/**
 * The only function in the codebase permitted to compose a data URL.
 * Composing from `import.meta.env.BASE_URL` keeps every data read aligned
 * with vite.config.ts's `base` — a hardcoded root-relative path works in
 * `vite dev` but 404s once the app is served under `/enquestes/`.
 */
export function dataUrl(relativePath: string): string {
  return `${import.meta.env.BASE_URL}data/${relativePath}`
}
```
Apply the same "single function owns this concern, doc comment states why" discipline to `getDb()` (singleton owner of the `AsyncDuckDB` instance) and `queryParquet()` (single function permitted to run `read_parquet`), per RESEARCH.md Architecture Patterns 1 & 2 (verbatim code already drafted there — copy directly, this analog only supplies the *documentation/ownership convention*, not the DuckDB API calls themselves since no DuckDB code exists in-repo yet).

**Error handling pattern to mirror** (`src/pages/HomePage.tsx` lines 19-35 — two-phase catch, generic message, no interpolation of raw error text into UI):
```typescript
fetch(dataUrl('enquestes_index.json'))
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  })
  .then((body) => {
    const data = parseEnquestesIndex(body)
    if (!cancelled) setState({ status: 'success', data })
  })
  .catch(() => {
    if (!cancelled) {
      setState({ status: 'error', message: "No s'ha pogut carregar el llistat d'enquestes." })
    }
  })
```
`queryParquet()`'s caller in `ExplorerPage.tsx` should catch failures the same way: fixed Catalan copy, no raw error interpolation, cancelled-flag guard against setting state after unmount.

---

### `src/lib/graphicWalkerFields.ts` (utility, transform)

**Analog:** `src/lib/enquestes.ts` — pure transform functions, same file/module.

**Pure-transform-with-doc-comment pattern** (lines 83-86, `formatCount`):
```typescript
/** Catalan-locale thousands grouping for participant counts. */
export function formatCount(n: number): string {
  return new Intl.NumberFormat('ca-ES').format(n)
}
```
Copy this shape exactly for `toGraphicWalkerFields(fields: EnquestaMetaField[]): IMutField[]` — one-line doc comment stating the invariant (here: "verbatim pass-through, no re-inference," per RESEARCH.md Pattern 3), then a pure, side-effect-free function. RESEARCH.md's Pattern 3 code block is the literal implementation to use; this analog only confirms placement (`src/lib/`, not `src/services/`) and doc-comment convention.

---

### `src/lib/shareLink.ts` (utility, transform + soft-fallback validation)

**Analog:** `src/lib/enquestes.ts` — two patterns apply directly, both named explicitly in CONTEXT.md D-07.

**Soft-fallback-on-unparseable-input pattern** (lines 63-81, `formatDate`):
```typescript
/**
 * Catalan long-form date, e.g. "26 d'agost de 2026". Returns the input
 * string unchanged when it does not parse into a valid Date — a malformed
 * date field should still show something truthful, never "Invalid Date".
 */
export function formatDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso
  }
  ...
}
```
Copy this exact "detect invalid, return a safe default, no thrown error" shape for `decodeShareLink()`: on any parse failure (malformed base64/JSON, unknown field reference), return `undefined`/blank spec rather than throwing — matching D-07's explicit instruction that this is NOT a `parseEnquestaMeta`-style hard trust-boundary rejection.

**Regex-based input-shape guard pattern** (lines 6-13, `isValidEnquestaId`):
```typescript
/**
 * The id arrives from a URL segment or search param — visitor-controlled —
 * so it is validated before it can influence any fetch path.
 */
export function isValidEnquestaId(id: string): boolean {
  return /^[A-Za-z0-9._-]{1,64}$/.test(id)
}
```
Use the same "validate untrusted input at the boundary, document why (visitor-controlled)" convention for the `?chart=` param: cap length before decode (RESEARCH.md Security Domain — DoS mitigation), then validate every decoded field name against the currently-loaded `meta.json`'s `fields[]` before applying (D-07 / Known Threat Patterns table).

**Contrast — do NOT use this pattern for shareLink.ts** (lines 93-147, `parseEnquestaMeta` hard-reject-on-shape-violation): this is the trust-boundary style D-07 explicitly says NOT to follow for the shareable link. Keep `parseEnquestaMeta`'s throw-based style reserved for actual server-fetched JSON (`meta.json`, `enquestes_index.json`), not for the shareable-link query param.

---

### `src/pages/ExplorerPage.tsx` (page component, staged request-response)

**Analogs:** `src/pages/HomePage.tsx` (FetchState cycle) + `src/components/SurveySummaryModal.tsx` (fetch → validate → branch-render).

**Imports pattern** (`ExplorerPage.tsx` current stub, lines 1-2 — keep and extend, do not replace):
```typescript
import { Link, useParams } from 'react-router-dom'
import { isValidEnquestaId } from '../lib/enquestes'
```

**Existing guard to preserve verbatim** (`ExplorerPage.tsx` lines 4-6, 18-19):
```typescript
const { id } = useParams<{ id: string }>()
const valid = id !== undefined && isValidEnquestaId(id)
...
) : (
  <p className="text-zinc-700 dark:text-zinc-300">No s'ha trobat aquesta enquesta.</p>
)
```

**FetchState discriminated-union cycle to reuse per RESEARCH.md's "two distinct phases" recommendation** (`src/pages/HomePage.tsx` lines 12-45):
```typescript
const [state, setState] = useState<FetchState<EnquestaIndexEntry[]>>({ status: 'loading' })
const [attempt, setAttempt] = useState(0)

useEffect(() => {
  let cancelled = false
  fetch(dataUrl('enquestes_index.json'))
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json() })
    .then((body) => { const data = parseEnquestesIndex(body); if (!cancelled) setState({ status: 'success', data }) })
    .catch(() => { if (!cancelled) setState({ status: 'error', message: '...' }) })
  return () => { cancelled = true }
}, [attempt])

const onRetry = () => { setState({ status: 'loading' }); setAttempt((a) => a + 1) }
```
Instantiate this pattern **twice** in `ExplorerPage.tsx` (per RESEARCH.md EXPL-01 recommendation): once for DuckDB engine init (`{status:'loading'} → 'Inicialitzant el motor de consultes…'`), once for Parquet fetch/query (`'Carregant les dades de l'enquesta…'`), each with its own retry per the `ErrorState`/`onRetry` convention.

**Branch-render-by-status pattern** (`src/pages/HomePage.tsx` lines 74-83):
```typescript
let content
if (state.status === 'loading') {
  content = <LoadingSkeleton />
} else if (state.status === 'error') {
  content = <ErrorState message={state.message} onRetry={onRetry} />
} else if (state.data.length === 0) {
  content = <EmptyState />
} else {
  content = <SurveyGrid enquestes={state.data} onSelect={onSelect} />
}
```
Same `if/else if` chain shape for the two staged loading states → success → `<GraphicWalker />`.

**Meta fetch/validate pattern to reuse for `meta.json` re-fetch** (`SurveySummaryModal.tsx` lines 47-70): identical fetch → `parseEnquestaMeta` → cancelled-guarded `setState` shape; copy as-is for `ExplorerPage`'s own `meta.json` fetch (needed independently of `SurveySummaryModal`'s, since `ExplorerPage` is reached by direct URL too, not only via the modal).

---

### `src/components/ExplorerHeader.tsx` (component, presentational + event handlers)

**Analog:** `src/App.tsx` lines 6-10 (only header-shaped precedent in the codebase).

**Header layout pattern to copy exactly** (`src/App.tsx`):
```tsx
<header className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
  <h1 className="text-lg font-semibold">Enquestes</h1>
  <ThemeToggle />
</header>
```
Extend to `title + back-link + Copy-link button + <ThemeToggle />` per D-01/D-02/D-06, keeping `flex items-center justify-between` and the same border/padding/dark: token set for visual consistency with the app-shell header GraphicWalker mounts beneath.

**Back-link pattern** (`ExplorerPage.tsx` current stub, lines 21-23):
```tsx
<Link to="/" className="inline-block text-accent hover:text-accent-strong">
  ← Torna al llistat d'enquestes
</Link>
```
Reuse verbatim inside `ExplorerHeader` (EXPL-07).

**Button styling to copy for "Copy link"** (`src/components/ErrorState.tsx` lines 24-30, primary-action button convention):
```tsx
<button
  type="button"
  onClick={onRetry}
  className="mt-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
>
  Torna-ho a provar
</button>
```
Or the smaller secondary style from `SurveySummaryModal.tsx` lines 156-161 (`border border-zinc-200 ... hover:border-accent hover:text-accent`) if "Copy link" should read as secondary chrome next to the primary explore actions — planner's call, both conventions exist in-repo.

**ThemeToggle drop-in** (`src/components/ThemeToggle.tsx`, entire file) — import and use as-is, no changes needed:
```tsx
import { ThemeToggle } from '../components/ThemeToggle'
...
<ThemeToggle />
```

---

### `src/components/DataDictionary.tsx` (component, static content render)

**Analog:** `src/components/SurveySummaryModal.tsx` lines 119-151 (KPI grid render — same shape: map over an array from `meta.json`, render label + value in a bordered card grid).

**Grid-of-cards-from-meta.json pattern to adapt**:
```tsx
<div className="grid grid-cols-2 gap-3">
  {state.data.kpis.map((kpi, i) => (
    <div key={i} className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{kpi.label}</p>
      <p className="text-base font-semibold tabular-nums">{kpi.value}{kpi.unit ? ` ${kpi.unit}` : ''}</p>
    </div>
  ))}
</div>
```
Adapt to map over `EnquestaMetaField[]` (`fields[]` from `meta.json`, already typed in `src/types/enquesta.ts` lines 16-21) rendering `label ?? name` + `description`, inside a collapsible `<details>`/toggle wrapper per RESEARCH.md's "collapsed-by-default panel outside GraphicWalker" recommendation (no existing collapsible-panel analog in-repo — this piece is genuinely new UI; use a native `<details>` element to avoid inventing new interaction-state code).

---

### Loading UI for explorer (two-phase init/data loading)

**Analog:** `src/components/LoadingSkeleton.tsx` (entire file) — `aria-busy`, `sr-only` status text, `animate-pulse` placeholder blocks:
```tsx
export function LoadingSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <span className="sr-only">Carregant enquestes…</span>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-36 animate-pulse rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900" />
      ))}
    </div>
  )
}
```
A new explorer-specific loading state (single large placeholder block matching GraphicWalker's canvas footprint, not a card grid) should keep the `aria-busy` + `sr-only` status text + `animate-pulse` conventions but adapt the shape — copy the *accessibility scaffolding*, not the grid geometry.

---

## Shared Patterns

### FetchState discriminated union
**Source:** `src/types/enquesta.ts` lines 33-36
**Apply to:** `ExplorerPage.tsx`'s two loading phases (engine init, data load)
```typescript
export type FetchState<T> =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: T }
```

### Error state rendering
**Source:** `src/components/ErrorState.tsx` (entire file, reused as-is — no new component needed)
**Apply to:** Both EXPL-02 error points (engine init failure, Parquet load/query failure) — pass a phase-specific `message` string to the same component twice.

### Cancelled-flag async-effect guard
**Source:** `src/pages/HomePage.tsx` lines 16-40, `src/components/SurveySummaryModal.tsx` lines 46-70
**Apply to:** All new async effects in `ExplorerPage.tsx` (DuckDB init effect, Parquet query effect, meta.json fetch effect) — every fetch/async effect in this codebase uses `let cancelled = false` + cleanup-sets-`cancelled=true`, never a raw unguarded `setState` in a `.then()`.

### Fixed, non-interpolated Catalan error copy
**Source:** `src/pages/HomePage.tsx` line 33, `src/components/SurveySummaryModal.tsx` line 62
**Apply to:** All new error states — never interpolate the raw caught error into user-facing text; use a fixed Catalan string per failure category (mirrors EXPL-02's "clear error message" requirement without leaking implementation detail).

### `dataUrl()` path composition
**Source:** `src/lib/enquestes.ts` lines 23-31
**Apply to:** `src/services/duckdb.ts`'s Parquet URL composition — must go through `dataUrl()`, not a hardcoded path, exactly as `metaUrl()` already does (CONTEXT.md canonical_refs explicitly calls this out: `dataUrl(\`enquestes/${id}_respostes.parquet\`)`).

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/services/duckdb.ts` (DuckDB engine lifecycle itself) | service | event-driven (Worker instantiation) | No Worker/engine-lifecycle code exists anywhere in this codebase yet; use RESEARCH.md Architecture Patterns 1 & 2 verbatim code blocks as the primary source instead of an in-repo analog. |
| `<GraphicWalker />` mount + `chart` prop wiring | component | request-response (third-party component) | First use of any third-party visualization component in this codebase; use RESEARCH.md "Code Examples → GraphicWalker minimal mount" verbatim. |
| GraphicWalker chart-spec read-back (for "Copy link") | utility | transform | RESEARCH.md flags this as an open question (Pitfall 4 / Assumptions Log A2) — no confirmed API, no in-repo analog possible; planner must budget the short spike RESEARCH.md recommends before implementing. |

## Metadata

**Analog search scope:** `src/` (pages, components, lib, hooks, types), `App.tsx`, `router.tsx`, `vite.config.ts`
**Files scanned:** `ExplorerPage.tsx`, `enquestes.ts`, `HomePage.tsx`, `enquesta.ts` (types), `useTheme.ts`, `ThemeToggle.tsx`, `App.tsx`, `ErrorState.tsx`, `SurveySummaryModal.tsx`, `LoadingSkeleton.tsx`, `router.tsx`, `vite.config.ts`
**Pattern extraction date:** 2026-08-26
