# Bookings — Native LeadPages scheduling app

**Document:** `features/Bookings`  
**Status:** Phase 1–4 foundation + payments / waitlist / customers slice  
**Audience:** Engineers and AI agents  
**Prerequisites:** [INDEX](../INDEX.md), [02-DATABASE](../02-DATABASE.md), [Order Engine](Order%20Engine.md), [Marketplace](Marketplace.md)

---

## Executive summary

Native LeadPages **Bookings** app for appointments, classes/events, on-site visits, and resource hire.

**Pattern:** Order Engine–style dedicated subsystem (`booking_systems` + `api/bookings/*` + `lib/bookings/*` + `bookings.html`), **not** an expansion of the marketing-only `bookingCta` section.

**Core rule:** Availability and pricing are calculated **server-side**. The browser never decides whether a slot is free or what the total is.

---

## Architecture found (reuse)

| Existing system | Reuse |
|-----------------|-------|
| Order Engine auth / site access | Clone `lib/order/auth.js` → `lib/bookings/auth.js` |
| Integer-cent money | Clone `lib/order/money.js` |
| Stripe deposits + webhooks | Fetch-based Checkout (`api/bookings/checkout.js`); HMAC webhook (no `stripe` npm) |
| Resend / Twilio | Notification **outbox** (`booking_notifications`); delivery worker later |
| Marketplace `site_apps` + `app_registry` | Register `bookingStorefront` section |
| manage embed iframe | Same as Orders → `/bookings?embed=1&site_id=` |
| Design tokens | `lp-themes.css` admin chrome |
| `bookingCta` | Remains CTA; deep link / scroll to Bookings widget when enabled |

### Contradictions vs full spec

| Spec ask | Repo reality | Decision |
|----------|--------------|----------|
| Square payments | Not integrated | Stripe + manual / pay later only; Square boundary stubbed |
| Fine-grained staff RBAC | Owner/partner/super only | Same access model as Orders for v1; team members may be non-users |
| Shared CRM customers | Leads ≠ order_customers | Dedicated `booking_customers` with phone/email dedupe (merge UI later) |
| Google/Outlook sync | None | Schema + connection stubs; sync Phase 5 |
| Full automations builder | None | Confirmation + 24h reminder rows enqueued on create |
| AI naming | Brain exists | Not required for v1 operational release |

---

## Surfaces

| Surface | URL | Who |
|---------|-----|-----|
| Site backend → **Bookings** | manage → Bookings (embeds `/bookings?embed=1&site_id=…`) | Owner / partner |
| Ops Command → Bookings | `/bookings` | Staff / owner / partner / super |
| Public book | `/book?slug=…` or `/book?slug=…&service=…` | Public |
| On-site widget | Page section **Bookings** (`bookingStorefront`) | Public when on |
| Customer portal | `/booking-portal?t=…` | Magic link (+ Pay deposit) |

---

## Enable a site (ops)

1. Apply SQL: `db/bookings_schema.sql`, `db/bookings_rls.sql`  
   If schema was applied before waitlist/notifications: also run `db/bookings_phase2.sql`
2. Manage → **Bookings** → complete onboarding (or Settings → enable)
3. Optional: Page editor → **Bookings** section on → publish  
   Or share `/book?slug=<site-slug>`
4. Stripe: `STRIPE_SECRET_KEY` + `POST /api/bookings/webhook` + `STRIPE_BOOKINGS_WEBHOOK_SECRET` (falls back to order/platform webhook secret)

---

## APIs (staff + public)

| Route | Role |
|-------|------|
| `/api/bookings/system` | Ensure/patch system, seed hours, finish onboarding |
| `/api/bookings/services` | Services, team, resources |
| `/api/bookings/availability` | Public + staff slot search |
| `/api/bookings/bookings` | Create / list / transition |
| `/api/bookings/calendar` | Week feed + overview metrics (+ exceptions) |
| `/api/bookings/public` | Catalogue + create (auto Checkout when deposit due) |
| `/api/bookings/portal` | Customer cancel / reschedule |
| `/api/bookings/checkout` | Stripe Checkout (portal token or staff) |
| `/api/bookings/webhook` | Stripe `checkout.session.completed` |
| `/api/bookings/exceptions` | Blocked times CRUD |
| `/api/bookings/customers` | Search / notes |
| `/api/bookings/waitlist` | Public join + staff notify |

---

## Status model

Central definitions in `lib/bookings/status.js`:

`draft` → `pending` → `confirmed` → `checked_in` → `in_progress` → `completed`  
Also: `awaiting_payment`, `cancelled`, `no_show`, `refunded`

Public bookings with `deposit_cents > 0` start as `awaiting_payment` until Stripe webhook confirms.

---

## Money

**Integer cents** only. GST inclusive/exclusive per `gst_mode`.  
Deposit rules: system `payment_rule` / service override → `quoteBooking`.

---

## Tests

```bash
node --test tests/bookings-*.test.js
```

---

## Agent rules

- Do not confuse with Order Engine pickup calendars or `bookingCta` marketing CTA.
- Never trust browser totals or availability.
- Never store card PANs; never add `stripe` npm solely for Checkout — use fetch + HMAC like Order Engine.
- Soft-delete / archive services and team; keep booking history.
- AI must not auto-confirm, reprice, or send without explicit automation/user approval.
