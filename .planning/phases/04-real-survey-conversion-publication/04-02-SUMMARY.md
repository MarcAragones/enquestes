---
phase: 04-real-survey-conversion-publication
plan: 02
subsystem: infra
tags: [python, pandas, pyarrow, uv, cli, data-pipeline, privacy]

# Dependency graph
requires:
  - phase: 04-01
    provides: infer.MAX_DISTINCT_VALUES / is_high_cardinality_column / high_cardinality_columns / format_high_cardinality_report, convert_enquesta.py --max-cardinality and --include-columns flags, --columns now optional
provides:
  - "load.py: low_memory=False forced on every CSV read, eliminating a pandas chunked-dtype-inference bug that silently double-counted distinct values on wide (~290-column) real exports"
  - "convert_enquesta.py: --skip-privacy-review flag that bypasses the privacy checklist COMPUTATION entirely (not just the block-by-default exit code), gated behind an explicit, non-inferable, non-default CLI opt-in"
  - "Three real surveys (REO1167, REO1151, REO1145) converted to a scratch directory with operator-supplied metadata, ready for plan 04-03 to publish"
  - "2 new regression tests (LoadTableTests.test_wide_export_does_not_double_count_distinct_values_across_read_buffer, SkipPrivacyReviewTests x2)"
affects: [04-03]

# Actuals (#2632)
actuals:
  tokens: 2871
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Detect -> always print -> then act idiom extended to a fourth case: an explicit operator opt-out (--skip-privacy-review) that skips computation, not just the gating exit code, and always prints a named skip message so the omission is never silent."

key-files:
  created: []
  modified:
    - scripts/pipeline/load.py
    - scripts/convert_enquesta.py
    - scripts/pipeline_selftest.py

key-decisions:
  - "low_memory=False is applied unconditionally on every pd.read_csv call, not conditionally detected -- there is no ambiguous interpretation to disclose (unlike the delimiter/encoding fixes), only an internal pandas footgun to avoid, so no warning string is appended for it."
  - "Rule 4 scope extension (this plan's central deviation): --skip-privacy-review was added to scripts/convert_enquesta.py, a file outside this plan's declared files_modified ({load.py, pipeline_selftest.py}), following an explicit operator decision recorded in this summary. privacy.py's three heuristics (uniqueness_flags, name_hint_flags, small_group_flags) were deliberately left untouched -- the change is confined to the call site in convert_enquesta.py, the smaller and more auditable of the two options presented."
  - "--skip-privacy-review bypasses run_privacy_checklist() (including small_group_flags' combinatorial 2/3-column scan) entirely rather than just suppressing the exit-code-2 block, because the scan itself -- not just the gate -- was the ~55-75 min/survey cost the operator's decision was meant to eliminate."
  - "Privacy review for all three real surveys was resolved by a single explicit operator skip decision, not per-finding drop/accept/narrow as the plan's Task 3 mechanics originally anticipated. This is a different resolution shape but satisfies the same T-04-07 principle: no unapproved data reaches public/data/ without a traceable human decision."

requirements-completed: [PUB-01, PUB-05]

coverage:
  - id: D1
    description: "A pandas low_memory=True chunked-read bug that silently double-counted distinct values on wide (~290-column) real exports is fixed by forcing low_memory=False on every CSV read, pinned by a 291-column/3000-row regression fixture."
    requirement: PUB-05
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#LoadTableTests.test_wide_export_does_not_double_count_distinct_values_across_read_buffer"
        status: pass
    human_judgment: false
  - id: D2
    description: "--skip-privacy-review bypasses the privacy checklist computation entirely (not just the exit-code gate); without the flag, the pre-existing block-by-default behaviour is unchanged."
    requirement: PUB-01
    verification:
      - kind: unit
        ref: "scripts/pipeline_selftest.py#SkipPrivacyReviewTests.test_skip_flag_converts_despite_findings_and_never_computes_checklist"
        status: pass
      - kind: unit
        ref: "scripts/pipeline_selftest.py#SkipPrivacyReviewTests.test_without_flag_block_by_default_behaviour_is_unchanged"
        status: pass
    human_judgment: false
  - id: D3
    description: "All three operator-supplied real exports (REO1167, REO1151, REO1145) convert successfully with --skip-privacy-review in seconds, writing <id>_respostes.parquet and <id>_meta.json to a scratch directory, with the operator's exact --id/--title/--description/--date."
    requirement: PUB-01
    verification:
      - kind: other
        ref: "uv run scripts/convert_enquesta.py <each real export> --skip-privacy-review --out-dir <mktemp -d scratch> (manual CLI run, all three exit 0 in ~3-5s each; see per-survey table below)"
        status: pass
    human_judgment: true
    rationale: "Whether the surviving column set and drop counts for each real survey look correct is a domain judgment about the operator's own surveys, not something a unit test can assert."
  - id: D4
    description: "The privacy-review resolution for all three surveys is an explicit, traceable operator decision (a full skip, not per-finding), and nothing was written to public/data/ or scripts/fixtures/ during this plan."
    requirement: PUB-01
    verification:
      - kind: other
        ref: "git status --porcelain public/data/ scripts/fixtures/ (both empty after all three conversions)"
        status: pass
    human_judgment: false
duration: ~25min (across two sessions, split by the Rule 4 checkpoint)
completed: 2026-08-30
status: complete
---

# Phase 4 Plan 2: Real Survey Conversion Summary

**Three real Catalan political-opinion surveys (REO1167, REO1151, REO1145; 2000-6706 respondents, 263-291 surviving columns each) converted to a scratch directory in seconds via a new `--skip-privacy-review` flag, after fixing a pandas `low_memory` bug that silently double-counted distinct values on wide exports.**

## Performance

- **Duration:** ~25 min total (Task 2's format-gap fix ran in an earlier session; this session added the Rule 4 scope extension, ran all three real conversions, and closed out the plan)
- **Started:** 2026-08-30 (approx, first session)
- **Completed:** 2026-08-30T13:57:13Z
- **Tasks:** 2 code tasks (Task 2's format fix; the Rule 4 scope-extension task that replaced Task 3's original mechanics) + 1 human-action checkpoint (Task 1, resolved in an earlier session)
- **Files modified:** 3 (`scripts/pipeline/load.py`, `scripts/convert_enquesta.py`, `scripts/pipeline_selftest.py`)

## Accomplishments

- **PUB-05 format fix:** `scripts/pipeline/load.py::_read_csv_or_raise` now always passes `low_memory=False` to `pd.read_csv`. REO1151's 291-column export was wide/large enough to span pandas' internal chunked-dtype-inference buffer boundary, causing at least one numeric-looking column (e.g. a birth-year field) to be read back as a silent mix of `int` and `str` cells across chunks — nearly doubling that column's `nunique()` count (159 vs the true 81) because `1963` and `"1963"` compare as distinct. This silently corrupted both the D-01 cardinality filter and the privacy checklist's uniqueness ratio with no warning at all. Pinned with a 291-column/3000-row regression fixture (the minimum size empirically found via bisection to reproduce the buffer-boundary condition).
- **Rule 4 scope extension — `--skip-privacy-review`:** After Task 2 completed, running the full privacy checklist (`small_group_flags`' combinatorial 2-/3-column scan) against each survey's ~260-290 auto-selected dimension columns was measured to imply ~55-75 minutes per survey, ~3 hours total across all three — an unreasonable unattended runtime, though not a crash. This triggered a `checkpoint:decision` (Rule 4, architectural change outside the plan's declared `files_modified`). The operator's explicit decision (see below) was to add a real `--skip-privacy-review` flag to `scripts/convert_enquesta.py` that skips the checklist **computation** entirely, not just its blocking exit code, confined to the call site so `privacy.py`'s own heuristics remain fully intact and available for any future survey where this flag is not passed.
- **All three real surveys converted** to a `mktemp -d` scratch directory (outside the repo) with the operator's exact `--id`/`--title`/`--description`/`--date`, no `--columns` (exercising 04-01's auto-selection), and `--skip-privacy-review`. Each run completed in 3-5 seconds and exited 0.

## Task Commits

Each task was committed atomically:

1. **Task 2: Convert every real export, fixing format gaps as they surface** — `0e4f741` (fix) — *committed in an earlier session, prior to this continuation*
2. **Rule 4 scope-extension task: `--skip-privacy-review` flag + regression coverage** — `15a012d` (feat)

**Plan metadata:** pending (final docs commit follows this SUMMARY)

## Files Created/Modified

- `scripts/pipeline/load.py` — `_read_csv_or_raise` now forces `low_memory=False` unconditionally on every `pd.read_csv` call
- `scripts/convert_enquesta.py` — new `--skip-privacy-review` flag (store_true, default False); the privacy-checklist call site is now conditional on it
- `scripts/pipeline_selftest.py` — +1 `LoadTableTests` regression test for the `low_memory` fix, +1 new `SkipPrivacyReviewTests` class (2 tests) for the skip flag

## Privacy Review Disposition (Rule 4 deviation and T-04-07 resolution)

**The operator's stated decision (verbatim):**

> "All the raw data is already anonymised. We don't have to modify it."
>
> "We can skip all of this. The surveys come from a government public page and it is already anonymous enough."

**Source (operator-supplied):** https://web.gencat.cat/ca/generalitat/dades-indicadors/centre-estudis-opinio

**What was presented and what was chosen:** the checkpoint presented two ways to resolve the ~3-hour combinatorial-scan cost: (1) pass `--confirm-privacy-review` per survey and wait for the checklist to compute anyway, or (2) add a real `--skip-privacy-review` flag that skips the checklist computation itself. The operator chose option 2, and further specified that the change should be scoped to the call site in `convert_enquesta.py` rather than touching `privacy.py`'s heuristics, to keep the change smaller and more auditable.

**Scope extension:** Plan 04-02 declared `files_modified: [scripts/pipeline/load.py, scripts/pipeline_selftest.py]`. This decision extends that scope to also include `scripts/convert_enquesta.py`. This is logged here as the Rule 4 deviation record for the plan.

**Per-survey privacy disposition:**

| Survey | Privacy review | Reason |
|---|---|---|
| REO1167 | SKIPPED (`--skip-privacy-review`) | Official government-published, pre-anonymized microdata (Centre d'Estudis d'Opinió). Operator-stated: source already anonymous enough. |
| REO1151 | SKIPPED (`--skip-privacy-review`) | Same source and reasoning. |
| REO1145 | SKIPPED (`--skip-privacy-review`) | Same source and reasoning. |

**How this satisfies T-04-07 (Repudiation — every privacy disposition must be traceable to an explicit recorded decision):** the plan's Task 3 anticipated per-finding resolutions (drop/accept/narrow) as the resolution shape. What actually happened is a single explicit skip decision covering all three surveys at once — a different shape, but it satisfies the same underlying principle: no unapproved real respondent data enters `public/data/` without a traceable human decision. The decision is recorded here verbatim, with its source, and is what plan 04-03 must reference when it publishes these three surveys (they are "privacy-review-skipped," not "per-finding-approved" — 04-03 needs to know this distinction).

**Task 3 as originally written is therefore moot in its literal form** (there are no per-finding drop/accept/narrow resolutions to record, because the checklist was never computed) and was not executed as a `checkpoint:decision` loop over findings.

## Per-Survey Conversion Results

All three ran with no `--columns` (04-01 auto-selection default) and `--skip-privacy-review`, into the same `mktemp -d` scratch directory. All exited 0 in 3-5 seconds each.

| Survey | Rows (n) | Detected cols | Free-text dropped (D-02) | High-cardinality dropped (D-01) | Surviving cols |
|---|---|---|---|---|---|
| REO1167 | 2000 | 320 | 2: `PROBLEMES_LITERALS`, `ESTUDIS_1_15` | 35 | 283 |
| REO1151 | 6706 | 334 | 4: `MODEL_EDUCATIU`, `TRACTE_ANIMALS`, `Q253_2_ALEATORITZACIO_2`, `Q253_2_ALEATORITZACIO_3` | 39 | 291 |
| REO1145 | 2000 | 300 | 3: `PROBLEMES_LITERALS`, `RESPOSTA_ATAC_UE`, `ESTUDIS_1_15` | 34 | 263 |

**REO1167 — high-cardinality drops (35, name: distinct count):** `ORDRE`:2000, `DIA`:26, `DATA_INI`:29, `DATA_FIN`:29, `DURADA`:1111, `MUNICIPI`:56, `COMARCA`:27, `ID_RUTA`:160, `SECCIO_TEORICA`:160, `SECCIO_REAL`:236, `EDAT`:79, `PROBLEMES_R_1`:22, `PROBLEMES_E_1`:104, `PROBLEMES_E_2`:110, `PROBLEMES_E_3`:96, `PROBLEMES_E_4`:69, `PROBLEMES_E_5`:44, `PROBLEMES_E_6`:22, `PROBLEMA`:114, `PROBLEMA_REDUIDA`:22, `PARTIT_RESPOSTA_ECONOMIA_LITERALS`:26, `PARTIT_RESPOSTA_CONVIVENCIA_LITERALS`:27, `PARTIT_RESPOSTA_DESIGUALTATS_LITERALS`:26, `PARTIT_RESPOSTA_CAT_ESP_LITERALS`:25, `PARTIT_RESPOSTA_SEGURETAT_LITERALS`:30, `PARTIT_RESPOSTA_SERVEIS_PUBLICS_LITERALS`:25, `SIMPATIA_PARTIT_LITERALS`:45, `SIMPATIA_PARTIT_PROPER_LITERALS`:21, `INT_PARLAMENT_VOT_LITERALS`:21, `INT_CONGRES_VOT_LITERALS`:28, `LLOC_NAIX_MON`:40, `RELIGIO_LITERALS`:34, `OCUPACIO_CNO11_2`:63, `LLENGUA_PRIMERA_ALTRES_LITERALS`:38, `LLENGUA_IDENT_ALTRES_LITERALS`:27.

**REO1151 — high-cardinality drops (39, name: distinct count):** `ORDRE`:6706, `PONDERA`:5466, `PONDERA_ENLINIA`:388, `PONDERA_ELECTOR`:5155, `MUNICIPI`:145, `COMARCA`:42, `CUSEC24`:3419, `DURADA`:5839, `DATA_INI`:63, `DATA_FIN`:63, `ANY_NAIXEMENT`:81, `EDAT`:81, `ESTUDIS_1_6_LITERALS`:117, `UTILITZA_LITERALS`:148, `VOLUM_IMMI_CAT_0_100`:78, `DISCRI_ALTR_LITERALS`:181, `EDAT_IDEAL_MARE`:33, `EDAT_IDEAL_PARE`:36, `EDAT_IDEAL_JUBILACIO`:42, `MOTIU_SATISFACCIO1`:2205, `MOTIU_SATISFACCIO2`:2487, `MOTIU_SATISFACCIO3`:2537, `SENTIMENT_PERTINENCA_LITERALS`:301, `SIMPATIA_PARTIT_LITERALS`:87, `SIMPATIA_PARTIT_PROPER_LITERALS`:27, `LLENGUA_IDENTIFICACIO_ALTR_LITERALS`:114, `JORNADA_PARCIAL_MOTIU_LITERALS`:70, `CANVI_FEINA_MOTIU_LITERALS`:87, `CNO11_3`:158, `TIPUS_LLAR_LITERALS`:232, `ANY_NAIXEMENT_FILL_1`:55, `ANY_NAIXEMENT_FILL_2`:63, `ANY_NAIXEMENT_FILL_3`:54, `ANY_NAIXEMENT_FILL_4`:41, `ANY_ARRIBADA`:84, `LLOC_NAIX_MON`:82, `LLOC_NAIX_MON_LITERALS`:48, `GRUP_ETNIC_LITERALS`:66, `RELIGIO_LITERALS`:129.

**REO1145 — high-cardinality drops (34, name: distinct count):** `ORDRE`:2000, `DIA`:28, `DATA_INI`:28, `DATA_FIN`:28, `DURADA`:1049, `ENQUESTADOR_CODI`:40, `ENQUESTADOR_EDAT`:32, `MUNICIPI`:68, `COMARCA`:27, `SECCIO_TEORICA`:168, `SECCIO_REAL`:197, `ID_RUTA`:168, `EDAT`:78, `PROBLEMES_R_1`:22, `PROBLEMES_E_1`:92, `PROBLEMES_E_2`:90, `PROBLEMES_E_3`:84, `PROBLEMES_E_4`:67, `PROBLEMES_E_5`:48, `PROBLEMES_E_6`:31, `PROBLEMA`:92, `PROBLEMA_REDUIDA`:22, `PARTIT_RESPOSTA_ECONOMIA_LITERALS`:28, `PARTIT_RESPOSTA_CONVIVENCIA_LITERALS`:24, `PARTIT_RESPOSTA_DESIGUALTATS_LITERALS`:22, `PARTIT_RESPOSTA_CAT_ESP_LITERALS`:22, `PARTIT_RESPOSTA_SEGURETAT_LITERALS`:25, `PARTIT_RESPOSTA_SERVEIS_PUBLICS_LITERALS`:22, `SIMPATIA_PARTIT_LITERALS`:34, `LLOC_NAIX_MON`:41, `RELIGIO_LITERALS`:27, `OCUPACIO_CNO11_2`:63, `LLENGUA_PRIMERA_ALTRES_LITERALS`:35, `LLENGUA_IDENT_ALTRES_LITERALS`:30.

All three artifacts (`<id>_respostes.parquet`, `<id>_meta.json`) and the shared `enquestes_index.json` exist in the scratch directory only; the scratch directory is ephemeral (`mktemp -d`) and was not retained beyond this session.

## Decisions Made

See "Privacy Review Disposition" above for the central decision of this plan. Additional decisions:

- `low_memory=False` is applied unconditionally, not conditionally detected — no warning string was added for it (unlike the delimiter/encoding fixes), because there is no ambiguous interpretation to disclose to the operator, only an internal pandas correctness bug to avoid.
- The `--skip-privacy-review` regression tests reuse the existing `mostra-privacitat.csv` fixture (its `codi_postal` column always fires a `quasi-identifier-name` finding regardless of cardinality), rather than adding a new fixture — keeping `scripts/fixtures/` untouched by this plan.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pandas `low_memory=True` silently double-counting distinct values on wide exports**
- **Found during:** Task 2, converting REO1151 (291 columns, 6706 rows)
- **Issue:** pandas' default chunked dtype inference read at least one numeric-looking column as a mix of `int`/`str` cells across internal read-buffer boundaries once the file was wide/large enough, nearly doubling `nunique()` counts and silently corrupting the D-01 cardinality filter and the privacy checklist's uniqueness ratio.
- **Fix:** Forced `low_memory=False` on every `pd.read_csv` call in `_read_csv_or_raise`.
- **Files modified:** `scripts/pipeline/load.py`, `scripts/pipeline_selftest.py`
- **Verification:** New regression test `test_wide_export_does_not_double_count_distinct_values_across_read_buffer` with a 291-column/3000-row fixture that reproduces the buffer-boundary condition; full suite green.
- **Committed in:** `0e4f741`

### Architectural Change (Rule 4 — checkpoint:decision, operator-approved)

**2. [Rule 4] Added `--skip-privacy-review` to `scripts/convert_enquesta.py`, extending this plan's scope beyond its declared `files_modified`**
- **Found during:** Task 2 completion / before Task 3, once the privacy checklist's runtime against real ~260-290-column exports was measured
- **Issue:** `small_group_flags`' combinatorial 2-/3-column scan over the auto-selected dimension columns implied ~55-75 min per survey, ~3 hours total — an unreasonable unattended runtime, and changing anything about it was outside the plan's declared files.
- **Decision:** Presented to the operator as a `checkpoint:decision`. Operator chose to add a real `--skip-privacy-review` flag bypassing checklist computation entirely, confined to the `convert_enquesta.py` call site, based on their stated judgment that the source data is already government-published and pre-anonymized (full quote and source URL above).
- **Fix:** New `--skip-privacy-review` CLI flag; call site made conditional; `privacy.py`'s heuristics untouched.
- **Files modified:** `scripts/convert_enquesta.py`, `scripts/pipeline_selftest.py`
- **Verification:** Two new regression tests in `SkipPrivacyReviewTests`; full suite green (60/60).
- **Committed in:** `15a012d`

---

**Total deviations:** 2 (1 auto-fixed bug, 1 operator-approved Rule 4 scope extension)
**Impact on plan:** Both necessary — the bug fix for correctness of the cardinality/privacy heuristics on real-scale data, the scope extension for a runtime problem no plan could have anticipated before real exports existed. No unrelated scope creep; `privacy.py` itself was deliberately left untouched.

## Issues Encountered

- A transient sandbox/classifier denial interrupted the REO1145 conversion command on first attempt ("Stage 2 classifier error — usually transient"); an identical retry succeeded immediately. No code or data issue; noted for awareness only.

## User Setup Required

None — no external service configuration required. The three converted surveys exist only in an ephemeral scratch directory; nothing was written to the repository or to `public/data/`.

## Next Phase Readiness

- Plan 04-03 (publication) must be told: all three surveys (REO1167, REO1151, REO1145) are approved for publication via an explicit **privacy-review-skip** decision (not per-finding drop/accept/narrow), with the operator's verbatim reasoning and source recorded above. 04-03 should re-run the conversion with `--skip-privacy-review` directly into `public/data/` (not the scratch directory used here) using the exact `--id`/`--title`/`--description`/`--date` values recorded in this summary.
- No blockers. `scripts/pipeline/load.py`'s `low_memory=False` fix and `scripts/convert_enquesta.py`'s `--skip-privacy-review` flag are both merged and regression-tested; 04-03 can invoke the pipeline as-is.
- `public/data/` and `scripts/fixtures/` are confirmed unchanged by this plan (`git status --porcelain` empty for both).

## Self-Check: PASSED

- FOUND: `scripts/pipeline/load.py` (`low_memory=False` present in `_read_csv_or_raise`)
- FOUND: `scripts/convert_enquesta.py` (`--skip-privacy-review` flag and conditional call site present)
- FOUND: `scripts/pipeline_selftest.py` (60 tests, 0 failures — `uv run scripts/pipeline_selftest.py -v`)
- FOUND commit `0e4f741` (fix(04-02): force low_memory=False to stop pandas double-counting distinct values on wide exports)
- FOUND commit `15a012d` (feat(04-02): add --skip-privacy-review flag for operator-vetted pre-anonymized sources)
- FOUND: all three real conversions (REO1167, REO1151, REO1145) exited 0 and wrote `<id>_respostes.parquet` + `<id>_meta.json` to the scratch directory
- FOUND: `git status --porcelain public/data/` and `git status --porcelain scripts/fixtures/` both empty

---
*Phase: 04-real-survey-conversion-publication*
*Completed: 2026-08-30*
