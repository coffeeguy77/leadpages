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
│ Website Composer │  brief → foundation → recipe → content → draft
└────────┬─────────┘
         │ queries (file-based Phase 2)
         ▼
┌──────────────────┐
│ Marketplace      │  foundations + recipes + app packing
│ Intelligence     │  (lib/website-composer foundations/recipes)
└────────┬─────────┘
         │ asset needs (placeholders in Phase 2)
         ▼
┌──────────────────┐
│ Image Service    │  Phase 3 — Cloudinary + Pexels
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

### Composer internal chain

```text
Foundation → Recipe → Apps → Layouts → Content → Renderer draft
```

---

## Component responsibilities

### Website Studio (user feature)

- Intake (mode, brief, optional source site)  
- Show foundation / recipe candidates  
- Generate and compare concepts  
- Desktop/mobile preview  
- Refinement  
- Quality report  
- Approve apply / save template  

**Today:** UI at `/theme-studio-v2` (legacy path); generation wired to Website Composer.

### Website Composer (internal engine) — Phase 2 ✅

- Classification → foundation → recipe → layout → content → image briefs  
- Explicit draft composition (`contentInheritance: none`)  
- Section provenance + diagnostics  
- Never writes live sites  

**Code:** `lib/website-composer/`  
**Entry:** `composeWebsiteConcepts` (also via `lib/theme-studio/generate.js`)

### Marketplace Intelligence — Phase 2 (file-based) ✅

- Foundation scoring + recipe scoring  
- Incompatibilities enforced  
- Apps listed on recipe (install to `site_apps` still later)

### Image Service — Phase 3 (not started)

- Cloudinary + Pexels providers  
- Phase 2 emits placeholder image briefs only  

### Renderer / Preview / Approval / Publish

- Preview still injects `trade.template.json` as **landing-shell-v1** technical asset  
- This is **not** content inheritance — unused sections are explicitly `on: false`  
- Publish unchanged  

See [NEUTRAL-RENDERER.md](NEUTRAL-RENDERER.md).

---

## Data contracts

| Contract | Purpose | Artifact |
|----------|---------|----------|
| Business brief | Intake | Draft `brief` JSON |
| Classification profile | Industry routing | `classifyBusiness` output |
| Foundation | Structure | `lib/website-composer/foundations-data.js` |
| Recipe | Packaging | `lib/website-composer/recipes-data.js` |
| Concept | Composer output | `theme_studio.concept.v1` (legacy id) + `recipeId` |
| Draft site config | Explicit compose | `draft_config_json` + `__websiteComposer` |
| Diagnostics | Audit | `concept.diagnostics` |
| Preview token | Short-lived render | HMAC token |

---

## Security principles

1. Generation is draft-only  
2. Preview must not index, publish, or pollute analytics/leads  
3. Protected operational fields never written by Composer  
4. Access via roles (super + partner in V1)  
5. Live apply requires explicit flag + confirm  
6. No shallow merge of source site marketing content  

---

## Parallel product: AI Colour Assistant

| Item | Value |
|------|-------|
| URL (legacy) | `/theme-studio`, `/theme-studio/colours` |
| APIs | `/api/brain/theme-generate\|refine\|approve` |
| Scope | Five hex tokens into `sites.config.theme` |

- Live site application / publish pipeline changes  
- Marketplace template publishing  
- Reintroducing trade shallow merge / `sourceTemplateId: "trade"`  
- Client-side Pexels or Cloudinary secrets  
- Partner/client AI image generation  
