# 17 — Implementation Roadmap

**Document:** `AI/17-IMPLEMENTATION-ROADMAP`  
**Status:** Proposed  
**Prerequisites:** Entire `docs/AI/*` set  

> No calendar estimates. Phases are approval-gated.

---

## Phase 0 — Documentation and approval ✅

| | |
|--|--|
| Objectives | Audit repo; publish Brain docs; owner approval |
| Deliverables | `docs/AI/*`, INDEX links |
| Excluded | Any production code / SDKs / migrations |
| Done when | Owners accept architecture + first migration choice |

---

## Phase 1 — Core foundation ✅

| | |
|--|--|
| Objectives | Internal interfaces, mock provider, errors, request IDs, config validation, tests |
| Deliverables | `lib/brain/*`, mock adapter, `tests/brain-phase1.test.js` |
| Dependencies | Phase 0 approval |
| Risks | Overengineering — keep thin |
| Gate | Tests green; no provider keys required in CI |
| Excluded | Real Anthropic calls; Control Centre UI |
| Status | **Complete** — `createBrain()` / `generate` / `generateStructured` with mock adapter |

---

## Phase 2 — First provider ✅

| | |
|--|--|
| Objectives | Anthropic adapter (matches current production) |
| Deliverables | `lib/brain/adapters/anthropic.js`; normalised usage/errors; structured JSON via prompt+parse; health check; `BRAIN_PROVIDER` routing |
| Dependencies | Phase 1 |
| Gate | Contract tests with injected `fetch` fixtures (`tests/brain-anthropic.test.js`) |
| Excluded | OpenAI/Gemini; feature migrations; live CI calls to Anthropic |
| Status | **Complete** — raw Messages API adapter; default routes remain mock unless `BRAIN_PROVIDER=anthropic` |

**Recommended first provider:** Anthropic — sole verified production provider today.

---

## Phase 3 — Prompt and context ✅

| | |
|--|--|
| Objectives | Prompt registry + versions; business context resolver (minimal slices) |
| Deliverables | `lib/brain/prompts/*` (file-based, versioned); `lib/brain/context/*` (slice extract + auth + redaction); gateway wiring |
| Gate | Snapshot render tests; tenant isolation tests (`tests/brain-phase3.test.js`) |
| Excluded | Prompt DB tables; automatic site fetch from Supabase |
| Status | **Complete** — caller supplies preloaded `site`; features opt in via `promptId` / `contextSlices` |

---

## Phase 4 — Routing and resilience ✅

| | |
|--|--|
| Objectives | Task router, timeouts, retries, fallbacks, flags, soft cost controls |
| Deliverables | `lib/brain/resilience.js`; gateway retries; `flags.disabledTasks` / `route.enabled`; soft `budgets` + `onBudgetCheck` |
| Gate | Chaos-style tests with mock failures (`tests/brain-phase4.test.js`) |
| Status | **Complete** — timeouts/fallbacks already in Phase 1; Phase 4 adds retries + flags + soft budgets |

---

## Phase 5 — Additional providers ✅

| | |
|--|--|
| Objectives | OpenAI and/or Gemini adapters; capability matrix |
| Deliverables | `lib/brain/adapters/openai.js`, `gemini.js`; `BRAIN_PROVIDER` multi-provider routing |
| Gate | Comparative contract tests (`tests/brain-phase5.test.js`) |
| Status | **Complete** — raw fetch, no SDKs |

---

## Phase 6 — Control Centre ✅

| | |
|--|--|
| Objectives | Superuser ops UI for routes/usage/flags/health |
| Deliverables | `brain-admin.html`, `GET/POST /api/brain/control`, Ops Command panel, in-memory usage store |
| Gate | Secrets never echoed (configured + last-four only) |
| Status | **Complete** — usage buffer is process-local (not durable) |

---

## Phase 7 — First migration ✅

| | |
|--|--|
| Objectives | Migrate **landing page AI draft** behind flag |
| Deliverables | `POST /api/brain/landing-draft`; manage.html → server; `BRAIN_LANDING_DRAFT=1` |
| Gate | Flag default off; approve UI unchanged; rollback = unset env |
| Excluded | Pack/assist/suburb until after soak |
| Status | **Complete** (flag off until soak) |

---

## Phase 8 — AI Theme Studio

**Status: Colour MVP shipped; V2 Phases 1–2 foundations shipped (library only).**

| Item | Detail |
|------|--------|
| Colour MVP | `theme.generate` / `theme.refine` → `/theme-studio` (to become **AI Colour Assistant**) |
| V2 Phases 1–2 | Foundation registry, concept schema, validator, adapter — [23-THEME-STUDIO-V2](23-THEME-STUDIO-V2.md) |
| Full vision | Complete website design system — **not** colour-only |
| Canonical plan | [THEME-STUDIO-IMPLEMENTATION-AUDIT](THEME-STUDIO-IMPLEMENTATION-AUDIT.md) |
| Gate | Stop before Phase 3 (UI / drafts / previews / apply) without further approval |

---

## Phase 9 — AI Marketing Hub

**Status: Complete.** Spec: [22-MARKETING-HUB](22-MARKETING-HUB.md).

| Item | Detail |
|------|--------|
| Tasks | `ads.campaign_plan`, `ads.rsa_copy` |
| UI | `/marketing-hub` (+ Ops Command panel) |
| APIs | `POST /api/brain/ads-campaign-plan\|ads-rsa-copy\|ads-approve` |
| Write | Approve stores under `sites.config.marketingHub` — **does not** call Google Ads mutate APIs |
| Context | `ads.summary` slice (redacted; no OAuth tokens in prompts) |
| Flag | `BRAIN_MARKETING_HUB` (default on) |

---

## Related

- Risks: [18-RISKS-AND-DECISIONS](18-RISKS-AND-DECISIONS.md)
