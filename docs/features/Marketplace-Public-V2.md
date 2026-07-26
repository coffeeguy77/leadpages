# Public Marketplace V2 (Trust Bar reference)

**Status:** Phase 1 — Trust Bar reference implementation  
**Flags:** `APP_MARKETPLACE_V2` and related keys in `lib/marketplace-v2-flags.js`  
**Public URLs:** `/marketplace?v2=1`, `/marketplace/trust-bar?v2=1`  
**Backend demo:** `/app-demo/trust-bar` (also linked from Site Switcher → App Demos)

## Goal

Warm, sell-first public marketplace that shows finished results, industry presets, and the **same Trust Bar controls** used in `manage.html`. Public playground changes are temporary and never save.

## Compact app page layout

Every marketplace feature page uses a short two-part layout:

1. **Coloured top (app info)** — name, short summary, access labels, expandable overview / features / benefits, and a **still hero image** beside the copy in the green section (never a live section preview / iframe).
2. **White section (demo)** — real examples, live preview, presets, and the playground editor. No “In context” images, “Ready to use” upsells, or “try the editor” footers — the page is a demo, not a pitch to open manage.

Special Offer / Promotions uses `assets/js/marketplace/special-offer-editor.js` — the same copy fields and section-container appearance controls as `manage.html`. Other apps use the compact editor plus manage’s appearance panel fields.

Trust Bar V2 (`?v2=1`) follows the same pattern via `marketplace-feature-v2.js`. Playground icon fields use the shared LeadPages icon picker (`assets/js/marketplace/lp-icon-picker.js`).

### Local image override (no upload)

In marketplace playground mode, image tiles can use **Choose image** / **Replace image** to override a sample with a file from the visitor’s device. The control uses a native `<label for>` → file input (not a programmatic click on a hidden input) so it works on iOS Safari / iPad. Large photos are shrunk in-browser to a data URL — nothing is uploaded, stored, or visible to anyone else. **Restore sample** returns the preset image. Resetting the example also restores the published sample.

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

1. Trust Bar complete (Phase 1) — manage-parity compact editor + V2 sell-first page + App Demo.  
2. **In progress:** every other section app uses the shared compact editor (`assets/js/marketplace/marketplace-compact-editor.js`) on the public playground — same Items | Style layout, safety banner, icon/image controls. Live demos must render with `sections.{key}.on = true` and sample content.  
3. Follow-on: per-app App Demo screens, rich industry presets, and manage-field parity where the shared editor is still thinner than `manage.html`.  
4. New registry apps should show **Demo setup required** until a demo + field defs ship.

## Safety

Anonymous playgrounds must not submit enquiries, send SMS, process payments, create bookings, trigger webhooks, or call paid providers. Premium data demos use stored examples only.

## Marketing hub slugs

Home / SEO links sometimes use marketing URLs that are not sell-template keys (`quote-lead-capture`, `reviews-trust`, `promotions`, `email-campaigns`). `lib/marketplace-catalog-resolve.js` (used by `api/catalog.js`) and client fallbacks in `marketplace-feature.html` map those to real section demos (or a dashboard explainer for Email Campaigns). Thin Supabase rows without a playground get one injected with `section_key`. Feature heroes prefer a live `demo-{sectionKey}.html` iframe over stock photos / “APP PREVIEW”.

## Tests

`tests/marketplace-v2-trustbar.test.js` · `tests/marketplace-compact-editor.test.js` · `tests/marketplace-catalog-resolve.test.js`
