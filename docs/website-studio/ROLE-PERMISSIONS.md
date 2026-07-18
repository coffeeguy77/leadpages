# Website Studio Role Permissions (Images & Studio)

**Updated:** 2026-07-18 (Phase 3)

Enforcement is **server-side**. Hiding UI is not sufficient.

## Website Studio access (existing)

| Actor | Website Studio (`/theme-studio-v2`) |
|-------|-------------------------------------|
| Superuser | Allowed |
| Partner | Allowed |
| Client | Denied (Studio product gate) |

## Image Service

| Capability | Superuser | Partner | Client |
|------------|-----------|---------|--------|
| Search owned Cloudinary assets | Yes | Yes | Yes (where product allows) |
| Search Pexels | Yes | Yes | Yes (API gate via Theme Studio actor today) |
| Select / replace draft images | Yes | Yes | Yes (where product allows) |
| Upload via Cloudinary sign | Yes | Yes | Per existing upload policy |
| AI image generation | **Yes** | **No** | **No** |
| AI image approve / replace | **Yes** | **No** | **No** |

### Server gates

- `lib/image-service/permissions.js` — `assertAiImageAccess`, `assertPexelsAccess`
- `api/image-service/search.js` — rejects `provider: 'ai-images'` / `forceAi` for non-superusers
- Cloudinary folder scoping under `leadpages/` (existing sign endpoint)

Tenant isolation: owned Cloudinary ranking can require `leadpages/{siteId}` prefix when `brief.siteId` is set.

---

## Composer generation

Composer accepts an `actor` object. Partners compose with Pexels/mock; they cannot force AI image paths.
