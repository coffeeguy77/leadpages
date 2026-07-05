# LeadPages Design System

**Document:** `11-DESIGN-SYSTEM`  
**Status:** Definitive visual and UX reference for LeadPages surfaces  
**Audience:** Engineers and designers building UI in HTML dashboards and templates  
**Prerequisites:** [00-VISION](00-VISION.md), [10-EDITOR](10-EDITOR.md)

> LeadPages design is **clean, fast, SaaS-like, and business-focused**. The control plane (`manage.html`) and tenant templates share typography principles but use **different colour palettes** — editor is eucalypt green; trade sites use per-tenant theme tokens.

---

## Design Philosophy

| Principle | Application |
|-----------|-------------|
| **Professional command centre** | Grouped cards, clear hierarchy — not a hacked form |
| **Show, don't describe** | Live preview for trade sites |
| **Mobile-first output** | Tenant pages optimised for phones; editor is desktop-first |
| **Fast-loading** | Vanilla JS, no SPA bundle on public pages |
| **Destructive actions obvious** | Red/danger styling for delete flows |
| **Save/publish states clear** | Toast, publish button, status chips |

### Brand personality

Helpful · Fast · Practical · Smart · Reliable · Built for local business

---

## Typography

### Control plane (`manage.html`)

| Role | Font | Usage |
|------|------|-------|
| **Display** | Fraunces (serif) | Headings `h1`, card titles, modal titles |
| **UI** | Inter (sans) | Body, buttons, forms, nav |
| **Mono** | ui-monospace, Menlo | Slugs, JSON editors, code fields |

```css
--font-display: 'Fraunces', Georgia, serif;
--font-ui: 'Inter', system-ui, sans-serif;
```

**Eyebrow pattern:** 12px, uppercase, letter-spacing `.14em`, brand colour — section labels.

### Tenant templates

| Template | Display font | UI font |
|----------|--------------|---------|
| `trade` | Archivo / system | Inter |
| `broker-leads` | Fraunces | Inter |
| `broker-app` | Template-specific | Inter |
| `agency` | Archivo | Inter + Space Mono (labels) |

Templates load fonts via Google Fonts `<link>` in template HTML.

---

## Control Plane Colour Tokens

From `manage.html` `:root`:

| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#f6f4ef` | Page background (warm paper) |
| `--surface` | `#fff` | Cards, panels |
| `--surface-2` | `#fbfaf7` | Secondary surfaces |
| `--ink` | `#1b2430` | Primary text |
| `--ink-soft` | `#5c6675` | Secondary text |
| `--ink-faint` | `#929aa6` | Tertiary / hints |
| `--line` | `#e7e2d8` | Borders |
| `--line-strong` | `#d8d2c5` | Input borders |
| `--brand` | `#1f7a63` | Primary actions (eucalypt green) |
| `--brand-deep` | `#155c4a` | Hover, selected states |
| `--brand-tint` | `#eaf3ef` | Subtle highlights, ghost buttons |
| `--amber` | `#b9852b` | Accent figures, warnings |
| `--radius` | `14px` | Cards |
| `--radius-sm` | `10px` | Buttons, inputs |
| `--shadow` | layered rgba | Card elevation |

### Semantic usage

| Element | Style |
|---------|-------|
| Primary button | `--brand` fill, white text |
| Ghost button | White fill, `--brand-deep` text, `--brand-tint` hover |
| Selected nav tab | `--brand-deep` text, bottom border `--brand` |
| Focus ring | `2px solid --brand-deep` |
| Success badge | `--brand-tint` bg, `--brand-deep` text |
| Checkbox accent | `accent-color: var(--brand)` |

---

## Tenant Theme Tokens (trade)

Configured per site in `config.theme`, applied as CSS variables by `__applyTradeConfig`:

| Config key | CSS variable | Role |
|------------|--------------|------|
| `pipe` | `--pipe` | Brand colour |
| `hivis` | `--hivis` | CTA buttons |
| `steel` | `--steel-900` etc. | Header/footer dark |
| `safety` | `--safety` | Badges |
| `lightBg` | `--light` | Page background |

Trade colour presets live in `TRADE_COLOUR_PRESETS` (`manage.html`). Partners pick presets or custom hex in editor.

### Broker-leads template

Fixed "eucalypt & brass" palette in `broker.template.json`:

- `--forest`, `--sage`, `--paper`, `--brass` — not user-configurable via theme object

### Broker-app appearance

`config.appearance` → `--brand`, `--amber`, `--panel-bg`, fonts via `__applyAppearance`.

---

## Layout & Spacing

### Control plane

| Pattern | Value |
|---------|-------|
| Content max-width | `1080px` (`.wrap`) |
| Card padding | ~20–26px |
| Section gap | 16–24px between cards |
| Form field gap | 8–14px |

### Command bar (`#lp-cmd`)

Sticky top region with publish, preview, settings — always visible on trade/broker-leads.

### Preview dock

- Side panel when viewport ≥ 1680px
- Bottom dock on smaller screens
- Desktop preview cap 1040px width

---

## Components

### Buttons (`.btn`)

| Variant | Class | Use |
|---------|-------|-----|
| Primary | `.btn` | Publish, save, confirm |
| Ghost | `.btn.ghost` | Secondary actions |
| Small | `.btn.sm` | Toolbar, chips |
| Danger | custom red | Delete site, destructive |

### Cards (`.card`)

White surface, border, radius, shadow. Group related settings with `h2` title.

### Navigation

| Pattern | Class | Use |
|---------|-------|-----|
| Main tabs | `.adminnav` / `.anav-btn` | Dashboard, Page editor, etc. |
| Trade subtabs | `.lsub-chip` | Section editors |
| State tabs | `.statebtn` | Broker-app rates by state |

### Forms

| Pattern | Class |
|---------|-------|
| Label + field | `.f` |
| Text input | `.tin` |
| Checkbox row | `.ck` |
| Colour picker | `.clr-*` sync with hex input |

### Toasts

`#toast` — 1.8s flash for publish confirmation and errors.

### Modals / overlays

Full-screen overlays: billing, plans, settings, create site (`#cs-ov`), backups.

---

## Icons

**`icons.js`** — `window.LP_ICONS` map of slug → SVG path.

Used in:
- Service cards on tenant sites
- Section icon picker in editor
- Hero CTA icon-only buttons

Icon slugs: lowercase alphanumeric + hyphen (e.g. `wrench`, `zap`).

---

## UX Rules

From product intent and editor implementation:

| Rule | Why |
|------|-----|
| Avoid demo placeholder text in production | Sites must look client-ready |
| Avoid cluttered top corners | Command bar owns primary actions |
| Controls live near their section | Trade subtabs render in `#lsub-body` below chips |
| Clear labels and icons | Partners are not developers |
| Consistent spacing | Reduces cognitive load |
| Destructive actions obvious | Prevent accidental site deletion |
| Publish/preview always visible | Core workflow |

### Classic vs Standard editor mode

| Mode | Behaviour |
|------|-----------|
| **Classic** | All section toggles visible |
| **Standard** | Hide inactive optional sections — client-safe UI |

---

## Marketing Pages

Static HTML (`home.html`, `tradies.html`, `partners.html`) use LeadPages marketing styling — aligned with warm paper + eucalypt green but may include additional hero imagery and campaign-specific accents.

Partner showcase pages (`showcaseHtml` in `render.js`) use Inter + Archivo with configurable `--accent` from `showcase_config`.

---

## Accessibility

| Practice | Where |
|----------|-------|
| `:focus-visible` outlines | Buttons, inputs in templates and editor |
| `aria-selected` on tabs | Nav state |
| `aria-label` on icon-only CTAs | Trade hero buttons |
| `prefers-reduced-motion` | Agency template, broker template |

---

## Anti-Patterns

- Hardcoding one client's brand into shared templates
- Removing settings when reorganising UI
- Framework CSS on public tenant pages (keep vanilla)
- Inline styles except dynamic theme injection
- Telegraphic error messages without toast feedback

---

## Related Documentation

| Doc | Topic |
|-----|-------|
| [10-EDITOR](10-EDITOR.md) | Editor UI structure |
| [03-TEMPLATE-SYSTEM](03-TEMPLATE-SYSTEM.md) | Tenant theme hydration |
| [00-VISION](00-VISION.md) | Product UX intent |

---

*Document maintained as part of the LeadPages engineering canon.*
