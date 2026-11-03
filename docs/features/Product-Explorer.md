# Product Explorer app (`sections.productExplorer`)

**Status:** Shipped Nov 2026. Off by default; add it from App Marketplace or Page editor → **Product Explorer**.
**Drawn by:** `assets/lp-product-explorer.js` + `.css` (loaded by `trade.template.json`).
**First used on:** Canberra Outdoor Structures (`canberra-outdoor-structures`, Scandi Cabins range).

An architectural model selector: visitors choose a category, filter by type, pick a model and
see its **floor plan, elevations and photos** beside the key details, then enquire about that
exact model. Built from data — models are list items in the editor, not page layouts.

## Layout

- **Desktop:** panel ~30/70. Left: category buttons (with counts), type chips (All + each type),
  scrollable model list (thumbnail, name, area / bed / bath), optional help note. Right: viewer
  tabs (Floor plan · Elevations · Photos — only tabs with images, Floor plan always), large
  image with next / previous and dots, click → full-screen viewer with **Zoom** (200%, scroll to pan),
  then name, description, spec tiles, **Enquire About {name}**, **full details** link, small print.
- **Phones (≤ 860px):** one column; categories and type chips scroll sideways; models are a
  sideways-scrolling strip above the viewer; help note under the details.
- Optional **category photo cards** under the panel ("Explore {count} models") jump to that category.
- Switching models never reloads the page; a short fade (none with reduced motion).

## Rules

- A model with no floor plan shows **"Official floor plan coming soon"** (and a link to its
  manufacturer page if set) — the viewer only ever shows that model's own images.
- Bedrooms `0` shows "Studio". Empty bedrooms / bathrooms / area / dimensions are hidden.
- **Enquire** selects the model in the quote form's job list (`fillQuote`, default on: the list
  becomes "Not sure yet" + every model as "Name — Category"), remembers it for the visit
  (`sessionStorage lp_pe_enquiry`) and scrolls to `enquireHref` (default `#quote`).
- The address keeps the selection: `?pe-cat=<category>&pe-model=<model>` (slugs). Back, reload and
  shared links reopen the same model. Any link on the page to `?pe-cat=…` opens that category in place.

## Section settings

| Key | Meaning |
|---|---|
| `eyebrow`, `heading`, `intro` | Heading block (heading left, intro right) |
| `tone` | `''` page · `soft` · `dark` (band colour `darkColor`) |
| `panelColor`, `accentColor` | Panel background; icons and card buttons |
| `step1Label`, `step2Label`, `step3Label`, `allLabel` | Picker labels |
| `unit` | Floor area unit (default m²) |
| `enquireLabel` (`{name}`), `enquireHref`, `detailsLabel` | Buttons |
| `fillQuote`, `notSureLabel` | Quote job list = models |
| `placeholderText` | Text when a model has no floor plan |
| `note` | Small print under the buttons (e.g. approvals, "see the manufacturer for pricing") |
| `helpTitle`, `helpText`, `helpCtaLabel`, `helpCtaHref` | "Not sure which suits?" note |
| `cardsOn`, `cardsCtaLabel` (`{count}`) | Category photo cards |
| `categories[]` | `on`, `label`, `blurb`, `image` (card photo) |
| `items[]` | `on`, `name`, `category` (must match a category label), `group` (type filter), `bedrooms`, `bathrooms`, `area`, `dimensions`, `description`, `link`, `floorPlan`, `elev1`–`elev4`, `photo1`–`photo3`, `alt` |

Editor: Page → Product Explorer → **Explorer settings**, **Categories**, **Models** (each model has
upload slots for the floor plan, four elevations and three photos; untick to hide, drag to reorder).

## Also added

- **Jost Architectural** font set (`fontSet: 'jost'`, `assets/lp-fonts.js` v3): light Jost headings,
  Jost body, tracked capitals.

## Files

`assets/lp-product-explorer.{js,css}`, `trade.template.json`, `lib/section-order.js`, `manage.html`,
`api/api-apps.js`, `lib/marketplace-categories.js`, `lib/marketplace-catalog-seed.js`,
`marketplace/app-content.json`, `assets/lp-fonts.js`. Tests: `tests/product-explorer.test.js`.

## Not covered

- Model names and details are drawn in the browser, so they are not in the page HTML search engines
  read first (same as the other `lp-layouts` apps).
- No pricing, stock or comparison table by design.
- Landing-page shell (`landing-shell-neutral-v1`) and the static marketplace demos don't include it yet.
