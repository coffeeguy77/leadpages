# Bookings — Native LeadPages scheduling app

**Document:** `features/Bookings`  
**Status:** Phase 1–4 foundation + payments / waitlist / customers + vehicle/equipment hire mode  
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
| Google/Outlook sync | Hire Google Calendar + Contacts OAuth live (Leadpages-authoritative) | Outlook still later |
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

1. **Install schema (required once):** either  
   - Super-admin `POST /api/bookings/bootstrap` with body `{ "confirm": "APPLY_BOOKINGS_SCHEMA" }`, or  
   - Run `db/bookings_schema.sql` then `db/bookings_rls.sql` in the Supabase SQL editor  
   If schema was applied before waitlist/notifications: also run `db/bookings_phase2.sql`
2. Manage → **Bookings** → complete onboarding (or Settings → enable)
3. Optional: Page editor → **Bookings** section on → publish  
   Or share `/book?slug=<site-slug>`
4. Stripe: `STRIPE_SECRET_KEY` + `POST /api/bookings/webhook` + `STRIPE_BOOKINGS_WEBHOOK_SECRET` (falls back to order/platform webhook secret)

If staff Bookings errors with schema missing, step 1 was skipped.

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
| `/api/bookings/holds` | Soft-lock slot during public checkout |
| `/api/cron/bookings-notify` | Flush notification outbox (every 10 min) |

---

## Status model

Central definitions in `lib/bookings/status.js`:

`draft` → `pending` → `confirmed` → `checked_in` → `in_progress` → `completed`  
Also: `awaiting_payment`, `cancelled`, `no_show`, `refunded`

Public bookings with `deposit_cents > 0` start as `awaiting_payment` until Stripe webhook confirms.

Staff can **Mark paid (manual)** or open Stripe Checkout from the booking panel.

Portal: Pay deposit + **Add to calendar** (`.ics`).

---

## Money

**Integer cents** only. GST inclusive/exclusive per `gst_mode`.  
Deposit rules: system `payment_rule` / service override → `quoteBooking`.

---

## Notifications

Rows land in `booking_notifications` on create (confirmation + optional 24h reminder).  
Cron `/api/cron/bookings-notify` sends via Resend (`RESEND_API_KEY`, optional `BOOKINGS_FROM`) / Twilio for SMS.

Hire Google reconciliation: `/api/cron/bookings-hire-google-sync` every 15 minutes (Leadpages-authoritative restore).

---

## Vehicle & equipment hire mode

Configurable hire booking type on top of the shared Bookings subsystem (not a truck-only fork).

### Implementation map (extend, don’t duplicate)

| Concern | Existing module | Hire extension |
|---------|-----------------|----------------|
| Resources | `booking_resources` | Hire profile columns + `db/bookings_hire.sql` |
| Availability | `lib/bookings/availability.js` | `lib/bookings/hire/duration.js` + `capacity.js` |
| Pricing | `lib/bookings/pricing.js` | `lib/bookings/hire/pricing.js` (daily × days, bond, snapshot) |
| Customers | `booking_customers` | Driver/licence fields on hire details; Google/Xero contact links |
| Payments | Stripe Checkout | SetupIntent card-on-file (`hire/card-on-file.js`) |
| Notifications | `booking_notifications` + cron | Same outbox; 72h/24h hire reminders via settings |
| Audit | `booking_activity` / audit events | Lock, capacity override, reschedule, sync events |
| Documents | — | Rental agreement templates/versions |
| Google | — | OAuth + Calendar authoritative sync + Contacts |
| Xero | — | OAuth + contacts/invoices/payments |

### Defaults (truck-hire customer)

- Terminology: Truck / Trucks / Hire Booking / Hirer (configurable)
- Single-day duration: **23h 55m** timed event (configurable to 23h 59m)
- Calendar drag: **off**; unlock + Change dates workflow required
- Daily fleet capacity: **4** jobs/day (multi-day counts every occupied day)
- Google Calendar authority: **Leadpages**
- Cancellation: >48h none · 24–48h $50 · <24h retain rental; reschedule preserves fee floor

### Key APIs

- `POST /api/bookings/hire/quote`
- `POST /api/bookings/hire/bookings` (`create`, `unlock`, `change_dates`, `cancel_preview`, `setup_card`, `save_card`, `generate_agreement`)
- `GET /api/bookings/hire/fleet-calendar`
- `GET|POST /api/bookings/google?action=…`
- `GET|POST /api/bookings/xero?action=…`

### Env still required for live integrations

- `BOOKINGS_OAUTH_ENCRYPTION_KEY` (or `GOOGLE_ADS_OAUTH_ENCRYPTION_KEY`)
- `GOOGLE_BOOKINGS_CLIENT_ID` / `GOOGLE_BOOKINGS_CLIENT_SECRET` / redirect URI
- `XERO_CLIENT_ID` / `XERO_CLIENT_SECRET` / redirect URI
- Existing `STRIPE_SECRET_KEY` for SetupIntents

### Apply schema

Bootstrap now also runs `db/bookings_hire.sql`, or apply manually after `bookings_schema.sql`.
`db/bookings_hire_rls.sql` (run after it) switches on RLS and removes anon access for the hire tables.

### Hire v2 — fleet desk, public flow, phone bookings

No schema changes. Everything new lives in existing columns:

| Thing | Where it's stored |
|-------|-------------------|
| Per-weekday rates (e.g. Friday $220) | `booking_resources.hire_meta.day_rates` = `{mon..sun: cents}` (blank = normal rate) |
| Vehicle features / staff notes | `booking_resources.hire_meta.features`, `.staff_notes` |
| Unavailable (repairs / private job) | `booking_schedule_exceptions` scope `resource`, kind `maintenance` or `block` |
| Hire settings (times, lengths, terms, holidays, closed days) | `booking_systems.settings.hire` |
| Which preset a business started from | `booking_systems.settings.preset` |

Rate order for a day: public holiday → weekday rate → weekend rate → default.

**Public (customers)**
- Site bar `assets/lp-booking-hire.js` + flow `assets/lp-booking-flow.js` (month calendar with “N left” pills, scarcity line, choose vehicle, details, terms, done page with .ics + manage link).
- API `api/bookings/hire/public.js`: `GET action=calendar`, `POST options | book | card_return`.
- Online bookings are always created **pending**; staff approve. A pending request holds the vehicle.
- Card saving: Stripe Checkout (setup mode) on the business's connected account. Only offered when `stripe_connect_account_id` is set (`acct_…`). Nothing is charged at booking.
- Emails (`lib/bookings/hire/messages.js`): request received (customer + business email), confirmed, declined, cancelled.

**Staff (`/bookings`)** — `assets/bk-fleet-admin.js`, API `api/bookings/hire/fleet.js` (site access checked):
- Hire desk: requests to approve/decline, today's pick-ups and returns.
- Fleet calendar: 14-day timeline per vehicle; click an empty day to book; blocks shown hatched.
- Fleet: add/edit vehicles (make, model, rego, rates, weekday rates, bond, km), mark unavailable, archive.
- Phone booking: find free vehicles, book in a few clicks, optional “book anyway” override, optional email.
- Booking panel: picked up / returned / no-show / cancel, charge the saved card.
- Hire settings + presets.

### Presets (all booking types)

`lib/bookings/presets.js` — truck, car, trailer, equipment, venue hire; barber, hair, beauty, massage, physio, trades, cleaning, mechanic, dog grooming, consultations, photography, classes, fitness. Applying a preset only adds what's missing (services by slug, opening hours when none exist, slot spacing on a fresh set-up). **Prices start blank** (“price on enquiry”) — the business sets its own.

### Public booking page (`/book?slug=`)

Step cards (service → date & time → details → confirm), month calendar from `GET /api/bookings/availability?month=YYYY-MM` (per-day `slots`, `spots`, `best`), slots carry `capacity` and `remaining` so classes show “3 left”. Hire services open the hire flow instead. A customer's own hold no longer blocks their own booking (`createBooking` `holdKey`).

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
- Hire mode must not break appointment/class/visit booking types.
