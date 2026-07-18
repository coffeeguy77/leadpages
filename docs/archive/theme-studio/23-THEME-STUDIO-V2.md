# 23 — Theme Studio V2

**Document:** `AI/23-THEME-STUDIO-V2`  
**Status:** Phases 1–10 implemented (V1 product surface). Colour MVP retained as AI Colour Assistant.  
**Audience:** Product + engineering  
**Related:** [THEME-STUDIO-IMPLEMENTATION-AUDIT](THEME-STUDIO-IMPLEMENTATION-AUDIT.md), [21-THEME-STUDIO](21-THEME-STUDIO.md), [00-STATUS](00-STATUS.md)

---

## How to test (URLs)

| Surface | URL | What it does |
|---------|-----|----------------|
| **Theme Studio V2** | **`/theme-studio-v2`** | Full product: brief → generate → preview → refine → apply/save |
| Ops Command panel | `/command` → **Theme Studio** | Embeds `/theme-studio-v2` |
| AI Colour Assistant | `/theme-studio` or `/theme-studio/colours` | Colour tokens only (former Theme Studio) |

Phases 1–2 were library-only (no UI). They are covered by `tests/theme-studio-phase1-2.test.js`.  
V2 product tests: `tests/theme-studio-v2-product.test.js`.

**Access:** Superusers and partners only (`canAccessThemeStudio`). Clients are denied server-side.

**SQL (production):** run `db/theme_studio.sql` in Supabase. Without it, APIs fall back to an in-memory store (fine for local/dev; not durable).

**Flags:**

| Env | Default | Meaning |
|-----|---------|---------|
| `THEME_STUDIO_V2` | on | Disable with `=0` |
| `THEME_STUDIO_ALLOW_LIVE_APPLY` | off | Live site writes require `=1` + `confirmLive` |
| `THEME_STUDIO_MEMORY_STORE` | off | Force memory store |
| `BRAIN_THEME_STUDIO` | on | Colour assistant APIs |

---

## Product flow

1. Create draft workspace (brief + optional source snapshot)  
2. Generate 3 concepts (deterministic foundation adapter; Brain when structured output validates)  
3. Preview via signed token + real trade renderer HTML (forms/tracking sandboxed, noindex)  
4. Select concept  
5. Refine → new version  
6. Quality report (advisory)  
7. Apply to draft workspace / non-live demo site, or save My Template  
8. Live production apply remains **disabled** unless `THEME_STUDIO_ALLOW_LIVE_APPLY=1`

---

## Code map

| Area | Path |
|------|------|
| Core | `lib/theme-studio/*` |
| APIs | `api/theme-studio/*` |
| UI | `theme-studio-v2.html` |
| DB | `db/theme_studio.sql` |
| Brain routes/prompts | `theme_studio.*` in `lib/brain/config.js` + `prompts/defaults.js` |
| Colour assistant | `theme-studio.html` + `api/brain/theme-*.js` |

### API endpoints

- `GET/POST /api/theme-studio/foundations`  
- `GET/POST/PATCH /api/theme-studio/drafts`  
- `POST /api/theme-studio/generate-concepts`  
- `POST /api/theme-studio/select-concept`  
- `POST/GET /api/theme-studio/preview` (mint signed token / render)  
- `POST /api/theme-studio/refine`  
- `POST /api/theme-studio/quality`  
- `POST /api/theme-studio/apply`  
- `POST /api/theme-studio/save-template`  

---

## Preview security (implemented)

- Draft config snapshot rendered through `trade.template.json` (same template as `api/render.js`)  
- Short-lived HMAC token (`THEME_STUDIO_PREVIEW_SECRET` or service role key)  
- `noindex` / `no-store`  
- Form submit blocked; outbound link navigation blocked  
- Analytics / pixels / form destinations stripped from preview config  
- Tenant check when minting tokens (draft ownership)

---

## Confirmations

- Generation, refine, preview, select do **not** write live `sites`  
- Apply default: draft workspace + optional non-live demo/draft site  
- Colour MVP not merged into V2 UI  
- Provider calls optional — deterministic path works with `BRAIN_PROVIDER=mock`  

---

## Known limitations

- Preview is trade-template HTML injection, not a full `api/render.js` tenant resolve (same template assets)  
- Brain structured outputs for full concepts often fall back to deterministic builder under mock  
- Marketplace “submit for review” stores `visibility=submitted` only — no catalog publish pipeline yet  
- Partner access is API-enforced; Ops Command hub remains super-gated for the iframe shell  
