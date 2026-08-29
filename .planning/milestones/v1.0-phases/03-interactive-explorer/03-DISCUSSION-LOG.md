# Phase 3: Interactive Explorer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 3-interactive-explorer
**Areas discussed:** Explorer page layout, Shareable link scope

---

## Explorer page layout

| Option | Description | Selected |
|--------|-------------|----------|
| App-shell wrapped | Header bar with survey title + back-link + dark-mode toggle above GraphicWalker, consistent with HomePage's chrome | ✓ |
| Full-bleed | GraphicWalker takes the entire viewport, no app chrome around it | |

**User's choice:** App-shell wrapped
**Notes:** Gives EXPL-07 (back to list) an always-visible home instead of relying on GraphicWalker's own UI for navigation.

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal: title + back-link only | Date/description/N already shown in the KPI modal before click-through — repeating is redundant chrome | ✓ |
| Title + participant count | Constant sample-size reminder while exploring, more header height | |
| Full recap (title, date, description, N) | Most context, most vertical space taken from the chart canvas | |

**User's choice:** Minimal: title + back-link only

| Option | Description | Selected |
|--------|-------------|----------|
| No special handling needed | Simple enough to wrap/truncate with plain flexbox + Tailwind responsive utilities, same as HomePage's header | ✓ |
| Icon-only back-link on small screens | ← text label collapses to arrow icon below a breakpoint | |

**User's choice:** No special handling needed

---

## Shareable link scope

| Option | Description | Selected |
|--------|-------------|----------|
| Everything: fields, chart type, and filters | Matches the requirement literally — a filtered view shared without its filter would misrepresent what was shown | ✓ |
| Chart config only, no filters | Simpler/smaller URL, but silently drops shared filter context | |

**User's choice:** Everything: fields, chart type, and filters

| Option | Description | Selected |
|--------|-------------|----------|
| Manual "Copy link" button | One explicit action, avoids URL/history churn while experimenting | ✓ |
| Auto-synced URL | Refresh/bookmark-safe at any point, but noisier history and encoding on every interaction | |

**User's choice:** Manual "Copy link" button

| Option | Description | Selected |
|--------|-------------|----------|
| App-shell header | Consistent, always-visible, keeps GraphicWalker's own toolbar untouched | ✓ |
| Near GraphicWalker's toolbar | More discoverable in the moment, but requires injecting into third-party UI | |

**User's choice:** App-shell header

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to the default/blank explorer | Consistent with the project's soft-fallback posture (e.g. formatDate) — a stale link isn't attacker input, don't scare the visitor | ✓ |
| Show an explicit error message | Stricter reject-and-explain pattern matching parseEnquestesIndex/parseEnquestaMeta | |

**User's choice:** Fall back to the default/blank explorer

---

## Claude's Discretion

- GraphicWalker computation strategy (materialize-once `dataSource`/`rawFields` vs. live `computation` prop wired to DuckDB-Wasm) — already recommended in `.planning/research/STACK.md`, not re-discussed.
- Data dictionary placement (EXPL-09) — offered as a gray area, not selected by the user; left to research/planning.
- Loading/init experience (EXPL-01) — offered as a gray area, not selected by the user; left to research/planning.
- Chart export mechanism (EXPL-10) — GraphicWalker's built-in toolbar export, per STACK.md; confirm at research time.
- DuckDB-Wasm bundle selection, Parquet registration method, exact query-param encoding format — standard implementation choices already constrained by CLAUDE.md.

## Deferred Ideas

None — discussion stayed within phase scope.
