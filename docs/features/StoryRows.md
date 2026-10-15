# Story Rows app (`sections.storyRows`)

Alternating rows of a photo or line drawing beside a heading and text. Drawn by
`assets/lp-layouts.js` (`storyRows()`), styled in `assets/lp-layouts.css` (`.srw-*`).
Off by default; add it from App Marketplace, Page editor or a landing page.

## Section settings
| Key | Meaning |
|---|---|
| `eyebrow`, `heading`, `intro` | Optional heading block above the rows (intro alone works too) |
| `rule` | Short line under each row heading (default on) |
| `ruleColor` | Line colour |
| `rowHeight` | `''` standard · `tall` · `compact` |
| `softColor`, `tintColor`, `darkColor` | Colours for rows set to soft / tint / dark |
| `spaceTop`, `spaceBottom` | `''` none · `compact` · `small` |

## Row (`items[]`)
| Key | Meaning |
|---|---|
| `title` | Heading; Enter = line break |
| `eyebrow` | Small label above the heading |
| `text` | Paragraphs (blank line between) |
| `note` | Bold line under the text |
| `image`, `alt` | Photo or drawing |
| `imageKind` | `photo` fills its half to the page edge · `drawing` shown whole with space around |
| `imageSide` | `left` · `right` |
| `tone` | `''` page · `soft` · `tint` · `dark` |
| `fade` | `fade`: photo fades into the row colour (wider photo) |
| `btnLabel`, `btnLink` | Optional outline button (`#section`, `/page`, `https://…`, `tel:…`) |

Rows without an image become a centred text column. On phones the image sits above the text.
