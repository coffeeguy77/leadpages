# Website Studio

**Status:** Phase 4 complete — composition, neutral renderer, generation UX.  
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
5. [NEUTRAL-RENDERER.md](NEUTRAL-RENDERER.md) — content-neutral preview shell  
6. [MARKETPLACE.md](MARKETPLACE.md) — marketplace role  
7. [MARKETPLACE-CATALOGUE.md](MARKETPLACE-CATALOGUE.md) — verified inventory (48 apps)  
8. [APP-ADAPTERS.md](APP-ADAPTERS.md) — deterministic adapters  
9. [MARKETPLACE-GAPS.md](MARKETPLACE-GAPS.md) — deferred gaps  
10. [IMAGE-SERVICE.md](IMAGE-SERVICE.md) — image abstraction  
11. [IMAGE-PROVIDERS.md](IMAGE-PROVIDERS.md) — Cloudinary / Pexels / AI  
12. [IMAGE-APPROVAL.md](IMAGE-APPROVAL.md) — draft import / approval  
13. [GENERATION-UX.md](GENERATION-UX.md) — brief → compare → preview → refine → approve  
14. [REFINEMENT.md](REFINEMENT.md) — NL refinement + direct edit  
15. [VERSIONING.md](VERSIONING.md) — draft versions  
16. [QUALITY-GATES.md](QUALITY-GATES.md) — deterministic quality  
17. [APPROVAL-WORKFLOW.md](APPROVAL-WORKFLOW.md) — draft approval (not publish)  
18. [ROLE-PERMISSIONS.md](ROLE-PERMISSIONS.md) — server gates  
19. [ROADMAP.md](ROADMAP.md) — phased plan  
20. [MIGRATION.md](MIGRATION.md) — Theme Studio → Website Studio  

---

## Legacy Theme Studio docs (archived)

Preserved under [`docs/archive/theme-studio/`](../archive/theme-studio/).  
Technical identifiers (`/theme-studio*`, `api/theme-studio/*`, `theme_studio_*`) remain until an approved migration. See [MIGRATION.md](MIGRATION.md).

---

## Stop rule

Phase 4 is implemented.  
Do **not** begin live application, Marketplace publishing, or production rollout until explicitly approved.
