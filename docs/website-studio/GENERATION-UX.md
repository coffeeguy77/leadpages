# Website Studio — Generation UX

**Updated:** 2026-07-18 (Phase 4)  
**UI surface:** `/theme-studio-v2` (legacy technical path)

## Workflow

```text
Brief → Generate → Compare → Preview → Refine / Edit → Approve draft
```

Live publish / apply is not available in this phase.

### 1. Business brief

Supports identity, offer, audience, conversion, brand, and trust fields.  
Industry-aware classification avoids forcing trade-only questions onto retail/hospitality/professional briefs.  
Briefs can be saved on the draft and resumed. Validation runs before generation.

### 2. Generate three concepts

`POST api/theme-studio/generate-concepts` → `composeWebsiteConcepts`.

Each concept includes:

- Concise name (Signature / Contrast / Clarity · recipe)
- Foundation, recipe, layout, hero treatment
- Installed Marketplace apps + section order
- Theme / typography / image direction
- Diagnostics + quality status

Concepts differ by foundation interpretation where candidates exist, hero type, app selection, section order, density, trust/CTA strategy, and theme — not cosmetic recolour alone.

### 3. Compare

Comparison cards show preview thumbnails, style, conversion strategy, foundation/recipe, apps, hero, image direction, quality status, and warnings.  
Actions: open, select, regenerate one/all, return to brief. Prior generations remain as versions.

### 4. Preview

Full renderer preview on `landing-shell-neutral-v1` with desktop and mobile viewports, refresh, and section identification for editing. Draft preview is signed / not for public indexing.

### 5. Refine / edit

Natural-language refinement via LeadPages Brain with deterministic planner fallback (`lib/website-composer/refine.js`).  
Direct edits via `api/theme-studio/direct-edit` using writable config paths only.

### 6. Approve draft

`api/theme-studio/approve-draft` sets approval state (`draft` → `selected` → `ready-for-review` → `approved-for-application`).  
Does **not** mutate live site configuration or publish.
