# Marketing homepage images — generate list for Shaun

Replace the SVG placeholders (and temporary JPGs) under `assets/marketing-home/` with final photography / UI crops.

Suggested size / crop notes assume 2× retina. Prefer WebP + JPEG fallbacks once generated; keep the same basenames so `home.html` does not need path changes.

## Required

| # | Filename | Role | Suggested size | Notes |
|---|----------|------|----------------|-------|
| 1 | `hero-harbour-plumbing-desktop.jpg` | Hero browser mock content | 1200×900 | Tradie job-site photo for “Harbour Plumbing” demo hero. Warm dusk / work-in-progress. |
| 2 | `hero-harbour-plumbing-mobile.jpg` | Hero phone mock content | 750×1334 | Matching crop, taller; faces/subject readable at phone size. |
| 3 | `cap-websites.jpg` | Capability — Websites | 800×500 | Clean landing page / storefront feel. |
| 4 | `cap-apps.jpg` | Capability — Apps | 800×500 | Product / app UI vibe (not phone lockscreen clutter). |
| 5 | `cap-leads.jpg` | Capability — Lead capture | 800×500 | Form / enquiry / phone-call context. |
| 6 | `cap-seo.jpg` | Capability — Local SEO | 800×500 | Suburb / map / Google-results feel (no fake competitor brands). |
| 7 | `cap-partner.jpg` | Capability — Partner growth | 800×500 | Partner + client handshake / whiteboard / laptop. |
| 8 | `audience-trades.jpg` | Audience — Trades | 900×700 | Australian tradie at work (already have a temporary JPG stand-in). |
| 9 | `audience-hospitality.jpg` | Audience — Hospitality | 900×700 | Café / restaurant atmosphere. |
| 10 | `audience-services.jpg` | Audience — Professional services | 900×700 | Broker / consultant / office — warm, not corporate stock. |
| 11 | `connected-site-browser.jpg` | Connected platform centre mock | ~900×480 landscape | Landscape browser content only (no iMac/device chrome). `connected-site-preview.jpg` is legacy full-device source. |
| 12 | `example-trades.jpg` | Website examples — Trades | 900×700 | Distinct from audience-trades if possible. |
| 13 | `example-hospitality.jpg` | Website examples — Hospitality | 900×700 | |
| 14 | `example-services.jpg` | Website examples — Services | 900×700 | |
| 15 | `partner-with-client.jpg` | Partner band photo | 1000×750 | Advisor with client (temporary JPG already present). |
| 16 | `final-cta-street-dusk.jpg` | Final CTA full-bleed | 1920×1080 | Australian street / suburb dusk; navy overlay applied in CSS. |

## Optional

| Filename | Role | Notes |
|----------|------|-------|
| `og-home.jpg` | Open Graph / social share | 1200×630. Wire into `home.html` `og:image` / `twitter:image` when ready. |

## Already permanent (do not regenerate)

- `/assets/leadpages-logo.svg` — wordmark via `lp-logo.js`
- Capability / UI mock imagery can stay SVG placeholders until photos land; page remains usable.

## HTML references

All paths are `/assets/marketing-home/<filename>` in `home.html`.
