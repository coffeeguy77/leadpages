# Website Studio — Generation UX

**Updated:** 2026-07-18 (Phase 7)  
**UI surface:** `/theme-studio-v2`

## Phase 7 intent

Presentation-only refinement. Website Studio should feel like briefing a creative agency — not filling a CMS form.

**Unchanged in Phase 7:** Website Composer, Brain, Marketplace, Image Service, Application, Publishing, Permissions, Renderer.

---

## Workflow

```text
Business → Services → Brand → Goals → Generate Concepts
        → Compare → Preview → Refine / Images → Approve → Apply (gated)
```

Live publish is never performed from generate/preview/refine.

### Wizard steps (one viewport each)

1. **Business** — name, industry, type, years, location, service areas; optional existing website / redesign flag (no analysis yet)
2. **Services** — primary offer, services (chips + free text), audience, differentiators, short description
3. **Brand** — style chips, mood, colours, optional logo file name, existing images notes
4. **Goals** — primary + secondary goals as large selectable cards (appointment, quote, booking, phone, email, visit, newsletter)
5. **Generate** — summary (business, industry, services, brand, goal, estimated apps/pages/images) + hero CTA **Generate 3 Website Concepts**

Progress pills stay sticky at the top. Previous / Next + **Save Draft** autosave via draft create/PATCH after each step.

### AI generation theatre

No spinner. Immersive sequence (~12s minimum) with monochrome stroke SVG icons and stage copy:

Understanding your business → foundation → Marketplace apps → layouts → content → imagery → concepts → almost ready.

Animated LeadPages logo appears in the overlay. `prefers-reduced-motion` disables motion.

### Concept cards (human language)

Cards show concept name, one-line summary, best suited for, conversion focus, design personality, colour swatches, and friendly feature labels (e.g. Product Showcase, Appointment Booking) — not raw app ids.

Personalities differentiate concepts:

- **Luxury Editorial** — large imagery, magazine pacing
- **Premium Conversion** — offer / booking-led
- **Boutique Experience** — reviews-first trust

### Preview

~70% width desktop frame; Desktop / Tablet / Mobile toggles; iframe scroll isolated from the wizard (`overscroll-behavior`). Sticky bottom action bar: Previous, Save Draft, Generate Again, Select Concept, Continue.

---

## SVG architecture

| Asset | Role |
|-------|------|
| `/assets/lp-ai-icons.js` + `.css` | Reusable AI stroke icons (`currentColor`, CSS anim: draw/pulse/float/spin/fade/wand) |
| `/assets/lp-logo.js` + `.css` + `leadpages-logo.svg` | Themed animated LeadPages logo |
| `/assets/lp-built-with.js` + `.css` | Optional customer-site “Built with LeadPages” badge (opt-in; never forced by Composer) |
| `/assets/website-studio.css` + `.js` | Phase 7 studio chrome |

Future AI tools should reuse `LPAiIcons` and `LPLogo`.

---

## API surface (unchanged)

- `POST /api/theme-studio/drafts` · `PATCH /api/theme-studio/drafts?id=`
- `POST /api/theme-studio/generate-concepts`
- `POST /api/theme-studio/preview`
- refine / images / approve / apply endpoints unchanged
