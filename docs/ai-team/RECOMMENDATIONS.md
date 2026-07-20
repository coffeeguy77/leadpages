# Recommendations

Recommendations are **business outcomes**, not configuration instructions.

## Shape

- `title` / `problem` / `reason` — plain language
- `proposedChange.type`: `outcome` | `site_brain_update` (legacy) | advisory types
- `proposedChange.outcome` — e.g. `strengthen_primary_cta`, `enable_faq_for_objections`
- Never include config paths, section ids, layout keys, or renderer details

Forge maps outcomes → Execution Plan steps → config paths.

## Lifecycle

`awaiting-review` → `approved` / `rejected`

Approval (single or batch) creates a Forge **Execution Plan**, not a direct config write.

## Pipeline

Recommendation → Execution Plan → Guardian → Change Preview → Apply → Editor → User Publish
