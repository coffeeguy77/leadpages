# Website Studio — Refinement & Direct Edit

**Updated:** 2026-07-18 (Phase 4)

## AI refinement

Entry: refine UI on `/theme-studio-v2` → Brain task with deterministic fallback `planRefinement` (`lib/website-composer/refine.js`).

Supported request classes (examples):

| Class | Examples |
|-------|----------|
| Content | Premium copy, shorter hero, friendlier tone, emphasise weddings |
| Structure | Move quote higher, remove process, add package compare / client logos / brand story |
| Design | Darker, more white space, split hero, warmer photography |
| Images | Replace image, outdoor events, avoid close-ups |
| Apps | Add FAQ, add booking, change gallery layout, use product collections |

Pipeline:

1. Parse request → structured change plan  
2. Permission check  
3. App / variant support check  
4. Deterministic adapters  
5. Content generate/modify  
6. Resolve images only where needed  
7. Validate + quality gate  
8. Persist new concept version  
9. Preserve previous version  
10. Show change summary  

Refinement never writes arbitrary HTML or freeform Brain config paths.

## Direct editing

`POST api/theme-studio/direct-edit`

Supports text, CTA, card/item edits, reorder items/sections, toggle optional sections, supported layouts/variants, image replace, alt text, nav labels, SEO title/description, approved theme/typography controls.

Rules:

- Same schemas and adapters as generation  
- Immediate validation  
- Persist as draft version with provenance `Manual Edit`  
- No bypass of protected fields / writable-path allowlist  
