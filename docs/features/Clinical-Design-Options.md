# Professional-practice design options

**Shipped:** Nov 2026. First used by Pam Connor & Associates (`pam-connor`).
**Code:** `assets/lp-layouts.js` (block "Clinical / professional-practice options") and
`assets/lp-layouts.css`. Rich page text is in `trade.template.json` (`_lpMdRich`). The font set is
`assets/lp-fonts.js` (`clinical`). Tests: `tests/clinical-design-options.test.js`.

Every option is **off unless it is set**, so existing sites render exactly as before.

## Options

| Where in the editor | Config key | What it does |
|---|---|---|
| Branding → Page width & sub-pages | `siteWidth` (960–1600) | Content width for the whole site (`--maxw`). |
| Branding → Page width & sub-pages | `pageStyle: 'banner'`, `pageEyebrow` | Each landing page's H1 sits in a band at the top (optional small line above it); the text sits on white. |
| Landing pages → page | `pages[].rich: true` | Rich text: links, numbered lists, sub-bullets, italics and pipe tables. Details in the "Rich page text" section below. |
| Menu → Menu bar extras | `navMenu.activeStyle: 'fill'` | The current page's menu item is filled with the fill colour; a dropdown parent is filled when one of its pages is open. |
| Menu → Menu bar extras | `navMenu.barMobile: 'hamburger'` | The menu bar hides on phones (the ☰ menu has the same links). |
| Menu → Header contact items & button | `header.items[{icon,text,href}]`, `itemsColor`, `itemsIconColor` | Contact items beside the logo (1100px and wider). |
| Menu → Header contact items & button | `header.btnIcon` | An icon before the header button text. |
| Menu → Header contact items & button | `header.ctaPlace: 'menu'` | The header button sits at the end of the menu bar (menu bar placement, 900px and wider). |
| Hero slider → Layout | `heroSlider.layout: 'cover'` | Photo banner: slide 1's photo runs across the band at its own proportions (`coverRatio`, e.g. `1114:353`; `coverFocus`), with the text over its left side. On phones the text comes first, then the photo. |
| Hero slider (split or cover) | `splitBg`, `accentRule`, `imageAlt`, `nameCardTitle`, `nameCardText`, `nameCardX`, `nameCardY` | Band colour, a short accent line under the headline, the photo description, and a dark name card on the photo (X/Y are percentages; empty = bottom right). |
| Hero slider (split) | `splitFit: 'portrait'` | The whole photo stands on the band (good for cut-out portraits). |
| Feature strip → Strip layout | `featureStrip.layout: 'band'` | Compact band with dividers; titles as typed, in the body font. |
| Services (photo cards) | `photoHeadSide`, `photoIconBadge`, `photoMore: 'arrow'`, `photoLinkStyle: 'button'` | Heading, intro and link in a column beside the cards; a round icon over each photo; an arrow-only card link; the link shown as a button. |
| Text box (split / bleed) | `textBox.featuresSide: true` | The icon list in its own column beside the text (desktop). |
| CTA banner → Layout | `ctaBanner.layout: 'notice'`, `icon` | Full-width notice: icon and heading, a divider, then the text. |
| Footer | `footer.brandContact[{icon,text,href}]` | Address, phone and email lines under the footer logo. |
| Footer | `footer.decorImage` | A faint decorative image in the bottom-right corner (a transparent PNG works best). |

## Rich page text (`pages[].rich`)

- Links: `[text](https://…)`, `mailto:`, `tel:`, `/page` (the site address is added in front) and
  `/assets/…` files. Outside links open in a new tab. Any other link scheme stays as plain text.
- `1.` numbered lists, indented `  - ` sub-bullets, `*italics*` / `_italics_`.
- Pipe tables (`| a | b |` + a `|---|---|` line). They scroll sideways on phones.
- Raw HTML is still escaped.
- New pages get `rich: true`. Older pages keep the plain renderer (`_lpMd`, unchanged) until
  "Rich text" is ticked, because 15 existing pages contain numbered lines that would start
  rendering as lists.

## Sub-pages

On a landing page, the menu bar (placement `bar`) now stays first and keeps its background colour,
both on pages with apps and on pages without them.

## Also

- `header.ctaPlace: 'menu'` copies the header button into the menu bar. Clicks still go through the
  real header button, so its call tracking and booking popup keep working.
- Layout option cards can now edit another app's settings (`spec.sec`). The menu editor uses
  this for the header card.
- The AI Composer doesn't offer `heroSlider: cover`, the `featureStrip` layouts or
  `ctaBanner: notice` yet (`NOT_OFFERED`).
