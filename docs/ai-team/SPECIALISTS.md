# Specialists

All specialists are registered in `lib/ai-team/specialists.js`.

| Id | Responsibility | Writes config? |
|----|----------------|----------------|
| atlas | Business strategy → Recommendations | No |
| echo | Copywriting | No (proposes; Forge applies) |
| scout | SEO strategy | No |
| pulse | Conversion strategy | No |
| nova | Design recommendations | No |
| lens | Images | No |
| guardian | Validation | No |
| forge | Execution Plans + Apply + Rollback | **Yes — sole writer** |
| beacon | Marketing | No |

## Rule

Even if another specialist proposes a change to sections, apps, forms, layouts, CTA text, SEO metadata, images, navigation, or page structure, **only Forge** may mutate `sites.config` — via a Guardian-validated Execution Plan and user-confirmed Change Preview.
