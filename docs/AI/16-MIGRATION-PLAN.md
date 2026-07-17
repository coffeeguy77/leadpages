# 16 — Migration Plan

**Document:** `AI/16-MIGRATION-PLAN`  
**Status:** Proposed — **no migrations executed in docs phase**  
**Prerequisites:** [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)

---

## Order (safest first)

| Order | Integration | Risk | Adapter needs | Schema | Context | Why this order |
|-------|-------------|------|---------------|--------|---------|----------------|
| 1 | Landing `aiGenerate` → server Brain | Low | text generate | Optional `{bodyMarkdown}` | site.identity, trade | Already broken client-side; clear win; approve UI exists |
| 2 | IG caption enrich | Low–med | structured JSON | `{title,service,location}` | caption only | Small JSON; failure already null-safe |
| 3 | Suburb intros | Low–med | text + cache | none | identity + suburb | Keep `suburb_intros` cache; add rate/budget |
| 4 | Help assist | Med | text/stream | none | wiki slices + role | History + RLS coupling |
| 5 | Trade pack acquire + shared `callClaude` | High | large structured | pack schema | trade name/category | Complex validate/retry; business gates |
| 6 | Legacy `api-trade-generate` | Med | same as packs | pack schema | trade | Tighten auth while migrating |
| 7 | Retire stale `api/manage.html` manual prompt | Low | n/a | n/a | n/a | Consolidate prompts |

---

## Per-integration template

### Landing draft (first)

| Item | Detail |
|------|--------|
| Current | `manage.html` `aiGenerate` → Anthropic without key |
| Target | `POST` feature route → Brain `content.landing_draft` |
| Flag | `ai.brain.landing_draft` |
| Tests | Mock Brain; UI approve path unchanged |
| Rollback | Flag off → keep disabled or legacy message |

### Suburb intros

| Item | Detail |
|------|--------|
| Current | `lib/seo/suburbIntro.js` |
| Target | Brain task `seo.suburb_intro`; preserve cache |
| Rollback | Direct Anthropic function behind flag |

### Trade packs

| Item | Detail |
|------|--------|
| Current | `lib/trade-pack-utils.js` `callClaude` |
| Target | Brain `pack.trade_generate` with existing `validatePack` as schema layer |
| Rollback | `callClaude` retained until flag default-on proven |

---

## Global rules

- One feature at a time  
- Feature flag default off until soak  
- No behaviour change for non-AI paths  
- Do not migrate Theme Studio / Marketing Hub (they do not exist yet)

---

## Related

- Roadmap Phase 7: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)
