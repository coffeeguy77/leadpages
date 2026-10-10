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

Icons are LeadPages icon names from `icons.js` (a short emoji typed in the editor is shown as text).

## Bookings hire bar

- Put Bookings straight under the hero in **Position**; the card overlaps the hero's bottom edge (`overlapHero: false` turns that off).
- **Live mode** — when the site has Bookings enabled with a `resource_hire` service and hire resources: "Check availability" quotes every vehicle through `POST /api/bookings/hire/quote` (`public: true`), shows price + availability, and books through `POST /api/bookings/public` (status `pending`; staff confirm in Bookings).
- **Enquiry mode** — otherwise a short form opens inside the bar (name, phone, email, notes) and the request is saved as a lead through `/api/leads` with the pick-up date, time and duration, so it lands in the site's leads and the owner's email.
- The editor's Bookings panel shows whether Bookings is set up for the site (not switched on / on but no hire service or vehicles / live).
- Backend pricing supports a weekday rate, a weekend rate and a public-holiday rate per vehicle; a separate Friday rate is not supported yet (the rate cards are display copy).
- The rate cards are display copy from the editor; live prices come from Bookings.

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
