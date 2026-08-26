---
phase: 02-offline-data-pipeline
plan: 03
subsystem: data-pipeline
tags: [python, uv, pep723, pandas, pyarrow, parquet, mock-data, catalog]

requires:
  - "scripts/pipeline/schema.py — validate_meta, validate_index, write_json, is_valid_enquesta_id (plan 02-01)"
  - "scripts/pipeline/infer.py — build_fields, build_kpis, D-03 inference rule (plan 02-01)"
  - "scripts/pipeline/index.py — upsert_index_entry (plan 02-01)"
provides:
  - "scripts/generate_mock_parquet.py — DATA-02 CLI: synthetic survey generation, no real data, no privacy gate"
  - "scripts/README.md — uv run invocation reference for all three pipeline scripts"
  - "public/data/enquestes/mostra-sintetica_respostes.parquet — committed demo dataset (5597 bytes, n=250)"
  - "public/data/enquestes/mostra-sintetica_meta.json — committed demo survey metadata"
  - "public/data/enquestes_index.json — catalog with one real entry, upserted over the Phase 1 empty-array placeholder"
affects: [03]

actuals:
  tokens: 3337
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Explicit pd.array(..., dtype=...) construction in build_mock_frame so n=0 still produces a real int64/large_string Parquet schema rather than an all-object one"
    - "Mock generator reuses infer.build_fields/build_kpis and index.upsert_index_entry unchanged — no forked logic, output shape guaranteed identical to the real conversion path"
    - "No privacy import, no acknowledgement flag on the mock path — synthetic data has no respondents to protect"

key-files:
  created:
    - scripts/generate_mock_parquet.py
    - scripts/README.md
    - public/data/enquestes/mostra-sintetica_respostes.parquet
    - public/data/enquestes/mostra-sintetica_meta.json
  modified:
    - public/data/enquestes_index.json

key-decisions:
  - "build_mock_frame builds every column via pd.array with an explicit dtype (int64 or string), not a plain Python list-of-dicts DataFrame constructor — this made the --n 0 zero-row edge case pass with a real 6-column schema on the first try, no separate hardening pass was needed in Task 2"
  - "Title/description state plainly that data is synthetic ('Enquesta de mostra (dades sintètiques)' / 'generada automàticament amb dades sintètiques... no corresponen a cap persona real') — satisfies T-02-12 and the DATA-02 transparency prohibition"

requirements-completed: [DATA-02]

coverage:
  - id: D1
    description: "One command generates a complete synthetic survey (Parquet, meta.json, upserted index entry) with no real data, no input file, no privacy gate"
    requirement: DATA-02
    verification:
      - kind: integration
        ref: "uv run scripts/generate_mock_parquet.py --out-dir <tmp>, verified this session: 3 artifacts written, exit 0"
        status: pass
    human_judgment: false
  - id: D2
    description: "Mock output field typing comes from infer.build_fields (D-03), not a hardcoded list"
    verification:
      - kind: integration
        ref: "verified satisfaccio->measure, segment->dimension in generated meta.json fields"
        status: pass
    human_judgment: false
  - id: D3
    description: "Same --seed produces byte-identical meta.json across runs"
    verification:
      - kind: integration
        ref: "cmp of two --seed 7 runs into separate tmp dirs, verified byte-identical this session"
        status: pass
    human_judgment: false
  - id: D4
    description: "--n 0 produces a valid zero-row Parquet with the full 6-column schema and an empty kpis array"
    verification:
      - kind: integration
        ref: "uv run scripts/generate_mock_parquet.py --id mostra-buida --n 0, verified num_rows=0, 6 schema.names, m['kpis']==[]"
        status: pass
    human_judgment: false
  - id: D5
    description: "Committed demo dataset is served correctly through the GitHub-Pages-equivalent preview server"
    verification:
      - kind: integration
        ref: "node scripts/gh-pages-preview.mjs --port 4321, curl'd /enquestes/data/enquestes_index.json, .../mostra-sintetica_meta.json, .../mostra-sintetica_respostes.parquet — all HTTP 200 this session"
        status: pass
      - kind: manual
        ref: "Plan's <human-check>: open the served URL, confirm one survey card renders with synthetic labelling visible, click through to KPI summary"
        status: deferred
    human_judgment: true

duration: 55min
completed: 2026-08-26
status: complete
---

# Phase 2 Plan 3: Offline Data Pipeline — Mock Generator & Committed Demo Dataset Summary

**Synthetic survey generator (`generate_mock_parquet.py`) with no real data and no privacy gate, plus the first real Parquet dataset committed to `public/data/` — the deployed homepage now lists one honestly-labelled synthetic survey instead of the empty-catalog state.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-26
- **Tasks:** 2
- **Files modified:** 5 (4 created, 1 modified — `public/data/enquestes_index.json`)

## Accomplishments

- `uv run scripts/generate_mock_parquet.py --out-dir <dir>` generates a complete synthetic survey end to end: `<id>_respostes.parquet`, `<id>_meta.json`, and an upserted `enquestes_index.json` entry, with `--id` (default `mostra-sintetica`), `--n` (default `250`), `--seed` (default `42`), `--out-dir` (default `public/data`).
- Six deterministic Catalan columns (`edat`, `satisfaccio`, `recomanaria` as measures; `segment`, `canal`, `territori` as dimensions), all drawn from a seeded `random.Random` instance — same seed produces byte-identical output.
- Field typing comes from `pipeline.infer.build_fields`/`build_kpis` unchanged, and index writes go through `pipeline.index.upsert_index_entry` unchanged — the mock path shares real logic with `convert_enquesta.py`, not a fork of it.
- No `pipeline.privacy` import, no acknowledgement flag — synthetic data has no respondents to protect, and the script's PEP 723 dependency list names only `pandas` and `pyarrow`.
- `--n 0` produces a valid zero-row Parquet with the full 6-column schema (verified: `int64` × 3, `large_string` × 3 — not an all-object fallback) because `build_mock_frame` constructs every column via `pd.array(..., dtype=...)` explicitly. This meant Task 2's planned "harden the zero-row edge case" step required no code change — it already passed on first run.
- `public/data/enquestes/mostra-sintetica_{respostes.parquet,meta.json}` and the upserted `public/data/enquestes_index.json` are now committed: the index grew from `[]` (Phase 1 placeholder) to one entry matching the meta file's `id`, `title`, `date`, `n`. Parquet size is 5597 bytes, far under the 1 MB ceiling.
- `scripts/README.md` documents all three pipeline entry points (`convert_enquesta.py`, `generate_mock_parquet.py`, `pipeline_selftest.py`), the `uv run`-only invocation rule, the block-by-default privacy gate workflow, D-02's unconditional free-text exclusion, and that `public/data/` is permanent public git history.
- `npm run build` exits 0 with the new data files present under `public/data/`.

## Task Commits

Each task was committed atomically:

1. **Task 1: End-to-end "generate a synthetic survey with no real data" — one path only** — `81d478b` (feat)
2. **Task 2: Ship the committed demo dataset and the pipeline README** — `176c79f` (feat)

## Tracer Feedback Gate

Task 1 is `type="tracer"`. Its `<verify>` block (3 artifacts written, schema/row-count/type consistency, `--seed` determinism, synthetic labelling present, invalid-`--id` rejection) was re-run end-to-end after commit and passed before Task 2 began. Logged: `⚡ Tracer verified end-to-end — expanding.`

## Files Created/Modified

- `scripts/generate_mock_parquet.py` — DATA-02 CLI entry point; `build_mock_frame(n, rng)`, `main(argv)`
- `scripts/README.md` — pipeline documentation for a returning developer
- `public/data/enquestes/mostra-sintetica_respostes.parquet` — committed synthetic dataset (n=250, 5597 bytes)
- `public/data/enquestes/mostra-sintetica_meta.json` — committed synthetic survey metadata (3 KPIs, 6 fields)
- `public/data/enquestes_index.json` — upserted from `[]` to one entry

## Interface contracts defined by this plan

### `scripts/generate_mock_parquet.py`
- `SEGMENTS`, `CANALS`, `TERRITORIS: list[str]` — the fixed Catalan category value lists
- `build_mock_frame(n: int, rng: random.Random) -> pd.DataFrame` — 6-column deterministic synthetic frame
- `main(argv: list | None = None) -> int` — importable entry point; exit `0` success, `1` invalid `--id`/`--n`

## Decisions Made

- **Explicit-dtype `pd.array` construction avoided a whole hardening task.** The plan anticipated a separate "harden the zero-row edge case" step in Task 2 (guard against an all-object Parquet schema at `n=0`). Building each column with `pd.array([...], dtype="int64"/"string")` in Task 1 already guarantees a real, non-object dtype at any `n` including `0`, so Task 2's zero-row verification passed unmodified — no code change was needed, only the verification run itself.
- **Title/description carry the synthetic disclosure literally in Catalan** ("dades sintètiques" / "no corresponen a cap persona real"), satisfying both the acceptance criterion's substring check and the T-02-12 spoofing mitigation from the threat model.

## Deviations from Plan

None. Plan executed as written — the anticipated zero-row hardening step turned out to already be satisfied by Task 1's implementation choice (see Decisions Made), which is a positive outcome, not a scope change.

## Known Stubs

None. Both scripts are full implementations with no placeholder data paths.

## Issues Encountered

- The plan's Task 2 `<verify>` includes a `<human-check>`: open `npm run preview:pages` and visually confirm the homepage shows one survey card with synthetic labelling, then click through to the KPI summary. This plan (`type="auto"`, not `type="checkpoint:human-verify"`) does not stop execution for this step, and no browser-automation tool was loaded in this session. As a best-effort automated proxy, `scripts/gh-pages-preview.mjs` was started and all three served data endpoints (`enquestes_index.json`, `mostra-sintetica_meta.json`, `mostra-sintetica_respostes.parquet`) were confirmed to return HTTP 200 under the GitHub Pages base path (`/enquestes/data/...`), proving the data-serving path is correct end to end. The purely visual confirmation (card renders, KPI modal shows sensible values) was not performed and is recorded below.

## User Setup Required

None — `uv` (0.9.16) was already present; no manual setup needed.

## Next Phase Readiness

**Committed Parquet size and dtypes** (STATE.md open concern: "real-world Parquet file sizes for actual survey datasets are unverified" — this is the mock generator's output, not yet a real-world sample):

- `public/data/enquestes/mostra-sintetica_respostes.parquet`: **5597 bytes**, n=250 rows, 6 columns
- Column dtypes as written to Parquet: `edat: int64`, `satisfaccio: int64`, `recomanaria: int64`, `segment: large_string`, `canal: large_string`, `territori: large_string`

Phase 3's DuckDB-Wasm work can develop directly against this committed file: 3 measure columns (all `int64`) and 3 dimension columns (all `large_string`, containing accented Catalan values), a `dataUrl`-served Parquet under 6 KB, and a matching `enquestes_index.json`/`_meta.json` pair that already passes `parseEnquestesIndex`/`parseEnquestaMeta`.

Deferred: the plan's `<human-check>` visual confirmation (survey card + KPI modal render correctly in a real browser) has not been performed — see Issues Encountered. Recommend running `npm run preview:pages` and opening the served URL before Phase 3 begins, or as part of Phase 3's own first verification pass.

No other blockers.

---
*Phase: 02-offline-data-pipeline*
*Completed: 2026-08-26*

## Self-Check: PASSED

All 5 created/modified files verified present on disk; both commit hashes (`81d478b`, `176c79f`) verified present in git log.
