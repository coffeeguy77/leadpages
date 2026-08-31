# Bookings — Native LeadPages scheduling app

**Document:** `features/Bookings`  
**Status:** Phase 1–4 foundation (operational + public booking)  
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
| Stripe deposits + webhooks | Same Stripe Checkout pattern; webhook `api/bookings/webhook.js` |
| Resend / Twilio | Same messaging env keys; booking-specific templates later |
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
| Full automations builder | None | Starter confirmation/reminder flags on `booking_systems.settings` |
| AI naming | Brain exists | Not required for v1 operational release |

---

## Surfaces

| Surface | URL | Who |
|---------|-----|-----|
| Site backend → **Bookings** | manage → Bookings (embeds `/bookings?embed=1&site_id=…`) | Owner / partner |
| Ops Command → Bookings | `/bookings` | Staff / owner / partner / super |
| Public book | `/book?slug=…` or `/book?slug=…&service=…` | Public |
| On-site widget | Page section **Bookings** (`bookingStorefront`) | Public when on |
| Customer portal | `/booking-portal?t=…` | Magic link |

---

## Enable a site (ops)

1. Apply SQL: `db/bookings_schema.sql`, `db/bookings_rls.sql`
2. Manage → **Bookings** → complete onboarding (or Settings → enable)
3. Optional: Page editor → **Bookings** section on → publish  
   Or share `/book?slug=<site-slug>`
4. Stripe: `POST /api/bookings/webhook` + `STRIPE_BOOKINGS_WEBHOOK_SECRET` (falls back to order webhook secret if unset)

---

## Status model

Central definitions in `lib/bookings/status.js`:

`draft` → `pending` → `confirmed` → `checked_in` → `in_progress` → `completed`  
Also: `awaiting_payment`, `cancelled`, `no_show`, `refunded`

Transitions validated server-side; every change writes `booking_status_history` + `booking_activity`.

---

## Money

**Integer cents** only (`price_cents`, `deposit_cents`, …). GST as inclusive or exclusive per system setting (`gst_mode`).

---

## Tests

```bash
node --test tests/bookings-*.test.js
```

---

## Agent rules

- Do not confuse with Order Engine pickup calendars or `bookingCta` marketing CTA.
- Never trust browser totals or availability.
- Never store card PANs.
- Soft-delete / archive services and team; keep booking history.
- AI must not auto-confirm, reprice, or send without explicit automation/user approval.
