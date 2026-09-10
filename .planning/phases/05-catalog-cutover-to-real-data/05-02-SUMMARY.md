---
phase: 05-catalog-cutover-to-real-data
plan: 02
subsystem: testing
tags: [vitest, react, share-link, verification-gate, real-data]

requires:
  - phase: 05-catalog-cutover-to-real-data (plan 01)
    provides: "three real surveys (REO1167, REO1151, REO1145) as the only entries in public/data/, synthetic mostra-sintetica retired"
provides:
  - "src/lib/realSurveys.test.ts — regression suite grounded in the actually-published catalog/dictionary/share-link data"
  - "render-time survey-change reset in ExplorerPage.tsx, closing the structural cross-survey bleed path"
  - "index-driven catalog-completeness gate in scripts/verify-pages.mjs"
affects: [any future phase adding routing between /enquesta/:id pages, or adding a 4th+ survey]

actuals:
  tokens: 4135
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Load real published JSON at vitest test time via node:fs readFileSync(process.cwd()-relative), never hardcode field-name arrays — the suite fails if published data drifts (proven via a deliberate corrupt-and-revert check)."
    - "Render-time state-adjustment-on-prop-change (React's documented 'store previous prop value, compare, setState during render' idiom) reused a second time in this codebase for a route-param change, matching SurveySummaryModal's existing WR-03 guard exactly."
    - "Index-driven verification scripts that walk every catalog entry (verify-pages.mjs) vs. index-driven scripts that intentionally check only the first entry (verify-explorer-assets.mjs) — two different scopes, not duplication, documented in-code so a future reader does not collapse them."

key-files:
  created:
    - src/lib/realSurveys.test.ts
  modified:
    - src/pages/ExplorerPage.tsx
    - src/lib/shareLink.test.ts
    - scripts/verify-pages.mjs

key-decisions:
  - "The ExplorerPage render-time reset is documented as hardening (A-04), not a bug fix — today's navigation graph always unmounts the page between two surveys via the homepage, so the guard defends against a future direct route-to-route link rather than fixing an observed defect."
  - "PONDERA-based cross-survey acceptance (shared by REO1167/REO1145, absent from REO1151) is treated as correct field-based validation, not a leak (A-06) — asserted explicitly in realSurveys.test.ts with an in-code comment."

patterns-established:
  - "Real-data regression tests for a multi-item catalog should derive every field-name / id fact from the published JSON at test time, never inline the literal values, so the suite's own correctness is coupled to the data staying internally consistent."

requirements-completed: [PUB-04]

coverage:
  - id: D1
    description: "Regression suite (src/lib/realSurveys.test.ts) proving the catalog, per-survey dictionaries, and cross-survey share-link rejection against the real published data"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "src/lib/realSurveys.test.ts (23 tests, part of 69 total in npm run test)"
        status: pass
      - kind: other
        ref: "Corrupt-REO1145_meta.json-n-value-then-revert check — suite fails when corrupted, passes when restored (proves non-vacuous)"
        status: pass
    human_judgment: false
  - id: D2
    description: "ExplorerPage render-time reset making the no-bleed guarantee structural on a survey id change"
    requirement: "PUB-04"
    verification:
      - kind: other
        ref: "npm run lint (no react-hooks/set-state-in-effect violation) + npm run build + npm run test, all exit 0"
        status: pass
    human_judgment: true
    rationale: "The project has no jsdom/React Testing Library (explicit no-new-dependency constraint), so the reset's actual render-time behavior cannot be exercised by an automated component test — verification here is lint + pattern-mirroring against SurveySummaryModal's identical, already-shipped WR-03 guard, plus code tracing. A human should confirm the reasoning holds if this becomes reachable via new navigation."
  - id: D3
    description: "Index-driven catalog-completeness gate in scripts/verify-pages.mjs walking every published survey's meta.json and Parquet"
    requirement: "PUB-04"
    verification:
      - kind: other
        ref: "npm run verify:pages — 3 enquestes verificades"
        status: pass
      - kind: other
        ref: "Rename REO1145_meta.json then re-run verify:pages — fails naming REO1145; restored afterward"
        status: pass
    human_judgment: false
  - id: D4
    description: "Human walkthrough of all five phase success criteria (SC-1 through SC-5) against the production preview build"
    verification:
      - kind: other
        ref: "curl-based mechanical proxies against npm run preview:pages (port 4173) — see Human-Check Items section below"
        status: pass
    human_judgment: true
    rationale: "No interactive browser is available in this execution environment. Per the coordinator's explicit instruction, all five walkthrough steps were verified via curl against the served production build and source-code tracing rather than visual/drag-and-drop confirmation. Genuine pixel rendering and the interactive drag-to-chart flow are not confirmed — flagged explicitly below, not silently assumed."

duration: ~35min
completed: 2026-09-10
status: complete
---

# Phase 05 Plan 02: Prove the Catalog and Explorer Behave Correctly with Real Multi-Survey Data Summary

Added a real-data regression suite (`src/lib/realSurveys.test.ts`, 23 new tests) that reads the three published surveys directly off disk to prove per-survey KPI/dictionary/share-link isolation, closed the one structural path by which `ExplorerPage` could show one survey's data under another survey's URL with a render-time state reset mirroring the project's existing WR-03 pattern, and extended `verify-pages.mjs` into an index-driven gate that walks every catalog entry instead of asserting only that the index parses.

## Performance

- **Duration:** ~35 min
- **Tasks:** 3/3 completed
- **Files modified:** 4 (1 created, 3 modified)

## Accomplishments

- `src/lib/realSurveys.test.ts`: 23 new vitest tests, all derived from `readFileSync`-loaded real published JSON — zero hardcoded field-name arrays. Covers catalog integrity (meta matches index, no synthetic entry, KPI suppression threshold), dictionary divergence (283/291/263 fields, pairwise non-identical), and share-link cross-survey behavior (`IDENTIFICADOR_COMPLET` rejected off REO1151, `PONDERA` accepted on both Baròmetre waves by design, `gw_count_fid` universal, a truncated payload fails silently).
- `ExplorerPage.tsx`: added a tracked-id + render-time `dataState` reset on survey-id change, identical in shape to `SurveySummaryModal`'s existing guard, with a comment explaining both the concrete failure mode it prevents (stale `decodedChart` field allow-list, T-05-07) and that it is currently unreachable via the app's own navigation (A-04, hardening not a bugfix).
- `scripts/verify-pages.mjs`: now walks every `enquestes_index.json` entry, asserting ≥2 published surveys, no retired synthetic entry, a matching 200 `_meta.json` and non-empty `_respostes.parquet` per survey, and that the surveys' field-name sets are not all identical — proven to have teeth by a deliberate rename-and-restore of `REO1145_meta.json`.
- `src/lib/shareLink.test.ts`: corrected its stale fixture comment (previously pointed at the now-deleted `mostra-sintetica_meta.json`) without touching any test logic or field-name literals.

## Task Commits

1. **Task 1: Regression suite grounded in the actually-published surveys** - `ad68f97` (test)
2. **Task 2: Make the explorer's no-bleed guarantee structural** - `e7ad9e1` (feat)
3. **Task 3: Index-driven serving gate plus the multi-survey walkthrough** - `464fa33` (feat)

_No TDD tasks in this plan — all `type="auto"`._

## Files Created/Modified

- `src/lib/realSurveys.test.ts` - new regression suite, real-data-grounded (catalog/dictionary/share-link)
- `src/pages/ExplorerPage.tsx` - render-time survey-change reset (tracked id + `dataState` reset)
- `src/lib/shareLink.test.ts` - stale fixture comment corrected, field-name literals unchanged
- `scripts/verify-pages.mjs` - index-driven catalog-completeness assertions

## Decisions Made

- Task 2's reset is documented explicitly as hardening (A-04): the current navigation graph (every survey move via the homepage) already makes `ExplorerPage` unmount between surveys, so the guard has no observable effect today — it exists for the day a direct route-to-route link is added.
- The `PONDERA`-shared-field cross-survey acceptance is intentional field-based validation, not a leak (A-06) — both Baròmetre waves publish `PONDERA`, so a chart using only that field legitimately renders on both. This nuance is documented in-code in `realSurveys.test.ts`, not left as a surprise for a future reader.
- No npm package was added anywhere in this plan (`git diff package.json package-lock.json` empty after all three tasks) — the temptation to add jsdom/React Testing Library for Task 2 was explicitly declined per the plan's threat register (T-05-SC).

## Deviations from Plan

None — plan executed exactly as written. All three tasks' automated `<verify>` commands and acceptance criteria passed as specified, including the two "prove the gate has teeth" destructive checks (corrupt-a-meta-value for Task 1, rename-a-meta-file for Task 3), both reverted cleanly afterward with `git status --short` confirmed clean.

One clarification, not a deviation: the plan's verify block lists `npm run test -- --filter=realSurveys` as a Task 1 automated check; vitest 4's actual filter flag differs from that invocation. The suite was instead verified via the full `npm run test` run (69 passing, up from 46 pre-plan) and a direct read of `src/lib/realSurveys.test.ts`'s own 23 test results within that run — equivalent coverage, no substantive change to what was verified.

## Human-Check Items (Task 3) — Mechanically Verified, No Interactive Browser Available

Per the coordinator's explicit instruction, all five phase success criteria were verified mechanically via `curl` against a running `npm run preview:pages` server (port 4173, production build) and by tracing the relevant source logic, instead of visual/interactive confirmation.

1. **SC-1 (homepage shows exactly three cards, no synthetic card) — PASS (mechanical proxy).** `curl http://localhost:4173/enquestes/data/enquestes_index.json` returns exactly 3 entries: REO1167, REO1151, REO1145, and nothing else. The homepage renders this exact index client-side (unchanged rendering logic from plan 05-01, already covered by passing component-adjacent unit tests). **Not confirmed:** actual card layout/pixels — requires an interactive browser.

2. **SC-2 (each summary shows its own participant count and KPIs, no suppression, no cross-contamination) — PASS (mechanical proxy).** `curl` against each survey's `_meta.json` confirms: REO1167 n=2000 with 6 KPIs, REO1151 n=6706 with 1 KPI, REO1145 n=2000 with 4 KPIs — matching the plan's facts table exactly. Every KPI's `n` field equals its survey's own `n` (2000/6706/2000), all far above `MIN_KPI_SAMPLE=10`, so no suppression text would render. `realSurveys.test.ts` additionally proves this holds for every published KPI, not just a sample. **Not confirmed:** the rendered modal DOM/pixels.

3. **SC-3 (explorer loads its own dictionary/rows; switching surveys shows no trace of the previous one) — PASS (mechanical + code-trace proxy).** `curl` against each survey's `_meta.json` confirms distinct field counts served (283/291/263) and against each `_respostes.parquet` confirms distinct non-zero byte sizes (370098/785455/328452 bytes) — the served layer is per-survey distinct, matching `verify:pages`'s new field-name-set-divergence assertion. Task 2's render-time reset (traced in `src/pages/ExplorerPage.tsx`) guarantees `dataState` — and therefore the dictionary, rows, and `decodedChart` field allow-list — is discarded before render whenever the route id changes. **Not confirmed:** actual drag-a-field-onto-X/Y chart rendering in a live browser session (requires DuckDB-Wasm executing in a real JS engine, which this environment cannot provide).

4. **SC-4 (a `?chart=` link restores on its own survey, degrades silently on a foreign one) — PASS (unit-test proxy, not live-browser proxy).** This one cannot be meaningfully curl-proxied (it is client-side JS state, not a served HTTP resource), so it is verified instead by `src/lib/realSurveys.test.ts`'s share-link block, run against the real field lists: an `IDENTIFICADOR_COMPLET`-only chart round-tripped through `encodeShareLink`/`decodeShareLink` decodes to a defined value against REO1151 (the survey that has the field) and to `undefined` — never throwing — against REO1167 and REO1145 (which lack it). **Not confirmed:** the actual "Copia l'enllaç" click, clipboard write, cross-tab paste, and rendered-chart-vs-empty-canvas visual outcome in a real browser.

5. **SC-5 (deep link to a non-existent survey id shows the not-found message, no retry) — PASS (mechanical proxy).** `curl -o /dev/null -w '%{http_code}' http://localhost:4173/enquestes/data/enquestes/no-existeix-aquesta_meta.json` returns `404`. `ExplorerPage.tsx`'s `SurveyNotFoundError` classifier (`if (res.status === 404) throw new SurveyNotFoundError()`) keys on exactly this signal and routes to the `kind: 'not-found'` branch, which renders `NOT_FOUND_TITLE`/`NOT_FOUND_MESSAGE` with no `onRetry` prop passed to `ErrorState` — confirmed by reading the render branch directly. **Not confirmed:** rendered DOM/screenshot.

All five items' underlying signal — the automatable proxy each criterion reduces to at the HTTP/data/code level — is mechanically confirmed. The purely visual and drag-and-drop interactive confirmation could not be performed in this environment (no interactive browser) and is flagged here explicitly rather than assumed. This mirrors plan 05-01's identical human-check handling.

## Self-Check: PASSED

- FOUND: `src/lib/realSurveys.test.ts`
- FOUND: modified `src/pages/ExplorerPage.tsx` (render-time reset present, `grep -n "status: 'loading'"` returns 3 occurrences)
- FOUND: modified `src/lib/shareLink.test.ts` (stale comment corrected, `grep -c "mostra-sintetica"` returns 0)
- FOUND: modified `scripts/verify-pages.mjs` (catalog-completeness gate present, `npm run verify:pages` passes with "3 enquestes verificades")
- FOUND commit `ad68f97` (Task 1)
- FOUND commit `e7ad9e1` (Task 2)
- FOUND commit `464fa33` (Task 3)
- `npm run lint`, `npm run test` (69 passing), `npm run build`, `npm run verify:pages`, `npm run verify:explorer`, and `uv run scripts/verify_publicacio.py --expect-ids REO1167,REO1151,REO1145` all exit 0
- `git diff package.json package-lock.json` empty across all three tasks

## Next Phase Readiness

- All five phase success criteria (SC-1 through SC-5) are covered by automated gates plus mechanical/code-trace verification; the only unconfirmed items are purely visual/interactive browser confirmations, explicitly flagged above rather than silently assumed — worth a genuine browser pass before considering the phase fully closed if that assurance level matters for this milestone.
- No blockers for closing phase 05 or moving to whatever is next after v1.1.

---
*Phase: 05-catalog-cutover-to-real-data*
*Completed: 2026-09-10*
