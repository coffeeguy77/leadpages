# Neutral Website Studio Renderer

**Updated:** 2026-07-18 (Phase 4)

## Decision

Website Studio Composer drafts preview through:

| Shell id | Asset |
|----------|-------|
| `landing-shell-neutral-v1` | `landing-shell-neutral-v1.template.json` |

Live trade sites continue to use:

| Shell id | Asset |
|----------|-------|
| `landing-shell-v1` | `trade.template.json` (unchanged behaviour) |

Empty hidden mounts for Phase 4 apps were added to `trade.template.json` so Marketplace section keys exist for the editor/renderer. Default visible trade copy was not removed from the live trade shell.

## How preview resolves the shell

`lib/theme-studio/render-preview.js` → `resolveShellAsset(draftConfig)`:

1. If `__websiteComposer.contentInheritance === 'none'` (or `rendererShellId` is neutral) → load neutral asset  
2. Else → `trade.template.json`  

Foundations and `build-draft.js` stamp `rendererShellId: landing-shell-neutral-v1` on Composer drafts.

## What the neutral shell contains

- Document structure, section mounts (`data-sec`), theme CSS variables, shared scripts  
- Phase 4 app mounts + `ws-new-apps-apply` hydrate for Marketplace apps  
- Empty JS fallback arrays (`_hd`, `_spfd`, …) — never trade suburb/job stubs  
- Static why/quote/footer/services bodies blanked; footer selectable via `footer.site`  
- **No** plumbing/suburb/cert/JSON-LD Plumber defaults  
- Theme tokens such as `hivis` are **preserved** (they are CSS/JS identifiers, not trade copy)

Composer content (`lib/website-composer/content.js` + adapters) must supply industry-aware
`why.items`, quote labels/points/`jobOptions`, `reviewHighlights.items`, and footer blurb/legal
so the shell never falls through to trade leftovers.

Rebuild from trade without touching the live shell:

```bash
node scripts/rebuild-landing-shell-neutral.js
```

Preview injects `SITE_CONFIG` with a lookbehind-safe replace so `window.__SITE_CONFIG__` reads stay intact. Missing hero content returns a validation page instead of trade defaults.

Belt-and-suspenders `ws-shell-neutralize` also runs for Composer drafts on the neutral shell.

## Production boundary

`api/render.js` still maps `sites.template === 'trade'` → `trade.template.json`.  
Website Studio does not publish or apply drafts to live sites in Phase 4.
