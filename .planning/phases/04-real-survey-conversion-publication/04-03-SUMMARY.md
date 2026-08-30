---
phase: 04-real-survey-conversion-publication
plan: 03
subsystem: infra
tags: [python, pandas, pyarrow, uv, cli, data-pipeline, publication, verification]

# Dependency graph
requires:
  - phase: 04-02
    provides: "--skip-privacy-review flag, low_memory=False CSV fix, operator-supplied metadata for REO1167/REO1151/REO1145 (verbatim, recorded in 04-02-SUMMARY.md's Operator-Supplied Metadata section)"
provides:
  - "public/data/: REO1167, REO1151, REO1145 published alongside the untouched mostra-sintetica entry, one correct index entry each, no duplicates"
  - "scripts/verify_publicacio.py: standalone publication integrity checker (schema.validate_index/validate_meta reuse, duplicate-id detection, orphan detection, meta<->index<->Parquet agreement checks), --data-dir and --expect-ids flags"
  - "VerifyPublicacioTests (9 cases) in scripts/pipeline_selftest.py proving the verifier fails on duplicate ids, count/field mismatches, missing artifacts, orphans and --expect-ids mismatches"
  - "scripts/README.md: verify_publicacio.py documented, artifact-permanence section points at it as the pre-commit consistency check"
affects: [05]

# Actuals (#2632)
actuals:
  tokens: 22853
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "verify_publicacio.py reuses schema.validate_index/validate_meta rather than reimplementing the published contract, and reads only Parquet metadata (ParquetFile(...).metadata.num_rows, pq.read_schema(...).names) -- never a cell value -- mirroring convert_enquesta.py's own step-12 read-back generalised across the whole published set."
    - "Detect -> always print -> then report pass/fail idiom (established in privacy.format_checklist_report and infer.format_high_cardinality_report) extended to a whole-set verifier: every survey gets a row-count/column-count line regardless of outcome, and a clean pass always states how many surveys were checked -- a report over zero surveys is treated as a failure to check, not a pass."

key-files:
  created:
    - scripts/verify_publicacio.py
  modified:
    - scripts/pipeline_selftest.py
    - scripts/README.md
    - public/data/enquestes_index.json
    - public/data/enquestes/REO1167_respostes.parquet
    - public/data/enquestes/REO1167_meta.json
    - public/data/enquestes/REO1151_respostes.parquet
    - public/data/enquestes/REO1151_meta.json
    - public/data/enquestes/REO1145_respostes.parquet
    - public/data/enquestes/REO1145_meta.json

key-decisions:
  - "This plan's literal Task 1 precondition (\"an explicit resolution for every privacy checklist finding\") was satisfied by a different but explicitly operator-authorized resolution shape carried forward from 04-02: a single operator decision to skip the privacy checklist computation entirely for all three surveys via --skip-privacy-review, on the stated grounds that the source is official, government-published, pre-anonymized microdata. This was presented to the operator as a checkpoint before this continuation began, and the operator explicitly confirmed proceeding."
  - "verify_publicacio.py runs every check to completion per survey (never stops at the first failure) and always prints a per-survey n/columns line even when that survey's artifacts are missing or unreadable (shown as N/A), so the report is legible for triage rather than terminating on the first problem."
  - "verify_publicacio.py's PEP 723 header declares pandas as a dependency (matching convert_enquesta.py's header shape) even though the script does not import pandas directly -- it only needs pyarrow and the stdlib -- kept for header-format consistency across scripts/*.py per the plan's Task 2 instruction."

requirements-completed: [PUB-01, PUB-02]

coverage:
  - id: D1
    description: "REO1167, REO1151 and REO1145 are published under public/data/ with correct index entries; the mostra-sintetica entry is confirmed byte-identical to its pre-publication baseline and no id appears twice in the upserted index."
    requirement: PUB-02
    verification:
      - kind: other
        ref: "python3 byte-equality check of mostra-sintetica entry against captured baseline (True); duplicate-id check over resulting index ids (none)"
        status: pass
      - kind: unit
        ref: "uv run scripts/pipeline_selftest.py (69/69 pass, including pre-existing UpsertIndexEntryTests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Each publication run's free-text and high-cardinality drop lists (names and counts) match exactly what 04-02-SUMMARY.md recorded for that survey, confirming the input and flags were unchanged between review and publication."
    requirement: PUB-01
    verification:
      - kind: other
        ref: "Manual diff of each run's printed drop report against 04-02-SUMMARY.md's Per-Survey Conversion Results table and per-survey high-cardinality drop lists (REO1167: 2 free-text/35 cardinality; REO1151: 4/39; REO1145: 3/34 -- all names and counts match)"
        status: pass
    human_judgment: true
    rationale: "Comparing a printed list of column names/counts against a recorded table is a factual match, not a domain judgment, but was performed by visual inspection rather than an automated diff."
  - id: D3
    description: "scripts/verify_publicacio.py mechanically proves index-to-meta-to-Parquet consistency in one command, is proven fail-first against duplicate ids, count mismatches, field mismatches, missing artifacts, orphans and --expect-ids mismatches, and reports no cell value from any Parquet file."
    requirement: PUB-02
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#VerifyPublicacioTests (9/9 pass: consistent-set-zero, duplicate-id-fail-first, n-mismatch, field-mismatch, missing-parquet, orphan-parquet, expect-ids-mismatch, empty-dir-not-a-clean-pass, no-cell-value-leak)"
        status: pass
      - kind: other
        ref: "uv run scripts/verify_publicacio.py against real public/data/ (exit 0, 4 surveys reported with n/columns); --expect-ids matching set (exit 0); --expect-ids naming a nonexistent id (exit 1, names it); --data-dir $(mktemp -d) (exit 1, not a clean pass)"
        status: pass
    human_judgment: false
  - id: D4
    description: "The full gate -- pipeline_selftest, verify_publicacio, npm run build, verify:pages, verify:explorer -- passes against the published real-survey data, and public/data/ is untouched by Tasks 2 and 3."
    requirement: PUB-01
    verification:
      - kind: e2e
        ref: "uv run scripts/pipeline_selftest.py -v (69 tests, 0 failures); uv run scripts/verify_publicacio.py (exit 0); npm run build (exit 0, tsc + vite build succeed); npm run verify:pages (exit 0); npm run verify:explorer (exit 0, 4 DuckDB assets verified)"
        status: pass
      - kind: other
        ref: "git status --porcelain public/data/ (empty after Tasks 2 and 3, confirming no artifact was touched outside Task 1)"
        status: pass
    human_judgment: false
duration: ~35min (continuation session only; excludes the prior session's precondition-fix checkpoint)
completed: 2026-08-30
status: complete
---

# Phase 4 Plan 3: Real Survey Publication & Integrity Verification Summary

**Three real Catalan opinion surveys (REO1167, REO1151, REO1145; 2000-6706 respondents, 263-291 columns each) published to `public/data/` via `--skip-privacy-review`, plus a new `verify_publicacio.py` that mechanically proves the published index/meta/Parquet set is duplicate-free, orphan-free and internally consistent.**

## Performance

- **Duration:** ~35 min (this continuation session; the precondition-fix checkpoint that unblocked it happened in a prior session)
- **Completed:** 2026-08-30T14:18:10Z
- **Tasks:** 3 (publish, build+test verifier, full gate + docs)
- **Files modified:** 9 (3 new Parquet + 3 new meta.json + 1 index.json update under `public/data/`; `scripts/verify_publicacio.py` new; `scripts/pipeline_selftest.py` and `scripts/README.md` modified)

## Accomplishments

- **Three real surveys published:** REO1167 (2000 rows, 283 surviving columns), REO1151 (6706 rows, 291 surviving columns) and REO1145 (2000 rows, 263 surviving columns) converted directly into `public/data/` with the operator's exact `--id`/`--title`/`--description`/`--date` (character-for-character, no reformatting) and `--skip-privacy-review`, in the order 04-02 recorded them. Each run's free-text and high-cardinality drop lists (names and counts) were confirmed to match 04-02-SUMMARY.md's recorded results exactly, ruling out any drift between review and publication. The `mostra-sintetica` index entry was captured as a baseline before the first run and confirmed byte-identical afterward; the resulting index has no duplicate ids.
- **`scripts/verify_publicacio.py` built:** a standalone PEP 723 script that reuses `pipeline.schema.validate_index`/`validate_meta` rather than reimplementing the published contract, checks for duplicate/invalid ids, missing or orphaned artifacts, meta-to-index field agreement, meta `n`-to-Parquet-row-count agreement, and meta `fields`-to-Parquet-schema agreement. Reads only Parquet metadata (row count, column names) -- never a cell value. `--data-dir` and `--expect-ids` flags; exits 0/1; always prints a per-survey report line and a stated "N surveys checked" count on a clean pass, never a bare pass over zero surveys.
- **9 fail-first regression tests** (`VerifyPublicacioTests`) prove the verifier actually rejects each defect class it claims to catch, including a duplicate-id case built from otherwise fully-consistent artifacts (a verifier that only checked meta/Parquet agreement would wrongly pass it).
- **Full gate green against real data:** `pipeline_selftest.py` (69/69), `verify_publicacio.py` (4/4 surveys), `npm run build`, `npm run verify:pages`, `npm run verify:explorer` all exit 0 against the published REO1167/REO1151/REO1145 + `mostra-sintetica` set.
- **Documentation:** `scripts/README.md` gained a `verify_publicacio.py` section (checks, both flags, both exit codes, when to run it) and the artifact-permanence section now points at it as the pre-commit consistency check.

## Task Commits

Each task was committed atomically:

1. **Task 1: Publish the approved surveys to public/data/** -- `e0ef298` (feat)
2. **Task 2: Build the publication integrity verifier and prove it fails on bad input** -- `60f12ac` (feat)
3. **Task 3: Full gate against the published data, and document the verifier** -- `4d8ad69` (docs)

**Plan metadata:** this SUMMARY + STATE.md/ROADMAP.md updates follow, made by the orchestrator (not this executor, per this continuation's scope).

## Files Created/Modified

- `public/data/enquestes/REO1167_respostes.parquet`, `REO1167_meta.json` -- new
- `public/data/enquestes/REO1151_respostes.parquet`, `REO1151_meta.json` -- new
- `public/data/enquestes/REO1145_respostes.parquet`, `REO1145_meta.json` -- new
- `public/data/enquestes_index.json` -- upserted with the three new entries; `mostra-sintetica` entry unchanged
- `scripts/verify_publicacio.py` -- new standalone publication integrity verifier
- `scripts/pipeline_selftest.py` -- +1 import (`verify_publicacio`), +1 `VerifyPublicacioTests` class (9 tests)
- `scripts/README.md` -- new `verify_publicacio.py` section; artifact-permanence section extended with a pointer to it

## Precondition Deviation (carried forward from checkpoint resume state)

Plan 04-03's Task 1 precondition literally reads: "Plan 04-02's summary records, for every survey, the operator-approved column set and an explicit resolution for every privacy checklist finding." What 04-02 actually recorded is a different resolution shape: a single explicit operator decision to **skip** the privacy checklist computation entirely for all three surveys (not a per-finding drop/accept/narrow), because there was no checklist run to have per-finding resolutions for.

**The operator's stated decision (verbatim, from 04-02-SUMMARY.md):**

> "All the raw data is already anonymised. We don't have to modify it."
>
> "We can skip all of this. The surveys come from a government public page and it is already anonymous enough."

**Source (operator-supplied):** https://web.gencat.cat/ca/generalitat/dades-indicadors/centre-estudis-opinio

This is the same T-04-07 principle the plan's precondition exists to enforce (no unapproved real respondent data reaches `public/data/` without a traceable human decision) applied through a different, explicitly authorized mechanism. Before this continuation began, the orchestrator surfaced this gap as a `checkpoint:decision` -- 04-02-SUMMARY.md initially referenced the operator's metadata values without tabulating them, which blocked Task 1's precondition check -- and the operator: (1) added the missing "Operator-Supplied Metadata" section to 04-02-SUMMARY.md (commit `50070ec`, prior session) so the four values were traceable verbatim, and (2) was shown exactly what would be published (all three survey ids/titles/row-column counts, confirmation that everything commits locally with no push) and explicitly replied "yes" to proceed. This executor did not re-confirm; it proceeded directly with Task 1 as instructed by the continuation's checkpoint-resume state.

All three conversions used `--skip-privacy-review` (not `--confirm-privacy-review`), consistent with 04-02's `--skip-privacy-review` flag and its recorded per-survey disposition table (all three: SKIPPED, same source and reasoning).

## Decisions Made

- Task 1's per-run verification (free-text and cardinality drop lists matching 04-02's recorded results) was done by direct comparison of each run's printed report against 04-02-SUMMARY.md's tables -- all three surveys matched exactly (REO1167: 2 free-text drops / 35 cardinality drops; REO1151: 4/39; REO1145: 3/34), confirming no drift in the input files or flags between review and publication.
- `verify_publicacio.py` was built as a single-pass, run-every-check-to-completion script (not stop-at-first-failure) so a single invocation surfaces every problem in the published set, matching the plan's explicit instruction and the established `format_checklist_report`/`format_high_cardinality_report` "always print, never a silent pass" pattern.
- No hand-editing of `enquestes_index.json` or any `_meta.json` occurred at any point -- every artifact under `public/data/` came from a `convert_enquesta.py` run, so the validate-before-write and post-write Parquet read-back gates always applied.

## Deviations from Plan

### Auto-fixed Issues

None -- no bugs, missing functionality, or blocking issues were encountered during Tasks 1-3 themselves (the precondition gap that blocked the original Task 1 attempt was resolved in a prior session before this continuation began, and is documented above as the carried-forward precondition deviation rather than a fresh deviation in this session).

**Total deviations this session:** 0 new (1 precondition deviation carried forward from the prior session's checkpoint, documented above per the continuation's instructions).

## Issues Encountered

None. All three conversions, both new scripts' test suites, and the full build/preview gate ran cleanly on the first attempt in this session. `npm run build`'s Node.js version warning ("Vite requires Node.js version 20.19+ or 22.12+", running 20.18.3) is a pre-existing environment condition unrelated to this plan's changes and did not affect the build's exit code (0) or output.

## User Setup Required

None. Everything in this plan runs via `uv run` / `npm run` with dependencies already resolved by the existing PEP 723 headers and `package.json`. All commits are local only -- nothing was pushed to origin, per this continuation's explicit constraint.

## Next Phase Readiness

- `public/data/` now contains four published surveys: `mostra-sintetica` (synthetic, untouched), `REO1167`, `REO1151`, `REO1145`. Phase 5 (retiring `mostra-sintetica`) can proceed against this set.
- `scripts/verify_publicacio.py` is available for Phase 5 to re-run after `mostra-sintetica`'s removal, to confirm the same invariants (no duplicate/orphan entries, meta-to-index-to-Parquet agreement) hold once the synthetic entry and its two files are deleted -- this was explicitly the motivating "serves Phase 5" case named in this plan's objective.
- `scripts/pipeline/index.py`'s `compute_upserted_index` still has no removal path (a pre-existing, previously logged blocker in STATE.md) -- Phase 5 will need an explicit delete of both the index entry and the two `mostra-sintetica` files, since the upsert function only replaces-in-place or appends.
- No blockers introduced by this plan. The operator should review the published data locally (`npm run preview:pages`) before anything is pushed to origin, per the human-check step in Task 3's `<verify>` block (not run in this autonomous continuation -- the operator's own local review is the deferred step).

## Self-Check: PASSED

- FOUND: `public/data/enquestes/REO1167_respostes.parquet`, `REO1167_meta.json`
- FOUND: `public/data/enquestes/REO1151_respostes.parquet`, `REO1151_meta.json`
- FOUND: `public/data/enquestes/REO1145_respostes.parquet`, `REO1145_meta.json`
- FOUND: `public/data/enquestes_index.json` contains 4 entries (`mostra-sintetica`, `REO1167`, `REO1151`, `REO1145`), no duplicate ids
- FOUND: `scripts/verify_publicacio.py` (new file, `--data-dir`/`--expect-ids` flags present)
- FOUND: `scripts/pipeline_selftest.py` (69 tests, 0 failures -- `uv run scripts/pipeline_selftest.py -v`, includes `VerifyPublicacioTests` with 9 tests)
- FOUND: `scripts/README.md` contains a `verify_publicacio.py` section and an updated artifact-permanence section
- FOUND commit `e0ef298` (feat(04-03): publish three real surveys to public/data/)
- FOUND commit `60f12ac` (feat(04-03): add scripts/verify_publicacio.py publication integrity check)
- FOUND commit `4d8ad69` (docs(04-03): document verify_publicacio.py and run the full publication gate)
- FOUND: `git status --porcelain public/data/` empty (no changes since Task 1's commit)

---
*Phase: 04-real-survey-conversion-publication*
*Completed: 2026-08-30*
