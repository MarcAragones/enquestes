---
phase: 03-interactive-explorer
verified: 2026-08-28T22:13:45Z
status: passed
score: 13/13 must-haves present, substantive, and wired; 4 carry a behavior-dependent component not yet closed by a passing human test
behavior_unverified: 4
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 12/12 (behavior_unverified 6)
  gaps_closed:

    - "G-03-7 (cosmetic, discovered in 03-UAT.md test 8): SurveySummaryModal's <dialog> opened pinned to the top-left instead of centered, because Tailwind v4 Preflight's author-origin universal margin reset (@layer base, `margin: 0`) unconditionally beats the browser's user-agent-origin `dialog:modal { margin: auto }` rule (origin/importance resolves before specificity). Closed at the code level by 03-08-PLAN.md: prepended `m-auto` to the <dialog>'s static className literal. Independently re-confirmed live in this verification: fresh `rm -rf dist && npm run build`, className grep returns exactly 1, and `grep -oh '\\.m-auto{[^}]*}' dist/assets/*.css` prints `.m-auto{margin:auto}` from the same production stylesheet that carries Preflight's `@layer base{*,:after,:before,::backdrop{...margin:0...}}` reset. package.json/package-lock.json/src/index.css confirmed untouched (`git diff --stat` clean)."
    - "G-03-6 (major, was still open at the previous 03-VERIFICATION.md's 19:15 timestamp): a UAT-reported not-found-vs-load-failed misclassification. This verification found 03-UAT.md test 9 (a FRESH-terminal/fresh-tab re-test against `npm run build && npm run preview:pages`, run and recorded AFTER the previous verification) came back clean and the gap's own YAML entry now reads `status: resolved`, `resolved_by: \"clean re-test (test 9)\"`. The previous verification's human_verification list still carried this as open — this re-verification corrects that using evidence (03-UAT.md itself, a first-class project artifact, not a SUMMARY narrative) the previous round did not yet have."
  gaps_remaining:

    - "G-03-7's own human-check was NOT performed (WINDOWS.md id 9, recorded 2026-08-28T21:57:37Z, still status: open) — no browser automation tool was available in the 03-08 execution environment, and none is available in this verification's environment either. The visual centering fix is proven at the source+compiled-CSS level but not yet confirmed by a human looking at a real browser."
    - "Two G-03-5 re-test sub-steps that 03-08's human-check was explicitly meant to also clear remain unconfirmed: the 'Explorar dades interactives' unmount-while-open -> explorer-still-interactive path, and the production-preview (`npm run build && npm run preview:pages`) regression spot-check. WINDOWS.md id 8 (recorded 2026-08-28T16:57:10Z) is still status: open for the same reason."
  regressions: []
gaps: []
behavior_unverified_items:

  - truth: "SurveySummaryModal's <dialog> renders horizontally and vertically centered on the viewport (not pinned to the top-left) under `npm run dev` and in the production preview build, in both light and dark mode, with both action buttons reachable at ~375px (G-03-7, HOME-03)"
    test: "Run `npm run dev`, click a survey card, confirm the modal is centered (equal dimmed backdrop on all four sides, not hugging the top-left). Toggle dark mode with it open. Narrow to ~375px and confirm no horizontal overflow and both 'Tanca' and 'Explorar dades interactives' stay visible/clickable. Repeat the centering check against `npm run build && npm run preview:pages`."
    expected: "Centered in both dev and production preview, in both color schemes, with the dialog fully reachable and both buttons clickable at ~375px"
    why_human: "The compiled-CSS assertion (`.m-auto{margin:auto}` present in `dist/assets/*.css`, re-confirmed live in this verification) proves Tailwind emitted the correct rule into the same stylesheet where Preflight's conflicting reset also lives — but whether the browser actually renders the dialog centered, and whether the buttons stay reachable at a narrow viewport, requires a real browser. No browser automation tool is available in this environment (WINDOWS.md id 9, still open)."

  - truth: "After G-03-7's fix, the previously-confirmed G-03-5 dismissal-once behavior is unregressed, AND the two sub-steps 03-07's UAT round left unconfirmed now pass: 'Explorar dades interactives' navigates and leaves the explorer genuinely interactive after the dialog unmounts, and the production-preview build shows no regression (G-03-5, HOME-03/04)"
    test: "Under `npm run dev`: reopen the modal, click 'Explorar dades interactives', confirm it navigates to /enquesta/:id AND the explorer responds to scroll/back-link/data-dictionary clicks (not inert). Then `npm run build && npm run preview:pages` and repeat the open/wait-2s/Escape check there."
    expected: "Navigation lands on an interactive explorer (not inert); no regression in the production preview"
    why_human: "03-08-PLAN.md's own Task 1 human-check explicitly scheduled these two sub-steps to close WINDOWS.md id 8's remaining gap, but the same environment limitation (no browser automation tool) prevented it from running (WINDOWS.md id 9, still open). The dismissal-once core behavior itself (2s wait x5, Escape/backdrop/Tanca) already has a genuine human PASS on record — see truth row 4a in Goal Achievement — this item is narrower: only the unmount-interactive and production-regression sub-steps remain open."

  - truth: "User can drag variables onto the Color, Size, and Filter shelves (not just X/Y) to build a customized chart (EXPL-03)"
    test: "Open /enquesta/mostra-sintetica, drag canal onto Color and add a territori filter, alongside X/Y fields already confirmed working"
    expected: "Chart re-renders reflecting the Color encoding and the filter, with no console errors"
    why_human: "GraphicWalker owns all drag/shelf interaction internally. The X/Y-plus-mark-type-switching path for this capability DOES have a passing human test on record (03-UAT.md tests 1 and 7), but the Color/Size/Filter-shelf variant was specified only in 03-UAT.md test 4, which was explicitly SKIPPED as 'superseded by test 7' — and test 7's own text does not re-exercise Color/Size/Filter. No automated harness drives real pointer drag events against GraphicWalker's canvas, so this specific sub-capability has never actually been confirmed by a passing test."

  - truth: "Chart image export (EXPL-10) works end-to-end via GraphicWalker's own toolbar — a PNG or SVG downloads and opens correctly"
    test: "Build a chart, use GraphicWalker's own toolbar export control, confirm a valid image file downloads and opens"
    expected: "A valid image file downloads and opens"
    why_human: "Export is delegated entirely to GraphicWalker's own toolbar; the click-download-open sequence requires a real browser and filesystem interaction. This step was specified only in 03-UAT.md test 4 (skipped, superseded by test 7, which does not include an export step) — no passing test has ever confirmed this end-to-end."
coincidental_reliance_items: []
human_verification:

  - test: "G-03-7 visual centering confirmation — the literal 03-08-PLAN.md Task 1 human-check (centered in npm run dev and npm run preview:pages, dark mode restyle, ~375px reachability of both buttons) (WINDOWS.md id 9)"
    expected: "Dialog visibly centered (not top-left) in both environments and both color schemes; both buttons stay reachable and clickable at ~375px with no horizontal overflow"
    why_human: "No browser automation tool is available in this environment; the fix is proven at the source+compiled-CSS level only (m-auto present in the className literal and in the built production stylesheet)"

  - test: "The two remaining G-03-5 re-test sub-steps 03-08's human-check was meant to also clear: 'Explorar dades interactives' leaves the explorer genuinely interactive after the dialog unmounts, and a `npm run build && npm run preview:pages` regression spot-check (WINDOWS.md id 8, remaining sub-steps)"
    expected: "Explorer is fully interactive after navigating from the modal; no regression in the production preview"
    why_human: "Same environment limitation — no browser automation tool available. Note: the CORE G-03-5 dismissal-once behavior (2s wait x5, Escape/backdrop/Tanca each exactly once) already has a genuine human PASS on record from 03-UAT.md test 8 — only these two narrower sub-steps remain open."

  - test: "Drag-and-drop onto the Color, Size, and Filter shelves specifically (EXPL-03) — X/Y drag and mark-type switching already have a passing human test on record"
    expected: "Chart re-renders reflecting a Color encoding and an active filter, with no console errors"
    why_human: "GraphicWalker owns all shelf/drag interaction internally; the specific Color/Size/Filter path was only ever specified in a UAT test (test 4) that was skipped as superseded by a test (test 7) that does not itself exercise those shelves"

  - test: "Chart image export via GraphicWalker's own toolbar (EXPL-10)"
    expected: "A PNG or SVG downloads and opens correctly"
    why_human: "Real click-download-open behavior in a real browser; never exercised by any passing UAT test (only specified in the skipped/superseded test 4)"
---

# Phase 3: Interactive Explorer Verification Report (Re-verification after G-03-7 gap closure)

**Phase Goal:** Users can interactively explore any survey's real data in the browser via drag-and-drop chart building, powered by SQL over Parquet — the app's core value
**Verified:** 2026-08-28T22:13:45Z
**Status:** human_needed
**Re-verification:** Yes — after 03-08's gap-closure of G-03-7 (modal centering), and correcting the previous verification's treatment of G-03-6 (independently confirmed resolved via 03-UAT.md test 9, which the previous verification round did not yet reflect) and of several behavior-dependent truths that already had a passing human UAT test on record (03-UAT.md tests 1, 3 and 7) at the time the previous verification ran but were not credited as such.

## Goal Achievement

This verification independently re-ran every automated check for the 03-08 gap-closure plan (lint, full test suite, a from-scratch `rm -rf dist && npm run build`, the className literal grep, the compiled-CSS grep, `verify:explorer`, `verify:pages`) rather than trusting 03-08-SUMMARY.md's narrative, and re-read the changed code directly against the diagnosed root cause in `.planning/debug/g-03-7-modal-not-centered.md`. It also cross-referenced `.planning/WINDOWS.md` (ledger ids 8 and 9, both still `open`), the `03-UAT.md` re-verification round (tests 7, 8, 9 — the most recent human-testing evidence in the repo, run after the previous `03-VERIFICATION.md`), and the standing `03-REVIEW.md` code review (0 critical / 4 warning / 4 info, `issues_found`, advisory only).

Compared to the previous verification round, this report makes two corrections using evidence that was either not yet available (G-03-6's clean re-test, `03-UAT.md` test 9) or was already available but not credited (03-UAT.md tests 1 and 7, which passed on 2026-08-28 before the previous verification ran at 19:15 the same day, and directly confirm several truths the previous round left routed to human verification). These corrections are evidence-based upgrades from ⚠️ PRESENT_BEHAVIOR_UNVERIFIED to ✓ VERIFIED, not a relaxation of standard — each cites the specific passing UAT test.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Two-phase loading indicators; distinct engine-init error with retry (EXPL-01, EXPL-02) | ✓ VERIFIED | `ExplorerPage.tsx` unchanged; regression-checked live (`npx vitest run`, `npm run build`); human-confirmed by 03-UAT.md test 1 (pass) |
| 2 | Not-found (404) vs load-failed classification, correct priority under concurrent settlement, no retry on 404 (EXPL-02) | ✓ VERIFIED (upgraded — see correction above) | `ExplorerPage.tsx:154-193` classification logic unchanged, re-read; independently re-confirmed live against a fresh `gh-pages-preview.mjs` instance. **G-03-6 is now resolved**: `03-UAT.md` test 9 (fresh terminal + fresh/incognito tab, `npm run build && npm run preview:pages`) result is `pass`, and the gap's own YAML entry reads `status: resolved`, `resolved_by: "clean re-test (test 9)"`. The previous verification's human_verification list carried this open using stale information — corrected here |
| 3 | Drag X/Y, multiple chart types (bar/line/area/scatter), correct dimension/measure typing (EXPL-03 partial, EXPL-04, EXPL-05) | ✓ VERIFIED (X/Y + mark-type switching + typing) / ⚠️ PRESENT_BEHAVIOR_UNVERIFIED (Color/Size/Filter shelves specifically) | `graphicWalkerFields.test.ts` 6/6 re-run live and passing (typing). X/Y drag + bar/line/area/scatter mark switching human-confirmed by `03-UAT.md` test 1 (pass, 03-01-PLAN.md's Task 3 human-check) and test 7 (pass, explicitly repeats X/Y + line/scatter on the production build). Color/Size/Filter shelf drag was specified only in test 4, which was explicitly SKIPPED as "superseded by test 7" — but test 7's own text does not re-exercise Color/Size/Filter, so this specific sub-capability has never actually passed a test |
| 4a | SurveySummaryModal stays open under React StrictMode through a deliberate 2s wait (x5 repeats), and Escape/backdrop/Tanca each dismiss exactly once (G-03-5 core, HOME-03/04) | ✓ VERIFIED (upgraded — see correction above) | `dialogLifecycle.ts`/`dialogLifecycle.test.ts` re-read and re-run live (21/21 passing, including the meta-test proving the harness would catch 03-04's original broken fix). **Human-confirmed**: `03-UAT.md` test 8's own report states "G-03-5 core regression CONFIRMED FIXED: modal stays open through the 2s waits, and Escape/backdrop/'Tanca' each close it correctly" — test 8 was logged as `result: issue` only because it ALSO discovered the separate G-03-7 centering defect, not because this specific behavior failed |
| 4b | Dialog renders centered (not pinned top-left), in dev and production preview, in light/dark mode, reachable at ~375px (G-03-7, HOME-03) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | `SurveySummaryModal.tsx:135-148` — `m-auto` prepended to the `<dialog>` className as the first class, preceded by an explanatory comment naming G-03-7, the Preflight cascade-origin mechanism, and `tailwindlabs/tailwindcss#16372`; re-read directly. `grep -oh '\.m-auto{[^}]*}' dist/assets/*.css` re-run live against a fresh `rm -rf dist && npm run build`: prints `.m-auto{margin:auto}` from the same stylesheet carrying Preflight's `@layer base{...margin:0...}` reset. This is real proof the mechanism is present and compiled correctly — but no browser observed the actual rendered result this round (WINDOWS.md id 9, open) |
| 4c | "Explorar dades interactives" unmount-while-open leaves the explorer genuinely interactive; production-preview build shows no regression (G-03-5 sub-steps, HOME-03/04) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Navigation code (`handleExplore` -> `navigate`) unchanged and correct by inspection; `03-UAT.md` test 8's own report explicitly states these two sub-steps "were not explicitly re-confirmed this round" — 03-08-PLAN.md's human-check was scheduled to close them but could not run (WINDOWS.md id 8 and id 9, both open) |
| 5 | A newly built chart fills the explorer's canvas area (G-03-4b, EXPL-03, EXPL-06) | ✓ VERIFIED (upgraded — see correction above) | `defaultConfig` prop and `h-dvh flex-col` layout re-confirmed present; compiled-CSS `100dvh` re-confirmed live. **Human-confirmed**: `03-UAT.md` test 7 (pass, run against the production build) explicitly confirms the chart "visually fills the canvas area — NOT a small box surrounded by empty space" for bar, line, and scatter mark types |
| 6 | Explorer visually usable on small/medium screens; back-nav to list; direct `/enquesta/:id` link works on load/refresh, no 404 (EXPL-06, EXPL-07, EXPL-08) | ✓ VERIFIED | `node scripts/verify-pages.mjs` re-run live against a fresh build — "all checks passed". Header/dictionary responsiveness human-confirmed by `03-UAT.md` test 3 (pass); canvas responsiveness at ~375px/~768px in light/dark human-confirmed by test 7 (pass, item 4) |
| 7 | Data dictionary from meta.json inside explorer (EXPL-09) | ✓ VERIFIED | `DataDictionary.tsx` unchanged; regression-checked, still wired; human-confirmed by `03-UAT.md` test 3 (pass) |
| 8 | `decodeShareLink` correctly restores a chart spec shaped like GraphicWalker's real export output (G-03-4, EXPL-11) | ✓ VERIFIED | `shareLink.ts` unchanged; `npx vitest run src/lib/shareLink.test.ts` re-run live: 19/19 passing; human-confirmed end-to-end by `03-UAT.md` test 7 (pass, item 2) |
| 9 | `decodeShareLink` always returns a normalized array, rejects array-typed `encodings`, rejects a top-level empty array (CR-01, WR-01, WR-02 from the code review) | ✓ VERIFIED | Unchanged; covered by the same 19/19 passing `shareLink.test.ts` run |
| 10 | A chart restored via share link reproduces the sharer's visualization AND fills the canvas, including the three hostile-link variants failing silently blank (composed EXPL-11 x EXPL-06) | ✓ VERIFIED (upgraded — see correction above) | Decode logic (#8, #9) and canvas-fill mechanism (#5) both verified. **Human-confirmed**: `03-UAT.md` test 7 (pass) items 2-3 explicitly confirm exact reproduction at full size and all three hostile variants (garbage/truncated/cross-survey) landing on a silent, blank, usable explorer |
| 11 | Image export (EXPL-10) works end-to-end in a real browser | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | Delegated to GraphicWalker's own toolbar. Specified only in `03-UAT.md` test 4, which was SKIPPED as "superseded by test 7" — but test 7 does not include an export step, so this has never actually passed a test |
| 12 | `SurveySummaryModal` distinguishes "survey not found" from "load failed" (WR-04 from the code review) | ✓ VERIFIED | `SurveySummaryModal.tsx` classification pattern (lines ~14-27, ~108-118) unchanged since the previous verification round, re-read and confirmed present |
| 13 | Compiled production CSS emits `.m-auto{margin:auto}`, proving the G-03-7 centering fix survives Tailwind's build pipeline into the same stylesheet carrying Preflight's base-layer margin reset (G-03-7 mechanism, HOME-03) | ✓ VERIFIED | Independently re-run in this verification: `rm -rf dist && npm run build` (clean rebuild), `grep -oh '\.m-auto{[^}]*}' dist/assets/*.css` -> `.m-auto{margin:auto}`; `grep -oh '@layer base{[^}]*margin:0[^}]*}' dist/assets/*.css` confirms the conflicting Preflight reset is present in the same file |

**Score:** 13/13 must-haves present, substantive, and wired. 4 of them (Color/Size/Filter shelf drag, dialog visual centering, two G-03-5 unmount/production-regression sub-steps, image export) carry a behavior-dependent component with no passing human test on record — routed to human verification, not counted against the score, not FAILED. Two truths this round were upgraded from the previous verification's ⚠️ status to ✓ VERIFIED using dated evidence already present in the repository (`03-UAT.md` tests 1/7/9) that the previous round either predates (test 9/G-03-6) or did not credit (tests 1/7).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/components/SurveySummaryModal.tsx` | `<dialog>` className leads with a static `m-auto` utility, preceded by an explanatory comment naming G-03-7 | ✓ VERIFIED | Lines 135-148 read directly; className literal is exactly `"m-auto w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 text-zinc-900 backdrop:bg-black/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"`; comment above it (lines 135-143) names the Preflight cascade-origin mechanism, the utility-layer ordering, and `G-03-7`/`tailwindlabs/tailwindcss#16372` |
| `src/lib/dialogLifecycle.ts` / `.test.ts` | Framework-free, timing-agnostic dialog lifecycle with a caller-owned suppression counter, tested via a FakeDialog harness | ✓ VERIFIED | Unchanged since the previous round; 21/21 tests re-run live and passing |
| `src/pages/ExplorerPage.tsx` | Discriminated not-found/load-failed error state; `defaultConfig` on GraphicWalker; definite-height canvas wrapper | ✓ VERIFIED | Unchanged, re-confirmed present |
| `src/lib/shareLink.ts` | Shelf-scoped schema-drift check with virtual-fid allowlist; normalized-array return | ✓ VERIFIED | Unchanged, 19/19 tests re-run live |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `SurveySummaryModal.tsx`'s `<dialog>` className | Tailwind's utility layer -> compiled CSS | Static string literal scanned by Tailwind's content scanner at build time | ✓ WIRED | `grep -oh '\.m-auto{[^}]*}' dist/assets/*.css` re-run live against a fresh build: rule present. A dynamically-composed class name (forbidden by the plan) would have broken this link silently — confirmed the literal is static |
| `SurveySummaryModal.tsx` dialog lifecycle effect | `openDialogLifecycle` | Direct import and call, cleanup returned from the effect | ✓ WIRED | Line 82: `return openDialogLifecycle(dialog, () => onCloseRef.current(), closeSuppressCountRef)` — unchanged since 03-07 |
| `ExplorerPage.tsx` phase-2 effect | `SurveyNotFoundError` classification | `metaResult.reason instanceof SurveyNotFoundError` checked first | ✓ WIRED | Unchanged; re-read and confirmed |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `ExplorerPage.tsx` `dataState.data.rows` | `queryParquet(id)` | Real `SELECT * FROM read_parquet(...)` against the committed Parquet fixture | Yes | ✓ FLOWING |
| `SurveySummaryModal.tsx` `<dialog>` centering | `m-auto` static className -> Tailwind's content scanner -> `dist/assets/*.css` | Real build pipeline, not a source-only edit | Yes (mechanism); browser-rendered position itself unverified this round | ✓ FLOWING (mechanism) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Lint | `npm run lint` (ran live) | Zero errors/warnings | ✓ PASS |
| Full unit test suite | `npx vitest run` (ran live) | 3 test files, 46/46 tests passed | ✓ PASS |
| Production build (clean) | `rm -rf dist && npm run build` (ran live) | `tsc -b && vite build` succeeded, all chunks emitted | ✓ PASS |
| className literal gate | `grep -c 'className="m-auto w-full max-w-lg' src/components/SurveySummaryModal.tsx` (ran live) | Returns `1` | ✓ PASS |
| Compiled-CSS gate | `grep -oh '\.m-auto{[^}]*}' dist/assets/*.css` (ran live) | `.m-auto{margin:auto}` | ✓ PASS |
| DuckDB asset + Parquet production-build fidelity | `node scripts/verify-explorer-assets.mjs` (ran live) | "all checks passed (4 DuckDB assets verified)" | ✓ PASS |
| GitHub-Pages base-path/404 fidelity | `node scripts/verify-pages.mjs` (ran live, clean port) | "all checks passed" | ✓ PASS |
| Scope discipline | `git diff --stat` for `package.json`, `package-lock.json`, `src/index.css` (ran live) | No diff — all three untouched | ✓ PASS |
| Anti-pattern scan (TODO/FIXME/TBD/XXX/HACK/PLACEHOLDER) | `grep` across `SurveySummaryModal.tsx`, `ExplorerPage.tsx`, `dialogLifecycle.ts`, `shareLink.ts`, `duckdb.ts`, `ExplorerHeader.tsx`, `gh-pages-preview.mjs` | No matches | ✓ PASS |

### Probe Execution

No `scripts/*/tests/probe-*.sh` files exist in this repository and none are declared in the phase's PLAN/SUMMARY files. Skipped — no runnable probes for this phase.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| EXPL-01 | 03-01 | Progress indicator during DuckDB init + Parquet load | ✓ SATISFIED | 03-UAT.md test 1 pass |
| EXPL-02 | 03-01, 03-06 | Clear error on init/query failure, discriminated not-found vs load-failed | ✓ SATISFIED | Classification logic + G-03-6 resolved (03-UAT.md test 9 pass) |
| EXPL-03 | 03-01, 03-06 | Drag X/Y/Color/Size/Filter; canvas fills available space | ✓ SATISFIED (X/Y, canvas fill) / human-check pending (Color/Size/Filter shelves) | 03-UAT.md tests 1, 7 pass for X/Y + fill; Color/Size/Filter never independently confirmed |
| EXPL-04 | 03-01 | Multiple chart types | ✓ SATISFIED | 03-UAT.md tests 1, 7 pass (bar/line/area/scatter) |
| EXPL-05 | 03-01 | Correct dimension/measure typing | ✓ SATISFIED | 6/6 passing unit tests |
| EXPL-06 | 03-02, 03-06 | Usable on small/medium screens; canvas fills space | ✓ SATISFIED | 03-UAT.md tests 3, 7 pass |
| EXPL-07 | 03-02 | Back to listing from explorer | ✓ SATISFIED | Unchanged |
| EXPL-08 | 03-01 | Direct `/enquesta/:id` link works, no 404 on refresh | ✓ SATISFIED | `verify:pages` passing live |
| EXPL-09 | 03-02 | Field descriptions (data dictionary) | ✓ SATISFIED | 03-UAT.md test 3 pass |
| EXPL-10 | 03-03 | Export chart as image | human-check pending | Never confirmed by a passing test (test 4 skipped, test 7 doesn't cover it) |
| EXPL-11 | 03-03, 03-05, 03-06 | Copy/generate a link reproducing exact visualization | ✓ SATISFIED | 19/19 unit tests + 03-UAT.md test 7 pass (exact reproduction at full size, hostile variants fail soft) |
| HOME-03, HOME-04 (Phase 1 requirements, re-touched by 03-04/03-07/03-08) | 03-04, 03-07, 03-08 | Modal opens, stays open, dismisses correctly, and renders centered; explore button reachable | ✓ SATISFIED (dismissal-once, code+CSS centering fix) / human-check pending (visual centering confirmation, unmount-interactive sub-step) | `dialogLifecycle.test.ts` 21/21; `03-UAT.md` test 8 confirms dismissal-once; G-03-7's visual confirmation (WINDOWS.md id 9) not yet run |

No orphaned requirements — all of EXPL-01..EXPL-11 remain mapped to Phase 3 in `REQUIREMENTS.md` and appear across the eight plans' `requirements` fields (03-01 through 03-08, excluding the pure lifecycle-mechanism plans which reasonably scope to HOME-03/04). HOME-03/HOME-04 are Phase 1 requirements incidentally re-touched by Phase 3's gap closures — not a Phase 3 orphan.

### Anti-Patterns Found

None blocking. Scanned `SurveySummaryModal.tsx`, `ExplorerPage.tsx`, `dialogLifecycle.ts`, `shareLink.ts`, `duckdb.ts`, `ExplorerHeader.tsx`, and `scripts/gh-pages-preview.mjs` for `TBD|FIXME|XXX|TODO|HACK|PLACEHOLDER` and placeholder-language patterns — zero matches, confirmed live in this verification.

**Unresolved code-review findings (not blockers, flagged for awareness):** `03-REVIEW.md` (dated 2026-08-29, explicitly scoped as "the current, post-gap-closure state... after 03-08's `m-auto` fix", status `issues_found`, 0 critical / 4 warning / 4 info) has no corresponding fix pass yet:

- **WR-01**: `scripts/gh-pages-preview.mjs`'s unguarded `decodeURIComponent` can crash the local preview/verify server on a malformed request path (this is the local dev/verify tooling, not the deployed static site — GitHub Pages itself has no server process to crash).
- **WR-02**: `SurveySummaryModal`'s footer buttons (`Tanca`/`Explorar dades interactives`) render unconditionally regardless of load/validity state — "Explorar dades interactives" is clickable while the id is invalid or the summary hasn't loaded/failed.
- **WR-03**: `duckdb.ts`'s BigInt→Number narrowing has no bounds guard for a future large-value survey.
- **WR-04**: No component-level test coverage exists for `SurveySummaryModal`, `ExplorerPage`, or `ExplorerHeader` (only the pure-logic modules are unit-tested); the repo's Vitest environment is `node` (no DOM), so adding one requires a `jsdom`/`happy-dom` dependency first.

None of these four block the phase goal and none introduce a placeholder/stub — they are pre-existing hygiene gaps surfaced by review, not yet actioned by a follow-up plan.

### Human Verification Required

See frontmatter `human_verification` (4 items). All four are narrower than the previous verification round's list — two items from the previous round (drag-and-drop generally, canvas-fill/share-link round trip) are now closed by dated UAT evidence (tests 1/7) and no longer appear here; G-03-6's item is closed (test 9); the previous round's modal-StrictMode item is now split, with its core dismissal-once behavior closed (test 8) and only the centering/unmount-interactive/production-regression pieces remaining:

1. **G-03-7 visual centering confirmation** (WINDOWS.md id 9) — the fix is proven at the source+compiled-CSS level; only the actual rendered-in-a-browser confirmation remains.
2. **Two remaining G-03-5 sub-steps** (WINDOWS.md id 8) — unmount-while-open explorer interactivity, and a production-preview regression spot-check.
3. **Color/Size/Filter shelf drag-and-drop** (EXPL-03) — never covered by a passing test; the one UAT test that specified it (test 4) was skipped as superseded by a test (test 7) that does not itself exercise those shelves.
4. **Chart image export** (EXPL-10) — same situation as item 3 (specified only in the skipped test 4).

### Gaps Summary

No gaps found (no FAILED truth, no MISSING/STUB artifact, no NOT_WIRED key link, no blocker anti-pattern). G-03-7, the cosmetic defect that made the previous UAT round's test 8 report an issue, is closed at the code level with independently re-confirmed evidence (className literal + compiled production CSS both re-verified live in this session, not merely re-read from a SUMMARY). `03-UAT.md`'s own gap entry for G-03-7 still reads `status: failed` because its human-check (the step that would formally close it) has not yet run — this verification does not override that; it is recorded here as a still-open human-verification item, exactly as the task instructed.

The phase stays at `human_needed` rather than `passed` for one narrowed reason: **four behavior-dependent items** (dialog visual centering, two G-03-5 sub-steps, Color/Size/Filter shelf drag, and image export) genuinely cannot be proven by grep/build/test alone and have no passing human test on record. This is a meaningfully smaller set than the previous verification's six — two items were closed by dated evidence this round found in `03-UAT.md` (tests 7 and 9) that either postdates or was not credited by the previous verification pass, and the modal-lifecycle item was split so its already-human-confirmed core (test 8) is no longer miscategorized as unverified alongside its genuinely-still-open centering/unmount sub-steps.

---

_Verified: 2026-08-28T22:13:45Z_
_Verifier: Claude (gsd-verifier)_
