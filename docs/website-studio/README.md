# Website Studio

**Status:** Phase 5 complete — controlled application (flagged OFF by default).  
**Audience:** Product, engineering, AI agents  
**Last updated:** 2026-07-18

---

## Product names

| Name | Role |
|------|------|
| **Website Studio** | User-facing product for generating and applying website concepts |
| **Website Composer** | Internal composition engine (`lib/website-composer/`) |
| **AI Colour Assistant** | Separate colour-token tool (no application permissions) |
| **LeadPages Brain** | Central AI gateway |
| **Image Service** | Shared image provider abstraction (`lib/image-service/`) |
| **Marketplace Intelligence** | Catalogue + metadata + adapters |
| **Application layer** | Controlled create / replacement / private template (`lib/website-studio-application/`) |

---

## Read order

1. [VISION.md](VISION.md)  
2. [CURRENT-STATE.md](CURRENT-STATE.md)  
3. [ARCHITECTURE.md](ARCHITECTURE.md)  
4. [APPLICATION.md](APPLICATION.md) — Phase 5  
5. [NEW-SITE-CREATION.md](NEW-SITE-CREATION.md)  
6. [REPLACEMENT-DRAFTS.md](REPLACEMENT-DRAFTS.md)  
7. [PRIVATE-TEMPLATES.md](PRIVATE-TEMPLATES.md)  
8. [ROLLOUT.md](ROLLOUT.md)  
9. [APPLICATION-SECURITY.md](APPLICATION-SECURITY.md)  
10. [FAILURE-RECOVERY.md](FAILURE-RECOVERY.md)  
11. [WEBSITE-COMPOSER.md](WEBSITE-COMPOSER.md)  
12. [NEUTRAL-RENDERER.md](NEUTRAL-RENDERER.md)  
13. [MARKETPLACE.md](MARKETPLACE.md) / [MARKETPLACE-CATALOGUE.md](MARKETPLACE-CATALOGUE.md)  
14. [GENERATION-UX.md](GENERATION-UX.md) / [APPROVAL-WORKFLOW.md](APPROVAL-WORKFLOW.md)  
15. [ROLE-PERMISSIONS.md](ROLE-PERMISSIONS.md)  
16. [ROADMAP.md](ROADMAP.md) / [MIGRATION.md](MIGRATION.md)  

---

## Stop rule

Phase 5 is implemented with **application flags default OFF**.  
Do **not** begin global production rollout, public Marketplace publishing, or automatic live-site replacement until explicitly approved.
