# Marketplace & Marketplace Intelligence

**Updated:** 2026-07-18 (Phase 4)

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

## Website Studio support statuses (Phase 4 finals)

| Status | Meaning | Auto-selected? |
|--------|---------|----------------|
| `supported` | Metadata + adapter + renderer path verified | Yes |
| `supported-with-limitations` | Usable with caveats; not auto-selected | No |
| `incompatible` | Not suitable as a Composer section app | No |
| `deprecated` | Do not use | No |

Phase 4 completed investigation of all deferred apps. Statuses `requires-adapter` and `requires-metadata` are no longer used for open investigation debt.

See **[MARKETPLACE-CATALOGUE.md](./MARKETPLACE-CATALOGUE.md)** — **48 apps** (43 prior + 5 new).

---

## Phase 4 Marketplace apps

Added as normal Marketplace apps (categories, mounts, adapters, editor-usable):

| appId | Purpose |
|-------|---------|
| `productCollection` | Product shelf / collections |
| `clientLogos` | Client logo trust strip |
| `bookingCta` | Booking / appointment CTA band |
| `brandStory` | Brand / provenance story |
| `packageCompare` | Package / vehicle / tier comparison |

---

## Marketplace Intelligence

| Concern | Module |
|---------|--------|
| Verified catalogue | `lib/website-composer/marketplace/catalogue.js` |
| AI selection metadata | `lib/website-composer/marketplace/app-metadata.js` |
| Deterministic adapters | `lib/website-composer/adapters/registry.js` |
| Install / activate | `lib/website-composer/install-apps.js` |
| Finalize script | `scripts/website-studio-finalize-catalogue.js` |

### Selection flow

```text
Recipe preferred apps → filter supported + adapter → score metadata
  → install into draft sections → content adapt → validate
```

Unsupported / limited / incompatible apps are never auto-selected.
