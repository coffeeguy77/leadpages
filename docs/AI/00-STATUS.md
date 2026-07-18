# 00 — LeadPages Brain: Current Status (AI agents)

**Document:** `AI/00-STATUS`  
**Status:** Canonical — update this when Brain phases or migration flags change  
**Audience:** AI coding agents and engineers  
**Last updated:** 2026-07-18  

> **Read this first** for any AI / Brain / Anthropic / OpenAI / Gemini / assist / landing-draft work.  
> Detail lives in the rest of `docs/AI/*`. Feature manuals under `docs/features/` may lag — trust this file + source when they conflict.

---

## One-line summary

**Phases 0–9 are shipped.** Brain runtime (`lib/brain/`), Control Centre, landing drafts, Marketing Hub, and flag-gated migrations for IG / suburb / assist / packs. **Website Studio** is the user-facing full-site product (legacy routes `/theme-studio-v2`); **AI Colour Assistant** remains separate at `/theme-studio`. Architecture reset: `docs/website-studio/`. Legacy paths remain when migration flags are off.

---

## What exists in code

| Area | Location | Notes |
|------|----------|-------|
| Brain gateway | `lib/brain/` | `createBrain`, `generate`, `generateStructured` |
| Platform singleton | `lib/brain/platform.js` | `getPlatformBrain()`, usage + migration flags |
| Adapters | `lib/brain/adapters/` | `mock`, `anthropic`, `openai`, `gemini` (raw `fetch`, no SDKs) |
| Prompts | `lib/brain/prompts/` | File-based registry; `{{var}}` render |
| Context slices | `lib/brain/context/` | Includes `ads.summary` (redacted; no OAuth tokens) |
| Control Centre UI | `brain-admin.html` → `/brain-admin` | Super-admin; Ops Command panel “AI Brain” |
| Durable Brain settings | `db/brain_settings.sql` + `lib/brain/settings-store.js` | Landing provider saved from Control Centre (no env var) |
| Landing draft API | `api/brain/landing-draft.js` | Flag `BRAIN_LANDING_DRAFT`; loads saved provider |
| AI Colour Assistant | `/theme-studio` + `api/brain/theme-*.js` | Colour tokens only |
| Website Studio (legacy paths) | `/theme-studio-v2` + `api/theme-studio/*` + `lib/theme-studio/` | Prototype full-site concepts; product docs → [website-studio](../website-studio/README.md) |
| Website Studio architecture | `docs/website-studio/` | **Phase 1 reset** — docs/naming only; stop before feature code |
| Marketing Hub | `marketing-hub.html` + `api/brain/ads-*.js` | Phase 9 — suggest only; approve stores, no Ads mutate |
| Tests | `tests/brain-*.test.js` | No live network; injected `fetch` / mock |

---

## Phase checklist

| Phase | Focus | Status |
|-------|-------|--------|
| 0 | Docs + approval | Done |
| 1 | Mock gateway | Done |
| 2 | Anthropic adapter | Done |
| 3 | Prompts + context | Done |
| 4 | Retries / flags / budgets | Done |
| 5 | OpenAI + Gemini | Done |
| 6 | Control Centre | Done (+ durable `ai_requests` when SQL applied) |
| 7 | Landing draft migration | Done — **flag default OFF** |
| 8 | Website Studio / Colour Assistant | Colour = AI Colour Assistant; full site = Website Studio (architecture reset in progress) — [website-studio](../website-studio/README.md) |
| 9 | Marketing Hub product | **Done** — [22](22-MARKETING-HUB.md) |

Roadmap detail: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md).

---

## Env flags agents must know

| Env | Default | Meaning |
|-----|---------|---------|
| `BRAIN_PROVIDER` | `mock` | Route tasks to `mock` / `anthropic` / `openai` / `gemini` |
| `BRAIN_LANDING_DRAFT` | unset (off) | `1` → `POST /api/brain/landing-draft` |
| `BRAIN_IG_ENRICH` | unset (off) | `1` → IG caption enrich via Brain |
| `BRAIN_SUBURB_INTRO` | unset (off) | `1` → suburb intros via Brain |
| `BRAIN_HELP_ASSIST` | unset (off) | `1` → `/api/assist` via Brain |
| `BRAIN_TRADE_PACK` | unset (off) | `1` → trade packs via Brain |
| `BRAIN_THEME_STUDIO` | on (`1`) | `0` disables AI Colour Assistant APIs |
| `THEME_STUDIO_V2` | on (`1`) | `0` disables Website Studio APIs (legacy env name) |
| `BRAIN_MARKETING_HUB` | on (`1`) | `0` disables Marketing Hub APIs |
| `BRAIN_LANDING_PROVIDER` | — | Optional env override; prefer **AI Control Centre → Save provider** (durable `brain_settings`) |
| `ANTHROPIC_API_KEY` | — | Anthropic adapter / legacy callers |
| `OPENAI_API_KEY` | — | OpenAI adapter |
| `GEMINI_API_KEY` | — | Gemini adapter (alias `GOOGLE_AI_API_KEY`) |
| `BRAIN_DISABLE_TASKS` | — | CSV of task IDs to disable |
| `BRAIN_MAX_RETRIES` | `1` | Retryable provider errors |
| `BRAIN_MAX_OUTPUT_TOKENS` | `16000` | Soft per-call output budget |

---

## Migration matrix

| Feature | Path | Through Brain? |
|---------|------|----------------|
| Landing page AI draft | `POST /api/brain/landing-draft` | **Yes** when `BRAIN_LANDING_DRAFT=1` |
| Help assist | `api/assist.js` | **Yes** when `BRAIN_HELP_ASSIST=1` (else Anthropic) |
| Suburb intros | `lib/seo/suburbIntro.js` | **Yes** when `BRAIN_SUBURB_INTRO=1` (else Anthropic) |
| Trade packs | `lib/trade-pack-utils.js` `callClaude` | **Yes** when `BRAIN_TRADE_PACK=1` (else Anthropic) |
| IG caption enrich | `lib/ig/enrich.mjs` | **Yes** when `BRAIN_IG_ENRICH=1` (else Anthropic) |
| AI Colour Assistant | `/theme-studio` → `theme.*` tasks | **Yes** (product default on) |
| Website Studio | `/theme-studio-v2` → `api/theme-studio/*` | **Yes** (legacy paths; flag `THEME_STUDIO_V2`) |
| Marketing Hub | `/marketing-hub` → `ads.*` tasks | **Yes** (product default on; no Ads mutate) |

Order / rollback: [16-MIGRATION-PLAN](16-MIGRATION-PLAN.md).

---

## Rules for AI agents working on AI features

1. **New AI features call Brain** — never import provider SDKs; never call Anthropic/OpenAI/Gemini from the browser.  
2. **Migration flags default off** until soak; Colour Assistant / Website Studio / Marketing Hub default on (set `=0` to disable).  
3. **AI suggests → user approves → publish/config write** — Marketing Hub approve **stores** suggestions only; never mutates Google Ads.  
4. **Control Centre / Website Studio / Colour Assistant / Marketing Hub** — never expose keys; Ads context is redacted.  
5. **Usage ledger** — prefer durable `ai_requests` (run `db/ai_requests.sql`).  
6. **Prefer `getPlatformBrain()`** in API routes.  
7. AI Colour Assistant writes **trade theme tokens only** (`pipe`, `hivis`, `steel`, `safety`, `lightBg`) — not freeform HTML/CSS.  
8. **Website Studio feature work** requires roadmap approval — [ROADMAP](../website-studio/ROADMAP.md). Do not implement Composer / Image Service / Marketplace Intelligence without approval.

---

## Where to read next

| Need | Doc |
|------|-----|
| Overview | [README](README.md) |
| Website Studio (canonical) | [docs/website-studio](../website-studio/README.md) |
| AI Colour Assistant (stub) | [21-THEME-STUDIO](21-THEME-STUDIO.md) |
| Archived Theme Studio docs | [archive/theme-studio](../archive/theme-studio/README.md) |
| Marketing Hub | [22-MARKETING-HUB](22-MARKETING-HUB.md) |
| How to call Brain | [19-DEVELOPER-GUIDE](19-DEVELOPER-GUIDE.md) |
| Migration order | [16-MIGRATION-PLAN](16-MIGRATION-PLAN.md) |
