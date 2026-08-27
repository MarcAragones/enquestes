---
schema_version: 1
open_count: 7
waived_count: 0
fixed_count: 0
total_count: 7
last_updated: 2026-08-27T20:39:42.403Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | unrun-verify | .planning/phases/02-offline-data-pipeline/02-03-PLAN.md |  | Task 2 human-check (visual survey-card + KPI modal confirmation via npm run preview:pages) not performed in this autonomous worktree run; data-serving path proxy-verified via curl HTTP 200 instead | open |  | 2026-08-26T12:19:37.483Z |  |
| 2 | 03 | unrun-verify | .planning/phases/03-interactive-explorer/03-01-PLAN.md |  | Task 3 human-check (two loading phases, field typing, drag-and-drop across bar/line/area/scatter, full-width canvas, refresh-safe deep link, no console errors) not performed in this sequential-executor continuation run; all automated verify steps (vitest, build, lint, verify:pages, verify:explorer) passed, harvested to end-of-phase UAT per human_verify_mode: end-of-phase | open |  | 2026-08-26T20:40:03.523Z |  |
| 3 | 03 | unrun-verify | .planning/phases/03-interactive-explorer/03-02-PLAN.md |  | Task 1 human-check (single header row in every state, back-link navigation, dark-mode toggle restyling header+canvas via GraphicWalker appearance prop, narrow-viewport wrap/truncate, invalid-id header persistence) not performed in this resumed executor run; all automated verify steps (build, lint, structural asserts, verify:explorer, verify:pages) passed, harvested to end-of-phase UAT per human_verify_mode: end-of-phase | open |  | 2026-08-26T21:59:13.696Z |  |
| 4 | 03 | unrun-verify | .planning/phases/03-interactive-explorer/03-02-PLAN.md |  | Task 2 human-check (collapsed dictionary panel between header and canvas, all 6 fields listed with correct type captions and no description/undefined leakage, no layout jump on collapse, keyboard operability, narrow-viewport readability, production-build responsiveness pass at ~375px/~768px) not performed in this resumed executor run; all automated verify steps (build, lint, structural asserts, verify:explorer, verify:pages) passed, harvested to end-of-phase UAT per human_verify_mode: end-of-phase | open |  | 2026-08-26T21:59:13.876Z |  |
| 5 | 03 | unrun-verify | .planning/phases/03-interactive-explorer/03-03-PLAN.md |  | Task 3 human-check (image export via GraphicWalker's own toolbar, copy-link/Copiat! swap with address bar untouched, pasted-link exact-reproduction round trip including active filter, three hostile-link variants landing silently blank, cross-survey link safety, narrow-viewport header layout) not performed in this sequential-executor run; all automated verify steps (vitest, build, lint, verify:explorer, verify:pages, structural asserts) passed, harvested to end-of-phase UAT per human_verify_mode: end-of-phase | open |  | 2026-08-26T22:11:32.321Z |  |
| 6 | 03 | unrun-verify | src/pages/ExplorerPage.tsx |  | 03-06 Task 1 human-check not run (no browser tool in this environment): confirm /enquesta/no-existeix-aquesta and a malformed id both show the not-found heading with no retry button, and mostra-sintetica still loads normally in the production preview | open |  | 2026-08-27T20:39:42.217Z |  |
| 7 | 03 | unrun-verify | src/pages/ExplorerPage.tsx |  | 03-06 Task 2 human-check not run (no browser tool in this environment): confirm a newly built chart visually fills the canvas, the share-link round trip restores a large chart, malformed/truncated/cross-survey chart params fail soft, and the layout holds at ~375px/~768px and in dark mode | open |  | 2026-08-27T20:39:42.403Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "02",
    "file": ".planning/phases/02-offline-data-pipeline/02-03-PLAN.md",
    "line": null,
    "description": "Task 2 human-check (visual survey-card + KPI modal confirmation via npm run preview:pages) not performed in this autonomous worktree run; data-serving path proxy-verified via curl HTTP 200 instead",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T12:19:37.483Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-interactive-explorer/03-01-PLAN.md",
    "line": null,
    "description": "Task 3 human-check (two loading phases, field typing, drag-and-drop across bar/line/area/scatter, full-width canvas, refresh-safe deep link, no console errors) not performed in this sequential-executor continuation run; all automated verify steps (vitest, build, lint, verify:pages, verify:explorer) passed, harvested to end-of-phase UAT per human_verify_mode: end-of-phase",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T20:40:03.523Z",
    "resolved_at": null
  },
  {
    "id": 3,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-interactive-explorer/03-02-PLAN.md",
    "line": null,
    "description": "Task 1 human-check (single header row in every state, back-link navigation, dark-mode toggle restyling header+canvas via GraphicWalker appearance prop, narrow-viewport wrap/truncate, invalid-id header persistence) not performed in this resumed executor run; all automated verify steps (build, lint, structural asserts, verify:explorer, verify:pages) passed, harvested to end-of-phase UAT per human_verify_mode: end-of-phase",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T21:59:13.696Z",
    "resolved_at": null
  },
  {
    "id": 4,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-interactive-explorer/03-02-PLAN.md",
    "line": null,
    "description": "Task 2 human-check (collapsed dictionary panel between header and canvas, all 6 fields listed with correct type captions and no description/undefined leakage, no layout jump on collapse, keyboard operability, narrow-viewport readability, production-build responsiveness pass at ~375px/~768px) not performed in this resumed executor run; all automated verify steps (build, lint, structural asserts, verify:explorer, verify:pages) passed, harvested to end-of-phase UAT per human_verify_mode: end-of-phase",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T21:59:13.876Z",
    "resolved_at": null
  },
  {
    "id": 5,
    "kind": "unrun-verify",
    "phase": "03",
    "file": ".planning/phases/03-interactive-explorer/03-03-PLAN.md",
    "line": null,
    "description": "Task 3 human-check (image export via GraphicWalker's own toolbar, copy-link/Copiat! swap with address bar untouched, pasted-link exact-reproduction round trip including active filter, three hostile-link variants landing silently blank, cross-survey link safety, narrow-viewport header layout) not performed in this sequential-executor run; all automated verify steps (vitest, build, lint, verify:explorer, verify:pages, structural asserts) passed, harvested to end-of-phase UAT per human_verify_mode: end-of-phase",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-26T22:11:32.321Z",
    "resolved_at": null
  },
  {
    "id": 6,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "src/pages/ExplorerPage.tsx",
    "line": null,
    "description": "03-06 Task 1 human-check not run (no browser tool in this environment): confirm /enquesta/no-existeix-aquesta and a malformed id both show the not-found heading with no retry button, and mostra-sintetica still loads normally in the production preview",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T20:39:42.217Z",
    "resolved_at": null
  },
  {
    "id": 7,
    "kind": "unrun-verify",
    "phase": "03",
    "file": "src/pages/ExplorerPage.tsx",
    "line": null,
    "description": "03-06 Task 2 human-check not run (no browser tool in this environment): confirm a newly built chart visually fills the canvas, the share-link round trip restores a large chart, malformed/truncated/cross-survey chart params fail soft, and the layout holds at ~375px/~768px and in dark mode",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-27T20:39:42.403Z",
    "resolved_at": null
  }
]
````
