# Phase 3: Interactive Explorer - Research

**Researched:** 2026-08-26
**Domain:** DuckDB-Wasm (SQL-over-Parquet in browser) wired into `@kanaries/graphic-walker`, deployed static to GitHub Pages
**Confidence:** MEDIUM (implementation-level API surface for GraphicWalker 0.5.x is only partially documented publicly; DuckDB-Wasm/Vite/GitHub Pages integration is HIGH — official docs directly fetched and cross-checked against the project's own committed Parquet file)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Explorer page layout**
- **D-01:** `/enquesta/:id` is app-shell wrapped, not full-bleed — a header bar sits above
  `<GraphicWalker />`, consistent with HomePage's chrome.
- **D-02:** The header is minimal: title + back-link + dark-mode toggle only. Date, description
  and participant count are NOT repeated in the header — the visitor already saw them in
  `SurveySummaryModal` before clicking through, so repeating them would be redundant chrome
  eating into GraphicWalker's canvas space.
- **D-03:** No special responsive handling for the header beyond what HomePage's header already
  does (plain flexbox + Tailwind responsive utilities) — it's simple enough to wrap/truncate
  naturally. Reinforces the existing project constraint (REQUIREMENTS.md Out of Scope: "no
  visually broken" is the v1 threshold, not full touch optimization).

**Shareable link scope (EXPL-11)**
- **D-04:** The link captures the full visualization state: field assignments (X/Y/Color/Size),
  chart type, AND active filters — not just chart config. Matches the requirement literally
  ("reproduces the exact current visualization"); a filtered view shared without its filter
  would misrepresent what the sharer was showing.
- **D-05:** Manual "Copy link" trigger, not an auto-synced URL. The user clicks an explicit
  button when ready to share; the address bar does not update live on every field/filter change.
  Simpler to implement (serialize-on-click) and avoids URL/history churn while someone is still
  experimenting with a chart.
- **D-06:** The "Copy link" button lives in the app-shell header from D-01/D-02 (next to the
  back-link / dark-mode toggle), not floating near GraphicWalker's own toolbar — keeps
  GraphicWalker's own UI untouched, no custom control injected into a third-party component.
- **D-07:** A shared link whose encoded chart spec is malformed or references a field that no
  longer exists (schema drift, tampered URL) falls back silently to the default/blank explorer
  state — it is NOT treated as a hard trust-boundary rejection like `parseEnquestesIndex`/
  `parseEnquestaMeta`. Consistent with this project's existing soft-fallback precedent
  (`formatDate` returns the raw string rather than "Invalid Date" on unparseable input): a stale
  shareable link is not attacker input crossing a data trust boundary, it's expected staleness
  as surveys evolve, and shouldn't scare the visitor with an error for it.

### Claude's Discretion
- **GraphicWalker computation strategy** — materialize the full DuckDB-Wasm query result once as
  `dataSource`/`rawFields` and let GraphicWalker's own in-browser engine handle interactions (vs.
  wiring DuckDB-Wasm live via the `computation` prop + `@kanaries/gw-dsl-parser`). Already
  decided at project level (STACK.md) — simpler MVP integration, no extra DSL-to-SQL dependency,
  plenty fast at survey-sized datasets (this phase's real dataset: 250 rows, 5597 bytes).
- **Data dictionary placement (EXPL-09)** — candidates include a dedicated panel/tab beside
  GraphicWalker, an expandable section, or hover tooltips on the field list. Should reuse
  `EnquestaMetaField.label`/`.description` from `meta.json`.
- **Loading/init experience (EXPL-01)** — whether DuckDB-Wasm init and Parquet download/load show
  as one combined "Carregant…" state or as distinct visible phases (two different real failure
  points: engine init vs. data fetch/query — EXPL-02 requires a clear error message for each).
- Chart export mechanism (EXPL-10, PNG/SVG) — confirm GraphicWalker's built-in export is
  sufficient before building a custom export button.
- DuckDB-Wasm bundle selection, Parquet registration method (`registerFileURL` vs buffer), exact
  query-param encoding format for the shareable link (D-04) — standard implementation choices,
  not user-facing product decisions.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EXPL-01 | Progress indicator while DuckDB-Wasm initializes and Parquet downloads/loads | See "Loading/Init UX Recommendation" and Code Examples — staged two-phase loading state recommended |
| EXPL-02 | Clear error message if DuckDB init or Parquet load/query fails | See "DuckDB-Wasm Singleton Service" pattern — two distinct catch points (init vs. query), existing `FetchState`/`ErrorState` pattern reusable |
| EXPL-03 | Drag X/Y/Color/Size/Filter to build charts via `<GraphicWalker />` | Native GraphicWalker capability — `dataSource`/`rawFields` props, no custom UI needed |
| EXPL-04 | Multiple chart types (bars, lines, area, scatter) | Confirmed native GraphicWalker mark types: bar, line, area, point, circle, rect, tick, boxplot, arc — all exposed in its own toolbar |
| EXPL-05 | Fields typed correctly as dimension/measure | `EnquestaMetaField.type: 'dimension' \| 'measure'` maps **identically** to GraphicWalker's `IAnalyticType` — verbatim match, zero translation needed (see Code Examples) |
| EXPL-06 | Usable on small/medium screens | D-03 — plain Tailwind responsive utilities, no GraphicWalker-specific responsive API found/needed |
| EXPL-07 | Return to survey list from explorer | Existing `<Link to="/">` pattern in current `ExplorerPage.tsx` stub carries forward |
| EXPL-08 | Direct link to `/enquesta/:id` works on load/refresh, no 404 | Already solved at Phase 1 (BrowserRouter + 404.html + `basename`) — no new work this phase, just don't break it |
| EXPL-09 | Field descriptions (data dictionary) from `meta.json` inside explorer | See "Data Dictionary UI Recommendation" |
| EXPL-10 | Export current chart as PNG/SVG | GraphicWalker's `IGWHandler` ref exposes `exportChart(mode?: 'svg' \| 'data-url')` — built-in, no custom export needed |
| EXPL-11 | Copy link reproducing exact visualization (fields + filters) via query params | See "Shareable Link Encoding" — GraphicWalker's exact 0.5.2 spec-read API needs a short confirmation spike against installed `node_modules` types (flagged LOW confidence, see Assumptions Log A2) |
</phase_requirements>

## Summary

This phase wires DuckDB-Wasm (SQL over Parquet, fully client-side) into `<GraphicWalker />` at
`/enquesta/:id`, replacing the current stub. The core integration is well-trodden and the
project's own prior research (STACK.md/PITFALLS.md/ARCHITECTURE.md) already got the
architecture-level decisions right: single-threaded `eh`/`mvp` bundle (GitHub Pages cannot set
COOP/COEP headers — reconfirmed this session, still an open GitHub limitation), `?url` Vite
imports for wasm/worker assets, and materialize-once `dataSource`/`rawFields` GraphicWalker
integration (no `computation` prop, no `@kanaries/gw-dsl-parser`).

This session's research goes one layer deeper, into exact package versions and API shapes. Three
findings change what's in `package.json` from what STACK.md assumed: (1) `@duckdb/duckdb-wasm`'s
npm `latest` dist-tag currently points to a `-dev` prerelease (`1.33.1-dev57.0`) — a bare
`npm install @duckdb/duckdb-wasm` will silently install that dev build; **pin explicitly to
`1.32.0`**, the last tagged stable release. (2) `@kanaries/graphic-walker@0.5.2` declares a hard
peer dependency on `styled-components@^6.1.19` that is not yet in `package.json` — it must be
installed alongside, or the app will warn/break. (3) `apache-arrow` must be pinned to `^17.0.0`
(what `@duckdb/duckdb-wasm@1.32.0` itself depends on), not the registry's current `21.2.0` —
installing latest-`apache-arrow` alongside duckdb-wasm's bundled v17 risks duplicate-class
`instanceof` failures on Arrow `Table`/`RecordBatch` objects.

The field-typing contract (EXPL-05) is simpler than it looked: `EnquestaMetaField.type` is
`'dimension' | 'measure'` and GraphicWalker's own `IAnalyticType` is the **exact same union**
(`'dimension' | 'measure'`) — this phase only needs to derive the second axis, `semanticType`
(`'quantitative' | 'nominal' | 'ordinal' | 'temporal'`), from the Parquet column's DuckDB dtype.
Chart-type selection (EXPL-04) and PNG/SVG export (EXPL-10) are both native GraphicWalker
capabilities requiring no custom UI. The one genuinely under-documented piece is the shareable
link (EXPL-11): GraphicWalker 0.5.2's exact API for reading the *current* chart spec back out on
a manual "Copy link" click is not confirmed in current public docs (only an older, pre-0.5
`storeRef`/`VizSpecStore.exportCode()` pattern is documented) — flagged as a short spike for the
planner rather than a blocking unknown, since the `chart` prop (`IChart[]`) for *restoring* state
on load is confirmed current.

**Primary recommendation:** Follow STACK.md's architecture as-is (singleton DuckDB service,
`eh`/`mvp` bundle auto-select, materialize-once GraphicWalker integration), but update the
package versions per this research (`@duckdb/duckdb-wasm@1.32.0` pinned exactly,
`apache-arrow@^17.0.0`, add `styled-components@^6.1.19`), and budget one short exploratory task
for confirming GraphicWalker 0.5.2's chart-spec read-back API against its installed TypeScript
types before committing to the shareable-link implementation.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DuckDB-Wasm engine lifecycle (init, bundle select, worker) | Browser / Client | — | Runs entirely in a Web Worker inside the tab; no server exists |
| Parquet fetch + SQL query execution | Browser / Client | CDN / Static (GitHub Pages serves the bytes) | `registerFileURL` + `read_parquet()` — DuckDB-Wasm manages the HTTP fetch itself via the browser's `fetch`/Range machinery |
| Chart rendering + drag-and-drop interaction state | Browser / Client | — | `<GraphicWalker />`'s own in-memory engine (Mobx store), no external computation |
| Field type derivation (dimension/measure → semanticType) | Browser / Client (at query time) | Database / Storage (Parquet dtype is the source signal) | Read from `meta.json` (already computed offline by Phase 2) + Parquet column dtype; no server-side inference needed |
| Data dictionary content | Database / Storage (`meta.json`, static) | Browser / Client (rendering) | Content is static, authored offline; this phase only renders it |
| Shareable link encode/decode | Browser / Client | — | Pure client-side query-param serialization; no server round-trip, no persistence layer |
| Chart image export (PNG/SVG) | Browser / Client | — | Canvas/SVG serialization happens entirely in-tab via GraphicWalker's `exportChart()` |
| Route/deep-link handling (`/enquesta/:id`) | Browser / Client (React Router) | CDN / Static (`404.html` fallback) | Already solved in Phase 1; this phase does not touch it |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@duckdb/duckdb-wasm` | **`1.32.0`** exact pin — verified via `npm view` `dist-tags` this session: registry `latest` tag currently resolves to `1.33.1-dev57.0`, a prerelease. `1.32.0` is the newest tagged stable semver release (no `-dev` suffix) `[VERIFIED: npm registry — npm view @duckdb/duckdb-wasm versions/dist-tags]` | In-browser SQL engine over Parquet | Already mandated project-wide (CLAUDE.md); this phase confirms the exact safe version to pin |
| `@kanaries/graphic-walker` | `0.5.2` (current `latest` dist-tag) `[VERIFIED: npm registry]` | Visual/drag-and-drop data explorer | Already mandated; confirmed peer-compatible with React 19 (`peerDependencies.react: ">=19.0.0"`, matches project's `react@^19.2.8`) `[VERIFIED: npm view @kanaries/graphic-walker@0.5.2 peerDependencies]` |
| `apache-arrow` | **`^17.0.0`** — NOT the registry's current latest (`21.2.0`). `@duckdb/duckdb-wasm@1.32.0` declares `"apache-arrow": "^17.0.0"` as its own dependency `[VERIFIED: npm view @duckdb/duckdb-wasm@1.32.0 dependencies]` | Reading Arrow-format DuckDB-Wasm query results | Must match the version DuckDB-Wasm bundles internally, or `instanceof` checks on returned `Table`/`RecordBatch` can silently fail (duplicate class instances) — this is not hypothetical, it's what STACK.md already warned about, now with the exact number confirmed |
| `styled-components` | `^6.1.19` (registry latest `6.5.3` satisfies) `[VERIFIED: npm registry — 10-year-old package, 11.3M weekly downloads, github.com/styled-components/styled-components]` | **NEW — not currently in `package.json`.** Hard peer dependency of `@kanaries/graphic-walker@0.5.2` | `npm view @kanaries/graphic-walker@0.5.2 peerDependencies` returns `{ react: '>=19.0.0', 'react-dom': '>=19.0.0', 'styled-components': '^6.1.19' }` with no `peerDependenciesMeta` marking it optional `[VERIFIED: npm registry]` — installing GraphicWalker without it will produce an unmet-peer warning at minimum, and some of GraphicWalker's internal components import it directly at runtime |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| (none new beyond Core) | — | — | This phase adds no additional supporting libraries — no router changes (Phase 1 already solved deep-linking), no state-management library needed (GraphicWalker owns its own interaction state; shareable-link state is transient, read/written only on the manual "Copy link" click per D-05) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Self-hosted `?url` Vite imports for wasm/worker assets | `duckdb.getJsDelivrBundles()` (loads WASM from jsDelivr CDN at runtime) | Simpler code (zero Vite asset-import configuration, sidesteps PITFALLS.md Pitfall 2 entirely), but adds a third-party runtime dependency (jsDelivr uptime/CORS) to an otherwise fully self-contained static site. **Recommendation: self-host** — this project already treats "no external runtime dependency beyond GitHub Pages" as a value (implicit in the $0/no-backend constraint), and the exact asset filenames are now confirmed (see Code Examples), removing the main risk Pitfall 2 warned about. |
| GraphicWalker's built-in `exportChart('svg'/'data-url')` for PNG/SVG (EXPL-10) | A custom `html2canvas`/`dom-to-image` export button | GraphicWalker ships this natively via its `IGWHandler` ref — building a custom exporter would duplicate existing, better-tested functionality for zero benefit. No alternative needed. |

**Installation:**
```bash
npm install @duckdb/duckdb-wasm@1.32.0 @kanaries/graphic-walker@0.5.2 apache-arrow@^17.0.0 styled-components@^6.1.19
```

**Version verification performed this session:**
- `npm view @duckdb/duckdb-wasm dist-tags` → `{ latest: '1.33.1-dev57.0', next: '1.33.1-dev64.0' }` — confirms the dev-prerelease-as-latest trap; `1.32.0` confirmed as last stable tagged release via `npm view @duckdb/duckdb-wasm versions --json`.
- `npm view @kanaries/graphic-walker version` → `0.5.2`; `npm view @kanaries/graphic-walker dist-tags` → `{ pre: '0.4.84', latest: '0.5.2' }`.
- `npm view @kanaries/graphic-walker@0.5.2 peerDependencies` → confirmed React 19 + styled-components 6 requirement.
- `npm view @duckdb/duckdb-wasm@1.32.0 dependencies` → confirmed `apache-arrow: ^17.0.0`.

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|--------------|---------|-------------|
| `@duckdb/duckdb-wasm` | npm | ~5 yrs (created 2021-10-06) | 468,941/wk | github.com/duckdb/duckdb-wasm | OK | Approved |
| `apache-arrow` | npm | long-established (Apache project) | 4,512,645/wk | github.com/apache/arrow-js | OK | Approved |
| `@kanaries/graphic-walker` | npm | ~5 yrs (created 2021-09-24) | 4,719/wk | none declared in `0.5.2`'s published `package.json` metadata (repo is in fact `github.com/Kanaries/graphic-walker`, ~15k GitHub stars, but the `repository` field is absent from this version's npm metadata) | SUS (`no-repository` signal) | Flagged — false positive from a metadata gap, not an actual legitimacy concern (5-year-old package, matches the exact library CLAUDE.md already mandates project-wide). Planner should still add a lightweight `checkpoint:human-verify` before `npm install` per protocol, but no alternative package exists — this is the correct package. |
| `styled-components` | npm | ~10 yrs (created 2016-08-16) | 11,295,959/wk | github.com/styled-components/styled-components | SUS (`too-new` signal, triggered by the *latest patch version* `6.5.3`'s recent publish date, not package age) | Flagged — false positive; one of the most widely-used React styling libraries, required as a hard peer dependency of `@kanaries/graphic-walker`, not optional. Planner should add a `checkpoint:human-verify` before install per protocol, but there is no alternative — GraphicWalker will not function correctly without it. |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** `@kanaries/graphic-walker` (metadata gap, not a real risk — already the project's mandated visualization library), `styled-components` (heuristic false-positive on recency, package itself is a decade old and required as GraphicWalker's peer dependency)

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Browser tab: /enquesta/:id (ExplorerPage)                              │
│                                                                           │
│  1. Route mounts ─────────────────────────────────────────────────────┐ │
│     │                                                                  │ │
│     ▼                                                                  │ │
│  2. isValidEnquestaId(id) guard (existing) ──▶ invalid ──▶ error copy  │ │
│     │ valid                                                            │ │
│     ▼                                                                  │ │
│  3. Parse ?chart= query param (if present) ──▶ decode ──▶ try/catch    │ │
│     │                                              │ malformed          │ │
│     │                                              ▼ (D-07)             │ │
│     │                                         drop silently, continue   │ │
│     ▼                                                                  │ │
│  4. useDuckDb() hook: getDb() singleton ──────────────────────────────┐│ │
│     │  (Phase: "initializing engine" loading state)                  ││ │
│     │  ├─ selectBundle([mvp, eh]) — never coi                        ││ │
│     │  ├─ new Worker(bundle.mainWorker)                              ││ │
│     │  └─ AsyncDuckDB.instantiate() ──▶ fails ──▶ EXPL-02 error A     ││ │
│     ▼ success                                                         ││ │
│  5. registerFileURL(dataUrl(...)) + query                            ││ │
│     │  (Phase: "loading data" loading state)                         ││ │
│     │  SELECT * FROM read_parquet('data.parquet')                    ││ │
│     │  ──▶ fetch/HTTP fails or query errors ──▶ EXPL-02 error B       ││ │
│     ▼ success                                                        └┘ │
│  6. Arrow result.toArray().map(toJSON) + BigInt→Number transform       │ │
│     ▼                                                                  │ │
│  7. meta.json fields[] ──▶ derive IMutField[] (semanticType +          │ │
│     analyticType, analyticType passes through 1:1 from EnquestaMeta)   │ │
│     ▼                                                                  │ │
│  8. <GraphicWalker dataSource={rows} rawFields={fields}                │ │
│       chart={decodedSpecOrUndefined} />                                │ │
│     │                                                                  │ │
│     ├─▶ user drags X/Y/Color/Size/Filter, picks mark type (EXPL-03/04) │ │
│     ├─▶ user clicks GraphicWalker's own "export" toolbar icon          │ │
│     │     ──▶ ref.exportChart('data-url'|'svg') (EXPL-10)              │ │
│     └─▶ user clicks app-shell "Copy link" (D-05/D-06)                  │ │
│           ──▶ read current spec from GraphicWalker ──▶ encode ──▶      │ │
│               write to clipboard (EXPL-11)                             │ │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── services/
│   └── duckdb.ts              # singleton AsyncDuckDB + queryParquet() — new this phase
├── lib/
│   ├── enquestes.ts            # existing — reused for dataUrl/isValidEnquestaId/parseEnquestaMeta
│   ├── graphicWalkerFields.ts  # new — EnquestaMetaField[] + Arrow schema → IMutField[] mapping
│   └── shareLink.ts            # new — encode/decode chart spec ↔ query param, D-07 soft fallback
├── hooks/
│   └── useTheme.ts             # existing — reused as-is in the new explorer header
├── pages/
│   └── ExplorerPage.tsx        # rewritten this phase — was a static stub
├── components/
│   ├── ThemeToggle.tsx         # existing — reused as-is
│   ├── ExplorerHeader.tsx      # new — D-01/D-02/D-06: title + back-link + toggle + Copy link
│   └── DataDictionary.tsx      # new — EXPL-09, see recommendation below
```

### Pattern 1: DuckDB-Wasm singleton service with self-hosted assets

**What:** One module owns the `AsyncDuckDB` instance and Worker, lazily created on first call.
Assets are imported with Vite's `?url` suffix rather than fetched from a CDN at runtime.
**When to use:** Always in this architecture (already established in ARCHITECTURE.md Pattern 1);
this phase adds the exact, verified asset filenames.
**Example:**
```typescript
// src/services/duckdb.ts
import * as duckdb from '@duckdb/duckdb-wasm'

// Exact filenames confirmed this session via jsDelivr's package-content API for
// @duckdb/duckdb-wasm@1.32.0/dist — do not guess these; they are the built artifact
// names, not part of the library's public TypeScript API.
// [VERIFIED: jsdelivr package listing for @duckdb/duckdb-wasm@1.32.0/dist]
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url'
import duckdb_worker_eh from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url'
import duckdb_wasm_mvp from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url'
import duckdb_worker_mvp from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url'

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
  mvp: { mainModule: duckdb_wasm_mvp, mainWorker: duckdb_worker_mvp },
  eh: { mainModule: duckdb_wasm_eh, mainWorker: duckdb_worker_eh },
  // Deliberately no `coi` entry: GitHub Pages cannot set the COOP/COEP headers
  // the threaded bundle requires (project-level PITFALLS.md Pitfall 1).
}

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null

async function initDb(): Promise<duckdb.AsyncDuckDB> {
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES)
  const worker = new Worker(bundle.mainWorker!)
  const logger = new duckdb.ConsoleLogger()
  const db = new duckdb.AsyncDuckDB(logger, worker)
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker)
  return db
}

export function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) dbPromise = initDb()
  return dbPromise
}
```
`// Source: duckdb.org/docs/current/clients/wasm/instantiation (selectBundle/bundle shape,
// [CITED: duckdb.org/docs/current/clients/wasm/instantiation]) + exact dist filenames
// [VERIFIED: jsdelivr package listing]`

### Pattern 2: Parquet query with BigInt-safe row conversion

**What:** Register the committed Parquet via HTTP, query it, and explicitly convert Arrow
`BigInt` values (from the `int64` measure columns) to plain JS numbers before handing rows to
GraphicWalker.
**When to use:** Every query against `[id]_respostes.parquet`. This project's own committed file
has 3 `int64` columns (`edat`, `satisfaccio`, `recomanaria`) `[VERIFIED: .planning/phases/02-offline-data-pipeline/02-03-SUMMARY.md — "Column dtypes as written to Parquet: edat: int64, satisfaccio: int64, recomanaria: int64, segment: large_string, canal: large_string, territori: large_string"]` — DuckDB-Wasm returns `int64` as JS `BigInt`, which GraphicWalker's chart engine cannot consume directly.
**Example:**
```typescript
// src/services/duckdb.ts (continued)
export async function queryParquet(url: string): Promise<Record<string, unknown>[]> {
  const db = await getDb()
  const conn = await db.connect()
  try {
    await db.registerFileURL('data.parquet', url, duckdb.DuckDBDataProtocol.HTTP, false)
    const result = await conn.query(`SELECT * FROM read_parquet('data.parquet')`)
    return result.toArray().map((row) => {
      const obj = row.toJSON() as Record<string, unknown>
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'bigint') obj[key] = Number(obj[key] as bigint)
      }
      return obj
    })
  } finally {
    await conn.close()
  }
}
```
`// Source: duckdb.org/docs/current/clients/wasm/data_ingestion (registerFileURL pattern,
// [CITED: duckdb.org/docs/current/clients/wasm/data_ingestion]) + community-confirmed BigInt
// behavior [ASSUMED — WebSearch corroborated across multiple threads, no single official doc
// page states this explicitly; safe for this dataset's value ranges (age/1-10 score/0-100%),
// all far under Number.MAX_SAFE_INTEGER]`

### Pattern 3: Field typing — direct pass-through, not inference

**What:** `EnquestaMetaField.type` (`'dimension' | 'measure'`) maps **verbatim** to
GraphicWalker's `IMutField.analyticType`, because both are declared as the exact same TypeScript
union.
**When to use:** Constructing `rawFields` for `<GraphicWalker />` — read the type from `meta.json`
(already computed offline by Phase 2's `infer.build_fields`), never re-infer from the raw Parquet
column.
**Example:**
```typescript
// src/lib/graphicWalkerFields.ts
import type { EnquestaMetaField } from '../types/enquesta'

// GraphicWalker's IMutField, per its published source:
// interfaces.ts — "export interface IMutField { fid: string; key?: string; name?: string;
// semanticType: ISemanticType; analyticType: IAnalyticType; ... }"
// "export type ISemanticType = 'quantitative' | 'nominal' | 'ordinal' | 'temporal'"
// "export type IAnalyticType = 'dimension' | 'measure'"
// [CITED: raw.githubusercontent.com/Kanaries/graphic-walker/main/packages/graphic-walker/src/interfaces.ts]
interface IMutField {
  fid: string
  name?: string
  semanticType: 'quantitative' | 'nominal' | 'ordinal' | 'temporal'
  analyticType: 'dimension' | 'measure'
}

export function toGraphicWalkerFields(fields: EnquestaMetaField[]): IMutField[] {
  return fields.map((f) => ({
    fid: f.name,
    name: f.label ?? f.name,
    // analyticType is a direct, verbatim pass-through — EnquestaMetaField.type
    // ('dimension' | 'measure') IS IAnalyticType, no translation table needed.
    // [VERIFIED: src/types/enquesta.ts:16-21 — "type: 'dimension' | 'measure'"]
    analyticType: f.type,
    // semanticType has no equivalent in EnquestaMetaField; derive from the measure/
    // dimension split this project's Parquet columns actually use: measures are
    // int64 -> 'quantitative', dimensions are large_string -> 'nominal'.
    semanticType: f.type === 'measure' ? 'quantitative' : 'nominal',
  }))
}
```

### Anti-Patterns to Avoid
- **Installing `@duckdb/duckdb-wasm` without an exact version pin:** the registry's `latest`
  dist-tag currently resolves to a `-dev` prerelease build, not a stable release. `npm install
  @duckdb/duckdb-wasm` (no version) will install `1.33.1-dev57.0`. Always pin `@1.32.0` explicitly.
- **Letting `apache-arrow` resolve to its own registry-latest (`21.x`) instead of the `^17.0.0`
  DuckDB-Wasm 1.32.0 actually bundles:** produces silent `instanceof` failures on Arrow result
  objects, hard to debug because the query itself succeeds.
- **Treating GraphicWalker's field auto-inference as sufficient for EXPL-05:** already flagged in
  project ARCHITECTURE.md Anti-Pattern 2 — this phase's `meta.json` already has clean
  `fields[]`, use it explicitly rather than letting GraphicWalker guess from raw column names.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|--------------|-----|
| Drag-and-drop chart builder UI (EXPL-03/04) | Custom X/Y/Color/Size/Filter shelf UI | `<GraphicWalker dataSource rawFields />` | This is the entire reason GraphicWalker is in the stack; hand-building the equivalent is a multi-week project |
| Chart-to-image export (EXPL-10) | `html2canvas`/`dom-to-image` custom exporter | `ref.exportChart('svg' \| 'data-url')` on GraphicWalker's `IGWHandler` | Native, already-tested export path exists on the component itself |
| Chart-type picker (bar/line/area/scatter) | Custom chart-type selector | GraphicWalker's own toolbar mark-type switcher (`bar`, `line`, `area`, `point`, `circle`, etc.) `[CITED: WebSearch-corroborated, GraphicWalker GitHub wiki "Customize visualization theme"]` | Built into the component's own UI, zero extra code |
| Field dimension/measure classification | A new inference pass at explorer-render time | Direct pass-through of `EnquestaMetaField.type` (Phase 2 already computed this) | Same union type on both sides — inference would be pure duplicated work |

**Key insight:** This phase's temptation is to under-trust GraphicWalker and rebuild pieces of its
UI (chart-type picker, export button) because its API surface is less familiar/less documented
than, say, React Router. Nearly everything EXPL-03/04/10 ask for is already inside the component;
the actual net-new code this phase writes is the DuckDB wiring, the field-mapping glue, the
loading/error states, and the shareable-link encode/decode — not chart UI.

## Common Pitfalls

> Project-level pitfalls (COOP/COEP, Vite asset bundling, range-request reliability, memory
> ceilings, stale cache, Git LFS, re-identification) are already documented in
> `.planning/research/PITFALLS.md` and re-confirmed, not repeated in full here. This section adds
> implementation-level pitfalls discovered going one layer deeper this session.

### Pitfall 1: `npm install @duckdb/duckdb-wasm` installs a `-dev` prerelease

**What goes wrong:** The package's `latest` npm dist-tag currently points to `1.33.1-dev57.0`
(confirmed via `npm view @duckdb/duckdb-wasm dist-tags` this session). A bare `npm install
@duckdb/duckdb-wasm` or an unpinned `^1.x` range resolves to this dev build, not a stable release.
**Why it happens:** The DuckDB-Wasm project appears to publish continuous dev builds and tag the
newest one `latest`/`next` simultaneously — an unusual but real registry state, not a
typo/hijack (verified: legitimate `github.com/duckdb/duckdb-wasm` repo, matching download volume).
**How to avoid:** Pin the exact version in `package.json`: `"@duckdb/duckdb-wasm": "1.32.0"` (no
caret). Re-verify with `npm view @duckdb/duckdb-wasm dist-tags` at implementation time in case a
newer stable tag has since been cut.
**Warning signs:** `node_modules/@duckdb/duckdb-wasm/package.json` version field containing `-dev`.

### Pitfall 2: GraphicWalker's peer dependency on `styled-components` is silently unmet

**What goes wrong:** `@kanaries/graphic-walker@0.5.2` requires `styled-components@^6.1.19` as a
hard peer (no `peerDependenciesMeta.optional`). It is not currently in this project's
`package.json`. Installing GraphicWalker alone will produce an `npm` unmet-peer-dependency
warning, and some of GraphicWalker's internal components may fail at runtime without it actually
present in `node_modules`.
**How to avoid:** Install `styled-components@^6.1.19` explicitly alongside GraphicWalker in the
same task.
**Warning signs:** `npm install` peer-dependency warnings mentioning `styled-components`; runtime
errors referencing `styled-components` internals when `<GraphicWalker />` first renders.

### Pitfall 3: `apache-arrow` version drift between the project and DuckDB-Wasm's bundled version

**What goes wrong:** `@duckdb/duckdb-wasm@1.32.0` depends on `apache-arrow@^17.0.0` internally.
If the project's own `package.json` pins a different major (e.g. the registry's current latest,
`21.2.0`), npm may hoist two separate `apache-arrow` installations, producing duplicate class
definitions — `instanceof Table` checks silently fail even though the query itself succeeds and
data "looks" right in a debugger.
**How to avoid:** Pin `apache-arrow` to `^17.0.0` explicitly, matching what `@duckdb/duckdb-wasm`
declares. Re-check with `npm view @duckdb/duckdb-wasm@<pinned-version> dependencies` if the
DuckDB-Wasm pin ever changes.
**Warning signs:** Arrow-related type-check failures that only reproduce in specific code paths;
`npm ls apache-arrow` showing more than one resolved version.

### Pitfall 4: GraphicWalker 0.5.x's chart-spec *read-back* API is not confirmed in current public docs

**What goes wrong:** Restoring a shared chart (decoding a query param into GraphicWalker's `chart`
prop, `IChart[]`) is confirmed current per the official Kanaries API reference. But *reading the
current chart spec back out* on the D-05 manual "Copy link" click — the other half of EXPL-11 —
is only documented via an older, explicitly pre-0.5 pattern (`storeRef` → `VizSpecStore →
exportCode()`, from the project wiki, version-unspecified but stylistically older-API). The
current `IGWHandler` ref (confirmed via the official 0.5.x API reference page) only exposes
`exportChart`/`exportChartList` for **image** export, not spec export — those methods were not
found in the fetched current docs.
**How to avoid:** Before writing the shareable-link task, spend a short spike confirming the
exact 0.5.2 API against the installed package's own TypeScript types (`node_modules/@kanaries/
graphic-walker/dist/*.d.ts` — search for `storeRef`, `IGlobalStore`, `vizStore`, or any `chart`-
adjacent export method) rather than relying on either the old wiki example or assuming
`exportChart` covers spec data. This is flagged, not blocking — see Assumptions Log A2.
**Warning signs:** Attempting to call a documented-but-nonexistent method (`exportCurrentSpec`)
would surface immediately as a TypeScript compile error, which is a cheap, fast failure mode —
not a runtime surprise.

## Loading/Init UX Recommendation (EXPL-01, Claude's Discretion)

**Recommendation: two distinct, visible loading phases**, not one combined spinner, because
EXPL-02 requires a *clear* error message and there are two genuinely different failure points
with different remediation stories for the user:

1. **"Inicialitzant el motor de consultes…"** (DuckDB-Wasm engine init: bundle select → Worker
   spin-up → `instantiate()`) — failure here means the browser/environment itself can't run the
   engine (e.g. WASM unsupported), no retry will help without a different browser.
2. **"Carregant les dades de l'enquesta…"** (Parquet fetch + query) — failure here is more likely
   transient (network blip, GitHub Pages cache propagation delay per project PITFALLS.md Pitfall
   6) and a "Torna-ho a provar" retry button (matching the existing `ErrorState`/`onRetry` pattern
   from `HomePage.tsx`) is meaningful.

This reuses the project's existing `FetchState<T>` discriminated-union pattern
(`{status:'loading'}|{status:'error'}|{status:'success'}`) twice — once per phase — rather than
inventing a new state shape, and reuses `ErrorState`'s visual language (red alert box, retry
button) for consistency with `HomePage`'s error handling.

## Data Dictionary UI Recommendation (EXPL-09, Claude's Discretion)

**Recommendation: a collapsible panel/section in the `ExplorerHeader` area (or immediately below
it), not hover tooltips.** Rationale:
- GraphicWalker's own field list (in its drag-source panel) is rendered *inside* the third-party
  component — injecting custom hover tooltips into it would mean reaching into GraphicWalker's
  DOM/internals, which the project already avoids by design (D-06 explicitly keeps custom UI out
  of GraphicWalker's own chrome).
- A dedicated, collapsed-by-default panel outside GraphicWalker (reusing the existing
  `SurveySummaryModal`-adjacent visual language: small card, Catalan labels) lets a visitor check
  field meanings without it consuming permanent canvas space, and requires zero coupling to
  GraphicWalker's internal component tree.
- Data source: `EnquestaMetaField.label`/`.description`, already fetched once (the same
  `meta.json` this phase already loads for `rawFields` construction) — no second fetch needed.

## Code Examples

### Full field mapping including semanticType derivation
See Architecture Patterns → Pattern 3 above (verbatim reusable code).

### DuckDB singleton + BigInt-safe query
See Architecture Patterns → Pattern 1 and Pattern 2 above (verbatim reusable code).

### GraphicWalker minimal mount (confirmed current props + required CSS import)
```tsx
// src/pages/ExplorerPage.tsx (relevant excerpt)
import { GraphicWalker } from '@kanaries/graphic-walker'
import '@kanaries/graphic-walker/dist/style.css' // required — GraphicWalker ships its own CSS
// [CITED: WebSearch — Kanaries official minimal-example pattern, cross-referenced against
// the package's own README structure]

<GraphicWalker
  dataSource={rows}
  rawFields={fields}
  chart={initialChartFromQueryParam} // undefined if no ?chart= param or D-07 fallback triggered
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-------------------|---------------|--------|
| GraphicWalker `storeRef` → `VizSpecStore.exportCode()` for spec export (pre-0.5 wiki pattern) | `IGWHandler` ref with `exportChart`/`exportChartList` for image export; `chart` prop (`IChart[]`) for spec restore | Documented as part of the "version 0.5 proposals" API redesign discussion on the project's GitHub, exact cutover version not confirmed | The *read-current-spec-out* half of that redesign is not confirmed present in current public docs — see Pitfall 4 / Assumptions Log A2 |
| Hand-rolled `?url` imports being the only viable Vite pattern for DuckDB-Wasm assets | Same pattern still current, but exact dist filenames now confirmed for `1.32.0` (`duckdb-eh.wasm`, `duckdb-browser-eh.worker.js`, `duckdb-mvp.wasm`, `duckdb-browser-mvp.worker.js`) | N/A — first time this project has pinned an exact version | Removes the guesswork STACK.md/PITFALLS.md left open ("verify the resulting URLs") |

**Deprecated/outdated:** None identified as deprecated within this phase's dependency set; both
core libraries are actively maintained (`@duckdb/duckdb-wasm` had a dev release as recently as
2026-07-28, `@kanaries/graphic-walker` `0.5.2` is its current `latest`).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|-----------------|
| A1 | Arrow `BigInt` → `Number()` conversion is safe for this project's specific `int64` columns (age/1-10 scores/0-100 percentages) | Architecture Patterns → Pattern 2 | LOW — values are far under `Number.MAX_SAFE_INTEGER` (2^53-1); would only matter if a future survey's `int64` column held genuinely large values (e.g. a raw timestamp in nanoseconds), which none of the current committed dataset's columns do |
| A2 | GraphicWalker 0.5.2's mechanism for reading the *current* chart spec back out (needed for EXPL-11's "Copy link") is not confirmed by current public docs; only spec *restore* (`chart` prop) and image export (`exportChart`) are confirmed current | EXPL-11 / Pitfall 4 | MEDIUM — if the assumed `storeRef`/`vizStore`-adjacent API from the older wiki pattern doesn't exist in 0.5.2, the planner needs to budget a short spike task to find the actual current method (checking the installed package's own `.d.ts` files) before the shareable-link task can be estimated with confidence |
| A3 | `@kanaries/graphic-walker@0.5.2`'s `package.json` genuinely lacks a `repository` field (rather than the legitimacy-check tool failing to read it) | Package Legitimacy Audit | LOW — either way the package is the correct, project-mandated one; this only affects how the `[SUS]` flag should be interpreted, not whether to install it |
| A4 | GraphicWalker's built-in mark-type picker in its own toolbar covers all of EXPL-04's named types (bars, lines, area, scatter) without additional configuration | Don't Hand-Roll | LOW — WebSearch-corroborated (not a direct official-docs quote) that `bar`, `line`, `area`, `point`, `circle` are supported mark types; if any were gated behind a paid/pro tier this would need a fallback, but GraphicWalker is fully open-source with no such tiering known |

## Open Questions

1. **Exact GraphicWalker 0.5.2 chart-spec read-back method (for EXPL-11's "Copy link")**
   - What we know: `chart` prop (type `IChart[]`) is confirmed current for *restoring* a spec on
     mount. `IGWHandler.exportChart()` is confirmed current but exports an **image**, not spec
     data. An older wiki page shows `storeRef` → `VizSpecStore.exportCode()`, but its version is
     unconfirmed and predates the "0.5 API redesign" discussion.
   - What's unclear: whether `storeRef` in 0.5.2 still exposes an equivalent read path, and under
     what name.
   - Recommendation: first task of the shareable-link work should be a 15-30 minute spike reading
     `node_modules/@kanaries/graphic-walker/dist/index.d.ts` (or wherever the package's types
     live post-install) for any `storeRef`/`IGlobalStore`/spec-getter surface, before committing
     to an implementation approach. Not a blocker for planning the phase — just for estimating
     that specific task's implementation detail.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|--------------|-----------|---------|----------|
| Node.js | `npm install`, `npm run build` | ✓ | v20.18.3 `[VERIFIED: node --version]` | — |
| npm | package installation | ✓ | 10.8.2 `[VERIFIED: npm --version]` | — |
| Browser WASM + Worker support | DuckDB-Wasm runtime (client-side, not a build-time dependency) | Assumed ✓ for all evergreen browsers (Chrome/Firefox/Safari/Edge) — no probe possible from this environment | — | None with equivalent functionality; project's existing UX pitfall guidance (PITFALLS.md) already recommends a clear unsupported-browser message rather than a silent failure |
| GitHub Pages HTTP range-request support | Efficient Parquet partial reads (not a hard requirement — full-file download still works, just slower) | Not verifiable from this environment; project PITFALLS.md Pitfall 3 already documents a known historical GitHub Pages range-request bug (fixed ~March 2026) | — | Full-file download (DuckDB-Wasm degrades gracefully to this if range requests are unavailable) |

**Missing dependencies with no fallback:** none — all core dependencies (Node/npm) are present
and no phase-blocking external service is required (fully client-side).

**Missing dependencies with fallback:** none currently missing; `styled-components` is not yet in
`package.json` but is a plain `npm install`, not an environment gap.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|----------------|---------|--------------------|
| V2 Authentication | No | No auth in this app (out of scope per REQUIREMENTS.md) |
| V3 Session Management | No | No sessions/cookies |
| V4 Access Control | No | All data in `public/data/` is intentionally, fully public (project-level constraint, already documented in ARCHITECTURE.md Anti-Pattern 3) |
| V5 Input Validation | Yes | Two untrusted-input surfaces this phase introduces: (1) the `:id` route param — already validated by existing `isValidEnquestaId` (reused, not new); (2) the `?chart=` shareable-link query param — new this phase, decoded client-side, validated against known field names from the already-fetched `meta.json` before being handed to GraphicWalker, malformed/unknown input silently discarded per D-07 (not a hard-reject trust boundary like `parseEnquestaMeta`, by explicit user decision) |
| V6 Cryptography | No | No encryption/hashing needed — the shareable link is an obfuscation-free, plainly-readable encoding (e.g. base64 JSON or URL-encoded JSON), not a security boundary; anyone can already download the full Parquet directly regardless of what's in a chart spec |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|------------------------|
| Malformed/tampered `?chart=` query param crashing the page or rendering broken state | Tampering | D-07's soft-fallback: `try/catch` around decode + validate every field name against the known `meta.json` field list before use; on any failure, ignore the param entirely and render the default blank explorer (already a locked decision, not new guidance) |
| XSS via field labels/descriptions or shared chart data rendered into the DOM | Tampering / Information Disclosure | React's default JSX escaping is sufficient as long as no `dangerouslySetInnerHTML` is introduced for `meta.json` content or decoded chart-spec strings — none is needed anywhere in this phase's UI |
| Oversized/crafted `?chart=` param causing a decode-time hang or memory spike | Denial of Service (client-side, self-inflicted only — no server to DoS) | Cap the accepted query-param length before attempting to decode (e.g. reject anything over a few KB outright) as a cheap guard; impact is limited to the single visitor's own tab, not the site |
| A `?chart=` param referencing a field name that existed in a since-updated `meta.json` (schema drift) | Tampering (schema-confusion) | Explicitly covered by D-07 — validate every field reference against the currently-loaded `meta.json`'s `fields[]` before applying, drop anything unmatched |

## Sources

### Primary (HIGH confidence)
- `.planning/phases/02-offline-data-pipeline/02-03-SUMMARY.md` — committed Parquet's exact
  dtypes/size, read directly this session.
- `src/types/enquesta.ts`, `src/lib/enquestes.ts`, `src/pages/ExplorerPage.tsx`,
  `src/router.tsx`, `src/App.tsx`, `src/main.tsx`, `src/hooks/useTheme.ts`,
  `src/components/ThemeToggle.tsx`, `vite.config.ts`, `package.json`, `public/404.html`,
  `index.html` — all read directly this session.
- `npm view` / registry queries this session for exact version numbers, dist-tags, peer
  dependencies, and dependency graphs of `@duckdb/duckdb-wasm`, `@kanaries/graphic-walker`,
  `apache-arrow`, `styled-components`.
- jsDelivr package-content API for `@duckdb/duckdb-wasm@1.32.0/dist` — exact asset filenames.

### Secondary (MEDIUM confidence — WebFetch of official docs, direct source-code fetch)
- `duckdb.org/docs/current/clients/wasm/instantiation` — bundle selection, `?url` import pattern,
  COOP/COEP requirement scope.
- `duckdb.org/docs/current/clients/wasm/data_ingestion` — `registerFileURL` pattern.
- `raw.githubusercontent.com/Kanaries/graphic-walker/main/packages/graphic-walker/src/interfaces.ts`
  — `IMutField`, `ISemanticType`, `IAnalyticType`, `IChart` definitions, fetched directly.
- `docs.kanaries.net/graphic-walker/api-reference/graphic-walker` — current component props and
  `IGWHandler` ref surface.

### Tertiary (LOW confidence — WebSearch only, flagged for validation)
- GraphicWalker chart-spec read-back API (pre-0.5 wiki pattern, version unconfirmed against
  0.5.2) — see Assumptions Log A2 and Open Questions.
- BigInt-conversion necessity for DuckDB-Wasm `int64` columns — corroborated across multiple
  independent community threads but no single official doc page states it explicitly.
- GraphicWalker's supported mark types (bar/line/area/point/circle/etc.) — WebSearch-only,
  cross-referenced against the project's own GitHub wiki page title, not a direct docs quote.

## Metadata

**Confidence breakdown:**
- Standard stack (exact versions, peer deps): HIGH — directly verified via `npm view` against the
  live registry this session, not training-data guesses.
- Architecture (DuckDB singleton, GraphicWalker materialize-once): HIGH — matches already-verified
  project-level ARCHITECTURE.md, re-confirmed against current official docs.
- GraphicWalker chart-spec export/import API (EXPL-11 specifically): LOW — see Assumptions Log A2,
  Open Questions. Everything else in this document is MEDIUM-HIGH.
- Pitfalls (implementation-level, this session's new findings): HIGH for the three package/version
  pitfalls (directly reproduced via `npm view`), MEDIUM for the GraphicWalker API pitfall (based on
  absence-of-evidence in fetched docs, not a confirmed negative).

**Research date:** 2026-08-26
**Valid until:** ~14 days (this is a fast-moving dependency set — `@duckdb/duckdb-wasm` cuts dev
releases roughly weekly; re-run `npm view` version checks before implementation if more than two
weeks elapse before this phase is planned/executed).

---
*Phase: 3-Interactive Explorer*
*Researched: 2026-08-26*
