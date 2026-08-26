# Phase 3: Interactive Explorer - Context

**Gathered:** 2026-08-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire DuckDB-Wasm (SQL over Parquet, entirely in-browser) into `<GraphicWalker />` at the
already-routed `/enquesta/:id` page, so a visitor can drag variables onto X/Y/Color/Size/Filter
and build charts freely over a survey's real data — no server, no backend query layer. Also
delivers the data dictionary (field descriptions from `meta.json`), chart export (PNG/SVG), and
a shareable link that reproduces the exact visualization via query params. This is the app's
core value and the highest-risk integration in the project (GitHub Pages COOP/COEP header
limits, Vite worker/wasm bundling, Parquet range-request reliability — flagged in STATE.md).
Does not touch the offline Python pipeline (Phase 2, already locked) or the homepage/catalog
(Phase 1, already locked) beyond replacing `ExplorerPage.tsx`'s "not available yet" stub.

</domain>

<decisions>
## Implementation Decisions

### Explorer page layout
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

### Shareable link scope (EXPL-11)
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
  `dataSource`/`rawFields` and let GraphicWalker's own in-browser engine handle interactions
  (vs. wiring DuckDB-Wasm live via the `computation` prop + `@kanaries/gw-dsl-parser`). Not
  discussed with the user — already has a clear project-level recommendation with rationale in
  `.planning/research/STACK.md` (Stack Patterns by Variant): simpler MVP integration, no extra
  DSL-to-SQL dependency, plenty fast at survey-sized datasets. Live-query wiring is the
  documented fallback only if this proves too slow on a real dataset.
- **Data dictionary placement (EXPL-09)** — user did not select this area to discuss (multiSelect
  offered it, not chosen). Left to research/planning: candidates include a dedicated panel/tab
  beside GraphicWalker, an expandable section, or hover tooltips on the field list. Should reuse
  `EnquestaMetaField.label`/`.description` from `meta.json`, already typed in
  `src/types/enquesta.ts`.
- **Loading/init experience (EXPL-01)** — user did not select this area to discuss. Left to
  research/planning: whether DuckDB-Wasm init and Parquet download/load show as one combined
  "Carregant…" state or as distinct visible phases (two different real failure points: engine
  init vs. data fetch/query — EXPL-02 requires a clear error message for each).
- Chart export mechanism (EXPL-10, PNG/SVG) — GraphicWalker ships export-as-image in its own
  toolbar per `.planning/research/STACK.md`; confirm this at research time rather than building a
  custom export button, unless research finds the built-in export insufficient.
- DuckDB-Wasm bundle selection, Parquet registration method (`registerFileURL` vs buffer),
  exact query-param encoding format for the shareable link (D-04) — standard implementation
  choices already constrained by CLAUDE.md's "What NOT to Use" table (no threaded bundle, no
  `coi-serviceworker`), not user-facing product decisions.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Highest-risk integration — read first
- `.planning/research/STACK.md` — DuckDB-Wasm bundle auto-selection (`eh` bundle, GitHub Pages
  cannot set COOP/COEP headers — do not force the threaded bundle or `coi-serviceworker`),
  GraphicWalker integration pattern (materialize-once vs. `computation` prop), Vite `?url`/
  `?worker` asset import pattern for wasm.
- `.planning/research/PITFALLS.md` — known pitfalls for this stack, including any Parquet/
  DuckDB-Wasm/GraphicWalker-specific gotchas.
- `.planning/research/ARCHITECTURE.md` — component separation between the JSON-only homepage
  (Phase 1, locked) and the DuckDB-Wasm service / explorer page (this phase).
- `.planning/STATE.md` Blockers/Concerns — "Phase 3: Highest-risk integration... verify against
  a real production build (`vite build && vite preview --base=/enquestes/`), not just dev."

### Requirements
- `.planning/REQUIREMENTS.md` — EXPL-01 through EXPL-11 (Explorador section).
- `.planning/ROADMAP.md` Phase 3 entry — goal, 5 success criteria, `Mode: mvp`.
- `.planning/research/FEATURES.md` — original feature-level definitions of the EXPL-* items.

### Locked upstream contracts (Phase 1 + Phase 2 — do not renegotiate)
- `src/types/enquesta.ts` — `EnquestaMeta`, `EnquestaMetaField` (`name`, `label?`, `description?`,
  `type: 'dimension' | 'measure'`) — the field-typing contract this phase's GraphicWalker
  `rawFields` mapping and data dictionary (EXPL-05, EXPL-09) must consume as-is.
- `src/lib/enquestes.ts` — `isValidEnquestaId`, `metaUrl`, `dataUrl`, `parseEnquestaMeta` — the
  same id-validation and path-composition discipline applies to composing the Parquet's data URL
  (`dataUrl(\`enquestes/${id}_respostes.parquet\`)`, mirroring `metaUrl`'s pattern).
- `src/pages/ExplorerPage.tsx` — the current stub this phase replaces; already gates on
  `isValidEnquestaId` and renders an invalid-id state — that guard and its Catalan copy pattern
  carry forward.
- `src/router.tsx` — `/enquesta/:id` is already routed and lazy-loaded; no routing changes
  needed, this phase fills in the lazy-loaded component's implementation.
- `src/components/SurveySummaryModal.tsx` — the existing entry point: its "Explorar dades
  interactives" button already navigates to `/enquesta/${id}`, so this phase's page is reached
  exactly as Phase 1 designed for it to be.
- `.planning/phases/02-offline-data-pipeline/02-03-SUMMARY.md` "Next Phase Readiness" section —
  the committed `mostra-sintetica` Parquet's actual size (5597 bytes) and column dtypes (3×
  `int64` measures, 3× `large_string` dimensions with accented Catalan values) this phase
  develops the DuckDB-Wasm query path against.
- `.planning/PROJECT.md` Key Decisions — dark-mode toggle pattern, `MIN_KPI_SAMPLE` privacy
  precedent (this phase's charts render un-aggregated respondent-level data client-side, so no
  equivalent suppression applies here — full Parquet already ships to the browser).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/enquestes.ts` — `isValidEnquestaId`, `dataUrl`, `parseEnquestaMeta` directly reusable
  for composing/validating the Parquet fetch path and re-reading `meta.json` for the data
  dictionary.
- `src/types/enquesta.ts` — `EnquestaMetaField`/`EnquestaMeta` types feed directly into the
  GraphicWalker `rawFields` construction.
- `src/hooks/useTheme.ts` — existing dark-mode hook/toggle, reusable in the new explorer header
  (D-01/D-02) rather than rebuilding theme logic.
- `src/components/ThemeToggle.tsx` — existing toggle component, drop into the new header as-is.

### Established Patterns
- Fetch trust-boundary discipline (`parseEnquestesIndex`/`parseEnquestaMeta`: reject-early on
  shape violation, fixed Catalan error copy, no interpolation) — the Parquet fetch/DuckDB-Wasm
  init path should follow the same posture for EXPL-02's error states, though D-07 establishes a
  softer, non-trust-boundary fallback specifically for stale/malformed shareable-link query
  params (not the same thing as a malformed server response).
- `formatDate`'s graceful-fallback-on-unparseable-input pattern — the precedent D-07 explicitly
  follows for shareable-link failures.
- Lazy-loaded route component (`React.lazy` + `Suspense` in `src/router.tsx`) — `ExplorerPage`
  already loads this way; DuckDB-Wasm/GraphicWalker's bundle weight makes this pattern more
  important here than it was for Phase 1's simple stub.

### Integration Points
- `src/pages/ExplorerPage.tsx` is the sole integration point — this phase replaces its body
  entirely (currently a static "not available yet" message) while keeping its existing
  `isValidEnquestaId` guard and invalid-id render branch.
- No changes anticipated to `src/pages/HomePage.tsx`, `src/components/SurveyCard.tsx`,
  `src/components/SurveySummaryModal.tsx`, or the Phase 2 Python pipeline — this phase only
  consumes their already-shipped output (`<id>_respostes.parquet`, `<id>_meta.json`).
- `public/data/enquestes/mostra-sintetica_respostes.parquet` — the one real committed dataset to
  develop and manually verify against (per Phase 2's deferred human-check item, never visually
  confirmed in a real browser yet).

</code_context>

<specifics>
## Specific Ideas

No named library-version preferences or example links given beyond what's already locked in
CLAUDE.md/`.planning/research/STACK.md` (DuckDB-Wasm auto-selected `eh` bundle, GraphicWalker
materialize-once MVP pattern). The "Copy link" button placement and layout decisions above are
the concrete specifics captured this session.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 3-Interactive Explorer*
*Context gathered: 2026-08-26*
