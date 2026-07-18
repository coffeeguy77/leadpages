# Marketplace & Marketplace Intelligence

**Updated:** 2026-07-18 (Phase 3)

## What Marketplace is today

| Piece | Path | Role |
|-------|------|------|
| Categories | `lib/marketplace-categories.js` | Section taxonomy |
| Sell / demo content | `marketplace/*.json`, `marketplace/demos/*` | Marketing + playground |
| Catalog seed | `lib/marketplace-catalog-seed.js` | Features/apps by `section_key` |
| Site attach | `site_apps` ↔ `section_key` | Enable apps on a live site |
| Website Studio catalogue | `lib/website-composer/marketplace/catalogue-data.json` | Verified Composer inventory |

Website Studio **does not** auto-select apps by name alone. Selection requires:

1. Catalogue `websiteStudioSupport === "supported"`
2. Curated AI metadata in `app-metadata.js`
3. A deterministic adapter in `adapters/registry.js`
4. Foundation compatibility (supported / not incompatible)

---

## Website Studio support statuses

| Status | Meaning | Auto-selected? |
|--------|---------|----------------|
| `supported` | Metadata + adapter + renderer path verified | Yes |
| `supported-with-limitations` | Usable with caveats (e.g. nav/header shell) | No |
| `requires-adapter` | Known section; no Composer adapter yet | No |
| `requires-metadata` | Shell/chrome fields, not page apps | No |
| `incompatible` | Not suitable for Composer | No |
| `deprecated` | Do not use | No |

See **[MARKETPLACE-CATALOGUE.md](./MARKETPLACE-CATALOGUE.md)** for the full inventory.

---

## Marketplace Intelligence (Phase 3)

| Concern | Module |
|---------|--------|
| Verified catalogue | `lib/website-composer/marketplace/catalogue.js` |
| AI selection metadata | `lib/website-composer/marketplace/app-metadata.js` |
| Deterministic adapters | `lib/website-composer/adapters/registry.js` |
| Install / activate | `lib/website-composer/install-apps.js` |
| Foundation scoring | `lib/website-composer/foundations.js` |
| Recipe scoring | `lib/website-composer/recipes.js` |

### Selection flow

```text
Recipe / foundation section order
  → slot diversity (hero / trust)
  → assertSupportedApp
  → hasAdapter
  → scoreAppForContext
  → installAppsIntoDraft (adaptApp per section)
  → unused KNOWN_SECTION_KEYS → on: false
```

The Brain never writes arbitrary app config. Adapters own field mapping and validation.

---

## Relationship to Website Composer

```text
Brief → Classification → Foundation → Recipe
  → App selection (supported only)
  → Layout + variants
  → Content (adapter-shaped)
  → Image Service
  → Explicit draft
```

`contentInheritance: "none"` and `sourceTemplateId: null` are preserved.

---

## Gaps

Honest coverage gaps are listed in **[MARKETPLACE-GAPS.md](./MARKETPLACE-GAPS.md)**.
Adapter contract details: **[APP-ADAPTERS.md](./APP-ADAPTERS.md)**.
