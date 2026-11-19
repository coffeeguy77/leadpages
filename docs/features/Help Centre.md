# LeadPages Help Centre — Engineering Manual

**Document:** `features/Help Centre`  
**Status:** Definitive reference for the customer Help Centre overlay, catalogue, contextual deep-links, and paid-help tickets  
**Audience:** Engineers and AI agents adding apps or editor surfaces  
**Prerequisites:** [Marketplace](Marketplace.md), [Editor](../10-EDITOR.md), [AGENTS](../../AGENTS.md)

---

## Executive Summary

The Help Centre is a **first-class customer product** inside Manage (and at `/help`). It covers every marketplace app plus core workflows (publish, backups, billing, Orders, Bookings, SEO). Contextual **Need help?** controls open the overlay on the matching topic. Users who are stuck can **Request paid help**, which hits `POST /api/help/ticket` and opens Support chat with a structured prefill.

| Piece | Path |
|-------|------|
| Catalogue | `assets/help/catalogue.json` |
| Overlay JS | `assets/lp-help-centre.js` → `window.LPHelp` |
| Overlay CSS | `assets/lp-help-centre.css` |
| Ticket API | `api/help/ticket.js` |
| Optional table | `db/help_tickets.sql` |
| Standalone page | `help.html` → `/help` |
| Manage wiring | `manage.html` (script/CSS, `secCard`, Marketplace tiles, `#lpc-help`) |

---

## Agent rule (mandatory)

When you **add or significantly change a marketplace app** (new `section_key`):

1. Add a topic to `assets/help/catalogue.json` with:
   - `id` / `sectionKey` = the section key (e.g. `heroSlider`)
   - `kind`: `"app"`
   - `category`: `"Apps · {Zone}"` where Zone is Navigation | Hero | Upper | Mid | Lower | Footer
   - `title`, `summary`, `body`, `steps[]`, `features[]` (customer language)
   - `related`: include `marketplace`, `page-editor`, `support-ticket`
   - Optional: `answer` (one sentence shown first), `minutes`, `choices[]` for fixes, `trail[]` for walkthroughs
   - `diagram`: `"page-zones"` (or `"nav-map"` for guides)
2. Add any slug aliases under `aliases` (e.g. `hero-slider` → `heroSlider`).
3. Ensure Page editor uses `secCard(...)` (auto Need help) or call `LPHelp.needHelpButton(sectionKey)`.
4. Marketplace tiles already deep-link via `data-seckey` — no extra work if `section_key` matches topic id.
5. Mention the topic in the PR description.

Do **not** leave new apps without a Help Centre entry.

---

## Public API (browser)

```javascript
LPHelp.open('heroSlider');     // section key or topic id
LPHelp.open('getting-started');
LPHelp.open('journey-publish'); // walkthrough
LPHelp.open('fix-not-live');    // troubleshooting
LPHelp.open('support-ticket');  // paid human help
LPHelp.showMe('heroSlider');    // close the guide and spotlight the control in Manage
LPHelp.close();
LPHelp.needHelpButton('quote', 'Need help?');
```

Keyboard: `/` opens search when the user is not typing in a field. `Ctrl` or `Cmd` + `K` opens search from anywhere. `Esc` clears search, then closes. Arrow keys move the search results.

`/manage?help=heroSlider&show=1` opens the guide and immediately spotlights that control.

---

## Experience layer

Home is task-first:

- **I want to…** walkthroughs (`kind: "journey"`) with a `trail` of Show me steps (`view`, `section`, `selector`).
- **Something’s wrong** fixes (`kind: "fix"`) with `choices[]` (`when`, `do`, `topic`).
- A clickable page map grouped by zone. Each band lists the apps that live there.
- A first-session checklist and recent guides, stored in the browser.
- Every article leads with a one-line answer, a time estimate, **Show me in Manage**, and **Copy link**.
- App articles include “If it isn’t working” links. Step ticks are remembered per guide.
- **Show me** uses `lpOpenEditorSection`, `showView`, or a header button (`#btn-publish`, `#lpc-backups`, `#lpc-image-library`), then draws a spotlight and a “Back to guide” bar.

Search ranks title, then keywords, then summary. It filters the topic list and shows a result menu.

Deep links:

- In Manage / `/help`: `#help/heroSlider` or `?help=heroSlider`
- From marketing: `/help?help=marketplace`

---

## Ticket flow

1. User submits **Request paid help** in the overlay.
2. `POST /api/help/ticket` with Bearer session — emails `HELP_TICKET_TO` / `SUPER_ADMIN_EMAILS` via Resend when configured; inserts `help_tickets` if migration applied.
3. Client opens Support (`showView('messages')` + `manageMsgEmbed.openProvider(prefill)`).

Tickets are **not** auto-billed; copy frames them as paid/hands-on so ops can quote.

---

## Content model (`catalogue.json`)

```json
{
  "id": "heroSlider",
  "kind": "app",
  "category": "Apps · Hero",
  "title": "Hero Image Slider",
  "summary": "…",
  "body": "…",
  "sectionKey": "heroSlider",
  "zone": "Hero",
  "steps": ["…"],
  "features": ["**Title** — detail"],
  "tips": ["…"],
  "related": ["marketplace", "page-editor", "images", "support-ticket"],
  "diagram": "page-zones",
  "keywords": ["…"]
}
```

Core guides (non-app): `getting-started`, `page-editor`, `marketplace`, `publish`, `backups`, `images`, `appearance`, `dashboard`, `landing-pages`, `billing`, `seo`, `advertising`, `orders`, `bookings`, `quote-builder`, `newsletter`, `support-ticket`.

---

## Testing checklist

- Manage → Site tools → **Help** opens overlay.
- Page editor section card → **Need help?** opens that app topic.
- Marketplace tile **?** opens app topic without toggling the app.
- **Request paid help** with signed-in user returns `{ok:true}` and opens Support.
- `/help` and `/help?help=backups` load the same catalogue.
- Escape / Close dismisses overlay.
- `/` focuses search. A query such as “publish” lists the walkthrough above the long app list.
- **Show me in Manage** on Publish highlights `#btn-publish` and offers Back to guide.
- Home → tap **Hero** on the page map lists hero apps.
- `/help?help=fix-not-live` opens the “live site didn’t change” choices.
