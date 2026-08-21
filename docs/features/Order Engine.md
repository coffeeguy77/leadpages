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
   - Or Messages API: same SID/token plus `TWILIO_FROM_NUMBER` (E.164)

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

**Customer:** storefront cart → checkout → deposit Stripe → portal view/edit before cutoff; **SMS OTP login** → history → **reorder** (live prices; skip unavailable products).

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
