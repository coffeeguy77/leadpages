# Website Studio — Target Architecture

## High-level chain

```text
┌──────────────────┐
│ LeadPages Brain  │  task routing, providers, prompts, usage
└────────┬─────────┘
         │ structured tasks
         ▼
┌──────────────────┐
│ Website Studio   │  user UI + APIs (intake, compare, refine, approve)
└────────┬─────────┘
         │ composition request
         ▼
┌──────────────────┐
│ Website Composer │  brief → validated composition plan → site config draft
└────────┬─────────┘
         │ queries
         ▼
┌──────────────────┐
│ Marketplace      │  foundations, apps, recipes, compatibility
│ Intelligence     │
└────────┬─────────┘
         │ asset needs
         ▼
┌──────────────────┐
│ Image Service    │  Cloudinary + stock providers (Pexels, …)
└────────┬─────────┘
         │ draft config + assets
         ▼
┌──────────────────┐
│ Renderer         │  trade (and later other) templates
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Draft Preview    │  signed, noindex, forms/tracking sandboxed
└────────┬─────────┘
         │ human approve
         ▼
┌──────────────────┐
│ Approval         │  scope + confirm; never silent live write
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Publish          │  existing editor / site publish paths only
└──────────────────┘

Parallel:
┌──────────────────┐
│ AI Colour        │  theme.generate / theme.refine / theme-approve
│ Assistant        │  Editor → Appearance (target home)
└──────────────────┘
```

---

## Component responsibilities

### Website Studio (user feature)

- Intake (mode, brief, optional source site)  
- Show foundation candidates / allow override  
- Generate and compare concepts  
- Desktop/mobile preview  
- Refinement chat  
- Quality report  
- Approve apply / save template  

**Today:** partially implemented under legacy name Theme Studio V2 (`theme-studio-v2.html`, `api/theme-studio/*`).

### Website Composer (internal engine)

- Owns composition plan schema  
- Calls Brain for analysis/content when enabled  
- Uses Marketplace Intelligence for foundations/apps/recipes  
- Produces validated concept → draft `sites.config` via deterministic adapter  
- Never writes live sites  

**Today:** logic is split across `lib/theme-studio/generate.js`, `adapt-to-site-config.js`, `validate-concept.js`. Should be consolidated under a Composer name in a later coding phase (module rename optional; behaviour first).

### Marketplace Intelligence

- Scores foundations and apps for industry/style/conversion  
- Emits page recipes (section order + required apps)  
- Enforces incompatibilities  

**Today:** static `foundations-data.js` only. No DB intelligence layer.

### Image Service

- Abstract providers: Cloudinary (upload/transform), Pexels (stock), later others  
- Role permissions for who may fetch/upload  
- Returns asset refs attached to concept imagery slots  

**Today:** Cloudinary exists for editor uploads; Theme Studio does not call it. No Pexels.

### Renderer / Preview / Approval / Publish

- Renderer: keep `api/render.js` as source of truth  
- Preview: signed draft config; noindex; sandbox forms/tracking  
- Approval: explicit confirm + scope  
- Publish: only through existing publish mechanisms after apply to a real draft/demo site  

---

## Data contracts (conceptual)

| Contract | Purpose | Current artifact |
|----------|---------|------------------|
| Business brief | Intake | Draft `brief` JSON |
| Composition plan / concept | Composer output | `theme_studio.concept.v1` (legacy id) |
| Draft site config | Adapter output | `draft_config_json` |
| Preview token | Short-lived render access | HMAC token |
| Approval record | Audit | Version kind `apply` |

Legacy schema id `theme_studio.concept.v1` stays until a versioned rename (`website_studio.concept.v1`) is approved.

---

## Security principles

1. Generation is draft-only  
2. Preview must not index, publish, or pollute analytics/leads  
3. Protected operational fields never written by Composer  
4. Access via roles (super + partner in V1)  
5. Live apply requires explicit flag + confirm  

---

## Parallel product: AI Colour Assistant

| Item | Value |
|------|-------|
| URL (legacy) | `/theme-studio`, `/theme-studio/colours` |
| APIs | `/api/brain/theme-generate\|refine\|approve` |
| Scope | Five hex tokens into `sites.config.theme` |
| Future home | Editor → Appearance |

Website Studio must not absorb this UI.
