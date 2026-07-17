# 00 — LeadPages Brain: Current Status (AI agents)

**Document:** `AI/00-STATUS`  
**Status:** Canonical — update this when Brain phases or migration flags change  
**Audience:** AI coding agents and engineers  
**Last updated:** 2026-07-17  

> **Read this first** for any AI / Brain / Anthropic / OpenAI / Gemini / assist / landing-draft work.  
> Detail lives in the rest of `docs/AI/*`. Feature manuals under `docs/features/` may lag — trust this file + source when they conflict.

---

## One-line summary

**Phases 0–7 are shipped.** Brain runtime exists (`lib/brain/`). Control Centre exists (`/brain-admin`). Landing AI drafts go through the server behind a flag. Most legacy features still call Anthropic directly.

---

## What exists in code

| Area | Location | Notes |
|------|----------|-------|
| Brain gateway | `lib/brain/` | `createBrain`, `generate`, `generateStructured` |
| Platform singleton | `lib/brain/platform.js` | `getPlatformBrain()`, usage store wiring |
| Adapters | `lib/brain/adapters/` | `mock`, `anthropic`, `openai`, `gemini` (raw `fetch`, no SDKs) |
| Prompts | `lib/brain/prompts/` | File-based registry; `{{var}}` render |
| Context slices | `lib/brain/context/` | Auth + redaction; caller supplies `site` row |
| Resilience | `lib/brain/resilience.js` | Retries, flags, soft budgets |
| Control Centre UI | `brain-admin.html` → `/brain-admin` | Super-admin; Ops Command panel “AI Brain” |
| Control Centre API | `api/brain/control.js` | Health, routes, usage buffer, probes |
| Landing draft API | `api/brain/landing-draft.js` | Site-access gated |
| Editor caller | `manage.html` → `aiGenerate()` | Calls `/api/brain/landing-draft` (not browser→Anthropic) |
| Tests | `tests/brain-*.test.js` | No live network; injected `fetch` |

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
| 6 | Control Centre | Done (usage buffer in-memory only) |
| 7 | Landing draft migration | Done — **flag default OFF** |
| 8 | Theme Studio product | Spec stub only — [21](21-THEME-STUDIO.md) |
| 9 | Marketing Hub product | Spec stub only — [22](22-MARKETING-HUB.md) |

Roadmap detail: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md).

---

## Env flags agents must know

| Env | Default | Meaning |
|-----|---------|---------|
| `BRAIN_PROVIDER` | `mock` | Route tasks to `mock` / `anthropic` / `openai` / `gemini` |
| `BRAIN_LANDING_DRAFT` | unset (off) | Set `1` to enable `POST /api/brain/landing-draft` |
| `ANTHROPIC_API_KEY` | — | Required for Anthropic adapter / legacy callers |
| `OPENAI_API_KEY` | — | OpenAI adapter |
| `GEMINI_API_KEY` | — | Gemini adapter (alias `GOOGLE_AI_API_KEY`) |
| `BRAIN_DISABLE_TASKS` | — | CSV of task IDs to disable |
| `BRAIN_MAX_RETRIES` | `1` | Retryable provider errors |
| `BRAIN_MAX_OUTPUT_TOKENS` | `16000` | Soft per-call output budget |

---

## Migration matrix (what still bypasses Brain)

| Feature | Path today | Through Brain? |
|---------|------------|----------------|
| Landing page AI draft | `manage.html` → `POST /api/brain/landing-draft` (prompt **v3**: full SEO fields + ~1000w + FAQ/CTA) | **Yes** (when `BRAIN_LANDING_DRAFT=1`) |
| Help assist | `api/assist.js` → Anthropic | No |
| Suburb intros | `lib/seo/suburbIntro.js` → Anthropic | No |
| Trade packs | `lib/trade-pack-utils.js` → Anthropic | No |
| IG caption enrich | `lib/ig/enrich.mjs` → Anthropic | No |
| Legacy `api/manage.html` paste | Manual Claude | No (stale twin) |

Order for next migrations: [16-MIGRATION-PLAN](16-MIGRATION-PLAN.md).

---

## Rules for AI agents working on AI features

1. **New AI features call Brain** — never import provider SDKs; never call Anthropic/OpenAI/Gemini from the browser.  
2. **Do not migrate assist / suburb / packs** without explicit approval (landing draft was the approved first migration).  
3. **AI suggests → user approves → publish** — especially Ads and config writes.  
4. **Control Centre is super-admin only** — never expose keys; UI shows configured + last-four only.  
5. **Usage store is process-local** — do not assume durable history until `ai_requests` exists.  
6. **Prefer `getPlatformBrain()`** in API routes so Control Centre usage recording works.  
7. If a feature doc still says “browser calls Anthropic”, treat it as **stale** — check this file and `manage.html` / `api/brain/*`.

---

## Where to read next

| Need | Doc |
|------|-----|
| Overview | [README](README.md) |
| Legacy inventory | [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md) |
| How to call Brain | [19-DEVELOPER-GUIDE](19-DEVELOPER-GUIDE.md) |
| Landing pages feature | [features/Pages](../features/Pages.md) |
| SEO / suburb AI | [features/SEO](../features/SEO.md) |
| Editor shell | [features/Editor](../features/Editor.md) |
