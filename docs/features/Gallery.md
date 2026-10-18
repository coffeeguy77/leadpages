# Premium Gallery engine (`assets/lp-gallery.js`)

Oct 2026 rebuild of the Premium Gallery app (`sections.premiumGallery`). One source file,
loaded on demand; the old inline renderer stays in every template as the fallback.

## How it loads
- `api/render.js` `injectGalleryEngine()` preloads `/assets/lp-gallery.css|js?v=lpg-1` when a gallery is on
  (site-wide or on the current landing page).
- Every copy of `_pgRenderPremiumGallery` (demo-shared.js, trade + landing-shell templates) starts with
  `_pgUseEngine()` (marker `/*LPG-SHIM*/`), which mounts `LPGallery` or loads it first. If the script fails,
  the legacy renderer runs. `window.__LPG_DISABLE = true` forces legacy.
- Re-apply after template edits: `node scripts/patch-lp-gallery-shim.js` (`--check` in CI/tests).

## Guarantees
- Never mutates the config (normalises a copy). No stock photos on tenant sites (`opts.demo` only).
- Explicit settings beat the smart preset; `_presetApplied` is ignored.
- Heals ids the old list editor stripped: categories/albums resolve by id, slug, name or `cat-`/`alb-` prefix.
- Never touches `<title>`/description at the gallery root; deep (category/album) views set the title and restore it.
- URL changes only on navigation (pushState + popstate). Lightbox adds a history entry so Back closes it.
- Adds `ImageGallery` JSON-LD (first 40 photos) unless `seoIndex === false` (then `data-nosnippet`).

## Layouts
smart-mosaic / random-mosaic / editorial (CSS grid, dense, container-query row height), grid (uniform ratio),
masonry (row spans, reading order kept), justified (real rows, last row not stretched), feature-grid,
filmstrip (scroll-snap), slideshow (autoplay, swipe, dots), stacked, collage.
Cloudinary images get `f_auto,q_auto,w_*` srcset; other URLs load as-is.

## New optional keys (all additive)
`autoLoad` (infinite scroll, default true), `overlay` (`bottom-gradient` | `always` | `below` | `none`),
`lightboxZoom`, `lightboxDownloads`, `filterMultiple`, `showFilterCounts`, `ctaAction` (`quote` | `call` | `page:<slug>` | URL),
`images[].width/height/focalX/focalY`.

## Editor
`assets/lp-gallery-manager.js` — photo grid with drag reorder, multi-select bulk category/album/tags/size/hide/delete,
detail panel (alt-text warning, focal point), uploads 3 at a time keeping width/height. Old raw lists are under
"Advanced: raw lists". Shared `listEditor` now keeps fields a row does not show and no longer stacks listeners.

Tests: `tests/lp-gallery.test.js`.
