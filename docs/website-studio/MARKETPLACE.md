# Marketplace & Marketplace Intelligence

## What Marketplace is today

| Piece | Path | Role |
|-------|------|------|
| Categories | `lib/marketplace-categories.js` | Section taxonomy |
| Catalog seed | `lib/marketplace-catalog-seed.js` | Features/apps by `section_key` |
| Admin | `marketplace-admin.html`, `apps-admin` | Ops editing |
| Site attach | `site_apps` ↔ `section_key` | Enable apps on a site |
| Demos | `marketplace/demos/*` | Playground previews |

**Critical gap:** Categories describe **section type**, not industry fitness, visual style, or conversion style. Website Studio cannot rely on category alone to pick jewellery vs plumbing apps.

---

## What Website Studio needs (Marketplace Intelligence)

A queryable layer that answers:

1. Which **foundations** fit this industry/style?  
2. Which **apps** (`section_key`) are compatible?  
3. Which **page recipe** should seed section order + layout?  
4. What is **incompatible** (e.g. emerg strip on boutique retail)?  

### Inputs (V1 data sources)

- Curated foundation registry (`lib/theme-studio/foundations-data.js`) — keep as seed  
- Verified layout IDs from `manage.html` `LAYOUTS`  
- Verified section keys from `DEFAULT_TRADE_SECTIONS`  
- Marketplace `section_key` catalog  

### Outputs

```json
{
  "foundationId": "hospitality-cafe",
  "layoutId": "photo-proof",
  "sectionOrder": ["hero", "featuredProjects", "services", "..."],
  "requiredApps": ["featuredProjects", "instaGallery"],
  "optionalApps": ["onlineQuote"],
  "incompatibleApps": ["emerg", "jobsFeed"],
  "score": 0.92,
  "rationale": "…"
}
```

---

## Relationship to Website Composer

Composer **must not** invent section keys.  
Composer asks Marketplace Intelligence for a recipe, then fills content.

---

## Implementation stance (this phase)

- **Audit only** — no Marketplace Intelligence code  
- Do not invent template/app IDs  
- Foundations file remains the interim intelligence source  
- Future: optional `theme_studio_foundations` / marketplace metadata tables (names TBD; prefer `website_studio_*` for new tables)  

---

## Coverage targets for later phases

Trade / field services, professional, retail/boutique, hospitality/café, events/hire, health/wellness, creative/agency, property/construction — already sketched in the foundation registry; Intelligence should score and extend without schema breaks.
