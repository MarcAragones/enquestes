---
phase: 05-catalog-cutover-to-real-data
plan: 03
subsystem: ui
tags: [share-link, graphic-walker, vitest, url-length, catalog, clipboard]

requires:
  - phase: 05-catalog-cutover-to-real-data (plan 01)
    provides: "three real surveys (REO1167, REO1151, REO1145) as the only public/data/ entries, with 283/291/263 fields respectively"
  - phase: 05-catalog-cutover-to-real-data (plan 02)
    provides: "src/lib/realSurveys.test.ts real-data-grounded regression suite; diagnosis of G-05-4 in 05-UAT.md"
provides:
  - "src/lib/shareLink.ts — encodeShareLinkResult discriminated result, catalogue-stripping encoder, MAX_SHARE_PARAM_LENGTH enforced on the encode side (previously decode-only)"
  - "src/lib/shareChartCatalogue.ts — buildFieldCatalogue/withFieldCatalogue, a hand-rolled (non-imported) mirror of GraphicWalker's newChart catalogue construction, pinned by a drift test"
  - "src/lib/copyLink.ts — buildShareUrl and three Catalan failure messages, tested independently of DOM"
  - "ExplorerHeader.tsx failure-message UI (aria-live/role=status) for a copy-link attempt that cannot produce a link"
affects: [any future phase touching the ?chart= share-link contract, GraphicWalker version upgrades, the copy-link UX]

actuals:
  tokens: 13032
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "Discriminated result type (EncodeShareLinkResult: ok:true|{ok:false,reason}) at a module boundary, with the pre-existing null-returning function reduced to a thin wrapper over it — lets a UI caller distinguish failure reasons without breaking any existing null-contract call site."
    - "Hand-roll a third-party library's small, stable internal data-shape construction instead of importing it into the production bundle, and lock the duplication to the installed version with a test-only import of the library's own real implementation via its supported subpath export map — pays the drift risk in CI, not in bundle size."
    - "Catalan UI failure messages live as named exports beside the pure function that produces the outcome (copyLink.ts), not inside the component that renders them — makes wording unit-testable in a project with no component-rendering test tooling."

key-files:
  created:
    - src/lib/shareChartCatalogue.ts
    - src/lib/shareChartCatalogue.test.ts
    - src/lib/copyLink.ts
    - src/lib/copyLink.test.ts
  modified:
    - src/lib/shareLink.ts
    - src/lib/shareLink.test.ts
    - src/lib/realSurveys.test.ts
    - src/pages/ExplorerPage.tsx
    - src/components/ExplorerHeader.tsx

key-decisions:
  - "Kept the wire tag at v1 (did not bump to v2): the new stripped-catalogue payload is a strict SUBSET of what the existing v1 decoder already accepts (isChartLike only requires visId + an encodings object; collectShelfFieldReferences never inspects dimensions/measures), so no link already shared into the wild is invalidated, and any link that was already over 4096 characters never decoded anyway."
  - "Corrected an inaccurate claim in shareLink.ts's SHELF_CHANNEL_KEYS doc comment: GraphicWalker does NOT rebuild the field catalogue from the rawFields prop at mount time. Traced through the installed library source (fillChart merges the spec's own encodings over emptyEncodings; VizSpecStore's dimensions/measures getters read currentEncodings directly) — the field panel renders whatever catalogue the SPEC carried. This is why rehydration (shareChartCatalogue.ts) is mandatory, not optional: stripping the catalogue without rebuilding it would leave a restored chart's field panel empty."
  - "shareChartCatalogue.ts hand-rolls GraphicWalker's newChart() catalogue construction instead of importing it, to avoid ~332 KB minified of duplicated library code in this $0-budget static bundle. The drift risk this creates is paid for in shareChartCatalogue.test.ts (a test-only import of the library's real newChart via its supported ./* subpath export map), not in production bytes — a future @kanaries/graphic-walker upgrade that changes the catalogue shape fails loudly in CI instead of silently emptying a restored chart's field panel in the browser."
  - "Narrowed D-07's silent-fallback posture for the copy-link action specifically (not for decoding an inbound link, which keeps its existing silent-fallback behaviour unchanged): D-07 governs a stale/malformed INBOUND ?chart= link, which the visitor never asked about, where an error would be noise. The copy-link button is an action the visitor explicitly clicked — silence there is indistinguishable from success, which is exactly what let a 57 KB unopenable link reach a real user in G-05-4."

patterns-established:
  - "When a third-party library's internal construction logic must be duplicated to avoid a bundle-size cost, pin the duplicate against the library's own real output via a test-only import of a library subpath, and document the bundle-size rationale in both the production module's doc comment and the test file's header comment."

requirements-completed: [PUB-04]

coverage:
  - id: D1
    description: "encodeShareLink strips encodings.dimensions/measures and enforces MAX_SHARE_PARAM_LENGTH on its own output (previously decode-only); encodeShareLinkResult exposes why an encode failed"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "src/lib/shareLink.test.ts (round-trip + encodeShareLinkResult describe blocks)"
        status: pass
      - kind: unit
        ref: "src/lib/realSurveys.test.ts 'wide-survey share links (G-05-4)' block — all 3 published surveys, real field counts (283/291/263)"
        status: pass
    human_judgment: false
  - id: D2
    description: "shareChartCatalogue.ts rebuilds a decoded chart's field catalogue unconditionally from the currently-loaded survey's own fields (withFieldCatalogue), restoring the field panel after a share-link navigation"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "src/lib/shareChartCatalogue.test.ts (10 tests: drift pin against newChart, empty/dimension-only/measure-only, overwrite-a-foreign-field, idempotence, never-throws)"
        status: pass
      - kind: unit
        ref: "src/lib/realSurveys.test.ts withFieldCatalogue-vs-newChart deep-equal assertion, per published survey"
        status: pass
    human_judgment: false
  - id: D3
    description: "Copy-link button shows a visible Catalan failure message (aria-live) and writes nothing to the clipboard when a chart cannot fit the share-link cap or cannot be serialised"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "src/lib/copyLink.test.ts (8 tests: success path, param replacement, both failure reasons, malformed href, never-throws, message-wording constraints)"
        status: pass
      - kind: other
        ref: "npm run build + npm run lint (onCopyLink's Promise<CopyLinkOutcome> type-checks end to end ExplorerPage -> ExplorerHeaderProps); grep -c aria-live src/components/ExplorerHeader.tsx = 1"
        status: pass
    human_judgment: true
    rationale: "The project has no jsdom/React Testing Library (explicit no-new-dependency constraint carried from plan 05-02's D2), so the actual rendered failure-message element, its aria-live announcement, and the visual red/danger styling cannot be exercised by an automated component test. Verified here by type-checking, lint, and direct code reading against the plan's acceptance criteria; a human browser pass should confirm the rendered UI."
  - id: D4
    description: "buildFieldCatalogue is pinned against the installed @kanaries/graphic-walker's own newChart() catalogue construction, so a future library upgrade that changes the shape fails a test instead of silently breaking the field panel"
    requirement: "PUB-04"
    verification:
      - kind: unit
        ref: "src/lib/shareChartCatalogue.test.ts 'drift pin against the installed library' describe block"
        status: pass
    human_judgment: false
  - id: D5
    description: "Full publication gate set (test, lint, build, verify:pages, verify:explorer) stays green, and the human walkthrough that originally found G-05-4 (UAT test 4) passes on a real browser"
    verification:
      - kind: unit
        ref: "npm run test — 105/105 passing"
        status: pass
      - kind: other
        ref: "npm run lint, npm run build, npx tsc -b — all exit 0"
        status: pass
      - kind: other
        ref: "npm run verify:explorer — 4 DuckDB assets verified (clean run, own port)"
        status: pass
      - kind: other
        ref: "verify:pages logic re-run manually against this worktree's own dist/ on port 4174 (npm run verify:pages's own script collided with an unrelated, pre-existing process on port 4173 — see Issues Encountered) — 3 enquestes verificades"
        status: pass
      - kind: manual_procedural
        ref: "UAT test 4 walkthrough (05-UAT.md) on a real browser via npm run preview:pages"
        status: unknown
    human_judgment: true
    rationale: "No interactive browser is available in this execution environment. Every automated verification in Task 3 was run and passed (see above); the human-check step re-running UAT test 4 in a real browser was NOT performed and is explicitly flagged, not silently assumed, exactly as plans 05-01 and 05-02 did for their own human-check items."

duration: "~66 min wall-clock, including a ~60 min pause at the Task 1 tracer checkpoint awaiting human verification (config.json's workflow.auto_advance/_auto_chain_active are both false, so this plan is not auto-mode); active execution across the 3 tasks was roughly 10-15 min"
completed: 2026-09-24
status: complete
---

# Phase 05 Plan 03: Close G-05-4 — Wide-Survey Share Links No Longer 431 Summary

**A share link copied from the 291-field REO1151 survey now encodes to ~1,166 characters instead of ~57,357 — under 4096-char `MAX_SHARE_PARAM_LENGTH` and both URL-length thresholds — by stripping GraphicWalker's field catalogue before serialising and rebuilding it unconditionally from the loaded survey's own fields on decode; a chart that genuinely cannot fit the cap now fails the copy-link button loudly with a Catalan message instead of silently handing the visitor a link that 431s.**

## Performance

- **Duration:** ~66 min wall-clock (includes a ~60 min pause at the Task 1 tracer checkpoint awaiting human verification before Tasks 2-3 were authorized to proceed)
- **Started:** 2026-09-24T15:5X (first Read of plan files)
- **Completed:** 2026-09-24T17:1X
- **Tasks:** 3/3 completed
- **Files modified:** 9 (4 created, 5 modified)

## Accomplishments

- **`src/lib/shareLink.ts`**: `encodeShareLink`'s encoder now strips `encodings.dimensions`/`.measures` (the field catalogue, never needed on the wire) before serialising, and enforces `MAX_SHARE_PARAM_LENGTH` on its own output via the same constant `decodeShareLink` already enforced on the way in — closing the gap where the cap only ever guarded decode, never encode. New `encodeShareLinkResult` exposes *why* an encode failed (`too-long` with the would-be length, or `unserializable`) for the copy-link UI to act on; `encodeShareLink` is now a thin null-returning wrapper so every pre-existing call site's contract is unchanged. `decodeShareLink`'s own validation (steps 1-7) is byte-for-byte untouched — proven by the full pre-existing hostile-input test suite passing with unchanged assertions.
- **`src/lib/shareChartCatalogue.ts`** (new): `buildFieldCatalogue`/`withFieldCatalogue` hand-roll GraphicWalker's `newChart()` catalogue construction (real fields + the three virtual entries: measure-names, count, measure-values) without importing the library into the production bundle (~332 KB minified avoided). `withFieldCatalogue` unconditionally replaces a decoded chart's catalogue with the currently-loaded survey's own fields — restoring a usable field panel after a share-link navigation, and incidentally hardening against a stale/crafted payload injecting a foreign field pill (T-05-13).
- **`src/lib/copyLink.ts`** (new): `buildShareUrl(href, spec)` — pure, DOM-free — wraps `encodeShareLinkResult`, maps its failure reasons to two Catalan messages, and replaces (never appends) an existing `chart=` param. Never throws on a malformed href.
- **`src/pages/ExplorerPage.tsx`**: `onCopyLink` now returns `Promise<CopyLinkOutcome>` and surfaces a clipboard-write failure instead of swallowing it (deliberately narrowing D-07's silent-fallback posture for this specific visitor-initiated action — see Key Decisions). `decodedChart`'s memo now pipes a defined `decodeShareLink` result through `withFieldCatalogue` before the `IChart[]` cast; the `decodeShareLink` call and its `knownFieldNames` argument are unchanged.
- **`src/components/ExplorerHeader.tsx`**: the boolean `copied` state is replaced by a `CopyFeedback` union. A failed copy never shows the success label — instead an `aria-live="polite" role="status"` message renders next to the button for six seconds (versus two for success), reset at the start of every new attempt.
- **`src/lib/shareChartCatalogue.test.ts`** (new, 10 tests): pins `buildFieldCatalogue` against the installed `@kanaries/graphic-walker`'s real `newChart()` output — for a synthetic mixed field list, for the real widest published survey, for empty/dimension-only/measure-only inputs, and specifically for the count entry's `computed`/`expression` shape.
- **`src/lib/copyLink.test.ts`** (new, 8 tests) and **`src/lib/shareLink.test.ts`**/**`src/lib/realSurveys.test.ts`** (extended): cover the new encode contract, both failure reasons, the legacy back-compat decode path, and — grounded in the real published data, not fixtures — that all three surveys' widest-realistic chart now fits the cap and both URL-length thresholds.

## Task Commits

Each task was committed atomically (Tasks 1-2 are `tdd="true"`, following RED then GREEN):

1. **Task 1: End-to-end — a 291-field survey's share link fits the URL and restores the same chart** (`type="tracer"`)
   - `96b5d0f` — test (RED): failing tests for share-link catalogue stripping
   - `377d861` — feat (GREEN): strip field catalogue from share links, cap encoder output
2. **Task 2: Copy-link fails loudly instead of handing the visitor an unopenable URL**
   - `646a099` — test (RED): failing tests for copy-link failure UX
   - `412eb70` — feat (GREEN): copy-link fails loudly instead of an unopenable URL
3. **Task 3: Pin the rebuilt catalogue to GraphicWalker's own newChart, then run the full publication gates**
   - `45a748b` — test: pin buildFieldCatalogue against the library's real newChart

**Plan metadata:** this commit (docs: complete plan)

## Files Created/Modified

- `src/lib/shareLink.ts` — encoder strips the field catalogue, enforces `MAX_SHARE_PARAM_LENGTH`, exposes `encodeShareLinkResult`; corrected `SHELF_CHANNEL_KEYS` doc comment; decoder untouched
- `src/lib/shareChartCatalogue.ts` (new) — `buildFieldCatalogue`/`withFieldCatalogue`
- `src/lib/shareChartCatalogue.test.ts` (new) — drift pin + `withFieldCatalogue` behaviour, 10 tests
- `src/lib/copyLink.ts` (new) — `buildShareUrl` + three Catalan message constants
- `src/lib/copyLink.test.ts` (new) — 8 tests
- `src/lib/shareLink.test.ts` — updated round-trip contract, new `encodeShareLinkResult`/too-long/unserializable/back-compat tests
- `src/lib/realSurveys.test.ts` — new `wide-survey share links (G-05-4)` block, real-data-grounded
- `src/pages/ExplorerPage.tsx` — `onCopyLink` returns `CopyLinkOutcome`; `decodedChart` pipes through `withFieldCatalogue`
- `src/components/ExplorerHeader.tsx` — `CopyFeedback` union, `aria-live` failure message

## Decisions Made

See `key-decisions` in frontmatter (wire tag kept at `v1`; corrected catalogue-source finding; hand-roll-and-pin strategy for the catalogue construction; deliberate narrowing of D-07's silent-fallback posture for the copy-link action only).

## Deviations from Plan

### Auto-fixed Issues

None — no Rule 1/2/3 auto-fixes were needed; the plan's design (already fully diagnosed in `05-UAT.md` before this plan was written) matched the codebase as found.

### Noted, not fixed — a plan-text imprecision found during Task 3

**Task 3's acceptance criterion states:** `grep -rn 'models/visSpecHistory' src/` matches only `src/lib/shareChartCatalogue.test.ts`. In practice it also matches:
- `src/lib/realSurveys.test.ts:11` — a genuine, deliberate `import { newChart } from '@kanaries/graphic-walker/models/visSpecHistory'`, explicitly specified by Task 1's own `<action>`/`<behavior>` text ("Builds the 'original' chart the way the app really does: `newChart(...)` imported from `@kanaries/graphic-walker/models/visSpecHistory`"). This was written and committed in Task 1, per the plan itself, before Task 3's narrower criterion was reached.
- Two prose doc-comment mentions of the file path (`src/lib/shareLink.ts`, `src/lib/shareChartCatalogue.ts`), not import statements.

The **substantive** invariant Task 3's criterion protects — the library subpath never reaches the PRODUCTION browser bundle — holds: only `.test.ts` files import the value at runtime, `src/lib/shareChartCatalogue.ts`'s own runtime code never imports it, and `dist/assets/*.js` was inspected directly after a fresh `npm run build` with no evidence of an additional duplicated `models/visSpecHistory` chunk (the one `gw_mea_key_fid` occurrence found there is the pre-existing main GraphicWalker library bundle's own internal constant, already shipped for the `<GraphicWalker>` component regardless of this plan). Treated as a minor internal inconsistency between Task 1's explicit design and Task 3's literal wording, not a code defect — no source change was made to chase the literal grep count.

---

**Total deviations:** 0 auto-fixed; 1 noted plan-text imprecision (documented above, no code change).
**Impact on plan:** None on correctness or security. All threat-register mitigations (T-05-12, T-05-13, T-05-14, T-05-16) are implemented and tested as specified.

## Issues Encountered

- **`npm run verify:pages` port collision (environmental, not a code defect).** The npm script's own spawned preview server failed to bind port 4173 (`EADDRINUSE`) because an unrelated, long-running `node scripts/gh-pages-preview.mjs` process (PID 12641, elapsed ~2h13m at time of investigation) was already listening there — confirmed via `lsof`/`ps` to have a working directory of `/Users/marcaragones/Github/enquestes` (the **main** checkout, not this worktree), i.e. it predates this session and belongs to unrelated work, not something this plan started or should tear down. Despite the crash, the npm script itself still reported `exit 0` / "all checks passed" because its HTTP checks incidentally succeeded against that pre-existing (but WRONG — a different checkout's `dist/`) server. To get a trustworthy result, the exact check logic from `scripts/verify-pages.mjs` was re-run manually against a server started on the free port 4174, serving THIS worktree's own freshly built `dist/` — it passed cleanly ("3 enquestes verificades"), then the manual server was stopped. `npm run verify:explorer` (which uses port 4174 itself) ran and passed cleanly via its own npm script with no collision. This is flagged here as an environmental note for whoever next runs `verify:pages` in this shared machine — the stray process on 4173 should eventually be stopped by whoever owns it, but that was left untouched here since it belongs to a different checkout and might be another concurrent agent's or the user's own session.
- No other issues.

## User Setup Required

None — no external service configuration required.

## Known Stubs

None.

## Human-Check Item (Task 3) — Not Performed, No Interactive Browser Available

Per the plan's `<verify>` for Task 3, UAT test 4 (05-UAT.md) should be re-walked on a real browser against `npm run preview:pages`: build a chart on REO1151, click "Copia l'enllaç", confirm the success label, paste the URL in a new tab and confirm (a) no HTTP 431, (b) the restored chart shows the same fields on the same shelves, (c) the field list is populated so a third field can still be dragged, then confirm an edited-survey-id URL (REO1167) loads normally with an empty default chart.

**This was NOT performed** — no interactive browser is available in this execution environment, exactly as documented for plans 05-01 and 05-02's own human-check items. Every automated verification for Task 3 (and the whole plan) was run and passed:

- `npm run test` — 105/105 passing (up from 87 pre-plan)
- `npx tsc -b`, `npm run lint`, `npm run build` — all exit 0
- `npm run verify:explorer` — 4 DuckDB assets verified, clean run
- `verify:pages`'s exact check logic — manually re-run against this worktree's own build, 3 enquestes verificades (see Issues Encountered for why the npm script itself needed a manual re-run)
- Measured, from the real published data (`realSurveys.test.ts`'s `wide-survey share links (G-05-4)` block, all three surveys, `it.each`):

| Survey | Fields | Realistic chart JSON (old payload driver) | Old param (base64url, unstripped) | New param (stripped + capped) |
|---|---|---|---|---|
| REO1167 | 283 | 40,607 chars | ≈54,147 chars | **1,154 chars** |
| REO1151 | 291 | 43,014 chars | ≈57,355 chars | **1,166 chars** |
| REO1145 | 263 | 36,636 chars | ≈48,851 chars | **1,154 chars** |

All three new param lengths are under `MAX_SHARE_PARAM_LENGTH` (4096) and both URL-length thresholds (8,192 browser-safe; 16,384 Node's header limit — the exact limit that produced the observed HTTP 431). A genuine browser pass of UAT test 4 is recommended before treating G-05-4 as fully closed for the milestone, matching the same caveat plans 05-01 and 05-02 already carry for their own unconfirmed visual/interactive items.

## Next Phase Readiness

- G-05-4 is closed at the code/test level: both `missing[]` items from `05-UAT.md` (strip-and-cap the encoder, fail the copy-link action loudly) are implemented and covered by unit tests grounded in the real published data.
- Threat register: T-05-12 (DoS via oversized self-inflicted URL) and T-05-14 (decoder regression risk) are both `high`-severity `mitigate` dispositions with automated gates, both passing. T-05-13 (foreign catalogue injection) and T-05-16 (library-upgrade drift) are `medium` `mitigate`, both passing.
- Outstanding before treating the phase as fully closed: a genuine browser pass of UAT test 4 (Task 3's `<human-check>`), which this environment could not perform — see above.
- No blockers for merging this plan; the stray port-4173 process noted under Issues Encountered is an unrelated environmental artifact, not something this plan introduced or needs to fix.

## Self-Check: PASSED

- FOUND: `src/lib/shareChartCatalogue.ts`
- FOUND: `src/lib/shareChartCatalogue.test.ts`
- FOUND: `src/lib/copyLink.ts`
- FOUND: `src/lib/copyLink.test.ts`
- FOUND: modified `src/lib/shareLink.ts` (encoder strips catalogue, `encodeShareLinkResult` present — `grep -c` returns 2)
- FOUND: modified `src/lib/shareLink.test.ts`
- FOUND: modified `src/lib/realSurveys.test.ts` (`wide-survey share links (G-05-4)` block present)
- FOUND: modified `src/pages/ExplorerPage.tsx` (`withFieldCatalogue` present — `grep -c` returns 2)
- FOUND: modified `src/components/ExplorerHeader.tsx` (`aria-live` present — `grep -c` returns 1)
- FOUND commit `96b5d0f` (Task 1 test/RED)
- FOUND commit `377d861` (Task 1 feat/GREEN)
- FOUND commit `646a099` (Task 2 test/RED)
- FOUND commit `412eb70` (Task 2 feat/GREEN)
- FOUND commit `45a748b` (Task 3 test)
- FOUND commit `62cf22e` (plan metadata / SUMMARY.md)
- `npm run test` (105/105), `npx tsc -b`, `npm run lint`, `npm run build`, `npm run verify:explorer` all exit 0; `verify:pages`'s check logic passed when manually re-run against this worktree's own build (see Issues Encountered)
- `git diff --stat 7d7793d..HEAD -- src/ package.json` touches exactly the 9 files in the plan's `files_modified`; `package.json`/`package-lock.json` untouched

---
*Phase: 05-catalog-cutover-to-real-data*
*Completed: 2026-09-24*
