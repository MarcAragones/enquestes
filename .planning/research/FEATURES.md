# Feature Research

**Domain:** Public-facing, self-serve survey/data exploration tool (static, zero-backend, zero-auth)
**Researched:** 2026-08-25
**Confidence:** HIGH (GraphicWalker capabilities, DuckDB-Wasm loading model), MEDIUM (feature prioritization judgment calls specific to a solo public survey site — not directly sourced, reasoned from Tableau Public / Looker Studio / PyGWalker analogues)

## Feature Landscape

Two distinct surfaces in this product, each with its own feature set:

- **A. Survey listing/landing page (`/`)** — analogous to a Tableau Public profile gallery or a Looker Studio report gallery: a catalog of available datasets with enough summary info to decide "is this interesting?" before committing to load the full explorer.
- **B. Per-survey chart explorer (`/enquesta/:id`)** — analogous to embedding Tableau Desktop's drag-and-drop canvas or PyGWalker's Jupyter widget directly on the web: full self-serve pivot/chart building over one dataset.

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels broken or untrustworthy, even though this is a hobby project.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **A1. Survey card grid with title, date, description, N respondents** | Every dataset gallery (Tableau Public, Looker Studio, Kaggle datasets) leads with a scannable list, not a raw file browser | LOW | Driven by `enquestes_index.json`; pure static render, no DuckDB needed on this page |
| **A2. Loading/empty/error states for the index page** | `enquestes_index.json` fetch can fail (bad deploy, wrong `base` path) or be empty (new repo) — users need to know if it's broken vs genuinely empty | LOW | Simple fetch + skeleton/error message; cheap to build, expensive to skip (silent blank page reads as broken) |
| **A3. Per-survey KPI summary before deep-dive** | Users expect a "preview" before committing to load a heavier interactive view — same pattern as Tableau Public viz thumbnails/Looker Studio report previews | LOW–MEDIUM | Read from `[id]_meta.json` (precomputed at conversion time, not queried live) — keeps the landing page fast (no DuckDB init needed just to browse) |
| **B1. Loading indicator while DuckDB-Wasm initializes + Parquet downloads/parses** | DuckDB-Wasm + wasm bootstrap is ~3+ MB and Parquet fetch/parse is not instant; a blank screen during this reads as a hang | LOW–MEDIUM | This is the single most important state to design well — see Pitfalls; two-stage progress (engine init, then data load) is worth the small extra complexity |
| **B2. Error/fallback state if Parquet fails to load or query fails** | Static hosting + no backend means failures are silent by default (404 on wrong path, CORS on GH Pages, malformed Parquet) — must surface a clear message, not a frozen UI | LOW–MEDIUM | Wrap DuckDB init and query calls; distinguish "file not found" vs "engine failed to load" vs "query error" for debuggability |
| **B3. Drag-and-drop field-to-encoding chart building (X/Y/Color/Size/Filter)** | This *is* the core value proposition (per PROJECT.md); GraphicWalker provides this natively via a grammar-of-graphics UI with rows/columns/color/size/shape/opacity channels | LOW (delegated to library) | GraphicWalker is a drop-in React component — the work is wiring DuckDB-Wasm query results into it, not building the drag-and-drop UI itself |
| **B4. Multiple chart type support (bar, line, area, scatter, box plot, heatmap)** | Survey data (categorical + numeric + time) needs more than one chart type to be useful — a bar-chart-only tool feels crippled | LOW (delegated to library) | Included out of the box in GraphicWalker; no extra work beyond exposing the field list correctly (dimension vs measure typing) |
| **B5. Field/column list with correct type inference (dimension vs measure)** | If a Likert-scale numeric field gets treated as a continuous measure instead of an ordinal dimension, every default chart looks wrong | MEDIUM | This is a data-prep concern (Python conversion script) as much as a UI concern — get types right in `[id]_meta.json`/Parquet schema, since GraphicWalker infers from the field metadata passed in |
| **B6. Responsive/usable layout on typical screen sizes** | Public link-shared tool — some visitors will open on tablets or narrow laptop windows; a broken layout at non-desktop widths loses casual visitors immediately | LOW–MEDIUM | GraphicWalker's own canvas is desktop-oriented (drag-and-drop is awkward on touch); table-stakes bar is "doesn't visually break," not "full mobile drag-and-drop support" (see Anti-Features) |
| **B7. Back/breadcrumb navigation from explorer to survey list** | Users landing on `/enquesta/:id` via a shared link need a way back to discover other surveys — otherwise it's a dead-end page | LOW | Simple router link/header; trivial but frequently forgotten |
| **B8. Correct GitHub Pages SPA routing (deep links to `/enquesta/:id` don't 404)** | GitHub Pages serves static files with no server-side rewrites; a shared link to a specific survey must not 404 on refresh | LOW–MEDIUM | Well-known GH Pages + client-side-router pitfall (404.html redirect trick or hash routing) — table stakes because a public sharable tool that breaks on refresh looks broken, not "static site technicality" |

### Differentiators (Competitive Advantage)

Features that set the product apart from a generic dashboard, or that most comparable public tools don't bother with because they have server infra to fall back on.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **True zero-backend, ultra-fast SQL exploration via DuckDB-Wasm over Parquet** | No server round-trip after initial load — filtering/aggregating tens of thousands of survey responses feels instant (in-browser SQL, columnar Parquet compression). This is the whole pitch vs. a static-chart-image gallery (Tableau Public without "download the workbook") | MEDIUM (already scoped in PROJECT.md) | Differentiator vs. Looker Studio (needs a live backend/connector) and vs. static site generators that pre-render fixed charts |
| **Chart spec export/save (PNG/SVG, or GraphicWalker's JSON spec)** | Lets a visitor who finds an interesting cross-tab share or embed *their own* view, not just the default chart — mirrors PyGWalker's "Save as Image / Export to Code" | LOW (built into GraphicWalker) | Essentially free since GraphicWalker ships this; worth explicitly enabling/surfacing in the UI rather than assuming it's on |
| **Shareable chart state via URL (encode GraphicWalker spec in query string/hash)** | Turns "I found something interesting" into a link a visitor can send someone else, without any backend — a meaningful step up from Tableau Public (which needs a hosted workbook) | MEDIUM–HIGH | Not in current PROJECT.md scope; flag as a strong v1.x candidate once core explorer works, since GraphicWalker's spec is already JSON-serializable |
| **Data dictionary / field descriptions inline in the explorer** | Raw survey exports have cryptic column names (`q7_2`, `Q12_other`) — a sidebar mapping field → human-readable question text turns "explore raw data" into "explore *this survey's* data" | LOW–MEDIUM | Feeds from `[id]_meta.json`; genuinely differentiates from a bare PyGWalker/DuckDB demo, and is cheap since the conversion script already touches column names |
| **Precomputed KPI cards on the listing page (from `[id]_meta.json`, not live query)** | Gives a "trustworthy at a glance" summary (N, date range, top-line stat) without paying the DuckDB-Wasm/Parquet load cost just to browse — most public BI galleries either show nothing (Tableau thumbnails are static images) or force a full dashboard load | LOW | Already scoped in PROJECT.md; differentiator because it's fast *and* informative, avoiding the common anti-pattern of a heavy dashboard as the landing experience |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but conflict with the zero-backend, zero-auth, static-hosting constraints, or add disproportionate complexity for a hobby public tool.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|------------------|-------------|
| **User accounts / saved views / "my dashboards"** | Common in Tableau Public, Looker Studio — feels like a natural next step | Requires a backend + auth + database, directly violating the $0/no-backend/no-auth constraint from PROJECT.md | Shareable URL-encoded chart state (see Differentiators) gives most of the value without persistence infra |
| **Live/collaborative editing of a chart (multiple viewers see the same state)** | "Real-time dashboards" feel modern | Needs a server (WebSocket/pub-sub) — impossible on static GitHub Pages | Each visitor gets an independent, local, disposable exploration session; sharing happens via export/URL, not live sync |
| **Runtime CSV/Excel upload for arbitrary user data** | "Let visitors explore *their own* data too" seems generous and low-effort since DuckDB-Wasm can technically ingest CSV client-side | PROJECT.md explicitly scopes conversion to an offline Python step; runtime ingestion of arbitrary uploads opens type-inference bugs, large-file perf issues, and scope creep away from "explore *these* surveys" | Keep ingestion offline (CSV/Excel → Parquet script); if ad-hoc upload is wanted later, it's a clearly separate feature, not part of the survey explorer |
| **Server-side aggregation / pagination for very large datasets** | Feels like the "correct" scalable architecture | No server exists, and DuckDB-Wasm + Parquet already handles reasonably large survey-sized data (tens of thousands of rows, not millions) entirely client-side — building server-side logic contradicts the core architecture | Rely on DuckDB-Wasm's in-browser columnar engine; if a specific survey's Parquet is too large for comfortable in-browser use, address it at the conversion/aggregation step (pre-aggregate before publishing), not by adding infrastructure |
| **Full mobile touch-optimized drag-and-drop chart builder** | "Should work great on phones" sounds like baseline UX quality | GraphicWalker's canvas is inherently a desktop-style drag-and-drop grammar-of-graphics UI; investing in bespoke touch reflow is high effort for a niche of the public audience and not what the library is built for | Table-stakes bar is "doesn't visually break" on narrow screens (B6); accept that deep exploration is a desktop-primary experience, same as Tableau Public itself |
| **Search/filter across many surveys, tagging, categories** | Feels necessary "at scale" like a real data catalog | For a personal project publishing a handful of surveys, this is premature — a simple grid is more than sufficient and a search bar over 3-10 cards adds UI complexity with no user benefit | Revisit only if the survey count grows into the dozens; note as a v2+ trigger, not v1 scope |
| **Custom analytics/telemetry on visitor chart interactions** | "Understand what visitors explore" seems useful for a data project | Needs either a backend or a third-party tracking script — the former violates the no-backend constraint, the latter raises privacy/consent questions for a public tool with no stated audience consent flow, and is scope creep beyond PROJECT.md | Skip entirely for v1; if desired later, use a privacy-respecting, static-friendly option (e.g., GitHub Pages' own basic traffic insights) rather than building custom tracking |

## Feature Dependencies

```
A1. Survey card grid
    └──requires──> enquestes_index.json exists and is well-formed

A3. Per-survey KPI summary (landing)
    └──requires──> [id]_meta.json precomputed at conversion time
    └──enhances──> A1 (turns a bare list into a decision-aid gallery)

B1. Loading indicator (DuckDB init + Parquet fetch)
    └──requires──> DuckDB-Wasm service singleton (src/services/duckdb.ts, per PROJECT.md)

B3. Drag-and-drop chart building
    └──requires──> B1 (data must be loaded/queryable before GraphicWalker has anything to encode)
    └──requires──> B5 (correct dimension/measure typing, or default charts look wrong)

B4. Multiple chart types
    └──requires──> B3 (chart types are selected within the same GraphicWalker canvas)

B5. Correct field type inference
    └──requires──> conversion script producing typed metadata ([id]_meta.json / Parquet schema)

B2. Error/fallback state
    └──enhances──> B1 (two sides of the same async-loading UX: happy path vs failure path)

B8. SPA deep-link routing on GH Pages
    └──requires──> GitHub Actions deploy workflow configured with correct `base` path (per PROJECT.md)
    └──enhances──> B7 (both are about not stranding visitors who arrive via a link)

Differentiator: Data dictionary in explorer
    └──requires──> B5 (same metadata pipeline: conversion script must capture field labels)

Differentiator: Shareable chart-state URL
    └──requires──> B3 (nothing to encode/share until the drag-and-drop canvas produces a spec)
    └──conflicts with──> nothing architecturally, but is meaningfully more effort than B1-B8 — treat as v1.x, not v1
```

### Dependency Notes

- **B3 (drag-and-drop) requires B1 (loading state) and B5 (field typing):** GraphicWalker can't render anything meaningful until data has finished loading, and its default single-click chart suggestions depend on dimension/measure inference being correct — get this wrong in the conversion script and every "quick chart" a visitor tries first will look broken, undermining trust in the whole tool immediately.
- **A3 (KPI summary) enhances A1 (card grid) but does not require B1-B8:** Critically, the landing page's KPI preview reads from a precomputed `[id]_meta.json`, not from a live DuckDB query — this keeps the landing page fast and DuckDB-Wasm-free, so a visitor can browse the whole catalog without paying any Wasm/Parquet load cost until they actually open a specific survey.
- **B5 (field typing) requires the conversion script, not the React app:** This is the most consequential hidden dependency — feature quality in the explorer (B3, B4, and the data-dictionary differentiator) is bottlenecked by decisions made in the offline Python conversion step, which is easy to under-invest in since it's "just tooling."
- **Shareable chart-state URL conflicts with nothing but is out of PROJECT.md's current Active scope:** Flagging it as a dependency-satisfied, ready-to-build v1.x item once B3 ships, since it reuses GraphicWalker's own JSON spec rather than needing new infrastructure.

## MVP Definition

### Launch With (v1)

Minimum viable product — what's needed to validate the concept (aligned to PROJECT.md's Active requirements).

- [ ] A1 + A2 — Survey card grid with loading/error states — without this the landing page has nothing to click into
- [ ] A3 — Per-survey KPI summary from `[id]_meta.json` — the "why should I click Explore" hook
- [ ] B1 + B2 — DuckDB-Wasm loading and error states — non-negotiable given ~3MB+ engine bootstrap; silent failure here kills trust in a public zero-backend tool
- [ ] B3 + B4 + B5 — Core GraphicWalker drag-and-drop explorer with correct field typing — this is the stated Core Value in PROJECT.md
- [ ] B7 + B8 — Back navigation and working GH Pages deep links — without these, sharing a survey link (the natural distribution mechanism for a public tool) breaks
- [ ] B6 — Non-broken responsive layout (not full mobile optimization, just "doesn't visually collapse")

### Add After Validation (v1.x)

Features to add once core is working and real visitors have used it.

- [ ] Data dictionary / field descriptions inline in explorer — trigger: once conversion script pipeline is stable and you have more than one non-trivial survey published
- [ ] Shareable chart-state URL — trigger: once you or a visitor wants to point someone at a *specific* chart rather than the default view
- [ ] Chart export (PNG/SVG) surfaced explicitly in UI — trigger: low effort, can be pulled forward if GraphicWalker's default toolbar already exposes it cleanly

### Future Consideration (v2+)

Features to defer until the survey catalog and audience actually grow.

- [ ] Search/filter/tagging across surveys — defer until survey count exceeds what a single grid page can comfortably show (roughly >12-15 cards)
- [ ] Larger-dataset handling strategies (pre-aggregation guidance, chunked Parquet) — defer until a specific survey's Parquet size becomes a demonstrated loading-time problem, not preemptively

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| A1. Survey card grid | HIGH | LOW | P1 |
| A2. Loading/error states (index) | MEDIUM | LOW | P1 |
| A3. Per-survey KPI summary | HIGH | LOW | P1 |
| B1. DuckDB-Wasm loading indicator | HIGH | LOW–MEDIUM | P1 |
| B2. Query/load error states | HIGH | LOW–MEDIUM | P1 |
| B3. Drag-and-drop chart building | HIGH | LOW (library-delegated) | P1 |
| B4. Multiple chart types | MEDIUM–HIGH | LOW (library-delegated) | P1 |
| B5. Correct field type inference | HIGH | MEDIUM | P1 |
| B6. Responsive/non-broken layout | MEDIUM | LOW–MEDIUM | P1 |
| B7. Back/breadcrumb navigation | MEDIUM | LOW | P1 |
| B8. GH Pages SPA deep-link routing | HIGH | LOW–MEDIUM | P1 |
| Data dictionary in explorer | MEDIUM–HIGH | LOW–MEDIUM | P2 |
| Chart export (PNG/SVG) | MEDIUM | LOW | P2 |
| Shareable chart-state URL | HIGH | MEDIUM–HIGH | P2 |
| Search/filter across surveys | LOW (at current scale) | LOW–MEDIUM | P3 |
| Large-dataset handling strategy | LOW (until proven needed) | MEDIUM–HIGH | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature | Tableau Public | Looker Studio | PyGWalker (Jupyter) | Our Approach |
|---------|-----------------|----------------|----------------------|--------------|
| Landing/gallery page | Static viz thumbnail cards, view/favorite counts, sort by popularity/date | Report list per user/org, no public gallery by default | N/A (single-notebook tool, no gallery concept) | Static card grid from a JSON index + precomputed KPIs; no view counts (no backend to track them) — simpler, but honest about what's feasible at $0 |
| Chart building UI | Full desktop app (Tableau Desktop) publishes to web; web viewer is view-only for most, editing needs desktop | Web-native drag-and-drop over connected data sources (needs live connector/backend) | In-notebook drag-and-drop widget (GraphicWalker embedded), single-user/local | GraphicWalker embedded directly in the public web page — visitors get full drag-and-drop *in the browser*, no desktop app or backend connector needed; closer to PyGWalker's UX than Tableau Public's (which is view-mostly for anonymous visitors) |
| Data engine | Tableau's proprietary in-memory/Hyper engine, server-side | BigQuery/Sheets/connector-backed, server-side | Pandas/DataFrame in Python kernel, local | DuckDB-Wasm + Parquet, fully client-side — no equivalent public competitor runs the query engine *in the visitor's browser* for a public gallery of datasets, which is the genuine differentiator |
| Sharing a specific view | Publish/embed whole workbook; specific view via sheet tabs | Share report link with viewer permissions (needs account/access model) | Export static image or code snippet, not a live shareable link | v1: static default view + export image; v1.x: URL-encoded spec for a specific chart state — no accounts needed either way |
| Field descriptions/data dictionary | Author can add captions/tooltips in Desktop before publishing | Field descriptions supported in Looker's semantic layer | None built-in (raw DataFrame columns) | Sourced from `[id]_meta.json` at conversion time — lightweight equivalent of Tableau's authored captions, without needing a full semantic layer |

## Sources

- [GraphicWalker GitHub — Kanaries/graphic-walker](https://github.com/Kanaries/graphic-walker)
- [GraphicWalker documentation — Kanaries](https://docs.kanaries.net/graphic-walker)
- [GraphicWalker Component API — Kanaries](https://docs.kanaries.net/graphic-walker/api-reference/graphic-walker)
- [High Performance Data Visualization in the Browser with DuckDB and Parquet — Travis Horn](https://travishorn.com/high-performance-data-visualization-in-the-browser-with-duckdb-and-parquet/)
- [duckdb/duckdb-wasm — GitHub](https://github.com/duckdb/duckdb-wasm)
- [Strategies for reducing data transfer from remote parquet — duckdb-wasm Discussion #407](https://github.com/duckdb/duckdb-wasm/discussions/407)
- [A DuckDB-Wasm Web Mapping Experiment with Parquet — Sparkgeo](https://sparkgeo.com/blog/a-duckdb-wasm-web-mapping-experiment-with-parquet/)
- [Navigate Tableau Public: A Comprehensive Guide — Trailhead](https://trailhead.salesforce.com/content/learn/modules/data-storytelling-tableau-public/navigate-tableau-public)
- [7 Stats to Watch on Your Tableau Public Profile — Tableau](https://www.tableau.com/blog/7-stats-watch-your-tableau-public-profile)
- [PyGWalker 0.1.6. Update: Export Visualizations to Code — Kanaries](https://docs.kanaries.net/articles/pygwalker-export-visualization)
- [How to save charts in Jupyter cell and share with others — Kanaries/pygwalker Wiki](https://github.com/Kanaries/pygwalker/wiki/How-to-save-charts-in-juypter-cell-and-share-it-with-others%3F)
- Project context: `.planning/PROJECT.md` (constraints: $0 cost, no backend, no auth, GitHub Pages, DuckDB-Wasm + Parquet + GraphicWalker mandated stack)

---
*Feature research for: public-facing survey data exploration static site*
*Researched: 2026-08-25*
