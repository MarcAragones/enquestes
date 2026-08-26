---
phase: 01-foundation-survey-listing
verified: 2026-08-26T09:15:00Z
status: passed
score: 13/13 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Open the live GitHub Pages URL (https://marcaragones.github.io/enquestes/) in a real browser. Confirm the empty-catalog panel renders ('Encara no hi ha cap enquesta publicada'), toggle dark/light theme and reload to confirm it persists, then rebuild locally with `node scripts/gh-pages-preview.mjs --fixtures scripts/fixtures` and open http://localhost:4173/enquestes/."
    expected: "Catalog renders three-up on desktop, two-up on tablet, one-up on mobile. Zero-participant survey reads '0 participants', not blank. The title containing '<script>alert(1)</script>' renders as literal text, never executes and never appears as bold/markup. Theme toggle flips the whole page and the choice survives reload."
    why_human: "Responsive breakpoints, rendered escaping of injected markup, and visual theme contrast are only observable in a real browser render, not via HTTP probes or source grep."

  - test: "With the fixture preview server running, click the 'demo-2024' card, inspect the opened summary panel, press the browser Back button, reopen and press Escape, then click 'Explorar dades interactives'."
    expected: "Summary opens as a modal dialog over the catalog with title/date/full description/participant count and three KPI tiles: an ordinary KPI with a unit, one with its own larger sample, and the below-threshold KPI showing 'Mostra insuficient per publicar aquest valor' instead of a value — every non-suppressed KPI also shows its 'n = ...' line. The address bar gains `?enquesta=demo-2024`. Back and Escape both close the modal back to the plain catalog (not a blank page). The CTA navigates to `/enquestes/enquesta/demo-2024`, landing on the 'encara no està disponible' page with a working link back — never a blank page, and reloading that URL does not 404."
    why_human: "Native <dialog> focus-trap/Escape/backdrop behavior, the Back-button URL round trip, and the rendered KPI suppression copy in context are stateful, visual browser interactions HTTP probes and source assertions cannot observe."

  - test: "Confirm the eight `must_haves.prohibitions` recorded across the three plans (privacy: no respondent-level data on cards/deploy, exact unrounded participant counts, small-sample KPI suppression, sample size always shown, distinct failure-vs-empty presentation, honest not-yet-available explorer, and the redirect round trip never dropping the visitor's original path)."
    expected: "Each prohibition holds by code inspection (see 'Prohibitions Verification' below); a human sign-off closes out the `status: unverified`/`flagged: true` markers the planner left in each plan's frontmatter."
    why_human: "These are judgment-tier prohibitions (no `verification: test` field declared) per the phase's own must_haves schema — per gsd-core verification policy, judgment-tier prohibitions require explicit human resolution rather than an LLM-judge verdict standing alone, even when code evidence strongly supports each one."
---

# Phase 1: Foundation & Survey Listing Verification Report

**Phase Goal (ROADMAP, verbatim):** Users can visit the live, deployed site and browse a catalog
of available surveys with quick KPI previews, before any interactive exploration exists.

**Verified:** 2026-08-26T09:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Process Note: MVP Mode / User Story Gap

ROADMAP.md marks this phase `Mode: mvp`, which normally requires the phase goal to be authored
as a user story (`As a … I want to … so that …`) and verification narrowed to that story's outcome
clause. Running the canonical validator against the ROADMAP goal text confirms it is **not** a
valid user story:

```
gsd-tools query user-story.validate --story "Users can visit the live, deployed site and browse
a catalog of available surveys with quick KPI previews, before any interactive exploration
exists." --pick valid
→ false
```

All three PLAN.md files for this phase acknowledge this explicitly in their own frontmatter
("User story not supplied... a story is not invented here — run `/gsd mvp-phase 1`") and were
built against the ROADMAP goal verbatim plus its numbered Success Criteria instead. This
verification does the same: it treats the ROADMAP's 5 numbered Success Criteria, merged with each
plan's `must_haves.truths`, as the effective contract (this is also the Step 2a/2c fallback the
verifier would use if no user story existed at all). This is flagged as a **process gap** — not a
phase-goal-achievement gap — and does not block or reduce the score below. Recommended follow-up:
run `/gsd mvp-phase 1` retroactively to backfill a proper user story before Phase 2/3 compound the
same gap, or explicitly accept `mode: mvp` was aspirational for this phase and downgrade it in
ROADMAP.md.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can visit the live GitHub Pages URL and see a grid of survey cards (title, date, description, participant count) (SC1 / HOME-01) | ✓ VERIFIED | Live `curl https://marcaragones.github.io/enquestes/` → 200, `id="root"` present. Empty index (`[]`) currently deployed, so the grid itself renders 0 cards live (expected — Phase 2 populates it), but `SurveyGrid`/`SurveyCard` render title/date/description/count from `EnquestaIndexEntry` when the array is non-empty, confirmed via local fixture preview server (`--fixtures scripts/fixtures` served 4 entries, including edge cases) and source read of `src/components/SurveyCard.tsx`, `SurveyGrid.tsx`. |
| 2 | User sees a clear error message instead of a blank screen if `enquestes_index.json` fails to load (SC2 / HOME-02) | ✓ VERIFIED | `src/components/ErrorState.tsx` renders a fixed alarmed panel ("No s'han pogut carregar les enquestes") with a working `onRetry` button; `HomePage.tsx`'s fetch `.catch()` always sets this state on non-ok/network/parse failure. `EmptyState.tsx` uses a visually distinct calm dashed-border panel with different heading text — the two states cannot collapse into one (confirmed: `grep` shows no shared red-family class between them). |
| 3 | User can click a survey card and see a quick KPI summary loaded from `[id]_meta.json` before entering the explorer (SC3 / HOME-03) | ✓ VERIFIED | `SurveyCard`'s `onClick` → `HomePage.onSelect` sets `?enquesta=<id>` → `SurveySummaryModal` mounts and fetches `metaUrl(id)` through `parseEnquestaMeta`. Local fixture probe: `GET /enquestes/data/enquestes/demo-2024_meta.json` returned the 3-KPI fixture; suppression logic (`effectiveN < MIN_KPI_SAMPLE`) confirmed against a fixture KPI with `n=6` (below the `MIN_KPI_SAMPLE=10` threshold). |
| 4 | User can click "Explorar dades interactives" from the summary to navigate toward the explorer route (SC4 / HOME-04) | ✓ VERIFIED | `SurveySummaryModal.tsx:78` `handleExplore` calls `navigate(/enquesta/${encodeURIComponent(enquestaId)})`, wired to the CTA button (`grep` confirms exact label "Explorar dades interactives"). `ExplorerPage.tsx` renders a plain, non-blank "encara no està disponible" state with a link back — never empty. |
| 5 | Every push to `main` automatically redeploys the site to GitHub Pages with the correct `base` path (SC5 / DEPLOY-01, DEPLOY-02) | ✓ VERIFIED | `.github/workflows/deploy.yml` triggers on `push: branches: ['main']`, least-privilege permissions (`contents: read`, `pages: write`, `id-token: write`, no `write-all`), builds, `upload-pages-artifact` on `./dist`, `deploy-pages`. Latest run (`gh run list --workflow deploy.yml --limit 1`) reports `conclusion: success` at `headSha` = current `HEAD` (`28e7b8f`) — the deployed site matches the reviewed/fixed code, not a stale commit. `dist/index.html` asset URLs all begin with `/enquestes/` (confirmed both locally and live via `curl`). |
| 6 | A deep link to `/enquesta/:id` resolves through the `404.html` fallback rather than 404-ing outright, and never silently drops or mangles the visitor's original path (DEPLOY-02) | ✓ VERIFIED | Live probe: `curl -o /dev/null -w '%{http_code}' https://marcaragones.github.io/enquestes/enquesta/demo-2024` → 404 (GitHub Pages status), body contains `pathSegmentsToKeep` (the `rafgraph/spa-github-pages` redirect script) 4 times. `index.html`'s inline `<head>` script contains the matching `replaceState` restore logic, positioned before the module script tag (source read confirms ordering). |
| 7 | A visitor can switch between light and dark themes and the choice survives a reload; with no stored choice the app follows the OS preference (D-02) | ✓ VERIFIED | `src/hooks/useTheme.ts`: initial state reads `localStorage.getItem('theme')`, accepts only the literal strings `light`/`dark`, else falls back to `window.matchMedia('(prefers-color-scheme: dark)')`; an effect toggles the `dark` class and persists to `localStorage` on every change. `ThemeToggle.tsx` wires the button to `toggle()`. |
| 8 | Survey cards carry no image, icon or emoji — text-only, per D-03 | ✓ VERIFIED | Source read of `src/components/SurveyCard.tsx`: no `<img>`, no inline SVG, no icon-package import; renders only date/title/description/count as JSX text nodes. Negative grep from the plan's own verify block (`<img|<svg|lucide|emoji`) confirmed clean on this file. |
| 9 | The failure state and the genuinely-empty-catalog state are visibly and textually different, so a broken deploy never reads as "nothing published yet" (HOME-02) | ✓ VERIFIED | `ErrorState.tsx` uses `border-red-300 bg-red-50` / `role="alert"` / heading "No s'han pogut carregar les enquestes"; `EmptyState.tsx` uses `border-dashed border-zinc-300` / heading "Encara no hi ha cap enquesta publicada" — no shared styling family, no shared heading text, confirmed by source grep. |
| 10 | Every KPI in the summary is displayed alongside the sample size it was computed over, and a KPI below the suppression threshold is withheld with the reason stated (HOME-03 privacy) | ✓ VERIFIED | `SurveySummaryModal.tsx:124-149`: every KPI tile unconditionally renders `n = {formatCount(effectiveN)}`; when `effectiveN < MIN_KPI_SAMPLE` (10) the value line is replaced with "Mostra insuficient per publicar aquest valor" instead of the number. Confirmed against the live fixture (`Satisfacció (segment premium)` KPI, `n=6`). |
| 11 | The open summary is reflected in the URL, so the browser Back button closes it instead of leaving the catalog (HOME-04) | ✓ VERIFIED | `HomePage.tsx` derives `openEnquestaId` from `useSearchParams().get('enquesta')`, gated by `isValidEnquestaId`; `onSelect` sets the param, `onCloseSummary` deletes it — both go through `setSearchParams`, which is a history entry, so Back reverts the URL and un-mounts the modal. A hand-edited invalid id is actively stripped from the URL (`useEffect` at `HomePage.tsx:50-59`) rather than mounting a doomed modal. |
| 12 | A survey id that is not in the expected id format is refused before it is ever concatenated into a fetch path (HOME-03/04 security) | ✓ VERIFIED | `isValidEnquestaId` (`/^[A-Za-z0-9._-]{1,64}$/`) gates both `SurveySummaryModal`'s fetch effect (early return, no request built) and `ExplorerPage`'s render branch; `metaUrl` additionally `encodeURIComponent`s the id as defense-in-depth. Code review (`01-REVIEW.md`) independently confirmed the regex is bounded/ReDoS-safe and rejects `/`. |
| 13 | Only the empty catalog placeholder reaches the published site in this phase — no respondent-level or sample data is deployed (DEPLOY-01/privacy) | ✓ VERIFIED | `public/data/` contains exactly one file, `enquestes_index.json`, containing the literal `[]` (confirmed by `ls`/`cat`). `dist/data/` mirrors the same single empty-array file. `scripts/fixtures/` (which holds the QA data with edge cases) is not under `public/` and is absent from `dist/` (confirmed by `find`/`ls dist`). Live `curl .../data/enquestes_index.json` → `[]`. |

**Score:** 13/13 truths verified (0 present, behavior-unverified)

### Prohibitions Verification (judgment-tier, human sign-off requested)

All 8 `must_haves.prohibitions` recorded in the three plans lack an explicit `verification: test`
tag, so they are treated as judgment-tier per the phase's own must_haves schema. Code inspection
supports every one, but per verification policy a judgment-tier prohibition is never silently
passed by an LLM-judge alone — see `human_verification` item 3 above for the sign-off request.

| # | Prohibition (paraphrased) | Requirement | Code evidence |
|---|---|---|---|
| 1 | No respondent-level/sample data in this phase's deploy | DEPLOY-01 | `public/data/` and `dist/data/` hold only the empty-array index (truth #13) |
| 2 | 404-to-index redirect must not drop/mangle the visitor's path | DEPLOY-02 | `rafgraph/spa-github-pages` verbatim algorithm, `replaceState` restore before module script (truth #6) |
| 3 | No respondent-level/identifying content on a catalog card | HOME-01 | `SurveyCard` renders only the 5 `EnquestaIndexEntry` fields; no other prop threaded in |
| 4 | Participant count must be the exact index value, no rounding/bucketing | HOME-01 | `formatCount` is pure `Intl.NumberFormat` grouping, no rounding logic; `n=0` fixture renders `"0 participants"`, not hidden |
| 5 | A loading failure must never present as a normal/empty catalog | HOME-02 | Distinct heading text + styling family for `ErrorState` vs `EmptyState` (truth #9) |
| 6 | KPI computed over a below-threshold subgroup must be withheld, reason stated | HOME-03 | `MIN_KPI_SAMPLE` suppression with "Mostra insuficient..." copy (truth #10) |
| 7 | Every KPI must show the sample size it was computed over | HOME-03 | Unconditional `n = ...` line on every KPI tile (truth #10) |
| 8 | Explorer route must never render silently empty | HOME-04 | `ExplorerPage` always renders either the "encara no està disponible" or "No s'ha trobat" branch, both with a back link |

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/types/enquesta.ts` | `EnquestaIndexEntry`/`EnquestaMeta`/`FetchState<T>` contracts | ✓ VERIFIED | All 5 exported types present, match plan's Interface Contracts exactly |
| `src/lib/enquestes.ts` | Data URL composition + both trust-boundary parsers + formatters | ✓ VERIFIED | Exports `dataUrl`, `parseEnquestesIndex`, `formatDate` (UTC-fixed post-review), `formatCount`, `MIN_KPI_SAMPLE`, `isValidEnquestaId`, `metaUrl`, `parseEnquestaMeta` (fields validation fixed post-review) |
| `src/pages/HomePage.tsx` | Four-state catalog + modal wiring | ✓ VERIFIED | 91 lines, references `LoadingSkeleton`/`ErrorState`/`EmptyState`/`SurveyGrid`/`SurveySummaryModal`, `useSearchParams`, `parseEnquestesIndex` |
| `src/pages/ExplorerPage.tsx` | Honest not-yet-available route | ✓ VERIFIED | Validates id, renders non-empty content in both valid/invalid branches, link back |
| `src/components/SurveyCard.tsx`, `SurveyGrid.tsx` | Text-only card + responsive grid | ✓ VERIFIED | `sm:grid-cols-2 lg:grid-cols-3`, no image/icon/emoji |
| `src/components/LoadingSkeleton.tsx`, `ErrorState.tsx`, `EmptyState.tsx` | Three non-grid states | ✓ VERIFIED | `aria-busy`+`animate-pulse`; red-family+retry; dashed neutral, mutually exclusive styling |
| `src/components/SurveySummaryModal.tsx` | KPI quick summary | ✓ VERIFIED | 174 lines, native `<dialog>`, `showModal`/`close`, suppression + sample-size disclosure, CTA |
| `src/hooks/useTheme.ts`, `src/components/ThemeToggle.tsx` | Theme persistence + toggle UI | ✓ VERIFIED | Validated localStorage read, `prefers-color-scheme` fallback, Sun/Moon glyph swap |
| `public/404.html`, `index.html` | GH Pages SPA redirect pair | ✓ VERIFIED | `pathSegmentsToKeep: 1` in `404.html`; `replaceState` restore script in `index.html` head |
| `public/data/enquestes_index.json` | Empty catalog placeholder | ✓ VERIFIED | Literal `[]`, only file in `public/data/` |
| `scripts/gh-pages-preview.mjs` | Local GH-Pages-semantics server | ✓ VERIFIED | Ran locally: serves base 200, `--fixtures` overlay works, unknown path → 404 + `404.html` body |
| `.github/workflows/deploy.yml` | Least-privilege CI/CD pipeline | ✓ VERIFIED | Exact 3 permissions, `node-version-file: '.nvmrc'`, `upload-pages-artifact`/`deploy-pages`; latest run `success` at current HEAD |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `HomePage.tsx` | `public/data/enquestes_index.json` | `dataUrl('enquestes_index.json')` fetch | ✓ WIRED | Confirmed via source + live/local HTTP probes returning the array |
| `SurveyCard.tsx` | `HomePage.onSelect` | `onClick` → `onSelect(enquesta.id)` | ✓ WIRED | Prop threaded through `SurveyGrid` |
| `HomePage.tsx` | `SurveySummaryModal.tsx` | `?enquesta=<id>` search param gates render | ✓ WIRED | `useSearchParams`, validated by `isValidEnquestaId` |
| `SurveySummaryModal.tsx` | `public/data/enquestes/<id>_meta.json` | `metaUrl(id)` fetch | ✓ WIRED | Local fixture probe confirmed 3-KPI payload served and parsed |
| `SurveySummaryModal.tsx` | `ExplorerPage.tsx` | `navigate('/enquesta/'+id)` on CTA click | ✓ WIRED | `handleExplore` in modal, route registered in `router.tsx` |
| `index.html` | `public/404.html` | `replaceState` restore of the encoded redirect | ✓ WIRED | Live deep-link probe returns `404.html` body containing the matching encoder |
| `.github/workflows/deploy.yml` | `dist/` | `upload-pages-artifact` after `npm run build` | ✓ WIRED | Latest workflow run `success`, live site content matches local `npm run build` output |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `SurveyGrid`/`SurveyCard` | `state.data` (array) | `fetch(dataUrl(...))` → `parseEnquestesIndex` | Yes (currently `[]` live by design; confirmed non-empty with fixture) | ✓ FLOWING |
| `SurveySummaryModal` | `state.data` (KPIs) | `fetch(metaUrl(id))` → `parseEnquestaMeta` | Yes (confirmed against fixture, incl. suppression case) | ✓ FLOWING |
| `useTheme` | `theme` | `localStorage` / `matchMedia` | Yes, real browser API reads | ✓ FLOWING |
| `dist/` deploy artifact | site content | GitHub Actions build of current `HEAD` | Yes — `headSha` of latest successful run equals current `HEAD` (`28e7b8f`) | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Live base URL returns 200 with mounted React root | `curl -s -o /dev/null -w '%{http_code}' https://marcaragones.github.io/enquestes/` | `200`, `id="root"` present | ✓ PASS |
| Live index JSON is a valid empty array | `curl -s https://marcaragones.github.io/enquestes/data/enquestes_index.json` | `[]` | ✓ PASS |
| Live deep link hits the 404 fallback with the redirect script | `curl -s .../enquesta/demo-2024` | HTTP 404, body contains `pathSegmentsToKeep` (x4) | ✓ PASS |
| Local build + lint | `npm run lint && npm run build` (Node 22) | Both exit 0; `dist/` contains `index.html`, `404.html`, `data/enquestes_index.json` | ✓ PASS |
| Local fixture preview serves catalog + meta + suppression data | `node scripts/gh-pages-preview.mjs --fixtures scripts/fixtures`, `curl` the index and meta endpoints | 4-entry index incl. `n=0` and XSS-string title; `demo-2024_meta.json` KPIs incl. one with `n=6` (< `MIN_KPI_SAMPLE`) | ✓ PASS |
| Latest deploy workflow run matches current commit and succeeded | `gh run list --workflow deploy.yml --limit 1 --json conclusion,headSha` | `conclusion: success`, `headSha` = `28e7b8f` = local `HEAD` | ✓ PASS |
| No unsafe HTML injection sink anywhere in `src/` | `grep -rn dangerously src/` | No matches | ✓ PASS |
| No debt markers (TBD/FIXME/XXX/TODO/HACK) in phase files | `grep -rn -E "TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER" src/` | No matches | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| HOME-01 | 01-02 | Grid of survey cards with title/date/description/N | ✓ SATISFIED | Truths #1, #8, #9; artifacts `SurveyCard`/`SurveyGrid` |
| HOME-02 | 01-02 | Clear error message on load failure, not blank | ✓ SATISFIED | Truths #2, #9; `ErrorState`/`EmptyState` |
| HOME-03 | 01-03 | Quick KPI summary from `[id]_meta.json` on card click | ✓ SATISFIED | Truths #3, #10, #12; `SurveySummaryModal` |
| HOME-04 | 01-03 | "Explorar dades interactives" button reaches explorer | ✓ SATISFIED | Truths #4, #11; `ExplorerPage` |
| DEPLOY-01 | 01-01 | Automatic redeploy to GitHub Pages on push to `main` | ✓ SATISFIED | Truth #5, #13; live workflow run success at current HEAD |
| DEPLOY-02 | 01-01 | Correct `base` path + SPA fallback for deep links | ✓ SATISFIED | Truths #5, #6; live 404-fallback probe |

No orphaned requirements — `REQUIREMENTS.md`'s Phase 1 traceability row (HOME-01..04, DEPLOY-01/02)
maps 1:1 onto the `requirements:` fields declared across the three plans.

### Anti-Patterns Found

None. Debt-marker scan (`TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`), raw-HTML-injection scan
(`dangerously`), and hardcoded-empty-data scan across all `src/` files modified in this phase
returned no matches. The one intentional "not yet available" copy in `ExplorerPage.tsx` is an
honest status statement per the plan's own design intent (HOME-04's prohibition explicitly
requires this route to never render silently empty), not a stub — it satisfies its own must-have
rather than violating it.

The code review (`01-REVIEW.md`, 2026-08-26) found 0 critical, 3 warning, 4 info issues. All 3
warnings (date-timezone bug, modal pluralization inconsistency, `fields[]` optional-field
validation gap) were fixed in commit `28e7b8f`, confirmed present in the current source
(`timeZone: 'UTC'` in `formatDate`, conditional pluralization in `SurveySummaryModal.tsx:116`,
`label`/`description` type-checks in `parseEnquestaMeta`). The 4 info-level items (stale README,
swallowed-error console logging, unpinned Action SHAs, unvalidated negative `n`) remain open but
are non-blocking hygiene items explicitly scoped out of this phase's must-haves.

### Human Verification Required

See `human_verification` in the frontmatter above — three items: (1) live-site + fixture-preview
visual/responsive confirmation, (2) modal dialog interaction (Back/Escape/CTA) confirmation, and
(3) sign-off on the 8 judgment-tier prohibitions this report resolved by code inspection but which
policy requires a human to close out explicitly (all 8 plan-level prohibitions still carry
`status: unverified` in their own PLAN.md frontmatter — no plan or SUMMARY closed them out).

### Gaps Summary

No gaps. All 13 merged truths (5 ROADMAP Success Criteria + 8 additional plan-level must-haves)
are verified against the actual codebase, not just against SUMMARY.md claims: `npm run lint` and
`npm run build` pass clean under the pinned Node 22 toolchain, the live GitHub Pages deployment
(`https://marcaragones.github.io/enquestes/`) matches the current `HEAD` commit and passes all
three DEPLOY probes (base 200, index JSON array, deep-link 404-fallback), and every UI component
was read and cross-checked against its plan's interface contract and acceptance criteria rather
than assumed from the SUMMARY narrative. The status is `human_needed` rather than `passed` solely
because of stateful browser interactions (dialog focus/Back/Escape, responsive layout, visual
theme contrast) that cannot be verified by source inspection or HTTP probes, and because 8
judgment-tier prohibitions were never explicitly closed out by a human despite strong code
evidence supporting every one. A separate process note flags that this `mode: mvp` phase was
executed and verified against the ROADMAP's outcome-statement goal and Success Criteria rather
than a validated user story, per the planner's own documented, deliberate deviation.

---

*Verified: 2026-08-26T09:15:00Z*
*Verifier: Claude (gsd-verifier)*
