# Image Service

**Status:** Design only. Do not implement in the architecture-reset phase.

---

## Purpose

Shared abstraction for website imagery used by Website Studio / Composer (and later Editor).

Responsibilities:

1. Accept an **image slot** (section, subject, mood, constraints)  
2. Resolve an asset via a provider  
3. Return a stable URL / public id + attribution metadata  
4. Respect role permissions (who may search/upload)  
5. Never embed provider API keys in the browser  

---

## Providers (planned)

| Provider | Use | Existing code |
|----------|-----|---------------|
| **Cloudinary** | Upload, transform, host | `api/cloudinary/sign.js`, `delete.js`, manage.html uploads |
| **Pexels** | Stock search for concept fills | **Not present** |
| Later | Unsplash / others | — |

---

## Current Theme Studio behaviour

- Concepts include `imagery[]` direction notes only  
- Adapter **ignores** imagery (records `concept_field_not_mapped`)  
- No automatic stock fetch  
- No Cloudinary upload from Theme Studio APIs  

---

## Proposed interface (sketch — not implemented)

```text
imageService.resolveSlot({
  siteId?,
  actor,
  slot: { sectionKey, subject, composition, avoid[] },
  providerPreference: ['cloudinary-library', 'pexels'],
  licenseConstraints
}) → { ok, asset: { url, width, height, provider, attribution }, warnings }
```

Browser calls LeadPages APIs only; server calls providers.

---

## Permissions

| Actor | Search stock | Upload to Cloudinary | Attach to draft concept |
|-------|--------------|----------------------|-------------------------|
| Superuser | yes | yes | yes |
| Partner | yes (quota TBD) | yes (tenant folder) | yes |
| Client (later) | limited | own site only | yes |

---

## Non-goals

- Replacing the Editor media library UX in Phase 3  
- Training custom diffusion models  
- Storing binary images inside `theme_studio_versions` JSON (store URLs/ids only)  
