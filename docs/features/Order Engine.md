# Order Engine — Universal Ordering System

**Document:** `features/Order Engine`  
**Status:** Phase 1 shipped (schema + admin + portal + deposit checkout)  
**Audience:** Engineers and AI development agents  
**Prerequisites:** [INDEX](../INDEX.md), [02-DATABASE](../02-DATABASE.md), [CLAUDE.md](../../CLAUDE.md)

---

## Executive summary

The Order Engine is a **reusable LeadPages module** for businesses that take future orders, deposits, pickup/delivery, variable-price products, and lead times. It is **not butcher-only** — the butcher is the first industry preset and first production client.

**Core rule:** the order record is the permanent source of truth (replacing triplicate paper sheets, Google Sheets, and handwritten change lists).

Workflow:

`Cart → Order → Deposit/Payment → Customer Editing → Cutoff → Lock → Supply/Production → Final Pricing → Pickup/Delivery → Completion`

Concepts stay separate: Product, pricing method, stock behaviour, product cutoff, lead time, order cutoff, deposit rule, customer, cart, order, order item, change, payment, fulfilment, message, supply.

---

## Surfaces

| Surface | URL / entry | Who |
|---------|-------------|-----|
| Ops Command panel | `/orders` (Command → **Orders**) | Site owner / partner / super |
| Admin app | `orders.html` | Staff / admin |
| Customer portal | `/order-portal?t=…` | Magic-link token |
| APIs | `/api/order/*` | Bearer (admin) or portal token |

---

## Apply migrations (ops)

In Supabase SQL editor, run in order:

1. `db/order_engine_schema.sql`
2. `db/order_engine_rls.sql`

Do **not** confuse with `domain_orders`, `partner_quotes`, or `quote_systems` — Order Engine uses the `order_*` namespace.

---

## Architecture

```
lib/order/          Core engine (pricing, cutoff, deposit, supply, tokens, presets, service)
api/order/          Serverless handlers
orders.html         Staff / admin shell
order-portal.html   Customer magic-link UI
db/order_engine_*.sql
```

Money uses **integer cents**. Weights use **numeric kg** (requested and actual stored separately; never overwrite requested).

### Key tables

| Table | Role |
|-------|------|
| `order_systems` | Per-site binding + business defaults |
| `order_categories` / `order_products` | Catalogue; modular pricing/stock/cutoff/lead time |
| `order_product_questions` / `order_product_relationships` | Config questions + cross-sell |
| `order_customers` | Lightweight ordering CRM |
| `order_carts` / `order_cart_items` | Persisted carts (not browser-only JSON) |
| `order_orders` / `order_items` | Source of truth + product snapshots on lines |
| `order_item_answers` | Per-line question answers |
| `order_payments` | Deposits / balance (no raw cards) |
| `order_changes` / `order_change_requests` | Audit + optional approval mode |
| `order_access_tokens` | Hashed magic links |
| `order_message_templates` / `order_messages` | Templates + sends |
| `order_abandoned_cart_events` | Recovery tracking |
| `order_fulfilment_windows` / `order_date_locks` | Pickup capacity / date locks |
| `order_audit_events` | Important action log |

Reads for owners use RLS helper `order_engine_site_visible(site_id)`. Writes go through service-role APIs.

---

## Pricing methods

`fixed` · `per_unit` · `per_weight` · `estimated` · `from_price` · `price_tbc` · `quote_required`

Unknown prices never fake a full order total. Orders store known / estimated / final subtotals, deposit paid, and balance (or TBC).

Staff can finalise weight lines: actual kg × rate → line total → order recalculation.

---

## Deposits

Business default payment rule with inheritance:

**business → category → product → order**

Rules: `none` · `fixed_deposit` · `percentage_deposit` · `full_payment` · `pay_later` · `quote_first`  
Scope: `per_order` | `per_item`

Butcher preset: **$50 fixed deposit per order**, balance at pickup.

Deposit checkout: Stripe Checkout via `POST /api/order/checkout-deposit`. Webhook: `POST /api/order/webhook` (`metadata.kind=order_deposit`). Prefer `STRIPE_ORDER_WEBHOOK_SECRET` when set.

Until paid: status **Awaiting Deposit**. After success: **Confirmed**. Confirmed orders drive supply (awaiting deposit excluded by default).

---

## Cutoffs & lead times

- Product cutoff ≠ lead time ≠ business default cutoff.
- Multi-product orders use the **most restrictive** effective cutoff; stored on the order for audit.
- Lead times constrain earliest selectable pickup dates.
- Editing states: `OPEN` · `CLOSING SOON` · `LOCKED` (auto at cutoff; admin can lock a date).

---

## Industry presets

`lib/order/presets.js` — presets **seed defaults only** and never permanently restrict settings.

Initial: **butcher**. Placeholders for bakery, florist, catering, beer supplies, printing, wholesale, retail, made-to-order, custom.

---

## Phase 1 staff flow (butcher)

1. Enable Order Engine on a site (apply preset).
2. Create products (fixed / per kg / Price TBC, cutoffs, lead times, stock methods).
3. Staff create order → send deposit link / magic link.
4. Customer pays deposit → views/edits before cutoff (audited).
5. Admin supply view by pickup date; lock date when preparing.
6. Enter actual weights → finalise prices → balance remaining.
7. Mark ready / collected / completed.

---

## APIs (Phase 1)

| Route | Purpose |
|-------|---------|
| `/api/order/system` | Get/patch order system; apply preset |
| `/api/order/products` | Product CRUD |
| `/api/order/orders` | List/detail, create staff order, lock, finalise, status |
| `/api/order/dashboard` | KPI cards |
| `/api/order/supply` | Supply requirements aggregation |
| `/api/order/portal` | Token-scoped customer view/edit |
| `/api/order/checkout-deposit` | Stripe deposit session |
| `/api/order/webhook` | Stripe deposit paid |
| `/api/order/message-ai` | Brain (or curated fallback) draft templates — admin must save |

---

## Tests

```bash
node scripts/test-order-engine.js
```

Covers pricing, deposit, cutoff, supply aggregation.

---

## Phase 2 (architecture ready, not required for butcher go-live)

Customer self-serve storefront, abandoned-cart cron + multi-stage recovery UI, delivery zones, multi-location, change-approval UI polish, calendar export/PDF, wholesale, bundles, promo codes, accounting/POS integrations.

---

## Rules for agents

- Do **not** hardcode butcher rules into core engine logic.
- Do **not** rename or reuse `domain_orders` / quote tables.
- Do **not** store card PANs.
- Preserve order-item snapshots; never rely only on live product rows for history.
- New AI messaging goes through Brain (`message-ai`); never publish AI copy without admin save.
- Prefer additive changes; do not refactor unrelated LeadPages modules.
