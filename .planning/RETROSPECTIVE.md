# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 — MVP

**Shipped:** 2026-08-29
**Phases:** 3 | **Plans:** 14 | **Sessions:** N/A (not tracked)

### What Was Built
- Deployed Vite/React/TypeScript/Tailwind app on GitHub Pages via GitHub Actions, with a JSON-driven survey catalog homepage and a sample-size-aware quick KPI summary modal
- Offline Python pipeline (`uv` + PEP 723) converting raw CSV/Excel survey exports into Parquet + metadata, gated by a block-by-default privacy checklist (quasi-identifiers, small-group k-anonymity, free-text exclusion) plus a synthetic mock-data generator
- The core value: DuckDB-Wasm running SQL over Parquet directly in the browser, wired into GraphicWalker for free drag-and-drop chart exploration, with a data dictionary, PNG/SVG chart export, and a versioned, defensively-decoded shareable `?chart=` link

### What Worked
- Tracer-slice-first planning (walking skeleton in 01-01, DuckDB+GraphicWalker tracer in 03-01) caught integration risk (GitHub Pages base path, wasm/worker asset serving, COOP/COEP unavailability) before feature work piled on top
- The block-by-default privacy gate (Phase 2) was validated directly against the user's real 2000×320 export with no negative feedback — designing the threshold-based checklist before any real data existed paid off
- TDD on the share-link encode/decode logic (16 unit assertions) meant the eventual G-03-4 bug (schema-drift guard rejecting every real link) was fixed with a scoped, well-tested change rather than a guess

### What Was Inefficient
- The SurveySummaryModal `<dialog>` self-dismissal bug (G-03-2) needed two separate gap-closure plans (03-04, then 03-07) to actually fix — the first attempt treated the symptom (merge two effects) rather than the root cause (React StrictMode's simulated remount racing an async native `close` event), which only 03-07's suppression-counter approach addressed
- G-03-6 (a suspected not-found/load-failed regression) consumed a full debug investigation that ended inconclusive — four independent real-Chrome reproductions found no code defect, pointing instead to local session/process state at UAT time that couldn't be verified retroactively
- EXPL-11 (shareable links) shipped in Wave 3 as "done" but was actually 0% functional until the G-03-4 gap closure — the schema-drift guard's test fixture didn't model GraphicWalker's real `exportCode()` shape, so the bug wasn't caught until real UAT

### Patterns Established
- Native `<dialog>` lifecycle management under React StrictMode needs a suppression-counter, not just effect consolidation — the async native `close` event from a simulated unmount can still land on the real mount's listener
- Tailwind v4 Preflight's `@layer base` author-origin resets (e.g. `margin: 0`) beat browser user-agent defaults regardless of specificity; overriding them requires another author-origin rule in `@layer utilities`, declared after `base`
- Test fixtures for third-party library integration points (e.g. GraphicWalker's `exportCode()`) should be built from the installed package's actual `.d.ts`/runtime shape, not an assumption — a mismatched fixture let EXPL-11 "pass" while being fully broken

### Key Lessons
1. When a UAT gap is symptom-fixed once and recurs, stop and find the actual mechanism (StrictMode + async event timing here) before attempting a second patch — the second attempt cost less time than the first once the real cause was understood
2. Validate privacy/anonymization thresholds against a real export as early as possible; defaults chosen without real data (`MIN_GROUP_SIZE=5`, `UNIQUENESS_RATIO_THRESHOLD=0.9`) held up, but that's confirmed, not assumed
3. An inconclusive debug session is a valid, honest outcome — G-03-6 correctly stopped short of "fixing" code that four independent real-browser reproductions showed was already correct, rather than making a speculative change

### Cost Observations
- Model mix: not tracked this milestone
- Sessions: not tracked this milestone
- Notable: 8 gap-closure debug sessions were opened across Phase 3's UAT cycle (7 diagnosed and fixed, 1 inconclusive) — all closed and acknowledged at milestone close; see MILESTONES.md's "Known verification overrides" note

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | N/A | 3 | First milestone — tracer-slice-first planning and TDD on encode/decode logic established as defaults |

### Cumulative Quality

| Milestone | Tests | Coverage | Zero-Dep Additions |
|-----------|-------|----------|-------------------|
| v1.0 | Unit tests on pipeline (24 cases) + shareLink (16 assertions) + dialog lifecycle repro; security audit 39/39 threats closed | Not measured | N/A |

### Top Lessons (Verified Across Milestones)

1. Tracer-slice-first planning (walking skeleton before feature layering) caught the highest-risk integration points (GitHub Pages base path, wasm asset serving) early — carry forward to v1.1
