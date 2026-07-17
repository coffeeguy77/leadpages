# 21 — AI Theme Studio (Phase 8)

**Document:** `AI/21-THEME-STUDIO`  
**Status:** Implemented  
**Prerequisites:** Brain Phases 1–7; trade theme engine in `manage.html`

---

## Goal

Operators generate and refine **theme tokens** through Brain — never freeform HTML. Output matches the existing trade theme shape and is written only after human approve.

---

## Principles

1. Brain exclusively — no provider calls from Theme Studio UI.  
2. Structured theme patches only (`theme.generate`, `theme.refine`).  
3. Human preview + approve before writing `sites.config.theme`.  
4. Vision (logo analysis) may be added later when an adapter capability is required.

---

## Brain tasks

| Task ID | Output | Notes |
|---------|--------|-------|
| `theme.generate` | Theme token object | Colours only |
| `theme.refine` | Full token object + change notes | Constrained by feedback |

### Token shape (trade)

```json
{
  "presetName": "optional",
  "pipe": "#1f7bb8",
  "hivis": "#ff6a1f",
  "steel": "#1a2230",
  "safety": "#ffc400",
  "lightBg": "#eef2f6"
}
```

---

## Surfaces

| Piece | Path |
|-------|------|
| UI | `/theme-studio` → `theme-studio.html` (Ops Command panel) |
| Generate | `POST /api/brain/theme-generate` `{ siteId, brief?, mood? }` |
| Refine | `POST /api/brain/theme-refine` `{ siteId, feedback, currentTheme? }` |
| Approve | `POST /api/brain/theme-approve` `{ siteId, theme }` → merges into `sites.config.theme` |

Flag: `BRAIN_THEME_STUDIO` (default **on**; set `0` to disable).

---

## Related

- Roadmap Phase 8: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)  
- Status: [00-STATUS](00-STATUS.md)
