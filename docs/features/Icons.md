# Icons — stroke only

All icons on LeadPages are stroke (outline) SVGs drawn in the text colour. Coloured emoji are not used as icons.

## Files
| File | Loaded by | What |
|---|---|---|
| `icons.js` | every site + the editor | Curated Lucide set (`LP_ICONS`), categories and search terms. Also `LP_EMOJI_ICONS` (emoji → stroke icon, from `lib/emoji-icon-map.json`), with each emoji registered as an alias so older content draws the stroke icon, plus `LP_iconBodyOk` / `LP_registerIcons` |
| `icons-more.js` | editor only | The rest of Lucide (`LP_ICONS_MORE`, ~900 icons) and search tags for every Lucide icon (`LP_ICON_TAGS`) |
| `scripts/build-icon-library.js` | — | Rebuilds both from an unpacked `lucide-static` package (`node scripts/build-icon-library.js ./package`) |
| `icons-pack.js` | editor only | Extra stroke pack (`LP_ICON_PACK`): **Butchery**, **Farm animals**, **Food & drink**, **Shop & order** (~440 icons, keys `x-<set>-<name>`), merged into `LP_ICONS_MORE` with search tags incl. everyday words (beef, lamb, pork, butcher, order…) |
| `scripts/build-icon-pack.js` | — | Rebuilds `icons-pack.js` from `@iconify-json/*` packages (see the script header) |

## A site's own icons (`config.iconLib`)
Picking an icon the site's set doesn't have (from the full library or online) saves its SVG shapes into `config.iconLib` (`{ name: '<path …/>' }`). The site registers them before drawing (`applyCfg` in the template and `lp-layouts.js` `run()`), so a site only carries the icons it uses. `LP_iconBodyOk` accepts plain SVG shapes only (path, circle, rect, line, polyline, polygon, ellipse, g) — no scripts, event handlers, links or styles.

## Picker tabs
**My icons** (this site's `config.iconLib`), the four pack groups, then the site set's categories.

## Add your own icon
**+ Add your own** in the icon picker: upload an `.svg` or paste SVG code, give it a name. `lpIconFromSvg` keeps shapes only (path, circle, rect, line, polyline, polygon, ellipse, g), drops scripts, links, images, styles and event handlers, turns colours into the text colour, scales it to the 24px grid and keeps line icons as lines (solid icons are drawn solid). Saved as `my-<name>` in `config.iconLib` (max ~6 KB of shapes).

## Pack licences
Tabler Icons (MIT, Paweł Kuna) · Hugeicons free (MIT) · IconPark Outline (Apache-2.0, ByteDance) · Lucide Lab (ISC) · TDesign Icons (MIT, Tencent) · Health Icons (MIT, Resolve to Save Lives) · Phosphor (MIT). Notices are kept in the `icons-pack.js` header.

## Online search
In the icon picker, type a word and click **Search thousands more stroke icons online**. Results come from the Iconify API (`api.iconify.design`), limited to outline sets: Tabler, Hugeicons, IconPark Outline, Lucide Lab, Iconoir, Myna UI, TDesign, Phosphor and Health Icons (outline only). Filled/solid variants are skipped; icons drawn on another grid (48, 256…) are scaled onto 24. The picked icon is saved as `x-<set>-<name>` in `config.iconLib`.

## Emoji in old content
- Editor: opening a site turns emoji in icon fields into icon names (`lpStrokeIconsInData`); trade packs and starter content use icon names.
- Sites not yet re-published: emoji in icon fields draw their stroke icon (alias in `LP_ICONS`); `strokeIcons()` in `lp-layouts.js` replaces any emoji left in an icon spot, and removes unknown colour emoji.
