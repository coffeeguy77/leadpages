# 21 — AI Theme Studio (Phase 8 product spec)

**Document:** `AI/21-THEME-STUDIO`  
**Status:** Spec stub — not implemented  
**Prerequisites:** Brain Phases 1–7; theme engine / renderer docs  

---

## Goal

Let operators and (later) partners generate and refine **theme tokens** through Brain — never freeform HTML. Output must be compatible with the existing theme engine and site renderer.

---

## Principles

1. Brain exclusively — no direct provider calls from Theme Studio UI.  
2. Structured theme patches only (`theme.generate`, `theme.refine` task IDs).  
3. Human preview + approve before writing `sites.config.theme`.  
4. Vision (logo analysis) may be added when an adapter capability is required.  

---

## Proposed Brain tasks

| Task ID | Output | Notes |
|---------|--------|-------|
| `theme.generate` | Theme token object | Colours, fonts, radii, densities |
| `theme.refine` | JSON patch | Constrained diffs against current theme |

---

## Out of scope for this stub

- Full UI build  
- Marketplace packaging  
- Automatic publish without approval  

---

## Related

- Roadmap Phase 8: [17-IMPLEMENTATION-ROADMAP](17-IMPLEMENTATION-ROADMAP.md)  
- Provider capabilities: [04-PROVIDER-ADAPTERS](04-PROVIDER-ADAPTERS.md)
