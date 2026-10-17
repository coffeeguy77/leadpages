# Extra app layouts + Bookings hire bar

Opt-in layouts for existing trade-template apps, added so AI Composer (and anyone in the editor) can get closer to real designs. **Every layout is off until its config key is set**, so existing sites render exactly as before (checked by rendering 7 live site configs before/after).

## How it works

- `trade.template.json` loads `assets/lp-layouts.css` and `assets/lp-layouts.js`.
- `lp-layouts.js` wraps `window.__applyTradeConfig` (same pattern as the Instagram feeds), so it runs on page load and on every editor preview update. Injected nodes carry `data-lpl` and are rebuilt each run.
- The Bookings hire bar is drawn by `assets/lp-booking-hire.js` (+ `.css`). `api/render.js` injects an empty `<section data-sec="bookingStorefront" class="… bk-hire">` plus the two assets when `sections.bookingStorefront.layout === 'hire'`. In the editor preview, `lp-layouts.js` loads the hire script on demand when the layout is switched before the page is re-rendered.
- Editor: each app panel gets a **Layout options** card (`LPL_LAYOUT_SPECS` / `lplMountLayoutCard` in `manage.html`). Services gets a fourth **Style** option.

## Config keys

| App | Keys |
|-----|------|
| Hero Slider | `badges[{icon,title,text}]` (icon row under the sub-headline), `textCase: 'normal'` |
| Services | `mode: 'tick'` (photo + title + tick cards), `tickTheme: 'dark' \| 'light'` |
| Activity Counter | `style: 'strip'` (compact icon + figure + label row) |
| Text Box | `eyebrowStyle: 'tag'`, `features[{icon,text}]`, `ctaLabel`, `ctaHref` |
| Reviews | `theme: 'dark'`, `badge: 'google'`, `bgImage`, `summaryRating`, `summaryText`, `summaryCtaLabel`, `summaryCtaHref` |
| About Us | `layout: 'location'` + `address`, `hours`, `mapQuery`, `features[{icon,text}]` (uses existing `eyebrow`, `heading`, `intro`, `image`, `ctaLabel` → Google Maps directions) |
| Special Offer | `layout: 'banner'`, `bgImage`, `ctaHref`, `points[].icon` |
| How It Works | `sideImage`, `calloutTitle`, `calloutText`, `calloutLinkLabel`, `calloutLinkHref`, `calloutIcon` |
| FAQ | `columns: 2`, `ctaLabel`, `ctaHref` (no link = the button opens every answer), `emptyAnswer` (line for a question with no answer; two columns default to "call us on …") |
| Bookings | `layout: 'hire'`, `hireHeading`, `icon`, `hireCtaLabel`, `dateLabel`, `timeLabel`, `durationLabel`, `openTime`, `closeTime`, `timeStep`, `durations[{label,days}]`, `points[{icon,text}]`, `rates[{label,price,unit,note}]`, `overlapHero` (default on), `bg`, `accent` |

## Layouts added October 2026 (replace the old "Bold" page design)

Every one is a choice in the app's **Layout options** card (Services: the **Style** list), off by default.
All drawn markup carries `data-lpe` hooks, so app tags, the editing outline and **Auto-select** work on every part.

| App | Key | What it draws |
|---|---|---|
| Hero Slider | `layout: 'booking'` + `bookTitle`, `bookCta`, `bookNote`, `imageCaption` | First slide as headline (`heading` + `highlightText`), sub-line, badges as ticks, slide photo, and a month calendar card. Each day shows its price — `from_cents` from `GET /api/bookings/hire/public?action=calendar` when Bookings hire is live, otherwise the Bookings rate cards. Live: free / 1–2 left / booked-out dots, pick-up time and length, total, button opens `LPBookingFlow`. Not live: the button calls the business. |
| Bookings | `layout: 'priceweek'` + `weekHeading`, `weekIntro` | Seven day cells from the rate cards (labels like "Mon – Thu", "Friday", "Weekends"); falls back to the cards as they are when the labels don't cover the week. `points` show as notes. |
| Text Box | `layout: 'band'` + `bandTone: 'dark'`, `dimLength`, `dimWidth`, `dimHeight`, `dimLift` | Brand-colour band. A feature written "Label: value" becomes a spec row; others are ticks. Dimensions draw a labelled box instead of the photo. |
| Services | `mode: 'iconrow'`, `tickTheme: 'light'|'dark'|'brand'` | Icon, title and short line per item. |
| How It Works | `layout: 'numbered'` | Big step numbers in a row; the callout becomes a panel under the steps (its button calls the business unless a link is set). |
| Reviews | `layout: 'quotes'` | Large quote text under a brand line instead of cards. |
| FAQ | `layout: 'split'` | Heading (and "view all") on the left, questions on the right. Empty answers show the "call us on …" line. |
| Map & Hours | `tone: 'grey'`, `mapStyle: 'grey'` | Grey band / greyscale map. |
| Map & Hours | `layout: 'bleed'` | Edge map: the map runs to the page edge; address, stacked hours and an outline directions button on a grey panel. |
| Reviews | `quoteStars: true` | Stars on the Quotes layout (hidden by default). |
| Hero Slider | `bookCtaCall` | Card button text until online booking is live (default "Call to book"). |
| CTA Banner | `width: 'full'` | Full-width band instead of a card. |

## Font sets (`config.fontSet`)

Branding → **Fonts** picks a set for the whole site: Classic Trade (Barlow Condensed + Barlow, the default), Archivo Bold (extra-condensed Archivo headings — the ACT Truck Hire look), Oswald Strong, Bebas Poster, Montserrat Modern, Poppins Friendly, Space Grotesk Tech, Playfair Elegant. Definitions: `assets/lp-fonts.js`. The template and app stylesheets use `var(--lp-font-head,"Barlow Condensed")` / `var(--lp-font-body,"Barlow")` (`scripts/patch-font-vars.js`), so a set only sets those variables plus heading width/weight/case; `api/render.js` `injectFontSet` adds the Google font and the variables to `<head>`, and `lp-layouts.js` switches them live in the editor preview. Per-app capitals settings still win over the set's heading case.

The whole-page "Bold" design (`config.design = 'bold'`, `assets/lp-skin-bold.*`) is removed: it drew a fixed page that
could not be edited with the apps. A site that still has `design: 'bold'` saved now renders its normal apps.

Icons are LeadPages icon names from `icons.js` (a short emoji typed in the editor is shown as text).

## Bookings hire bar

- Put Bookings straight under the hero in **Position**; the card overlaps the hero's bottom edge (`overlapHero: false` turns that off).
- **Live mode** — when the site has Bookings enabled with a `resource_hire` service and hire resources: "Check availability" quotes every vehicle through `POST /api/bookings/hire/quote` (`public: true`), shows price + availability, and books through `POST /api/bookings/public` (status `pending`; staff confirm in Bookings).
- **Enquiry mode** — otherwise a short form opens inside the bar (name, phone, email, notes) and the request is saved as a lead through `/api/leads` with the pick-up date, time and duration, so it lands in the site's leads and the owner's email.
- The editor's Bookings panel shows whether Bookings is set up for the site (not switched on / on but no hire service or vehicles / live).
- Backend pricing supports a weekday rate, a weekend rate and a public-holiday rate per vehicle; a separate Friday rate is not supported yet (the rate cards are display copy).
- The rate cards are display copy from the editor; live prices come from Bookings.

## Heritage set and editorial layouts (Oct 2026)

All opt-in; nothing changes until chosen.

| Where in the editor | Option | Config |
| --- | --- | --- |
| Branding → Fonts | **Newsreader Heritage** — Newsreader serif headings and body, Jost tracked capitals for eyebrows, menu links and buttons | `fontSet: 'heritage'` (`lp-fonts.js` set gains an optional `eyebrow` font → `--lp-font-label`) |
| Logo → Header call-to-action | **Button shape: Rectangle** (square corners, small spaced capitals) and **Arrow after the text** | `sections.header.btnShape = 'rect'`, `btnArrow = true` |
| Menu | **Text style: Small spaced capitals** | `sections.navMenu.textStyle = 'caps'` |
| Services → Style | **Story** — eyebrow, heading, intro and a text link beside one photo; cards hidden. Story layout card: photo, link text/link, background (page / soft / brand tint / dark), photo side | `sections.services.mode = 'story'` + `storyImage`, `storyLinkLabel`, `storyLinkHref`, `storyTone`, `storySide` |
| How It Works Steps → Layout | **Journey** — heading, intro and link left with a divider; icon, title and text per step in a row with arrows | `sections.serviceProcess.layout = 'journey'` + `journeyTone`; link = `calloutLinkLabel` / `calloutLinkHref` |
| Project Portfolio → Style | **Feature cards** — large photo, title + arrow, short text; optional **Card link** per project makes the card clickable | `sections.featuredProjects.layout = 'cards'`, `projects[].link` |
| Hero Slider, Hero, Split Hero → Layout / Text options | **Headline case** (theme / as typed / all lowercase / all capitals), **Eyebrow case** (capitals / as typed / lowercase), **Eyebrow position** (above / below the headline) | `textCase`, `eyebrowCase`, `eyebrowPos: 'below'` |

| Logo → Logo image, Footer → Brand & logo | **Logo colour override** — paints an image logo one colour, keeping its transparency (SVG `feFlood` + `feComposite in SourceAlpha` filter), separately for the header and the footer | `logo.tint`, `sections.footer.logoTint` (`#rrggbb`) |

| How It Works Steps → each step + Layout options | **Image** per step (replaces its icon, any layout), **Step image size** (48–130px), **Step image colour** (paints transparent images one colour) | `serviceProcess.steps[].image`, `stepImageSize`, `stepImageTint` |

| Branding → Buttons | **Button corners** for every button on the site: theme default / square / rounded / pill | `buttonShape` |
| Each app → Layout options → Button corners; Logo → Header call-to-action → Button shape | Override for that app's buttons (header also keeps **Rectangle** with spaced capitals) | `sections.<app>.btnShape`, `sections.header.btnShape` |
| Hero Slider → Layout | **Half-height banner** — always half the slider height; choose which text shows: eyebrow and title (on by default) and intro text (the slide sub-headline, off by default) | `sections.heroSlider.layout = 'half'`, `halfEyebrow`, `halfTitle`, `halfIntro` |
| Footer → Footer layout | **Minimal** — logo, divider, text; right: LeadPages logo (strip below hidden) / button / nothing (strip below shown) | `sections.footer.layout = 'minimal'`, `minimalText`, `minimalRight`, `minimalBtnLabel`, `minimalBtnHref` |
| Order Storefront → Shop layout & order page | **Editorial** shop (category heading, search, clean rows, order summary card, no inner scroll panel) and **Order page banner** on `/order` (half-height Hero Slider with its own eyebrow/title/intro/photo, each text line can be shown or hidden) | `sections.orderStorefront.layout = 'editorial'`, `catIntro`, `searchPlaceholder`, `cartTitle`, `pageBannerOn`, `pageBannerEyebrow`, `pageBannerTitle`, `pageBannerIntro`, `pageBannerImage`, `pageBannerShowEyebrow`, `pageBannerShowTitle`, `pageBannerShowIntro` |

Order page colours: the shop takes its colours from the Order Storefront colour fields (section variables). Live pages are CDN-cached (15 min + 1 h stale-while-revalidate) and **Publish** purges that cache — changes saved without publishing can show the old look on `/order` for up to about an hour. Branding → CSS overrides rewrite hex values in the page HTML only, so they can't reach colours inside the shop's own stylesheet; set the shop's colours in its colour fields.

The Newsreader + Jost pairing is the closest Google Fonts match found by rendering candidates against a reference design; it is not an identification of the fonts in that design.

Tests: `tests/app-layouts-v4.test.js`.

## Fixes made alongside

- `injectBookingStorefront` checked `html.includes('data-sec="bookingStorefront"')`, which was always true on trade pages (the FOUC-guard CSS mentions it), so the Bookings CTA was never placed. It now looks for a real `<section>` tag. No live site had Bookings switched on.
- The Bookings page-section editor ("Page section" button on the Bookings tab) fell back to Details because `bookingStorefront` was missing from `TRADE_SUBTABS`; it is now listed as **Bookings**.

## AI Composer

`lib/ai-composer/catalogue.js` `LAYOUT_FIELDS` exposes these keys (choices limited to listed values, icons validated against `icons.js`). Bookings is placed only as the hire bar (`build-config` forces `layout: 'hire'`). Lists added only by a layout never cause an app to be dropped.

## Files

`assets/lp-layouts.{js,css}`, `assets/lp-booking-hire.{js,css}`, `trade.template.json` (2 tags), `api/render.js` (`injectBookingHireBar`), `manage.html` (Layout options card, services style, Bookings tab), `lib/ai-composer/{catalogue,build-config,prompts}.js`, `tests/ai-composer-layouts.test.js`.

## Not synced

The static marketplace app demos (`marketplace/demos/demo-*.html`) do not load these assets, so app previews there show the default layouts. Live sites and the editor preview do.

## Test checklist

- Existing sites look identical (no layout keys set).
- Editor → each app → Layout options: change a select, preview updates without reload; switch Bookings between CTA and Hire bar.
- Hire bar under hero on desktop and phone; date picker, time list, duration list; enquiry fallback with and without a quote form; live quote/booking on a site with Bookings hire set up.

## Landing pages: removed apps stay removed

Opening a landing page used to re-attach the Hero Slider and Quote form if they were missing,
so a removed Quote form came back the next time the page was opened (and was saved again by the
next autosave). Now:

- New pages still start with Hero Slider + Quote form.
- Opening an existing page only fills in apps it already has.
- Removing an app records it in `pages[].removedApps`; AI drafts won't add those back (Hero,
  Quote, FAQ). Adding the app again clears it from the list.
- Landing-page **Save** waits for the cloud save (warns if it fails) and refreshes the live
  page cache, like Publish does.

## Footer, links and phones (Oct 2026)

- **Page links keep the site address.** Header CTA, Hero Slider buttons and footer link columns
  that point at a landing page now use the same site base as the menu (`/:site/<page>` on the
  LeadPages address, `/<page>` on a custom domain). Before, they linked to `/<page>` and 404'd
  on sites without a custom domain.
- **Minimal footer LeadPages logo** uses the LeadPages footer settings — feature colour, logo
  text colour, size — and keeps the animated pulse (`sections.lpFooter.accent / ink / size`).
  Ink defaults to white or dark from the footer's background.
- **How it works step images** follow *Number & icon size*: by default an image is 2.2× the
  number badge (1.8× on phones); a chosen *Step image size* is scaled by the same slider.
- **Phones:** when the fixed Call / Directions / Text bar is showing, a spacer the bar's height
  is added inside the last visible footer, so nothing is hidden behind the bar
  (`mobileBarSpace` in `lp-layouts.js`).
- Footer → Link columns editor cards use theme colours (no white cards in dark themes).

## Farm / provenance layouts (Oct 2026)

All opt-in; existing sites are unchanged until the layout is chosen.

| App → option | What it does | Config |
| --- | --- | --- |
| Trust bar → Style **Icons above, text below** | Icon (or the item's *Tile image*, e.g. a line drawing) above an uppercase title, thin dividers between. Items per row (default: all on one line), items per row on phones (default 2, or balanced rows of up to 4 for 5+ items), spacing (compact / standard / roomy). Background: page / Section container style, soft, tint, dark. | `sections.trustBar.mode = 'stacked'`, `stackTone`, `stackIconSize`, `stackPerRow`, `stackPerRowMobile`, `stackSpacing`, `stackDividers`, `stackCaps` |
| Services → Style **Feature** | Big photo (left or right, optional caption) beside the eyebrow/heading/intro and icon points (icon or small image, title, text). Points are per page (`featureItems`); with none, the service list is used. | `sections.services.mode = 'feature'`, `featureImage`, `featureCaption`, `featureSide`, `featureTone`, `featureItems[]` |
| CTA Banner → Layout **Title + boxes** | Heading (and text) on the left, outlined boxes (icon or image, title, text, optional link) on the right; add any number. Buttons optional. | `sections.ctaBanner.layout = 'boxes'`, `boxes[]`, `boxesButtons` |
| How it works → Layout **Milestone** | Big figure (e.g. 1990) │ heading, intro and text link (card link label + link), optional faint watermark image on the right. Steps hidden. | `sections.serviceProcess.layout = 'milestone'`, `msFigure`, `msWatermark`, `msWatermarkOpacity`, `journeyTone` |
| Project portfolio → Style **Product cards** | Centred heading; photo, title and an outline button per card. The button can open an **Order shop category** (`/order?cat=<slug>`) or use the card link. | `sections.featuredProjects.layout = 'shop'`, per project `btnLabel`, `orderCategory`, `link` |
| Text Box → Layout **Split** | Text on one side, the photo filling the other half to the page edge (image side setting picks the side). | `sections.textBox.layout = 'bleed'`, `bleedTone` |

The Order shop reads `?cat=` (category slug, name or id) and opens that category.

Links typed as `/page` in these apps (and every other `lp-layouts.js` link) now get the site's
own path prefix on the LeadPages address (`/griffithbutchery/page`), like the menu.

## Image library

Every image uploaded for a site lives in Cloudinary under `leadpages/<siteId>/` (older uploads:
`leadpages/<slug>/`). `GET /api/cloudinary/library?siteId=` lists them (newest first) with an
`inUse` flag from the saved site config; `POST {siteId, action:'delete', publicId}` deletes one
that belongs to the site and isn't used (409 `in_use` otherwise). Access: site owner, its active
partner or super-admin (same rule as site backups). No database table.

Editor: every image field has a **Library** button (pick an existing image or upload a new one),
and Branding → **Image library** opens the manager (filter All / In use / Not used, delete unused).
Replacing or clearing an image no longer deletes the old file when anything else on the site
still uses it.

## Landing pages: app layouts, Start blank, Duplicate (Oct 2026)

- **+ New app layout** (and *Page type* on any page): a landing page built only from apps.
  `pages[].kind = 'apps'` hides the article fields (H1, page text, image, AI writer) in the
  editor; title, address, meta description, menu and status stay.
- **Start blank** (Apps tab, on a Unique app): clears the homepage text, images and list items
  for that app on this page (layout, colours and form labels kept) and marks it
  `pageSections.<app>._own = true`. For owned sections the page's values win in the template
  merge — empty ones included — so nothing falls back to the homepage. Other Unique sections
  keep the old behaviour (empty values fall back to the homepage). "Use homepage content"
  removes `_own`. Starter items are not re-seeded into owned sections.
- **Duplicate page**: copies a page (apps, layout order, unique content) as a draft with
  `<slug>-copy` (numbered if taken); no previous URLs or menu entry.
- Typing the address no longer records every partial slug in `previousUrls` (only the live
  address the page had when opened) and reloads the preview once typing pauses.
- Unique copies of a homepage app are switched on (`on: true`) so "Show on page" is ticked.

## Trust bar → Order shop category links (Oct 2026)

Each trust bar item's **When clicked** can be **Order shop category**, with a second dropdown of
the site's shop categories (`linkAction: 'orderCat'`, `orderCategory: <slug>`). The link is
`<site base>/order?cat=<slug>`. Any link to `/order?cat=…` (trust bar items in every style,
product-card buttons) switches the shop to that category **in place** and scrolls to it when the
Order Storefront is on the same page (`OrderStorefront.openCategory`); otherwise it opens the
order page on that category.

## Landing pages: page list, positions, own copies, drafts (Oct 2026)

**Layout** (`manage.html`, `#lpx`)
- Page list on the left: search, + New page, + New app layout, and a card per page (thumbnail, title, Live/Draft, In menu, number of apps, address, ⋮ menu with Positions / Page settings / Duplicate / Delete).
- « makes the list a slim strip of thumbnails; ⇅ moves it to a row across the top. The choice is kept per browser (`localStorage.lp_landing_nav_v1`). Under 900px wide the list is a scrolling row.
- The page header shows title, number of apps, address, Live/Draft and **Save draft**. Tabs: **Positions** (opens first on trade sites) and **Page settings** (title, address, SEO, article, menu, status — unchanged).
- Positions: each row opens that app's editor (click, ✎ or ›); ↑/↓ and drag still reorder; ✕ removes (asks first). **+ Add section** shows the app picker. The app editor has **← Back to positions**, Undo / Redo (per app), Reset to homepage, Start blank and Remove.
- The old per-app list (Shared/Unique select, "Edit on homepage") is hidden; its functions are kept.

**Every app is the page's own copy**
- Adding an app copies the homepage content into `page.pageSections[key]` with `mode:'unique'` (Custom HTML still starts blank).
- Opening a page converts any `mode:'shared'` app the same way. On its own the conversion is not a draft (the site looks the same); it is saved with the next edit or Publish.
- Nothing in the landing editor writes to `config.sections`.

**Preview clicks** — with Auto-select on, a click in the preview while on Landing pages opens that page's own app editor. If the part isn't on the page (or the preview is on another page), a message is shown; it never switches to the homepage Page editor.

**Drafts (Save without publishing)**
- One draft per site, stored as a `site_backups` row (`source:'auto'`, label `Draft (not published)`), replaced on every save. No schema change.
- Saved by **Save draft** (site bar and landing header), about 4s after an edit, and every 15s if anything changed that no edit hook caught. Leaving the page with unsaved changes asks first.
- Landing-page saves (`lpSaveDB`) are drafts now. SEO tools, sitemap rebuild and the lead inbox still write live (`lpSaveLiveDB`) — they did before.
- **Publish Live Site** writes everything live and deletes the draft.
- Opening a site with a draft newer than the live site shows **Continue draft / Discard draft**. Older drafts are tidied away.
- Preview: landing pages redraw from the editor's copy (no reload) and use the draft position order. `api/render.js` serves the site shell for a `?preview=` page that is only in a draft (new page / changed address); live requests still 404.

**Tests:** `tests/landing-redesign-drafts.test.js`.

## CTA banner: box icon size, image colour, own colours (Oct 2026)
- **Box icon / image size** (Title + boxes): Small 26px, Standard, Large 60px, Extra large 88px, Huge 128px (`boxIconSize`).
- **Box icon / image colour** (`boxImgMode`): Auto paints transparent box images (and icons) the banner's text colour on dark banners, so dark line drawings show up; light banners keep the images' own colours. Or Original image colours, or Choose a colour (`boxImgTint`). Uses the same SVG tint filter as the logo colour (`#lpl-tint-cb`).
- **Box outline colour** (`boxBorder`), **Banner colour** (`cardBg`, replaces the style's colour — not used with Photo background) and **Banner text colour** (`cardText`). All layouts get the banner/text colours. The area around the card is still **Section container style**.

## Multi-line headings, text selection, CTA No background, band widths (Oct 2026)
- **Headings and titles** (any field whose key is heading/title/headline/h1 or ends in Heading/Title — not SEO/meta/page/button fields) are growing text boxes: Enter starts a new line. On the site, `headingBreaks()` in `lp-layouts.js` turns those line breaks in headings/titles into `<br>`.
- **Text selection in draggable rows** (list items, menu items, positions): while the mouse is down in a text box, the rows around it aren't draggable, so dragging selects text. Rows still move by their ⋮⋮ handle.
- **CTA banner → Style → No background**: the banner has no colour of its own and sits on the section colour (Section container style). With Width → Full-width band it makes one edge-to-edge colour band. Text is dark on a light section colour, light otherwise.
- **Width** (Hero slider, Hero banners, Trust bar → `widthMode`): Theme default / Full width (edge to edge) / Site width (the maximum width in Settings, background included). Use the same choice on the hero and trust bar so they line up.

## Split hero, Numbered services, app links (Oct 2026)

All opt-in; existing sites are unchanged until the layout is chosen.

| App → option | What it does | Config |
| --- | --- | --- |
| Hero Slider → Layout **Split — text left, photo right** | Slide 1 only: eyebrow, optional small **SEO H1 line**, headline + highlight, sub-headline, the slide's own two buttons, and the badges as a short dot-separated line; slide photo beside it. Background page / soft / brand tint / dark; photo side right or left. Stacks (photo under text) on phones. | `sections.heroSlider.layout = 'split'`, `splitH1`, `splitTone`, `splitSide` |
| Services → Style **Numbered cards** | Big brand-colour number (01, 02 …), title and text, the service's **Image** underneath; thin dividers between cards. Eyebrow + heading on the left with the intro on the right (tick-box, on by default). Optional text link under the cards. | `sections.services.mode = 'numbered'`, `numHeadSplit`, `numLinkLabel`, `numLinkHref` |

- **SEO H1 line:** the slider's headline is normally an H2 (`.hsl-h`). In Split, the headline is the page's H1 unless *SEO H1 line* is filled, in which case that line is the H1 and the headline an H2 — e.g. H1 "Swiss Kitchens Canberra", headline "Beautifully considered. Precisely crafted."
- **Split buttons** are copies of slide 1's buttons; a click is passed to the original button, so call tracking, scroll targets, quote and booking actions behave exactly as in the slider.
- **Links to an app** — `#services`, `#textBox`, `#featuredProjects` … in the menu (External URL), footer links or any button now scroll to that app. Most app sections only carry `data-sec`, not an id, so these links used to do nothing; `lp-layouts.js` (`bindSectionLinks`) handles any `a[href^="#"]` whose name matches no id but does match an app section. Links to real ids are unchanged.

First used on Oppikofer Joinery (`kitchens-canberra`). Tests: `tests/app-layouts-split-numbered.test.js`. Assets bumped to `lp-layouts.css?v=30` / `lp-layouts.js?v=32` in `trade.template.json`.
