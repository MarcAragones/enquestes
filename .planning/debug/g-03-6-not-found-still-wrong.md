---
status: inconclusive
trigger: "G-03-6 (03-UAT.md): Visiting /enquesta/{nonexistent-id} in the production preview still shows the load-failed message instead of not-found copy, even after 03-06 (commit 331116f) supposedly fixed this exact bug (G-03-2b) — goal: find_root_cause_only. Second pass: user confirmed npm run preview:pages was used, refuting the first pass's 'wrong server' conclusion — re-investigated to find the actual browser-vs-synthetic discrepancy."
created: 2026-08-28T00:00:00Z
updated: 2026-08-28T06:45:00Z
audit_acknowledged:
  milestone: v1.0
  at: 2026-08-29
  status: inconclusive
---

## Current Focus

hypothesis: REFUTED by user — "wrong preview server" (npm run preview vs preview:pages) is dead. User confirmed they used npm run preview:pages.
test: n/a — investigation re-opened per orchestrator directive to find the real browser-vs-synthetic discrepancy
expecting: n/a
next_action: none — return INVESTIGATION INCONCLUSIVE to caller (see Resolution: no code-level defect found after exhaustive real-browser reproduction; most likely explanation is now local/session state at UAT time, not the code)

bug_class: re-classified — insufficient evidence to call this a Bohrbug (deterministic code defect) anymore. Every reproduction attempt against current code + preview:pages, including a genuine end-to-end run in real Google Chrome with the actual DuckDB-Wasm engine executing, produces the CORRECT not-found result 100% of the time (4/4 runs, zero flakiness observed). This looks like a Mandelbug/non-reproducible-from-current-state class: something about the human's exact machine/session state at UAT time that isn't captured by the current repo + a fresh build.

reasoning_checkpoint_2 (second pass, supersedes the first — the AND-gate in the original reasoning_checkpoint below is now itself REFUTED by the user's explicit confirmation of preview:pages):
  hypothesis: "There is no discoverable code-level or browser-runtime discrepancy between the synthetic (curl/Node fetch) reproduction and real Chrome browser behavior for this exact scenario. The classification code, the metaUrl() construction, and gh-pages-preview.mjs's 404 semantics are all provably correct against a REAL Chrome browser's own fetch() implementation and a REAL end-to-end app run (genuine DuckDB-Wasm engine, genuine Worker, genuine WASM compile, genuine fetch()) — not just Node/curl proxies for browser behavior."
  confirming_evidence:

    - "Built a real Chrome-executed probe page (served from the actual running preview:pages instance) that runs ExplorerPage.tsx's EXACT phase-2 fetch+classify code (SurveyNotFoundError, Promise.allSettled, instanceof check, fixed-priority classifier) using the browser's OWN native fetch() — not curl, not Node's fetch. Result, captured via headless Chrome --dump-dom: 'meta fetch resolved: status=404 ok=false type=basic ... FINAL CLASSIFICATION=not-found'. This is the first evidence in this whole investigation using literal browser-native fetch() rather than a Node-side proxy for it."
    - "Ran the FULL real app end-to-end in real headless Google Chrome (not a synthetic script) against the actual running preview:pages server: full SPA-redirect dance (404.html -> query-string redirect -> index.html -> replaceState -> React mount) all observed via server request log; the real DuckDB-Wasm engine genuinely initialized (duckdb-eh-*.wasm fetched and compiled, 652ms); real fetch() calls for meta.json and the .parquet file both correctly received 404 from the server. Final rendered DOM (--dump-dom) showed 'No s'ha trobat aquesta enquesta.' with no retry button — the CORRECT not-found branch, not load-failed."
    - "Repeated the full end-to-end real-Chrome run 4 times consecutively: 4/4 correct (not-found). No intermittency/race observed — this rules out a Heisenbug/timing-race explanation for the classification path itself."
    - "Confirmed via grep of the actual built dist/assets/index-*.js chunk that import.meta.env.BASE_URL was statically replaced by Vite at build time to the literal string '/enquestes/' (`function Wn(e){return \`/enquestes/data/${e}\`}`) — identical to what every curl/fetch test used. Rules out a BASE_URL/runtime-vs-synthetic URL-construction mismatch."
    - "Confirmed via git diff that no commit between 331116f (the fix) and current HEAD touched the error-copy text (74880b9 only changed layout/sizing, not ExplorerPage's error branches) — LOAD_FAILED_TITLE has been the exact same string since 331116f."
    - "CRITICAL: the user's verbatim reported text — 'No s'han pogut carregar les dades d'aquesta enquesta.' — is a character-for-character match of the CURRENT, POST-FIX LOAD_FAILED_TITLE constant (ExplorerPage.tsx line 46). The PRE-fix (commit fb6bc29) code path that produced a load-failed-shaped message used DIFFERENT wording entirely: ErrorState's default title 'No s'han pogut carregar les enquestes' (plural, generic list-failure heading — no title prop was passed pre-fix) with body message 'No s'han pogut carregar les dades de l'enquesta.' (singular, no 'aquesta'). Since the reported text is the NEW wording, not the OLD wording, the human was DEFINITELY running post-331116f code, not a stale pre-fix build — this eliminates the 'stale dist/' explanation the first debug pass had already (weakly) eliminated on different grounds, and now eliminates it on strictly stronger textual-fingerprint grounds."
    - "Checked scripts/fixtures/ (the only mechanism by which gh-pages-preview.mjs can serve a 200 for a path under /data/ that doesn't exist in dist/): contains only 'demo-2024_meta.json', nothing for 'no-existeix-aquesta', AND the --fixtures flag is never passed by npm run preview:pages, npm run verify:pages, or any documented instruction — ruling this mechanism out as the source of an accidental 200."
    - "Checked for a service worker anywhere in the app source or in @duckdb/duckdb-wasm's shipped worker/main bundles: none registered. Rules out a stale-cache-via-service-worker explanation."
  falsification_test: "If the real-Chrome end-to-end run (with genuine DuckDB-Wasm execution) had shown 'load-failed' even once across repeated runs, that would confirm a genuine code/runtime discrepancy and this hypothesis would be refuted. It did not — 4/4 clean not-found results."
  fix_rationale: "n/a — find_root_cause_only mode, and no code defect was confirmed. See Resolution for the honest INCONCLUSIVE call and the recommended next step (re-verify with the user rather than changing code that has now been proven correct three independent ways: curl, Node fetch, and genuine real-Chrome end-to-end execution)."
  blind_spots: "Could not use claude-in-chrome (extension not connected in this environment) for a literal interactive click-through — relied on headless Google Chrome (real Chrome binary, not a simulation) driven via --dump-dom with a deliberate img-load-delay trick injected into dist/index.html (a build artifact, not source) to give the real DuckDB-Wasm engine genuine wall-clock time to fetch/compile/run before the page's load event (and therefore --dump-dom's capture point) fired. This is a real browser executing real code over real network calls to the real preview:pages server — about as close to 'real browser conditions' as achievable without an attached interactive session — but it is still headless, and it reuses a throwaway Chrome profile, so cannot fully rule out something specific to the human's own browser profile (a specific extension, a corporate proxy/DNS override, a locally-installed dev-tools override, or actual local disk contamination in their own dist/ or scripts/fixtures/ that isn't present in this repository checkout). Did not verify what happens if a SECOND server process (e.g. a lingering earlier `npm run preview:pages` or `npm run verify:pages` invocation) was already bound to port 4173 when the human ran the command a second time — Node would normally crash loudly on EADDRINUSE, but could not test this interactively without risking disruption to any of the user's own running processes."
  candidate_causes:

    - "environment (human's local disk state at UAT time): a leftover/stray file at dist/data/enquestes/no-existeix-aquesta_meta.json (or an unusual scripts/fixtures/ invocation) that briefly made the meta.json fetch resolve 200 instead of 404 — not present in this checkout's dist/ or scripts/fixtures/, so unverifiable retroactively"
    - "process (human's local session at UAT time): a second, different process was actually answering port 4173 for that one request (e.g., a stale background server from an earlier test run that hadn't been killed, serving an older dist/ snapshot) — this is a DIFFERENT and more specific variant of the already-refuted 'wrong preview command' theory: same command (preview:pages), but possibly not the process/dist/ the human thought was live"
  and_gate: "no (for this second pass) — I found no evidence of a code defect at all, so there is nothing for an environmental cause to combine WITH. Either candidate cause above is independently sufficient on its own to explain a transient 200-instead-of-404 for this one path, without any contributing code weakness (the code's exclusive reliance on res.status===404 is a known, already-flagged fragility from the first debug pass, but it functioned correctly in every reproduction here)."

reasoning_checkpoint:
  hypothesis: "ExplorerPage.tsx's phase-2 not-found classification (`if (res.status === 404) throw new SurveyNotFoundError()`) is itself correct and matches the built bundle exactly, but it is silently contingent on the static file server returning a genuine HTTP 404 for a missing meta.json path. `npm run preview:pages` (the project's custom GH-Pages-404-emulating server, scripts/gh-pages-preview.mjs) DOES return a true 404 for this path, so the fix works there. Plain `npm run preview` (Vite's own built-in preview server) does NOT — it implements a blanket SPA fallback that serves index.html with HTTP 200 for ANY unmatched path, including a missing JSON asset — so `res.status === 404` never fires, `res.json()` throws a SyntaxError parsing HTML as JSON, and the fixed-priority classifier falls through to the generic 'load-failed' branch, reproducing the exact reported symptom. Both servers share the identical default port 4173 and are behaviorally indistinguishable for every other URL in the app, making it an easy mistake to run the wrong one and believe the fix regressed."
  confirming_evidence:

    - "Direct curl test against `npm run preview:pages` (scripts/gh-pages-preview.mjs, dist/ freshly rebuilt from current HEAD): `curl .../data/enquestes/no-existeix-aquesta_meta.json` -> HTTP 404, content-type text/html (404.html body) — genuine 404 status."
    - "Node script replicating ExplorerPage.tsx's exact phase-2 classification logic (fetch -> status===404 check -> SurveyNotFoundError -> Promise.allSettled -> instanceof check) run against the live preview:pages server: metaResult.status = 'rejected', reason instanceof SurveyNotFoundError = true. The not-found branch IS correctly reached when the server returns a true 404."
    - "Direct curl test against plain `npm run preview` (`vite preview`, same dist/, same base /enquestes/, same default port 4173): same meta.json URL -> HTTP 200, content-type text/html, body is index.html (Vite's own SPA fallback). Not a 404 at all."
    - "grep of the built dist/assets/ExplorerPage-*.js bundle shows the minified classification logic (`if(e.status===404)throw new Oxn; ... e.reason instanceof Oxn`) is character-for-character equivalent to the ExplorerPage.tsx source — the 03-06 fix compiled correctly and is not lost/mangled by minification or code-splitting (no duplicate class instance issue: SurveyNotFoundError is declared and consumed entirely within the same lazy-loaded chunk)."
    - "vite preview's and gh-pages-preview.mjs's port defaults are BOTH 4173 (scripts/gh-pages-preview.mjs line 10 `port: 4173`; Vite's own preview default is also 4173) — the two servers are trivially confusable since they're launched with visually similar npm scripts (`npm run preview` vs `npm run preview:pages`) and bind the same port."
    - "All other UAT tests (3, 4, 7) and .planning/WINDOWS.md entries consistently instruct/reference `npm run preview:pages` specifically, never bare `npm run preview` — so the documented reproduction path is correct; the discrepancy is in what was actually executed at verification time (or in-browser state at that time), not in the documented steps or the code."
  falsification_test: "If `npm run preview:pages` itself (not plain `npm run preview`) had returned status 200/HTML for the meta.json path, or if the classification code checked something other than res.status (e.g. content-sniffing) before throwing, this hypothesis would be refuted. Neither is the case — directly observed via curl and a live Promise.allSettled replay against the actual running preview:pages server on the current, rebuilt dist/."
  fix_rationale: "n/a — find_root_cause_only mode. Two independent directions exist for a follow-up plan: (a) process/verification fix — ensure the human-check/automation always launches scripts/gh-pages-preview.mjs specifically (e.g. rename or guard against confusing it with vite preview, or have `npm run preview:pages` fail fast if port 4173 is already occupied by a different process, or print a distinguishing banner), and (b) code robustness fix — make ExplorerPage.tsx's classification resilient regardless of which static server is used, e.g. also treat a non-JSON content-type (or a successful parse that doesn't match EnquestaMeta's shape via parseEnquestaMeta) on the meta fetch as evidence of 'this path doesn't exist' rather than only trusting res.status === 404, since real hosting quirks (misconfigured CDNs, SPA-fallback servers, some static hosts that 200 everything) can't be fully ruled out even in production."
  blind_spots: "Did not execute a real end-to-end browser session (claude-in-chrome unavailable in this environment, same limitation noted in 03-06-SUMMARY.md) — relied on curl + a Node script that replicates the exact classification code and confirmed the built bundle's minified logic matches the source verbatim, which is strong but not a literal live-browser click-through. Cannot confirm with certainty which command the human tester actually ran for UAT Test 6 (no terminal history available) — the 'wrong preview server' explanation is the most parsimonious and fully falsifiable mechanism found, but it is inferred from the shared-port/confusable-command evidence rather than directly observed tester behavior. Did not test the REAL deployed GitHub Pages URL (out of scope / not yet deployed for this milestone) — relies on scripts/verify-pages.mjs's own long-standing assertion (and well-established GH Pages behavior) that GH Pages returns true 404 status for missing files, which is what `gh-pages-preview.mjs` was purpose-built to emulate."
  candidate_causes:

    - "code: ExplorerPage.tsx's not-found classification trusts `res.status === 404` exclusively, with no fallback/defence for a server that returns 200 for a missing asset (content-type/shape sniffing would make the classification independent of server behavior)"
    - "environment/process: two near-identical npm scripts (`preview` vs `preview:pages`) bind the identical default port 4173 and are behaviorally indistinguishable for every URL except this one 404 edge case, making it easy to run/trust the wrong one during manual verification and misreport a regression that isn't in the code"
  and_gate: "yes — reproducing the exact reported symptom requires BOTH conditions simultaneously: (1) the classification code makes its not-found/load-failed decision based solely on HTTP status (a reasonable, working design against the correct server) AND (2) the server actually serving the request during verification does not provide genuine 404 semantics for a missing JSON path (true of plain `vite preview`, false of `scripts/gh-pages-preview.mjs` and of real GitHub Pages). Neither factor alone reproduces the bug: status-only classification against the correct server works fine (confirmed); and a wrong/fallback-everything server wouldn't matter if the classification didn't hinge on status. This is a genuine two-category (code design assumption x environment/tooling ambiguity) root cause, not a single-cause code defect."

## Symptoms

expected: |
  Visiting /enquesta/no-existeix-aquesta (a well-formed but nonexistent
  survey id) in the production preview shows "No s'ha trobat aquesta
  enquesta." with NO retry button.
actual: |
  User got "No s'han pogut carregar les dades d'aquesta enquesta." instead
  (verbatim UAT response) — this is the LOAD_FAILED message, not the
  not-found message. mostra-sintetica still loads normally (no regression
  there).
errors: |
  None reported by user.
reproduction: |
  npm run build && npm run preview:pages, visit /enquesta/no-existeix-aquesta.
  UAT Test 6 in .planning/phases/03-interactive-explorer/03-UAT.md.
started: |
  Reported as a re-failure of G-03-2b after 03-06-PLAN.md (commit 331116f)
  supposedly fixed the not-found vs load-failed classification.

## Eliminated

- hypothesis: "The 03-06 classification logic itself (Promise.allSettled + fixed-priority `res.status === 404` -> SurveyNotFoundError check) is broken or was not actually applied/compiled correctly."
  evidence: "Read ExplorerPage.tsx source directly: the check `if (res.status === 404) throw new SurveyNotFoundError()` and the priority classifier `if (metaResult.status === 'rejected' && metaResult.reason instanceof SurveyNotFoundError)` are present and correctly ordered. grep of the actual built dist/assets/ExplorerPage-*.js bundle shows character-for-character equivalent minified logic (`if(e.status===404)throw new Oxn; ... e.reason instanceof Oxn`) — the fix compiled correctly, no minification/tree-shaking mangling, no duplicate-class-instance issue from the lazy-loaded chunk boundary."
  timestamp: 2026-08-28T00:00:00Z

- hypothesis: "The Promise.allSettled/fixed-priority classification has a timing/race bug where rowsResult (queryParquet) can still win over a genuine metaResult 404 in some ordering."
  evidence: "Code returns immediately inside the `if (metaResult.status === 'rejected' && metaResult.reason instanceof SurveyNotFoundError)` branch before rowsResult is ever consulted — there is no code path where rowsResult's outcome can override a confirmed metadata-404, regardless of settlement order. Confirmed by direct code reading; not timing-dependent."
  timestamp: 2026-08-28T00:00:00Z

- hypothesis: "SurveyNotFoundError's `instanceof` check fails due to the class being duplicated across chunks (ExplorerPage is lazy-loaded via React.lazy/dynamic import)."
  evidence: "SurveyNotFoundError is declared and consumed entirely within ExplorerPage.tsx, compiled into the single ExplorerPage-*.js chunk (confirmed via grep of the built bundle) — there is no second copy in any other chunk, so no cross-chunk identity mismatch is possible for this class specifically."
  timestamp: 2026-08-28T00:00:00Z

- hypothesis: "A stale dist/ build (built before commit 331116f) was served during the human's verification."
  evidence: "dist/ is gitignored (not tracked in git), and npm run preview:pages reads files fresh from disk on every request (no in-memory caching in scripts/gh-pages-preview.mjs) — so a rebuild always takes effect immediately for that server. Confirmed by freshly running `npm run build` from current HEAD (post-331116f) and observing the bug's absence against preview:pages. Cannot fully rule out that the human's own dist/ was stale at the time they tested, but this would not explain why preview:pages (server-behavior-wise) mismatches expectations independent of dist content — the more direct and falsifiable explanation is the preview-server discrepancy below, which reproduces the bug on a byte-for-byte identical dist/."
  timestamp: 2026-08-28T00:00:00Z

---
### Second pass eliminations (this session)

- hypothesis: "(First pass's primary conclusion) The human ran plain `npm run preview` instead of `npm run preview:pages` — the two share port 4173 and are easily confused."
  evidence: "User explicitly confirmed they used `npm run preview:pages` as instructed. This is direct first-party confirmation, not inference — the AND-gate root cause from the first debug pass no longer holds, since one of its two required co-occurring conditions is now disproven."
  timestamp: 2026-08-28T06:15:00Z

- hypothesis: "There is a browser-fetch-vs-Node-fetch semantic difference (e.g. how a real browser parses the Node http server's chunked-encoding 404 response, or handles Sec-Fetch-*/Accept headers) that causes fetch(metaUrl(id)) to not resolve with status 404 in a real browser the way it does under curl/Node fetch."
  evidence: "Built and ran a probe page inside REAL headless Google Chrome (actual Chrome 151 binary, genuine fetch() implementation) served from the live preview:pages instance, executing ExplorerPage.tsx's literal phase-2 fetch+classify code. Result: status=404, ok=false, rejected with SurveyNotFoundError, FINAL CLASSIFICATION=not-found — identical to the curl/Node-fetch results. Also confirmed via curl -v that the server's actual response headers (Transfer-Encoding: chunked, Content-Type: text/html; charset=utf-8, no Content-Length surprises) are standard and unremarkable for both the meta.json path and the deep-link route path."
  timestamp: 2026-08-28T06:26:00Z

- hypothesis: "import.meta.env.BASE_URL resolves differently at runtime in the real bundled app than in the synthetic reproduction, producing a different request URL than what was curl-tested."
  evidence: "grep of the actual built dist/assets/index-*.js chunk shows `import.meta.env.BASE_URL` was statically inlined by Vite at build time to the literal string '/enquestes/' — `function Wn(e){return \`/enquestes/data/${e}\`}` — byte-identical to the URL every curl/fetch test used."
  timestamp: 2026-08-28T06:30:00Z

- hypothesis: "A race condition between the real DuckDB-Wasm engine's own HTTP client (registerFileURL / conn.query fetching the .parquet file) and the meta.json fetch causes the classification's fixed-priority check to be bypassed or to see stale settlement state, only under real browser/Worker timing (not reproducible with a stubbed queryParquet)."
  evidence: "Ran the complete, unmodified production app end-to-end in real headless Chrome — genuine DuckDB-Wasm engine, genuine Worker, genuine WASM compile (duckdb-eh-*.wasm fetched and compiled in 652ms), genuine fetch() calls for both meta.json and the parquet file (both correctly 404, confirmed via server request log) — repeated 4 times consecutively with a shortened but still-real async delay. Every run reached the correct 'No s'ha trobat aquesta enquesta.' not-found render, no retry button. Zero variance across 4 runs."
  timestamp: 2026-08-28T06:38:00Z

- hypothesis: "A stray/leftover fixture file, or an accidental --fixtures invocation, causes the meta.json request for this specific id to resolve 200 instead of 404 in the human's local environment."
  evidence: "scripts/fixtures/enquestes/ contains only demo-2024_meta.json (no no-existeix-aquesta fixture). --fixtures is never passed by any npm script or documented instruction (preview:pages, verify:pages) — the fixtures branch in gh-pages-preview.mjs's handler is unreachable in every documented usage. This narrows (but, being a check of THIS repo checkout rather than the human's disk at UAT time, cannot fully rule out) a similar-shaped but undocumented local anomaly on the human's own machine — see Resolution's remaining candidate causes."
  timestamp: 2026-08-28T06:43:00Z

- hypothesis: "A service worker (registered by an earlier `npm run dev` session, or shipped inside @duckdb/duckdb-wasm) intercepts the meta.json fetch and serves a stale cached 200 response."
  evidence: "No `serviceWorker`/`navigator.serviceWorker` reference exists anywhere in src/, public/, or node_modules/@duckdb/duckdb-wasm/dist/*.js — there is no service worker in this app or its data-engine dependency to register one in the first place."
  timestamp: 2026-08-28T06:44:00Z

## Evidence

- timestamp: 2026-08-28T00:00:00Z
  checked: "src/pages/ExplorerPage.tsx (full read, post-331116f)"
  found: "Phase-2 effect (lines 154-188): `fetch(metaUrl(id)).then((res) => { if (res.status === 404) throw new SurveyNotFoundError(); if (!res.ok) throw new Error(...); return res.json() })` paired via `Promise.allSettled` with `queryParquet(id)`, then classified with fixed priority: metadata-404 (SurveyNotFoundError) > any other rejection > parse failure. Render branches for `dataState.kind === 'not-found'` vs `'load-failed'` use distinct title/message constants (NOT_FOUND_TITLE/MESSAGE vs LOAD_FAILED_TITLE/MESSAGE, lines 44-47, 225-230)."
  implication: "The classification logic as written is correct and internally consistent — it will only reach 'load-failed' for this id if the meta fetch's promise either resolves with a non-404, non-ok status, or rejects with something other than SurveyNotFoundError (e.g. a JSON-parse error on a 200 response)."

- timestamp: 2026-08-28T00:00:00Z
  checked: "npm run build (fresh, from current HEAD which includes commit 331116f)"
  found: "Build succeeds cleanly (tsc -b + vite build), producing dist/assets/ExplorerPage-DurD1Xya.js as its own lazy-loaded chunk."
  implication: "Confirms a byte-for-byte current build was used for all subsequent server tests below — rules out stale-build explanations for these specific tests."

- timestamp: 2026-08-28T00:00:00Z
  checked: "curl against `node scripts/gh-pages-preview.mjs --dir dist --base /enquestes/ --port 4173` for /enquestes/data/enquestes/no-existeix-aquesta_meta.json"
  found: "HTTP 404, content-type text/html; charset=utf-8, body is 404.html's content (the spa-github-pages redirect script page)."
  implication: "The project's own GH-Pages-emulating preview server correctly returns a genuine 404 status for a missing survey's meta.json — exactly the condition ExplorerPage.tsx's classification code expects."

- timestamp: 2026-08-28T00:00:00Z
  checked: "Node script replicating ExplorerPage.tsx's exact phase-2 fetch+classify logic (SurveyNotFoundError class, status===404 check, Promise.allSettled, instanceof check) run against the live gh-pages-preview.mjs server on the freshly-built dist/"
  found: "metaResult.status = 'rejected'; metaResult.reason instanceof SurveyNotFoundError = true."
  implication: "Direct, executable proof that against the CORRECT preview server, the current code reaches the not-found classification exactly as designed — the 03-06 fix works."

- timestamp: 2026-08-28T00:00:00Z
  checked: "curl against plain `npm run preview` (`vite preview --port 4174`, same dist/, same base) for the identical meta.json URL and for the route /enquesta/no-existeix-aquesta"
  found: "Both return HTTP 200, content-type text/html — Vite's own preview server serves index.html as a blanket SPA fallback for ANY unmatched path, never a true 404, for both the JSON asset path and the client-side route path."
  implication: "Under Vite's own preview server, fetch(metaUrl(id)) resolves with res.status===200/res.ok===true, so `res.status === 404` never fires; the code proceeds to res.json(), which throws a SyntaxError parsing HTML as JSON. That rejection is NOT instanceof SurveyNotFoundError, so the fixed-priority classifier falls through to the generic 'load-failed' branch — reproducing the user's exact reported message verbatim."

- timestamp: 2026-08-28T00:00:00Z
  checked: "Default ports of both preview mechanisms (scripts/gh-pages-preview.mjs line 10; Vite's own well-known preview default)"
  found: "Both default to port 4173 and both are launched via nearly-identical npm scripts (`npm run preview` vs `npm run preview:pages`), with identical `/enquestes/` base and visually indistinguishable output for every URL in the app except this specific 404-classification case."
  implication: "This is a highly plausible, easy-to-make verification mistake: running the more idiomatic/muscle-memory `npm run preview` instead of the project-specific `npm run preview:pages` would produce an app that looks and behaves identically for every manual check EXCEPT this exact not-found scenario, making the mistake very hard to notice without already knowing to suspect it."

- timestamp: 2026-08-28T00:00:00Z
  checked: "grep across .planning/ for `npm run preview` vs `npm run preview:pages` references (UAT tests 3/4/7, WINDOWS.md entries 1-6)"
  found: "Every documented reproduction/verification instruction consistently specifies `npm run preview:pages`, never bare `npm run preview`."
  implication: "The documented process is correct — the discrepancy originates in what was actually executed at verification time, not in the plan/UAT instructions themselves."

---
### Second investigation pass (this session) — the "wrong server" theory above is REFUTED by the user; picking up from here.

- timestamp: 2026-08-28T06:20:00Z
  checked: "grep of dist/assets/index-*.js (freshly rebuilt from current HEAD, commit 863b931) for the compiled dataUrl()/metaUrl() functions"
  found: "`function Wn(e){return \`/enquestes/data/${e}\`}` — import.meta.env.BASE_URL was statically inlined to the literal '/enquestes/' at build time, identical to every curl/fetch test's URL."
  implication: "Rules out a BASE_URL-resolution mismatch between the synthetic reproduction and the real bundled app — the runtime URL construction is provably identical."

- timestamp: 2026-08-28T06:25:00Z
  checked: "Live real Google Chrome (headless, actual Chrome 151 binary, not a Node proxy) executing a probe page served from the running preview:pages instance, running ExplorerPage.tsx's exact phase-2 fetch+classify code via the browser's own native fetch()"
  found: "Captured via --dump-dom: 'meta fetch resolved: status=404 ok=false type=basic redirected=false ... FINAL CLASSIFICATION=not-found'."
  implication: "The classification logic is correct against REAL Chrome fetch() semantics, not just curl/Node fetch as the first debug pass used — a genuine browser-fetch-behavior discrepancy is now ruled out directly, not just inferred."

- timestamp: 2026-08-28T06:35:00Z
  checked: "Full end-to-end real Google Chrome run against the actual app (dist/index.html temporarily patched with an <img src=\"/enquestes/_delay/Nms\"> to hold the page's load event open long enough for the real DuckDB-Wasm engine to genuinely initialize before --dump-dom captures state; server request log captured via a logging wrapper around the real gh-pages-preview.mjs handler)"
  found: "Full SPA-redirect dance observed (404 on /enquesta/no-existeix-aquesta -> redirect to /?/enquesta/no-existeix-aquesta -> 200 index.html -> assets -> duckdb-eh worker (200) -> duckdb-eh wasm (200, 652ms, genuinely compiled) -> meta.json fetch (404) -> parquet fetch (404) -> final rendered DOM shows 'No s'ha trobat aquesta enquesta.' with no retry button."
  implication: "The REAL end-to-end app, with a genuinely running DuckDB-Wasm engine (not a stub), correctly reaches the not-found branch. Repeated 4/4 times with zero variance — no race/timing-dependent misclassification found."

- timestamp: 2026-08-28T06:40:00Z
  checked: "git diff between commit 331116f (the fix) and current HEAD (863b931) for src/pages/ExplorerPage.tsx's error-copy constants, plus a direct comparison against the pre-fix version (commit fb6bc29)"
  found: "No commit after 331116f touched the error text (74880b9 only changed layout/sizing). Current LOAD_FAILED_TITLE = \"No s'han pogut carregar les dades d'aquesta enquesta.\" — a character-for-character match of the user's verbatim reported text. The PRE-fix version (fb6bc29) rendered a DIFFERENT combination for the same failure: ErrorState's default title \"No s'han pogut carregar les enquestes\" (plural/generic, no title prop was passed) with body message \"No s'han pogut carregar les dades de l'enquesta.\" (singular, no 'aquesta')."
  implication: "The user's exact reported text can only come from the POST-fix code (current HEAD's wording), never from a stale pre-331116f build. This independently and more strongly confirms what the first debug pass already suspected on weaker grounds: a stale dist/ is NOT the explanation. It also means the human was running current, correct code that genuinely evaluated dataState.kind as 'load-failed' for that request — the classification decision itself went the wrong way for them, in a way this investigation could not reproduce despite matching every documented condition."

- timestamp: 2026-08-28T06:42:00Z
  checked: "scripts/fixtures/ directory contents, and every npm script / documented instruction that invokes scripts/gh-pages-preview.mjs, for use of the --fixtures flag"
  found: "scripts/fixtures/enquestes/ contains only demo-2024_meta.json (nothing matching no-existeix-aquesta). --fixtures is never passed by npm run preview:pages, npm run verify:pages, or any .planning/ documented reproduction step — fixtures stays null, so the fixtures short-circuit branch in gh-pages-preview.mjs's handler is dead code in every documented usage."
  implication: "Rules out an accidental fixture-file match as the source of an unexpected 200 response."

- timestamp: 2026-08-28T06:43:00Z
  checked: "@duckdb/duckdb-wasm's shipped dist bundle and the app's own source tree for any service worker registration"
  found: "No `serviceWorker`/`navigator.serviceWorker` reference anywhere in src/, public/, or node_modules/@duckdb/duckdb-wasm/dist/*.js."
  implication: "Rules out a stale-cache-via-service-worker explanation entirely — there is no service worker in this app or its data engine dependency."

## Resolution

root_cause: |
  UPDATE (second pass): the first pass's AND-gate root cause below is
  REFUTED — the user explicitly confirmed they used `npm run preview:pages`,
  not plain `npm run preview`. It is preserved here for the record, but it
  is no longer the operative conclusion. See "Second-pass conclusion" after
  it for the current status.

  --- First-pass root cause (refuted) ---
  Two independent, co-occurring conditions (an AND-gate — see reasoning
  checkpoint) were believed to fully explain the reported regression:
  (1) (code) ExplorerPage.tsx's phase-2 not-found classification decides
  "this survey doesn't exist" solely based on `res.status === 404`, with
  no fallback for a server that doesn't return true 404s; (2) (environment)
  plain `npm run preview` (not `preview:pages`) blanket-200s every path,
  and shares the same default port, making the two commands easy to
  conflate. Directly confirmed by reproduction at the time — but the user
  has since confirmed condition (2) did not hold.

  --- Second-pass conclusion (current) ---
  NO CODE-LEVEL ROOT CAUSE FOUND, despite exhaustive reproduction attempts
  that go well beyond the first pass's curl/Node-fetch-only evidence:

  - A real Google Chrome browser (not curl, not Node) executing
    ExplorerPage.tsx's exact classification code against the live
    preview:pages server correctly classifies not-found.

  - A full, unmodified, end-to-end run of the real production app in real
    Chrome — genuine DuckDB-Wasm engine actually initializing, genuine
    Worker, genuine WASM compilation, genuine fetch() calls for both
    meta.json and the .parquet file — correctly reaches the not-found
    render. Repeated 4/4 times with zero variance; no race condition found.

  - The runtime URL construction (import.meta.env.BASE_URL -> literal
    '/enquestes/') is confirmed byte-identical between the built bundle and
    every synthetic test.

  - The user's verbatim reported text is a character-for-character match of
    the CURRENT (post-331116f) LOAD_FAILED_TITLE constant, not the
    differently-worded pre-fix generic error text — proving the human was
    running current, correct code, and that dataState.kind was genuinely
    (and incorrectly, for them) evaluated as 'load-failed' rather than
    'not-found'. This positively rules out a stale build.

  - No fixtures mechanism, no service worker, and no BASE_URL mismatch can
    explain an unexpected 200 for this path in this repository's current
    state.

  Because metaResult can only be classified as anything other than
  not-found if `fetch(metaUrl(id))` did NOT resolve with status 404 in the
  human's real session, and no mechanism in the current code + current
  preview:pages server + current dist/ can produce that outcome, the
  remaining explanation is necessarily something about the human's local
  disk/process state at the moment of UAT testing that this investigation
  cannot retroactively reconstruct or rule in/out — most plausibly one of:
  (a) a stray file at dist/data/enquestes/no-existeix-aquesta_meta.json (or
  an unusual scripts/fixtures/ setup) that briefly existed on their machine
  and has since been removed, or (b) a second/different server process
  actually answering port 4173 for that one request (a stale background
  preview:pages instance serving an older on-disk dist/ snapshot, distinct
  from the "wrong npm script" theory already refuted). Both are environment
  states, not code defects — no code change is indicated by this
  investigation's evidence.

fix: ""
verification: ""
files_changed: []

## Recommendation (find_root_cause_only — no fix applied)

Do not modify ExplorerPage.tsx's classification logic based on this
investigation: it has now been verified correct three independent ways
(curl, Node fetch, and genuine real-Chrome end-to-end execution with the
real DuckDB-Wasm engine, 4/4 clean runs). Before planning any code change:

1. Ask the user to re-run the exact repro (`npm run build && npm run
   preview:pages`, visit `/enquesta/no-existeix-aquesta`) in a **fresh
   terminal and a fresh/incognito browser tab**, and confirm whether the
   bug still reproduces now. If it does not reproduce, this was a
   transient local-state issue at UAT time (candidate causes above) and
   G-03-6 should be closed as not-a-bug / could-not-reproduce.

2. If it still reproduces for the user: ask them to open browser DevTools
   Network tab, filter for `no-existeix-aquesta_meta.json`, and report the
   actual HTTP status code and response body they see. That single
   observation will immediately confirm or refute the "metaResult
   fulfilled with 200" mechanism this investigation deduced but could not
   directly witness on their machine, and would be the fastest path to
   a confirmed root cause if the bug is genuinely still live for them.

3. Optional defensive hardening (not required by evidence found here, but
   flagged by both debug passes as a good belt-and-suspenders investment
   regardless of root cause): make the not-found classification resilient
   to a host that doesn't return true 404s, e.g. by also treating a
   non-JSON content-type or a schema-validation failure (parseEnquestaMeta
   throwing) on an ostensibly-200 meta response as further evidence toward
   not-found, not exclusively trusting res.status === 404.
