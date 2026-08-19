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
| Ops Command → **Orders** | `/orders` | Staff / owner / partner / super |
| Site editor → **Orders desk** | `/orders?site_id=…` | Site tools button in `manage.html` |
| Customer shop (standalone) | `/order-shop?slug=…` | Public |
| Customer shop (on site) | Section **Order Storefront** | Public (enable in Page editor → Lead Capture) |
| Customer portal | `/order-portal?t=…` | Magic link |

---

## Enable a site (ops)

1. Apply SQL: `db/order_engine_schema.sql` then `db/order_engine_rls.sql`
2. Ops Command → Orders → select site → Settings → **Apply butcher preset** → **System enabled = Yes** → Save
3. For customer ordering on the live site: Page editor → Lead Capture → **Order Storefront** → on → publish  
   Or share `/order-shop?slug=<site-slug>`
4. Stripe webhook: `POST /api/order/webhook` + `STRIPE_ORDER_WEBHOOK_SECRET`
5. Optional SMS: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

---

## Architecture

```
lib/order/     pricing, cutoff, deposit, cart, capacity, messaging, notify, supply, service, presets
api/order/     system, products, orders, storefront, cart, portal, checkout-deposit, webhook,
               dashboard, supply, calendar, customers, payments, abandoned, templates,
               change-requests, export, message-ai
api/cron/order-abandoned.js   every 15 minutes (vercel.json)
orders.html / order-shop.html / order-portal.html / assets/lp-order-storefront.js
```

Money: **integer cents**. Weight: **numeric kg** (requested ≠ actual).

---

## Phase coverage

**Staff:** products, new order, deposit link, lock date, supply, finalise weight, calendar, customers, payments, change approvals, CSV export, messaging AI → save template.

**Customer:** storefront cart → checkout → deposit Stripe → portal view/edit before cutoff.

**Automation:** abandoned cart cron marks carts + sends recovery messages; deposit webhook confirms orders.

Still later / optional: delivery zones, wholesale, POS/Xero, multi-location stock, gift cards, PDF print packs.

---

## Tests

```bash
node scripts/test-order-engine.js
```

---

## Agent rules

- Do not hardcode butcher into core engine logic.
- Do not confuse with `domain_orders` / quote systems.
- Never store card PANs.
- Preserve order-item snapshots.
- AI messages require admin save before send.
