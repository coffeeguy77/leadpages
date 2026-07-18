# Marketplace & Marketplace Intelligence

**Updated:** 2026-07-18 (Phase 3)

## What Marketplace is today

| Piece | Path | Role |
|-------|------|------|
| Categories | `lib/marketplace-categories.js` | Section taxonomy |
| Sell / demo content | `marketplace/*.json`, `marketplace/demos/*` | Marketing + playground |
| Catalog seed | `lib/marketplace-catalog-seed.js` | Features/apps by `section_key` |
| Admin | `marketplace-admin.html`, `apps-admin` | Ops editing |
| Site attach | `site_apps` ↔ `section_key` | Enable apps on a site |
| Demos | `marketplace/demos/*` | Playground previews |

Categories alone do not encode industry fitness. Website Composer uses **foundations + recipes**.

Website Studio **does not** auto-select apps by name alone. Selection requires:

## Marketplace Intelligence (Phase 2 — file-based)

Implemented inside Website Composer:

| Concern | Module |
|---------|--------|
| Foundation scoring | `lib/website-composer/foundations.js` |
| Recipe scoring | `lib/website-composer/recipes.js` |
| Recipe catalog | `lib/website-composer/recipes-data.js` |
| Classification hints | `lib/website-composer/classify.js` |

### Outputs used by Composer

```json
{
  "foundationId": "hospitality",
  "recipeId": "recipe-coffee-event",
  "layoutId": "premium-showcase",
  "sectionOrder": ["hero", "featuredProjects", "services", "why", "reviews", "specialOffer", "quote", "footer"],
  "apps": ["featuredProjects", "instaGallery", "onlineQuote"],
  "conversionStyle": "book-event"
}
```

### Recipe independence

Foundations do not own recipes. Example:

```text
Hospitality foundation
  → recipe-coffee-event
  → recipe-cafe
  → recipe-restaurant
  → recipe-coffee-roaster
```

---

## Relationship to Website Composer

```text
Foundation → Recipe → Apps → Layouts → Content → Renderer
```

Composer never invents section keys. Apps are selected from verified `section_key`s. Installing into `site_apps` is still a later apply concern; Phase 2 records the plan on the concept (`sourceAppIds` / diagnostics.appsSelected).

---

## Coverage

Foundations: trades, professional, hospitality, retail, health, beauty, events, construction, creative, education, technology, non-profit, travel, manufacturing, industrial, automotive.

Recipes include field trade, commercial legal, coffee event, café, restaurant, coffee roaster, luxury jewellery, hair salon, wedding photographer, SME advisory, event hire, wellness, builder showcase, generic local.

---

## Later

- Optional DB-backed foundation/recipe tables (`website_studio_*`)  
- Stronger app install + reconcile on apply  
- Broader marketplace coverage tests (Phase 5)  
