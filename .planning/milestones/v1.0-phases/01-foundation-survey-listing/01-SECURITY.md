---
phase: 01
slug: foundation-survey-listing
status: verified
threats_open: 0
asvs_level: 1
created: 2026-08-26
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| GitHub Pages CDN → browser (`enquestes_index.json`, `enquestes/<id>_meta.json`) | Untrusted-shaped JSON crosses here and is rendered into the catalog/summary UI | Public catalog + per-survey KPI metadata (no respondent-level data in Phase 1) |
| Visitor-controlled URL/search-param → `404.html` encoder → `index.html` restore script | Attacker-controllable path/query text is read, re-encoded, and written back into browser history before React boots | Path + query string only |
| Visitor-controlled `:id` route param / `?enquesta=` search param → fetch path | The survey id is fully attacker-controllable and composed into a request URL | Survey id string |
| GitHub Actions runner → GitHub Pages publish | The only privileged step in the system; holds an OIDC token and publish rights | Build artifact (`dist/`) |
| npm registry → local/CI `node_modules` | Third-party code enters the build and ships to every visitor | `tailwindcss`, `@tailwindcss/vite`, `react-router-dom`, `lucide-react`, dev tooling |
| Published aggregate KPI → any reader | A statistic over a small subgroup can identify an individual even with no identifying field published | KPI value + sample size |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 | Tampering / DoS | `src/lib/enquestes.ts` `parseEnquestesIndex`/`parseEnquestaMeta`, `src/pages/HomePage.tsx` | medium | mitigate | Full shape validation at the fetch trust boundary before render; malformed input throws into the existing error state instead of crashing (ASVS V5). Verified: negative cases confirmed via code review and live/local fixture probes. | closed |
| T-01-02 | Tampering (content injection) | `src/pages/HomePage.tsx`, `ExplorerPage.tsx`, `SurveyCard.tsx`, `SurveySummaryModal.tsx`, `ErrorState.tsx` | high | mitigate | Every survey-provided field (`title`, `description`, `date`, KPI `label`/`unit`, failure `message`) renders as a plain JSX text node, React-escaped. React's raw-HTML injection prop is banned across `src/`, asserted by a negative grep in every plan's verify block and independently confirmed by the code reviewer (`grep -rn dangerously src/` → no matches). QA fixture deliberately carries a `<script>alert(1)</script>` title to exercise this at review/UAT time. | closed |
| T-01-03 | Elevation of Privilege | `.github/workflows/deploy.yml` | high | mitigate | Explicit least-privilege `permissions:` block (`contents: read`, `pages: write`, `id-token: write`), no broad-write shorthand anywhere in the file — asserted by negative grep and confirmed by direct read. | closed |
| T-01-04 | Tampering (open redirect via URL round-trip) | `public/404.html` encoder + `index.html` restore script | medium | mitigate | `rafgraph/spa-github-pages` algorithm used verbatim rather than hand-rolled; derives its target solely from `location.pathname` on the same origin, restore side uses `history.replaceState` (rewrites the address bar without navigating) — no code path navigates to an attacker-supplied origin. | closed |
| T-01-05 | Information Disclosure | `src/pages/HomePage.tsx`, `SurveySummaryModal.tsx` error branches | low | accept | User-facing failure copy is a fixed Catalan string with no interpolation of the caught error, its message, or the attempted URL. Residual console visibility accepted — fully public static site, no secrets, no session, no privileged endpoint. | closed |
| T-01-06 | Spoofing / Tampering (local state) | `src/hooks/useTheme.ts` | low | accept | `localStorage` `theme` value compared against the exact literals `light`/`dark` before reaching a class name; a tampered value falls back to system preference. Residual impact limited to the tamperer's own browser. | closed |
| T-01-07 | Information Disclosure (privacy) | `src/components/SurveyCard.tsx` | medium | mitigate | Card renders only the 5 aggregate `EnquestaIndexEntry` fields; no respondent-level artifact is ever read by the component. | closed |
| T-01-08 | Tampering (path manipulation via untrusted input) | `metaUrl` in `src/lib/enquestes.ts`, consumed by `SurveySummaryModal`/`ExplorerPage` | high | mitigate | `isValidEnquestaId` (`/^[A-Za-z0-9._-]{1,64}$/`) restricts the id before any request is built; `metaUrl` additionally percent-encodes it so no path separator survives even if validation were bypassed. Both consumers gate on the validator (asserted by grep, confirmed by verifier). | closed |
| T-01-09 | Information Disclosure (re-identification) | KPI rendering in `src/components/SurveySummaryModal.tsx` | medium | mitigate | Values computed over fewer than `MIN_KPI_SAMPLE` (10) effective respondents are withheld and the withholding is stated; every displayed value carries its sample size. Confirmed against the fixture's below-threshold KPI (`n=6`) during code review and UAT. | closed |
| T-01-SC | Tampering (supply chain) | npm installs across all three plans (`tailwindcss`, `@tailwindcss/vite`, `react-router-dom`, `lucide-react`) | high | mitigate | RESEARCH.md's Package Legitimacy Audit cleared every package on evidence (official orgs, tens-of-millions weekly downloads, long publish history). `lucide-react` — the one `[ASSUMED]`/flagged package — cleared a dedicated `gate="blocking-human"` checkpoint (plan 01-02 Task 1), never auto-approvable, with the human confirming the official `lucide-icons` org, ~97M weekly downloads, and a 2020+ history before install. `npm ci` in CI installs from the committed lockfile only. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-01-05 | Fixed, non-interpolated Catalan failure copy is displayed to users; the underlying error detail remains visible only in the browser console, which is acceptable for a fully public static site with no secrets, sessions, or privileged endpoints. | Plan authors (01-01/01-02/01-03), confirmed at Phase 1 UAT | 2026-08-26 |
| AR-02 | T-01-06 | `localStorage` theme value is validated against an exact literal allowlist before use; residual tamper impact is confined to the tamperer's own browser presentation, not a security-relevant outcome. | Plan authors (01-01), confirmed at Phase 1 UAT | 2026-08-26 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-08-26 | 10 | 10 | 0 | Claude (orchestrator, `/gsd-secure-phase`) — L1/ASVS-1 classification directly from the three plans' plan-time `<threat_model>` registers, cross-checked against `01-REVIEW.md` (code review, 0 critical/blocker findings) and `01-VERIFICATION.md` (13/13 must-haves verified, live-site probes). Per protocol, `threats_open: 0 AND register_authored_at_plan_time: true AND asvs_level == 1` short-circuits to L1 grep-depth classification without a separate auditor dispatch. |
| 2026-08-26 | 10 | 10 | 0 | Claude (orchestrator, `/gsd-secure-phase 01`, re-run) — re-confirmation pass; no phase-01 implementation changes since the prior audit, register unchanged, short-circuit rule re-applied (`threats_open: 0 AND register_authored_at_plan_time: true AND asvs_level == 1`). |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-08-26
