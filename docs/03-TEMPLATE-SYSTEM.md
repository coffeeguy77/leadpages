# LeadPages Template System

LeadPages uses JSON-held HTML templates and serverless rendering.

## Main Templates

- `trade.template.json` — tradie landing pages
- `broker.template.json` — broker lead-generation pages
- `brokerapp.template.json` — broker app mini-site
- `agency.template.json` — agency/partner homepage

## Rendering Model

The renderer chooses a template based on the site row, then injects config into the HTML.

Two mechanisms exist:

1. Token replacement
2. Server-built HTML for some templates

## Token Replacement

Common tokens may include:

- `{{businessName}}`
- `{{phoneText}}`
- `{{pageTitle}}`
- `{{favicon}}`

The template may also receive the full config as a JSON script block.

## Live Preview

The editor preview can update rendered pages without full reload by applying config updates client-side.

## Rules For Template Changes

- Existing sites must not break.
- Missing images/text must be handled gracefully.
- Unknown config fields must be preserved.
- Templates must remain generic across many businesses.
- Do not hardcode one client's brand into shared templates.
- If changing token names, keep old tokens working or migrate carefully.

## Future Direction

Potential improvements:

- Componentize templates gradually.
- Add template versioning.
- Add a template schema.
- Add visual regression tests for core templates.
