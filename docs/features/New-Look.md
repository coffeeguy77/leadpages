# New look (back office) — opt-in

One UI rule set for every admin page, a modern side or top menu in the editor, and colours
that come only from the workspace theme. It is **off by default**: nothing changes for anyone
until they switch it on.

## Turning it on

Editor → **Appearance & Accessibility** → **Interface**

- **Look:** Classic | New look (beta)
- **Menu:** Side menu (icons + text, collapsible) | Top menu

The choice is saved per browser in `localStorage.leadpages_workspace_appearance`
(`ui`, `nav`, `sideCollapsed`) with the existing theme choice, and applies to every admin page.
Themes: all existing Appearance themes keep working; two new ones, **Studio Light** and
**Studio Dark**, are designed for the new look.

## How it works

| File | Role |
| --- | --- |
| `assets/lp-ui.css` | The one UI kit: type (Inter), buttons, inputs, cards, tables, tabs, chips, modals, page headers, and the editor shell. Every rule is scoped to `html[data-lp-ui="v2"]`. No colour values outside the token block — everything reads `lp-themes.css` tokens. |
| `assets/lp-ui-boot.js` | Loaded first in each admin page `<head>`. Sets `data-lp-ui`, `data-lp-nav`, `data-lp-side-collapsed` (and the theme/background in the new look) so pages never flash. Pages without `lp-themes.css` mark it `data-themes`. |
| `assets/lp-ui-shell.js` | Editor (`manage.html`) only. Builds the side/top menu from the existing nav buttons and **clicks through to them**, so every handler, role check and view keeps working. The old chrome stays in the page, hidden by CSS. |
| `assets/lp-workspace-appearance.js` | Stores `ui`/`nav`/`sideCollapsed` and applies them live. |
| `assets/lp-themes.css` | Adds `studio-light` and `studio-dark`. |

### Older page palettes

Several admin pages hard-code their own colour names in `:root` (`--paper`, `--ink`, `--rose`,
`--gum`, `--line`, `--surface`, …). In the new look, `lp-ui.css` points all of them at theme
tokens (its token block is `html[…]`, which outranks `:root`), so one theme choice repaints
every page. Pages that defined base theme names themselves (`layout-composer.html`,
`partner-onboarding.html`) guard those with `html:not([data-lp-ui="v2"])`.

### Hard-coded whites fixed

`bookings.html`, `assets/bk-fleet-admin.js` and `messages.html` used `background:#fff` for
cards; they now use `var(--panel,#fff)` (and `--input-bg`, `--panel-soft`, `--accent-text`).
Light themes are pixel-identical; dark themes no longer show white-on-white cards — in both looks.

## Classic is unchanged

Classic look screenshots of all 21 admin pages were pixel-compared before/after (Classic Light
and Command Dark). The only differences: the logo pulse animation frame, and the dark-theme
white-card fixes above.

## Adding a new admin page

```html
<script src="/assets/lp-ui-boot.js?v=1"></script>        <!-- first in <head> -->
…
<link rel="stylesheet" href="/assets/lp-ui.css?v=1">     <!-- last before </head> -->
```

Use theme tokens (`var(--panel)`, `var(--text)`, `var(--accent)` …) — never hex colours.

Tests: `tests/new-look-ui.test.js`.
