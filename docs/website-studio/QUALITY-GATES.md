# Website Studio — Deterministic Quality Gates

**Updated:** 2026-07-18 (Phase 4)  
**Implementation:** `lib/website-composer/quality-gate.js` (also surfaced via `lib/theme-studio/quality-report.js`)

## Statuses

| Status | Meaning |
|--------|---------|
| `blocked` | Critical errors — cannot mark ready |
| `needs-attention` | Warnings / non-critical issues |
| `ready-for-review` | No critical blockers |

Quality is **not** reduced to a single unexplained number. Issues are actionable and linkable to sections where practical.

## Checks (minimum)

**Composition:** required regions, supported+installed apps, valid layouts/variants, coherent order, no duplicate-purpose clutter, reasonable length.

**Content:** required fields, no placeholder tokens, no generic fallback copy, no cross-industry leakage, consistent business name/contact, sensible CTAs.

**Images:** required images resolved or waived, orientation/dimensions where checked, no duplicates, attribution, alt text, approval where required, no unauthorised tenant assets.

**Renderer:** preview HTML render succeeds, no trade fallback leakage in Studio drafts, navigation targets resolve, forms configured, mobile mode succeeds.

**SEO:** title/description present, draft preview noindex behaviour, neutral/disabled structured data (no trade JSON-LD leakage).

**Accessibility:** alt text, button/form labels, empty-link checks; contrast via existing validation where available.

## Leakage detector

Cross-industry detector inspects rendered text, draft config, SEO, JSON-LD, navigation, alt text, image search terms, and hidden/disabled section data that might still render. Studio drafts fail closed on plumbing/landscaping/emergency-trade leakage for non-trade industries.
