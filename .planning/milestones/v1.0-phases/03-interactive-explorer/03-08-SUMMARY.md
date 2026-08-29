---
phase: 03-interactive-explorer
plan: 08
subsystem: ui-modal
tags: [tailwind-v4, css-cascade, preflight, dialog, gap-closure]

requires:
  - phase: 03-interactive-explorer
    provides: SurveySummaryModal's dialog lifecycle (G-03-5 fix, plan 03-07) and its className literal, byte-identical entering this plan
provides:
  - "SurveySummaryModal's <dialog> centers correctly under showModal(), in both npm run dev and the production build, restoring HOME-03's quick KPI summary to a usable presentation"
affects: [ui-modal, survey-summary, phase-03-uat]

actuals:
  tokens: 550
  tasks: 1
  commits: 1

tech-stack:
  added: []
  patterns:
    - "Author-origin utility-layer class (m-auto) used to win an author-vs-UA cascade fight that Tailwind Preflight's base-layer margin reset otherwise wins unconditionally over the browser's own dialog:modal UA rule"

key-files:
  created: []
  modified:
    - "src/components/SurveySummaryModal.tsx — prepended m-auto to the <dialog> className literal, preceded by an explanatory comment naming G-03-7, the Preflight cascade-origin mechanism, and tailwindlabs/tailwindcss#16372"

key-decisions:
  - "Fixed at the point of use (m-auto on the one <dialog> element) rather than a global `@layer base { dialog { margin: auto } }` rule in src/index.css, per the plan's explicit instruction — a same-layer global rule's outcome would depend on fragile source-order relative to Preflight's own import, and this app has exactly one <dialog>"

patterns-established: []

requirements-completed: [HOME-03, HOME-04]

coverage:
  - id: D1
    description: "SurveySummaryModal's <dialog> renders centered (horizontally and vertically) when opened via showModal(), in dev and in the production build, with the fix proven present in compiled production CSS"
    requirement: "HOME-03"
    verification:
      - kind: unit
        ref: "npm run lint && npm run test && npm run build"
        status: pass
      - kind: unit
        ref: "grep -c 'className=\"m-auto w-full max-w-lg' src/components/SurveySummaryModal.tsx (returns 1)"
        status: pass
      - kind: unit
        ref: "grep -oh '\\.m-auto{[^}]*}' dist/assets/*.css (prints .m-auto{margin:auto})"
        status: pass
    human_judgment: true
    rationale: "The automated checks prove the utility is in the className literal and that Tailwind emitted the corresponding rule into the production CSS bundle — but they cannot observe actual rendered position, viewport reachability at ~375px, dark-mode restyling, or interaction behavior. Only a human (or a browser automation tool, unavailable in this execution environment) can confirm the dialog visually centers and stays fully reachable. The human-check also covers two G-03-5 re-test sub-steps (dismissal-once behavior, explorer-interactive-after-navigate) left unconfirmed by the prior UAT round (WINDOWS.md id 8) — those likewise require a human pass and were not run here."

duration: 8min
completed: 2026-08-28
status: complete
---

# Phase 03 Plan 08: Modal Centering Gap Closure (G-03-7) Summary

**Restored native `<dialog>` centering in `SurveySummaryModal` via an author-origin `m-auto` utility, verified against both the source className and the compiled production CSS (`.m-auto{margin:auto}` present in `dist/assets/*.css`), closing gap G-03-7.**

## Performance
- **Duration:** 8min
- **Started:** 2026-08-28T21:49:00Z (approx.)
- **Completed:** 2026-08-28T21:57:39Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Root-caused defect (Tailwind v4 Preflight's author-origin `margin: 0` reset unconditionally beating the browser's user-agent-origin `dialog:modal { margin: auto }` rule, per cascade origin/importance resolution preceding specificity) was already fully diagnosed in `.planning/debug/g-03-7-modal-not-centered.md`; this plan applied the fix.
- Prepended `m-auto` as the first class in the `<dialog>` element's static className literal in `src/components/SurveySummaryModal.tsx`, restoring the browser's own centering mechanism at the author-origin/utility-layer level, which outranks Preflight's base-layer reset in the author-vs-author fight.
- Added an explanatory comment above the `<dialog>` element recording the mechanism (author-origin beats UA-origin regardless of specificity; Tailwind's `theme, base, components, utilities` layer order is what lets the utility win), the gap id G-03-7, and the upstream issue `tailwindlabs/tailwindcss#16372`.
- Verified the fix survives Tailwind's build pipeline: `grep -oh '\.m-auto{[^}]*}' dist/assets/*.css` prints `.m-auto{margin:auto}` from the actual production bundle, the same file where Preflight's `@layer base{*,:after,:before,::backdrop{...margin:0...}}` reset also lives — proving this is a real, compiled fix and not a source-only edit Tailwind never emitted.
- Confirmed scope discipline: only `src/components/SurveySummaryModal.tsx` was modified (`git diff --stat` and `git diff package.json package-lock.json` both confirm), `src/index.css` untouched, no dependency added.

## Task Commits
1. **Task 1: Restore native dialog centering with an author-origin auto-margin utility** - `0126b29` (fix)
**Plan metadata:** *(committed after this SUMMARY — see final commit below)*

## Files Created/Modified
- `src/components/SurveySummaryModal.tsx` - `<dialog>` className now leads with `m-auto`; comment above the element documents why the class is load-bearing (G-03-7, Preflight cascade-origin mechanism, tailwindlabs/tailwindcss#16372)

## Decisions Made
- Fixed at the single `<dialog>` element's className rather than a global rule in `src/index.css`, per the plan's explicit rejection of that alternative (fragile same-layer source-order dependency vs. Preflight; this app has exactly one `<dialog>`).

## Deviations from Plan

None - plan executed exactly as written. The className literal, comment content, and scope boundaries all match the plan's `<action>` block verbatim.

**Total deviations:** 0. **Impact:** none.

## Issues Encountered

None during automated execution. `npm run build` emits a pre-existing, unrelated Node.js version warning ("Vite requires Node.js version 20.19+ or 22.12+", current is 20.18.3) that is not caused by and not fixable within this plan's scope (no `files_modified` entry covers Node/tooling version pinning) — the build still completes successfully despite the warning, so it was left alone per the scope-boundary rule.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None - this plan changes only a className literal and an explanatory comment; no data source, component wiring, or placeholder logic is involved.

## Human Verification Required (outstanding)

The plan's `<human-check>` block could NOT be run in this execution environment — no browser automation tool is available. This is recorded as WINDOWS.md ledger entry id 9 (`unrun-verify`, phase 03, `src/components/SurveySummaryModal.tsx`). A human must confirm, per the plan's 6-step human-check:

1. Modal opens visually centered (horizontal and vertical) on `npm run dev`, clicking a survey card.
2. Dark mode restyles correctly with centering unchanged; at ~375px width the dialog stays fully inside the viewport with both "Tanca" and "Explorar dades interactives" reachable and clickable; overflow content scrolls internally.
3. G-03-5 no-regression: modal survives a deliberate 2-second wait under `npm run dev`; Escape, backdrop click, and "Tanca" each dismiss exactly once (not twice).
4. "Explorar dades interactives" navigates to `/enquesta/:id` and the explorer remains genuinely interactive after unmount (scroll, back-link, data dictionary expand) — this also clears one of the two outstanding sub-steps of WINDOWS.md id 8.
5. Repeat steps 1 and 3 against `npm run build && npm run preview:pages` under `/enquestes/` — the environment where the defect was independently confirmed in compiled CSS — this clears the second outstanding sub-step of WINDOWS.md id 8.
6. No new browser console errors/warnings throughout.

Do NOT treat this plan as fully closing G-03-7 or WINDOWS.md id 8 until a human completes the above. All automated evidence (className literal, compiled CSS, lint/test/build) is in place and consistent with a correct fix; only the visual/interactive confirmation remains.

## Next Phase Readiness

Automated verification is fully green (lint, test, build, className grep, built-CSS grep) and the source-level fix is complete and scoped correctly. The plan's own success criteria explicitly require the human-check to close the gap — that step is still pending a human with a browser, tracked as WINDOWS.md id 9 (this plan) and id 8 (the prior 03-07 human-check it was meant to also cover). No blockers to Phase 03 continuing, but the phase should not be considered fully UAT-clean until both ledger entries are resolved by a human pass.

---
*Phase: 03-interactive-explorer*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: `src/components/SurveySummaryModal.tsx`
- FOUND: `.planning/phases/03-interactive-explorer/03-08-SUMMARY.md`
- FOUND: commit `0126b29`
