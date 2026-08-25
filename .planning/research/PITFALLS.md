# Pitfalls Research

**Domain:** Client-only data-exploration SPA (DuckDB-Wasm + Parquet + GraphicWalker) deployed free on GitHub Pages
**Researched:** 2026-08-25
**Confidence:** MEDIUM (web search only — no premium research providers configured for this project; several findings cross-verified against official docs/GitHub discussions, several are single-source community reports)

## Critical Pitfalls

### Pitfall 1: GitHub Pages cannot set COOP/COEP headers — SharedArrayBuffer/threaded DuckDB-Wasm silently fails

**What goes wrong:**
DuckDB-Wasm ships three WebAssembly bundle variants: `mvp` (single-threaded, no special requirements), `eh` (exception handling, single-threaded), and `coi`/`threads` (multi-threaded, requires `SharedArrayBuffer`). The threaded variant only works when the page is "cross-origin isolated," which requires the server to send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` HTTP response headers. GitHub Pages is a static host with **no way to configure custom response headers** — there is no `_headers` file, no server config, nothing. If the app auto-selects (or is hardcoded to) the threaded bundle, `SharedArrayBuffer` will be `undefined` in production even though it worked fine in local dev (Vite's dev server headers can be configured), and DuckDB-Wasm initialization throws or silently degrades.

**Why it happens:**
Developers test locally with Vite dev server (where COOP/COEP can be set in `vite.config.ts`), everything works, and the header requirement is invisible until the first GitHub Pages deploy. `duckdb.selectBundle()` picks the "best" bundle based on browser feature detection, which can pick the threaded bundle in dev (isolated) and silently fail in prod (not isolated).

**How to avoid:**
Default to the `eh`/`mvp` (single-threaded) DuckDB-Wasm bundle for this project — it needs no special headers and is sufficient for single-user, moderate-size Parquet querying in a browser tab. If threading is ever wanted for performance, the only way to get cross-origin isolation on GitHub Pages is a service-worker shim (e.g. `coi-serviceworker`) that intercepts the navigation request and injects the headers client-side (causes one extra reload on first visit) — treat this as a deliberate, tested opt-in, not a default.

**Warning signs:**
Works in `npm run dev` / `vite preview` but query init hangs, throws `SharedArrayBuffer is not defined`, or DuckDB falls back to a degraded mode only after deploying to `github.io`.

**Phase to address:**
DuckDB-Wasm service/singleton setup phase — pin the bundle selection explicitly (don't rely on auto-detection alone) and verify against a deployed GitHub Pages preview, not just local dev, before building features on top of it.

---

### Pitfall 2: DuckDB-Wasm worker/WASM assets get mishandled by Vite's default bundling

**What goes wrong:**
DuckDB-Wasm needs the browser to `new Worker(workerUrl)` and load a `.wasm` binary at runtime. If these are imported normally (`import worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js'`), Vite tries to parse/transform them as JS modules or inlines them as base64, which breaks the worker (wrong MIME type / not a valid script) or produces a URL DuckDB can't resolve, especially after the production `base` path is applied. This is the single most common "it works in dev, breaks in the GitHub Pages build" DuckDB-Wasm issue.

**Why it happens:**
Vite requires the explicit `?url` import suffix (or `new URL(..., import.meta.url)`) to get a static asset URL instead of a bundled module. DuckDB-Wasm's own bundle-selection helpers (`getJsDelivrBundles()` / manual bundle object) assume you hand them resolved URLs, not that the bundler does it for you — and the resolved URL must account for Vite's `base: '/enquestes/'` in production, which is easy to omit if URLs are hardcoded relative to `/`.

**How to avoid:**
Use `?url` imports (or `new URL(...)` pattern) for every worker/wasm asset, verify the resulting URLs in the built `dist/` output (not just dev), and prefer a Blob-URL worker wrapper (instantiate the worker script via `Blob` + `URL.createObjectURL`) to sidestep same-origin worker restrictions entirely. Reference the official Vite-bundled example (`bufferings/vite-react-duckdb-wasm`) as a known-good pattern rather than hand-rolling from the generic docs, which don't cover Vite specifics.

**Warning signs:**
Console errors like "Failed to construct 'Worker'", "unexpected token" when loading a `.wasm` file, or DuckDB init hanging indefinitely — especially only after `vite build && vite preview` (not `vite dev`), and especially only after deploying under the `/enquestes/` sub-path rather than root.

**Phase to address:**
DuckDB-Wasm service/singleton setup phase. Verification step: build and serve the production bundle locally (`vite preview --base=/enquestes/` or equivalent) before ever testing against real GitHub Pages, to catch base-path/asset issues early and cheaply.

---

### Pitfall 3: Parquet HTTP range requests over GitHub Pages are not fully reliable

**What goes wrong:**
DuckDB-Wasm's real power for this project — sub-second SQL queries over a Parquet file without downloading the whole thing — depends on the host correctly serving HTTP `Range` requests (partial content, byte-range reads of Parquet metadata + row groups). GitHub Pages is backed by Fastly and generally supports range requests, but there is a documented history of edge-case bugs: a confirmed GitHub Pages defect (community discussion #178318) served an invalid partial-gzip stream when a client sent `Range` + `Accept-Encoding: gzip` together, breaking Firefox specifically (Chrome/Safari don't request gzip alongside Range, so they were unaffected). It was fixed via a `mime-db` update flagging Parquet as incompressible plus a Firefox-side change, confirmed working by March 2026 — but it illustrates that range-request correctness on GitHub Pages is not a hard guarantee, and duckdb-wasm's own range-support *detection* logic is described by maintainers as "complicated and brittle."

**Why it happens:**
GitHub Pages is a general-purpose static file host, not a data-serving CDN; its compression/range-request interaction is an edge case that isn't heavily tested for binary columnar formats like Parquet.

**How to avoid:**
Test the deployed app in Firefox specifically, not just Chrome, before considering the data-loading path "done." Keep Parquet files reasonably sized (see Pitfall 6) so that even a fallback to full-file download (if range requests silently degrade) is not catastrophic. Don't assume "it worked in Chrome during dev" is sufficient sign-off.

**Warning signs:**
Queries that should be near-instant (filtering, aggregating) instead trigger a full-file download every time (visible in Network tab as one large 200 response instead of many small 206 Partial Content responses), or Firefox-specific decompression/parse errors that don't reproduce in Chromium browsers.

**Phase to address:**
Exploration page (`/enquesta/:id`) phase — include a cross-browser check (at minimum Chrome + Firefox) of actual network behavior (206 vs 200 responses) as part of that phase's verification, not just "the chart renders."

---

### Pitfall 4: Client-side-only GraphicWalker + full raw dataset does not scale past ~100K rows

**What goes wrong:**
GraphicWalker's default integration mode loads the entire dataset into browser memory as JS objects and computes aggregations client-side. Kanaries' own guidance: comfortable under 10K rows, usable to ~100K, and recommends delegating computation externally beyond that (normally "server-side computation" via a `computation` prop) — but this project has **no backend** (explicitly out of scope). If a survey's raw response count and column count grow, naive integration (pass parsed Parquet rows straight into GraphicWalker) will get sluggish or freeze the tab well before "large" by normal data standards.

**Why it happens:**
The natural first implementation is "load Parquet → convert to JS array → hand to `<GraphicWalker data={...} />>`," which is also what most GraphicWalker tutorials show, because it's the simplest path — but it bypasses DuckDB-Wasm entirely for the actual chart computation, wasting the reason DuckDB-Wasm is in the stack.

**How to avoid:**
Use GraphicWalker's documented DuckDB-Wasm-as-computation-engine integration (`@kanaries/gw-dsl-parser` + a custom `computation` implementation that runs SQL through the already-loaded DuckDB-Wasm instance) instead of passing raw JS arrays. This keeps aggregation inside DuckDB (fast, columnar) and only returns small aggregated results to the chart layer — this is the officially documented pattern for exactly this "no backend" scenario, not a workaround.

**Warning signs:**
The exploration page becomes noticeably laggy or the tab freezes momentarily when dragging a field onto a shelf, scaling roughly with row count rather than with the complexity of the chart.

**Phase to address:**
Exploration page (`/enquesta/:id`) phase — this should be a design decision made explicitly up front (DuckDB-as-computation vs. raw-array), not discovered as a performance bug after a real survey with more rows than the mock data is loaded.

---

### Pitfall 5: DuckDB-Wasm has hard in-browser memory ceilings with no graceful spill-to-disk

**What goes wrong:**
Because DuckDB-Wasm runs entirely inside a WebAssembly sandbox in the browser tab, it does not have the same disk-spill safety net as native DuckDB when a query needs more memory than is available. Community reports show out-of-memory failures in the low-millions-of-rows / low-single-digit-GB range, and settings that would let native DuckDB spill to disk (`temp_directory`) have limited or no effect in the WASM/browser environment. A query that would run fine on a laptop with native DuckDB can hard-crash in the browser tab.

**Why it happens:**
Browser sandboxes restrict direct filesystem access; WASMFS-based spill-to-disk is immature/unreliable compared to native OS file I/O.

**How to avoid:**
Keep per-survey Parquet files modest (tens of MB, not hundreds+) and avoid SELECT * over the full dataset into JS — query for aggregates/samples via SQL instead. If a future survey is unusually large, that's a signal to pre-aggregate at conversion time (in the Python script) rather than shipping the full long-format response table.

**Warning signs:**
Browser tab crashes or "Aw, Snap!" / out-of-memory errors specifically on larger surveys, not smaller ones — a scale-dependent failure rather than a code bug.

**Phase to address:**
Python conversion script phase — this is the natural checkpoint to decide row/column limits and whether pre-aggregation is needed before a file ever reaches the browser.

---

### Pitfall 6: Vite `public/` assets are not fingerprinted — stale Parquet/JSON served after data updates

**What goes wrong:**
Files placed in Vite's `public/` folder (where `enquestes_index.json`, `[id]_meta.json`, and `[id]_respostes.parquet` will live, per the project's own file layout) are copied to `dist/` byte-for-byte with their original filenames — Vite does **not** content-hash them the way it hashes JS/CSS bundles. Combined with GitHub Pages' CDN caching (Fastly, roughly 5–10 minute edge cache, plus whatever `Cache-Control` a browser applies), updating a survey's data (re-running the conversion script, re-publishing corrected data) can silently serve the old Parquet/JSON to visitors for a while after deploy, with no cache-busting mechanism built in by default.

**Why it happens:**
This is standard, documented Vite behavior (public assets are "as-is," unlike `src/` imports) — it's easy to overlook because it's invisible until you update data and the site doesn't reflect it.

**How to avoid:**
Either (a) accept the short caching window as fine for this project's update cadence, or (b) add a version/hash suffix to filenames referenced from `enquestes_index.json` (e.g. `[id]_respostes.<contenthash>.parquet`) so updated data gets a new URL rather than overwriting an old cached one. Document the expected propagation delay so it isn't mistaken for a deploy failure.

**Warning signs:**
"I updated the data and pushed, but the site still shows the old numbers" reports, especially shortly (minutes) after a deploy, self-resolving after a wait or hard refresh.

**Phase to address:**
Python conversion script / data-publishing phase — decide the file-naming/versioning convention before real data updates happen repeatedly, since retrofitting a naming scheme after `enquestes_index.json` references are established is extra churn.

---

### Pitfall 7: Git LFS is incompatible with GitHub Pages by default — don't reach for it blindly if Parquet files grow

**What goes wrong:**
The standard advice for "large files in a git repo" is Git LFS, but GitHub Pages does **not** resolve LFS pointers when serving a branch directly — it serves the small text pointer file instead of the real binary, so a naively LFS-tracked Parquet file would 404-equivalent (serve garbage) for site visitors. This is a well-known GitHub Pages limitation, not a project-specific bug.

**Why it happens:**
LFS integration differs depending on deploy mechanism: GitHub Pages' native "serve from branch" mode doesn't resolve LFS objects, but a GitHub Actions-based deploy (which this project already plans to use) *can* work around it if the checkout step is configured with `lfs: true`, since the Action has real file content to build/copy into the deploy artifact.

**How to avoid:**
For the current scope (a handful of surveys, files in the tens of MB), skip LFS entirely — commit Parquet files directly. If files later approach GitHub's soft/hard size limits (~50MB warning, 100MB hard block on plain git), reassess with `actions/checkout` `lfs: true` explicitly verified end-to-end (not assumed), rather than defaulting to LFS and discovering the pointer-file problem after deploy.

**Warning signs:**
A deployed Parquet file downloads as a tiny few-hundred-byte text file starting with `version https://git-lfs.github.com/...` instead of binary Parquet data — DuckDB-Wasm will fail to parse it as Parquet with a cryptic error.

**Phase to address:**
GitHub Actions deploy workflow phase — note as a documented constraint/decision rather than something to hit by surprise; also relevant to the Python conversion script phase (keep output files under safe git thresholds).

---

### Pitfall 8: "Non-sensitive" survey data can still be re-identifying, especially with small samples

**What goes wrong:**
The project's own constraint correctly excludes direct identifiers (names, emails), but removing only direct identifiers is a known-insufficient anonymization strategy. Quasi-identifiers — age, gender, free-text comments, precise timestamps, department/location, or any combination of a few categorical fields — can re-identify individuals when the respondent pool is small or known (e.g., a survey of a specific team, class, or community). The canonical example is the Netflix Prize dataset, de-anonymized via cross-referencing supposedly-anonymous ratings with public IMDb data; more generally, gender + birthdate + zip code alone uniquely identifies a majority of a population.

**Why it happens:**
"We removed the name/email column" feels sufficient but ignores that combinations of seemingly-innocuous fields, plus small/known respondent populations, can be enough to single someone out — especially once the raw Parquet file is fully public and downloadable (per the project's own context: `public/data/` is public and downloadable by anyone).

**How to avoid:**
Before publishing any real survey's Parquet file, review it specifically for: free-text fields (highest risk — often contain identifying detail unintentionally), rare combinations of categorical answers in a small sample, precise timestamps that could correlate to a known event/person, and any field that's a near-unique key even if not a "name." Consider coarsening (age → age bracket, exact date → month) rather than dropping fields outright when the field has analytical value. This is a manual review step, not something automatable by the conversion script alone.

**Warning signs:**
A survey with a small N (tens to low hundreds of respondents) and several demographic/categorical columns — the smaller and more "known" the population, the higher the risk regardless of how the data looks on casual inspection.

**Phase to address:**
Python conversion script phase (build the check into the CSV/Excel → Parquet conversion workflow as an explicit manual/checklist step) and again as a pre-publish gate before any real survey (not the mock data) goes live.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|-----------------|------------------|
| Pass raw JS arrays into GraphicWalker instead of wiring DuckDB-Wasm as its computation engine | Faster to get a first chart rendering | Breaks down once a real survey exceeds ~100K rows; requires a rewrite of the data-loading path later | Only for the initial mock-data proof of concept; must be replaced before real data ships |
| Hardcode Vite `base: '/enquestes/'` instead of deriving it from an env var / package.json | One less config indirection | Breaks silently if the repo is ever renamed or forked; every asset/router path needs manual updates | Acceptable for a personal project that won't be renamed, but document the coupling clearly |
| Skip cross-browser (Firefox) testing of the data-loading path | Saves testing time during early development | Firefox-specific range-request/decompression issues (see Pitfall 3) go unnoticed until a real user reports a broken page | Never acceptable right before a real-data launch; fine to defer during early mock-data iteration |
| Ship the full raw response table instead of pre-aggregating in the conversion script | Simpler script, more flexible exploration | Larger file size, higher OOM risk, slower first load, worse mobile experience | Acceptable for small/medium surveys; revisit if any survey grows large or is filled with free text |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| DuckDB-Wasm + Vite | Importing worker/wasm files as normal ES modules, letting Vite inline/transform them | Use `?url` imports (or `new URL(..., import.meta.url)`) for every worker/wasm asset; verify in the built `dist/` output, not just dev |
| DuckDB-Wasm + GitHub Pages | Auto-selecting the threaded (`coi`) bundle via `selectBundle()` and assuming it "just works" like it did in dev | Explicitly pin the single-threaded `eh`/`mvp` bundle unless cross-origin isolation via a service-worker shim is deliberately implemented and tested on the real deployed site |
| GraphicWalker + DuckDB-Wasm | Treating GraphicWalker as a standalone chart library fed a plain JS array, ignoring DuckDB entirely for computation | Use the official `@kanaries/gw-dsl-parser` + custom `computation` pattern so GraphicWalker queries run as SQL through the existing DuckDB-Wasm instance |
| GraphicWalker + Arrow/DuckDB result types | Passing Arrow `BigInt` values (from DuckDB's integer columns) straight into GraphicWalker/JS, causing precision loss or crashes | Convert `BigInt` results to strings/numbers explicitly (documented `bigNumToString`-style transform) before handing data to GraphicWalker |
| Tailwind CSS + GraphicWalker's internal component styles | Tailwind's Preflight CSS reset overriding GraphicWalker's (Ant Design-based) internal component styling, causing broken-looking buttons/menus/popups inside the GraphicWalker panel | Scope Tailwind's Preflight away from the GraphicWalker container (e.g. `tailwindcss-scoped-preflight`), or verify visually early rather than assuming Tailwind + a third-party component library "just compose" |
| react-router-dom + GitHub Pages sub-path deploy | Setting up routes/links assuming the app is served from `/`, when it's actually served from `/enquestes/` | Set `basename="/enquestes"` (or read from Vite's `import.meta.env.BASE_URL`) on the router, and use `<Link>` everywhere instead of raw `<a href>` for internal navigation |
| GitHub Actions deploy | Deploying via the classic `gh-pages` branch + `git push` approach with default settings, forgetting the SPA `404.html` fallback copy step | Use the official `actions/deploy-pages` GitHub Actions flow (or ensure the `404.html` = `index.html` copy step runs post-build) so deep-linked/refreshed routes don't 404 |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Loading the entire Parquet file into a JS array before charting | Slow initial page load; UI freeze proportional to row count | Query aggregates via SQL through DuckDB-Wasm; only materialize small result sets into JS | Noticeable above tens of thousands of rows, severe above ~100K |
| Relying on GitHub Pages range requests without verifying actual network behavior | Feels fast in Chrome during dev, but effectively downloads the whole Parquet file on every query in some conditions | Check Network tab for 206 Partial Content responses (not 200 full downloads) as part of verification, across browsers | Any survey where the Parquet file is large enough that a full download is noticeably slow |
| No memory ceiling awareness in the conversion script | Works fine with the mock dataset, browser tab crashes with a real (larger) survey | Cap rows/columns or pre-aggregate in the Python conversion step; test with a realistically-sized real dataset, not just the mock generator's small output | Roughly low-millions of rows or low-single-digit-GB of loaded data, per community OOM reports |
| Unversioned public data filenames + CDN caching | Data updates don't appear for visitors for several minutes after a "successful" deploy | Version/hash data filenames referenced from the index JSON | Any time real data is corrected/updated after initial publish |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Treating "no direct identifiers" as sufficient anonymization | Re-identification of survey respondents via quasi-identifiers (age/gender/location/free-text/timestamp combinations), especially in small/known populations | Manual privacy review of every real dataset before publish: check free-text fields, rare categorical combinations, and small-N subgroups; coarsen rather than drop when a field has analytical value |
| Publishing the full raw Parquet (all columns from the source export) instead of a reviewed subset | Accidentally shipping a column that wasn't meant to be public (e.g. an internal note field, a submission IP/user-agent column exported by the survey tool) | Explicitly allow-list which columns the conversion script includes, rather than passing through every column from the raw CSV/Excel export by default |
| Assuming GitHub Pages' public repo/data is "obscure" (security through obscurity) | Anyone with the repo URL — indexed by search engines, scraped, or shared — can download the raw Parquet directly from `public/data/`, bypassing any UI-level framing/filtering entirely | Treat every file placed in `public/data/` as fully public and permanent (mind git history too — a bad publish isn't fixed by just removing the file in a later commit) from the moment of first deploy |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| No loading state while DuckDB-Wasm initializes (WASM download + worker spin-up + Parquet fetch) | Page appears frozen/broken for a second or more, especially on slower connections/mobile, before GraphicWalker appears | Explicit, visible loading indicator covering WASM init + data fetch, not just a blank screen |
| Silently failing when a browser doesn't support required WASM/SharedArrayBuffer features (older browsers, some in-app webviews) | Blank page or cryptic console-only error with no user-facing explanation | Feature-detect and show a clear fallback message ("this browser isn't supported, try Chrome/Firefox/Safari") rather than a silent failure |
| No indication of dataset size/row count before a heavy interaction | Users drag a field onto a shelf and the UI stutters/freezes with no explanation of why | Surface basic dataset stats (row/column count) from the `[id]_meta.json` summary before deep exploration, setting expectations |

## "Looks Done But Isn't" Checklist

- [ ] **DuckDB-Wasm init:** Works in `vite dev`, but not verified against the actual built `dist/` output served with the production `base` path — verify with `vite build && vite preview --base=/enquestes/` (or equivalent) before trusting it.
- [ ] **Data loading on real GitHub Pages:** Works in Chrome locally, but not tested on the actual deployed `github.io` URL in Firefox — range-request/gzip edge cases only show up on the real host, not local dev.
- [ ] **Client-side routing:** Navigating via in-app links works, but a hard refresh or direct link to `/enquesta/:id` 404s because the `404.html` fallback wasn't included in the deploy artifact.
- [ ] **GraphicWalker computation mode:** Charts render correctly with the small mock dataset, but silently falls back to slow/naive in-memory JS computation instead of the DuckDB-Wasm computation engine — verify by checking Network/Worker activity during a chart interaction, not just that a chart appears.
- [ ] **Data publishing:** A dataset "looks anonymized" (no name/email column) but wasn't reviewed for quasi-identifier re-identification risk in free-text or small-sample categorical fields.
- [ ] **Base path correctness:** Assets, router links, and data fetch URLs all assume `/` during development but the site is actually served from `/enquestes/` — every hardcoded absolute path (`/data/...`, `/enquestes_index.json`) needs to respect Vite's `BASE_URL`, not just the router.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Threaded DuckDB-Wasm bundle silently failing in production (Pitfall 1) | LOW | Switch `selectBundle`/explicit bundle choice to the single-threaded `eh`/`mvp` variant; redeploy — no data or architecture changes needed |
| Worker/WASM asset bundling broken in production build (Pitfall 2) | LOW–MEDIUM | Fix asset imports to use `?url`/`new URL()`, rebuild, verify against `vite preview` with the production base path before redeploying |
| A real dataset turns out to re-identify respondents after publish (Pitfall 8) | HIGH | Immediately remove/replace the offending Parquet file and index entry, force a new deploy; note that prior git history and any cached/scraped copies may persist — treat as a genuine incident, not just a file fix |
| GraphicWalker performance collapses on a larger real survey (Pitfall 4) | MEDIUM | Retrofit the DuckDB-Wasm-as-computation integration (`gw-dsl-parser`) in place of raw-array loading; contained to the exploration page component, no data-layer changes needed |
| Stale cached data after an update (Pitfall 6) | LOW | Wait out the CDN cache window (~5–10 min) or add a cache-busting filename/version and redeploy |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|-------------------|----------------|
| SharedArrayBuffer/COOP-COEP failure (P1) | DuckDB-Wasm service/singleton setup | Test against a real deployed GitHub Pages preview, not just local dev |
| Worker/WASM asset bundling (P2) | DuckDB-Wasm service/singleton setup | `vite build && vite preview` with production `base` path checked before first real deploy |
| Range-request reliability (P3) | Exploration page (`/enquesta/:id`) | Check Network tab for 206 responses in both Chrome and Firefox on the real deployed site |
| GraphicWalker scaling past raw-array loading (P4) | Exploration page (`/enquesta/:id`) | Confirm DuckDB-Wasm computation path is wired (not raw JS array) before considering the page done |
| DuckDB-Wasm memory ceilings (P5) | Python conversion script | Test conversion + browser load with a realistically-sized real dataset, not only the small mock dataset |
| Stale cached public data (P6) | Python conversion script / data publishing | Establish and document a filename/versioning convention before first real data update cycle |
| Git LFS incompatibility (P7) | GitHub Actions deploy workflow | Keep Parquet files under safe git thresholds; if LFS is ever needed, explicitly verify `actions/checkout` with `lfs: true` end-to-end on a real deploy |
| Insufficient anonymization (P8) | Python conversion script + pre-publish review | Manual privacy checklist run against every real dataset before it's committed to `public/data/`, especially free-text and small-N subgroups |

## Sources

- [Setting the COOP and COEP headers on static hosting like GitHub Pages (blog.tomayac.com, 2025)](https://blog.tomayac.com/2025/03/08/setting-coop-coep-headers-on-static-hosting-like-github-pages/) — MEDIUM confidence
- [Deploying DuckDB-Wasm — official DuckDB docs](https://duckdb.org/docs/lts/clients/wasm/deploying_duckdb_wasm) — HIGH confidence (official docs)
- [Instantiation — official DuckDB docs](https://duckdb.org/docs/current/clients/wasm/instantiation) — HIGH confidence (official docs)
- [Vite + React + DuckDB-Wasm reference example](https://bufferings.github.io/vite-react-duckdb-wasm/) — MEDIUM confidence
- [GitHub Pages sends invalid responses to range requests — community discussion #178318](https://github.com/orgs/community/discussions/178318) — MEDIUM confidence (verified via direct source fetch, cross-checked)
- [Feature Request: setting to force range requests on or off — duckdb-wasm discussion #1944](https://github.com/duckdb/duckdb-wasm/discussions/1944) — MEDIUM confidence
- [Graphic Walker FAQ — official Kanaries docs](https://docs.kanaries.net/graphic-walker/faq) — HIGH confidence (official docs)
- [Use DuckDB-Wasm for computation in GraphicWalker — official Kanaries Platform docs](https://platform.kanaries.net/graphic-walker/client-side/use-duckdb-wasm-as-computation) — HIGH confidence (official docs)
- [DuckDB-Wasm out of memory error — Observable Forum](https://talk.observablehq.com/t/duckdb-wasm-out-of-memory-error/7790) — MEDIUM confidence (community reports, consistent across multiple threads)
- [what is the size limit of duckdb in wasm? — duckdb-wasm discussion #1241](https://github.com/duckdb/duckdb-wasm/discussions/1241) — MEDIUM confidence
- [GitHub Pages does not support routing for single page apps — community discussion #64096](https://github.com/orgs/community/discussions/64096) — MEDIUM confidence
- [spa-github-pages (rafgraph) — SPA fallback redirect pattern](https://github.com/rafgraph/spa-github-pages) — MEDIUM confidence
- [About Git Large File Storage — GitHub Docs](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-git-large-file-storage) — HIGH confidence (official docs)
- [github pages serving the reference file instead of the actual binary — git-lfs issue #1342](https://github.com/git-lfs/git-lfs/issues/1342) — MEDIUM confidence
- [Re-Identification of "Anonymized" Data — Georgetown Law Technology Review](https://georgetownlawtechreview.org/re-identification-of-anonymized-data/GLTR-04-2017/) — MEDIUM confidence
- [Researchers spotlight the lie of 'anonymous' data — TechCrunch](https://techcrunch.com/2019/07/24/researchers-spotlight-the-lie-of-anonymous-data/) — MEDIUM confidence
- [React, AntD and Tailwind: fix CSS conflicts — Fabio Biondi](https://www.fabiobiondi.dev/blog/2022-09/react-antd-and-tailwind-fix-css-conflicts/) — LOW–MEDIUM confidence (community blog, general pattern not project-specific)
- Vite `public/` directory asset handling (no content hashing) — HIGH confidence (standard, well-documented Vite behavior)

---
*Pitfalls research for: Client-side data exploration SPA (DuckDB-Wasm + Parquet + GraphicWalker on GitHub Pages)*
*Researched: 2026-08-25*
