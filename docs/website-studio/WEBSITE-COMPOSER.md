# Website Composer

**Role:** Internal composition engine behind Website Studio.  
**Status:** Design only in this architecture reset. Implementation is Phase 2+.

---

## Purpose

Turn a normalized business brief (+ optional source snapshot) into one or more **validated website concepts**, then into **draft site configs** the renderer can preview.

Composer must:

- Select foundation / page recipe via Marketplace Intelligence  
- Produce structured concept JSON  
- Validate (schema, compatibility, leakage)  
- Adapt deterministically to allowlisted `sites.config` paths  
- Attach imagery **slots** (filled later by Image Service)  
- Never write live sites  

---

## Relationship to current code

| Composer concern | Current module (legacy paths) |
|------------------|-------------------------------|
| Brief normalize | `lib/theme-studio/generate.js` `normalizeBrief` |
| Foundation pick | `lib/theme-studio/foundations.js` |
| Concept build | `lib/theme-studio/generate.js` |
| Validate | `lib/theme-studio/validate-concept.js` |
| Adapt | `lib/theme-studio/adapt-to-site-config.js` |
| Refine | `lib/theme-studio/apply-patch.js` |
| Quality | `lib/theme-studio/quality-report.js` |
| Brain contracts | `lib/theme-studio/brain-contracts.js` |

**Phase 2 recommendation:** Introduce `lib/website-composer/` (or a facade) that orchestrates these modules without breaking `api/theme-studio/*` routes. Do not force-rename DB/API in the same change.

---

## Composition plan (target)

```text
brief
  → business_analysis (Brain, optional)
  → foundation_selection (Marketplace Intelligence + registry scores)
  → page_recipe (sectionOrder, required/optional apps, layout)
  → concept_generation (structure)
  → content_generation (copy/services/CTAs)
  → image_direction (slots)
  → validate + adapt
  → N distinct concepts
```

### Page recipes

A recipe is a reusable, industry-aware packing of:

- `layoutId`  
- `defaultSectionOrder`  
- required / optional section keys  
- marketplace `section_key` apps to attach  
- conversion style (call, book, quote, visit)  
- mobile rules  

Recipes should be data (JSON/DB), not hard-coded only in generator switches.

---

## Adapter rules (unchanged principles)

1. Accept only validated concepts  
2. Map approved fields → verified config paths  
3. Reject unknown section keys / layout IDs  
4. Reject incompatible foundation combinations  
5. Preserve protected operational fields  
6. Record ignored fields and warnings  
7. Produce a complete draft snapshot  
8. Never mutate source config  
9. Never publish  

Writable allowlist and protected fields remain as documented in archived Theme Studio V2 docs and `lib/theme-studio/constants.js`.

---

## Non-responsibilities

- User authentication UI  
- Cloudinary credentials  
- Live publish  
- Editor WYSIWYG editing  
- Ads mutation  
