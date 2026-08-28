---
status: diagnosed
trigger: "G-03-5: SurveySummaryModal still closes immediately after clicking a survey card on the homepage, even after plan 03-04 (commit 90ca09d) supposedly fixed this exact bug (previously diagnosed as G-03-2, a StrictMode double-invoke dialog lifecycle bug). Goal: find_root_cause_only."
created: 2026-08-28T00:00:00Z
updated: 2026-08-28T00:10:00Z
---

## Current Focus

hypothesis: CONFIRMED (see Resolution)
test: n/a — root cause confirmed, goal is find_root_cause_only
expecting: n/a
next_action: return ROOT CAUSE FOUND to caller; do not fix

reasoning_checkpoint:
  hypothesis: "The 90ca09d fix's cleanup ordering (removeEventListener BEFORE dialog.close()) is built on a synchronous mental model of the dialog's native 'close' event, but the WHATWG spec mandates that close() queues the 'close' event as a TASK on the 'user interaction task source' — i.e. it fires asynchronously, not during the close() call itself. React StrictMode's dev-only mount->cleanup->remount double-invoke for a component's effects runs fully synchronously (setup, cleanup, setup all execute back-to-back within the same effect-flush pass, before any browser-queued task can run). So during the simulated unmount: cleanup removes the OLD listener and calls close() (which queues a close-event task for LATER, listener-agnostic — it doesn't matter the old listener was already removed, because the eventual dispatch just fires 'close' at the dialog element, to whatever listener happens to be attached WHEN the queued task actually runs); then, still synchronously, setup runs again and attaches a NEW listener and reopens the dialog. Only AFTER all of that completes does the browser get to run the queued close-event task from the earlier close() call — and by then the NEW listener is attached, so it receives the event and calls onClose() for real, deleting the ?enquesta= param and unmounting the modal for real. The fix's ordering defense (listener-off-before-close) only prevents a SYNCHRONOUS re-entry into the SAME listener instance; it does nothing against a listener re-attached before an asynchronously-queued event fires."
  confirming_evidence:
    - "WHATWG HTML spec (interactive-elements.html, dialog close() steps) text confirmed via search: dialog.close() 'queue[s] an element task on the user interaction task source given the subject element to fire an event named close at subject' — the close event is a queued task, not a synchronous side effect of calling close()."
    - "React's own documentation and multiple independent sources describe StrictMode's double-invoke sequence for a component's effects as 'setup runs, cleanup runs immediately, then setup runs again' — i.e. synchronous back-to-back execution within a single effect-flush pass, with no yield back to the browser's task queue in between."
    - "React's official docs use the EXACT showModal()/close() <dialog> pairing as their own canonical example of what StrictMode's double-invoke does to a dialog element ('your Effect will call showModal(), then immediately close(), and then showModal() again') — confirming this app's mount sequence (setup->cleanup->setup, all before any queued browser task runs) is the expected/documented StrictMode behavior, not an unusual edge case."
    - "Current src/components/SurveySummaryModal.tsx (lines 66-95) still attaches a live 'close' listener (wired to onCloseRef.current(), i.e. real onClose) on every effect setup, including the StrictMode-driven second (remount) setup — so by the time the first close()'s queued event fires, a listener that WILL invoke real onClose is already back in place."
    - "git show confirms the 3 commits made after 90ca09d (0965305, 3012a49, b4e9382) only touched the fetch-effect/loading-state/error-copy logic, never the dialog lifecycle effect (lines 66-95) — ruling out 'the fix was reverted/undone' as the explanation."
  falsification_test: "If dialog.close()'s 'close' event were dispatched SYNCHRONOUSLY (contradicting the spec), the 90ca09d fix's ordering (listener removed before close()) would correctly prevent the OLD listener from ever seeing the event, and the bug would not reproduce. It does reproduce (per fresh UAT test 5), which is consistent with (not independently re-derived from, since no browser tool was available in this session — see blind_spots) the async-queued-task spec behavior being the operative mechanism."
  fix_rationale: "n/a — goal is find_root_cause_only; a separate gap-closure plan should implement the fix. (Any correct fix must stop RELYING on listener-removal ordering relative to close(), since that defense is void once the event is known to be asynchronous — e.g. track a boolean/generation-ref distinguishing a StrictMode-cleanup-triggered close from a genuine user dismissal, or avoid calling dialog.close() in the mount effect's cleanup entirely, since the dialog DOM node is being removed from the document anyway when the component genuinely unmounts.)"
  blind_spots: "Could not execute a live browser click-through in this session either (claude-in-chrome extension not connected/set up; no jsdom/happy-dom/Playwright installed in the repo or available via npx without a network install that was blocked). The diagnosis rests on: (1) a primary-source spec citation (WHATWG's 'queue an element task... to fire an event named close' wording) obtained via WebSearch summarization rather than a direct WebFetch of the spec page's raw text, and (2) React's own documented StrictMode timing model, rather than a captured console/network trace of THIS app reproducing the failure live. The exact scheduling primitive React uses to flush passive effects (MessageChannel-based macrotask vs. microtask) was not independently pinned down, but the conclusion holds under either interpretation since the effect flush's setup->cleanup->setup sequence is universally described as completing before any effect's queued side-external-task (like the dialog's browser-level close event) can be observed to interleave partway through it."
  candidate_causes:
    - "code: SurveySummaryModal.tsx's dialog lifecycle effect re-attaches a live, action-invoking 'close' listener on every StrictMode remount setup, before the PRIOR close() call's asynchronously-queued 'close' event has had a chance to fire — the ordering-based fix only addresses a synchronous race, not the actual asynchronous one."
    - "environment/spec: The browser's dialog 'close' event is specified as a queued task (asynchronous), which is a non-obvious, easy-to-miss detail that both the original G-03-2 diagnosis and the 03-04 fix's own code comments implicitly assumed to be synchronous ('detach the listener BEFORE closing... that simulated close() fires into nothing')."
  and_gate: "No — a single condition (the interaction between React StrictMode's synchronous double-invoke and the dialog's asynchronously-queued close event) fully explains why the fix appeared correct on paper yet did not resolve the real-browser symptom. This is a deeper layer of the SAME root mechanism as G-03-2 (StrictMode's simulated unmount triggering the modal's own onClose), not a second, independent contributing cause — the 90ca09d fix mitigated the symptom's most obvious trigger (synchronous listener re-entry) but left the actual async trigger unaddressed."

## Symptoms

expected: Clicking a survey card on the homepage opens SurveySummaryModal and it stays open until the visitor dismisses it (Escape, Tanca button, or backdrop click), with React StrictMode active under `npm run dev`.
actual: "The modal closes immediately" (verbatim user UAT response, re-testing after the fix)
errors: None reported by user
reproduction: Run `npm run dev`, click a survey card on the homepage — the modal opens then closes immediately. UAT Test 5 in .planning/phases/03-interactive-explorer/03-UAT.md
started: |
  Regression/re-failure of previously-diagnosed-and-fixed G-03-2. Original diagnosis:
  .planning/debug/g-03-2-modal-closes-immediately.md (StrictMode double-invoke dialog lifecycle,
  fixed by merging two effects into one idempotent effect in commit 90ca09d, per
  .planning/phases/03-interactive-explorer/03-04-SUMMARY.md). Three commits have touched
  SurveySummaryModal.tsx SINCE the fix: 0965305, 3012a49 (WR-03 loading-reset rework),
  b4e9382 (WR-04 error copy) — need to verify none of these reintroduced a lifecycle defect.

## Eliminated

(none yet — investigation in progress)

## Evidence

- timestamp: 2026-08-28T00:00:00Z
  checked: .planning/debug/g-03-2-modal-closes-immediately.md (original diagnosis) and .planning/phases/03-interactive-explorer/03-04-SUMMARY.md (the fix)
  found: |
    Original root cause: SurveySummaryModal's two independent mount effects (imperative
    showModal/close in one, native 'close' listener wired to onClose in another) were not
    StrictMode-idempotent — the simulated unmount's close() fired a real 'close' event into
    the still-attached listener, invoking onClose (which deletes the ?enquesta= param that
    keeps the modal mounted). Fix (90ca09d): merged into one dependency-less effect, cleanup
    order = removeEventListener BEFORE dialog.close(), onClose read via ref.
  implication: Need to verify this fix is still intact in current HEAD and wasn't undone/altered
    by the three subsequent commits, and that it's logically sound.

- timestamp: 2026-08-28T00:00:00Z
  checked: git show 90ca09d -- src/components/SurveySummaryModal.tsx (the fix diff) vs current src/components/SurveySummaryModal.tsx (HEAD)
  found: |
    The fix's core structure IS still present in current HEAD (lines 66-95): single dependency-less
    effect, addEventListener('close', handleClose) then `if (!dialog.open) dialog.showModal()`,
    cleanup removes listener THEN calls dialog.close(). onClose read via onCloseRef (synced in a
    separate no-deps effect at lines 62-64) — matches the described fix exactly, not reverted.
  implication: The 90ca09d fix for the ORIGINAL mechanism (StrictMode simulated-unmount firing a
    real close event) is intact. If the symptom still reproduces, either (a) this fix has a flaw
    not caught by the original diagnosis, or (b) a NEW/different mechanism is now responsible,
    possibly introduced by one of the three subsequent commits (0965305, 3012a49, b4e9382) which
    added the `trackedEnquestaId` render-time reset and reworked the fetch effect.

- timestamp: 2026-08-28T00:00:00Z
  checked: current src/components/SurveySummaryModal.tsx in full (post all 4 commits: 90ca09d, 0965305, 3012a49, b4e9382)
  found: |
    Component now has, in render-body order:
    1. `dialogRef`, `onCloseRef` refs.
    2. `state` (FetchState) via useState.
    3. `trackedEnquestaId` state + render-time bailout: `if (enquestaId !== trackedEnquestaId) { setTrackedEnquestaId(enquestaId); setState({status:'loading'}) }` — a render-phase setState (WR-03 fix), runs on EVERY render where enquestaId differs from trackedEnquestaId (i.e., only the first render after enquestaId prop changes).
    4. Effect (no deps, runs every render): `onCloseRef.current = onClose`.
    5. Effect (deps []): the dialog lifecycle effect (the G-03-2 fix) — showModal/close + close-listener, mount-once semantics.
    6. `idValid = isValidEnquestaId(enquestaId)` computed at render time, AFTER the trackedEnquestaId bailout.
    7. Effect (deps [enquestaId, idValid]): the fetch effect.
  implication: The render-time bailout (item 3) fires on the VERY FIRST render of the component
    too, since trackedEnquestaId is initialized via `useState(enquestaId)` (same value) — so on
    first render `enquestaId === trackedEnquestaId` already, no bailout re-render is triggered on
    mount. This path is inert for the initial-open case and doesn't affect the dialog lifecycle
    effect (deps []) at all — it's an unrelated render-time reset for a different bug (WR-03).
    Ruled out as a contributing cause; the dialog lifecycle effect (item 5) is unchanged by any
    of the 3 post-90ca09d commits (confirmed via git show against each, see above).

- timestamp: 2026-08-28T00:00:00Z
  checked: WebSearch — "HTMLDialogElement close() method close event synchronous or queued task spec" and the WHATWG HTML spec's dialog close() steps
  found: |
    The spec's close() algorithm performs synchronous internal steps (remove the open attribute,
    clear modal state) and then "queue[s] an element task on the user interaction task source
    given the subject element to fire an event named close at subject" — i.e. the 'close' event
    is NOT dispatched synchronously as part of calling close(); it fires later, as a separately
    queued browser task.
  implication: This directly undermines the 90ca09d fix's stated mental model (its own code
    comment says "detach the listener BEFORE closing... that simulated close() fires into
    nothing"). Since the event fires asynchronously, detaching the OLD listener before calling
    close() does not matter — what matters is whether ANY listener is attached to the dialog
    at the moment the QUEUED close event later fires, which (per the next evidence entry) is
    after a NEW listener has already been attached by StrictMode's remount.

- timestamp: 2026-08-28T00:00:00Z
  checked: WebSearch — React 18/19 StrictMode double-effect-invoke timing ("setup runs, cleanup runs immediately, then setup runs again") and React's own documentation's canonical dialog showModal/close StrictMode example
  found: |
    Multiple independent sources (including content sourced from React's own docs) describe
    StrictMode's mount-time double-invoke as happening with cleanup running "immediately" after
    the first setup, and the second setup running immediately after cleanup — all synchronously,
    within one effect-flush pass, before the browser has a chance to process any separately
    queued task. React's own docs literally use showModal()/close() on a <dialog> as their
    textbook example of exactly this setup->cleanup->setup sequence.
  implication: Combined with the previous entry, this establishes the exact race: the dialog
    lifecycle effect's cleanup (during StrictMode's simulated unmount) calls close(), which only
    QUEUES the 'close' event for later — it does not fire immediately. Before that queued event
    can fire, the SAME synchronous effect-flush pass has already run the second setup, which
    attaches a NEW 'close' listener (wired to real onClose via onCloseRef) and reopens the
    dialog. When the queued 'close' event from the earlier close() call finally fires, the NEW
    listener is the one attached, and it invokes onClose() for real — deleting the ?enquesta=
    param and unmounting the modal for real, moments after it appeared to (re)open.
    This is the mechanism that survives the 90ca09d fix: the fix's ordering defense
    (removeEventListener before close()) only guards against a hypothetical SYNCHRONOUS
    dispatch of the close event into the OLD listener; it does nothing against the actual
    asynchronous dispatch reaching a NEW listener that was re-attached in the interim.

## Resolution

root_cause: |
  G-03-2's ROOT MECHANISM (React StrictMode's dev-only simulated mount->unmount->remount firing
  a spurious dialog close that deletes the ?enquesta= URL param keeping the modal mounted) is
  still active, because commit 90ca09d's fix rests on an incorrect assumption about the timing
  of the native `<dialog>` element's 'close' event.

  The WHATWG HTML spec's close() algorithm queues the 'close' event as a separate browser task
  ("queue an element task on the user interaction task source... to fire an event named close")
  rather than dispatching it synchronously as part of the close() call. React StrictMode's
  mount-time double-invoke (setup -> cleanup -> setup) runs entirely synchronously, within one
  effect-flush pass, before the browser gets a chance to run any separately queued task.

  Sequence during the very first (StrictMode-doubled) mount of SurveySummaryModal:
    1. Effect setup #1: addEventListener('close', handlerA); dialog.showModal().
    2. StrictMode's simulated-unmount cleanup (runs immediately, synchronously): removeEventListener
       (removes handlerA); dialog.close() — this synchronously closes the dialog but only QUEUES
       the 'close' event for later; it does not fire it now.
    3. StrictMode's remount setup #2 (runs immediately, synchronously, still before the queued
       event fires): addEventListener('close', handlerB) [a live listener wired to real onClose
       via onCloseRef]; dialog.showModal() again (dialog.open was false after step 2's close()).
    4. LATER, when the browser actually processes the task queued in step 2, it fires 'close' on
       the dialog element. The only listener currently attached is handlerB (from step 3) — it
       fires, calling onCloseRef.current() (the real onClose), which deletes the `?enquesta=`
       search param that is the sole thing keeping SurveySummaryModal mounted (HomePage.tsx:88).
       The modal unmounts for real, moments after appearing to open.

  The 90ca09d fix's cleanup-ordering defense (detach listener BEFORE calling close(), per its own
  code comment: "that simulated close() fires into nothing") is built on the assumption that the
  close event fires synchronously as part of close(). It does not — so removing the OLD listener
  before closing accomplishes nothing, because a NEW listener is re-attached (by the synchronous
  remount setup) before the asynchronously-queued close event has a chance to fire, and that new
  listener is what actually receives it.

  This is the SAME root mechanism as G-03-2 (StrictMode's simulated unmount triggering a real,
  persistent onClose side effect), one layer deeper than what the 03-04 fix addressed: the fix
  correctly neutralized a hypothetical SYNCHRONOUS listener race but left the actual ASYNCHRONOUS
  one (native browser event-queueing semantics for `<dialog>`'s close event) completely open.
  None of the 3 commits made after 90ca09d (0965305, 3012a49, b4e9382 — WR-03/WR-04 fixes)
  touched the dialog lifecycle effect; the fix was not reverted or undone, it was simply
  incomplete against the real (asynchronous) browser behavior.
fix: (not applied — goal: find_root_cause_only; a separate gap-closure plan should implement the fix)
verification: (not applicable — no fix applied in this session)
files_changed: []
