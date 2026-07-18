# Website Studio — Architecture

**Updated:** 2026-07-18 (Phase 3)

## High-level chain

```text
┌──────────────────┐
│ LeadPages Brain  │  task routing, providers, prompts, usage
└────────┬─────────┘
         │ structured tasks (optional)
         ▼
┌──────────────────┐
│ Website Studio   │  user UI + APIs (intake, compare, refine, images)
└────────┬─────────┘
         │ composition request
         ▼
┌──────────────────┐
│ Website Composer │  brief → foundation → recipe → apps → content → draft
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Marketplace      │  catalogue + AI metadata + deterministic adapters
│ Intelligence     │  install/activate supported apps only
└────────┬─────────┘
         │ structured image briefs
         ▼
┌──────────────────┐
│ Image Service    │  Cloudinary → Pexels → AI(super) → placeholder
└────────┬─────────┘
         │ draft config + stored selections
         ▼
┌──────────────────┐
│ Renderer         │  landing-shell-v1 HTML (legacy trade.template.json asset)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Draft Preview    │  signed, noindex, forms/tracking sandboxed + shell neutralize
└────────┬─────────┘
         │ human approve
         ▼
┌──────────────────┐
│ Approval         │  scope + confirm; never silent live write
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Publish          │  existing editor / site publish paths only (unchanged)
└──────────────────┘
```

### Composer internal chain

```text
Foundation → Recipe → Supported Apps (adapters) → Layouts → Content
  → Structured image briefs → Image Service → Explicit draft
```

---

## Component responsibilities

### Website Studio (user feature)

- Intake, generate, compare, preview, refine  
- Image panel (search / approve / Cloudinary import plan)  
- Quality report; apply scopes remain draft/demo gated  

**UI:** `/theme-studio-v2` (legacy path)

### Website Composer

- Classification → foundation → recipe → app selection → content → images → draft  
- `contentInheritance: "none"`, `sourceTemplateId: null`  
- Section provenance + diagnostics  

**Code:** `lib/website-composer/`  
**Entry:** `composeWebsiteConcepts` (async; via `lib/theme-studio/generate.js`)

### Marketplace Intelligence

- Verified catalogue (`catalogue-data.json`)  
- AI selection metadata (`app-metadata.js`)  
- Deterministic adapters (`adapters/registry.js`)  
- Install/activate (`install-apps.js`)  

### Image Service

- `lib/image-service/` + `api/image-service/*`  
- Server-only provider calls; role-gated AI  

### Renderer shell

- Technical asset: `trade.template.json` mapped as `landing-shell-v1`  
- Website Studio drafts: unused sections `on: false` + preview neutralize script  
- Production publish behaviour unchanged  

---

## Non-goals (Phase 3)

- Live site application / publish pipeline changes  
- Marketplace template publishing  
- Reintroducing trade shallow merge / `sourceTemplateId: "trade"`  
- Client-side Pexels or Cloudinary secrets  
- New paid AI image provider  
