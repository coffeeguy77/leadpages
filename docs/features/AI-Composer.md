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

## Round 2 (2026-10-10) — fixes after the first live test

Tested end to end with the ACT Truck Hire design through the real code, the AI steps answered by a Claude worker given the exact live prompts and images, and every result rendered through `api/render.js`.

- **Quote form labels locked.** `lblName`, `lblPhone`, `lblJob`, `lblSuburb`, `lblDetail`, `suburbPh`, `detailPh` and `jobOptions` are never written by the AI (a booking form's "Pick up date" ended up labelling the Name box). Neutral job choices are set instead; a design form asking for other fields is reported as a gap.
- **Photo tidying.** Model boxes are trimmed 3% per side, then `POST /api/ai-composer/refine-photos` (Brain task `composer.photo_check`) re-checks each crop with a margin and returns a tight box that leaves out text, buttons, overlay panels and card borders; icon/text crops are dropped. Runs automatically after analysis (10 photos per call, 3 calls at once); a failed batch keeps the first crops.
- **Better app choice.** Planning rules: photo cards → Services; rows of figures/prices → Project Stats (second row → Activity Counter); location blocks → About Us; closing CTA banners → Special Offer; a form sharing a section with other content gets its own Quote section. Unused apps are tried before recording a gap.
- **Layout choices.** The AI may set an approved list of select fields (`CHOICE_FIELDS` in `catalogue.js`): text box image side and alignment, service card image fit/size, project feed card style. Values must be one of the field's options.
- **Colour safety.** Only accents, buttons, star colours, lines and light backgrounds are exposed (`SAFE_COLOR_NAMES`). Section backgrounds darker than luminance 0.6 and buttons with contrast below 3:1 are dropped — copied white headings were disappearing on LeadPages' light sections.
- **No cramming / neighbours.** The fill step is told which other sections share its image ("handled elsewhere") and must not stuff badges or neighbouring text into headlines; addresses, hours and feature lists go into body text.
- **Every app checked by rendering.** Each catalogue app was rendered with marker text in every field. Finance and Service Area Map render nothing from text alone and are no longer offered; dead playground fields were replaced (`specialOffer.cta`, `splitHero.subText`); emergency-availability hours are not offered (schedule mode only).
- **Footer.** No links in the design → no empty "Services" column.
- **FAQ answers (optional).** A tick-box on the review screen lets the AI draft missing FAQ answers using only facts visible in the design; drafted answers are flagged on the finish screen. Off by default.
- **Upload warning** below 1200px wide (photos cropped from small designs look soft at full width).

## Round 3 (2026-10-19) — the plan chooses each app's layout

Live runs used every app's default look, because the composer could only set a handful of layout fields (Split hero, Numbered/Photo/Feature/Story services, stacked Trust Bar, Split text box, Quotes reviews, Split FAQ, Journey/Milestone steps and all background tones were missing).

- **Layout catalogue.** `lib/ai-composer/layouts.js` lists every editor layout for the apps the composer places: what it looks like, when to use it, its background tones, photo side and the extra fields only it reads. The plan prompt shows them under each app ("LAYOUTS (first = default)").
- **Design-led planning.** For each section the model first writes `look` (columns, photo position, numbering, background), then picks the app **and** `layout`, plus `tone` (page / soft / tint / dark / brand) and `photoSide`, with a `reason`. Unknown values fall back to the app default (`cleanLayout` in `plan.js`); a tone or side the layout doesn't support is dropped.
- **Missing looks are reported.** When no layout can produce a section's look, the closest is used and a gap starting "Layout:" describes what is missing.
- **Fill step follows the layout.** `appFieldSheet(app, layout)` only offers fields that layout reads (e.g. `featureImage` + `featureItems` for services "feature", `splitH1` for the split hero). Layout keys (`services.mode`, `aboutUs.layout`, `specialOffer.layout`, `activityCounter.style`, `reviews.theme`) were removed from the fill-step `CHOICE_FIELDS` — the plan decides them.
- **Build.** `build-config` writes the layout, tone and side after the fill (the plan saw the whole page); a toned band doesn't also get the design's background colour. `_aiComposer.version` is 2 and each section records its `layout` / `tone`.
- **Review screen.** Each section shows the model's description of the look, and has Layout, Background and Photo-side pickers.
- **Trust Bar** badges now take a stroke icon name per badge.
- **Drift test.** `tests/ai-composer-layout-catalogue.test.js` fails when the editor offers a layout value that is not in `layouts.js` (`LAYOUTS` or `NOT_OFFERED`), and when a layout field isn't read by `lp-layouts.js` / the template. **Adding a layout to the editor now means adding it to `layouts.js` too.**

## Round 4 (2026-10-19/20) — partners, full mode, visual check, copy a website, custom layouts

### Who gets what (`lib/ai-composer/access.js`)

| Account | Mode | What they get |
|---|---|---|
| Super admin | full | Everything below; sites are live or draft; no monthly limit |
| Partner with `partners.composer_access = 'trusted'` | full | Everything below; sites are **partner demo sites** (draft, `is_mockup`, buy bar) |
| Partner (`composer_access` null / `'standard'`) | standard | Upload a design → plan → build → visual check; demo sites only |
| Partner with `composer_access = 'off'` | — | No access |

Flags: `AI_COMPOSER` (on/off for everyone), `AI_COMPOSER_PARTNERS` (partners at all).
Monthly limit on design analyses (`composer.design_plan` + `composer.url_plan` in `ai_requests`, from the 1st, UTC): 15 standard / 60 trusted by default; env `AI_COMPOSER_PARTNER_MONTHLY` / `AI_COMPOSER_TRUSTED_MONTHLY`; per partner `partners.composer_monthly_limit`.
Make a partner trusted: `update partners set composer_access = 'trusted' where id = '…';`
Migration: `db/ai_composer_partner_access.sql`.

### Visual check (all modes)

After the site is created: `api/ai-composer/snapshot.js` screenshots the built page (headless Chromium, `@sparticuz/chromium` + `puppeteer-core`, uploaded to Cloudinary), `api/ai-composer/review.js` (Brain `composer.visual_check`) compares each section with the design and may switch to another listed layout, tone or photo side, or re-fill; `api/ai-composer/update-site.js` rebuilds the site (only the same AI Composer site, within 120 minutes of creation). Two rounds at most. The finish screen lists each section's verdict.

### Copy a website (full mode)

`api/ai-composer/from-url.js` screenshots a public URL (SSRF-guarded: public IPs, ports 80/443, every sub-request checked), extracts its text, and the normal flow continues with the screenshot as the design; the fill copies the site's own words. Sites that block automatic visits (e.g. HTTP 403) or show an error page get a clear message to upload a screenshot instead.

### Custom layouts — "design blocks" (full mode)

When the visual check says a section's **arrangement** matches no layout of its app (`newLayout: true`), `api/ai-composer/new-layout.js` (Brain `composer.block_design`) designs a new layout for that app: an HTML template with placeholders for the app's own fields plus CSS. At most 2 per site; each is kept only if a re-check rates the section better, otherwise the site goes back to the standard layout.

- Safety (`lib/ai-composer/blocks.js`): allowed tags/attributes only (no scripts, iframes, forms, inline styles or event handlers); `src`/`href` only from a placeholder or `#…`; placeholders must be the app's fields; CSS has no `url()`, `@import` or escapes, only `@media`, and every selector is scoped to `.lpb-<id>`. Values are escaped when rendered and URLs limited to http(s), relative, `#`, `tel:`, `mailto:`.
- Rendering: `assets/lp-blocks.js` (loaded by `api/render.js` only for sites with `config.blockLayouts`). It hides the app's own markup in that section and draws the block from the same fields, so text and photos stay editable in the editor, and live preview updates.
- Config: `config.blockLayouts[id] = { app, name, template, css, fields }`, `config.sections[app].blockLayout = id`. Each site keeps its own copy.
- Editor: the app's panel shows "Use the custom layout …"; untick to use the app's standard layouts (stored as `blockLayoutPrev`, nothing deleted).
- Library: table `composer_layouts` (`db/ai_composer_layouts.sql`, RLS on, service role only). Super admins' layouts are **approved** at once; trusted partners' stay **this site only** until a super admin approves them. Approved layouts are offered to the planner for every new design (as `custom-xxxxxxxx` layouts). Super admins approve / restrict / hide them in the "Custom layouts" card on `/ai-composer` (`api/ai-composer/layouts.js`). Hiding never changes sites already using one.

### Template bug found (not fixed — needs approval)

`trade.template.json` has an unscoped `.tb-row{display:flex;flex-wrap:wrap;…}` rule meant for the Trust Bar. The Text Box app uses the same class, so its **"beside"** image layout wraps and drops the photo under the text on desktop — for every site, not just AI Composer. AI Composer works around it by using the Text Box **"wrap"** layout. A one-line scoped fix (e.g. `.tb-section .tb-row{flex-wrap:nowrap}` for desktop) would change how existing sites with "beside" render, so it is left for a decision.

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
| APIs | `api/ai-composer/analyse.js`, `refine-photos.js`, `fill.js`, `create-site.js`, `access.js`, `snapshot.js`, `review.js`, `update-site.js`, `from-url.js`, `new-layout.js`, `layouts.js` |
| Libraries | `lib/ai-composer/catalogue.js`, `layouts.js`, `tiles.js`, `prompts.js`, `plan.js`, `build-config.js`, `access.js`, `snapshot.js`, `visual.js`, `blocks.js`, `block-store.js`; `assets/lp-blocks.js` |
| Tests | `tests/ai-composer*.test.js` (layouts, catalogue drift, style, access, create-site, visual, blocks) |
| Extra layouts | See [App-Layouts.md](App-Layouts.md) — the composer can set the extra app layouts and the Bookings hire bar |

## Test checklist

- Sign in as super admin at `/ai-composer` (badge "Admin · full mode"); a partner sees "Partner · n of 15 designs this month"; a trusted partner sees full mode and the URL box.
- Upload a short design and a long full-page screenshot; review screen shows bands over the right sections and photo crops load.
- Change an app, reorder, remove a section; build; the editor opens the new site.
- New site shows only the chosen sections; no plumbing/trade copy anywhere.
- Existing sites, Layout Composer and other Brain features unchanged.
