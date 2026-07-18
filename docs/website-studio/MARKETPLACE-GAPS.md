# Marketplace Gaps (Website Studio)

**Updated:** 2026-07-18 (Phase 4)  
Honest remaining gaps after Phase 4. High-priority Phase 3 gaps were implemented as normal Marketplace apps where viable.

---

## Implemented in Phase 4 (no longer gaps)

| Need | App | Notes |
|------|-----|-------|
| Product shelf / collections | `productCollection` | Jewellery / retail recipes |
| Client logo trust strip | `clientLogos` | Events / professional |
| Booking / appointment CTA | `bookingCta` | Band CTA (not full calendar) |
| Brand / provenance story | `brandStory` | Luxury / hospitality |
| Package / vehicle / tier compare | `packageCompare` | Coffee cart/van/caravan + packages |

---

## Deferred

### Menu board / hospitality catalogue

| Field | Value |
|-------|-------|
| Industry | Cafe / restaurant |
| Missing use case | Menu sections with prices and dietary tags |
| Closest current app | `services` + `specialOffer` |
| Why deferred | Café fixture remains credible with services + gallery + offer; dedicated menu schema + editor fields are a larger Marketplace surface |
| Recommended new app | `menuBoard` |
| Priority | Medium (post–Phase 4) |

### Full calendar booking widget

| Field | Value |
|-------|-------|
| Closest current app | `bookingCta` + `quote` / `onlineQuote` |
| Why deferred | External calendar integrations and availability sync are out of Phase 4 scope |
| Recommendation | Keep `bookingCta` as conversion band; integrate calendar provider later |

### Deeper interactive estimate builder

| Field | Value |
|-------|-------|
| App | `estimateBuilder` (supported-with-limitations) |
| Why deferred | Large interactive config surface; not auto-selected |

---

## Apps intentionally not auto-selected

See [MARKETPLACE-CATALOGUE.md](MARKETPLACE-CATALOGUE.md) — `supported-with-limitations` (13) and `incompatible` (`seoTokens`).  
These cannot be auto-selected by Composer. Recipe-explicit inclusion requires an implemented adapter.
