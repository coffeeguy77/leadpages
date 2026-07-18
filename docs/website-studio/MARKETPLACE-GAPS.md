# Marketplace Gaps (Website Studio)

**Updated:** 2026-07-18 (Phase 3)  
Honest gaps from the Phase 3 audit. Do not force unsuitable apps into fixtures.

---

## Priority: High

### Event coffee vehicle comparison

| Field | Value |
|-------|-------|
| Industry | Coffee-event / mobile hospitality |
| Missing use case | Dedicated cart / van / caravan comparison layout |
| Closest current app | `services` + `specialOffer` |
| Why insufficient | Services grid can list vehicles, but lacks comparison columns, inclusions matrix, capacity/pricing tiers |
| Recommended new app | `packageCompare` or `vehicleCompare` |
| Required fields | heading, items[3+] with title, inclusions[], capacity, cta |
| Suggested layouts | three-column compare, stacked mobile |
| Suggested variants | `cards`, `table` |
| Priority | High |

### Luxury product PDP / collection shelf

| Field | Value |
|-------|-------|
| Industry | Jewellery / premium retail |
| Missing use case | Product shelf with price-on-request + appointment CTA |
| Closest current app | `featuredProjects` |
| Why insufficient | Project gallery semantics (location/tag) are trade-portfolio oriented; no SKU/collection metadata |
| Recommended new app | `productCollection` |
| Required fields | heading, items with title, media, caption, cta |
| Suggested layouts | editorial grid, masonry |
| Suggested variants | `luxury`, `lookbook` |
| Priority | High |

### Menu / hospitality catalogue

| Field | Value |
|-------|-------|
| Industry | Cafe / restaurant |
| Missing use case | Menu sections with prices and dietary tags |
| Closest current app | `services` |
| Why insufficient | Icon-service cards ≠ menu items |
| Recommended new app | `menuBoard` |
| Priority | High for cafe recipes; Medium for Bean Culture (event hire can use services) |

---

## Priority: Medium

### Client logo trust wall

| Field | Value |
|-------|-------|
| Industry | Events, B2B hospitality, professional |
| Missing use case | Logo strip distinct from badge trustBar |
| Closest current app | `trustBar` |
| Why insufficient | Badges are text labels; no logo-asset slots |
| Recommended new app | `clientLogos` |
| Priority | Medium |

### Appointment / booking calendar CTA

| Field | Value |
|-------|-------|
| Industry | Jewellery, salon, legal |
| Missing use case | Booking widget beyond quote form |
| Closest current app | `quote` / `onlineQuote` |
| Why insufficient | Quote forms collect leads; not calendar booking |
| Recommended new app | `bookingCta` (or integrate existing booking app when adapter-ready) |
| Priority | Medium |

### Provenance / craftsmanship story

| Field | Value |
|-------|-------|
| Industry | Jewellery |
| Missing use case | Long-form brand story with timeline |
| Closest current app | `why` + `crew` |
| Why insufficient | Why is short editorial; no timeline / provenance fields |
| Recommended new app | `brandStory` |
| Priority | Medium |

---

## Priority: Low (adapters pending)

These apps exist in Marketplace demos / `section_key` registry but are `requires-adapter` for Website Studio:

`activityCounter`, `activityTimeline`, `beforeAfterFeed`, `customerReactions`, `emergencyAvailability`, `estimateBuilder`, `finance`, `igProjectFeed`, `jobsFeed`, `projectFeed`, `projectStats`, `proofStream`, `responseCards`, `serviceAreaMap`, `serviceAreas`, `videoReels`

Do not auto-select until adapters + metadata exist.

---

## Fixture strategy (Phase 3)

| Fixture | Approach |
|---------|----------|
| Bean Culture | Use supported apps: hero variants, services (cart/van/caravan), featuredProjects gallery, specialOffer packages, serviceProcess booking steps, reviews, faq, quote |
| Pink Diamond | hero, featuredProjects collections, services, why, reviews, specialOffer, quote, faq — no trade apps |
| Electrician | trade-capable supported apps only; no jewellery content |

No new Marketplace apps were built in Phase 3 except documentation of gaps.
