---
title: Settings — Tax & Payments
section: Settings
order: 40
summary: GST categories, the deposit rule, deposit reminders and connecting Stripe.
---

# Tax & Payments

## GST

Tick the categories whose products include GST (for example Sauces & Extras, Pies). Prices are shown "inc. GST" where it applies, and the order shows the GST included.

## Cooking rate

The price per kg charged when a customer chooses an option marked **Charge cooking rate** (set on the option in Products). It includes GST — the GST in the cooking part shows on receipts even when the meat is GST-free.

- Example at $9.50/kg: a 3–4 kg ham shows cooking $28.50–$38.00 until weighed; weighed at 3.6 kg it's $34.20.
- Leave it blank to stop charging for cooking.
- Changing it only affects new orders and edits; existing order lines keep the rate they were ordered at.

## Payment rule (deposit)

- **None / pay later**, **Fixed deposit** (for example $50 per order), **Percentage deposit**, **Full payment**, **Quote first**.
- **Deposit amount** — for a fixed deposit.
- The deposit is due when the order is placed; the balance is paid at pickup.

## Deposit reminders

- **Automatic reminders** on/off, **first reminder after** (days), **day-before-lock reminder**.
- **Channels:** email, SMS, or both.

## Customer payments (Stripe)

**Connect Stripe** links your shop's own Stripe account so customers can pay online. See **Stripe Connect** for the full steps. Advanced fields (charge mode, account ID, statement suffix) are for support use.

## FAQ

**Can I take a bigger deposit from one customer?** Yes — record what they paid on their order (Record payment → amount).
