# Website Studio — Visual homepage composition

**Updated:** 2026-07-18

## Goal

Homepage concepts should look like photo-led reference sites (e.g. landscaping with hero slider + image trust bar), not thin text drafts with empty Marketplace mounts.

## Brief → content

| Brief field | Homepage use |
|-------------|--------------|
| `mainServices` | Services cards, featured project titles, image trust-bar tile labels |
| `differentiators` | Why / proof cards (preferred over generic catalogs) |
| `notes` | Hero subcopy, brand story body, gallery intro |
| `specialisation` / `location` | Supporting copy when notes are short |

## Visual industries (landscaping / construction showcase)

- Recipe: `recipe-landscaping-showcase` (preferred for landscaping classification)
- Hero: `heroSlider` with resolved slide images
- Layout forced to `hero-image-slider` when slider is selected (so the shell actually shows it)
- Trust bar: `mode: "images"` with per-tile photography
- Featured projects + before/after kept in the narrative

## Image attach

Composer resolves structured briefs for:

- `heroSlider:0..n` → slide `imageUrl`
- `trustBar:0..n` → badge `image`
- `featuredProjects:0..n` → project cards

## Ops tip

Fill Services step completely before Generate. Empty services/differentiators/notes still produce a site, but it will fall back to thinner catalogs.
