# Local Website Co. — Visual QA (`partners1.png`)

Source of truth: design composition described by `partners1.png` (full desktop layout; the PNG itself may be downsampled). Failed prior look: narrow ~tablet-scale column.

## Viewports tested

| Viewport | Result |
|---|---|
| 1366 × 900 (desktop primary) | Shell **1240px**; no horizontal overflow |
| 1440 × 1000 | Shell 1240px; no overflow |
| 1024 × 768 | Stacked layouts; chips clamped; `overflow-x: hidden` on body |
| 768 × 1024 | Single / two-column reflow; no overflow |
| 390 × 844 | Mobile menu; stacked sections; no overflow |
| 360 × 800 | No overflow |

## Screenshots captured

Artifacts under `/opt/cursor/artifacts/lwc-qa/`:

- `desktop-1366-viewport.png` — first screen at 1366
- `desktop-1366-fullpage.png` — full page at 1366 (~8800px)
- `mobile-390-viewport.png` — first screen at 390
- `mobile-390-fullpage.png` — full page at 390

## Measured desktop metrics (1366)

| Metric | Value | Target |
|---|---|---|
| `.lwc-shell` width | 1240px | `min(1240px, calc(100% - 64px))` |
| Header height | ~91px | 86–92px |
| Hero height | ~699px | 620–680px (slightly tall; photo + CTAs) |
| Hero H1 | 60px, 4 intentional lines | 58–68px |
| Demo card width | ~399px | 380–400px |
| Pricing card width | ~399px | 360–390px |
| About split | 50/50 photo + orange panel | Match |
| Final CTA photo | Present (`.lwc-final-photo`) | Required |

## Known visual differences

- `partners1.png` was not present in the workspace; comparison used the written section spec + prior design descriptions.
- Hero device overlays are CSS mock frames (not live site screenshots inside laptop/phone).
- Decorative foliage from the reference is not reproduced as photographic leaf assets.
- Industries section (~385px) is taller than the 240–300px note because 16:9 cards need height; still compact vs earlier empty field.
- Hero ~699px is ~20–80px above the 620–680 band after fixing accidental H1 over-wrap.
- Unsplash portraits stand in where dedicated Shaun/café photography is not bundled.

## Accessibility checks

- One `h1`; section `h2`s present
- Nav links / CTAs are real `<a>` / `<button>` elements
- FAQ uses `aria-expanded` + `aria-controls`; demo filters use `role="tab"` / `aria-selected`
- Form labels associated with inputs; honeypot off-screen
- Focus-visible styles on buttons
- `prefers-reduced-motion` disables button transform
- Mobile menu button with `aria-expanded` (`data-pt-menu`)

## Build / lint / type-check

- No project-level TypeScript typecheck for these templates (plain JS)
- `node --test tests/partner-website/*.test.js` — **35/35 pass**
- Culture / Web Culture templates untouched and still green
