# 16 — Migration Plan

**Document:** `AI/16-MIGRATION-PLAN`  
**Status:** Landing + remaining AI call sites flag-gated; Theme Studio / Marketing Hub are new Brain products  
**Prerequisites:** [01-CURRENT-STATE-AUDIT](01-CURRENT-STATE-AUDIT.md)

---

## Order (safest first)

| Order | Integration | Flag | Status |
|-------|-------------|------|--------|
| 1 | Landing `aiGenerate` → Brain | `BRAIN_LANDING_DRAFT` | Done (default off) |
| 2 | IG caption enrich | `BRAIN_IG_ENRICH` | Done (default off) |
| 3 | Suburb intros | `BRAIN_SUBURB_INTRO` | Done (default off) |
| 4 | Help assist | `BRAIN_HELP_ASSIST` | Done (default off) |
| 5 | Trade pack `callClaude` | `BRAIN_TRADE_PACK` | Done (default off) |
| 6 | Legacy `api-trade-generate` | shares pack flag via `callClaude` | Covered |
| 7 | Retire stale `api/manage.html` manual prompt | n/a | Still optional cleanup |

---

## Per-integration notes

### Landing draft — DONE

| Item | Detail |
|------|--------|
| Flag | `BRAIN_LANDING_DRAFT=1` (default **off**) |
| Rollback | Unset flag → API 503 |

### IG enrich — DONE

| Item | Detail |
|------|--------|
| Path | `lib/ig/enrich.mjs` |
| Flag | `BRAIN_IG_ENRICH=1` |
| Rollback | Unset → direct Anthropic (null-safe) |

### Suburb intros — DONE

| Item | Detail |
|------|--------|
| Path | `lib/seo/suburbIntro.js` |
| Flag | `BRAIN_SUBURB_INTRO=1` |
| Cache | Still `suburb_intros` via `saveIntro` |
| Rollback | Unset → direct Anthropic |

### Help assist — DONE

| Item | Detail |
|------|--------|
| Path | `api/assist.js` |
| Flag | `BRAIN_HELP_ASSIST=1` |
| Safety | Still fetches wiki via caller RLS before prompting |
| Rollback | Unset → direct Anthropic |

### Trade packs — DONE

| Item | Detail |
|------|--------|
| Path | `lib/trade-pack-utils.js` `callClaude` |
| Flag | `BRAIN_TRADE_PACK=1` |
| Validation | Existing `parseAiJson` + `validatePack` |
| Rollback | Unset → direct Anthropic |

---

## Global rules

- Feature flag default **off** for migrations until soak  
- Theme Studio / Marketing Hub are **new products** (default on; `=0` to disable) — not migrations of old callers  
- No behaviour change for non-AI paths when flags are off  
- AI suggests → user approves before publish / theme write / Ads mutate

---

## Related

- Status: [00-STATUS](00-STATUS.md)  
- Roadmap: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)
