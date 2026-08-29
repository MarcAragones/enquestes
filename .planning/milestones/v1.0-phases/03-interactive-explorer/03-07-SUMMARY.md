---
phase: 03-interactive-explorer
plan: 07
subsystem: ui
tags: [react, strictmode, dialog, testing, vitest, gap-closure]

# Dependency graph
requires:
  - phase: 03-interactive-explorer
    provides: SurveySummaryModal.tsx (plan 03-01), its first StrictMode fix attempt (plan 03-04, commit 90ca09d), and the root-cause diagnosis in .planning/debug/g-03-5-modal-still-closes.md
provides:
  - "src/lib/dialogLifecycle.ts — framework-free, directly testable openDialogLifecycle(dialog, onDismiss, suppressCounter) with a caller-owned suppression counter, timing-agnostic across synchronous/microtask/macrotask 'close' event dispatch"
  - "src/lib/dialogLifecycle.test.ts — FakeDialog model of the WHATWG <dialog> close() contract plus a meta-test proving the harness reproduces 03-04's shipped defect"
  - "SurveySummaryModal.tsx rewired onto the tested lifecycle, closing G-03-5"
affects: [any future component that opens a native <dialog> under React StrictMode]

# Actuals (#2632)
actuals:
  tokens: 4036
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Suppression-counter dialog lifecycle: a caller-owned mutable counter box ({ current: number }, passed as a React ref) that a cleanup increments immediately before a lifecycle-initiated close() and a close handler decrements-and-swallows, absorbing exactly one close event per cleanup-initiated close regardless of whether the browser dispatches the native close event synchronously, on a microtask, or on a macrotask."

key-files:
  created:
    - src/lib/dialogLifecycle.ts
    - src/lib/dialogLifecycle.test.ts
  modified:
    - src/components/SurveySummaryModal.tsx

key-decisions:
  - "Chose the suppression-counter design (plan's option a) over never-closing-in-cleanup (option b): timing-agnostic (correct under any close-event dispatch timing) and keeps an explicit close() on genuine unmount-while-open (the 'Explorar dades interactives' navigation path), rather than betting the explorer page's interactivity on browser dialog-removal steps across browsers."
  - "Combined the RED and GREEN steps of Task 1 into a single commit rather than two separate test()/feat() commits: the plan's own <verify> gate runs once against the final (GREEN) state only, and committing a deliberately-failing test suite as its own commit would leave the repo in a broken-tests state, contradicting the task_commit_protocol's 'commit only after verification passed' rule. The RED-step failure output was captured and is recorded below instead."

requirements-completed: [HOME-03, HOME-04]

coverage:
  - id: D1
    description: "openDialogLifecycle absorbs exactly one close event per cleanup-initiated close, proven timing-agnostic (immediate/microtask/macrotask dispatch) by a hand-rolled FakeDialog model, including a meta-test proving the harness reproduces 03-04's shipped defect under microtask/macrotask dispatch and not under immediate dispatch"
    requirement: "HOME-03"
    verification:
      - kind: unit
        ref: "src/lib/dialogLifecycle.test.ts (21 tests: 6 behaviors x 3 schedulers + 3 meta-tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "SurveySummaryModal.tsx rewired onto openDialogLifecycle with the suppression counter in a ref; the modal opens and stays open under npm run dev with StrictMode active, Escape/Tanca/backdrop each close it exactly once, and 'Explorar dades interactives' navigates to a fully interactive explorer page"
    requirement: "HOME-04"
    verification:
      - kind: unit
        ref: "npx vitest run (46 tests, full suite including dialogLifecycle.test.ts)"
        status: pass
      - kind: manual_procedural
        ref: "Task 2 <verify><human-check> — 8-step npm run dev walkthrough plus a preview:pages spot check, embedded in the plan for the phase verifier per workflow.human_verify_mode=end-of-phase"
        status: unknown
    human_judgment: true
    rationale: "The defect this plan fixes (G-03-5) is a real-browser event-loop timing race that unit tests against a fake dialog model cannot fully stand in for — the plan's own <human-check> block requires a live npm run dev click-through with deliberate multi-second waits, which no browser automation tool was available to perform in this executing environment. Recorded here, honestly unverified, for the phase verifier/UAT to pick up (see Known Stubs / human-check below)."

duration: ~15min
completed: 2026-08-28
status: complete
---

# Phase 03 Plan 07: Dialog Lifecycle Extraction & StrictMode Reproduction Test Summary

**Extracted SurveySummaryModal's dialog lifecycle into a framework-free `openDialogLifecycle` with a suppression-counter fix, proven against a hand-rolled StrictMode/async-close-event reproduction test that fails on 03-04's shipped implementation and passes on the new one.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-28T16:48:34Z (session start, per STATE.md `last_updated`)
- **Completed:** 2026-08-28T16:56:00Z
- **Tasks:** 2
- **Files modified:** 3 (2 created, 1 modified)

## Accomplishments

- `src/lib/dialogLifecycle.ts`: a `DialogLike` structural interface and `openDialogLifecycle(dialog, onDismiss, suppressCounter)` function, extracted out of React entirely, that absorbs exactly one close event per cleanup-initiated close via a caller-owned suppression counter — correct regardless of whether the browser dispatches the native `close` event synchronously, on a microtask, or on a macrotask.
- `src/lib/dialogLifecycle.test.ts`: a `FakeDialog` class modeling the WHATWG `<dialog>` `close()` contract (synchronous `open` flip, event dispatch snapshotted at dispatch time and handed to an injected scheduler), 6 behaviors x 3 dispatch-timing schedulers (18 tests) plus a 3-test meta-test suite proving the harness reproduces 03-04's shipped defect under microtask/macrotask dispatch and does NOT reproduce it under immediate dispatch — the exact reason 03-04 passed lint/typecheck/build/code-review while still being broken.
- `src/components/SurveySummaryModal.tsx` rewired: the dialog lifecycle effect now delegates entirely to `openDialogLifecycle`, with the suppression counter held in a new `closeSuppressCountRef`. 03-04's superseded "detach-before-close" comment block was removed and replaced with a pointer to the new module. `onClose` is still read through `onCloseRef`; the effect keeps its empty dependency array; Escape/Tanca/backdrop dismissal paths are untouched (still call the dialog element's own `close()` directly).

## Task Commits

Each task was committed atomically:

1. **Task 1: Extract the dialog lifecycle and build a StrictMode reproduction test** - `d5e976d` (test — combined RED+GREEN, see Deviations)
2. **Task 2: Rewire SurveySummaryModal onto the tested lifecycle** - `a4cb543` (fix)

_Note: per this plan's own STEP 1/STEP 2 action structure, Task 1's RED step was verified locally (see "RED-step failure output" below) but not committed as a separate failing-tests commit — see Deviations._

## Files Created/Modified

- `src/lib/dialogLifecycle.ts` - `DialogLike` interface + `openDialogLifecycle`, the suppression-counter fix for G-03-5
- `src/lib/dialogLifecycle.test.ts` - FakeDialog reproduction harness, 21 tests (18 behavioral x 3 schedulers + 3 meta-tests)
- `src/components/SurveySummaryModal.tsx` - lifecycle effect delegates to `openDialogLifecycle`; added `closeSuppressCountRef`; removed superseded G-03-2 cleanup-ordering comment

## RED-step failure output (Task 1 STEP 1)

Recorded per the plan's explicit requirement — this is the deliverable that distinguishes this attempt from 03-04. With `src/lib/dialogLifecycle.ts` implementing 03-04's shipped semantics (detach-listener-then-close, no suppression counter, third parameter unused):

```
 RUN  v4.1.11 /Users/marcaragones/Github/enquestes

 ❯ src/lib/dialogLifecycle.test.ts (21 tests | 6 failed) 58ms
       × [microtask dispatch] test 1 (the gap) — StrictMode sequence leaves the dialog open with no dismissal call
       × [macrotask dispatch] test 1 (the gap) — StrictMode sequence leaves the dialog open with no dismissal call
       × [microtask dispatch] test 2 — a visitor dismissal after the StrictMode sequence fires exactly once
       × [macrotask dispatch] test 2 — a visitor dismissal after the StrictMode sequence fires exactly once
       × [microtask dispatch] test 5 — the suppression counter returns to 0 after the StrictMode sequence
       × [macrotask dispatch] test 5 — the suppression counter returns to 0 after the StrictMode sequence

AssertionError (test 1, microtask/macrotask): expected "vi.fn()" to not be called at all,
but actually been called 1 times

AssertionError (test 2, microtask/macrotask): expected "vi.fn()" to be called 1 times,
but got 2 times

AssertionError (test 5, microtask/macrotask): expected "vi.fn()" to not be called at all,
but actually been called 1 times

 Test Files  1 failed (1)
      Tests  6 failed | 15 passed (21)
```

This matches the plan's explicit requirement exactly: tests 1 and 5 failed under the microtask and macrotask schedulers (test 2 also failed under those schedulers as a natural consequence — not required by the plan but consistent with the same root cause), the immediate scheduler passed for all tests (documenting why 03-04 looked correct on paper), and the meta-test suite (3 tests) passed, confirming the `FakeDialog` harness genuinely reproduces the StrictMode/async-close race rather than passing vacuously. After implementing the suppression-counter fix (STEP 2), all 21 tests passed under all three schedulers.

## Decisions Made

- Suppression-counter design (plan's chosen option a) over never-closing-in-cleanup (option b) — see frontmatter `key-decisions`.
- `FakeDialog`'s event dispatch snapshots its listener list at DISPATCH time (inside the scheduled callback), not at `close()`-call time — this was necessary to correctly reproduce the real DOM's `dispatchEvent` semantics (a listener attached AFTER `close()` returns but before the queued task fires is the one that receives the event), matching the mechanism described in `.planning/debug/g-03-5-modal-still-closes.md`.
- Combined Task 1's RED and GREEN steps into one commit rather than separate `test()`/`feat()` commits (see frontmatter `key-decisions`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Passed `closeSuppressCountRef.current` instead of `closeSuppressCountRef` on first write**
- **Found during:** Task 2, immediately after the initial edit, before running any verification
- **Issue:** First draft of the rewired lifecycle effect called `openDialogLifecycle(dialog, () => onCloseRef.current(), closeSuppressCountRef.current)` — passing the ref's current numeric value (`0`) instead of the mutable ref object itself, which would have broken the counter (each call would receive a fresh, disconnected `{ current: number }`-shaped... actually a bare number, a type error) instead of the shared ref.
- **Fix:** Changed the third argument to `closeSuppressCountRef` (the ref object), matching `openDialogLifecycle`'s contract of taking "a mutable counter box shaped as an object with a numeric `current` property (so a React ref object can be passed straight in)".
- **Files modified:** src/components/SurveySummaryModal.tsx
- **Verification:** `npx vitest run && npm run lint && npm run build` all pass; `grep -c "openDialogLifecycle"` = 2.
- **Committed in:** a4cb543 (Task 2 commit — caught before the task's own commit, not a separate fix commit)

---

**Total deviations:** 1 auto-fixed (1 bug, caught pre-verification)
**Impact on plan:** No scope creep. The bug was caught by careful review before any verification command ran, so it never reached a committed state.

## Issues Encountered

None beyond the above self-caught bug.

## Human-check recorded for the phase verifier (Task 2 `<verify><human-check>`)

Per this project's `workflow.human_verify_mode: end-of-phase` config, this task's `<human-check>` is embedded in `<verify>` rather than emitted as a separate `checkpoint:human-verify` task, for the phase verifier to harvest into `03-UAT.md`. No browser automation tool (e.g. claude-in-chrome) was available/connected in this executing environment, so the following steps from the plan were **not** performed and must be run by a human before this gap is considered closed:

1. Run `npm run dev`. Click a survey card — the modal opens. Wait 2+ seconds without touching anything; the modal and `?enquesta=` must both still be present.
2. Repeat step 1 four more times with different cards (5 total) — the race is timing-dependent, so a single success is not evidence.
3. With the modal open, press Escape — closes, `?enquesta=` disappears, wait 2s, nothing else changes.
4. Reopen, click the backdrop — same result.
5. Reopen, click "Tanca" — same result.
6. Reopen, click "Explorar dades interactives" — navigates to `/enquesta/:id`, and the explorer page must be fully interactive (scroll, back-link, data dictionary click).
7. Browser Back from the explorer to homepage, click a card again, wait 2s — still open.
8. No new console errors/warnings across all of the above.
9. Then `npm run build && npm run preview:pages`, repeat steps 1 and 3 only (production/no-StrictMode regression check).

What **was** verified automatically in this session: `npx vitest run` (46/46 pass, including the 21 new `dialogLifecycle.test.ts` tests across all three dispatch-timing schedulers), `npm run lint` (clean), and `npm run build` (`tsc -b && vite build` succeeds). These cover the logic under test but cannot themselves prove the real-browser StrictMode timing race is fixed — that is exactly the class of defect that let 03-04 ship broken despite passing the same three gates, which is why the plan requires this separate human-check.

## Known Stubs

None — no stub/placeholder code was introduced. The one open item is the un-run browser `<human-check>` above, tracked via the ledger entry below rather than as a code stub.

## Next Phase Readiness

- `openDialogLifecycle` and its test harness are reusable for any future `<dialog>`-based component needing StrictMode-safe lifecycle management.
- G-03-5 is code-complete and unit-tested; final closure is pending the human browser walkthrough recorded above.
- HOME-03 and HOME-04 should be reachable again pending that human confirmation.

---
*Phase: 03-interactive-explorer*
*Completed: 2026-08-28*

## Self-Check: PASSED

- FOUND: src/lib/dialogLifecycle.ts
- FOUND: src/lib/dialogLifecycle.test.ts
- FOUND: .planning/phases/03-interactive-explorer/03-07-SUMMARY.md
- FOUND commit: d5e976d
- FOUND commit: a4cb543
