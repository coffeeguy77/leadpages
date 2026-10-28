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

## Specials

Staff put a product on special in **Products → edit → Pricing → Put this product on special**.

- **Type:** set special price, or percentage off. The editor previews the result, e.g. "10% off $50.00/kg = save $5.00/kg → $45.00/kg", and blocks saving a special that isn't lower than the normal price.
- **How long:** ongoing, until a date, or scheduled (start + end). Whole days in the site timezone (default Australia/Sydney); the end day is included.
- **Stored** on the product as `options.special` (`{ on, mode, price_cents | percent, timing, start, end }`) — no schema change. Turning it off keeps the settings for next time.
- **Not for** "Price confirmed later" / quote products (no price to discount).

**Pricing rule:** `lib/order/specials.js` → `priceLineAtOrder()` (`lib/order/pricing.js`) prices a line at the special when it is ordered — cart, checkout, staff orders and added lines all go through it. The price is locked in when ordered: existing lines are repriced from their stored unit price (no `options`), and weight finalisation uses the stored per-kg rate. Imported history passes `{ ignoreSpecial: true }`. Order lines record `product_snapshot.special`.

**Shop:** `/api/order/storefront` sends the special price as the product price, plus `special` (`was_display`, `saving_display`, `ends`…) and `regular_price_*`; the raw settings are stripped. The storefront shows a **Specials** tab after the info tabs (only while a special is live) and a Special badge with old price + saving in categories. The staff product list shows a Special / Special soon badge.

Tests: `tests/order-specials.test.js`.

## Deposits and Stripe (money rules)

**Online deposits go only to the shop's own Stripe account.** `api/order/checkout-deposit.js` refuses (409 `payments_not_connected`) unless `settings.payments.stripe_connect_account_id` is a connected account with `charges_enabled`. A shop's deposit is never charged on the platform (LeadPages / Web Culture) account. Customers then see "Deposit … is payable to the shop" instead of the Pay button (`online_payment` in `/api/order/portal`), and staff record deposits in-house.

**Connect Stripe** (Order Settings → Tax & Payments): `api/order/stripe-connect.js` creates a **Standard** Stripe account for the shop (country AU) and returns a Stripe onboarding link (new tab). Direct charges: money, Stripe fees, refunds and disputes belong to the shop. Requires Connect to be enabled on the platform Stripe account. The manual "acct_…" field is under Advanced. A stale settings form can't drop a Connect-button account (`api/order/system.js`; clearing needs `payments.disconnect_stripe`).

**Recording payments** — `lib/order/stripe-pay.js` `recordStripeSession()` records a deposit only from Stripe's own Checkout Session (`payment_status: paid`), once (conditional pending→paid update). It runs from:
- `api/order/webhook.js` — verifies the signature on the raw body; if it can't (Vercel parsed the body), fetches the event back from Stripe by id and trusts only that. Handles Connect events (`account`).
- `api/order/portal.js` (customer returns from Stripe), `api/order/orders.js` (staff open an order), `api/order/payments.js` (payments list), `checkout-deposit` (before creating a new session — no double charges).
- `api/cron/order-payments-sync.js` every 10 minutes, and before deposit reminders.

`order_payments.meta.stripe_account` records where the session lives. `meta.refund_due` (duplicate charge) and `meta.no_count` (already counted) record the payment without adding it to the deposit again.

Tests: `tests/order-stripe-payments.test.js`.

## Customer order page (invoice view)

`order-portal.html` opens every order as an invoice: business, order number, order date, customer, pickup, items table (qty / weight, amount), totals (subtotal, GST, deposit, balance), notes, Print / Pay deposit. No edit fields or "changes open" badges.

Editing is still there but not promoted: a quiet **Make changes** button at the very bottom, shown only while `can_edit` (before the order's lockout and the season lock). It opens the existing edit view (with **← Back to order**); saving reloads into the invoice.

Checkout asks **First name** and **Last name** (both required) and sends `customer_name` as "First Last"; SMS `{{first_name}}` greets by the first word.

Message templates: money placeholders (`{{deposit_amount}}`, `{{cart_total}}`, `{{known_cart_total}}`) already include "$" — a "$" typed in front is dropped so texts never say "$$50.00".

**Docket layout (Oct 2026):** the invoice view is laid out like the shop's paper order docket — the shop's logo (`config.logo.imageUrl`) and phone/email, a boxed order number with the order date, **PICK UP DATE** day / date / time, **Surname / First Name** (surname = last word), email and phone, a Quantity | Order | $/kg | $ table (item notes and order notes underneath), Deposit, a **TOTAL PAYABLE INCLUDING GST** box (filled once prices are final) and "For and on behalf of …". On phones the $/kg moves under each item.

**Quantity-only per-kg items** ("Individual item", or a pack with no pack weight) get no assumed weight: the line is qty × $/kg, priced when weighed (`isCountOnlySize` in `lib/order/product-options.js`). Weighed items still default to their minimum / 1 kg estimate.

**Staff names:** new order, order edit and customer edit show First name / Last name (`lpSplitName` in `orders.html`); the original input keeps "First Last" so saving is unchanged.

## Order links on the shop's own domain

Customer links (order SMS/email, deposit links and reminders, staff "send link", printed QR codes, Stripe return, abandoned-cart links) use the shop's own domain — e.g. `https://www.griffithbutchery.com.au/order-portal?t=…` — via `lib/order/public-base.js` `orderLinkBase(site)`.

It uses `sites.custom_domain` only when that domain is attached to the LeadPages Vercel project, verified, and its DNS points here (`getProjectDomain` + `getDomainConfig` in `api/vercel/_client.js`); an apex that redirects to www uses www. Otherwise — or if Vercel is slow (2.5 s) or errors — links stay on leadpages.com.au, so a link is never broken. Cached 10 minutes per server instance. Links already sent keep working (tokens work on either host).

## Stock pieces (hams, turkeys…) — received stock allocated to orders

Table `order_stock_pieces` (migration `db/migrations/20261028_order_stock_pieces.sql`): one row per
received piece with its real weight, optional tag, status `available | allocated | written_off`, and the
order line (`order_items.id`) it is allocated to. Rules live in `lib/order/stock.js`; staff API
`api/order/stock.js`; staff screen **Order Operations → Stock** (`orders.html#stock`).

- **Per category switch** — `order_systems.settings.stock_control.category_ids` (product's primary
  category). Off = ordering unchanged. Stock can be received and allocated while off.
- **Allocate = weigh.** A line needs one piece per unit (`quantity`). When it has them all, its
  `actual_weight_kg` = total and `line_final_cents` = total × the line's $/kg (+ option extras),
  `price_status = finalised`. Releasing puts the line back to its estimate / TBC (only if stock had
  finalised it; hand-weighed lines are untouched). `options_snapshot.stock` records the pieces.
- **Protect pre-orders.** A product is only offered in the shop once every open order
  (`awaiting_deposit, confirmed, changes_open, locked, in_preparation, ready`) for it has its pieces;
  otherwise it shows Sold out. Staff see the pieces with a "still waiting" note.
- **Picking a piece.** Shop (`add_item` with `stock_piece_id`), staff New order, and Make changes
  offer the real pieces (weight + price). One piece per line, quantity 1, never merged. Cart lines
  are priced `known` (exact weight). Pieces are only locked when the order is created
  (`createStaffOrder` → `allocatePiece`, a conditional update so one piece can never go to two
  orders); if one was taken meanwhile the new order is deleted and the customer gets `piece_taken`.
  The full cart response flags `stock_unavailable` lines.
- **Release** on order cancel / refund / void, line removal (DB trigger `order_items_release_stock`
  frees pieces of any deleted line), and Make changes removal. Restored orders do not re-take pieces.
- **Order again** skips stock-controlled products (`reason: 'choose_piece'`) — the customer picks again.
- Staff "add item" in order detail and imports create lines without pieces: they show as waiting on
  the Stock screen.

## Payments ledger, payment tracing, Send order, Other date, order screen redesign, wiki (2026-10-28)

- **Ledger** — `lib/order/payment-ledger.js` + `GET /api/order/payments-ledger` (staff). One line per payment:
  date received (`meta.received_on` → `paid_at` → `created_at`, shop time zone), method, channel
  (counter = cash + EFTPOS, remote = Stripe + direct deposit, contra separate), status (received,
  refund due, refunded, not finished, voided). Stripe payments with no `meta.stripe_account` are flagged as
  taken on the platform account. Payments screen → **Ledger** tab: range presets incl. AU financial year,
  method/channel filter, search, sortable columns, totals, CSV of what's on screen. Old Unpaid/Paid tabs kept.
- **Recording payments** — `recordInhousePayment` now takes `amount_cents`, `received_on`, `payer_name`,
  `bank_reference` (stored in `order_payments.meta`; no schema change). New `correctInhousePayment` /
  `voidInhousePayment` (staff-recorded only; deposit paid moves by the difference; audit
  `payment_corrected` / `payment_voided`). Order API actions `correct_payment`, `void_payment`.
- **Send order** — order screen button → existing `send_receipt` action with channel (sms / email / both).
- **Pickup "Other date…"** — New order and order screen list the usual dates plus Other date… (any day).
  Staff PATCH of `pickup_date` recalculates `effective_cutoff_at` / `editing_state` with the same rule as new
  orders (`lockTimeForPickup`), unless the order is locked.
- **Order screen** — full-width sheet: docket on the left (items table with Weigh / Remove, totals),
  sidebar cards (Status, Send & print, Payments, Customer & pickup, Staff notes, Importance, History).
  All previous actions kept. Add-product picker reuses New order rows incl. stock pieces
  (`add_order_item` accepts `stock_piece_id`).
- **Wiki** — Settings → Help & Wiki. Pages in `docs/order-wiki/*.md` (front matter: title, section, order,
  summary), served by `GET /api/order/wiki` (staff; bundled via vercel.json includeFiles), rendered by a small
  safe Markdown renderer with search. Build history pages included.
- **Data fix** ORD-2026-00012: payment $50 → $150 direct deposit received 14 Oct, pickup 2026-12-07, lock
  2026-12-04 17:00 AEDT (backup + audit `payment_corrected`).
