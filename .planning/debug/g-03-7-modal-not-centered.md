---
status: diagnosed
trigger: "UAT re-verification (2026-08-28), test 8, gap G-03-7: SurveySummaryModal's <dialog> opens pinned to the top-left of the viewport instead of centered, under npm run dev (and confirmed also present in a production `vite build`)."
created: 2026-08-28T00:00:00Z
updated: 2026-08-28T00:00:00Z
---

## Current Focus

hypothesis: CONFIRMED — Tailwind v4 Preflight's universal margin reset (`*, ::before, ::after, ::backdrop { margin: 0 }`, emitted in `@layer base`) is an author-origin normal-priority rule, and author-origin normal rules always beat user-agent-origin normal rules in the CSS cascade regardless of specificity or layering. This silently overrides the browser's built-in `dialog:modal { position: fixed; inset-block: 0; margin: auto; }` UA rule that centers a `<dialog>` shown via `showModal()`. `SurveySummaryModal`'s `<dialog>` className has no explicit centering utility (no `m-auto`/`mx-auto`), so it inherits `margin: 0` from Preflight, collapsing to the top-left of its fixed-position containing block (the viewport).
test: n/a — root-cause-only diagnosis, no fix applied
expecting: n/a
next_action: n/a — return ROOT CAUSE FOUND to caller for gap-closure planning

## Symptoms

expected: When `SurveySummaryModal`'s `<dialog>` is opened via `showModal()`, it should appear centered on the viewport (the browser's default `dialog:modal` UA-stylesheet behavior: `position: fixed; inset-block: 0; margin: auto;`).
actual: The dialog renders pinned to the top-left corner of the viewport instead of centered.
errors: None reported (no console errors).
reproduction: Test 8 in `.planning/phases/03-interactive-explorer/03-UAT.md` — run `npm run dev`, click a survey card on the homepage, observe modal position. Independently reproduced by inspecting the compiled CSS output of both `npm run dev`'s Tailwind pipeline (via source `node_modules/tailwindcss/preflight.css`) and a production `vite build` (`dist/assets/index-*.css`) — both include the same Preflight margin-reset rule, so the bug is present in both environments, not dev-only.
started: Newly discovered during UAT re-verification of gap-closure plan 03-07 (2026-08-28). The dialog previously always self-closed within a fraction of a second under `npm run dev` (the G-03-5 StrictMode bug), so nobody could previously observe its resting visual position long enough to notice this pre-existing layout defect — it was masked, not introduced, by 03-07.

## Eliminated

- hypothesis: 03-07 (commits a4cb543, d5e976d, 0507a93) introduced or changed the dialog's centering CSS.
  evidence: `git show a4cb543 -- src/components/SurveySummaryModal.tsx` shows the diff touches only the two lifecycle `useEffect` bodies (replacing the inline detach-before-close cleanup with `openDialogLifecycle(...)`) — the `<dialog>` JSX element and its `className` string (lines 136-139) are byte-identical before and after. d5e976d only adds new files (`src/lib/dialogLifecycle.ts`, `.test.ts`). 0507a93 only touches `.planning/WINDOWS.md` and adds a SUMMARY.md. No CSS or className changes in any of the three commits.
  timestamp: 2026-08-28

## Evidence

- timestamp: 2026-08-28
  checked: `src/components/SurveySummaryModal.tsx` lines 136-139 (the `<dialog>` element's className)
  found: `className="w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-6 text-zinc-900 backdrop:bg-black/50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"` — no `m-auto`/`mx-auto`/`my-auto`, no explicit `position`/`inset` utility, no custom `<dialog>` CSS anywhere else in `src/` (`grep -rn "dialog"` across `src/**/*.{ts,tsx,css}` shows only the lifecycle/ref/test code, zero CSS rules targeting `dialog`).
  implication: The dialog relies entirely on the browser's UA stylesheet for its centering; nothing in the app's own code provides a fallback centering utility.

- timestamp: 2026-08-28
  checked: `src/index.css` in full
  found: `@import "tailwindcss";` on line 6 (Tailwind v4's single-import entry point, which pulls in Preflight unconditionally — Preflight is not content-scanned/tree-shaken like utility classes). No custom dialog-related CSS in this file (only `@theme` tokens, a `dark` custom-variant, and `color-scheme` on `:root`/`.dark`).
  implication: Preflight's base-reset layer is active in this project and provides the only CSS "explanation" needed to override the UA rule.

- timestamp: 2026-08-28
  checked: `node_modules/tailwindcss/preflight.css` lines 7-16
  found: `*, ::after, ::before, ::backdrop, ::file-selector-button { box-sizing: border-box; margin: 0; padding: 0; border: 0 solid; }` — the universal selector `*` matches every element in the document, including `<dialog>`.
  implication: This is the exact rule zeroing the dialog's margin. Its selector specificity is irrelevant to the outcome (see next entry) — what matters is its cascade *origin*.

- timestamp: 2026-08-28
  checked: `dist/assets/index-*.css` after running `npx vite build --base=/enquestes/` (production build, not just dev)
  found: The compiled output contains `@layer base{*,:after,:before,::backdrop{box-sizing:border-box;border:0 solid;margin:0;padding:0}...}` — confirms the Preflight margin-reset survives Tailwind's build pipeline into the actual production CSS asset unmodified, wrapped in an author-defined `@layer base`.
  implication: This is not a dev-server-only artifact; the defect is present in the deployed production build too. Also confirms the rule is inside a CSS cascade *layer* (`@layer base`), which is relevant to (but does not change the outcome of) the cascade analysis below.

- timestamp: 2026-08-28
  checked: CSS cascade-origin rules (spec knowledge, cross-checked against reproducible compiled-CSS evidence above) — specifically how an author-origin rule with near-zero specificity (`*`, specificity 0-0-0, even when placed inside `@layer base`) interacts with the user-agent stylesheet's `dialog:modal { position: fixed; inset-block: 0; margin: auto; }` rule (specificity 0-1-1, from the WHATWG HTML rendering spec / browser UA stylesheets)
  found: CSS conflict resolution first sorts by *origin and importance* (user-agent normal < user normal < author normal < ... < author !important < user !important < user-agent !important) BEFORE ever comparing specificity — specificity and cascade layers only break ties *within* the same origin/importance tier. An author-origin normal-importance declaration therefore always wins over a user-agent-origin normal-importance declaration for the same property on the same element, regardless of the author rule's specificity or its (even scoped/layered) selector, and regardless of the UA rule's higher specificity. Author cascade layers (`@layer base`) only affect priority relative to *other author-origin* rules, not relative to the UA stylesheet.
  implication: Preflight's `margin: 0` (author, normal, `@layer base`) unconditionally overrides the UA stylesheet's `margin: auto` on `dialog:modal` (user-agent, normal) for the margin property specifically. The UA rule's other properties (`position: fixed`, `inset-block: 0`) are untouched by Preflight (which declares no `position`/`inset` on `*`), so they continue to apply — meaning the dialog stays `position: fixed` with block-axis inset pinned to 0, but with `margin: 0` instead of `margin: auto`, it no longer gets auto-centered in either axis, collapsing toward the block-start/inline-start corner of the viewport (top-left) — exactly matching the user's reported symptom.

- timestamp: 2026-08-28
  checked: WebSearch corroboration for this exact interaction
  found: This is a known, previously-filed upstream issue: `tailwindlabs/tailwindcss` GitHub issue #16372, "[v4] Preflight removes Margin from Dialog element", plus discussion #13298 ("Why Preflight doesn't reset all margins") and a related issue #17593 for `[popover]` elements hitting the identical mechanism. The community-documented workaround is to add the `m-auto` utility class explicitly to the `<dialog>` element to restore `margin: auto` at author-origin (which then wins the normal author-vs-author specificity/layer fight against Preflight's `*` rule, since utility classes are emitted in a later/more-specific layer than `base`).
  implication: Independently corroborates the cascade-origin mechanism above with a real-world, previously-diagnosed instance of the exact same defect class (Tailwind v4 Preflight + native `<dialog>`/`<popover>` centering), strengthening confidence this is the true root cause rather than a project-specific quirk.

## Resolution

root_cause: "Tailwind v4 Preflight's universal margin-reset rule (`*, ::before, ::after, ::backdrop { margin: 0 }`, in `node_modules/tailwindcss/preflight.css` lines 7-16, pulled in unconditionally by `@import \"tailwindcss\";` in `src/index.css` line 6, and confirmed present verbatim in the production build's compiled CSS under `@layer base`) is an author-origin normal-priority CSS rule. Author-origin normal rules always take precedence over user-agent-origin normal rules in the CSS cascade, regardless of selector specificity or cascade layers (origin/importance is resolved before specificity). This unconditionally overrides the browser UA stylesheet's `dialog:modal { position: fixed; inset-block: 0; margin: auto; }` rule — specifically its `margin: auto` declaration, which is the sole mechanism that auto-centers a native `<dialog>` shown via `showModal()`. Because `SurveySummaryModal`'s `<dialog>` element (src/components/SurveySummaryModal.tsx:136-139) has no explicit `m-auto`/centering utility in its className to counteract Preflight, the dialog is left with `margin: 0` while still `position: fixed; inset-block: 0` (untouched by Preflight), causing it to collapse to the top-left of the viewport instead of centering. This is a pre-existing layout defect, not something introduced by 03-07's dialogLifecycle rewiring — 03-07 only ever changed the lifecycle effect bodies, never the `<dialog>` JSX/className. It was invisible until now because the G-03-5 bug (dialog self-closing within a fraction of a second under npm run dev) meant nobody could observe the dialog's resting position long enough to notice. This is also a known, previously-filed upstream Tailwind CSS issue (tailwindlabs/tailwindcss#16372)."
fix: (not applied — goal is find_root_cause_only)
verification: (not applicable — no fix applied)
files_changed: []
