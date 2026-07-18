# Website Composer

**Role:** Internal composition engine behind Website Studio.  
**Status:** Phase 2 implemented — `lib/website-composer/`  
**Legacy API path:** Website Studio calls Composer via `lib/theme-studio/generate.js` → `composeWebsiteConcepts`.

---

## Purpose

Assemble a **complete draft website** from verified structural components and industry-aware content.

Composer must **not**:

- Clone an existing trade website and patch over it  
- Shallow-merge plumber / landscaping / jewellery content from a source site  
- Treat `sourceTemplateId: "trade"` as a content foundation  
- Emit colour-only or partial section patches  

---

## Pipeline

```text
Business Brief
    ↓
Business Classification          classify.js
    ↓
Industry Profile
    ↓
Foundation (structural only)     foundations-data.js
    ↓
Marketplace Recipe               recipes-data.js
    ↓
Layout Selection
    ↓
Content Generation               content.js  (provenance per section)
    ↓
Image Briefs (placeholders)      Phase 3 resolves via Image Service
    ↓
Renderer Configuration           build-draft.js  (explicit compose)
    ↓
Draft Preview ready              diagnostics attached
```

### Composition layers

```text
Foundation (skeleton)
    ↓
Recipe (packaging) ──→ Apps (section_key)
    ↓
Layouts (layoutId) + Content (AI / brief)
    ↓
Draft config (explicit compose, no trade merge)
    ↓
Renderer shell landing-shell-v1 (technical HTML only)
```

---

## Module map

| Concern | Module |
|---------|--------|
| Entry | `lib/website-composer/compose.js` `composeWebsiteConcepts` |
| Classification | `lib/website-composer/classify.js` |
| Foundations | `lib/website-composer/foundations*.js` |
| Recipes | `lib/website-composer/recipes*.js` |
| Content + image briefs | `lib/website-composer/content.js` |
| Explicit draft build | `lib/website-composer/build-draft.js` |
| Diagnostics | `lib/website-composer/diagnostics.js` |
| Public exports | `lib/website-composer/index.js` |
| Studio wiring | `lib/theme-studio/generate.js` (delegates) |

---

## Foundations (structural only)

A foundation defines:

- page skeleton  
- navigation defaults  
- spacing profile  
- recommended app regions  
- layout rules  
- conversion style  
- section placeholders / supported / required / optional keys  
- incompatibilities  

A foundation must **not** define business copy, services lists, FAQs, testimonials, or imagery.

`sourceTemplateId` is **null**. Preview uses `rendererShellId: landing-shell-v1` (technical HTML asset mapping only — see MIGRATION.md).

Categories include: Trades, Professional Services, Hospitality, Retail, Health, Beauty, Events, Construction, Creative, Education, Technology, Non-profit, Travel, Manufacturing, Industrial, Automotive.

Legacy IDs (`retail-boutique`, `trade-field-services`, …) resolve via aliases.

---

## Marketplace recipes

Recipes are **independent of foundations** (compatibility list only).

A recipe decides:

- apps (`section_key`s)  
- section order  
- layouts / variants  
- CTAs / conversion style  
- content hints (tone / service shape — not copy)

Example: Hospitality foundation → Coffee Event **or** Café **or** Restaurant **or** Coffee Roaster recipes.

---

## Explicit draft composition

`buildDraftConfig`:

1. Starts from an **empty** skeleton (never trade defaults)  
2. Writes every active section fully  
3. Sets every other known section to `{ on: false }` so plumber HTML defaults cannot bleed  
4. Maps hero `heading`/`subheading` → `title`/`sub` for the landing shell  
5. Records `contentInheritance: 'none'`  

Redesign `sourceConfig` is **ignored for section content** in Phase 2.

---

## Provenance

Every active section declares ownership:

| Value | Meaning |
|-------|---------|
| Foundation | Structural choice only |
| Marketplace Recipe | App/order/CTA packaging |
| AI Generated | Composer content fill |
| Business Profile | Name / location / identity |
| Manual Edit | Future editor edits |
| Imported | Future import path |
| Legacy | Pre-composer artefacts |

Available on `concept.provenance.sectionProvenance` and `draft.__websiteComposer.provenance`.

---

## Diagnostics

Each composed concept includes diagnostics:

- Foundation / recipe / apps / layout selected  
- Content sources per section  
- Sections skipped (disabled)  
- Validation + draft warnings  
- Renderer note (shell is technical only)  

---

## Image briefs (Phase 2)

Placeholder descriptors only, e.g.:

```json
{
  "heroImage": "Corporate coffee cart at outdoor event",
  "galleryImage1": "Wedding coffee service"
}
```

No Pexels. No Image Service. Phase 3.

---

## Fixtures

`fixtures/website-composer/briefs.js` + `tests/website-composer.test.js`:

- Bean Culture  
- Pink Diamond Vault  
- Canberra Electrician  
- Commercial Lawyer  
- Hair Salon  
- Wedding Photographer  

---

## Non-responsibilities

- Image Service / Pexels  
- Live publish  
- Colour Assistant  
- Auth UI  
- Blind rename of `api/theme-studio/*` or `theme_studio_*` tables  
