---
phase: 03
slug: interactive-explorer
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: 2026-08-29
---

# Phase 03 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| `/enquesta/:id` route param / `?enquesta=` search param → app | Visitor-controlled string reaching a fetch path, a DuckDB virtual filename, a SQL string literal, and (on the not-found/invalid-id path) the page header | Survey identifier |
| Network → app (`[id]_meta.json`) | Static JSON fetched over HTTP, shape not guaranteed by the type system, feeds both `SurveySummaryModal` and `ExplorerPage` | Survey metadata (field names/types, KPIs) |
| Network → app (`.parquet`) | Binary column data parsed by DuckDB-Wasm inside a Worker | Survey response data (already privacy-reviewed in Phase 2) |
| npm registry → lockfile | Third-party package code executing in the visitor's browser | Package legitimacy |
| Network → DOM (`meta.json` field label/description text) | Field labels/descriptions rendered into `DataDictionary` | Metadata text |
| Third-party component boundary (`<GraphicWalker />`) | A styled-components-based UI this project deliberately does not reach into; also makes its own outbound network calls (bundled, not project code) | Chart spec, theme prop |
| `?chart=` query param → `decodeShareLink` → GraphicWalker `chart` prop | Fully visitor/attacker-controlled payload, decoded client-side and handed to a third-party rendering component | Serialized chart spec |
| App → clipboard | An absolute URL written to the OS clipboard on explicit user action | Share link (public data only) |
| Browser event loop → component state | The native `<dialog>` `close` event arrives on a queued task whose timing the component does not control, and acting on it mutates the URL | Dialog lifecycle state |
| Modal top layer → rest of page | `showModal()` places the dialog in the browser's top layer and renders every other element inert; the dialog's own dismissal controls are the only way back out | UI reachability |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-03-01 | Tampering | `queryParquet` → SQL literal | high | mitigate | `isValidEnquestaId` regex gate precedes virtual-filename composition (`duckdb.ts:93-95,98,106`) | closed |
| T-03-02 | Tampering | Parquet URL composition | medium | mitigate | `dataUrl()` uses `encodeURIComponent(id)` (`duckdb.ts:97`) | closed |
| T-03-03 | Information Disclosure | `meta.json` → render tree | medium | mitigate | `parseEnquestaMeta` throws on malformed shape; fixed error copy, no caught-value interpolation | closed |
| T-03-04 | Denial of Service | DuckDB Worker full-table materialization | low | accept | Client-side/self-inflicted only; dataset size controlled offline by Phase 2 pipeline | closed |
| T-03-05 | Information Disclosure | Full Parquet downloadable from `public/data/` | low | accept | Intentional, gated by Phase 2's DATA-03 privacy checklist | closed |
| T-03-06 | Spoofing | DuckDB wasm/worker loaded from CDN | medium | mitigate | Self-hosted via Vite `?url` imports; confirmed in built output, no CDN reference in `src/` | closed |
| T-03-SC (phase-wide) | Tampering | npm/pip/cargo installs | high | mitigate | Package-legitimacy gate + blocking checkpoint approved (`03-01-SUMMARY.md`); exact-pinned `@duckdb/duckdb-wasm@1.32.0` | closed |
| T-03-07 | Information Disclosure | `DataDictionary` meta.json text | medium | mitigate | Ordinary JSX interpolation only; zero raw-HTML injection APIs in `src/` (grep-confirmed) | closed |
| T-03-08 | Denial of Service | Hostile-length field label/description | low | mitigate | Header title truncates with tooltip; dictionary rows wrap inside bounded `max-h` with scroll | closed |
| T-03-09 | Tampering | Styling/DOM injected into GraphicWalker internals | low | mitigate | Sibling-only layout; theme via documented `appearance` prop; no DOM query into GraphicWalker | closed |
| T-03-10 | Tampering | `decodeShareLink` crafted `?chart=` payload | high | mitigate | 8-step decode, every step returns `undefined` rather than throwing; unit-tested per input class | closed |
| T-03-11 | Tampering | `decodeShareLink` schema-drift guard (shelf-scoped, narrowed by 03-05) | medium | mitigate | Rejects any shelf-assigned field absent from current survey's meta; narrowing exempts only catalogue arrays + 3 named GraphicWalker virtual-fid literals | closed |
| T-03-12 | Denial of Service | `decodeShareLink` length cap | medium | mitigate | `MAX_SHARE_PARAM_LENGTH` (4096) enforced first, before base64/JSON work; shelf-scoped walk, no whole-graph traversal | closed |
| T-03-13 | Information Disclosure | Copied URL contents | low | accept | Payload carries only already-public field names/filter values | closed |
| T-03-14 | Spoofing | Link appearing to come from site while encoding arbitrary spec | low | accept | Chart spec confers no trust/capability, no signing warranted | closed |
| T-03-15 | Information Disclosure | Decoded spec strings rendered by GraphicWalker | low | accept | React default escaping; no raw-HTML injection API; library-owned rendering | closed |
| CR-01 | Tampering | `isChartLike` structural guard | medium | mitigate | Structural guard runs before field-reference guard, rejecting non-chart-shaped payloads first | closed |
| T-03-04-01 | Tampering | `?enquesta=` → `SurveySummaryModal` | low | mitigate | `HomePage.tsx` id-validation gate unchanged since Phase 1 (git-confirmed) | closed |
| T-03-04-02 | Denial of Service | Dialog lifecycle effect | low | mitigate | Empty dependency array; `onClose` reached via ref | closed |
| T-03-04-03 | Information Disclosure | `MIN_KPI_SAMPLE` suppression in modal body | low | accept | Untouched by lifecycle-only plans; out of scope | closed |
| T-03-04-SC | Tampering | npm/pip/cargo installs (03-04 through 03-08) | low | accept | `package.json` unchanged across all five plans (git-confirmed) | closed |
| T-03-05-01 | Elevation of Privilege | Virtual-fid allowlist | low | accept | Exactly 3 named literals via exact `Set.has()`, no wildcard/prefix match | closed |
| T-03-06-01 | Information Disclosure | Not-found/invalid-id header echoes raw visitor-supplied survey id | low | accept | See Accepted Risks Log — plan-internal tension between no-echo intent and EXPL-07's always-visible header; no XSS (React-escaped), id is attacker-known not secret | closed |
| T-03-06-02 | Tampering | `/enquesta/:id` route param | medium | mitigate | `isValidEnquestaId` format regex gates both fetch effects before any request | closed |
| T-03-06-03 | Denial of Service | Phase-2 retry affordance | low | mitigate | Retry button suppressed on not-found path, shown only on load-failure path | closed |
| T-03-06-04 | Tampering | `?chart=` → GraphicWalker | medium | mitigate | Sole consumer delegates to `decodeShareLink`; no bypass path | closed |
| T-03-06-05 | Elevation of Privilege | `defaultConfig` prop | low | accept | Carries only layout size mode + two zeroed numbers; no visitor input/callback | closed |
| T-03-07-01 | Tampering | `?enquesta=` → `SurveySummaryModal` (03-07 re-verify) | low | mitigate | `HomePage.tsx` untouched by 03-07 (git-confirmed) | closed |
| T-03-07-02 | Denial of Service | Dialog lifecycle effect (03-07 re-verify) | low | mitigate | Survived lifecycle rewrite; empty dep array, ref-based close | closed |
| T-03-07-03 | Denial of Service | Suppression counter in `openDialogLifecycle` | medium | mitigate | Increment guarded on `dialog.open`, immediately before `close()`; direct test coverage across all 3 dispatch timings, returns to zero | closed |
| T-03-07-04 | Information Disclosure | `MIN_KPI_SAMPLE` suppression (03-07 re-verify) | low | accept | Untouched, out of scope | closed |
| T-03-08-01 | Denial of Service | `<dialog>` positioning in `SurveySummaryModal` | medium | mitigate | Only `m-auto` margin restored; no fixed/inset/transform utility fighting the UA rule's scroll behavior; ~375px reachability human-confirmed (`03-UAT.md` test 10) | closed |
| T-03-08-02 | Tampering | Tailwind content scanning → emitted utility | low | mitigate | Static string literal; built-CSS assertion re-confirmed live (`dist/assets/*.css` contains `.m-auto{margin:auto}`) | closed |

*Status: open · closed · open — below `high` threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

**Supply-chain threats** (`T-03-05-SC`, `T-03-06-SC`, `T-03-07-SC`, `T-03-08-SC`) are consolidated into `T-03-04-SC` above — all five gap-closure plans (03-04 through 03-08) added no packages and left `package.json` unchanged (git-confirmed).

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-04 | Client-side/self-inflicted DoS only; dataset size controlled offline by the Phase 2 pipeline | Plan author (03-01) | 2026-08-26 |
| AR-03-02 | T-03-05 | Full Parquet publication is intentional, gated by Phase 2's DATA-03 privacy checklist | Plan author (03-01) | 2026-08-26 |
| AR-03-03 | T-03-13 | Share-link payload carries only already-public field names/filter values | Plan author (03-03) | 2026-08-26 |
| AR-03-04 | T-03-14 | A chart spec confers no trust or capability; no cryptographic signing warranted | Plan author (03-03) | 2026-08-26 |
| AR-03-05 | T-03-15 | React's default escaping applies; GraphicWalker's own rendering is library-owned per D-06 | Plan author (03-03) | 2026-08-26 |
| AR-03-06 | T-03-04-03 / T-03-07-04 | `MIN_KPI_SAMPLE` re-identification control untouched by lifecycle-only plans; out of scope | Plan authors (03-04, 03-07) | 2026-08-28 |
| AR-03-07 | T-03-04-SC | No packages added across 03-04–03-08; `package.json` unchanged (git-confirmed) | Security auditor | 2026-08-29 |
| AR-03-08 | T-03-05-01 | Virtual-fid allowlist admits exactly 3 fixed GraphicWalker-internal literals, no narrower formulation possible without breaking the "Number of records" chart | Plan author (03-05) | 2026-08-27 |
| AR-03-09 | T-03-06-05 | `defaultConfig` prop carries only a layout size mode + two zeroed numbers, no visitor input | Plan author (03-06) | 2026-08-27 |
| AR-03-10 | T-03-06-01 | Not-found/invalid-id header reflects the raw visitor-supplied survey id (`ExplorerPage.tsx:199` → `ExplorerHeader.tsx:52-54`). Contradicts that plan's own "no id echo" mitigation text, but is required for EXPL-07 (header must stay visible in every state). No XSS — React escapes the value — and the id is attacker-known input, not a secret. User confirmed acceptance during `/gsd-verify-work 03` security gate. | User | 2026-08-29 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-29 | 39 | 39 | 0 | gsd-security-auditor (Claude, opus) |

**Non-blocking finding at time of audit:** T-03-06-01 (low severity) — resolved via user disposition to "accept" during this audit (see AR-03-10). No blocking (severity ≥ high) threats found.

**Informational, not counted as threats:**
- `03-04` through `03-08` SUMMARY.md files have no `## Threat Flags` heading at all (absent, not merely empty) — the register was instead verified directly against the current code, which is why this is informational rather than a finding.
- The bundled `@kanaries/graphic-walker` code contains third-party origin strings (`api.kanaries.net`, `imagedelivery.net`, an R2 bucket) not covered by any register entry (T-03-06 is scoped to DuckDB asset loading only). Not verified as reachable at runtime; the project's own `src/` contains zero absolute URLs. Flagged for a future phase's threat model if GraphicWalker's own network behavior becomes in-scope.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-29
