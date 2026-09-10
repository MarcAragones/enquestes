---
phase: 05-catalog-cutover-to-real-data
verified: 2026-09-10T07:33:11Z
status: human_needed
score: 5/5 must-haves verified (mechanically/automatically); 1 additional item present+wired but not behaviorally test-exercised
behavior_unverified: 1
overrides_applied: 0
gaps: []
behavior_unverified_items:
  - truth: "ExplorerPage's render-time reset (tracked id + dataState reset to 'loading' when useParams().id changes) actually discards the previous survey's title/rows/dictionary/decodedChart allow-list before anything renders, when a route-param change happens without a full component unmount."
    test: "Mount ExplorerPage (or a harness around it) at /enquesta/A with data loaded, then change only the route param to /enquesta/B without unmounting, and assert the rendered title/dictionary/rows/chart validation immediately reflect B, never A, in the same render pass."
    expected: "dataState resets to 'loading' synchronously at render time; no frame shows A's data under B's id; decodedChart is not computed against A's field list even transiently."
    why_human: "The project has no jsdom/React Testing Library (explicit no-new-dependency constraint — vitest test.environment is 'node'), so this state-transition cannot be exercised by an automated component test. Verified here only via code-pattern mirroring against SurveySummaryModal's identical, already-shipped WR-03 guard and manual code tracing (src/pages/ExplorerPage.tsx lines 98-102). SUMMARY.md itself flags this (D2, human_judgment: true). Separately, this specific path is currently unreachable via the app's own navigation (A-04: every survey-to-survey move goes through the homepage, which unmounts ExplorerPage naturally) — the guard is documented hardening, not a fix for an observed defect."
human_verification:
  - test: "Open a production preview build (npm run preview:pages, http://localhost:4173/enquestes/) and view the homepage."
    expected: "Exactly three survey cards render — the two Baròmetre d'Opinió Política waves and the Enquesta longitudinal — with no synthetic/demo card and no stray text referencing generated/sample data."
    why_human: "Pixel/layout rendering; mechanical curl proxy only confirms the served index JSON has the right 3 entries, not the actual rendered card DOM (SC-1)."
  - test: "Click each of the three cards' summary modal in turn."
    expected: "Each modal shows that survey's own title, date, description, participant count (2.000 / 6.706 / 2.000) and its own KPI tiles (6 / 1 / 4), never another survey's, and never a suppression placeholder."
    why_human: "Modal rendering and KPI tile layout; mechanical curl + realSurveys.test.ts confirm the underlying meta/KPI data is correct and none falls below MIN_KPI_SAMPLE, but not the rendered modal DOM (SC-2)."
  - test: "From each summary, open the explorer, drag a field onto X and another onto Y to build a chart, then navigate back to the catalog and open a different survey's explorer."
    expected: "Each explorer's data dictionary and GraphicWalker field list show only that survey's own fields; dragging fields produces a real chart; no trace of the previously viewed survey's fields appears after switching."
    why_human: "DuckDB-Wasm query execution and GraphicWalker's drag-and-drop interaction require a real browser JS engine, which this execution environment does not have. Code-level guarantees (per-id virtual Parquet filenames in src/services/duckdb.ts, the render-time reset in ExplorerPage.tsx, and the field-name-divergence assertions in verify-pages.mjs/realSurveys.test.ts) are confirmed, but the actual interactive chart-building flow is not (SC-3)."
    priority: high
  - test: "On REO1151, build a chart using IDENTIFICADOR_COMPLET, click 'Copia l'enllaç', open the copied URL in a new tab, then edit only the survey id in that URL to REO1167 and open it."
    expected: "The REO1151 tab restores the exact chart. The edited REO1167 URL loads normally with an empty default chart — no error banner, no blank canvas, no chart built from REO1151's fields."
    why_human: "Clipboard write, cross-tab URL paste, and rendered-chart-vs-empty-canvas are real-browser-only signals. src/lib/realSurveys.test.ts proves the underlying decodeShareLink allow-list logic returns undefined (never throws) for this exact cross-survey case using the real field names, but not the visual/clipboard flow itself (SC-4)."
  - test: "Open http://localhost:4173/enquestes/enquesta/no-existeix-aquesta directly in a browser."
    expected: "The not-found message renders with no retry button — not a spinner, not a load-failure message."
    why_human: "curl confirms the underlying 404 HTTP signal and ExplorerPage.tsx's SurveyNotFoundError classifier is code-traced to route to the correct branch with no onRetry prop, but the actual rendered page was not visually confirmed (SC-5)."
---

# Phase 5: Catalog Cutover to Real Data Verification Report

**Phase Goal:** A visitor to the live site sees only real surveys, and can move between several of them in the catalog and the explorer without anything breaking or bleeding across surveys
**Verified:** 2026-09-10T07:33:11Z
**Status:** human_needed
**Re-verification:** No — initial verification

**Context note:** No interactive browser was available in this verification environment either. Every `<human-check>` item specified in the plans (and repeated in both SUMMARY.md files as "mechanically verified, not visually confirmed") was independently re-checked here via the same class of proxy the executor used — HTTP requests against a locally-run production preview server, direct reads of the source files the SUMMARYs cite, and re-running every automated gate from a clean working tree — plus one additional check the SUMMARYs did not report (deliberately breaking `verify-pages.mjs`'s teeth and confirming the failure, then restoring). All mechanical/automated claims in both SUMMARY.md files were reproduced and confirmed accurate. The purely visual/drag-and-drop items remain genuinely unconfirmed and are carried forward here as human-verification items, per this environment's explicit instruction to route them to `human_needed` rather than fail the phase outright.

## Goal Achievement

### Observable Truths (Phase 5 Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| SC-1 | `mostra-sintetica` is gone: no index entry, no leftover files, deployed homepage lists only real surveys | ✓ VERIFIED (mechanical/data-level); visual card rendering routed to human verification | `public/data/enquestes_index.json` parses to exactly 3 entries (REO1167, REO1151, REO1145), no synthetic entry. `ls public/data/enquestes/` = exactly 6 files. `grep -rn 'mostra-sintetica' public/data src --include='*.json' --include='*.ts' --include='*.tsx' \| grep -v '\.test\.'` = 0 hits. `curl` against a live preview server confirms the served index JSON has exactly the 3 real entries and the retired id's `_meta.json` 404s. `src/pages/HomePage.tsx` genuinely fetches and renders `state.data` from this same index (no hardcoded cards) — Level 4 data-flow confirmed. |
| SC-2 | Homepage grid shows all published real surveys; each summary shows that survey's own participant count and KPIs, with suppression applied where the sample is too small | ✓ VERIFIED (data/logic level); modal rendering routed to human verification | `src/lib/realSurveys.test.ts` (23 tests, `npm run test` = 69/69 passing) proves via `readFileSync`-loaded real meta files that every survey's meta matches its index entry, every published KPI's effective n (2000/6706/2000) is ≥ `MIN_KPI_SAMPLE` (imported, not the literal 10), and separately exercises the suppression predicate itself on both sides of the threshold. `curl` against each `_meta.json` reproduces the same n/KPI counts (6/1/4) reported in SUMMARY.md. |
| SC-3 | Any real survey's `/enquesta/:id` loads that survey's own data and dictionary; switching surveys shows the new survey's fields, never the previous one's | ✓ VERIFIED (structural/data level, one sub-behavior present-but-behavior-unverified — see `behavior_unverified_items`); interactive drag-and-drop routed to human verification | `src/services/duckdb.ts` registers each survey's Parquet under a per-id virtual filename, so the query layer cannot serve one survey's rows for another's id (confirmed by reading the module). `src/pages/ExplorerPage.tsx` lines 98-102 add a render-time reset (`if (id !== trackedId) { setTrackedId(id); setDataState({status:'loading'}) }`), matching `SurveySummaryModal`'s existing WR-03 pattern exactly (confirmed by direct comparison). `realSurveys.test.ts` proves the three surveys' field-name sets are pairwise non-identical (283/291/263 fields) and `verify-pages.mjs` proves the same at the served-HTTP layer, with proven teeth (see Behavioral Spot-Checks). **The render-time reset's actual behavior on an in-place route-param change is not exercised by any test** — flagged as `behavior_unverified` below; SUMMARY.md's own D2 entry independently flags this with `human_judgment: true`. |
| SC-4 | A `?chart=` link copied from one survey restores that exact chart when reopened, and degrades gracefully (no error, no foreign chart) on a different survey | ✓ VERIFIED (logic level via real field-name-grounded unit tests); clipboard/visual flow routed to human verification | `src/lib/realSurveys.test.ts`'s share-link block round-trips real charts through `encodeShareLink`/`decodeShareLink` against the real published field lists: an `IDENTIFICADOR_COMPLET`-only chart decodes on REO1151 (the one survey with that field) and returns `undefined` — never throws — on REO1167 and REO1145; a `PONDERA`-only chart correctly decodes on both Baròmetre waves (shared field, by design, A-06) and is discarded on REO1151; a `gw_count_fid` chart decodes everywhere; a truncated payload returns `undefined` without throwing. `decodeShareLink` itself was not modified (confirmed via `git diff` scope and SUMMARY's explicit statement). |
| SC-5 | A deep link to a non-existent survey id still shows the not-found message, unaffected by the synthetic dataset's removal | ✓ VERIFIED (HTTP/code-trace level); rendered-page visual confirmation routed to human verification | `curl` against a live preview server: `mostra-sintetica_meta.json` → 404, `no-existeix-aquesta_meta.json` → 404, all three real surveys' `_meta.json` → 200 (reproduced independently in this verification pass). `src/pages/ExplorerPage.tsx` lines 188-198 and 249-259 confirm the `SurveyNotFoundError` classifier keys on exactly this 404 and renders `NOT_FOUND_TITLE`/`NOT_FOUND_MESSAGE` with no `onRetry` prop passed — the not-found path is generic (not id-specific), confirmed by code reading, not tied to a hardcoded id. |

**Score:** 5/5 truths verified at the mechanical/automated level; 1 present-but-behaviorally-unverified sub-item (`behavior_unverified: 1`, not counted toward the 5/5); 5 truths each carry at least one visual/interactive item still requiring a real-browser human pass.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/pipeline/index.py` — `compute_index_without_id` | Pure function, sibling of `compute_upserted_index`, raises `SchemaError` on absent id/malformed index | ✓ VERIFIED | `grep -c 'def compute_index_without_id'` = 1; exercised by `ComputeIndexWithoutIdTests` (3 tests) in `pipeline_selftest.py`, part of the 77/77 passing run reproduced here. |
| `scripts/retirar_enquesta.py` | Operator CLI, `--id`/`--data-dir`, write-index-before-unlink ordering, containment guard | ✓ VERIFIED | File exists (5004 bytes). `write_json` call precedes both `unlink` calls (confirmed by line number: `write_json` at line 106, first `unlink` at line 115). Re-ran `uv run scripts/retirar_enquesta.py --id no-existeix --data-dir public/data` in this pass: exits 1, prints `ERROR: cap entrada amb id 'no-existeix'...`, and `git status --porcelain public/data` is empty afterward — refusal + no side effects confirmed independently. |
| `scripts/pipeline_selftest.py` — `ComputeIndexWithoutIdTests`, `RetirarEnquestaTests` | New test classes | ✓ VERIFIED | Present; full suite re-run in this pass: `Ran 77 tests in 0.535s / OK`. |
| `scripts/verify-explorer-assets.mjs` | Index-driven, no hardcoded id/byte-size | ✓ VERIFIED | `grep -c 'mostra-sintetica'` = 0, `grep -c '5597'` = 0. `npm run verify:explorer` re-run: exits 0, "4 DuckDB assets verified". |
| `scripts/generate_mock_parquet.py` | `--out-dir` required, no default | ✓ VERIFIED | `required=True` confirmed at the argparse call site (no `default=` present). |
| `scripts/README.md` | New `retirar_enquesta.py` section; corrected artifact-permanence claim | ✓ VERIFIED | `retirar_enquesta` section present at line 129 with flags table and invocation; artifact-permanence wording corrected (confirmed by reading). |
| `public/data/enquestes_index.json` | 3 entries, synthetic removed | ✓ VERIFIED | Parsed directly: exactly REO1167, REO1151, REO1145 in original relative order. |
| `src/lib/realSurveys.test.ts` | Real-data-grounded regression suite (catalog/dictionary/share-link) | ✓ VERIFIED | 183 lines, `describe`/`it.each` structure confirmed by direct read; `readFileSync` used (not hardcoded field arrays); expands to 23 test cases (`it.each(index)` over 3 surveys across 6 templates plus 5 standalone `it`s = 23), reproduced in `npm run test` (69 total, up from 46). |
| `src/pages/ExplorerPage.tsx` | Render-time survey-change reset | ✓ VERIFIED (presence + wiring); behavior itself unverified — see `behavior_unverified_items` | `trackedId` state + render-time `if (id !== trackedId)` block confirmed at lines 98-102, structurally identical to `SurveySummaryModal`'s existing guard. |
| `scripts/verify-pages.mjs` | Index-driven catalog-completeness gate walking every entry | ✓ VERIFIED | Full file read: walks every index entry, asserts meta id/n/fields and parquet byte length per survey, asserts pairwise field-set non-identity. Confirmed to have teeth in this pass by temporarily renaming `REO1145_meta.json`: re-run failed with `survey 'REO1145': expected 200 for _meta.json, got 404`; file restored, `git status --porcelain public/data` clean afterward. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `retirar_enquesta.py` | `enquestes_index.json` + artifact files | `compute_index_without_id → validate_index → write_json (atomic) → unlink` | ✓ WIRED | Ordering confirmed by line-number comparison (write_json:106 < unlink:115); test coverage confirmed in `pipeline_selftest.py`. |
| `verify_publicacio.py --expect-ids` | published set consistency | exact-set assertion + orphan detection | ✓ WIRED | Re-run in this pass: `uv run scripts/verify_publicacio.py --expect-ids REO1167,REO1151,REO1145` → "Totes les comprovacions han passat (3 enquestes verificades)". |
| `HomePage.tsx` | `enquestes_index.json` | `fetch(dataUrl('enquestes_index.json'))` → `SurveyGrid` | ✓ WIRED / ✓ FLOWING | No hardcoded card data; `state.data` (the parsed fetch result) is passed straight to `SurveyGrid`. Curl-confirmed the served index matches. |
| `ExplorerPage.tsx` `decodedChart` memo | `dataState.data.meta.fields` | `useMemo([rawChartParam, dataState])`, gated on `dataState.status === 'success'` | ✓ WIRED | Confirmed at lines 120-124; the render-time reset (lines 98-102) is what keeps `dataState` paired to the current route id, which is the mechanism SC-3/SC-4's no-bleed guarantee depends on — see `behavior_unverified_items` for the one gap in exercising this pairing under an in-place id change. |
| `verify-pages.mjs` | every published survey's `_meta.json` + `_respostes.parquet` | loop over parsed index, per-entry fetch | ✓ WIRED | Confirmed by full file read and by the rename-and-restore teeth check performed independently in this pass. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| `pipeline_selftest.py` full suite | `uv run scripts/pipeline_selftest.py` | `Ran 77 tests in 0.535s / OK` | ✓ PASS |
| `verify_publicacio.py` exact-set gate | `uv run scripts/verify_publicacio.py --expect-ids REO1167,REO1151,REO1145` | "Totes les comprovacions han passat (3 enquestes verificades)" | ✓ PASS |
| `npm run lint` | `npm run lint` | exit 0, no warnings | ✓ PASS |
| `npm run test` | `npm run test` | `4 passed (4) / 69 passed (69)` | ✓ PASS |
| `npm run build` | `npm run build` | exit 0, dist emitted | ✓ PASS |
| `npm run verify:pages` | `npm run build && node scripts/verify-pages.mjs` | "verify:pages — all checks passed (3 enquestes verificades)" | ✓ PASS |
| `npm run verify:explorer` | `npm run build && node scripts/verify-explorer-assets.mjs` | "verify:explorer — all checks passed (4 DuckDB assets verified)" | ✓ PASS |
| retired id served 404 | `curl -o /dev/null -w '%{http_code}' .../mostra-sintetica_meta.json` | `404` | ✓ PASS |
| real surveys served 200 | `curl` against each `_meta.json` | `REO1167: 200, REO1151: 200, REO1145: 200` | ✓ PASS |
| bad id served 404 | `curl` against `no-existeix-aquesta_meta.json` | `404` | ✓ PASS |
| `retirar_enquesta.py` refuses absent id | `uv run scripts/retirar_enquesta.py --id no-existeix --data-dir public/data` | exit 1, `git status --porcelain public/data` empty afterward | ✓ PASS |
| `verify-pages.mjs` gate has teeth | rename `REO1145_meta.json` → re-run → restore | fails naming REO1145, restored clean | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| PUB-03 | 05-01 | Synthetic dataset retired from catalog once real surveys are published | ✓ SATISFIED | Index/file evidence above; `verify_publicacio.py --expect-ids` gate green. |
| PUB-04 | 05-02 | Catalog and explorer function correctly with multiple real surveys simultaneously | ✓ SATISFIED (mechanical/data level; visual confirmation pending — see human_verification) | `realSurveys.test.ts`, `verify-pages.mjs`, `ExplorerPage.tsx` reset, all confirmed above. |

**Documentation note (not a functional gap):** `.planning/REQUIREMENTS.md` still shows PUB-03 and PUB-04 as unchecked `- [ ]` and "Pending" in its traceability table (lines 14-15, 50-51), unlike PUB-01/02/05 which were marked complete after Phase 4. This appears to be a tracking-doc update that has not yet been run for Phase 5 (typically done at phase/milestone close) — the underlying requirements are functionally satisfied per the evidence above, but the requirements ledger itself has not been updated to reflect it. Flagging as informational so it isn't lost before milestone close.

### Anti-Patterns Found

None. Scanned all 11 files touched by this phase (per `05-REVIEW.md`'s file list) for `TBD`/`FIXME`/`XXX`/`TODO`/`HACK`/`PLACEHOLDER`/"not yet implemented"/etc. — zero matches in every file.

A prior code review (`05-REVIEW.md`, `status: issues_found`, 0 critical / 5 warning / 2 info) flagged robustness gaps: two unhandled-exception edge cases in `index.py`/`retirar_enquesta.py` (malformed JSON, mid-unlink `OSError`), a documented-vs-actual exit-code mismatch in `convert_enquesta.py`'s README table (pre-existing, not introduced by this phase), a missing `useMemo` on `ExplorerPage.tsx`'s `rawFields` prop, and a missing `spawn` error listener shared by both verification scripts. None of these contradict a phase must-have, none are on the happy path this phase's success criteria depend on, and none were newly introduced defects in the retirement/cutover logic itself — they are quality/robustness improvements, correctly triaged as warnings/info rather than blockers. Listed here for completeness, not counted as a verification gap.

### Human Verification Required

See YAML frontmatter `human_verification` and `behavior_unverified_items` — 5 visual/interactive items (one per phase success criterion) plus 1 present-but-behaviorally-unverified state-transition item (`ExplorerPage`'s render-time reset), none of which have automated coverage possible in this environment (no interactive browser, no jsdom/React Testing Library by explicit project constraint).

### Gaps Summary

No gaps found. Every automated/mechanical check specified in both plans' `<verify>` blocks and acceptance criteria was independently re-run in this verification pass and passed, matching what both SUMMARY.md files claimed. The phase's code-level, data-level, and HTTP-level evidence for all 5 roadmap success criteria is solid and non-vacuous (the two "teeth" checks — corrupt-a-meta-value for the test suite, rename-a-meta-file for `verify-pages.mjs` — were independently reproduced here, not just trusted from the SUMMARY). The phase is not blocked; it needs a human with a real browser to close out the visual/interactive confirmations both plans explicitly deferred (their `<human-check>` blocks) and that this execution environment, like the executor's, cannot perform.

---

*Verified: 2026-09-10T07:33:11Z*
*Verifier: Claude (gsd-verifier)*
