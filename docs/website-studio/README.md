# Website Studio

**Status:** Phase 2 complete — Website Composer implemented (`lib/website-composer/`).  
**Audience:** Product, engineering, AI agents  
**Last updated:** 2026-07-18

---

## Product names

| Name | Role |
|------|------|
| **Website Studio** | User-facing product for generating complete website concepts |
| **Website Composer** | Internal composition engine (planned; not yet built as a named module) |
| **AI Colour Assistant** | Separate colour-token tool (former colour-only Theme Studio) |
| **LeadPages Brain** | Central AI gateway |
| **Image Service** | Planned shared image provider abstraction |
| **Marketplace Intelligence** | Planned foundation/app selection layer over Marketplace |

---

## Read order

1. [VISION.md](VISION.md) — product intent  
2. [CURRENT-STATE.md](CURRENT-STATE.md) — what exists today  
3. [ARCHITECTURE.md](ARCHITECTURE.md) — target architecture  
4. [WEBSITE-COMPOSER.md](WEBSITE-COMPOSER.md) — internal engine design  
5. [MARKETPLACE.md](MARKETPLACE.md) — marketplace role  
6. [IMAGE-SERVICE.md](IMAGE-SERVICE.md) — image abstraction  
7. [ROADMAP.md](ROADMAP.md) — phased plan  
8. [MIGRATION.md](MIGRATION.md) — Theme Studio → Website Studio migration  

---

## Legacy Theme Studio docs (archived)

Do not delete. Preserved under [`docs/archive/theme-studio/`](../archive/theme-studio/):

- `THEME-STUDIO-IMPLEMENTATION-AUDIT.md`
- `21-THEME-STUDIO.md`
- `23-THEME-STUDIO-V2.md`

Technical identifiers (`/theme-studio*`, `api/theme-studio/*`, `theme_studio_*` tables, `lib/theme-studio/`) remain until an approved migration phase. See [MIGRATION.md](MIGRATION.md).

---

## Stop rule

Phase 2 (Website Composer) is implemented.  
Do **not** begin Image Service / Pexels / publish changes until Phase 3 is approved — see [ROADMAP.md](ROADMAP.md).
