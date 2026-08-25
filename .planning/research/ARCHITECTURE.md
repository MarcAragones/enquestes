# Architecture Research

**Domain:** Fully client-side, static data-exploration web app (survey/enquesta explorer)
**Researched:** 2026-08-25
**Confidence:** MEDIUM-HIGH (HIGH for Vite/GitHub Pages static-SPA deployment patterns — official, widely documented; MEDIUM for the specific DuckDB-Wasm ↔ GraphicWalker wiring — fewer independent authoritative sources, smaller ecosystem, APIs still evolving)

## Standard Architecture

### System Overview

```
┌───────────────────────────────────────────────────────────────────────────┐
│                     OFFLINE / AUTHOR-TIME (Python, local machine)          │
│  raw CSV/Excel ──▶ scripts/convert_to_parquet.py ──▶ writes to public/data │
│  (Google Forms /      - drops PII columns                                 │
│   Typeform export,    - computes summary stats (KPIs)                    │
│   never committed)    - writes [id]_respostes.parquet                    │
│                        - writes [id]_meta.json                            │
│                        - upserts entry in enquestes_index.json            │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                     │ git commit + push (public/data/* only)
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                  BUILD/DEPLOY (GitHub Actions, on push to main)            │
│  npm ci → vite build (bundles src/, copies public/ verbatim) → upload      │
│  artifact → deploy to GitHub Pages (static hosting, no server, no headers) │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                         BROWSER (deployed static SPA)                      │
│  ┌─────────────┐   ┌───────────────────┐   ┌────────────────────────────┐ │
│  │  Router /   │   │  HomePage         │   │  ExplorerPage              │ │
│  │  App shell  │──▶│  (index + meta    │──▶│  (/enquesta/:id)           │ │
│  │             │   │   quick-look)     │   │                            │ │
│  └─────────────┘   └─────────┬─────────┘   └──────────┬─────────────────┘ │
│                               │ fetch()                │                  │
│                               ▼                        ▼                  │
│              ┌──────────────────────────┐   ┌──────────────────────────┐  │
│              │ Static JSON layer         │   │ DuckDB-Wasm Service       │  │
│              │ enquestes_index.json      │   │ (singleton, src/services/ │  │
│              │ [id]_meta.json            │   │  duckdb.ts)               │  │
│              │ — plain fetch+.json()     │   │ — lazy-init on first use  │  │
│              │ — no WASM needed          │   │ — owns AsyncDuckDB+Worker │  │
│              └──────────────────────────┘   │ — reads [id]_respostes    │  │
│                                              │   .parquet via HTTP        │  │
│                                              └──────────┬───────────────┘  │
│                                                          │ Arrow → JSON rows │
│                                                          ▼                  │
│                                              ┌──────────────────────────┐  │
│                                              │ <GraphicWalker />         │  │
│                                              │ pure viz layer, knows     │  │
│                                              │ nothing about fetch/duckdb │  │
│                                              └──────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| Offline Python conversion pipeline | Transforms raw, potentially sensitive CSV/Excel exports into publish-safe artifacts; the only place PII is ever touched | `pandas`/`duckdb` (Python) reading raw export, dropping identifying columns, computing KPI aggregates, writing `.parquet` + `meta.json`, upserting `index.json` |
| Static JSON metadata layer | Lightweight, DuckDB-independent description of "what surveys exist" and "what does this one look like at a glance" | `public/data/enquestes_index.json` (list), `public/data/enquestes/[id]_meta.json` (per-survey KPIs) — plain static files, fetched with `fetch()` |
| DuckDB-Wasm service | Single owner of the WASM engine + Worker lifecycle; the only component allowed to touch `.parquet` bytes | `src/services/duckdb.ts` — module-level singleton exporting `getDb()` / `queryParquet()`, lazily initialized on first call |
| React app shell / router | Navigation, layout, page composition; orchestrates when the JSON layer vs. the DuckDB service is invoked | `react-router` with `basename` matching the GitHub Pages sub-path |
| HomePage | Renders survey grid from index.json; quick-look modal from meta.json | Reads only the JSON layer — never triggers DuckDB/WASM load, keeps first paint fast |
| ExplorerPage | Loads one survey's parquet via the DuckDB service and wires the result into GraphicWalker | Only page that pays the WASM/worker bundle cost, loaded lazily via route-based code splitting |
| GraphicWalker | Visualization/exploration surface (drag fields, build charts) | `@kanaries/graphic-walker` component; consumes plain data+fields (or a custom `computation` adapter) — has zero knowledge of fetch, DuckDB, or JSON schema |
| GitHub Actions deploy workflow | Builds and publishes the static site; the only "server-side" step in the whole system, and it runs before any user ever loads the app | `.github/workflows/deploy.yml`: `npm ci` → `vite build` → upload-pages-artifact → deploy-pages |

## Recommended Project Structure

```
enquestes/
├── public/
│   └── data/
│       ├── enquestes_index.json        # list: [{id, title, date, description, n}]
│       └── enquestes/
│           ├── [id]_respostes.parquet  # queried client-side by DuckDB-Wasm
│           └── [id]_meta.json          # per-survey KPIs, no PII
├── scripts/                            # offline, never shipped/imported by src/
│   ├── convert_to_parquet.py           # real CSV/Excel -> parquet+meta+index
│   ├── generate_mock_parquet.py        # synthetic data for dev before real data lands
│   ├── lib/                            # shared helpers: anonymization, stats, index upsert
│   └── requirements.txt
├── data/raw/                           # gitignored — raw exports live here, never committed
├── src/
│   ├── services/
│   │   └── duckdb.ts                   # singleton AsyncDuckDB + query helper
│   ├── types/
│   │   └── enquesta.ts                 # TS types mirroring index.json / meta.json schema
│   ├── pages/
│   │   ├── HomePage.tsx
│   │   └── ExplorerPage.tsx
│   ├── components/
│   │   ├── SurveyCard.tsx
│   │   ├── SurveySummaryModal.tsx
│   │   └── ...
│   ├── router.tsx
│   ├── App.tsx
│   └── main.tsx
├── vite.config.ts                      # base: '/enquestes/'
└── .github/workflows/deploy.yml
```

### Structure Rationale

- **`scripts/` is fully outside `src/`:** it is a separate runtime (Python, author's machine or a manual pre-deploy step) that never ships to the browser. Keeping it siblings-not-nested with `src/` makes the boundary "this code never runs client-side" visually obvious and prevents accidental bundling.
- **`data/raw/` is gitignored:** raw exports may contain names/emails; only the *outputs* of the conversion script (`public/data/**`) are ever committed. This mirrors the constraint in PROJECT.md that `public/data/` is fully public/downloadable.
- **`src/services/duckdb.ts` is a single file, not a folder:** there is exactly one external engine to wrap; over-abstracting it (e.g., a `services/data/` layer with multiple adapters) is premature for a project with one data engine and one file format.
- **`pages/` vs `components/`:** only two real pages exist (list, explore) — a full feature-folder architecture (`features/survey-list/`, `features/explorer/`) would be over-engineering for this scope; flat `pages/` + `components/` is enough.
- **JSON layer lives in `public/data/`, not `src/data/`:** it must be fetchable at runtime as static assets (not bundled/inlined), and it's what the offline Python script writes to directly — no build step should touch it.

## Architectural Patterns

### Pattern 1: DuckDB-Wasm as a lazy-initialized singleton service

**What:** A single module (`src/services/duckdb.ts`) owns one `AsyncDuckDB` instance and one Worker, created on first call and reused for the app's lifetime. Nothing else in the app imports `@duckdb/duckdb-wasm` directly.
**When to use:** Always, in this architecture — initializing DuckDB-Wasm involves picking a WASM bundle, spinning up a Worker, and loading multi-MB WASM binaries; doing this more than once, or doing it eagerly on app load, wastes bandwidth and delays first paint.
**Trade-offs:** Adds one indirection layer (a service module instead of calling the library directly) but buys: (a) HomePage never pays the WASM cost, (b) ExplorerPage can `await` a cached promise instead of re-initializing, (c) a single place to handle bundle selection / error handling / COOP-COEP fallback.

**Example:**
```typescript
// src/services/duckdb.ts
import * as duckdb from '@duckdb/duckdb-wasm';

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function initDb(): Promise<duckdb.AsyncDuckDB> {
  const bundles = duckdb.getJsDelivrBundles(); // or manually bundled assets
  const bundle = await duckdb.selectBundle(bundles); // auto-picks MVP/EH, avoids COI unless cross-origin-isolated
  const worker = new Worker(bundle.mainWorker!);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  return db;
}

export function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) dbPromise = initDb();
  return dbPromise;
}

export async function queryParquet<T = Record<string, unknown>>(
  url: string,
  sql: string,
): Promise<T[]> {
  const db = await getDb();
  const conn = await db.connect();
  try {
    await db.registerFileURL('data.parquet', url, duckdb.DuckDBDataProtocol.HTTP, false);
    const result = await conn.query(sql.replace('__TABLE__', "read_parquet('data.parquet')"));
    return result.toArray().map((row) => row.toJSON());
  } finally {
    await conn.close();
  }
}
```

### Pattern 2: Two-tier metadata — index vs. meta, decoupled from parquet

**What:** `enquestes_index.json` holds only what the grid needs (id, title, date, short description, participant count). Each `[id]_meta.json` holds the richer per-survey summary (KPIs, field descriptions). Neither requires DuckDB — they are plain JSON fetched directly.
**When to use:** Whenever a list view needs to render many items cheaply, and a detail/summary view needs more data but still shouldn't force a full parquet+WASM load just to show a headline number.
**Trade-offs:** Introduces a small "data duplication" concern (e.g., participant count may appear in both index and meta, and must be kept consistent) — mitigate by having the conversion script generate both from the same computed source of truth, never hand-editing them independently.

**Example:**
```json
// enquestes_index.json
[{ "id": "satisfaccio-2026", "title": "Enquesta de satisfacció 2026", "date": "2026-06-01", "description": "...", "n": 412 }]
```
```json
// satisfaccio-2026_meta.json
{ "id": "satisfaccio-2026", "n": 412, "kpis": [{"label": "Satisfacció mitjana", "value": 8.1}], "fields": [{"name": "edat", "type": "number"}, ...] }
```

### Pattern 3: GraphicWalker in-browser-data mode (recommended) vs. custom DuckDB computation adapter (scaling path)

**What:** GraphicWalker can operate in two modes:
1. **Simple mode (recommended for MVP):** DuckDB-Wasm runs one `SELECT *` against the parquet file, the Arrow result is converted to a plain JS array, and that array is handed directly to `<GraphicWalker data={rows} fields={fields} />`. GraphicWalker then does its own in-memory aggregation/filtering as the user drags fields — DuckDB's job ends after the initial load.
2. **Computation-adapter mode:** GraphicWalker is given a custom `computation` object (implementing `computation(query) => Promise<rows>`) that translates GraphicWalker's internal query DSL to SQL (via `@kanaries/gw-dsl-parser`) and re-runs it against DuckDB on every interaction, so DuckDB does the aggregation instead of GraphicWalker's JS engine.
**When to use:** Use mode 1 by default — survey datasets are typically hundreds to low-tens-of-thousands of rows, well within what GraphicWalker's own in-memory engine handles interactively in a browser tab. Reach for mode 2 only if a specific survey's row count or column cardinality makes GraphicWalker's client-side aggregation noticeably slow (a "scale up" trigger, not a starting assumption).
**Trade-offs:** Mode 1 is far simpler (one query, one data hand-off, no DSL-to-SQL translation layer, no extra dependency) but re-does all aggregation client-side even on already-transferred data. Mode 2 keeps DuckDB in the loop for every chart interaction (better for very large datasets) but adds real integration complexity (worker RPC per interaction, DSL parser dependency, harder to debug) that is very likely overkill for a personal survey-exploration site.

## Data Flow

### End-to-end flow: raw export to rendered chart

```
raw CSV/Excel (Google Forms/Typeform export, contains PII)
    ↓  [author runs locally, never in CI]
scripts/convert_to_parquet.py
    - reads raw file
    - drops name/email/free-text-identifying columns
    - computes KPI aggregates for meta.json
    - writes public/data/enquestes/[id]_respostes.parquet
    - writes public/data/enquestes/[id]_meta.json
    - upserts entry into public/data/enquestes_index.json
    ↓  [git commit + push public/data/** only]
GitHub Actions (.github/workflows/deploy.yml)
    - npm ci, vite build (bundles src/, copies public/ verbatim)
    - upload-pages-artifact → deploy-pages
    ↓  [static files now served from GH Pages CDN]
Browser: HomePage
    - fetch('data/enquestes_index.json') → render grid
    - on card click: fetch('data/enquestes/[id]_meta.json') → quick-look KPIs
    - NO DuckDB/WASM cost paid yet
    ↓  [user clicks "Explorar dades interactives"]
Browser: ExplorerPage (/enquesta/:id)
    - src/services/duckdb.ts lazily initializes AsyncDuckDB + Worker (first WASM load)
    - registerFileURL + query: SELECT * FROM read_parquet('[id]_respostes.parquet')
    - Arrow result → plain JS row array
    ↓
<GraphicWalker data={rows} fields={inferredOrFromMeta} />
    - user drags X/Y/Color/Size/Filter
    - GraphicWalker computes aggregates in-memory, renders chart
```

### Key Data Flows

1. **Metadata flow (list + quick-look):** `index.json`/`meta.json` → `fetch()` → React state → render. Entirely independent of DuckDB; this is what makes the homepage fast regardless of how large any individual parquet file is.
2. **Exploration flow (interactive charts):** `.parquet` (HTTP) → DuckDB-Wasm (SQL) → Arrow → JS rows → GraphicWalker's internal state → rendered SVG/canvas chart. This is the only flow that touches the WASM engine, and it is scoped to a single route.
3. **Authoring flow (offline, not part of the deployed app):** raw export → Python script → `public/data/**` outputs. This flow has no runtime counterpart in the browser — the deployed app has zero Python/server dependency, satisfying the $0-cost, no-backend constraint.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| A handful of surveys, each ≤ ~50k rows (realistic for this project) | Current design as-is: one parquet per survey, full-extract-then-GraphicWalker (Pattern 3, mode 1), no changes needed |
| Dozens of surveys, or individual surveys in the hundreds-of-thousands of rows | Add column pruning to the initial DuckDB query (`SELECT` only fields actually used by GraphicWalker instead of `SELECT *`), and/or paginate the index page; consider switching that survey to the computation-adapter mode (Pattern 3, mode 2) so DuckDB does aggregation instead of shipping all rows to the client |
| Very large single datasets (millions of rows) | Not a realistic target for this project (personal survey site), but if it arose: rely on DuckDB-Wasm's HTTP range-request support to avoid downloading the whole parquet file, push filtering/aggregation into SQL via the computation-adapter pattern, and consider pre-aggregating common views server-side (offline, still $0 cost) rather than shipping raw rows |

### Scaling Priorities

1. **First likely bottleneck:** initial WASM bundle + parquet download size on first visit to ExplorerPage (a few MB of WASM + however large the parquet is). Mitigate with route-based code splitting (ExplorerPage/GraphicWalker/duckdb-wasm only load when that route is visited) — already implied by the two-page structure, just make sure it's an actual dynamic `import()` at the route level, not a top-level import in `App.tsx`.
2. **Second likely bottleneck:** GraphicWalker's in-memory computation on a single very "wide" or very "tall" survey. Mitigate per-survey by trimming unused columns in the conversion script (don't ship a `notes` free-text column into the parquet if it's not meant to be explored) — this is a data-pipeline fix, not an app-architecture fix.

## Anti-Patterns

### Anti-Pattern 1: Initializing DuckDB-Wasm eagerly at app startup

**What people do:** Import and initialize `@duckdb/duckdb-wasm` in `main.tsx` or `App.tsx` so "it's ready by the time the user needs it."
**Why it's wrong:** Forces every visitor — including ones who only ever look at the homepage grid — to download several MB of WASM and spin up a Worker before they see anything. Directly hurts first-paint time for the most common visit (browsing the list).
**Do this instead:** Lazy-initialize inside the singleton service (Pattern 1) on first call, and only call it from ExplorerPage, ideally behind a route-level dynamic import so the WASM bundle isn't even in the initial JS chunk.

### Anti-Pattern 2: Letting GraphicWalker infer fields from raw parquet column names/types with no curation

**What people do:** Pass whatever `read_parquet` returns straight into GraphicWalker's auto field-inference with no override.
**Why it's wrong:** Survey exports typically have ugly raw column names (`Q3_Com_valores_el_servei_1_a_5`), inconsistent types (Likert scales as strings), and columns that shouldn't be explorable (internal IDs, timestamps of submission). Auto-inference will surface all of it verbatim, producing a confusing exploration UI.
**Do this instead:** Have the conversion script emit clean, human-readable field names/types as part of `[id]_meta.json` (a `fields` array), and use that to construct GraphicWalker's `fields` prop explicitly rather than relying purely on runtime inference.

### Anti-Pattern 3: Treating `public/data/` as anything other than fully public

**What people do:** Assume that because a parquet file "isn't linked from the UI yet" or "isn't in the index," it's effectively private.
**Why it's wrong:** GitHub Pages serves the entire `public/` (built `dist/`) directory statically and predictably — anyone who knows or guesses a filename (or just reads the deployed JS bundle / index.json) can fetch any file in `public/data/`, indexed or not. This is explicitly called out in PROJECT.md as a constraint.
**Do this instead:** PII/anonymization decisions belong entirely in the offline Python pipeline (Pattern-1-adjacent: the conversion script is the sole gate). Never commit a "draft" or "unpublished" parquet/meta file to `public/data/` expecting it to stay private — treat "committed to `public/data/`" and "published to the world" as the same event.

## Integration Points

### External Services / Libraries

| Service/Library | Integration Pattern | Notes |
|---------|---------------------|-------|
| `@duckdb/duckdb-wasm` | Singleton service (Pattern 1), loaded lazily on the Explorer route | `selectBundle()` auto-detects browser capability and picks MVP/EH by default; it will only use the threaded COI bundle if the page is already cross-origin-isolated (COOP/COEP headers) — GitHub Pages cannot set custom response headers, so the library's automatic fallback to the non-threaded EH bundle is what makes this work on GH Pages without any extra config. Do not force the COI bundle. |
| `@kanaries/graphic-walker` | Data/fields props (simple mode) or custom `computation` adapter (scaling path) | Simple mode needs no extra dependency beyond the package itself; the computation-adapter mode additionally needs `@kanaries/gw-dsl-parser` to translate GraphicWalker's internal query language to SQL — only pull that in if/when scaling considerations require it |
| GitHub Pages + GitHub Actions | Static artifact deploy (`actions/upload-pages-artifact` + `actions/deploy-pages`), triggered on push to `main` | Requires `vite.config.ts` `base: '/enquestes/'` matching the repo name, and a `404.html` = copy of `index.html` (or equivalent SPA-fallback trick) so deep links like `/enquesta/xyz` don't 404 on direct load/refresh, since GH Pages has no server-side rewrite rules |
| Python (`pandas`/`pyarrow`/`duckdb`) | Offline CLI script, not part of the app runtime or CI build | Runs on the author's machine (or optionally as a manual/local pre-deploy step); CI only ever runs `npm`/`vite`, never Python — keeps the deploy pipeline dependency-free and fast |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `scripts/` (Python) ↔ `public/data/` | Filesystem writes only, one-directional | Python never reads back from the deployed app; `public/data/` is the entire contract between the offline pipeline and the frontend — schema changes there must be coordinated with `src/types/enquesta.ts` |
| React pages ↔ Static JSON layer | `fetch()` + `.json()`, one-directional (read-only) | No caching layer needed beyond the browser's own HTTP cache; index/meta files are small enough that no client-side state library (Redux/Zustand) is warranted — `useEffect`/React Query-style fetch-on-mount is sufficient |
| React pages ↔ DuckDB-Wasm service | Function calls through `src/services/duckdb.ts`'s exported API only | Pages/components must never import `@duckdb/duckdb-wasm` directly — this is the enforcement point for Pattern 1 (singleton, lazy-init) |
| DuckDB-Wasm service ↔ GraphicWalker | Plain JS data handed off once per page load (simple mode) | No live/reactive connection between the two — GraphicWalker owns all interaction state after the initial hand-off; re-querying DuckDB only happens if the user picks a different survey (new route/page mount) |

## Sources

- [DuckDB-Wasm official docs — Deploying DuckDB-Wasm](https://duckdb.org/docs/lts/clients/wasm/deploying_duckdb_wasm) — HIGH (official)
- [DuckDB-Wasm bundle variants (MVP/EH/COI) — DuckDBBundles reference](https://shell.duckdb.org/docs/interfaces/index.DuckDBBundles.html) — HIGH (official reference)
- [duckdb-wasm-kit — React hooks/singleton pattern for duckdb-wasm](https://github.com/holdenmatt/duckdb-wasm-kit) — MEDIUM (community library, widely referenced, cross-checked against official docs)
- [Kanaries Platform docs — Use DuckDB-Wasm for computation in GraphicWalker](https://platform.kanaries.net/graphic-walker/client-side/use-duckdb-wasm-as-computation) — MEDIUM (official Kanaries docs, but this is a smaller/less mainstream integration surface than DuckDB-Wasm alone)
- [Vite — Deploying a Static Site](https://vite.dev/guide/static-deploy) — HIGH (official Vite documentation)
- [GitHub Community discussion — Deploying Vite project to GitHub Pages root](https://github.com/orgs/community/discussions/176242) — MEDIUM (community, cross-checked against multiple independent write-ups)
- General deploy write-ups (base path, `404.html` SPA fallback, GitHub Actions `upload-pages-artifact`/`deploy-pages`) — MEDIUM (multiple independent blog sources in agreement)

---
*Architecture research for: client-side static data-exploration SPA (DuckDB-Wasm + Parquet + GraphicWalker on GitHub Pages)*
*Researched: 2026-08-25*
