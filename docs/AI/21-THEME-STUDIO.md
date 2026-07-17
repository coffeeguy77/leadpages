# 21 — AI Theme Studio

**Document:** `AI/21-THEME-STUDIO`  
**Status:** Colour-token MVP shipped; **full product vision supersedes this doc**  
**Canonical rebuild plan:** [THEME-STUDIO-IMPLEMENTATION-AUDIT](THEME-STUDIO-IMPLEMENTATION-AUDIT.md)

---

## Important correction (2026-07-17)

The implementation at `/theme-studio` is an **AI colour-token generator** (five trade theme hexes + miniature preview). That is **not** the approved LeadPages Theme Studio product.

| Product | Status |
|---------|--------|
| **Theme Studio** (full design system) | Spec + phased plan in the audit — **do not extend the colour screen into this** |
| **AI Colour Assistant** | Intended home for the current colour generate/refine/approve flow (Editor → Appearance) |

Do not modify production Theme Studio behaviour until the audit plan is approved.

---

## What shipped (colour MVP — to be retargeted)

| Piece | Path |
|-------|------|
| UI | `/theme-studio` → `theme-studio.html` |
| Tasks | `theme.generate`, `theme.refine` |
| Approve | `POST /api/brain/theme-approve` → `sites.config.theme` |
| Tokens | `pipe`, `hivis`, `steel`, `safety`, `lightBg` |

Flag: `BRAIN_THEME_STUDIO` (default on).

---

## Related

- Rebuild audit & phases: [THEME-STUDIO-IMPLEMENTATION-AUDIT](THEME-STUDIO-IMPLEMENTATION-AUDIT.md)  
- Roadmap: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)  
- Status: [00-STATUS](00-STATUS.md)
