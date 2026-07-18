# 21 — AI Theme Studio

**Document:** `AI/21-THEME-STUDIO`  
**Status:** Colour-token MVP shipped; **full product is Theme Studio V2**  
**Canonical rebuild plan:** [THEME-STUDIO-IMPLEMENTATION-AUDIT](THEME-STUDIO-IMPLEMENTATION-AUDIT.md)  
**V2 foundations (Phases 1–2):** [23-THEME-STUDIO-V2](23-THEME-STUDIO-V2.md)

---

## Important correction (2026-07-17)

The implementation at `/theme-studio` is an **AI colour-token generator** (five trade theme hexes + miniature preview). That is **not** the approved LeadPages Theme Studio product.

| Product | Status |
|---------|--------|
| **Theme Studio V2** (full design system) | Phases 1–2 library foundations shipped — [23](23-THEME-STUDIO-V2.md). **Do not extend this colour screen into V2.** |
| **AI Colour Assistant** | Intended home for the current colour generate/refine/approve flow (Editor → Appearance) |

Do not wire V2 UI onto `theme-studio.html`. Keep colour MVP isolated until relocated.

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

- V2 Phases 1–2: [23-THEME-STUDIO-V2](23-THEME-STUDIO-V2.md)  
- Rebuild audit & phases: [THEME-STUDIO-IMPLEMENTATION-AUDIT](THEME-STUDIO-IMPLEMENTATION-AUDIT.md)  
- Roadmap: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)  
- Status: [00-STATUS](00-STATUS.md)
