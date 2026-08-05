# Transfer Matcher (LeadPages Custom HTML pack)

Embed via the **Custom HTML** marketplace app:

- **HTML**: contents of `body.html` (markup only — no inline `<script>`)
- **CSS URL**: `/assets/apps/transfer-matcher/app.css`
- **JS URL**: `/assets/apps/transfer-matcher/app.js`

Or run `node scripts/seed-transfer-matcher-page.js --site=<slug>`.

Page slug: `account-transaction-match` (published). Dedicated site slug may be `account-transaction-matcher`.

## CSS scoping

All rules in `app.css` are prefixed with `#tm-root` so pack styles cannot override site chrome (especially `header .bar` / `.wrap`). Mobile breakpoints (`max-width: 720px`) stack the screenshot grid and wrap the toolbar.

## Colour overrides (Manage)

In **Manage → Custom HTML → Colour overrides**, pick CSS variables (`--accent`, `--page`, …) and save hex colours into `sections.customHtml.cssVars`. Overrides are injected at runtime and do **not** rewrite this shared `app.css` file.
