# Stack Research

**Domain:** Fully static, zero-cost, client-side data-exploration web app (React + Vite, DuckDB-Wasm over Parquet, GraphicWalker visual explorer, deployed to GitHub Pages)
**Researched:** 2026-08-25
**Confidence:** MEDIUM overall (architecture-level findings HIGH; exact package version numbers LOW — see note below)

> **Versioning note:** No Context7/MCP docs server was available in this session; all version numbers below come from live WebSearch/WebFetch against npm/GitHub (classified LOW confidence per the research seam — no curated/verified source cross-checked them). The *architecture and configuration* guidance (bundle selection, COOP/COEP behavior, base-path requirements, deploy pattern) is corroborated across multiple independent sources and is HIGH/MEDIUM confidence. **Before scaffolding, run `npm view <package> version` for each package below to confirm the exact current version** rather than trusting these numbers blindly — this ecosystem (especially Vite/TypeScript/React Router) has moved fast.

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | ^19.x | UI library | Mandated by PROJECT.md. React 19 is current stable; no reason to use an older major for a greenfield project. |
| Vite | ^7.x (verify latest; v8 line exists but pin to latest v7 minor unless v8 is confirmed stable and GraphicWalker/duckdb-wasm compatibility is verified) | Build tool / dev server | Mandated by PROJECT.md. Vite is the standard for static SPA + GitHub Pages deploys: fast HMR, first-class `?url` / `?worker` asset imports needed by DuckDB-Wasm, trivial `base` config for subpath hosting. |
| TypeScript | ^5.7–5.9 (stable "classic" tsc line) | Type safety | Mandated by PROJECT.md. **Do not jump to the newly-shipped TypeScript 7.0 (Go-native rewrite) yet** — see "What NOT to Use". Prefer the last stable 5.x release for this project; it has an unbroken track record with Vite's esbuild/oxc-based type-stripping and with `@types/*` packages GraphicWalker and DuckDB-Wasm ship. |
| Tailwind CSS | ^4.x with `@tailwindcss/vite` | Styling | Mandated by PROJECT.md. Tailwind v4's dedicated Vite plugin (`@tailwindcss/vite`) removes the PostCSS/`tailwind.config.js`/autoprefixer setup entirely — one plugin line + one `@import "tailwindcss";` in the global CSS file. Meaningfully less config than v3 for a project that wants near-zero build boilerplate. |
| `@duckdb/duckdb-wasm` | ^1.29+ (latest 1.3x line; confirm exact via `npm view`) | In-browser SQL engine over Parquet | Mandated by PROJECT.md. This is the only realistic way to run real SQL against a `.parquet` file entirely client-side with no backend. Versions ≥1.29 ship WASM extension support enabled by default and align their version numbers with the DuckDB core release they embed. |
| `@kanaries/graphic-walker` | ^0.5.x (latest stable, e.g. 0.5.2 — avoid the `0.5.0-alpha.x` pre-releases; check `npm view @kanaries/graphic-walker dist-tags`) | Visual/drag-and-drop data explorer | Mandated by PROJECT.md. This is the only maintained open-source "Tableau-in-a-React-component" library; it embeds directly as `<GraphicWalker />`, needs no server, and ships its own client-side computation engine so it works standalone without wiring a custom `computation` callback for datasets this size. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `apache-arrow` | Match the version DuckDB-Wasm depends on internally (check `@duckdb/duckdb-wasm`'s `package.json` peer/dependency version — mismatches cause silent Arrow schema/vector errors) | Reading the Arrow-format result of a DuckDB-Wasm query | Only needed directly if you convert query results manually (e.g., `IpcResultStreamIterator` → JS objects) instead of using `toArray()`/`.get(i)` helpers already exposed on the DuckDB-Wasm connection's result object. Pin explicitly in `package.json` rather than relying on the transitive version to avoid duplicate-Arrow-in-bundle issues. |
| `react-router-dom` (or `react-router` v7, used in **declarative mode only**) | ^7.x | Routing: `/` (index) and `/enquesta/:id` (survey view) | Needed because PROJECT.md specifies two distinct pages. **Use plain `<BrowserRouter>` declarative mode** — do NOT adopt React Router v7's "framework mode" (loaders/actions/SSR) or its Vite plugin; this app has no server, and framework mode assumes one. Alternative: `<HashRouter>` to sidestep GitHub Pages' lack of SPA deep-link support entirely (see Architecture note below). |
| `lucide-react` | ^0.4xx+ / current major (verify — package has had a major version jump; check `npm view lucide-react version`) | Icon set (back arrows, chart-type icons, upload/download icons on the index/explore pages) | Tree-shakeable, no icon-font requests, matches Tailwind's utility-first aesthetic. Use for the small amount of chrome UI around GraphicWalker (its own toolbar ships its own icons). |
| `@kanaries/gw-dsl-parser` | Match `@kanaries/graphic-walker`'s expected version (see its `peerDependencies`) | Converts GraphicWalker's internal query DSL to SQL | **Only install if you implement the custom `computation` prop** to route GraphicWalker's queries through DuckDB-Wasm live (advanced/optional path — see Architecture Patterns below). Not needed for the recommended MVP integration (materialize once, pass as `dataSource`/`rawFields`). |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `@vitejs/plugin-react` | Vite's official React plugin (Fast Refresh, JSX transform) | Standard, near-zero config. |
| ESLint + `typescript-eslint` | Linting | Use the flat-config (`eslint.config.js`) setup that `npm create vite@latest -- --template react-ts` now scaffolds by default; add the `react-hooks` and `react-refresh` plugin presets it ships with. |
| `vite-plugin-static-copy` (optional) | Copy `public/data/*.parquet` / `*.json` verbatim into `dist/` if you outgrow Vite's default `public/` passthrough | Vite already copies everything under `public/` to `dist/` unmodified — you likely don't need this plugin unless the data pipeline moves files from elsewhere at build time. |
| GitHub Actions: `actions/checkout`, `actions/setup-node`, `actions/configure-pages`, `actions/upload-pages-artifact`, `actions/deploy-pages` | CI/CD deploy to GitHub Pages | This is the current GitHub-native deploy pattern (Pages "Source: GitHub Actions", not a `gh-pages` branch + third-party action). Requires workflow `permissions: pages: write, id-token: write` and, in the repo's Settings → Pages, "Source" set to "GitHub Actions". No `gh-pages` branch, no `JamesIves/github-pages-deploy-action` needed. |

## Installation

```bash
# Scaffold (Vite's official React + TS template)
npm create vite@latest enquestes -- --template react-ts
cd enquestes

# Styling
npm install tailwindcss @tailwindcss/vite

# Data engine + visual explorer (the two mandated libraries)
npm install @duckdb/duckdb-wasm @kanaries/graphic-walker apache-arrow

# Routing + icons
npm install react-router-dom lucide-react

# Verify exact current versions before/after install:
npm view @duckdb/duckdb-wasm version
npm view @kanaries/graphic-walker version
npm view vite version
npm view typescript version
```

```bash
# Dev dependencies (most are already in the react-ts template)
npm install -D typescript @vitejs/plugin-react
```

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|--------------------------|
| `@duckdb/duckdb-wasm` | `sql.js` (SQLite-Wasm) | Only if the source data were already SQLite, or you needed write support. SQLite-Wasm has no native Parquet reader and no columnar analytical engine — you'd have to convert Parquet → SQLite ahead of time, which defeats the "query Parquet directly" requirement. Not viable here. |
| `@duckdb/duckdb-wasm` | Apache Arrow + Arquero/`arrow-js` for pure in-memory filtering (no SQL engine) | Only if you didn't need arbitrary SQL, just filtering/grouping in JS. PROJECT.md explicitly wants "consultes SQL" — DuckDB-Wasm is the right call. |
| `@kanaries/graphic-walker` | Observable Plot / Vega-Lite + hand-built controls | Only if you wanted a *curated* fixed set of charts instead of a free drag-and-drop explorer. PROJECT.md explicitly wants a Tableau/Looker-style free explorer — GraphicWalker is purpose-built for exactly this and hand-building the equivalent UI would be a multi-week project on its own. |
| `<BrowserRouter>` (declarative React Router) | `<HashRouter>` | Use `HashRouter` if you want to **completely avoid** the GitHub Pages SPA-deep-link 404 problem (URLs become `.../enquestes/#/enquesta/123`, which GitHub Pages serves correctly with zero extra config because there's no path segment to 404 on). Recommended trade-off: slightly uglier URLs vs. zero routing edge cases. If you want clean URLs, use `BrowserRouter` + the `404.html` redirect trick (see Pitfalls). |
| GitHub Actions native Pages deploy (`actions/deploy-pages`) | `gh-pages` npm package pushing to a `gh-pages` branch | Only if you need to keep supporting an older repo where Pages "Source" is still set to "Deploy from a branch". For a new repo, the Actions-native flow is simpler (no extra branch, no extra npm devDependency) and is what GitHub now scaffolds by default when you enable Pages. |
| TypeScript 5.x (classic tsc) | TypeScript 7.0 (new Go-native compiler) | Only once the ecosystem (Vite plugin type-checking integrations, `@types/*` packages, editor tooling) has fully caught up. It's very new; for a project whose main risk should be DuckDB-Wasm/GraphicWalker integration quirks — not compiler-toolchain churn — stay on the well-trodden 5.x line. Revisit at the next milestone. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|--------------|
| The multi-threaded / pthreads DuckDB-Wasm bundle forced via manual bundle selection | It requires `crossOriginIsolated === true`, which requires `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp` response headers. **GitHub Pages cannot set custom response headers** (confirmed via the long-standing, still-open `github/community` discussion #13309) — there is no config file, no `_headers` equivalent (that's a Netlify/Cloudflare Pages feature), nothing. Forcing the threaded bundle on GitHub Pages will simply fail to instantiate. | Let `duckdb.selectBundle(bundles)` auto-select (do not hardcode the threaded bundle). It will automatically fall back to the single-threaded `eh` bundle, which is fully capable of running SQL over Parquet — just without worker-parallelism inside a single query. For single-file, survey-sized datasets this is not a meaningful performance loss. |
| `coi-serviceworker` (client-side service-worker COOP/COEP shim) to force cross-origin isolation on GitHub Pages | It's a well-known workaround, but it's fragile (breaks on some browsers/extensions, adds a service-worker layer purely to fake headers, complicates caching/debugging) for a $0 personal project that doesn't need multi-threaded query speed. | Don't cross-origin-isolate at all. Accept the `eh` bundle. If query latency ever becomes a real problem, that's a signal to pre-aggregate more in the Python conversion script, not to fight GitHub Pages' header limitations. |
| `gh-pages` npm package + a `gh-pages` branch | Legacy pattern; extra branch, extra dependency, less integrated with GitHub's current "Pages via Actions" model, and slightly harder to reason about (build artifacts committed to git history on that branch). | `actions/upload-pages-artifact` + `actions/deploy-pages` with Pages "Source: GitHub Actions". |
| React Router v7 "framework mode" / its Vite plugin (`@react-router/dev`) | Framework mode assumes a server runtime for loaders/actions/SSR (even Remix's "SPA mode" adds build complexity this project doesn't need). This project is 100% static with two simple client-rendered routes. | React Router v7 in plain declarative mode (`react-router-dom`'s classic `<BrowserRouter>`/`<Routes>`/`<Route>` API), or `HashRouter` if you want to skip the 404-redirect trick entirely. |
| Fetching multi-MB `.parquet` files via `fetch()` then handing raw bytes to DuckDB-Wasm without registering them as a virtual file (`registerFileBuffer`) or using DuckDB-Wasm's HTTPFS/range-request reader | Loses DuckDB-Wasm's ability to do partial/range reads (important once survey Parquet files grow), and is easy to get wrong (buffering entire files in JS memory unnecessarily). | Use `db.registerFileURL(name, url, DuckDBDataProtocol.HTTP, false)` (or the bundled `duckdb-wasm` HTTP/OPFS helpers) so DuckDB-Wasm manages fetching/range-reads itself, then `SELECT * FROM read_parquet('name')`. |
| TypeScript 7.0 as the primary compiler for this milestone | Just-released Go-native rewrite (per search results, hit stable ~mid-2026). Real, but brand new; third-party tool compatibility (editor plugins, some `ts-*` build tools) is still catching up industry-wide as of this research date. Not worth the risk on a project whose hard problems are elsewhere. | TypeScript ^5.7–5.9 stable line; revisit TS7 adoption at the next milestone once ecosystem support has matured. |

## Stack Patterns by Variant

**If you want clean, shareable URLs (`/enquesta/abc123`) without a 404 flash:**
- Use `BrowserRouter` + a `404.html` in `public/` that redirects to `index.html` while preserving the path (the well-known "spa-github-pages" pattern), and add matching restoration logic in your root `index.html`/entry script.
- Because: GitHub Pages has no server-side rewrite rules, so any direct load of `/enquestes/enquesta/abc123` (refresh, shared link, bookmark) 404s unless you intercept it client-side.

**If you'd rather avoid routing edge cases entirely (simplicity over pretty URLs):**
- Use `HashRouter` (`/enquestes/#/enquesta/abc123`).
- Because: hash fragments are never sent to the server, so GitHub Pages always serves `index.html` regardless of the "route," with zero extra configuration.

**If survey datasets stay small (single-digit thousands of rows, which is typical for a survey app):**
- Query once with DuckDB-Wasm (`SELECT * FROM read_parquet(...)`), materialize the full result as `dataSource: IRow[]` + a derived `rawFields: IMutField[]`, and pass both directly to `<GraphicWalker dataSource={...} rawFields={...} />` with **no custom `computation` prop**.
- Because: GraphicWalker's default client-side computation (its own in-browser engine) is simpler to wire, has no extra dependency (`@kanaries/gw-dsl-parser`) or DSL-to-SQL translation layer to maintain, and is plenty fast at this scale.

**If a future survey dataset grows large enough that materializing the full table in JS memory becomes a problem:**
- Wire GraphicWalker's `computation` prop to DuckDB-Wasm directly, following the official Kanaries pattern (`@kanaries/gw-dsl-parser` translates GraphicWalker's query payload → SQL → DuckDB-Wasm executes → Arrow result converted back to `IRow[]`), so every chart interaction runs a fresh, filtered/aggregated SQL query instead of re-scanning an in-memory JS array.
- Because: this defers the cost to only-when-needed and keeps the MVP integration (above) simple.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|------------------|-------|
| `@duckdb/duckdb-wasm` | `apache-arrow` (pin to the exact version DuckDB-Wasm's own `package.json` declares) | DuckDB-Wasm returns Arrow `Table`/`RecordBatch` objects; a mismatched `apache-arrow` version in your own `package.json` can produce duplicate class instances (`instanceof` checks failing) or subtly incompatible vector readers. Check `node_modules/@duckdb/duckdb-wasm/package.json` after install and mirror that version explicitly. |
| `@kanaries/graphic-walker` | React 18/19 (check its `peerDependencies` range at install time) | GraphicWalker's `package.json` declares a React peer range; confirm it explicitly supports React 19 before pinning React 19 — if it lags, pin React to the latest 18.x instead rather than fighting a peer-dependency warning in a greenfield build. |
| Tailwind v4 (`@tailwindcss/vite`) | Vite ^5.4+ / ^6.x / ^7.x | Tailwind v4's Vite plugin requires a reasonably modern Vite; any current Vite major satisfies this, but don't pair it with a Vite version older than ~5.4. |
| React Router v7 (declarative mode) | React 18/19 | No framework-mode server assumptions apply when used declaratively; safe alongside a plain Vite SPA build. |
| GitHub Actions `actions/deploy-pages` | Repo Settings → Pages → Source = "GitHub Actions" | If "Source" is left on "Deploy from a branch," the Actions-based deploy step will not publish — this is a one-time manual repo setting, not something the workflow YAML can set for you. |

## Sources

- WebSearch: npm package pages / registry data for `@duckdb/duckdb-wasm`, `@kanaries/graphic-walker`, `vite`, `typescript`, `react`, `lucide-react`, `react-router` — confidence LOW (unverified single-pass search summaries; re-check via `npm view` before pinning).
- WebFetch: `duckdb.org/docs/current/clients/wasm/instantiation.html` and `.../deploying_duckdb_wasm` — confirms `mvp`/`eh`/threaded bundle variants, `selectBundle()` auto-detection, and Vite `?url` import pattern for wasm assets. Confidence MEDIUM (official docs, but page content only partially retrieved by the fetch summarizer).
- WebSearch: `github/community` discussion #13309 ("Allow setting COOP and COEP headers in GitHub Pages") — confirms GitHub Pages has no mechanism for custom response headers as of this research date. Confidence MEDIUM (official GitHub product feedback forum, cross-referenced by multiple independent secondary sources in the same search).
- WebFetch: `platform.kanaries.net/graphic-walker/client-side/use-duckdb-wasm-as-computation` — official Kanaries documentation on wiring DuckDB-Wasm as GraphicWalker's `computation` engine (`@kanaries/gw-dsl-parser`, `parser_dsl_with_table()`, Arrow→JSON conversion). Confidence MEDIUM (official vendor docs, retrieved via fetch summarizer rather than direct file read).
- WebSearch: multiple independent Vite+React Router+GitHub Pages deployment tutorials — corroborate `base` path requirement, `basename` requirement, and the `404.html` SPA-redirect workaround. Confidence MEDIUM (pattern is consistent across many independent sources, though individual tutorials are not authoritative).
- WebSearch: Tailwind CSS official docs (`tailwindcss.com/docs/installation/using-vite`) surfaced in results — confirms `@tailwindcss/vite` plugin + single `@import "tailwindcss";` setup for v4. Confidence MEDIUM-HIGH (matches official docs URL directly).

---
*Stack research for: static client-side data-exploration app (React/Vite/DuckDB-Wasm/GraphicWalker/GitHub Pages)*
*Researched: 2026-08-25*
