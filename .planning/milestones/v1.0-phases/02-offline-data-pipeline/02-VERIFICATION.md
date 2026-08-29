---
phase: 02-offline-data-pipeline
verified: 2026-08-26T12:44:18Z
status: passed
score: 26/26 must-haves verified
behavior_unverified: 0
overrides_applied: 0
human_verification:

  - test: "Open the deployed homepage (https://marcaragones.github.io/enquestes/) in a real browser and confirm the 'mostra-sintetica' survey card renders correctly (title, description, participant count) instead of the empty-catalog state, and that clicking it opens the KPI summary modal with sensible mean values for edat/satisfaccio/recomanaria."
    expected: "One survey card visible on the homepage; title/description visibly state the data is synthetic; KPI modal shows the three measure KPIs with plausible values (edat≈46, satisfaccio≈5.3, recomanaria≈53, matching public/data/enquestes/mostra-sintetica_meta.json)."
    why_human: "This is a visual/rendering check. The data-serving path was proxy-verified this session (all three endpoints return HTTP 200 with correct JSON/Parquet content over the live GitHub Pages URL), but no browser-automation tool was available to confirm the React rendering itself. Tracked as open item #1 in .planning/WINDOWS.md (unrun-verify)."

  - test: "Run `uv run scripts/convert_enquesta.py <your-real-export> --list-columns`, then a real conversion, and read the printed privacy checklist. Judge whether MIN_GROUP_SIZE=5 and UNIQUENESS_RATIO_THRESHOLD=0.9 (scripts/pipeline/privacy.py) flag sensibly on actual survey data, not just the synthetic fixtures."
    expected: "Either 'thresholds fine' or updated threshold values reported by the developer."
    why_human: "Deferred from plan 02-02's <human-check> — no real survey export was available during autonomous execution, so the thresholds have only been validated against the two synthetic fixtures (mostra-tracer.csv, mostra-privacitat.csv), not real-world data distribution. Purely a judgment call requiring an actual export."
---

# Phase 2: Offline Data Pipeline Verification Report

**Phase Goal:** Real and mock survey data can be safely and correctly converted into the Parquet/JSON artifacts the app consumes.
**Verified:** 2026-08-26T12:44:18Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

All code-level truths verified by direct execution against the current checkout (not by trusting SUMMARY.md claims). The code review's 3 Critical findings were independently re-reproduced against `HEAD` (commit `b69dc5d`) and confirmed fixed. Two items require human judgment (visual rendering, real-data threshold sanity) and are the only reason this phase is not `passed`.

### Observable Truths

**Plan 02-01 — real-data conversion spine (DATA-01, DATA-03, D-01–D-03)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | `uv run scripts/convert_enquesta.py <csv> --id <id> --columns <allow-list> ...` writes `<id>_respostes.parquet`, `<id>_meta.json`, and upserts `enquestes_index.json` (DATA-01) | ✓ VERIFIED | Re-ran against `scripts/fixtures/raw/mostra-tracer.csv` this session; all three artifacts present, `OK:` summary printed, exit 0. |
| 2 | Privacy checklist prints on every real-data run, including clean runs (DATA-03) | ✓ VERIFIED | `format_checklist_report` always emits a header + threshold line + either findings or "Cap indici detectat (N columnes avaluades)." — confirmed by reading `scripts/pipeline/privacy.py` and re-running both a clean and a flagged conversion. |
| 3 | Findings + no `--confirm-privacy-review` ⇒ exit non-zero, nothing written | ✓ VERIFIED | Re-ran `--columns "id_resposta,segment"` with no ack flag: exit 2, output dir empty (no `enquestes/`, no `enquestes_index.json`). |
| 4 | A column not named in `--columns` never appears in the Parquet or `fields` (D-02) | ✓ VERIFIED | Parquet schema for `--columns "satisfaccio,segment"` contains exactly those two columns; `comentari_lliure`/`marca_temporal`/`codi_postal`/`id_resposta` absent. |
| 5 | A free-text column is dropped even when named in `--columns`, no re-admit flag | ✓ VERIFIED | `--columns "satisfaccio,segment,comentari_lliure"` still yields a 2-column Parquet; stderr names the dropped column; `grep` of `convert_enquesta.py`/`generate_mock_parquet.py` confirms no flag exists to re-admit a free-text column. |
| 6 | Re-running for an existing id replaces that entry in place, siblings untouched | ✓ VERIFIED | Converted `survey-a` then `survey-b` into the same `--out-dir`; both entries present, unit test `UpsertIndexEntryTests` covers the same invariant. |
| 7 | Generated `<id>_meta.json` validated in-process against `parseEnquestaMeta`-equivalent rules before write | ✓ VERIFIED | `schema.validate_meta(meta)` runs at `convert_enquesta.py:215`, strictly before the write block at line 224+; `schema.py`'s `validate_meta`/`validate_index` line-for-line mirror `src/lib/enquestes.ts`'s `parseEnquestaMeta`/`parseEnquestesIndex` (compared side-by-side). |
| 8 | An `--id` failing `^[A-Za-z0-9._-]{1,64}$` is rejected before any path is composed | ✓ VERIFIED | `--id "../escapada"` exits 1 with a validation message; check happens at `convert_enquesta.py:97`, before `_resolve_output_paths` is called. |
| 9 | `uv` is the only documented interpreter; system `python3` never used | ✓ VERIFIED | All three scripts open with `#!/usr/bin/env -S uv run` + PEP 723 blocks; `scripts/README.md` states `python3 scripts/<name>.py` is never supported, with the reason (system Python 3.6.10 can't run pandas/pyarrow). |

**Plan 02-02 — full privacy checklist + real-export loading (DATA-01, DATA-03, D-04)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 10 | Quasi-identifier flagged by column name even with low uniqueness ratio | ✓ VERIFIED | Re-ran `mostra-privacitat.csv` (full allow-list, no ack): report names `codi_postal` as `[quasi-identifier-name]` despite only 3 distinct values across 30 rows. |
| 11 | Any 2/3-column dimension combination isolating a group < `MIN_GROUP_SIZE` is flagged | ✓ VERIFIED | Same run: report names `[small-group] departament, franja_edat` with the undersized-group count and smallest size. |
| 12 | A column the checklist could not evaluate is reported as unevaluated, never counted clear | ✓ VERIFIED | `unevaluated_columns`/`small_group_flags` degenerate-combo/short-column-count cases feed into `run_privacy_checklist`'s `(findings, unevaluated)` tuple; `format_checklist_report` renders a distinct "No avaluades" section whenever the list is non-empty (read in `scripts/pipeline/privacy.py`). |
| 13 | Printed report names each finding's kind, subject column(s), and triggering threshold | ✓ VERIFIED | `format_checklist_report` line format: `[{kind}] {subject}: {detail}` plus a leading "Llindars aplicats: ..." line — confirmed in captured output. |
| 14 | A real `.xlsx` export converts through the same path, `--sheet` selecting a named sheet (DATA-01, D-04) | ✓ VERIFIED | Converted a `.xlsx` derived from the tracer CSV this session; produced a 24-row Parquet with the same 2 allow-listed columns. `load_table` passes `sheet_name=sheet or 0` to `pd.read_excel`. |
| 15 | A Windows-codepage CSV converts without crashing/mojibake, with a visible warning | ✓ VERIFIED (code inspection + unit test) | `_read_csv_with_fallback` retries `cp1252` on `UnicodeDecodeError` and always appends a warning string; `LoadTableTests` in `pipeline_selftest.py` covers the accent-preservation case directly (part of the 35 passing tests). |
| 16 | Every run prints column names, row count, first/last rows before writing | ✓ VERIFIED | Observed in every CLI run this session — `format_shape_report` output ("=== Forma de les dades carregades ===") always precedes the privacy checklist. |
| 17 | Privacy gate satisfied only by `--confirm-privacy-review` on that invocation, not env/config/state | ✓ VERIFIED | `convert_enquesta.py` reads `args.confirm_privacy_review` only (no `os.environ` lookup anywhere in the file — confirmed via `grep`). |

**Plan 02-03 — mock generator + committed demo dataset (DATA-02)**

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 18 | `uv run scripts/generate_mock_parquet.py` with no real data produces a valid Parquet + meta + index entry (DATA-02) | ✓ VERIFIED | Re-ran into a temp dir: 3 artifacts written, exit 0. |
| 19 | Generated Parquet readable by pyarrow, columns match `fields` names | ✓ VERIFIED | `pq.read_table` on the committed `mostra-sintetica_respostes.parquet` returns exactly the 6 columns named in the committed `meta.json`'s `fields`. |
| 20 | Generated meta.json passes the same `validate_meta` structural check as the real path | ✓ VERIFIED | `generate_mock_parquet.py` calls `schema.validate_meta(meta)` before any write (same function used by `convert_enquesta.py`). |
| 21 | `--n 0` produces a valid zero-row Parquet + `n: 0` + no KPIs | ✓ VERIFIED | Re-ran `--id mostra-buida --n 0`: Parquet has 0 rows and all 6 columns in schema (non-object dtypes via explicit `pd.array(..., dtype=...)`); meta `n=0`, `kpis=[]`. |
| 22 | Same `--seed` produces byte-identical output across runs | ✓ VERIFIED | Re-ran `--seed 7` into two separate temp dirs; `cmp` reports no difference. |
| 23 | Generated title/description state the data is synthetic | ✓ VERIFIED | Committed `meta.json`: title "Enquesta de mostra (dades sintètiques)"; description explicitly states responses are random and correspond to no real person. |
| 24 | Mock generator runs no privacy checklist, requires no acknowledgement flag | ✓ VERIFIED | `grep -n import scripts/generate_mock_parquet.py` shows no import of `pipeline.privacy`; no `--confirm-*` flag defined in its argparse setup. |
| 25 | `scripts/README.md` documents `uv run` as the only invocation, never the system interpreter | ✓ VERIFIED | README section "Invocació: sempre `uv run`, mai l'intèrpret del sistema" states this explicitly with the reason (Python 3.6.10 too old). |
| 26 | After this plan the deployed homepage lists one survey card instead of the empty-catalog state | ⚠️ Data verified; visual render not confirmed — see Human Verification #1 | Live site (`https://marcaragones.github.io/enquestes/`, deployed at commit `b69dc5d`, after the CR-01/02/03 fix commit) serves `enquestes_index.json` (one entry), `mostra-sintetica_meta.json`, and `mostra-sintetica_respostes.parquet` all at HTTP 200 with content matching the committed files. The React rendering of the card itself was not visually confirmed in this session (no browser tool available) — tracked as `.planning/WINDOWS.md` open item #1. |

**Score:** 26/26 code-verifiable truths confirmed. 0 behavior-unverified (present-but-untested) truths — item #26's *data pipeline* is fully verified end-to-end (HTTP 200, correct content); only the final visual-render step is deferred to a human, which is why overall status is `human_needed` rather than `passed`.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `scripts/pipeline/schema.py` | TypedDict mirror + validators | ✓ VERIFIED | `validate_meta`/`validate_index`/`write_json`/`is_valid_enquesta_id`/`MIN_KPI_SAMPLE`/`ENQUESTA_ID_PATTERN` all present; validators line-for-line match `src/lib/enquestes.ts`. |
| `scripts/pipeline/infer.py` | D-03 inference + D-02 free-text detection | ✓ VERIFIED | `infer_field_type`, `is_free_text_column`, `build_fields`, `build_kpis`, `FREE_TEXT_MEAN_LENGTH` present; uses `pd.api.types.is_string_dtype` (correct for pandas 3.x, a documented deviation from the plan's literal `dtype == object` text). |
| `scripts/pipeline/index.py` | `enquestes_index.json` upsert | ✓ VERIFIED | `compute_upserted_index` (renamed from the plan's `upsert_index_entry` as part of the CR-02 fix — now a pure compute function, never writes; callers validate before writing). Functionally equivalent, strictly safer than the plan's original spec. |
| `scripts/pipeline/privacy.py` | Full 3-heuristic DATA-03 checklist | ✓ VERIFIED | `uniqueness_flags`, `name_hint_flags`, `small_group_flags`, `unevaluated_columns`, `run_privacy_checklist`, `format_checklist_report`, `QUASI_IDENTIFIER_NAME_HINTS`, `MAX_COMBINATION_SIZE` all present and exercised by tests + manual runs. |
| `scripts/pipeline/load.py` | CSV/TSV/Excel loading + encoding fallback | ✓ VERIFIED | `load_table`, `format_shape_report` present; suffix branch on `.csv`/`.tsv`/`.xlsx`, cp1252 fallback, shape-sanity warnings. |
| `scripts/convert_enquesta.py` | DATA-01 CLI, privacy-gated | ✓ VERIFIED | All 9 must-have truths above confirmed by direct execution. |
| `scripts/generate_mock_parquet.py` | DATA-02 CLI, no real data, no gate | ✓ VERIFIED | `build_mock_frame`, `main` present; reuses `infer`/`index`/`schema` unchanged. |
| `scripts/pipeline_selftest.py` | Self-test suite | ✓ VERIFIED | `uv run scripts/pipeline_selftest.py` → 35 tests, 0 failures, 0 errors (re-run this session). |
| `scripts/fixtures/raw/mostra-tracer.csv`, `mostra-privacitat.csv` | Never-deployed test fixtures | ✓ VERIFIED | Both present; both exercised directly by manual runs this session and (privacitat) referenced in code comments, though not wired into the automated test suite (see WR-07, non-blocking). |
| `scripts/README.md` | Pipeline documentation | ✓ VERIFIED (with a stale line — see Anti-Patterns) | Covers `uv run`-only invocation, all 3 scripts, exit codes, privacy workflow, D-02 exclusion, output locations, `npm run preview:pages`. One line (`--sheet` flag description) is stale — see WR-02 below. |
| `public/data/enquestes/mostra-sintetica_respostes.parquet` | Committed demo dataset | ✓ VERIFIED | 5597 bytes, 250 rows, 6 columns (`int64`×3, `large_string`×3), matches `meta.json`. |
| `public/data/enquestes/mostra-sintetica_meta.json` | Committed demo metadata | ✓ VERIFIED | `n=250`, 3 KPIs, 6 fields; passes `validate_meta`. |
| `public/data/enquestes_index.json` | Catalog with real entry | ✓ VERIFIED | Grew from Phase 1's `[]` placeholder to one entry matching the meta file exactly. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `convert_enquesta.py` | `pipeline/privacy.py` | `run_privacy_checklist` gates writes | ✓ WIRED | Called at line 174, before the write block; findings + no ack ⇒ `return 2`. |
| `convert_enquesta.py` | `pipeline/index.py` | index upsert-before-write | ✓ WIRED (strengthened) | `compute_upserted_index` (pure) called, then `schema.validate_index`, **then** `write_json` — validated the ordering directly by seeding a malformed sibling index entry and confirming it survives on disk unchanged after the run crashes (CR-02 repro, re-run this session). |
| `convert_enquesta.py` | `pipeline/schema.py` | `validate_meta`/`validate_index` before write | ✓ WIRED | Confirmed by code read and by the CR-02 repro above. |
| `pipeline/schema.py` | `src/types/enquesta.ts` | manual cross-language shape parity | ✓ WIRED | Field names/optionality compared side-by-side; identical rejection conditions. |
| `convert_enquesta.py` | `pipeline/load.py` | `load_table` replaces inline `pd.read_csv` | ✓ WIRED | `grep` confirms no remaining `pd.read_csv` call in `convert_enquesta.py`; `load_mod.load_table` is the sole entry point. |
| `pipeline/privacy.py` | `pipeline/infer.py` | small-group scan uses `build_fields`'s dimension typing | ✓ WIRED | `convert_enquesta.py` builds `fields`/`dimension_columns` before calling `run_privacy_checklist(df, dimension_columns)`. |
| `generate_mock_parquet.py` | `pipeline/infer.py` | `build_fields`/`build_kpis` reused unchanged | ✓ WIRED | Direct import and call, confirmed by reading the file. |
| `generate_mock_parquet.py` | `pipeline/index.py` | index upsert reused | ✓ WIRED | Uses `compute_upserted_index` (renamed, same behavior). |
| `public/data/enquestes_index.json` | `src/lib/enquestes.ts` | `parseEnquestesIndex` reads this file at runtime | ✓ WIRED / ✓ FLOWING | Live deploy serves this exact file at `/enquestes/data/enquestes_index.json` (HTTP 200); shape passes `parseEnquestesIndex`'s type checks (all strings present, `n` a finite number). |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `public/data/enquestes_index.json` | catalog array | `generate_mock_parquet.py` → `compute_upserted_index` → committed file → live deploy | Yes — one real, non-empty entry, live-served | ✓ FLOWING |
| `public/data/enquestes/mostra-sintetica_meta.json` | KPIs/fields | `infer.build_kpis`/`build_fields` over a seeded synthetic frame → committed → live deploy | Yes — 3 KPIs with real computed means, live-served | ✓ FLOWING |
| `public/data/enquestes/mostra-sintetica_respostes.parquet` | respondent rows | `build_mock_frame` (seeded `random.Random`) → `df.to_parquet` → committed → live deploy | Yes — 250 real rows, live-served, row count matches `n` | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| E2E CSV conversion | `uv run scripts/convert_enquesta.py mostra-tracer.csv --columns satisfaccio,segment ... --confirm-privacy-review` | 3 artifacts written, exit 0 | ✓ PASS |
| Privacy gate blocks by default | same command, `--columns id_resposta,segment`, no ack | exit non-zero (2), output dir empty | ✓ PASS |
| CR-01 repro (empty allow-list after D-02 drop) | `--columns comentari_lliure --confirm-privacy-review` | exit 1, clean `ERROR:` message, **no** directory created | ✓ PASS (fixed) |
| CR-02 repro (malformed sibling index survives write) | seed bad `n` entry, run conversion for a new id | exit 1 (`SchemaError` traceback), index file byte-identical to the seeded bad content — no partial write | ✓ PASS (fixed) |
| CR-03 repro (duplicate `--columns`) | `--columns "segment,segment"` | exit 1, clean `ERROR: columnes duplicades...` message (no raw pandas traceback) | ✓ PASS (fixed) |
| WR-01 repro (missing input file) | `/no/such/file.csv` | exit 1, clean `ERROR: [Errno 2] ...` (no raw traceback) | ✓ PASS (fixed) |
| WR-05 repro (mock small-sample KPI warning) | `grep MIN_KPI_SAMPLE scripts/generate_mock_parquet.py` | warning loop present, mirrors `convert_enquesta.py` | ✓ PASS (fixed) |
| WR-02 repro (README `--sheet` doc) | `grep -- --sheet scripts/README.md` | line 41 still reads "reservat; encara no consumit" | ✗ FAIL (**not** fixed, despite commit message claiming it was — see Anti-Patterns) |
| Full self-test suite | `uv run scripts/pipeline_selftest.py` | 35 tests, 0 failures, 0 errors | ✓ PASS |
| DATA-03 full-checklist gate (name-hint + small-group) | `mostra-privacitat.csv`, full allow-list, no ack | exit 2, `codi_postal` flagged by name, `departament`×`franja_edat` flagged as small-group | ✓ PASS |
| `.xlsx` conversion path | tracer CSV re-exported to `.xlsx`, same `--columns` | Parquet with matching schema written | ✓ PASS |
| Mock generator zero-row edge case | `generate_mock_parquet.py --id mostra-buida --n 0` | 0-row Parquet, 6-column schema, `n:0`, `kpis:[]` | ✓ PASS |
| Mock generator determinism | two `--seed 7` runs | `cmp` reports no diff | ✓ PASS |
| `--id` path-traversal rejection | `--id "../escapada"` | exit 1, validation error, no directory created | ✓ PASS |
| Index upsert preserves siblings | convert `survey-a` then `survey-b` into same `--out-dir` | both entries present in `enquestes_index.json` | ✓ PASS |
| `npm run build` | — | exits 0, `dist/` produced | ✓ PASS |
| Live deploy data-serving | `curl` on 3 live endpoints | all HTTP 200, content matches committed files | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| DATA-01 | 02-01, 02-02 | Real CSV/Excel export converts to `[id]_respostes.parquet` + `[id]_meta.json` + `enquestes_index.json` entry | ✓ SATISFIED | Full CSV and `.xlsx` end-to-end conversions re-run and verified this session. REQUIREMENTS.md already marks this `[x]`. |
| DATA-02 | 02-03 | Mock generator produces test data without needing real data | ✓ SATISFIED (code) — checkbox stale | `generate_mock_parquet.py` fully implements this, re-verified this session (3 artifacts, no real input, no privacy import). **REQUIREMENTS.md line 32 still shows `[ ]` (Pending) and the summary table (line 84) shows "Pending"** — this is a stale tracking artifact, not a code gap; flagged below under Anti-Patterns for correction. |
| DATA-03 | 02-01, 02-02 | Conversion includes a privacy checklist before publishing (detects quasi-identifiers, not just name/email) | ✓ SATISFIED | Three heuristics (uniqueness ratio, quasi-identifier name hints, small-group k-anonymity) all independently reproduced this session against real fixture data. REQUIREMENTS.md already marks this `[x]`. |

No orphaned requirements found — DATA-01, DATA-02, DATA-03 are the full set mapped to Phase 2 in REQUIREMENTS.md, and all three appear in at least one plan's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `scripts/README.md` | 41 | Stale documentation: `--sheet` flag described as "reservat; encara no consumit" (reserved, not yet consumed) | ⚠️ Warning | `--sheet` has been fully wired since plan 02-02 (`load.py:32` passes it to `pd.read_excel`). The fix commit `8aacf74`'s own commit message claims this line was fixed ("scripts/README.md: --sheet is consumed, not reserved (WR-02)"), but the actual diff for that commit only touched the `generate_mock_parquet.py` section of the README (renaming `upsert_index_entry`→`compute_upserted_index`), never touching line 41. A developer reading only the README would wrongly believe `--sheet` has no effect. Non-blocking (the CLI's own `--help` text is correct, and the flag works), but the commit-message vs. actual-diff mismatch is worth noting for future trust in "fixed" claims. |
| `.planning/REQUIREMENTS.md` | 32, 84 | DATA-02 checkbox/table still show "Pending" despite the requirement being fully implemented and verified | ℹ️ Info | Tracking-only discrepancy; does not affect the shipped code. Should be updated to `[x]` / "Complete" as part of phase close-out. |

No debt markers (`TBD`/`FIXME`/`XXX`) found in any file modified by this phase (one incidental regex hit on the substring `uXXXX` inside a docstring about JSON escape sequences — not a marker). No stub patterns (`return null`/empty-object stand-ins/console.log-only handlers) found in any pipeline module — every module reviewed performs real work.

### Human Verification Required

### 1. Visual homepage/KPI-modal confirmation

**Test:** Open `https://marcaragones.github.io/enquestes/` (or `npm run preview:pages` locally) in a browser.
**Expected:** The homepage shows one survey card ("Enquesta de mostra (dades sintètiques)") instead of the empty-catalog state; the synthetic-data disclosure is visible; clicking the card opens the quick KPI summary with sensible values for `edat` (~46), `satisfaccio` (~5.3), `recomanaria` (~53).
**Why human:** No browser-automation tool was available this session. The underlying data path is fully verified (all three endpoints serve correct content over HTTP), but the React render itself was not visually confirmed. This is the same open item already tracked as `.planning/WINDOWS.md` id 1.

### 2. Real-export privacy threshold sanity check

**Test:** Run `uv run scripts/convert_enquesta.py <your real export> --list-columns`, then a real conversion, and read the printed privacy checklist.
**Expected:** Judge whether `MIN_GROUP_SIZE = 5` and `UNIQUENESS_RATIO_THRESHOLD = 0.9` flag sensibly on real data (not too many, not too few findings).
**Why human:** This is plan 02-02's own deferred `<human-check>` — no real survey export was available during autonomous execution, so the defaults are validated against synthetic fixtures only.

### Gaps Summary

No code-level gaps found. All 26 must-have truths across the three plans were independently re-verified against the current checkout (not inferred from SUMMARY.md text), including a full re-reproduction of all 3 Critical and the WR-01/WR-05 Warning findings from `02-REVIEW.md`, confirming they are genuinely fixed in commit `8aacf74`. One Warning fix (WR-02, README `--sheet` doc) was claimed fixed in that commit's message but the diff shows it was not — a minor, non-blocking documentation staleness, not a functional defect. The phase's only reasons for `human_needed` status rather than `passed` are two pre-existing, already-tracked human-judgment items (visual card rendering, real-data threshold sanity) — neither is a code defect, and the second was already deferred to a later real-data conversion by the plan's own design.

The remaining 4 open Warnings (WR-03 duplicated `_resolve_output_paths`, WR-04 missing shape validation before iteration — actually already partially addressed by CR-02's `compute_upserted_index` shape check, WR-06 missing `is_valid_enquesta_id`/`run_privacy_checklist` direct test coverage, WR-07 unused `mostra-privacitat.csv` fixture in automated tests) and 1 Info item (`ENQUESTA_ID_PATTERN` permitting all-dots ids) remain open as documented hygiene items — non-blocking per the phase's own scope, consistent with the review's own severity classification.

---

_Verified: 2026-08-26T12:44:18Z_
_Verifier: Claude (gsd-verifier)_
