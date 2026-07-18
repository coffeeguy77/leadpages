# Website Studio — Pilot Issues Register

**Pilot:** Bean Culture Coffee Roastery (new draft site only)  
**Updated:** 2026-07-18 (Phase 6)

Severity: critical · high · medium · low  
All critical/high must be resolved before partner rollout recommendation.

---

## PILOT-001 — Memory-only application audit / idempotency

| Field | Value |
|-------|-------|
| Severity | critical |
| Stage | Application |
| Description | Phase 5 audit + idempotency lived in process memory and would not survive serverless restarts |
| Reproduction | Create site → cold start → retry same idempotency key → duplicate risk |
| Expected | Durable audit + idempotency across invocations |
| Actual (before) | Memory Maps only |
| Root cause | Phase 5 deferred persistence |
| Fix | `db/website_studio_application.sql` + persistent `audit.js` with durable-memory/Supabase |
| Test | `tests/website-studio-phase6.test.js` restart simulation |
| Status | **resolved** |

---

## PILOT-002 — Mock-only Cloudinary import path

| Field | Value |
|-------|-------|
| Severity | critical |
| Stage | Images / Application |
| Description | Application could leave Pexels delivery URLs or rely on mockImport |
| Reproduction | Approve Pexels image → create site without execute import |
| Expected | Server-side import to `leadpages/{site}/website-studio/…` with attribution |
| Actual (before) | Plan-only / mock |
| Root cause | Phase 5 deferred binary upload |
| Fix | `importRemoteAsset` + `execute:true` on `/api/image-service/import-cloudinary` + application `executeImport` |
| Test | Phase 6 Cloudinary mapping tests |
| Status | **resolved** (requires Cloudinary credentials in pilot env for live upload) |

---

## PILOT-003 — Partner access still open on Studio while pilot is superuser-only

| Field | Value |
|-------|-------|
| Severity | high |
| Stage | Permissions |
| Description | V1 ROLE_POLICY allowed partners into Website Studio |
| Expected | Superuser-only pilot |
| Actual (before) | Partners allowed when Studio enabled |
| Fix | `WEBSITE_STUDIO_PILOT_SUPERUSER_ONLY=1` → `effectiveRolePolicy()` |
| Test | Phase 6 pilot flags suite |
| Status | **resolved** |

---

## PILOT-006 — Generate / Regenerate concepts returns HTTP 500

| Field | Value |
|-------|-------|
| Severity | critical |
| Stage | Compare concepts |
| Description | "Generate 3 concepts" and "Regenerate all" showed bare `HTTP 500` (empty/non-JSON error body) |
| Reproduction | Brief → Compare → Generate 3 concepts (or Regenerate all) — e.g. Pink Diamond Vault |
| Expected | Three draft concepts with clear JSON errors on failure |
| Actual (before) | Uncaught `ReferenceError: RENDERER_SHELL_LANDING_V1 is not defined` (and related merge regressions) → platform/empty 500 |
| Root cause | Merging `main` into Phase 6 overwrote Website Composer with an older sync compose path that referenced an unimported shell id and reintroduced trade content leakage / broken preview helpers. Separate gaps: no API try/catch, Pexels latency, Brain on critical path. |
| Fix | Restore Phase 4/6 Composer + preview stack (`compose.js`, `content.js`, foundations/recipes, `render-preview.js`, etc.); keep generate-concepts try/catch + Composer-only path + Pexels timeouts; UI surfaces details |
| Test | `tests/theme-studio-generate-concepts.test.js`, `tests/website-composer.test.js`, `tests/website-studio-phase4.test.js` |
| Status | **resolved** (code) — re-verify on deployed pilot after this restore |

---

## PILOT-007 — Preview iframe FUNCTION_INVOCATION_FAILED

| Field | Value |
|-------|-------|
| Severity | critical |
| Stage | Preview |
| Description | After concepts generate, Desktop/Mobile preview iframe shows Vercel `FUNCTION_INVOCATION_FAILED` |
| Reproduction | Generate concepts → open Preview → iframe `/api/theme-studio/preview?token=…` |
| Expected | Neutral-shell HTML preview |
| Actual | Serverless crash (empty/HTML error page) |
| Root cause | `render-preview.loadShellHtml` used dynamic `require(path.join(...))`; Vercel NFT did not bundle `landing-shell-neutral-v1.template.json` / `trade.template.json` |
| Fix | Static `require()` of both shells (same pattern as `api/render.js`); preview try/catch + `includeFiles` |
| Test | product/preview render suite + explicit shell loader assertion |
| Status | **resolved** (code) — needs production deploy |

---

## PILOT-008 — Preview shows plumbing hero for non-trade drafts

| Field | Value |
|-------|-------|
| Severity | critical |
| Stage | Preview renderer / content mapping |
| Description | Pink Diamond Vault (and other non-trade briefs) preview showed “WE'LL CLEAR IT TODAY” / burst pipes |
| Trace | Brief → Composer (correct) → draftConfig hero title/sub (correct) → adapter (correct) → **neutral shell** → Preview HTML |
| Where plumbing entered | `landing-shell-neutral-v1.template.json` static hero mount + broken `applyCfg` (`hivis` theme token over-stripped → `setv(th.,…)` SyntaxError) so draft hero never replaced defaults; `replaceAll('__SITE_CONFIG__')` also corrupted `window.__SITE_CONFIG__` boot scripts |
| Fix | Rebuild neutral shell preserving `hivis`; scrub plumbing residual; safe SITE_CONFIG inject; hide inactive sections; validation page if hero missing — **Website Studio preview only**; `trade.template.json` / live `api/render.js` untouched |
| Test | `tests/website-studio-preview-no-trade-leak.test.js` (jewellery, coffee, lawyer, hair salon + Chrome dump-dom) |
| Status | **resolved** (code) — needs production deploy |

---

## PILOT-004 — Live interactive Bean Culture browser session

| Field | Value |
|-------|-------|
| Severity | high |
| Stage | End-to-end pilot |
| Description | Full Chrome desktop/mobile/tablet session against production Supabase + Cloudinary must be run by an authenticated superuser in the pilot environment |
| Expected | Manual checklist completion in PILOT-CHECKLIST.md |
| Actual | Automated orchestration + composition coverage in CI; live browser session is environment-bound |
| Root cause | Cloud agent has no production superuser session / Cloudinary secrets |
| Fix | Checklist + brief template + automated path; ops completes live UI pass |
| Test | Automated path green; checklist pending human sign-off |
| Status | **open** (ops) — blocks “partner pilot ready”, not “superuser pilot ready” |

---

## PILOT-005 — Form notification live send

| Field | Value |
|-------|-------|
| Severity | high |
| Stage | Forms |
| Description | Live lead notification to designated test recipient requires deployed site + mail pipeline |
| Expected | Test lead created + notification via existing system |
| Actual | Application asserts explicit recipient on draft config; live submit verified in checklist |
| Fix | Documented in PILOT-CHECKLIST; config asserts `notifyEmail` |
| Test | Phase 6 create-site asserts recipient |
| Status | **open** (ops live submit) |

---

## Summary

| Status | Count |
|--------|------:|
| resolved | 6 |
| open (ops) | 2 |
| critical open (code) | 0 |
