# Website Composer App Adapters

**Updated:** 2026-07-18 (Phase 3)

## Purpose

Deterministic adapters convert structured Composer content into the exact section configuration the renderer understands.

Registry: `lib/website-composer/adapters/registry.js`  
Conceptual name: **websiteComposerAppAdapters** (`adaptApp`, `hasAdapter`, `listAdapterIds`).

The Brain must never write freeform app config. Generic deep merge is not used as a substitute.

---

## Adapter contract

Each adapter returns:

```js
{
  ok: boolean,
  sectionKey: string,
  config: { on: true, provenance, ...fields },
  services?: array,          // optional top-level services mirror
  writtenPaths: string[],
  install: { sectionKey, position_slot },
  errors?: [{ code, message, path }],
  diagnostics?: { adapter }
}
```

Responsibilities:

| Concern | Behaviour |
|---------|-----------|
| Required fields | Fail closed (`ok: false`) if missing |
| Item counts | Enforce min/max from metadata / adapter rules |
| Variants | Only emit supported variant ids |
| Images | Accept resolved URLs from Image Service selections |
| Defaults | Safe empty-safe defaults only when optional |
| Install | Marks `on: true` + provenance; recorded in `installedApps` |

---

## Implemented adapters (Phase 3)

`hero`, `heroSlider`, `splitHero`, `services`, `featuredProjects`, `why`, `trustBar`, `reviews`, `reviewHighlights`, `faq`, `quote`, `onlineQuote`, `specialOffer`, `crew`, `serviceProcess`, `area`, `emerg`, `certifications`, `beforeAfter`, `instaGallery`, `footer`

Unknown app IDs → rejected.  
Unsupported catalogue status → not auto-selected in `install-apps.js`.

---

## Install / activation

`installAppsIntoDraft`:

1. Flatten Composer section content
2. Attach image selections by `sectionId`
3. Call `adaptApp`
4. Collect `installedApps[]` with `status: 'activated'`
5. Surface adapter errors to Composer (concept discarded if required apps fail)

Draft metadata:

```json
{
  "__websiteComposer": {
    "installedApps": [{ "appId": "services", "sectionKey": "services", "status": "activated" }],
    "contentInheritance": "none"
  }
}
```

---

## Validation

- Adapter-level field / item validation
- Concept-level `validateConcept` + industry leakage scan
- Draft forces unused `KNOWN_SECTION_KEYS` to `{ on: false }`
