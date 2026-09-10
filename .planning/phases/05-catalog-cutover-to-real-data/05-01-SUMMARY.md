---
phase: 05-catalog-cutover-to-real-data
plan: 01
subsystem: data-pipeline
tags: [python, pipeline, retirement, catalog-cutover]
dependency-graph:
  requires: []
  provides:
    - "pipeline.index.compute_index_without_id"
    - "scripts/retirar_enquesta.py"
  affects:
    - "public/data/enquestes_index.json"
    - "scripts/verify-explorer-assets.mjs"
    - "scripts/generate_mock_parquet.py"
tech-stack:
  added: []
  patterns:
    - "Write-index-before-unlink-files ordering for atomic-ish destructive operations (mirrors write-before-delete discipline already used for upserts)"
    - "Index-driven build-gate assertions instead of hardcoded survey ids"
key-files:
  created:
    - scripts/retirar_enquesta.py
  modified:
    - scripts/pipeline/index.py
    - scripts/pipeline_selftest.py
    - scripts/verify-explorer-assets.mjs
    - scripts/generate_mock_parquet.py
    - scripts/README.md
    - public/data/enquestes_index.json
  deleted:
    - public/data/enquestes/mostra-sintetica_meta.json
    - public/data/enquestes/mostra-sintetica_respostes.parquet
decisions:
  - "retirar_enquesta.py writes the validated index atomically before unlinking artifact files, so an interruption mid-operation can only ever leave an orphan file (detected by verify_publicacio.py), never a dangling index entry pointing at deleted files."
  - "generate_mock_parquet.py's --out-dir is now required with no default, closing the hole where running the script with default args would silently re-publish synthetic data into public/data/."
  - "verify-explorer-assets.mjs now asserts against whatever survey is first in the served enquestes_index.json rather than a hardcoded id and byte-size constant, so retiring or adding a survey never breaks this build gate again."
metrics:
  duration: "~35 min"
  completed: "2026-09-10"
actuals:
  tokens: 5300
  tasks: 3
  commits: 3
status: complete
---

# Phase 05 Plan 01: Retire the Synthetic Demo Dataset Summary

Gave the pipeline its first survey-removal capability (`compute_index_without_id` + `retirar_enquesta.py`, tested end to end) and used it to retire the fabricated `mostra-sintetica` dataset from the live catalog, leaving only the three real surveys (REO1167, REO1151, REO1145) with every build/verification gate green.

## What Was Built

**Task 1 — Retirement capability (tracer, committed `2910c1c`):**
- `compute_index_without_id(index_path, survey_id)` in `scripts/pipeline/index.py`: pure function, sibling of `compute_upserted_index`, removes one matching entry and returns the array untouched otherwise. Raises `schema.SchemaError` on an absent id or a malformed/missing index file — never a silent no-op.
- `scripts/retirar_enquesta.py`: operator CLI (`--id`, `--data-dir`, default `public/data`). Rejects an invalid id before composing any path, resolves the three target paths with the same containment guard as `convert_enquesta.py`'s `_resolve_output_paths`, then executes strictly in order: `compute_index_without_id` → `schema.validate_index` → `schema.write_json` (atomic) → unlink both artifact files. This ordering is load-bearing: an interruption after the index write but before the unlinks leaves only an orphan file (which `verify_publicacio.py` detects and reports), never an index entry pointing at files that no longer exist.
- 6 new tests in `scripts/pipeline_selftest.py` (`ComputeIndexWithoutIdTests`: 3 tests against the golden fixture; `RetirarEnquestaTests`: 2 tests against a real two-survey published set built in a `TemporaryDirectory()`, including a green `verify_publicacio.main(...)` run afterward, plus a "nothing changes on failure" test).

**Task 2 — Unhardcoded the two hidden couplings (committed `59f098e`):**
- `scripts/verify-explorer-assets.mjs` no longer asserts a hardcoded survey id and a `5597`-byte constant. It now fetches the served `enquestes_index.json`, takes its first entry, and asserts that entry's Parquet is served 200 with non-zero length and its meta is served 200 with a matching `id` and a non-empty `fields[]`. This gate is now agnostic to which survey happens to be first in the catalog.
- `scripts/generate_mock_parquet.py`'s `--out-dir` is now `required=True` with no default, so running the script with only `--id` can no longer silently write synthetic data into `public/data/`.
- `scripts/README.md`: added a `## retirar_enquesta.py` section (purpose, invocation, flags table, note to run `verify_publicacio.py` afterward), corrected the `--out-dir` flags-table row for `generate_mock_parquet.py`, and corrected the "On aterren els artefactes" section — a retirement stops publication (index entry + both artifact files removed) but the blobs remain reachable in git history; it is not erasure.

**Task 3 — Executed the real retirement (committed `50f3c49`):**
- Ran `uv run scripts/retirar_enquesta.py --id mostra-sintetica --data-dir public/data` against the real catalog (not a hand edit, not `rm`).
- `enquestes_index.json` now holds exactly 3 entries (REO1167, REO1151, REO1145) in original order; `public/data/enquestes/` now holds exactly 6 files.
- `uv run scripts/verify_publicacio.py --expect-ids REO1167,REO1151,REO1145` exits 0, "3 enquestes verificades", no orphans.
- Full downstream gate green: `uv run scripts/pipeline_selftest.py` (77 tests, OK), `npm run lint`, `npm run test` (46 tests), `npm run build`, `npm run verify:pages`, `npm run verify:explorer` (this last one passing with the synthetic dataset gone is the proof that Task 2 actually closed the coupling).

## Deviations from Plan

None — plan executed exactly as written. One test count adjustment: the plan's narrative action text described 3+2=5 test scenarios, but the acceptance criteria required "at least 6 tests run" for `ComputeIndexWithoutIdTests RetirarEnquestaTests`. Added one additional test (`test_malformed_index_file_raises_schema_error`, covering the "index file exists but is not an array of objects" rejection explicitly named in the task's `<behavior>` block) to satisfy the mechanical acceptance criterion — this is coverage the task's behavior spec already called for, not scope creep.

## Human-Check Items (Task 3) — Mechanically Verified, No Interactive Browser Available

This execution environment has no interactive browser. Per the coordinator's explicit instruction, the human-check items were verified mechanically via `curl` against a running `npm run preview:pages` server (port 4173) and by reading the relevant source logic, instead of visual confirmation:

1. **"Homepage shows exactly three survey cards, no synthetic card"** — Verified mechanically, not visually. `curl http://localhost:4173/enquestes/data/enquestes_index.json` returns exactly the 3 real entries (REO1167, REO1151, REO1145) and nothing else; the homepage is a client-side render of this same index (already covered by the 46 passing unit/component tests in `npm run test`). **Not confirmed**: actual pixel rendering, card layout, or absence of any other stray UI text — that would require an interactive browser session.
2. **"Deep link to `/enquesta/mostra-sintetica` shows the not-found message, no retry button"** — Verified the mechanism, not the rendered page. `curl -o /dev/null -w '%{http_code}' http://localhost:4173/enquestes/data/enquestes/mostra-sintetica_meta.json` returns `404`. `src/pages/ExplorerPage.tsx` line 160 (`if (res.status === 404) throw new SurveyNotFoundError()`) is the classifier that keys on exactly this HTTP status to render `NOT_FOUND_TITLE = "No s'ha trobat aquesta enquesta."` without a retry option (line 221 comment: "A 404 on this survey's own metadata never offers a retry"). **Not confirmed**: the actual rendered DOM/screenshot.
3. **"Deep link to an arbitrary bad id (`aquest-id-no-existeix`) shows the same generic not-found message"** — Same mechanism confirmed: `curl` against `data/enquestes/aquest-id-no-existeix_meta.json` also returns `404`, hitting the identical classifier path in `ExplorerPage.tsx` as item 2 — confirming the not-found path is generic and was never tied specifically to the retired dataset. **Not confirmed**: rendered DOM/screenshot.

All three items' underlying HTTP-level signal (the automatable proxy the plan itself specifies: "A 404 on that metadata endpoint is precisely the signal ExplorerPage's SurveyNotFoundError classifier keys on") is mechanically confirmed green. The purely visual confirmation (actual browser rendering) could not be performed in this environment and is flagged here rather than silently assumed.

## Self-Check: PASSED

- FOUND: `scripts/retirar_enquesta.py`
- FOUND: `public/data/enquestes_index.json`
- CONFIRMED REMOVED: `public/data/enquestes/mostra-sintetica_meta.json`
- CONFIRMED REMOVED: `public/data/enquestes/mostra-sintetica_respostes.parquet`
- FOUND commit `2910c1c` (Task 1)
- FOUND commit `59f098e` (Task 2)
- FOUND commit `50f3c49` (Task 3)
