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
LPHelp.open('support-ticket'); // paid human help
LPHelp.close();
LPHelp.needHelpButton('quote', 'Need help?');
```

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
