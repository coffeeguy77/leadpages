# Website Composer

**Role:** Internal composition engine behind Website Studio.  
**Status:** Phase 4 — complete composition, neutral shell, quality gate, refinement.  
**Legacy API path:** `lib/theme-studio/generate.js` → `composeWebsiteConcepts` (async).

---

## Purpose

Assemble a **complete draft website** from verified structural components, supported Marketplace apps, matched content, and resolved imagery.

Composer must **not**:

- Clone an existing trade website and patch over it  
- Shallow-merge plumber / landscaping / jewellery content from a source site  
- Treat `sourceTemplateId: "trade"` as a content foundation  
- Preview through trade defaults as the content source  
- Let the Brain write arbitrary app config  
- Auto-select unsupported Marketplace apps  

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
App selection + install          install-apps.js + adapters/
    ↓
Layout Selection (concept slots diversify)
    ↓
Content Generation               content.js
    ↓
Structured image briefs          image-direction.js
    ↓
Image Service resolve            lib/image-service/
    ↓
Explicit draft                   build-draft.js
    ↓
Quality gate                     quality-gate.js
    ↓
Draft Preview                    landing-shell-neutral-v1
```

---

## Module map

| Concern | Module |
|---------|--------|
| Entry | `compose.js` `composeWebsiteConcepts` |
| Classification | `classify.js` |
| Foundations | `foundations*.js` |
| Recipes | `recipes*.js` |
| Marketplace catalogue | `marketplace/` |
| Adapters | `adapters/registry.js` |
| Install | `install-apps.js` |
| Content | `content.js` |
| Image direction | `image-direction.js` |
| Draft build | `build-draft.js` |
| Diagnostics | `diagnostics.js` |
| Quality gate | `quality-gate.js` |
| Refinement planner | `refine.js` |
| Constants / shells | `constants.js` |

---

## Draft invariants

| Field | Value |
|-------|-------|
| `contentInheritance` | `"none"` |
| `sourceTemplateId` | `null` |
| `rendererShellId` | `landing-shell-neutral-v1` |

---

## Concept differentiation

Three concepts from one brief differ via meaningful choices: foundation candidates, hero type, app selection, section order, density, trust/CTA strategy, gallery style, typography, theme, image direction — not recolour-only variants.

---

## Fixtures

Ten businesses under `fixtures/website-composer/briefs.js` (Bean Culture, Pink Diamond Vault, Electrician, Lawyer, Hair Salon, Wedding Photographer, Café, Landscaping, Consultant, Automotive).
