---
status: diagnosed
trigger: "G-03-2 (03-UAT.md): Clicking a survey card on the homepage opens SurveySummaryModal but it closes immediately. Regression suspected from Phase 3's App.tsx route-awareness change. Goal: find_root_cause_only."
created: 2026-08-27T19:30:12Z
updated: 2026-08-27T19:30:12Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-08-29
  status: diagnosed
---

## Current Focus

hypothesis: CONFIRMED (see Resolution)
test: n/a — root cause confirmed, goal is find_root_cause_only
expecting: n/a
next_action: return ROOT CAUSE FOUND to caller; do not fix

reasoning_checkpoint:
  hypothesis: "SurveySummaryModal.tsx's two-effect design (Effect 1: showModal() on mount / dialog.close() on cleanup; Effect 2: addEventListener('close', handleClose) where handleClose invokes the onClose prop) combined with React 19 StrictMode's dev-only mount->simulated-unmount->remount cycle causes a spurious native 'close' event to fire during the simulated unmount, invoking onClose (HomePage's onCloseSummary, which deletes the ?enquesta= search param) as a REAL side effect — even though the component visually remounts a moment later. This causes openEnquestaId to become null and the modal to actually unmount right after appearing to open."
  confirming_evidence:

    - "src/main.tsx wraps the whole app in <StrictMode> since the very first scaffold commit (972f24f) — unchanged through Phase 3."
    - "SurveySummaryModal.tsx:25-29 unconditionally calls dialog?.close() in the cleanup of the mount effect; SurveySummaryModal.tsx:31-37 attaches a native 'close' listener in a SEPARATE effect that calls onClose(); onClose is HomePage's onCloseSummary (HomePage.tsx:67-72), which deletes the 'enquesta' search param — the only thing keeping the modal mounted (HomePage.tsx:88)."
    - "External research (WebSearch) confirms this exact combination — imperative dialog open/close paired with a 'close' event listener wired to a closing state callback — is a documented React 18/19 StrictMode dev-mode footgun producing precisely the 'dialog closes immediately after opening' symptom, because the simulated-unmount's close() call fires a real close event before/without knowledge that the component is about to be simulate-remounted."
    - "git log confirms src/pages/HomePage.tsx and src/components/SurveySummaryModal.tsx have NOT been modified since Phase 1 (last touch: c8e3d8a, feat(01-03)) — the defect is pre-existing code, not something Phase 3 introduced."
    - "01-VERIFICATION.md test 2 (Phase 1's only human check of this exact modal flow) was run against scripts/gh-pages-preview.mjs, which serves a PRODUCTION build (npm run build output) — production React does not perform StrictMode's dev-only double-effect-invocation, so the defect was never exercised and the test correctly passed."
    - "03-UAT.md test 2 (Phase 3's UAT, where the regression was reported) does not call out a build/preview step, unlike tests 3 and 4 which explicitly say 'Run npm run build then npm run preview:pages' — strongly implying test 2 was run via npm run dev, which DOES run StrictMode's double-invoke, exposing the pre-existing defect for the first time."
    - "App.tsx's only Phase 3 change is gating the shared <header>/<main> wrapper on isExplorerRoute = pathname.startsWith('/enquesta/'); on the homepage route ('/') this evaluates false, so App.tsx renders the IDENTICAL tree (header + max-w-3xl main) it rendered before Phase 3 — it cannot be the mechanism behind this symptom on the homepage."
  falsification_test: "If the modal is opened via the production build (npm run build && npm run preview:pages) instead of npm run dev, it should stay open (no StrictMode double-invoke in production React). If it still closes immediately under a production build, this hypothesis is wrong and the cause must be something else (e.g., a real double-mount from a key change, or App.tsx). Not yet executed live (no browser automation tool available in this environment — see blind_spots)."
  fix_rationale: "n/a — goal is find_root_cause_only; a separate gap-closure plan implements the fix."
  blind_spots: "Could not execute a live browser click-through in this environment (no Chrome extension connected, no Playwright/Puppeteer in the repo, and vitest's test environment is 'node' with no DOM — see Evidence). The diagnosis rests on code inspection + git history + externally-documented React/StrictMode+<dialog> behavior, not a directly observed console/network trace of this specific app. The exact spec timing of whether HTMLDialogElement's close event is dispatched synchronously or via a queued task was not independently verified against the installed browser engine — the outcome (spurious onClose invocation) holds either way given effect cleanup ordering, but this is flagged as unverified minutiae."
  candidate_causes:

    - "code: SurveySummaryModal.tsx's two-effect split (imperative dialog.close() in one effect's cleanup; native 'close' listener wired to app state in a second effect) is not StrictMode-idempotent/re-entrant-safe."
    - "environment (test method, not app environment): Phase 1's human verification ran against a production build (no StrictMode double-invoke) while Phase 3's UAT very likely ran against the dev server (StrictMode double-invoke active) — this is why the same code newly 'regresses' under UAT without any Phase 3 code change to the modal itself."
  and_gate: "No — a single condition (StrictMode's dev-only double-effect-invocation exercising a pre-existing non-idempotent effect pair) fully explains the symptom. The 'why now' framing is explained by a difference in HOW it was tested (dev server vs. production preview), not a second contributing code defect. App.tsx was investigated as a candidate second cause and ruled out by evidence (its Phase 3 change is a no-op on the '/' route)."

## Symptoms

expected: Clicking a survey card on the homepage opens SurveySummaryModal and it stays open until the user dismisses it (Back, Escape, backdrop click, or the "Tanca" button).
actual: The modal opens (briefly visible) then closes immediately, without any user action to dismiss it.
errors: None reported by the user (no console error mentioned in the UAT report).
reproduction: |
  Test 2, .planning/phases/03-interactive-explorer/03-UAT.md, gap G-03-2.

  1. Run `npm run dev` (not the production preview — see Evidence).
  2. Open the homepage (`/`).
  3. Click any survey card.
  4. Observe: SurveySummaryModal opens, then closes immediately with no further interaction.

started: |
  Reported during Phase 3 UAT (2026-08-26/27). User initially framed it as a Phase 3 regression
  (suspecting App.tsx's route-awareness change), but investigation shows the defective code
  (SurveySummaryModal.tsx, HomePage.tsx) is untouched since Phase 1 — see Resolution.root_cause
  for why it surfaces now instead of in Phase 1.

## Eliminated

- hypothesis: "App.tsx's Phase 3 route-awareness change (skipping <header>/<main> wrapper on /enquesta/ routes) interferes with the homepage modal's mount/rendering."
  evidence: "App.tsx's isExplorerRoute = pathname.startsWith('/enquesta/') evaluates false on the homepage route ('/'); the rendered tree for HomePage (header + max-w-3xl <main> wrapper) is byte-for-byte identical to what App.tsx rendered before the Phase 3 diff (git show 61ee3ca -- src/App.tsx confirms the change is purely additive/conditional and only branches for /enquesta/:id). No code path from this change touches HomePage or SurveySummaryModal rendering or lifecycle."
  timestamp: 2026-08-27T19:30:12Z

- hypothesis: "A click-outside/backdrop-click handler is misfiring and closing the dialog right after open."
  evidence: "handleBackdropClick (SurveySummaryModal.tsx:72-76) only closes when event.target === dialogRef.current, i.e., a click directly on the <dialog> backdrop area. The click that OPENS the modal happens on the SurveyCard button on the homepage, before the dialog element even exists in the DOM (SurveySummaryModal only mounts once openEnquestaId becomes truthy on the NEXT render) — that originating click cannot be misattributed to the dialog's own backdrop-click handler, since the two elements are never both present for the same click event."
  timestamp: 2026-08-27T19:30:12Z

## Evidence

- timestamp: 2026-08-27T19:30:12Z
  checked: src/App.tsx (current) and its Phase 3 diff (git show 61ee3ca -- src/App.tsx)
  found: "isExplorerRoute only affects rendering when pathname starts with '/enquesta/'; homepage ('/') rendering is unchanged from pre-Phase-3."
  implication: "Rules out the user's initial suspicion (App.tsx) as the mechanism for the homepage symptom."

- timestamp: 2026-08-27T19:30:12Z
  checked: src/pages/HomePage.tsx, src/components/SurveySummaryModal.tsx
  found: |
    HomePage renders `{openEnquestaId && <SurveySummaryModal enquestaId={openEnquestaId} onClose={onCloseSummary} />}`.
    openEnquestaId is derived from the `?enquesta=` search param. onCloseSummary deletes that param.
    SurveySummaryModal has two separate mount-time effects:
      Effect 1 (deps []): `dialog?.showModal()` on setup; `dialog?.close()` on cleanup.
      Effect 2 (deps [onClose]): `dialog.addEventListener('close', handleClose)` where `handleClose = () => onClose()`; cleanup removes the listener.
  implication: "The only thing keeping the modal mounted is the `?enquesta=` search param. Anything that fires the dialog's native 'close' event (which invokes onClose -> deletes the param) will make the modal disappear for real, not just visually."

- timestamp: 2026-08-27T19:30:12Z
  checked: src/main.tsx
  found: "<StrictMode> wraps <BrowserRouter><App /></BrowserRouter>, present since the initial scaffold commit (972f24f) — unchanged through every subsequent commit including Phase 3's 61ee3ca."
  implication: "React's dev-only 'mount -> simulate unmount -> remount' double-effect-invocation is active for every component in this app, including SurveySummaryModal, whenever the app runs under `npm run dev` (or any non-production React build)."

- timestamp: 2026-08-27T19:30:12Z
  checked: WebSearch — 'React 19 StrictMode double invoke effects' and 'HTMLDialogElement close() event React StrictMode dialog closes immediately'
  found: "Multiple independent sources confirm (a) React 18/19 StrictMode's dev-only mount/cleanup/remount cycle for effects is unchanged in React 19, and (b) this exact combination (imperative dialog.close() in an effect cleanup + a 'close' event listener wired to app state) is a documented footgun that produces precisely the 'dialog opens then closes immediately' symptom, because the simulated unmount's close() call triggers the 'close' event/listener as if the user had dismissed it."
  implication: "The mechanism is a known class of bug, not a speculative one-off theory — independently corroborated outside this codebase."

- timestamp: 2026-08-27T19:30:12Z
  checked: git log -- src/pages/HomePage.tsx src/components/SurveySummaryModal.tsx
  found: "Last commit touching either file is c8e3d8a, 'feat(01-03): wire card to summary to explorer via URL state (HOME-04)' — a Phase 1 commit. Neither file has been touched since, including during all of Phase 3."
  implication: "The defective code predates Phase 3 entirely; Phase 3 did not introduce this bug in these files. Whatever changed is not the modal's own code."

- timestamp: 2026-08-27T19:30:12Z
  checked: .planning/phases/01-foundation-survey-listing/01-VERIFICATION.md (test 2) and .planning/phases/01-foundation-survey-listing/01-UAT.md
  found: "Phase 1's human check of this exact flow ('click the demo-2024 card... Back and Escape both close the modal...' -> result: pass) was performed against `node scripts/gh-pages-preview.mjs --fixtures scripts/fixtures`, which serves the `dist/` PRODUCTION build output (confirmed by reading scripts/gh-pages-preview.mjs and package.json's `preview:pages` script) — not `npm run dev`."
  implication: "Production React does not run StrictMode's double-effect-invocation, so Phase 1's test never exercised the code path that causes this bug. The 'pass' result in Phase 1 is consistent with the bug being present in the code all along but untriggered by that test method."

- timestamp: 2026-08-27T19:30:12Z
  checked: .planning/phases/03-interactive-explorer/03-UAT.md test 2 vs. tests 3 and 4
  found: "Tests 3 and 4 explicitly instruct 'Run npm run build then npm run preview:pages' before their steps. Test 2 (where G-03-2 was reported) has no such instruction — its steps are plain interaction steps with no build/preview call-out."
  implication: "Strongly suggests test 2 was run via the default `npm run dev` workflow, which DOES trigger StrictMode's double-effect-invocation — explaining why the pre-existing defect surfaced now, under Phase 3 UAT, without any Phase 3 change to the modal's own code."

- timestamp: 2026-08-27T19:30:12Z
  checked: vite.config.ts (test config) and package.json (no playwright/cypress/puppeteer dependency); attempted to use claude-in-chrome skill for a live click-through
  found: "vitest's `test.environment` is 'node' (no DOM at all — existing *.test.ts files are pure-logic tests, not component/DOM tests). No e2e browser-automation tooling is installed. The claude-in-chrome skill reported the Chrome extension is not connected in this session."
  implication: "There is no automated gate (unit, component, or e2e) in this repo that could have caught this class of bug, and no browser tool was available in this environment to directly observe a live reproduction. Diagnosis rests on code inspection, git history, and externally-corroborated documentation of the exact mechanism (see above) rather than a directly captured console/network trace — see reasoning_checkpoint.blind_spots."

## Resolution

root_cause: |
  SurveySummaryModal.tsx's dialog lifecycle is split across two independent effects that are not
  safe under React's development-only StrictMode double-invocation:

    - Effect 1 (SurveySummaryModal.tsx:25-29): calls `dialog?.showModal()` on setup and
      unconditionally `dialog?.close()` on cleanup.

    - Effect 2 (SurveySummaryModal.tsx:31-37): attaches a native `close` event listener that calls
      the `onClose` prop — which, via HomePage.tsx's `onCloseSummary` (HomePage.tsx:67-72), deletes
      the `?enquesta=` search param that is the ONLY thing keeping the modal mounted
      (HomePage.tsx:88: `{openEnquestaId && <SurveySummaryModal .../>}`).
  React's StrictMode (active in dev via <StrictMode> in main.tsx, unchanged since the initial
  scaffold) deliberately mounts every component, immediately simulates an unmount (running all
  effect cleanups), then remounts it (re-running all effect setups) — a dev-only behavior meant to
  surface exactly this class of non-idempotent effect. During the simulated unmount, Effect 1's
  cleanup calls `dialog.close()` while Effect 2's `close` listener is still attached, firing the
  native `close` event and invoking `onClose()` — a REAL state change (deleting the URL search
  param) — even though the component visually remounts moments later. The result: the modal
  appears to open, then closes immediately, because the URL state that gates its rendering was
  deleted as a side effect of React's simulated (not real) unmount cycle.

  This is a pre-existing Phase 1 defect, not a Phase 3 regression: HomePage.tsx and
  SurveySummaryModal.tsx are unchanged since commit c8e3d8a (Phase 1). It was not caught in Phase 1
  because Phase 1's human verification (01-VERIFICATION.md test 2) ran against a PRODUCTION build
  (scripts/gh-pages-preview.mjs serving dist/), where StrictMode's double-invoke never runs. Phase
  3's UAT test 2 (where G-03-2 was reported) shows no production-build call-out (unlike tests 3/4),
  indicating it ran via `npm run dev`, which DOES trigger the double-invoke — surfacing the latent
  bug for the first time. App.tsx's Phase 3 route-awareness change was investigated and ruled out:
  it only branches for `/enquesta/:id` and renders identically to pre-Phase-3 on the homepage route.
fix: (not applied — goal: find_root_cause_only; a separate gap-closure plan implements the fix)
verification: (not applicable — no fix applied in this session)
files_changed: []
