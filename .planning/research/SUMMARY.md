# Project Research Summary

**Project:** enquestes — public, zero-backend survey data-exploration site
**Domain:** Fully static, client-side data-exploration web app (React + Vite, DuckDB-Wasm over Parquet, GraphicWalker, deployed to GitHub Pages)
**Researched:** 2026-08-25
**Confidence:** MEDIUM overall

## Executive Summary

This project is a "Tableau Public / PyGWalker on a static host" tool: a two-page React/Vite SPA that ships pre-converted survey data as Parquet files, runs SQL against them entirely in the browser via DuckDB-Wasm, and hands the results to GraphicWalker for drag-and-drop chart building — with zero server, zero auth, and $0 hosting cost on GitHub Pages. This is a well-trodden but still-young integration pattern: DuckDB-Wasm + Parquet + GitHub Pages is corroborated by multiple official and community sources, and GraphicWalker is the only realistic open-source library for the "free explorer" UX PROJECT.md wants. The architecture and pitfalls research are unusually strong for a niche stack because the failure modes are well documented (COOP/COEP header limits, Vite worker/wasm bundling, range-request quirks) even though exact npm package versions are low-confidence and should be re-verified at scaffold time.

The recommended approach: a lazy-initialized DuckDB-Wasm singleton service that only loads on the Explorer route (never on the homepage), a two-tier static JSON metadata layer (`index.json` + per-survey `meta.json`) that lets the landing page stay fast and DuckDB-free, and GraphicWalker fed via the simple "materialize once, pass as dataSource" mode for MVP (with DuckDB-as-computation-engine reserved as an explicit scale-up path, not a default). All data preparation — anonymization, KPI computation, field typing — happens offline in a Python conversion script that is architecturally and operationally separate from the deployed app; this is the single most consequential design decision, since GitHub Pages cannot set custom HTTP headers (killing multi-threaded DuckDB-Wasm as a default), doesn't fingerprint `public/` assets (stale-cache risk on data updates), and serves everything in `public/data/` as permanently public (a real privacy risk if quasi-identifiers aren't reviewed before publish).

Key risks, in order of how early they must be addressed: (1) GitHub Pages' inability to set COOP/COEP headers means the app must default to the single-threaded `eh`/`mvp` DuckDB-Wasm bundle, not auto-select or hardcode the threaded variant; (2) Vite's default bundling breaks DuckDB-Wasm's worker/wasm assets unless `?url`/`new URL()` imports are used and verified against a production build (not just `vite dev`); (3) naive raw-array GraphicWalker integration silently caps out around 100K rows client-side, which is fine for MVP but must be a deliberate choice, not an accident; (4) "no name/email column" is not sufficient anonymization — quasi-identifier re-identification risk must be reviewed manually before any real survey is published, since `public/data/` is fully and permanently public the moment it's committed.

## Key Findings

### Recommended Stack

React 19 + Vite 7 + TypeScript 5.x + Tailwind v4 (via `@tailwindcss/vite`) form the app shell, all mandated by PROJECT.md and standard for a static SPA. `@duckdb/duckdb-wasm` (>=1.29) is the only realistic way to run real SQL against Parquet fully client-side; `@kanaries/graphic-walker` is the only maintained open-source "Tableau-in-a-component" library and is used in its default client-side-computation mode for MVP. `react-router-dom` in plain declarative mode (not "framework mode") handles the two routes; `HashRouter` is a strong option to sidestep GitHub Pages' lack of SPA rewrite rules entirely, at the cost of uglier URLs, versus `BrowserRouter` + a `404.html` redirect trick for clean URLs. Deployment uses GitHub's current native Actions-based Pages flow (`actions/upload-pages-artifact` + `actions/deploy-pages`), not the legacy `gh-pages` branch approach.

**Core technologies:**
- React 19 + Vite 7 + TypeScript 5.x — mandated app-shell stack; avoid TypeScript 7.0 (too new, ecosystem not caught up)
- Tailwind v4 (`@tailwindcss/vite`) — near-zero-config styling, single plugin + one `@import` line
- `@duckdb/duckdb-wasm` — in-browser SQL engine over Parquet, the core "no backend" enabler
- `@kanaries/graphic-walker` — drag-and-drop visual explorer component, the core value proposition
- `react-router-dom` (declarative mode) or `HashRouter` — two-route navigation without server rewrites

### Expected Features

Two distinct surfaces: a survey listing/landing page (`/`) and a per-survey chart explorer (`/enquesta/:id`). The landing page must read only from precomputed static JSON (never touching DuckDB), so browsing the catalog is always fast regardless of dataset size. The explorer page's core value is GraphicWalker's drag-and-drop chart building wired to DuckDB-Wasm-loaded data, with correct dimension/measure type inference being the single most consequential (and most often under-invested-in) quality lever, since it's decided in the offline Python conversion script, not the React app.

**Must have (table stakes):**
- Survey card grid + loading/error states on the index page (A1/A2)
- Per-survey KPI summary from precomputed `meta.json` (A3)
- DuckDB-Wasm init loading indicator + query/load error states (B1/B2) — non-negotiable given ~3MB+ engine bootstrap
- Drag-and-drop chart building with multiple chart types and correct field typing (B3/B4/B5)
- Non-broken responsive layout, back navigation, working GH Pages deep links (B6/B7/B8)

**Should have (competitive):**
- Data dictionary / field descriptions inline in the explorer (from `meta.json`)
- Chart export (PNG/SVG) — essentially free, GraphicWalker ships it
- Shareable chart-state URL (encode GraphicWalker's JSON spec) — a genuine differentiator vs. Tableau Public/Looker Studio

**Defer (v2+):**
- Search/filter/tagging across surveys (premature below ~12-15 surveys)
- User accounts, live/collaborative editing, runtime CSV upload, custom telemetry — all conflict with the $0/no-backend/no-auth constraint
- Large-dataset handling strategies (pre-aggregation, chunking) — defer until a specific survey demonstrably needs it

### Architecture Approach

An offline Python pipeline (never shipped to the browser) converts raw CSV/Excel into `public/data/**` artifacts: per-survey Parquet, per-survey `meta.json`, and a shared `enquestes_index.json`. The deployed React SPA has two pages fed by two independent data paths — a JSON-only path (index/meta, no WASM) for the homepage, and a DuckDB-Wasm singleton service path (lazy-initialized, only loaded on the Explorer route) that queries Parquet and hands results to GraphicWalker. GitHub Actions is the only "server-side" step in the system, running before any user ever loads the app.

**Major components:**
1. `scripts/convert_to_parquet.py` (offline, author's machine) — the sole gate for PII/anonymization decisions, KPI computation, and field typing
2. Static JSON metadata layer (`public/data/enquestes_index.json`, `[id]_meta.json`) — plain fetch, no WASM, keeps the homepage fast
3. `src/services/duckdb.ts` — single lazy-initialized `AsyncDuckDB` + Worker singleton; the only module allowed to touch `.parquet` bytes
4. `HomePage` / `ExplorerPage` (route-split) — HomePage never pays the WASM cost; ExplorerPage owns the DuckDB->GraphicWalker hand-off
5. `<GraphicWalker />` — pure viz layer, consumes data+fields, knows nothing about fetch/DuckDB
6. GitHub Actions deploy workflow — `npm ci` -> `vite build` -> `upload-pages-artifact` -> `deploy-pages`

### Critical Pitfalls

1. **GitHub Pages can't set COOP/COEP headers** — the threaded DuckDB-Wasm bundle silently fails in production even though it worked in dev. Pin the single-threaded `eh`/`mvp` bundle explicitly rather than trusting auto-selection.
2. **Vite mishandles DuckDB-Wasm's worker/wasm assets by default** — use `?url`/`new URL(..., import.meta.url)` imports and verify against a real production build (`vite build && vite preview` with the `/enquestes/` base path), not just `vite dev`.
3. **Parquet range requests on GitHub Pages are not fully reliable** (documented Firefox-specific gzip/range bug) — verify 206 Partial Content responses in both Chrome and Firefox on the real deployed site, not just locally in Chrome.
4. **Raw-array GraphicWalker integration doesn't scale past ~100K rows** — fine for MVP as a deliberate simple-mode choice, but must be a documented decision, not a surprise; the DuckDB-as-computation-engine pattern is the officially documented scale-up path.
5. **"No name/email column" is not sufficient anonymization** — quasi-identifiers (age, free text, small-N categorical combos) can re-identify respondents; requires a manual privacy review before any real survey is published, since `public/data/` is permanently public.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Project scaffold + static homepage (JSON-only)
**Rationale:** No dependency on DuckDB-Wasm/GraphicWalker; validates Vite/Tailwind/routing/GitHub Pages deploy pipeline first, in isolation, before adding the riskiest integrations.
**Delivers:** Vite+React+TS+Tailwind scaffold, GitHub Actions deploy to Pages (with correct `base` path and `404.html` SPA fallback), router shell, HomePage rendering a survey card grid from a mock `enquestes_index.json` + `meta.json`, loading/error states (A1/A2/A3).
**Addresses:** FEATURES A1, A2, A3, B7, B8 (nav + deep-link routing, tested even before Explorer exists).
**Avoids:** Pitfall 6 (stale public asset caching — establish naming convention here), Pitfall 7 (git LFS trap — decide file-size handling before real data exists).

### Phase 2: Offline data pipeline (Python conversion script)
**Rationale:** Feature quality in the explorer (field typing, KPI accuracy, data dictionary) is bottlenecked by this script; it also owns the privacy/anonymization gate, which must exist before any real data is ever committed. Doing this before the explorer means mock data for Phase 3 already flows through the real schema.
**Delivers:** `scripts/convert_to_parquet.py` + `scripts/generate_mock_parquet.py`, producing `[id]_respostes.parquet`, `[id]_meta.json`, and upserting `enquestes_index.json`, with an explicit column allow-list and a documented manual privacy-review checklist.
**Addresses:** FEATURES B5 (field typing), differentiator "data dictionary."
**Avoids:** Pitfall 5 (memory ceilings — decide row/column limits here), Pitfall 8 (re-identification — build the checklist into this phase, not discovered post-publish).

### Phase 3: DuckDB-Wasm service + Explorer page core
**Rationale:** The highest-risk integration in the whole project (COOP/COEP, Vite asset bundling, range requests) — isolate it into its own phase with explicit production-build verification before layering GraphicWalker UI on top.
**Delivers:** `src/services/duckdb.ts` singleton (lazy-init, pinned to single-threaded bundle), `?url`-based worker/wasm asset imports verified against `vite build && vite preview --base=/enquestes/`, Parquet query wired to a loading/error UI (B1/B2).
**Uses:** STACK `@duckdb/duckdb-wasm`.
**Implements:** ARCHITECTURE Pattern 1 (lazy singleton service).

### Phase 4: GraphicWalker integration + chart explorer UX
**Rationale:** Depends on Phase 3's data being reliably queryable; this is where the actual "core value" (drag-and-drop exploration) ships.
**Delivers:** `<GraphicWalker />` wired to DuckDB-Wasm query results (simple mode, materialize-once), correct field typing sourced from `meta.json`, responsive/non-broken layout (B6), chart export surfaced in UI.
**Addresses:** FEATURES B3, B4, B6, plus P2 differentiators (chart export) if low-effort.
**Avoids:** Pitfall 4 (scaling ceiling — document the simple-mode choice explicitly as a decision, not an oversight), Pitfall 1 (BigInt conversion from Arrow results into GraphicWalker).

### Phase 5 (v1.x, post-MVP validation): Data dictionary, shareable chart-state URLs
**Rationale:** Both reuse infrastructure already built (meta.json pipeline, GraphicWalker's JSON spec) and are explicitly scoped as "add after validation" in FEATURES.md — not blocking MVP launch.
**Delivers:** Inline field-description sidebar; URL-encoded GraphicWalker spec for sharing a specific chart view.

### Phase Ordering Rationale

- Static homepage first because it has zero dependency on the riskiest integrations (DuckDB-Wasm, GraphicWalker) and validates the deploy pipeline (base path, 404 fallback) that every later phase relies on.
- The Python conversion script comes before the DuckDB/GraphicWalker phases because B5 (correct field typing) is a hard dependency of B3 (drag-and-drop) per FEATURES.md's dependency graph — get the data pipeline right before wiring the UI on top of it.
- DuckDB-Wasm service is isolated as its own phase, separate from GraphicWalker, because Pitfalls 1-3 are specifically about the DuckDB/Vite/GitHub-Pages integration surface and deserve dedicated production-build verification before any chart UI work begins.
- Shareable-URL and data-dictionary features are explicitly deferred to v1.x per FEATURES.md's MVP definition, avoiding scope creep into the initial roadmap.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (DuckDB-Wasm service):** Smaller, less mainstream integration surface; version-specific bundle-selection and Vite worker-asset behavior should be re-verified against current package versions at plan time (STACK.md flags all exact versions as LOW confidence).
- **Phase 4 (GraphicWalker integration):** GraphicWalker's `computation` prop / DuckDB-as-computation-engine pattern is officially documented but has fewer independent sources; if the MVP simple-mode choice is revisited, this needs fresh research.

Phases with standard patterns (skip research-phase):
- **Phase 1 (scaffold + static homepage):** Vite/React/Tailwind/GitHub Pages Actions deploy is HIGH-confidence, widely documented, standard pattern.
- **Phase 2 (Python conversion script):** Standard pandas/pyarrow tooling; the privacy-review checklist is a process decision, not a technical unknown.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | Architecture/config guidance (bundle selection, COOP/COEP, base-path, deploy pattern) is HIGH confidence, corroborated across sources; exact package version numbers are LOW confidence (no Context7/MCP docs server available — verify via `npm view` before scaffolding) |
| Features | MEDIUM-HIGH | GraphicWalker capabilities and DuckDB-Wasm loading model are HIGH confidence; feature prioritization judgment calls are reasoned from analogues (Tableau Public, Looker Studio, PyGWalker), not directly sourced for this exact product shape |
| Architecture | MEDIUM-HIGH | Vite/GitHub Pages static-SPA deployment patterns are HIGH confidence (official, widely documented); DuckDB-Wasm<->GraphicWalker wiring specifically is MEDIUM (smaller ecosystem, evolving APIs, fewer independent authoritative sources) |
| Pitfalls | MEDIUM | Several findings cross-verified against official docs/GitHub discussions (HIGH within that subset); several are single-source community reports (LOW-MEDIUM) |

**Overall confidence:** MEDIUM

### Gaps to Address

- Exact npm package versions (Vite, TypeScript, DuckDB-Wasm, GraphicWalker, React Router, lucide-react) are unverified — run `npm view <package> version` at scaffold time (Phase 1) rather than trusting STACK.md's numbers.
- GraphicWalker's React 19 peer-dependency support is unconfirmed — check at install time; fall back to React 18 if it lags, rather than fighting a peer-dependency warning.
- Real-world Parquet file sizes for actual survey datasets are unknown at research time — Phase 2 should test the conversion pipeline against a realistically-sized dataset, not just the mock generator's small output, to validate the memory-ceiling and range-request assumptions from Pitfalls 3 and 5.
- The DuckDB-as-computation-engine scaling path (Pattern 3, mode 2) is documented but not implemented/tested by this research — if MVP's simple mode proves too slow, budget dedicated research time before implementing mode 2.

## Sources

### Primary (HIGH confidence)
- DuckDB official docs — Deploying DuckDB-Wasm, Instantiation, DuckDBBundles reference
- Vite official docs — Deploying a Static Site
- Kanaries official docs — GraphicWalker FAQ, Component API, DuckDB-Wasm-as-computation
- GitHub Docs — About Git Large File Storage
- Tailwind CSS official docs — Vite installation

### Secondary (MEDIUM confidence)
- GitHub community discussions — COOP/COEP header limitations (#13309), SPA routing (#64096), range-request/gzip bug (#178318)
- `duckdb-wasm-kit` (community singleton pattern reference)
- `bufferings/vite-react-duckdb-wasm` (known-good Vite integration example)
- Multiple independent Vite+React Router+GitHub Pages deployment tutorials (base path, 404.html pattern)
- Tableau Public / Looker Studio / PyGWalker feature analogues (competitor analysis basis)
- Re-identification risk research (Georgetown Law Technology Review, TechCrunch)

### Tertiary (LOW confidence)
- WebSearch-derived npm package version numbers (all core packages) — must be re-verified via `npm view` before pinning
- Single-source community blog on Tailwind/AntD Preflight conflicts — general pattern, not project-specific

---
*Research completed: 2026-08-25*
*Ready for roadmap: yes*
