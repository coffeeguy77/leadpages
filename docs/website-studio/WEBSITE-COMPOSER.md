# Website Composer

**Role:** Internal composition engine behind Website Studio.  
**Status:** Phase 3 — Marketplace adapters + Image Service wired.  
**Legacy API path:** `lib/theme-studio/generate.js` → `composeWebsiteConcepts` (async).

---

## Purpose

Assemble a **complete draft website** from verified structural components, supported Marketplace apps, matched content, and resolved imagery.

Composer must **not**:

- Clone an existing trade website and patch over it  
- Shallow-merge plumber / landscaping / jewellery content from a source site  
- Treat `sourceTemplateId: "trade"` as a content foundation  
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
Draft Preview ready              diagnostics + shell neutralize
```

---

## Module map

| Concern | Module |
|---------|--------|
| Entry | `compose.js` `composeWebsiteConcepts` |
| Classification | `classify.js` |
| Foundations | `foundations*.js` |
| Recipes | `recipes*.js` |
| Content | `content.js` |
| App select/install | `install-apps.js` |
| Catalogue | `marketplace/catalogue*.js` |
| AI metadata | `marketplace/app-metadata.js` |
| Adapters | `adapters/registry.js` |
| Image direction | `image-direction.js` |
| Explicit draft | `build-draft.js` |
| Diagnostics | `diagnostics.js` |
| Studio wiring | `lib/theme-studio/generate.js` |

---

## Foundations (structural only)

- `sourceTemplateId: null`  
- `rendererShellId: landing-shell-v1` (technical HTML only)  
- Supported / required / optional section keys  
- Incompatibilities (e.g. hospitality excludes `emerg`, `beforeAfter`)  
- No embedded business copy  

---

## Marketplace apps

Only apps with `websiteStudioSupport: "supported"` plus metadata + adapter are auto-selected.  
See [MARKETPLACE.md](MARKETPLACE.md), [APP-ADAPTERS.md](APP-ADAPTERS.md).

Concept slots diversify hero (`hero` / `heroSlider` / `splitHero`), trust strategy, and section order. Reasons are recorded in diagnostics.

---

## Explicit draft rules

- Start from empty skeleton  
- Write every active section via adapters  
- Disable every other known section (`on: false`)  
- `contentInheritance: "none"`  
- Store `installedApps`, `imageSelections`, `imageDirection`  
- Ignore `sourceConfig` shallow merge  

---

## Fixtures

`fixtures/website-composer/briefs.js` — Bean Culture, Pink Diamond Vault, Canberra Electrician, Commercial Lawyer, Hair Salon, Wedding Photographer.

Tests: `tests/website-composer.test.js`, `tests/website-studio-phase3.test.js`, `tests/image-service.test.js`.

---

## Renderer shell note

Preview uses `trade.template.json` as HTML. Composer drafts neutralize trade fallback strings in `render-preview.js` when `contentInheritance === 'none'`. Production `api/render.js` is unchanged. Remaining shell limitations are documented in diagnostics (`shell_technical_only`).
