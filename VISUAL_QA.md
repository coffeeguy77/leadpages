# Local Website Co. — Visual QA (`partners1`)

Source of truth: partners1 composition (desktop). Live bug report URL: `leadpages.com.au/webculture?tpl=localwebsiteco`.

## Root causes found (not a 684px canvas)

1. **Container was already ~1240px** at 1366 — measured live and locally. The “half size” look was driven by sparse section density + broken imagery, not a 600px max-width.
2. **Cloud / upload icons** came from the partner `headshotUrl` SVG (`…/profile/headshot-*.svg`) reused for About, Tech strip, and Final CTA. SVG placeholders are now rejected; bundled photos are used instead.
3. **Wrong demo set** (Bean Culture, RTT, etc.) came from live partner showcase demos. LWC now defaults to the curated six (Flow Pro → Bloom) unless demos match LWC industry tabs or `meta.lwcUsePartnerDemos`.
4. **Only two testimonials** when the partner profile had two — gallery now pads to three with Luke / Megan / David defaults.

## Viewports tested

| Viewport | Result |
|---|---|
| 1366 × 900 | Shell **1240px**; H1 **66px**; demos **~399px**; no overflow |
| 1440 × 1000 | ok |
| 1024 × 768 | ok |
| 768 × 1024 | ok |
| 390 × 844 | no overflow |
| 360 × 800 | ok |

## Screenshots

`/opt/cursor/artifacts/lwc-qa/`:

- `desktop-1366-viewport.png`
- `desktop-1366-fullpage.png`
- `mobile-390-fullpage.png`

## Measured desktop metrics (local preview, 1366)

| Metric | Value |
|---|---|
| `.lwc-shell` | 1240px |
| Hero H1 | 66px |
| Demo card | ~399 × 522 |
| Process card | ~399 × 265 (text + image split) |
| Testimonials | 3 |
| Demos | Flow Pro first of six curated |
| About / trust / final images | `about-shaun.jpg`, `tech-strip.jpg`, `contact-meeting.jpg` |
| Page height | ~8136px (down from ~8800+) |

## Known remaining differences

- `partners1(1).png` was not available as a file in the workspace; comparison used the written section spec + prior design descriptions.
- Hero device frames remain CSS mock chrome (not live site screenshots).
- Decorative foliage from the reference is not reproduced as assets.
- About section height still grows with long partner bios (layout is 50/50 with photo; not a cloud icon).
- REPLACE_POINT comments mark where a real photographic `headshotUrl` should replace `about-shaun.jpg`.

## Accessibility

- FAQ `aria-expanded` / `aria-controls`
- Demo tabs `role="tab"` / `aria-selected`
- Trust badge accessible label
- Form labels associated
- Focus-visible on buttons
- `prefers-reduced-motion` respected

## Tests

`node --test tests/partner-website/*.test.js` — **36/36 pass**
