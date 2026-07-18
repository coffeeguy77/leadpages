# Website Studio — Architecture

**Updated:** 2026-07-18 (Phase 4)

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
│ Renderer         │  Website Studio drafts → landing-shell-neutral-v1
│                  │  Live trade sites → landing-shell-v1 (trade.template.json)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Draft Preview    │  signed, noindex, sandboxed; neutral shell (no trade content)
└────────┬─────────┘
         │ human approve draft
         ▼
┌──────────────────┐
│ Approval         │  approved-for-application
└────────┬─────────┘
         │ flagged application (Phase 5)
         ▼
┌──────────────────┐
│ Application      │  create draft site / replacement draft / private template
│ (flagged OFF)    │  never auto-publish; never live overwrite
└────────┬─────────┘
         │ separate product action
         ▼
┌──────────────────┐
│ Publish          │  existing publish paths only — unchanged
└──────────────────┘
```

### Composer internal chain

```text
Foundation → Recipe → Supported Apps (adapters) → Layouts → Content
  → Structured image briefs → Image Service → Explicit draft
  → Quality gate → Neutral-shell preview
```

---

## Component responsibilities

### Website Studio (user feature)

- Brief → generate → compare → preview → refine / direct edit → approve draft  
- Image panel (search / approve / persist / Cloudinary import plan)  
- Quality gate; live apply remains gated off  

**UI:** `/theme-studio-v2` (legacy path)

### Website Composer

- Classification → foundation → recipe → app selection → content → images → draft  
- `contentInheritance: "none"`, `sourceTemplateId: null`  
- `rendererShellId: landing-shell-neutral-v1`  
- Section provenance + diagnostics + quality gate + refinement planner  

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

- Live trade: `trade.template.json` → `landing-shell-v1` (unchanged)  
- Website Studio drafts: `landing-shell-neutral-v1.template.json` → `landing-shell-neutral-v1`  
- Preview resolution in `lib/theme-studio/render-preview.js`  
- Production publish behaviour unchanged  

See [NEUTRAL-RENDERER.md](NEUTRAL-RENDERER.md).

---

## Non-goals (Phase 4 stop)

- Live site application / publish pipeline changes  
- Marketplace template publishing  
- Reintroducing trade shallow merge / `sourceTemplateId: "trade"`  
- Client-side Pexels or Cloudinary secrets  
- Partner/client AI image generation  
