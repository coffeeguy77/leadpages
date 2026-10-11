# Map & Hours and CTA Banner apps

Two reusable trade-site apps. Both are off by default, turn on and off like every other app
(Page editor chip, App Marketplace tile or the **Show on page** box), sit just above the footer
when first switched on, and can be moved anywhere in **Position**.

## Map & Hours (`sections.mapHours`)

"Find us" section: address, a pinned Google map, opening hours, phone and a directions button.

| Field | What it does |
|---|---|
| `eyebrow`, `heading`, `intro` | Text above the details |
| `address` | Shown on the page (new lines kept) |
| `mapQuery` | Map pin `"lat,lng"`, set by **Find on map** in the editor. Empty = the map searches the address text |
| `mapZoom` | 17 close up · 15 street (default) · 13 suburb · 11 city |
| `rows[{label,value,on}]` | Opening hours, one row per day or group of days (Opening hours list in the editor) |
| `showPhone` | Phone row from the site phone number (default on) |
| `ctaLabel` | "Get directions" button (Google Maps directions). Empty = hidden |
| `mapSide` | `left` puts the map on the left |
| `tone` | `dark` for a dark band |
| `addressTitle`, `hoursTitle`, `phoneTitle` | Small labels (default Address / Opening hours / Phone) |

**Address lookup:** the editor's **Find on map** button searches OpenStreetMap (Nominatim)
from the browser — Australian results first — and lists matches. Picking one fills the address
(keeping a typed "Unit 3, …" first line) and pins the map. "Use the address text instead"
removes the pin. No API key is needed; the embed is the standard Google Maps embed.

## CTA Banner (`sections.ctaBanner`)

Heading, short text and up to two buttons.

| Field | What it does |
|---|---|
| `eyebrow`, `heading`, `text` | Banner text |
| `tone` | `brand` (default, the site's button colour) · `dark` · `light` · `photo` |
| `bgImage` | Photo for the `photo` style |
| `align` | `center` for a centred banner (default text left, buttons right) |
| `btn1Label` / `btn2Label` | Button text. Empty = hidden |
| `btn1Action` / `btn2Action` | `quote` (quote form) · `booking` · `call` · `section` · `link` |
| `btn1Target` / `btn2Target` | App to scroll to (`section`) |
| `btn1Url` / `btn2Url` | `/page` or `https://…` (`link`; outside links open in a new tab) |

`booking` opens the live hire calendar (`/assets/lp-booking-flow.js`) when the site's Bookings
is set up in hire mode with vehicles; otherwise it goes to the booking bar, the quote form or a
phone call — never to a section that isn't on the page.

## How they are built

| Piece | File |
|---|---|
| Empty placeholders `<section data-sec="mapHours|ctaBanner" style="display:none">` | `trade.template.json` (added by `scripts/patch-maphours-ctabanner-sections.js`) |
| Markup + behaviour | `assets/lp-layouts.js` (`mapHours()`, `ctaBanner()`) — reruns on every editor preview change |
| Styles | `assets/lp-layouts.css` |
| Show / hide | `marketplace/demos/demo-shared.js` optional-section lists (synced into the templates) |
| Position default (above the footer) | `lib/section-order.js` `BEFORE_FOOTER` and `manage.html` `LP_BEFORE_FOOTER_APPS` |
| Editor | `manage.html`: chips (`TRADE_SUBTABS`, `CORE_GROUPS`), `secCard` + `LPL_LAYOUT_SPECS.mapHours/ctaBanner`, `mapHoursRows` list, `lplWireAddressLookup` |
| Auto-select | Rendered nodes carry `data-lpe` (e.g. `heading`, `address`, `btn1Label`, `list:mapHoursRows:0:value`); a click shield over the map opens the address field |
| Marketplace | `marketplace/sell-templates.json`, `app-content.json`, `playground-default-configs.json` (demo content), `playground-field-defs.json` (demo editor), `marketplace/demos/demo-mapHours.html`, `demo-ctaBanner.html`, hub tiles in `marketplace.html` |
| App registry | Registered automatically by `api/api-apps.js` (`ensureNewApp`); or run `scripts/seed-maphours-ctabanner-apps.sql` |

Both are excluded from the AI composer (`lib/ai-composer/catalogue.js`) until it has prompts for them.
Content is drawn in the browser, like the other layouts in `lp-layouts.js`.

## Tests

`node --test tests/map-hours-cta-banner.test.js`
