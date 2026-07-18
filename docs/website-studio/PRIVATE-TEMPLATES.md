# Private templates

**Mode:** `private_template`  
**Flag:** `WEBSITE_STUDIO_PRIVATE_TEMPLATE=1`

## Who may save

| Actor | Allowed |
|-------|---------|
| Superuser | Private / internal; may mark eligible for later Marketplace review (not publish) |
| Partner | Partner-owned private templates only |
| Client | Denied |

Public Marketplace publishing is **not** implemented in Phase 5.

## Template contents

Includes: foundation, recipe, app set, layouts, theme, typography, reusable structure, image direction, adapter metadata, owner/visibility.

Strips / parameterises:

- Customer emails, phones, addresses
- Form recipients
- Lead/CRM/analytics/domain data
- Customer testimonials unless explicitly kept
- Business name → `{{businessName}}` where found

## Storage

Uses existing `theme_studio_templates` (legacy technical name) via `saveTemplate`.
