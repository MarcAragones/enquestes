# Milestones

## v1.0 MVP (Shipped: 2026-08-29)

**Phases completed:** 3 phases, 14 plans, 32 tasks

**Key accomplishments:**

- Vite 8 + React 19 + TypeScript 6 + Tailwind v4 app deployed live to GitHub Pages via GitHub Actions, with BrowserRouter deep-link routing, a validated data-fetch contract, and dark-mode persistence.
- Text-only SurveyCard/SurveyGrid catalog UI with four visually distinct loading/error/empty/list states, backed by a local QA fixture exercising zero-participant and markup-injection edge cases.
- Native-<dialog> SurveySummaryModal with sample-size-disclosed, suppression-aware KPI tiles, opened via a URL search param so Back closes it, handing off to an ExplorerPage that's honest about not being built yet.
- End-to-end raw CSV to published artifacts conversion (`convert_enquesta.py`) with a block-by-default DATA-03 privacy checklist, D-02 free-text exclusion, D-03 type inference, and a 24-case self-test suite over the pure-logic modules.
- Extended `scripts/pipeline/privacy.py` with quasi-identifier name-hint matching and a 2/3-column small-group k-anonymity scan, and added `scripts/pipeline/load.py` for `.csv`/`.tsv`/`.xlsx` loading with utf-8→cp1252 encoding fallback and a shape-sanity report printed on every run.
- Synthetic survey generator (`generate_mock_parquet.py`) with no real data and no privacy gate, plus the first real Parquet dataset committed to `public/data/` — the deployed homepage now lists one honestly-labelled synthetic survey instead of the empty-catalog state.
- DuckDB-Wasm queries the committed mostra-sintetica Parquet via SQL in a Worker, and a working drag-and-drop GraphicWalker mounts full-width over the 250 real rows with verbatim-typed fields — proven against a real production build, not just `vite dev`.
- Extracted a reusable `ExplorerHeader` (title + back-link + dark-mode toggle, wired into all four page states) and added a collapsed-by-default `DataDictionary` panel reading field meanings straight from the already-loaded meta.json, plus GraphicWalker's own light/dark `appearance` prop synced to the app's theme.
- Investigated GraphicWalker 0.5.2's installed types to find a confirmed, synchronous chart-spec read-back mechanism (`storeRef` -> `VizSpecStore.exportCode()`), then built a versioned, UTF-8-safe `shareLink.ts` (TDD, 16 unit assertions) and wired "Copia l'enllaç" into the header plus `?chart=` restore into `ExplorerPage` — writing zero custom image-export code because GraphicWalker's own toolbar already has one.
- Merged SurveySummaryModal's two independent dialog effects into one StrictMode-idempotent lifecycle effect, fixing the immediate self-dismissal under `npm run dev` (G-03-2)
- Fixed G-03-4 (EXPL-11 was 0% functional): decodeShareLink now walks only GraphicWalker's shelf channels for its schema-drift check, with an explicit allowlist for the library's three internal virtual field ids, so every real shared chart link restores correctly instead of silently failing 100% of the time.
- Closed G-03-2b (not-found vs. load-failed error copy, EXPL-02) and G-03-4b (GraphicWalker canvas fills its container via `defaultConfig` + an `h-dvh` flex-column ancestor chain, EXPL-03/EXPL-06) — both fixes land entirely inside `src/pages/ExplorerPage.tsx`.
- Extracted SurveySummaryModal's dialog lifecycle into a framework-free `openDialogLifecycle` with a suppression-counter fix, proven against a hand-rolled StrictMode/async-close-event reproduction test that fails on 03-04's shipped implementation and passes on the new one.

**Requirements:** 20/20 v1 requirements complete, 0 gaps.

Known verification overrides: 8 newly acknowledged, 0 carried forward from a prior close (see STATE.md Deferred Items) — 7 diagnosed/fixed debug sessions from Phase 3 gap-closure work (G-03-2, G-03-2b, G-03-4, G-03-4b, G-03-5, G-03-7), 1 inconclusive investigation (G-03-6, no code defect found after exhaustive real-browser reproduction), and the `knowledge-base.md` reference doc (not an actual session).

---
