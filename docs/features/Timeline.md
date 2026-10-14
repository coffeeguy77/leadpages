# Timeline app (`sections.storyTimeline`)

Milestones with a year (or date), title and short text — the business story, how a farm or
supplier relationship came about, or how a job comes together. Off by default; turn it on from
the Page editor chip, the App Marketplace or **Show on page**. First switched on, it sits just
above the footer; move it in **Position**. On landing pages add it with **+ Add section** (the
page gets its own copy, as with every landing-page app).

Not the same as **Activity Timeline** (`activityTimeline`), which is a live "what we are working on" feed.

| Field | What it does |
|---|---|
| `eyebrow`, `heading`, `intro` | Text above the timeline (centred) |
| `items[{year,title,text,icon,image,on}]` | Milestones (Milestones list in the editor). Line breaks in title/text are kept |
| `layout` | `''` Line (milestones side by side on one line, text centred — the default) · `alternate` (zig-zag down a centre line, with photos) · `rail` (a list down a line on the left) · `cards` (year badges on a line, a card under each, with photos) |
| `marker` | `''` ring · `dot` · `icon` (each milestone's icon) · `year` (the year inside a circle). Line / Alternating / Side rail |
| `perRow` | Line / Photo cards: milestones per row (default: all, up to 5) |
| `showImages` | Line / Side rail: show milestone photos (Alternating and Photo cards always do) |
| `tone` | `''` page (or Section container style) · `soft` · `dark` |
| `lineColor` | Line and marker colour (default: the text colour, softened) |

On phones (≤700px) every layout except Photo cards becomes the side rail; Photo cards stack.

## How it is built
| Piece | File |
|---|---|
| Hidden placeholder `<section data-sec="storyTimeline">` | `trade.template.json` |
| Markup | `assets/lp-layouts.js` `storyTimeline()` (reruns on every editor preview) |
| Styles | `assets/lp-layouts.css` (`.stl-*`) |
| Show / hide | `marketplace/demos/demo-shared.js` optional lists (same lists in both templates) |
| Position default (above the footer) | `lib/section-order.js` `BEFORE_FOOTER`, `manage.html` `LP_BEFORE_FOOTER_APPS` |
| Editor | `manage.html`: `TRADE_SUBTABS`, `CORE_GROUPS` (Trust, Proof & Authority), defaults (`DEFAULT_TRADE_SECTIONS`, `DEFAULT_TRADE_LISTS`), `storyTimelineItems` list, `secCard` branch, `LPL_LAYOUT_SPECS.storyTimeline` |
| Marketplace | `marketplace/sell-templates.json`, `app-content.json`, `playground-default-configs.json`, `playground-field-defs.json`, `marketplace/demos/demo-storyTimeline.html`, hub tile in `marketplace.html` (`/marketplace/story-timeline`) |
| App registry | `api/api-apps.js` `STORY_TIMELINE_APP` (registered automatically), or `scripts/seed-story-timeline-app.sql` |

Excluded from the AI composer until it has prompts for it. Tests: `node --test tests/story-timeline.test.js`.

**Space above / below** (`spaceTop`, `spaceBottom`): standard · compact · small · none — none joins the timeline to the app next to it.
