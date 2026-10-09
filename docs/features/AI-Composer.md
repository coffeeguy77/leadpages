# AI Composer

**Status:** Shipped — super admin only. Flag `AI_COMPOSER` (default on; `AI_COMPOSER=0` switches the APIs off).
**Page:** `/ai-composer` (`ai-composer.html`)
**Added:** 2026-10-10

Upload a design image (screenshot or mockup). The AI picks the closest LeadPages apps for each section, copies the text, crops the photos and creates a new **live** site with **no trade pack and no trade defaults**. The site is then edited in `manage.html` like any other.

Layout Composer (`/layout-composer`) and Website Studio (On Ice) are untouched.

---

## Flow

1. **Upload** — browser uploads the image to Cloudinary (`leadpages/ai-composer/<yyyymm>/design-*`) via the existing `/api/cloudinary/sign`.
2. **Analyse** — `POST /api/ai-composer/analyse` `{ imageUrl, width, height, notes? }`
   - Tall images are cut into ≤ 8 overlapping tiles with Cloudinary crop URLs (Claude's vision downsizes anything over ~1568px on the long edge).
   - Brain task `composer.design_plan` returns sections → app keys, colours, business details, photo boxes, gaps.
   - `lib/ai-composer/plan.js` enforces: known apps only, one of each app, one hero (first), footer last, photo boxes → crops of the original.
   - Nothing is saved.
3. **Review** — admin can change the app per section, reorder, remove, edit name/phone/email/slug.
4. **Fill** — `POST /api/ai-composer/fill` `{ plan, sectionIds }` (≤ 3 per call; the page sends 2 per call, 3 calls in parallel).
   - Each section is re-read at full resolution (crop of just that section) with the app's exact field list.
   - Brain task `composer.app_fill`; values validated against the catalogue; photo ids → crop URLs.
5. **Create** — `POST /api/ai-composer/create-site` `{ plan, fills, businessName?, slug? }` builds `sites.config` and inserts a `sites` row (`template: 'trade'`, `status: 'live'`). Returns `/manage?site=<slug>`.

All three APIs: Supabase bearer token + `profiles.is_super_admin`.

---

## What the new config contains

- `name`, `businessName`, `trade: ''`, `phone`/`phoneText`, `email`, `seoTitle`, `seoDescription`
- `theme` — the five trade tokens read from the design (`pipe`, `hivis`, `steel`, `safety`, `lightBg`)
- `logo` — `{ mode: 'image', imageUrl }` when the logo was cropped
- `sections` — **every known section is set `on: false` first**; only the chosen apps are switched on and filled. Headline-type copy fields the AI did not fill are set to `''` and unfilled lists to `[]`, so no trade-template default text appears. Functional fields (form labels, buttons, placeholders) keep their neutral defaults.
- A photo/split hero switches the standard `hero` off. The footer is always on and last.
- `sectionOrder` — plan order, then `resolveSectionOrder()` (Trust Bar pin still applies).
- `_aiComposer` — `{ version, createdAt, designUrl, sections, gaps }` for reference.

---

## App catalogue

`lib/ai-composer/catalogue.js` builds the list from existing sources — no new source of truth:

| Source | Used for |
|--------|----------|
| `marketplace/playground-field-defs.json` (via `fixAllFieldDefs`) | Fields per app, normalised to live config paths |
| `marketplace/app-content.json` | What each app is for (prompt) |
| `lib/section-order.js` | Which section keys exist |

Exposed field kinds: text, image, colour (section-level). Selects, numbers, checkboxes, icons and links keep editor defaults. Lists accept up to 8 items.

Excluded apps: `navMenu`, `customHtml`, `searchCanvas`, `instaGallery`, `igProjectFeed`, `promotions`, `onlineQuote`, `estimateBuilder`, `orderStorefront`, `bookingStorefront`, `scrollingSponsorBanner`, `bookingCta`.

When a new app gets field defs in `playground-field-defs.json` and a key in `section-order.js`, it becomes available to AI Composer automatically.

---

## Brain changes (for this feature)

| File | Change |
|------|--------|
| `lib/brain/types.js` | `BrainMessage.content` may be a block array (`text` / `image` with https `url`) |
| `lib/brain/gateway.js` | Keeps block arrays from `input.messages`; honours per-route `maxRetries` |
| `lib/brain/router.js` | Passes `route.maxRetries` through |
| `lib/brain/adapters/anthropic.js` | Maps image blocks to `{ type: 'image', source: { type: 'url' } }`; capability `vision` |
| `lib/brain/adapters/shared.js` | `contentToText` — OpenAI / Gemini **refuse** image blocks with a clear error |
| `lib/brain/adapters/mock.js` | Reads text from block arrays |
| `lib/brain/config.js` | Model `anthropic:composer` (`AI_COMPOSER_MODEL`, else `ANTHROPIC_MODEL`); routes `composer.design_plan` and `composer.app_fill` — Anthropic only, **no mock fallback**, **no retries**, 55s timeout |

String-content callers behave exactly as before.

---

## Limits (by design)

- The result is LeadPages apps arranged like the design — not a pixel copy.
- Fonts stay as the trade template font (Barlow); there is no site font setting.
- Each app appears once per page; repeats are listed under "Not matched".
- Photo crops are approximate; swap them in the editor.
- Very long pages (> ~7× as tall as wide) are read at lower detail in the overview; each section is still re-read at full size when filling.
- Each call must finish inside Vercel's 60s `maxDuration`.

## Requirements

- `ANTHROPIC_API_KEY` (already used by Brain).
- Cloudinary on-the-fly transformations enabled for the `dzx6x1hou` account (crops and tiles are URL transformations). If "strict transformations" is on, the analysis and photo crops fail.

## Files

| Area | Paths |
|------|-------|
| Page | `ai-composer.html`, rewrite `/ai-composer` in `vercel.json` |
| APIs | `api/ai-composer/analyse.js`, `fill.js`, `create-site.js` |
| Libraries | `lib/ai-composer/catalogue.js`, `tiles.js`, `prompts.js`, `plan.js`, `build-config.js`, `access.js` |
| Tests | `tests/ai-composer.test.js` |

## Test checklist

- Sign in as super admin at `/ai-composer`; a non-admin gets "limited to platform admins".
- Upload a short design and a long full-page screenshot; review screen shows bands over the right sections and photo crops load.
- Change an app, reorder, remove a section; build; the editor opens the new site.
- New site shows only the chosen sections; no plumbing/trade copy anywhere.
- Existing sites, Layout Composer and other Brain features unchanged.
