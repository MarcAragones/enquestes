# Walking Skeleton — Enquestes (Explorador Interactiu d'Enquestes)

**Phase:** 1
**Generated:** 2026-08-25

## Capability Proven End-to-End

A visitor loads the live GitHub Pages URL, the app fetches `enquestes_index.json` through the
configured `/enquestes/` base path, renders one of four real states from that response
(loading / error / empty / list), and can toggle light↔dark with the choice persisted — and a
direct deep link to `/enquestes/enquesta/<id>` survives a refresh instead of 404-ing.

That single path touches every layer this project has: build (Vite `base`), static hosting
(GitHub Pages + `404.html` fallback), client routing (`BrowserRouter` + `basename`), data read
(`fetch` of a static JSON artifact), UI interaction (theme toggle), and CI/CD (GitHub Actions →
Pages). There is no server tier to prove — by constraint, there never will be one.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | React 19 + Vite 8 + TypeScript ~6.0.2, `create-vite` `react-ts` template defaults | Mandated by PROJECT.md. RESEARCH.md verified the template's own pins against the live npm registry on 2026-08-25; TypeScript stays at `~6.0.2` (not `latest`/7.x) because `typescript-eslint` declares a `<6.1.0` peer ceiling. |
| Node runtime | Node 22 (`.nvmrc` = `22`; CI reads `node-version-file`) | Vite 7 and 8 both declare `engines.node ^20.19.0 \|\| >=22.12.0`. The dev machine's default Node is v20.18.3 — below the floor. `v22.14.0` is already installed under nvm, so the fix is a switch, not a download. |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite`, CSS-first (`@import "tailwindcss"`), no `tailwind.config.js`, no PostCSS | Mandated by PROJECT.md. v4's CSS-first config removes the whole config/PostCSS surface for a project this size. |
| Design tokens | Neutral `zinc` scale + one accent (`--color-accent: #2563eb`), system-UI "tech" sans via `--font-sans`, tabular numerals for counts | CONTEXT.md D-01 (neutral/minimal, one accent, serious data-dashboard look) and D-04 (modern/tech sans-serif). Deliberately zero new font packages — no unaudited dependency for a typeface. |
| Theming | Class-based dark mode (`@custom-variant dark`), `useTheme` hook, `localStorage` key `theme`, `prefers-color-scheme` as the unset default | CONTEXT.md D-02. A ~15-line hook beats adding a theming dependency for one binary toggle. |
| Data layer | Static JSON + (later) Parquet artifacts under `public/data/`, read with `fetch` through `import.meta.env.BASE_URL`. No database, no API, no server. | PROJECT.md's $0 / no-backend constraint. `import.meta.env.BASE_URL` is the single source of truth for the base path so a repo rename needs one config edit. |
| Routing | `BrowserRouter` with `basename={import.meta.env.BASE_URL}` + the `rafgraph/spa-github-pages` `404.html`/`index.html` redirect pair (`pathSegmentsToKeep = 1`) | Clean, shareable URLs — load-bearing for the project's core value (EXPL-11 shareable chart links). Gated by a `checkpoint:decision` in plan 01-01 because the published URL shape is a one-way door. |
| Auth | None | PROJECT.md explicitly out of scope: public audience, published data is non-sensitive. |
| Deployment target | GitHub Pages, "Source: GitHub Actions", via `actions/configure-pages` + `actions/upload-pages-artifact` + `actions/deploy-pages`, on push to `main` | GitHub's own current native Pages flow — no `gh-pages` branch, no third-party action, no extra devDependency. |
| Directory layout | `src/{types,lib,pages,components,hooks}` — flat within each; `public/data/` for published artifacts; `scripts/` for local verification harnesses | Matches `.planning/research/ARCHITECTURE.md` and 01-PATTERNS.md's "Conventions Established". Phase 3 adds `src/services/duckdb.ts` without moving anything. |
| UI language | Catalan, no i18n layer | Whole project context is Catalan; a single-locale app needs no i18n machinery for v1. |

## Stack Touched in Phase 1

- [ ] Project scaffold (Vite, React, TypeScript, Tailwind v4, ESLint flat config)
- [ ] Routing — `/` renders the catalog, `/enquesta/:id` resolves to a lazily-imported route
- [ ] Data — one real read (`enquestes_index.json`) plus one real per-record read (`[id]_meta.json`).
      There is no write tier in this architecture, by constraint; the "write" side of the data
      loop is Phase 2's offline Python pipeline that produces these artifacts.
- [ ] UI — theme toggle and card→modal→navigate interactions wired to real fetched data
- [ ] Deployment — live on GitHub Pages via GitHub Actions on every push to `main`, plus
      `scripts/gh-pages-preview.mjs`, a zero-dependency local server that reproduces GitHub Pages'
      `404.html` fallback semantics so DEPLOY-02 is provable before it ships

## Out of Scope (Deferred to Later Slices)

- DuckDB-Wasm, Parquet loading, `<GraphicWalker />` — the whole interactive explorer (Phase 3).
  `/enquesta/:id` renders an honest "not available yet" page in Phase 1.
- The offline Python conversion/mock/privacy-checklist pipeline (Phase 2). Phase 1 ships
  `public/data/enquestes_index.json` containing `[]` and locks the JSON contract Phase 2 emits.
- A test runner (Vitest / Testing Library / headless browser). No requirement, decision, or
  research item asks for one, and every candidate package sits outside RESEARCH.md's package
  legitimacy audit. Phase 1 verifies with typecheck, lint, production build, source assertions,
  and HTTP probes against the Pages-semantics preview server. Revisit when Phase 2/3 introduce
  logic with defined I/O worth testing first.
- Search / filter / tagging across surveys (v2 DISC-01), large-dataset chunking (v2 DISC-02).
- Full touch optimization for mobile — v1's bar is "not visually broken", per REQUIREMENTS.md.
- Analytics or telemetry of any kind.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering the
architectural decisions above:

- **Phase 2** — the offline pipeline fills `public/data/` with real artifacts that satisfy the
  `EnquestaIndexEntry` / `EnquestaMeta` contracts this phase locks, gated by a privacy checklist.
- **Phase 3** — `/enquesta/:id` stops being a stub: DuckDB-Wasm reads the Parquet artifact and
  feeds `<GraphicWalker />`, plus data dictionary, chart export, and shareable chart-state links.
  The `BrowserRouter` + `404.html` deep-link mechanism proven here is exactly what makes those
  shareable links work.
