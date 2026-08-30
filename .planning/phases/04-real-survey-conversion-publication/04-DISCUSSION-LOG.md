# Phase 4: Real Survey Conversion & Publication - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-30
**Phase:** 4-Real Survey Conversion & Publication
**Areas discussed:** Column selection workflow, Survey identity & content

---

## Column selection workflow

| Option | Description | Selected |
|--------|-------------|----------|
| I propose, you approve | Run --list-columns, drop obvious free-text/PII candidates, present shortlist for approval | |
| You specify columns | Show raw --list-columns output, operator names exactly which columns to keep | |
| Other (freeform) | User described a cardinality-based auto-selection idea instead | ✓ |

**User's choice (freeform):** "Ideally, the script should pick all columns and discard the ones that have too many possible answers. For example, more than 20 different values might be too much. On the other hand, there are questions that ask for a punctuation from 0 to 10, and there are other options like 'I don't know'."

**Follow-up 1 — cutoff value:**

| Option | Selected |
|--------|----------|
| ~20 distinct values | ✓ |
| Different number | |

**Follow-up 2 — cutoff type:**

| Option | Selected |
|--------|----------|
| Absolute count | ✓ |
| Relative to row count | |

**Follow-up 3 — override for useful high-cardinality columns:**

| Option | Selected |
|--------|----------|
| Always droppable, no override | |
| Show me what got dropped, I can add back | ✓ |

**Notes:** The user's own example (0-10 rating scale + "no ho sé" = 12 distinct values) directly motivated the ~20 cutoff — it was chosen to comfortably cover that pattern while still excluding open-ended/near-unique columns. The "which country" example was used to illustrate the override case.

---

## Survey identity & content

| Option | Description | Selected |
|--------|-------------|----------|
| I'll provide them | Operator supplies exact id/title/description per survey | ✓ |
| Draft for approval | Claude proposes id/title/description from filename/content | |

**User's choice:** I'll provide them.

**Follow-up — --date meaning:**

| Option | Selected |
|--------|----------|
| Actual survey/collection date | ✓ |
| Publication date is fine | |

**Notes:** `--date` should reflect when each survey was actually run/collected, not the pipeline's default (today, at conversion time).

---

## Claude's Discretion

- **Privacy finding resolution policy** — not selected as a discussion area. Default approach: treat every privacy checklist finding as a per-survey checkpoint requiring an explicit operator decision (drop vs. accept-with-reason), following the code's existing block-by-default design and the Phase 2 "err toward withholding" precedent.
- Exact CLI/code mechanism for the new cardinality heuristic (flag name, module, override syntax).
- Order of operations between the three independent column-exclusion filters (free-text, cardinality, privacy checklist).
- Where the D-04 excluded-columns report renders (extending `--list-columns` vs. a new report step).
- Specific format/encoding/delimiter fixes the real exports will need (can't be scoped until the pipeline actually runs against them — reactive per the milestone-level "fix what breaks" decision).

## Deferred Ideas

None — discussion stayed within phase scope. (DISC-01/DISC-02 catalog search and large-dataset strategies were already deferred to v2 during `/gsd-new-milestone`, not during this discussion.)
