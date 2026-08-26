---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-26T20:40:03.523Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | unrun-verify | .planning/phases/02-offline-data-pipeline/02-03-PLAN.md |  | Task 2 human-check (visual survey-card + KPI modal confirmation via npm run preview:pages) not performed in this autonomous worktree run; data-serving path proxy-verified via curl HTTP 200 instead | open |  | 2026-08-26T12:19:37.483Z |  |
| 2 | 03 | unrun-verify | .planning/phases/03-interactive-explorer/03-01-PLAN.md |  | Task 3 human-check (two loading phases, field typing, drag-and-drop across bar/line/area/scatter, full-width canvas, refresh-safe deep link, no console errors) not performed in this sequential-executor continuation run; all automated verify steps (vitest, build, lint, verify:pages, verify:explorer) passed, harvested to end-of-phase UAT per human_verify_mode: end-of-phase | open |  | 2026-08-26T20:40:03.523Z |  |

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
  }
]
````
