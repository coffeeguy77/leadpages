# Bold page design

An opt-in page design for trade / hire sites. First used for ACT Truck Hire.

## Switching it on

- Editor (super admin): **Settings → Client site details → Page design → Bold**.
- Or set `config.design = "bold"` on the site. Remove it (or choose Classic) to switch back — nothing is deleted.
- Sites without `design: "bold"` render exactly as before (tested byte-for-byte).

## How it works

| Piece | File |
|---|---|
| Page markup (runs on the server and in the browser) | `assets/lp-skin-bold.js` (`render(cfg)`, `model(cfg)`, `mount(cfg)`) |
| Styles (all scoped under `#lpb-root`) | `assets/lp-skin-bold.css` |
| Server render | `api/render.js` → `injectBoldDesign()` puts the page right after `<body>`, adds `html.lpb-on`, the stylesheet, the Archivo font and the script |
| Editor preview | `assets/lp-layouts.js` loads the design when it's switched on in the editor; the design wraps `__applyTradeConfig` and redraws on every change |
| Live calendar | `GET /api/bookings/hire/public?action=calendar` — now also returns `from_cents` (lowest day rate across bookable vehicles) for each day |

The classic template markup stays in the page (hidden by `html.lpb-on`), so the template's own
scripts, the booking flow overlay and the LeadPages footer keep working.

## Content

Drawn from the site's existing content, with optional overrides in `config.bold`:

| Part | Default source | Override |
|---|---|---|
| Header logo | `logo.imageUrl` on a white tag | `bold.logoLight` (white logo) |
| Brand colour | `theme.hivis` | `bold.brand` |
| Headline / sub | hero slide heading + highlight / sub text | `bold.heroTitle` ("\n" = new line), `bold.heroSub` |
| Ticks under headline | hero badges | `bold.heroFacts` |
| Calendar prices | live `from_cents`, else the week below | — |
| Week of prices | booking bar rate cards ("Mon – Thu", "Friday", "Weekends…") | `bold.week` (7 prices, Mon → Sun) |
| The truck | text box heading / intro, activity counter figures | `bold.truckTitle`, `bold.truckIntro`, `bold.specs`, `bold.box` |
| Included | Services items (title, body, icon) | `bold.includedTitle` |
| Steps + call-out | Service process | `bold.stepsTitle` |
| FAQ | FAQ items (empty answers → "call us on …") | `bold.faqTitle` |
| Find us | About Us address + hours | `bold.findTitle` |
| Reviews | Reviews section | `bold.hideReviews: true` hides them |
| Closing band | Special offer heading | `bold.closeTitle` |

The booking card calendar is live when the site's Bookings is in hire mode with vehicles in Fleet;
otherwise it shows prices only and the button calls the business.

Not covered: suburb pages (`app/[site]/[suburb]`) keep the classic design.

## Tests

`node --test tests/bold-design.test.js`
