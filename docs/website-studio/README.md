# Website Studio

**Status:** Phase 2 complete — Website Composer implemented (`lib/website-composer/`).  
**Audience:** Product, engineering, AI agents  
**Last updated:** 2026-07-18

---

## Product names

| Name | Role |
|------|------|
| **Website Studio** | User-facing product for generating complete website concepts |
| **Website Composer** | Internal composition engine (`lib/website-composer/`) |
| **AI Colour Assistant** | Separate colour-token tool (former colour-only Theme Studio) |
| **LeadPages Brain** | Central AI gateway |
| **Image Service** | Shared image provider abstraction (`lib/image-service/`) |
| **Marketplace Intelligence** | Catalogue + metadata + adapters over Marketplace apps |

---

## Read order

1. [VISION.md](VISION.md) — product intent  
2. [CURRENT-STATE.md](CURRENT-STATE.md) — what exists today  
3. [ARCHITECTURE.md](ARCHITECTURE.md) — architecture  
4. [WEBSITE-COMPOSER.md](WEBSITE-COMPOSER.md) — composition engine  
5. [MARKETPLACE.md](MARKETPLACE.md) — marketplace role  
6. [MARKETPLACE-CATALOGUE.md](MARKETPLACE-CATALOGUE.md) — verified inventory  
7. [APP-ADAPTERS.md](APP-ADAPTERS.md) — deterministic adapters  
8. [MARKETPLACE-GAPS.md](MARKETPLACE-GAPS.md) — honest gaps  
9. [IMAGE-SERVICE.md](IMAGE-SERVICE.md) — image abstraction  
10. [IMAGE-PROVIDERS.md](IMAGE-PROVIDERS.md) — Cloudinary / Pexels / AI  
11. [IMAGE-APPROVAL.md](IMAGE-APPROVAL.md) — draft import / approval  
12. [ROLE-PERMISSIONS.md](ROLE-PERMISSIONS.md) — server gates  
13. [ROADMAP.md](ROADMAP.md) — phased plan  
14. [MIGRATION.md](MIGRATION.md) — Theme Studio → Website Studio  

---

## Legacy Theme Studio docs (archived)

Preserved under [`docs/archive/theme-studio/`](../archive/theme-studio/).  
Technical identifiers (`/theme-studio*`, `api/theme-studio/*`, `theme_studio_*`) remain until an approved migration. See [MIGRATION.md](MIGRATION.md).

---

## Stop rule

Phase 2 (Website Composer) is implemented.  
Do **not** begin Image Service / Pexels / publish changes until Phase 3 is approved — see [ROADMAP.md](ROADMAP.md).
