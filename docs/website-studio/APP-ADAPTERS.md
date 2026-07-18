# Website Composer App Adapters

**Updated:** 2026-07-18 (Phase 4)

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
  services?: array,
  writtenPaths: string[],
  install: { sectionKey, position_slot },
  errors?: [{ code, message, path }],
  diagnostics?: { adapter }
}
```

| Concern | Behaviour |
|---------|-----------|
| Required fields | Fail closed (`ok: false`) if missing |
| Item counts | Enforce min/max from metadata / adapter rules |
| Variants | Only emit supported variant ids |
| Images | Accept resolved URLs from Image Service selections |
| Defaults | Safe empty-safe defaults only when optional |
| Install | Marks `on: true` + provenance; recorded in `installedApps` |

---

## Implemented adapters

### Core (Phase 3+)

`hero`, `heroSlider`, `splitHero`, `services`, `featuredProjects`, `why`, `trustBar`, `reviews`, `reviewHighlights`, `faq`, `quote`, `onlineQuote`, `specialOffer`, `crew`, `serviceProcess`, `area`, `emerg`, `certifications`, `beforeAfter`, `instaGallery`, `footer`

### Promoted in Phase 4

`textBox`, `featureStrip`, `customerReactions`, `jobsFeed`, `projectFeed`, `projectStats`, `serviceAreas`, `beforeAfterFeed`, `navMenu` (limited), `heroBeforeAfter` (limited)

### New Phase 4 Marketplace apps

`productCollection`, `clientLogos`, `bookingCta`, `brandStory`, `packageCompare`

Unknown app IDs → rejected.  
`supported-with-limitations` without adapter → not auto-selected.  
`incompatible` (`seoTokens`) → never selected as a section app.

---

## Install / activation

`installAppsIntoDraft`:

1. Flatten Composer section content  
2. Attach image selections by `sectionId`  
3. Run adapter per app  
4. Write `sections[sectionKey]` + `installedApps`  
5. Keep unused mounts off  

Refinement that adds apps uses the same adapter path (`apply-patch.js` / refine planner).
