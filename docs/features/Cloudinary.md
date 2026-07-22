# LeadPages Cloudinary — Complete Engineering Manual

**Document:** `features/Cloudinary`  
**Status:** Definitive engineering reference for signed image uploads in the editor  
**Audience:** Engineers rebuilding, extending, or debugging media uploads; AI development agents  
**Prerequisites:** [00-VISION](../00-VISION.md), [01-ARCHITECTURE](../01-ARCHITECTURE.md) §14, [10-EDITOR](../10-EDITOR.md), [04-SITE-BUILDER](../04-SITE-BUILDER.md)

> **Scope note:** This document covers the **customer asset pipeline** in `manage.html` (`cwToken`, `cwUpload`, `cwDelete*`) and the Vercel handlers **`/api/cloudinary/sign`** and **`/api/cloudinary/delete`**. Platform marketing assets (LeadPages logos, default favicon URLs hard-coded in HTML) live outside the `leadpages/` namespace and are not uploaded through this flow.

---

## Executive Summary

LeadPages stores editable site images on **Cloudinary** using **direct browser uploads**. The API secret never leaves the server: the editor requests a short-lived signature from `/api/cloudinary/sign`, then POSTs the file straight to `https://api.cloudinary.com/v1_1/{cloud}/image/upload`. Replacements and removals call `/api/cloudinary/delete` so orphaned assets do not accumulate.

Implementation is split across **`manage.html`** (client orchestration) and **`api/cloudinary/`** (auth + signing + Admin API deletes). There is no Cloudinary SDK in `package.json` — only `fetch`, `FormData`, and Node `crypto`.

| Fact | Detail |
|------|--------|
| **Cloud name (default)** | `dzx6x1hou` (`CW_CLOUD` in client; `CLOUDINARY_CLOUD_NAME` on server) |
| **Customer namespace** | `leadpages/{siteSegment}/{parts…}/{randomId}` |
| **Auth for APIs** | Supabase session Bearer via `cwToken()` |
| **Auth for Cloudinary upload** | Signed params from `sign.js` (`api_key`, `timestamp`, `signature`, …) |
| **Auth for Cloudinary delete** | Server-side Basic auth (API key + secret) in `delete.js` |
| **Config storage** | HTTPS `secure_url` in config JSON + companion `*_pid` / `_pid` fields |
| **Image prep** | Client-side canvas resize (`cwPrepImage`) before upload |

---

## Purpose

### Product purpose

Site owners and partners need to add logos, hero images, gallery photos, favicons, and list-item pictures **without FTP or a separate DAM**. Cloudinary provides CDN delivery, on-the-fly transforms (via URL), and reliable hosting. The editor exposes upload buttons next to URL fields so users can either paste an external link or upload from their device.

### Engineering purpose

- **Keep secrets off the client** — only the signing endpoint holds `CLOUDINARY_API_SECRET`.
- **Scope assets per tenant** — every customer upload lands under `leadpages/{siteId|slug}/…`, enforced server-side.
- **Avoid proxying bytes through Vercel** — large files go browser → Cloudinary; serverless functions stay small and fast.
- **Lifecycle management** — `cwDelete` on replace/clear; `cwDeletePrefix` on site deletion.

---

## Business Purpose

| Stakeholder | Value |
|-------------|-------|
| **Site owner** | Drag-free image management inside the editor; instant preview |
| **Partner / broker** | Branded client sites without managing separate media hosting |
| **LeadPages (platform)** | Predictable storage layout; bulk cleanup when sites are removed |
| **Operations** | `/api/cloudinary/diag` (related) validates credentials without exposing secrets |

Images in published HTML are ordinary Cloudinary URLs — no runtime dependency on the signing API after publish.

---

## User Types

| User | Can upload? | Typical assets |
|------|-------------|----------------|
| **Super-admin** | Yes | Any field on any site; site delete triggers prefix wipe |
| **Broker / partner** | Yes | Client site logos, sections, landing pages, mailer hero |
| **Site owner** (customer login) | Yes | Same editor surfaces when they have site access |
| **Anonymous visitor** | **No** | Public site only reads URLs already in config |
| **Marketplace admin** | **No** (this pipeline) | `marketplace-admin.html` expects pasted Cloudinary URLs |

All upload authorization is **“valid Supabase session”**, not per-site RLS on the Cloudinary APIs. Site-scoped isolation is by **folder naming** (`cwSiteSeg()`), not by verifying `currentSiteId` on the server.

---

## Permissions

### Client gate (`cwToken` / `cwUpload`)

```javascript
function cwToken() {
  return sb.auth.getSession().then(function (r) {
    return (r && r.data && r.data.session && r.data.session.access_token) || null;
  });
}
```

| Check | Behaviour |
|-------|-----------|
| No session | `cwUpload` throws `'Please sign in again'` |
| Expired session | Sign or delete returns `401` from API |
| Billing lock | `#bill-lock` blocks editor UI before uploads are reachable |

### Server gate (`verifyAuth` in sign.js / delete.js)

Both handlers call Supabase `GET /auth/v1/user` with the Bearer token and `SUPABASE_ANON_KEY`. Any authenticated user passes — there is **no** check that the `publicId` prefix matches a site they own.

### Namespace gate (hard scope)

| Endpoint | Rule |
|----------|------|
| `POST /api/cloudinary/sign` | `publicId` and `assetFolder` must match `/^leadpages\//` |
| `POST /api/cloudinary/delete` | `publicId` or `prefix` must match `/^leadpages\//` |

Non-matching IDs return `400`. Characters outside `[a-zA-Z0-9_/\-]` are stripped before signing/deleting.

### Overwrite protection

`sign.js` sets `overwrite: 'false'` and includes it in the signature. Combined with unique `public_id` values (`cwRand()`), uploads cannot clobber existing assets through the signing path.

---

## Asset Namespace Layout

Folder and public ID construction in `cwUpload`:

```text
_siteSeg  = cwSiteSeg()     → currentSiteId (lowercase, alnum + hyphen) OR slug OR 'unsited'
_parts    = parts.map(cwSeg) → each segment sanitized (default 'x')
_folder   = leadpages/{_siteSeg}/{part1}/{part2}/…
publicId  = {_folder}/{cwRand()}   → e.g. leadpages/abc123uuid/hero/bgImage/m5k2x9f
```

```text
leadpages/
  └── {siteId-or-slug}/
        ├── logo/
        ├── favicon/
        ├── page/{landingPageId}/
        ├── hero/{fieldKey}/
        ├── mailer/
        ├── lpfooter/
        ├── mobileBar/menuTrigger/
        ├── mobileBar/menuBg/
        └── {sectionId}/{fieldKey}/     ← wireSec image fields, listEditor images
```

**Site segment helpers:**

| Function | Source | Used for |
|----------|--------|----------|
| `cwSiteSeg()` | `currentSiteId` → fallback `currentSiteSlug` → `'unsited'` | Upload folder (primary) |
| `cwSiteSegSlug()` | `currentSiteSlug` only | Legacy prefix cleanup on site delete |

On **site delete** (`deleteSiteNow`), both `leadpages/{cwSiteSeg()}/` and `leadpages/{slug}/` (if different) are bulk-deleted before the Supabase `sites` row is removed.

---

## Upload Pipeline

### Sequence

```mermaid
sequenceDiagram
  participant U as User / Editor
  participant CT as cwToken()
  participant PI as cwPrepImage()
  participant Sign as POST /api/cloudinary/sign
  participant SB as Supabase Auth
  participant CL as Cloudinary Upload API
  participant CFG as sites.config (persist)

  U->>U: cwPick(file) or input[type=file]
  U->>CT: getSession access_token
  CT-->>U: Bearer token
  U->>PI: recompress if raster > ~800KB or > 2000px
  PI-->>U: Blob or original file
  U->>Sign: { publicId, assetFolder } + Bearer
  Sign->>SB: GET /auth/v1/user
  SB-->>Sign: 200 if valid
  Sign-->>U: signature, timestamp, apiKey, cloudName, publicId, assetFolder, overwrite
  U->>CL: POST FormData (file, signed fields)
  CL-->>U: secure_url, public_id
  U->>CFG: URL + *_pid field; persist(); previewApply()
  Note over U,CFG: If replacing, cwDelete(old publicId)
```

### `cwUpload(file, parts)`

Defined in `manage.html` (~2525–2537). **`parts`** is an array of path segments after the site folder (not a single string).

| Step | Action |
|------|--------|
| 1 | `await cwToken()` — abort if missing |
| 2 | `await cwPrepImage(file)` — max dimension 2000px, JPEG quality 0.8; skips SVG/GIF; skips only if already ≤ ~800 KB |
| 3 | Build `_folder` and `pid` |
| 4 | `POST /api/cloudinary/sign` with `{ publicId: pid, assetFolder: _folder }` |
| 5 | Assemble `FormData`: `file`, `api_key`, `timestamp`, `public_id`, `asset_folder`, `overwrite`, `signature` |
| 6 | `POST https://api.cloudinary.com/v1_1/{cloud}/image/upload` |
| 7 | Return `{ url: secure_url, publicId: public_id }` |

Errors surfaced to the user via `toast('Upload failed: …')` at call sites. Sign failure message: `'Could not authorise upload'`. Network failure to Cloudinary suggests trying a smaller image.

### `cwPrepImage(file, maxDim, quality)`

Client-side optimisation before upload (so editors do not need Photoshop “Save for Web”):

- Skips non-images, SVG, and GIF (returns original file).
- If already ≤ **~800 KB** and within max dimension (**2000px**), skips recompress.
- Otherwise draws to canvas and exports **JPEG at quality 0.8** (similar to Photoshop High).
- Large PNGs (over the skip threshold) convert to JPEG with a white backdrop; small PNGs keep transparency.
- Keeps the original when the compressed blob is not smaller.

Reduces upload failures and Cloudinary storage; not a hard server-side limit.

---

## Delete Pipeline

### `cwDelete(publicId)`

Fire-and-forget `POST /api/cloudinary/delete` with `{ publicId }`. Swallows errors (`catch(e){}`). Called when:

- User clears an image (`.cw-clr`, favicon clear, landing image clear)
- User replaces an upload (delete previous `_pid` if different)
- List row removed (`le-del` deletes all `*_pid` in row)
- Logo mode switched from image to text

### `cwDeletePrefix(prefix)`

Same endpoint with `{ prefix }`. Used in `deleteSiteNow()` for full site teardown. Server loops batched Admin API deletes (max 30 calls) until `partial` is false.

---

## API: `POST /api/cloudinary/sign`

**File:** `api/cloudinary/sign.js`  
**Method:** POST only (`405` otherwise)

### Request

| Header | Value |
|--------|-------|
| `Authorization` | `Bearer {supabase_access_token}` |
| `Content-Type` | `application/json` |

| Body field | Required | Description |
|------------|----------|-------------|
| `publicId` | Yes | Full intended public ID; must start with `leadpages/` |
| `assetFolder` | No | Defaults to parent path of `publicId`; must start with `leadpages/` |

### Response `200`

```json
{
  "signature": "<sha1 hex>",
  "timestamp": 1720185600,
  "apiKey": "<CLOUDINARY_API_KEY>",
  "cloudName": "dzx6x1hou",
  "publicId": "leadpages/…/…",
  "assetFolder": "leadpages/…",
  "overwrite": "false"
}
```

### Signing algorithm

Params signed (alphabetical `k=v` joined with `&`), then append `CLOUDINARY_API_SECRET`, SHA1 hex:

```text
asset_folder=leadpages/…&overwrite=false&public_id=leadpages/…/…&timestamp=…
```

Must match **exactly** what the browser sends to Cloudinary.

### Error responses

| Status | Cause |
|--------|-------|
| `401` | Missing/invalid Bearer |
| `400` | `publicId` or `assetFolder` not under `leadpages/` |
| `405` | Non-POST |

### Environment variables

| Variable | Role |
|----------|------|
| `SUPABASE_URL` | Auth verification |
| `SUPABASE_ANON_KEY` | Auth verification |
| `CLOUDINARY_API_KEY` | Returned to client for upload FormData |
| `CLOUDINARY_API_SECRET` | Signing only — never in response |
| `CLOUDINARY_CLOUD_NAME` | Defaults to `dzx6x1hou` |

---

## API: `POST /api/cloudinary/delete`

**File:** `api/cloudinary/delete.js`  
**Method:** POST only

### Request

Same Bearer auth as sign. Body **one of**:

| Mode | Body | Example |
|------|------|---------|
| Single asset | `{ "publicId": "leadpages/…" }` | Replace logo |
| Prefix wipe | `{ "prefix": "leadpages/siteuuid/" }` | Delete site |

### Single delete behaviour

`DELETE https://api.cloudinary.com/v1_1/{cloud}/resources/image/upload?public_ids[]={pid}&invalidate=true`  
Basic auth from resolved API key/secret.

Response: `{ ok, result }` — `502` if Cloudinary error.

### Prefix delete behaviour

1. Loop up to **30** batched prefix deletes (`partial: true` until done).
2. Best-effort delete empty folder via `/folders/{prefix}`.
3. Response: `{ ok, prefix, deletedCount, calls, partial, result }`.

If `partial: true` after max calls, caller may re-issue to finish (site delete does not retry today).

### Credential resolution

`resolveCreds()` accepts:

- `CLOUDINARY_URL` (`cloudinary://key:secret@cloud`)
- Or separate `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME`
- Tolerates connection string pasted into wrong env var (mirrors diag)

Missing key/secret → `500` `{ error: 'Cloudinary credentials are not configured.' }`.

---

## Config Storage (`_pid` fields)

Uploaded images persist **two values** in `sites.config` (or nested section objects):

| Field | Example | Purpose |
|-------|---------|---------|
| URL | `config.logo.imageUrl`, `sections.hero.bgImage` | Rendered in template / preview |
| Public ID | `config.logo._pid`, `sections.hero.bgImage_pid`, `lpCur.img_pid` | Delete on replace/clear |

Naming conventions:

- Section scalar images: `{key}` + `{key}_pid` (hidden input `#sec-{id}-{key}-pid`)
- List editor images: `{fieldKey}` + `{fieldKey}_pid` on each list item
- Landing pages: `img` + `img_pid` on page object
- Favicon: `favicon` + `_favPid` on root config
- Mailer: `MAILER.imageUrl` + `MAILER.imgPid`
- Mobile menu: `triggerImage` + `triggerImage_pid`, `bgImage` + `bgImage_pid`

Published sites read **URLs only** via `api/render.js` and client hydration — `_pid` fields are editor metadata.

---

## Editor Integration Points

All upload UX lives in **`manage.html`**. Legacy **`api/manage.html`** duplicates the same `cw*` functions (~2402+) for an older deploy path — treat **`manage.html`** as source of truth.

### UI helpers

| Function | Role |
|----------|------|
| `cwImgHTML(idOrData, ph, hint)` | Text field + Upload + Clear buttons + hint line |
| `cwPick(cb)` | Hidden `<input type="file" accept="image/*">` |
| `cwBusy(btn, on)` | Disables button, shows `…` during upload |

CSS classes: `.cw-row`, `.cw-up` (upload), `.cw-clr` (clear).

### Upload call sites (by feature)

| Feature | `cwUpload` parts | Size check (client) |
|---------|------------------|---------------------|
| Legacy logo (`lg-file`) | `['logo']` | 5 MB |
| Page editor logo | `['logo']` | 8 MB |
| Landing page hero | `['page', pageId]` | 8 MB |
| Section image fields (`wireSec`) | `[sectionId, fieldKey]` | via `cwPrepImage` |
| Footer custom logo | `['lpfooter']` | — |
| List editor images | `[secId, fieldKey]` | — |
| Favicon | `['favicon']` | 2 MB |
| Mobile menu trigger/bg | `['mobileBar','menuTrigger']`, `['mobileBar','menuBg']` | — |
| Mailer hero | `['mailer']` | — |

Manual URL entry (typing into text field) is allowed — no upload; no automatic `_pid` unless user uploads.

### Other uses of `cwToken()`

Not Cloudinary-specific but shares the same session helper:

- `_bpFetch` → `/api/billing/plans`
- `_billFetch` → billing paths
- Instagram OAuth / connect flows (~3270)

---

## Related Files

| File | Relationship |
|------|--------------|
| **`manage.html`** | **Primary** — `cwToken`, `cwUpload`, `cwDelete`, `cwDeletePrefix`, UI wiring |
| **`api/cloudinary/sign.js`** | Upload signature |
| **`api/cloudinary/delete.js`** | Asset + prefix deletion |
| **`api/cloudinary/diag.js`** | Ops diagnostic (auth + test upload); not used in normal editor flow |
| **`api/manage.html`** | Legacy duplicate of client Cloudinary code |
| **`api/render.js`** | Serves published HTML; `DEFAULT_FAVICON` Cloudinary URL |
| **`docs/10-EDITOR.md`** | Image upload flow summary |
| **`docs/01-ARCHITECTURE.md`** | Platform media architecture §14 |
| **`docs/02-DATABASE.md`** | `sites.config` JSON shape |
| **`marketplace-admin.html`** | Paste-only URLs — no `cwUpload` |

---

## Functions Reference

### Core (Cloudinary)

| Function | Lines (approx.) | Role |
|----------|-----------------|------|
| `CW_CLOUD` | ~2518 | Client fallback cloud name |
| `cwToken()` | ~2519 | Supabase session → Bearer |
| `cwSiteSeg()` | ~2520 | Site folder segment from id/slug |
| `cwSiteSegSlug()` | ~2521 | Slug-only segment for delete fallback |
| `cwSeg(s)` | ~2522 | Sanitize path segment |
| `cwRand()` | ~2523 | Unique filename suffix |
| `cwPrepImage(file, maxDim, quality)` | ~2524 | Canvas resize before upload |
| `cwUpload(file, parts)` | ~2525–2537 | Sign + direct upload |
| `cwDelete(publicId)` | ~2538 | Single asset delete API |
| `cwDeletePrefix(prefix)` | ~2539 | Bulk prefix delete API |
| `cwImgHTML(...)` | ~2540 | Editor markup for image fields |
| `cwBusy(btn, on)` | ~2541 | Upload button loading state |
| `cwPick(cb)` | ~2542 | File picker helper |

### Lifecycle

| Function | Role |
|----------|------|
| `deleteSiteNow()` | `cwDeletePrefix` ×2 then Supabase `sites.delete` |
| `listEditor` click handlers | Upload/clear/delete on list images; `le-del` deletes all `_pid` in row |

---

## Event Flow

### Replace image on section field

```mermaid
sequenceDiagram
  participant U as User
  participant UI as wireSec .cw-up
  participant UP as cwUpload
  participant DEL as cwDelete
  participant DB as persist()

  U->>UI: Click Upload
  UI->>UI: cwPick(file)
  UI->>UP: cwUpload(file, [sectionId, key])
  UP-->>UI: { url, publicId }
  UI->>UI: Set URL + hidden _pid
  UI->>DEL: cwDelete(previous pid) if changed
  UI->>DB: persist(); previewApply()
```

### Clear image

1. User clicks `.cw-clr`.
2. If `_pid` present → `cwDelete(pid)`.
3. Clear URL and `_pid` in config → `persist()` → `previewApply()`.

### Site deletion

1. Super confirms delete in Settings.
2. `cwDeletePrefix('leadpages/'+cwSiteSeg()+'/')`.
3. If slug segment differs → second prefix delete.
4. Supabase delete site row; analytics retained per product copy.

---

## User Journey

```mermaid
flowchart TD
  A[Open /manage, load site] --> B[Details / Landing / Mailer tab]
  B --> C{Add image?}
  C -->|Upload| D[cwPick → choose file]
  C -->|Paste URL| E[Type in text field — no _pid]
  D --> F[cwUpload → sign → Cloudinary]
  F --> G{Success?}
  G -->|Yes| H[Preview updates; save/publish persists URL]
  G -->|No| I[toast Upload failed]
  H --> J{Replace later?}
  J -->|Yes| K[New upload → cwDelete old pid]
  J -->|Clear| L[cwDelete pid → empty field]
  M[Super deletes site] --> N[cwDeletePrefix entire folder]
```

---

## Performance Considerations

| Area | Behaviour | Risk |
|------|-----------|------|
| **Direct upload** | Bytes bypass Vercel | Good — avoids 4.5 MB serverless limits |
| **`cwPrepImage`** | Main-thread canvas | Large originals may briefly block UI |
| **Prefix delete** | Up to 30 Admin API round-trips | Very large folders may leave `partial: true` |
| **`cwDelete` errors swallowed** | No user feedback on failed cleanup | Orphan assets in Cloudinary |
| **No upload queue** | Parallel uploads possible | Rare race on same field |

---

## Security Considerations

| Topic | Detail |
|-------|--------|
| **Secret handling** | `CLOUDINARY_API_SECRET` only in `sign.js` / `delete.js` / `diag.js` |
| **Namespace enforcement** | Server rejects IDs outside `leadpages/` |
| **Auth breadth** | Any valid Supabase user can sign any `leadpages/…` path — no per-site ACL on sign/delete |
| **Overwrite** | Disabled in signature; unique IDs prevent accidental overwrite |
| **XSS** | URLs stored in config; rendered through template escaping in most paths |
| **External URLs** | Users can paste non-Cloudinary URLs — third-party hosting not validated |
| **diag endpoint** | Authenticated test upload to `leadpages/_diag/` — ops tooling only |

**Hardening opportunity:** Validate `publicId` contains the uploader’s allowed site segment (from JWT + `sites` membership) before signing.

---

## Technical Debt

| ID | Issue | Location | Impact |
|----|-------|----------|--------|
| TD-C1 | **No per-site auth on sign/delete** | `sign.js`, `delete.js` | Authenticated user could delete another tenant’s assets if public ID known |
| TD-C2 | **`cwDelete` silent failures** | `cwDelete`, `cwDeletePrefix` | Orphan Cloudinary assets; no toast |
| TD-C3 | **Prefix delete may be partial** | `deleteSiteNow` | Site row deleted but some Cloudinary files remain if `MAX_CALLS` hit |
| TD-C4 | **Dual manage.html copies** | `manage.html` vs `api/manage.html` | Drift risk |
| TD-C5 | **Inconsistent size limits** | 2 MB favicon, 5 MB legacy logo, 8 MB elsewhere | User confusion |
| TD-C6 | **`cwSiteSeg()` uses UUID** | Folder name | Slug-only bookmarks to old paths after id-based re-upload; delete tries both |
| TD-C7 | **Manual URL without `_pid`** | Paste-only fields | Clear button may not delete external host image (expected) |
| TD-C8 | **Platform assets mixed in docs** | Hard-coded logo/favicon URLs | Not tenant-scoped; separate from customer pipeline |

---

## Future Improvements

1. **Site-scoped signing** — map JWT user → allowed `leadpages/{siteId}/` prefix.
2. **Surface delete failures** — log or toast when `cwDelete` returns non-OK.
3. **Retry prefix delete** — loop in `deleteSiteNow` until `partial === false`.
4. **Unified client size limit** — single constant + pre-`cwPrepImage` check.
5. **Upload progress** — XMLHttpRequest or fetch streaming for large files.
6. **Video/raw support** — would require resource type changes beyond `image/upload`.
7. **Remove `api/manage.html` duplicate** or auto-sync from primary file.
8. **Transform URLs** — optional `f_auto,q_auto` in render path for performance.

---

## Cloudinary Architecture

```mermaid
flowchart TB
  subgraph client [manage.html]
    CW[cwToken / cwUpload / cwDelete]
    UI[Section + list image fields]
    CFG[sites.config URL + _pid]
  end

  subgraph vercel [Vercel /api]
    SIGN[cloudinary/sign.js]
    DEL[cloudinary/delete.js]
    SBV[Supabase /auth/v1/user]
  end

  subgraph cloudinary [Cloudinary dzx6x1hou]
    UP[POST /v1_1/.../image/upload]
    ADM[Admin API DELETE]
    CDN[res.cloudinary.com CDN]
  end

  subgraph published [Live site]
    REN[api/render.js + template]
  end

  UI --> CW
  CW -->|Bearer| SIGN
  SIGN --> SBV
  SIGN -->|signature| CW
  CW -->|FormData| UP
  UP --> CDN
  CW -->|Bearer| DEL
  DEL --> ADM
  CW --> CFG
  CFG --> REN
  REN --> CDN
```

---

## Connections to Other Systems

### Editor / publish

- Uploads update in-memory `data` / `c.sections` and call `persist()` (localStorage) immediately.
- **Publish** (`lpPublish` / site update) writes config including image URLs to Supabase `sites.config`.
- Preview iframe uses same URLs via `previewApply()` — no re-upload on publish.

### Site builder / templates

Templates reference config image fields (hero backgrounds, gallery arrays, etc.). Missing URL → section hidden or placeholder per template logic.

### Billing

No direct Cloudinary billing integration. Locked accounts cannot reach upload UI via `lpBillingGate()`.

### Site deletion

`deleteSiteNow` is the only automated **bulk** Cloudinary cleanup. Individual field clears rely on `cwDelete`.

### Diagnostics

`/api/cloudinary/diag` — authenticated JSON report: credential source, Admin ping, 1×1 test upload to `leadpages/_diag/test_{timestamp}`. Use when uploads fail with 401/403 from Cloudinary.

---

## Data Flow

```mermaid
flowchart LR
  subgraph upload [Upload path]
    F[File picker]
    T[cwToken]
    S[/api/cloudinary/sign]
    CL[Cloudinary upload]
  end

  subgraph storage [Persistence]
    LS[localStorage persist]
    SB[(sites.config)]
  end

  subgraph serve [Delivery]
    PV[Preview iframe]
    LIVE[Published site]
    CDN[Cloudinary CDN]
  end

  F --> T --> S --> CL
  CL -->|secure_url| LS --> SB
  CL --> PV & LIVE
  PV & LIVE --> CDN
```

---

## API Calls Summary

| Endpoint | Method | Called by | Body | Response used |
|----------|--------|-----------|------|----------------|
| `/api/cloudinary/sign` | POST | `cwUpload` | `{ publicId, assetFolder }` | `signature`, `timestamp`, `apiKey`, `cloudName`, `publicId`, `assetFolder`, `overwrite` |
| `/api/cloudinary/delete` | POST | `cwDelete`, `cwDeletePrefix` | `{ publicId }` or `{ prefix }` | `ok`, `result` / `deletedCount`, `partial` |
| `https://api.cloudinary.com/v1_1/{cloud}/image/upload` | POST | `cwUpload` | `multipart/form-data` (signed) | `secure_url`, `public_id` |
| Supabase `/auth/v1/user` | GET | `sign.js`, `delete.js` | — | 200 = authorized |

Auth on LeadPages APIs: `Authorization: Bearer {access_token}` from `cwToken()`.

---

## Environment Variables

| Variable | Required by | Notes |
|----------|-------------|-------|
| `SUPABASE_URL` | sign, delete, diag | Auth verification |
| `SUPABASE_ANON_KEY` | sign, delete, diag | Auth verification |
| `CLOUDINARY_API_KEY` | sign, delete | Exposed to browser only via sign response |
| `CLOUDINARY_API_SECRET` | sign, delete | **Server only** |
| `CLOUDINARY_CLOUD_NAME` | sign, delete | Default `dzx6x1hou` |
| `CLOUDINARY_URL` | delete, diag | Alternative `cloudinary://key:secret@cloud` |
| `DEFAULT_FAVICON` | `api/render.js` | Optional override for platform default icon URL |

---

## Glossary

| Term | Meaning |
|------|---------|
| **`cw*`** | Cloudinary wrapper functions in `manage.html` |
| **`_pid` / `*_pid`** | Cloudinary `public_id` stored for lifecycle deletes |
| **`leadpages/`** | Platform-enforced root folder for all customer uploads |
| **`asset_folder`** | Cloudinary dynamic-folder field — required so assets appear under `leadpages/` not account root |
| **`cwSiteSeg()`** | Sanitized site id/slug used as second path segment |
| **Direct upload** | Browser POSTs file to Cloudinary after server signs params |

---

*Last updated: July 2026 — reflects `manage.html` and `api/cloudinary/*` on branch `main`.*
