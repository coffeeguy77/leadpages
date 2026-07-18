# Website Studio — Current State Report

**Updated:** 2026-07-18 (Phase 2 Website Composer)  
**Scope:** Website Studio + AI Colour Assistant + Composer.

---

## 1. What currently works

### AI Colour Assistant (`/theme-studio`)

| Capability | Status |
|------------|--------|
| Generate / refine / approve colour tokens | Works |
| Separate from Website Studio | Yes |

### Website Studio UI (`/theme-studio-v2`, legacy path)

| Capability | Status |
|------------|--------|
| Draft workspace + versions | Works |
| Generate → preview → refine → approve | Works (generation via Composer) |
| Signed draft preview | Works (landing shell HTML) |
| Live apply | Gated off by default |

### Website Composer (`lib/website-composer/`) — Phase 2 ✅

| Capability | Status |
|------------|--------|
| Business classification | Works |
| Structural foundations (16 categories) | Works — **no** `sourceTemplateId: trade` |
| Marketplace recipes (independent) | Works |
| Explicit draft composition | Works — `contentInheritance: none` |
| Full section population + disable unused | Works |
| Section provenance | Works |
| Diagnostics | Works |
| Image briefs (placeholders only) | Works |
| Six business fixtures + tests | Works |

---

## 2. Composition behaviour (Phase 2)

```text
Brief → classify → foundation → recipe → layout
      → content + image briefs → validate
      → explicit draft (no trade shallow merge)
      → diagnostics
```

### Trade dependency removed from composition

| Before | After |
|--------|-------|
| Every foundation `sourceTemplateId: "trade"` | `sourceTemplateId: null` |
| Shallow merge over source / defaults | Empty skeleton + explicit sections |
| Missing fields → plumber `DEFAULT_TRADE_SECTIONS` bleed | Unused sections forced `on: false` |
| Recipe = foundation bag | Recipes independent (`recipes-data.js`) |

**Still technical:** preview HTML asset remains `trade.template.json`, documented as `landing-shell-v1`. This is a renderer shell, not content inheritance.

---

## 3. What is reusable

- LeadPages Brain gateway  
- Concept validator + leakage detectors  
- Draft/version store (`theme_studio_*` legacy tables)  
- Preview token + sandboxed HTML preview  
- Marketplace `section_key` catalog  
- Cloudinary upload APIs (for Phase 3 Image Service)  

---

## 4. What should be kept

- AI Colour Assistant as a separate product  
- Draft-only generation rule  
- Protected-field policy  
- Superuser + partner V1 audience  
- Legacy URLs/APIs/tables until a dedicated migration  

---

## 5. What should be rewritten / next

| Area | Status |
|------|--------|
| Website Composer | **Done (Phase 2)** |
| Marketplace Intelligence (file-based) | **Done (Phase 2)** — deepen later |
| Image Service | Phase 3 |
| Full generation UX polish | Phase 4 |
| App install onto `site_apps` | Later (plan emitted on recipe) |
| Non-shell renderer diversity | Later |

---

## 6. Deprecated

| Item | Disposition |
|------|-------------|
| Product name “Theme Studio” for full site | Deprecated in UI/docs |
| Trade template as content foundation | Deprecated in Composer |
| Shallow merge generation path | Replaced by `buildDraftConfig` for Composer concepts |

Legacy `adaptConceptToSiteConfig` remains for older fixture concepts without `recipeId`.

---

## 7. Unchanged this phase

- Public URLs `/theme-studio*`  
- API routes `/api/theme-studio/*`  
- DB tables `theme_studio_*`  
- Publish pipeline  
- Live apply defaults  
- Colour Assistant write path  
- No Pexels / Image Service  

---

## Verdict

Phase 2 delivers a real **Website Composer**: foundations are structural, recipes are independent, drafts are explicitly composed with provenance and diagnostics, and trade content inheritance is removed from the generation path. Preview still uses a technical landing HTML shell. Image Service and publishing changes remain out of scope until approved.
