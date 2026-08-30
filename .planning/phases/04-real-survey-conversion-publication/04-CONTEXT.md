# Phase 4: Real Survey Conversion & Publication - Context

**Gathered:** 2026-08-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Take each of the operator's 2-5 real survey exports (already on their local machine) through the existing offline pipeline (`scripts/convert_enquesta.py` + `scripts/pipeline/`) to privacy-approved, published `[id]_respostes.parquet` + `[id]_meta.json` + `enquestes_index.json` artifacts under `public/data/`. Includes fixing whatever real-world pipeline gaps these additional exports surface (same class of bug as v1.0's `;`-delimiter fix, gap G-02-3). Does not touch the React app, the homepage/explorer, or retire the synthetic `mostra-sintetica` dataset — that cutover is Phase 5. Does not add speculative multi-format abstraction ahead of time; format issues are fixed reactively as each real export is actually run through the pipeline.

</domain>

<decisions>
## Implementation Decisions

### Column selection workflow
- **D-01:** The pipeline gains a new default column-selection heuristic based on absolute distinct-value count: any column with **more than 20 distinct values gets excluded by default**; columns with 20 or fewer are kept. This replaces "the operator manually enumerates every column to keep" as the default path for `--columns`. — **Reversibility:** costly — **rationale:** once a survey is published without a column the heuristic excluded, adding it back requires reprocessing and republishing that survey's data artifacts (same class of cost as the existing D-02 free-text exclusion from Phase 2).
- **D-02:** The cutoff is an **absolute count**, not a ratio of respondent count — a column with 21+ distinct values is excluded regardless of how many rows the survey has. Explicitly chosen over scaling the cutoff with row count.
- **D-03:** This is a separate, additional filter from the two existing ones — it does NOT replace or merge with D-02 (Phase 2)'s unconditional free-text exclusion (based on average string length) or the privacy checklist's `UNIQUENESS_RATIO_THRESHOLD=0.9` heuristic (`scripts/pipeline/privacy.py`). A column can be dropped by any of the three independently.
- **D-04:** Columns excluded by the new cardinality cutoff must be **reported** (column name + distinct-value count) so the operator can manually re-include a specific one they know is useful despite high cardinality (e.g. "quin país ets" with 40 countries) via an explicit override on a later run. The report is the mechanism that makes the exclusion discoverable, not just silent.
- **Worked example from discussion:** a 0-10 rating-scale question plus a "no ho sé" option has ≤20 distinct values (11 + 1) and survives the cutoff automatically — this was the concrete case that motivated the whole heuristic, replacing what would otherwise require enumerating every kept column by hand across a 320-column real export (v1.0's scale).

### Survey identity & content
- **D-05:** The operator (user) supplies `--id`, `--title`, and `--description` themselves per survey when the pipeline is run — Claude does NOT draft/propose these from filenames or content. Plans and execution should treat these as inputs gathered at execution time, not something to generate placeholder text for.
- **D-06:** The `--date` argument must reflect the survey's actual collection/run date, supplied by the operator per survey — NOT the pipeline's default (today's date at conversion time). The default-to-today behavior in `convert_enquesta.py` is a fallback for when the real date isn't known, not the intended value for this phase's real conversions.

### Claude's Discretion
- **Privacy finding resolution policy** — not selected for discussion by the user. The existing code already forces a stop (`convert_enquesta.py` blocks with exit code 2 until `--confirm-privacy-review` is passed after the checklist report is read) — Claude's default approach during Phase 4 execution is to treat every finding as a per-survey checkpoint: present the finding to the operator and get an explicit decision (drop the column vs. accept with a recorded reason), never auto-resolve silently. This follows the Phase 2 context's established precedent ("err toward withholding, state why").
- **Exact CLI/code mechanism for the D-01 cardinality heuristic** — new flag name (e.g. `--max-cardinality`, default 20), which module hosts it (likely `scripts/pipeline/infer.py`, alongside the existing `is_free_text_column`/`build_fields`), and how the override for D-04 is expressed (e.g. an additive `--include-columns` flag vs. reinterpreting `--columns` as an override list when both are present) — left to research/planning.
- **Order of operations** between the three exclusion filters (free-text, cardinality, privacy checklist) — likely independent and order-insensitive since they test different properties, but the exact pipeline sequencing is an implementation detail for planning.
- **Where the "excluded columns" report (D-04) renders** — extending the existing `--list-columns` inspection output (which already prints `distints={distinct}` per column) vs. a new report emitted during the main conversion run — left to research/planning.
- Format/encoding/delimiter fixes surfaced by the specific real exports (PUB-05) — genuinely can't be scoped ahead of running the pipeline against them; fix reactively per the milestone-level decision already made in `/gsd-new-milestone` ("just run it and fix what breaks"), following the same regression-test discipline as the v1.0 G-02-3 CSV-delimiter fix.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Pipeline entry point and modules this phase modifies
- `scripts/convert_enquesta.py` — current explicit `--columns` flow (main() steps 5-7); this is where the new D-01 cardinality heuristic and its D-04 exclusion report need to be wired in, likely between "load raw export" and "reduce to allow-list".
- `scripts/pipeline/infer.py` — houses `is_free_text_column`, `build_fields`, `build_kpis`; the natural home for the new distinct-value-count filter (D-01/D-02), kept distinct from free-text exclusion (D-03).
- `scripts/pipeline/privacy.py` — `UNIQUENESS_RATIO_THRESHOLD=0.9`, `MIN_GROUP_SIZE=5`; the new cardinality cutoff (D-01) is a separate, additional filter — do not conflate with or fold into these privacy heuristics.
- `scripts/pipeline/load.py` — `load_table` (CSV/TSV/xlsx loading, encoding fallback, delimiter auto-detection) — the most likely place additional real-export format gaps (PUB-05) surface and get fixed.
- `scripts/pipeline/schema.py` — `ENQUESTA_ID_PATTERN`, `MIN_KPI_SAMPLE`, `validate_meta`/`validate_index`/`write_json` — structural validation this phase's new logic must keep satisfying.
- `scripts/pipeline/index.py` — `compute_upserted_index` (match-by-id upsert, append if new) — this phase only upserts; no removal path exists yet (that's Phase 5's concern for retiring `mostra-sintetica`, not this phase's).
- `scripts/README.md` — documents the current manual "inspect → choose allow-list → run → checklist → confirm" workflow; needs updating once D-01's auto-selection default ships.
- `scripts/pipeline_selftest.py` — regression suite over the pure-logic modules; any new heuristic needs unit test coverage here, mirroring the CSV-delimiter regression tests added for gap G-02-3.

### Requirements and roadmap
- `.planning/REQUIREMENTS.md` — PUB-01, PUB-02, PUB-05 (this phase's scope).
- `.planning/ROADMAP.md` — Phase 4 entry: goal, 4 success criteria, requirements mapping.
- `.planning/PROJECT.md` — Key Decisions table: `uv`+PEP 723 toolchain (always `uv run scripts/convert_enquesta.py`, never system `python3`), privacy thresholds validated against the real 2000×320 export, D-02 free-text exclusion as a permanent non-optional default.

### Locked prior-phase decisions this phase must respect
- `.planning/milestones/v1.0-phases/02-offline-data-pipeline/02-CONTEXT.md` — D-01 (one-row-per-respondent shape), D-02 (free-text always excluded, one-way/costly to reverse), D-03 (auto dimension/measure type inference), D-04 (single export format target, no multi-format abstraction — carried forward at the milestone level as "fix format issues reactively, not speculatively").

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `scripts/pipeline/load.py::load_table` — already handles CSV/TSV/Excel loading with encoding fallback and `,`/`;` delimiter auto-detection (the exact class of fix PUB-05 anticipates needing more of).
- `scripts/pipeline/infer.py::is_free_text_column` — existing per-column heuristic (avg length >60 chars, or near-unique with avg length >25 chars); the new D-01 cardinality filter runs independently alongside this, not replacing it.
- `scripts/convert_enquesta.py`'s `--list-columns` inspection mode — already prints `distints={distinct}` (distinct count) and `ratio-unicitat` per column; this existing per-column stat is exactly what D-01's cutoff needs, and is a natural place to surface the D-04 excluded-columns report.
- `scripts/pipeline/privacy.py::format_checklist_report` — existing pattern for "always print a report, never a bare silent pass" that D-04's excluded-columns report should follow (never silently drop without saying what/why).

### Established Patterns
- Block-by-default gate requiring an explicit re-run flag (`--confirm-privacy-review`) once a report is read — the Claude's Discretion privacy-resolution policy above follows this same shape.
- Structural validation (`schema.validate_meta`/`validate_index`) before any file write touches disk — any new logic must preserve this "validate everything before any write" ordering (`convert_enquesta.py` steps 9-10).
- PEP 723 inline script metadata + `uv run` as the only supported invocation — no venv, no requirements.txt.

### Integration Points
- `scripts/convert_enquesta.py::main()` is the sole integration point for D-01 through D-04 — the new column-selection default logic slots in between loading the raw export and building `fields`/`kpis`.
- `scripts/README.md`'s "Fluxos de treball recomanat" section documents the current manual workflow and will need a new step describing the auto-selection default and its override path.

</code_context>

<specifics>
## Specific Ideas

The concrete example that drove D-01/D-02: a 0-10 satisfaction/rating question with an added "no ho sé" option has 12 distinct values, comfortably under the 20-value cutoff, and should be kept automatically without the operator having to name it explicitly. Conversely, an open-ended-but-categorical question like "quin país ets" (country of residence, potentially 40+ distinct values) is exactly the kind of column the cutoff excludes by default but that the D-04 override exists to bring back when the operator judges it worth keeping.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (DISC-01/DISC-02 were already deferred to v2 at the milestone-scoping stage, not during this discussion.)

</deferred>

---

*Phase: 4-Real Survey Conversion & Publication*
*Context gathered: 2026-08-30*
