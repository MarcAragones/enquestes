---
schema_version: 1
open_count: 4
waived_count: 0
fixed_count: 0
total_count: 4
last_updated: 2026-08-26T21:59:13.876Z
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
  }
]
````
