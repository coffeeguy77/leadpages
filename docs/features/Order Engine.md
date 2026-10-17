# Order Engine — Universal Ordering System

**Document:** `features/Order Engine`  
**Status:** Phase 1 + Phase 2 core shipped (storefront, carts, abandoned cron, admin ops)  
**Audience:** Engineers and AI development agents  
**Prerequisites:** [INDEX](../INDEX.md), [02-DATABASE](../02-DATABASE.md), [CLAUDE.md](../../CLAUDE.md)

---

## Executive summary

Reusable LeadPages ordering module. Industry-agnostic; **butcher** is the first preset.  
**Core rule:** the order is the permanent source of truth.

Workflow: `Cart → Order → Deposit → Customer Editing → Cutoff → Lock → Supply → Final Pricing → Pickup → Completion`

---

## Surfaces

| Surface | URL | Who |
|---------|-----|-----|
| Site backend → **Orders** tab | manage → Orders (embeds `/orders?embed=1&site_id=…`) | Owner / partner / client |
| Ops Command → **Orders** | `/orders` | Staff / owner / partner / super |
| Site tools → **Orders** | Opens Orders tab | Same as tab |
| Dashboard **Orders** widget | Optional KPI + recent orders (toggle on Dashboard) | Trade dashboard |
| Customer shop (standalone) | `/order-shop?slug=…` | Public |
| Customer shop (on site) | Page editor → **Order Storefront** (position + colours) | Public when section on |
| Customer portal | `/order-portal?t=…` | Magic link (single order) |
| Customer portal (SMS login) | `/order-portal?slug=…` | Phone OTP → order history + reorder |
| Import | Orders → **Import** | CSV field mapping: customers / products / order history |
| SMS usage + broadcast | Orders → **Messaging** | Billable segment meter + CRM blast |

---

## Enable a site (ops)

1. Apply SQL: `db/order_engine_schema.sql`, `db/order_engine_rls.sql`, then `db/order_engine_import_sms.sql`
2. Site backend → **Orders** (or Ops Command → Orders) → select site → Settings → **Apply butcher preset** → **System enabled = Yes** → Save
3. For customer ordering on the live site: Page editor → Lead Capture → **Order Storefront** → on → style/position → publish  
   Or share `/order-shop?slug=<site-slug>`
4. Optional: Dashboard → tick **Show Orders widget** for a new-orders snapshot
5. Optional: Orders → **Import** → Butchery line items preset → map/preview → commit history
6. Stripe webhook: `POST /api/order/webhook` + `STRIPE_ORDER_WEBHOOK_SECRET`
6. Optional SMS (portal OTP + order texts):
   - Prefer Quote Builder setup: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
   - Or Messages API: same SID/token plus `TWILIO_FROM_NUMBER` / `TWILIO_FROM` / `TWILIO_SMS_FROM` (E.164)

---

## Architecture

```
lib/order/     pricing, cutoff, deposit, cart, capacity, messaging, notify, supply, service, presets,
               import-parse, import, phone, sms-usage, tokens (OTP + customer session)
api/order/     … + import, sms, portal-auth
api/cron/order-abandoned.js   every 15 minutes (vercel.json)
db/order_engine_import_sms.sql   phone_e164, SMS usage, import runs, portal OTP purposes
orders.html / order-shop.html / order-portal.html / assets/lp-order-storefront.js
```

Money: **integer cents**. Weight: **numeric kg** (requested ≠ actual).

---

## Phase coverage

**Staff:** products, new order, deposit link, lock date, supply, finalise weight, calendar, customers, payments, change approvals, CSV export, **CSV import (mapped)**, messaging AI, **SMS broadcast**, **SMS usage meter**.

**Customer:** storefront cart → checkout → deposit Stripe → portal view/edit before cutoff; **SMS OTP login modal on the shop** → in-page **My orders** (weights + reorder into cart). Phone spaces are normalised (`0414 631 463` ≡ `0414631463`); portal re-links orders that share the same number.

**Import re-run:** rows with the same **order number** are one order (multi product lines + parsed `requested_weight_kg`). Re-import **skips** orders that already exist by `external_order_number` or `order_number` (no duplicates, no append). Blank order numbers cannot be skipped safely and will create new orders.

**Automation:** abandoned cart cron marks carts + sends recovery messages; deposit webhook confirms orders.

Still later / optional: delivery zones, wholesale, POS/Xero, multi-location stock, gift cards, PDF print packs, Stripe metered SMS invoicing.

---

## Tests

```bash
node scripts/test-order-engine.js
node --test tests/order-import.test.js
```

---

## Agent rules

- Do not hardcode butcher into core engine logic.
- Do not confuse with `domain_orders` / quote systems.
- Never store card PANs.
- Preserve order-item snapshots.
- AI messages require admin save before send.

## Storefront info tabs

Extra tabs beside **Browse menu** and **My orders** (e.g. store hours, a seasonal brochure). Edit them in the editor under **Order Storefront → Info tabs**.

- Stored in `sections.orderStorefront.infoTabs[]` (or the page's unique `pageSections.orderStorefront`). Each tab: `on`, `label`, `eyebrow`, `heading`, `intro`, `hoursTitle`, `hours[] {label,value}`, `groups[] {eyebrow,title,text,items[] {label,detail,product},note}`, `footnote`.
- `api/render.js` passes visible tabs to the mount as `data-info-tabs` (JSON, HTML-escaped); `assets/lp-layouts.js` keeps it in sync in the editor preview.
- `item.product` is a product slug, id or exact name. Linked items show "Order →"; clicking switches to Browse menu, selects a category that contains the product (current one first), scrolls to the row and highlights it. Products with no category fall back to "All" (if enabled), a name search (editorial fast menu) or the product page (traditional mode).
- Items whose product is inactive or missing render as plain text; the editor flags them under the Items box.
- With the SMS portal off, the nav still shows when info tabs exist (Browse menu + info tabs, no My orders).

## Loading speed and category links

- Pages with the shop (homepage section or a landing page's own Order Storefront app) start the menu request in `<head>` (`window.__lpOePre`, added by `withOrderPrefetch` in `api/render.js`); `lp-order-storefront.js` uses that response instead of fetching again. The storefront script is preloaded and its version kept current (`ORDER_SCRIPT_VER`).
- `/api/order/storefront` reads only `config.sections.orderStorefront` and `config.colorOverrides` (not the whole config), runs independent queries in parallel, and is CDN-cached for 15 s (`stale-while-revalidate=45`). Editor calls add `fresh=1`.
- "Order shop category" links (trust bar, product cards) go to the site's shop page — the first published landing page with the Order Storefront app — as `/<page>?cat=<category>#lp-order-storefront`, landing on the form with that category open (below a sticky header). Without such a page they go to `/order?cat=…`.
- Clicking a category link on the shop page before the menu has loaded stays on the page: `?cat=` is written to the address and the category opens when the menu arrives.
