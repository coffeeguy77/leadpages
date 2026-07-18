# Image Providers

**Updated:** 2026-07-18 (Phase 4)

## Cloudinary

| Item | Detail |
|------|--------|
| Module | `lib/image-service/providers/cloudinary.js` |
| Env | `CLOUDINARY_*` / `CLOUDINARY_URL` (existing platform vars) |
| Role | Rank owned/library assets; build import plans |
| Upload | Existing `api/cloudinary/sign.js` under `leadpages/` |
| Isolation | Optional `brief.siteId` requires `leadpages/{siteId}` prefix |

Secrets are never returned from Image Service helpers or API responses.

## Pexels

| Item | Detail |
|------|--------|
| Module | `lib/image-service/providers/pexels.js` |
| Env | `PEXELS_API_KEY` (server-only) |
| Default flag | `IMAGE_PROVIDER_DEFAULT=pexels` |
| API | `POST /api/image-service/search` |
| Features | query, orientation, per-page, attribution, dimensions, rate-limit/error handling |
| Fallback | If unset → mock provider (Composer) or placeholder |

All Pexels HTTP calls are server-side.

## AI images

| Item | Detail |
|------|--------|
| Module | `lib/image-service/providers/ai-images.js` |
| Status | Interface only — `isImplemented() === false` |
| Access | Superuser only (`assertAiImageAccess`) |
| Partners / clients | Hard deny on server |

No new paid AI provider was added in Phase 3.

## Mock / placeholder

| Provider | When |
|----------|------|
| `mock` | Tests / local without Pexels key (`allowMock`) |
| `placeholder` | No suitable candidate after filters |

## Not used

- Google Images scraping  
- Competitor website scraping  
- Arbitrary hotlinked web pages  
- Client-side provider API keys  
