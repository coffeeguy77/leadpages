# Image Service

**Status:** Implemented (Phase 3–4) — draft resolution + persistent approval; live publish unchanged.

---

## Purpose

Shared server-side imagery for Website Studio / Website Composer (reusable by other LeadPages features later).

```text
Website Composer
  → Image Service
    → Provider Router (resolve.js)
      → Cloudinary (owned / library assets)
      → Pexels (stock)
      → AI images (superuser only; interface stub)
      → Safe placeholder
```

Browser code must call LeadPages APIs only. Provider API keys never ship to the client.

---

## Module layout

```text
lib/image-service/
  index.js
  constants.js
  permissions.js
  cache.js
  image-brief.js
  ranking.js
  resolve.js
  providers/
    cloudinary.js
    pexels.js
    ai-images.js
    mock.js

api/image-service/
  search.js
  import-cloudinary.js
```

---

## Environment variables

| Variable | Role |
|----------|------|
| `PEXELS_API_KEY` | Server-only Pexels auth |
| `IMAGE_PROVIDER_DEFAULT` | Preferred stock provider (expected: `pexels`) |
| `CLOUDINARY_CLOUD_NAME` | Existing Cloudinary cloud |
| `CLOUDINARY_API_KEY` | Existing |
| `CLOUDINARY_API_SECRET` | Existing (never returned) |
| `CLOUDINARY_URL` | Optional `cloudinary://…` form |

Missing `PEXELS_API_KEY` fails gracefully → mock results in Composer (`allowMockImages`) or placeholder.

---

## Provider priority

1. Relevant owned Cloudinary assets (folder/tag relevance; optional site scope)
2. Pexels stock search (cached)
3. AI generation — **superuser only**, and only if a provider is implemented
4. Safe placeholder

Relevance beats provider order: an irrelevant Cloudinary asset is not selected merely because Cloudinary is first.

---

## Structured image briefs

Created by `lib/website-composer/image-direction.js` + `createImageBrief`.

Fields include: `sectionId`, `appId`, `purpose`, `subject`, `setting`, `industry`, `visualStyle`, `photographyStyle`, `lighting`, `orientation`, `targetAspectRatio`, `minimumWidth`/`Height`, `humanPresence`, `textOverlaySafeArea`, `avoidTerms`, `altTextIntent`.

Each concept shares one **image direction** profile (warm hospitality, dark luxury, trades documentary, etc.).

---

## Caching & re-render

Search results are cached in-memory (`cache.js`, 30 min TTL).  
Selections are stored on the draft (`__websiteComposer.imageSelections`).  
Preview re-renders must reuse stored selections — Composer does not re-search on every HTML preview.

---

## Attribution metadata

Each selection stores provider, asset id, photographer, source URLs, dimensions, search query, brief id, section/app ids, approval/import status, timestamps.

---

## Cloudinary draft import

`buildCloudinaryImportPlan` + `POST /api/image-service/import-cloudinary` produce a signed-upload plan under `leadpages/{siteId}/website-studio/...`.  
Actual binary upload uses existing `/api/cloudinary/sign`.  
**Does not publish** or hotlink production sites to temporary Pexels URLs.

---

## Permissions

See **[ROLE-PERMISSIONS.md](./ROLE-PERMISSIONS.md)** and **[IMAGE-APPROVAL.md](./IMAGE-APPROVAL.md)**.  
Provider details: **[IMAGE-PROVIDERS.md](./IMAGE-PROVIDERS.md)**.
