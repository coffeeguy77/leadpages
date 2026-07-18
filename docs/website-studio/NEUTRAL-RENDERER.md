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
- Phase 4 app mounts + apply hook for new apps  
- **No** plumbing/suburb/cert/JSON-LD Plumber defaults  

Belt-and-suspenders `ws-shell-neutralize` remains only if a Composer draft is somehow previewed on a non-neutral shell.

## Production boundary

`api/render.js` still maps `sites.template === 'trade'` → `trade.template.json`.  
Website Studio does not publish or apply drafts to live sites in Phase 4.
