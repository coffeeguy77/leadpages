# Public Marketplace V2 (Trust Bar reference)

**Status:** Phase 1 — Trust Bar reference implementation  
**Flags:** `APP_MARKETPLACE_V2` and related keys in `lib/marketplace-v2-flags.js`  
**Public URLs:** `/marketplace?v2=1`, `/marketplace/trust-bar?v2=1`  
**Backend demo:** `/app-demo/trust-bar` (also linked from Site Switcher → App Demos)

## Goal

Warm, sell-first public marketplace that shows finished results, industry presets, and the **same Trust Bar controls** used in `manage.html`. Public playground changes are temporary and never save.

## Feature flags

| Flag | Purpose |
|------|---------|
| `APP_MARKETPLACE_V2` | Public homepage + Trust Bar sell-first page |
| `APP_DEMO_PAGES` | Backend App Demo screens |
| `APP_DEMO_PRESETS` | Preset management surfaces |
| `APP_DEMO_BUILDER` | Superuser preset editor mode |
| `APP_MARKETPLACE_PLAYGROUND` | Public playground |
| `APP_MARKETPLACE_ACCESS_LABELS` | Included / premium / usage labels |
| `APP_MARKETPLACE_PREMIUM` | Premium SEO style access presentation |
| `APP_MARKETPLACE_THEME_INHERITANCE` | Semantic `--theme-*` tokens |

**Client overrides:** `?v2=1` / `?v2=0` (persists to `localStorage`).  
**Server inject:** `api/marketing-html.js` writes `window.__LP_MARKETPLACE_FLAGS__` for marketplace HTML.

Default is **off** unless env or `?v2=1` enables it — classic marketplace remains available.

## Theme

`assets/marketplace-theme.css` maps public marketing tokens (`--paper`, `--gum`, `--rose`, …) to semantic `--theme-*` variables. Marketplace chrome uses semantic tokens. App preview iframes keep their own demo-site theme.

## Trust Bar reference

| Asset | Role |
|-------|------|
| `marketplace/trust-bar-v2.json` | Public copy, examples, preset order, access |
| `playground/trustbar-*.json` | Industry presets (AAM1, Bean Culture, carpenter pair, …) |
| `assets/js/marketplace/trust-bar-editor.js` | Same control labels/fields as manage Trust Bar |
| `assets/js/marketplace/marketplace-feature-v2.js` | Sell-first page + playground layout |
| `marketplace/demos/demo-trustBar.html` | Live preview shell (`sections.trustBar`) |
| `app-demo-trust-bar.html` | Superuser App Demo screen |

### Editor modes

```text
production            → manage.html (customer save/publish)
demo-builder          → App Demo screen (preset authoring)
marketplace-playground → public page (temporary state, no save)
```

## Access model

`lib/marketplace-access.js` — public labels for included / free / limited / premium / usage / connection. Trust Bar defaults to **included**. Do not claim every app is free.

## Roll-out

1. Trust Bar complete (this phase).  
2. Apply the same App Demo + presets + sell-first page pattern to every `app_registry` section.  
3. New registry apps should show **Demo setup required** until published.

## Safety

Anonymous playgrounds must not submit enquiries, send SMS, process payments, create bookings, trigger webhooks, or call paid providers. Premium data demos use stored examples only.

## Tests

`tests/marketplace-v2-trustbar.test.js`
