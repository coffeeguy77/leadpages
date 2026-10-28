---
title: Payments (the ledger)
section: Payments & money
order: 10
summary: Every payment with date range, sorting, search, totals by method, over the counter vs remote, and CSV export for your accounts.
---

# Payments

The Payments screen has three tabs:

- **Ledger** — your money ledger: one row per payment, for any period you choose. Use it for your accounts.
- **Unpaid deposits** — orders still waiting for their deposit.
- **Paid deposits** — the older deposit list.

## The table

| Column | What it shows |
|---|---|
| **Date** | When the money was received (for manual payments, the date you entered). |
| **Customer** | Who paid. |
| **Order** | The order number — click to open the order. |
| **Amount** | How much. |
| **Method** | Stripe, EFTPOS, Cash, Direct deposit or Contra. |
| **Status** | **Received**, **Refund due** (a duplicate card charge to refund), **Refunded**, **Not finished** (a card checkout that was never completed) or **Voided** (a manual payment cancelled by staff). |

Under the method you'll also see the **payer name** and **bank reference** for direct deposits, and a note if the payment was corrected.

By default the ledger shows money received (plus refunds). Tick **Include unfinished & voided** to see everything.

- **Sort:** click a column heading. Click again to reverse (A–Z ↔ Z–A, low–high ↔ high–low).
- **Search:** type a customer name, order number, amount, payer name or bank reference.
- **Method filter:** show one method (e.g. only EFTPOS), or **Over the counter** / **Remote**. The totals follow the filter, so you can total EFTPOS for a month in two clicks.
- Click a row to open the order.

## Choosing a period

Pick a preset — **Today**, **This week** (Monday–Sunday), **This month**, **Last month**, **This financial year** (1 July – 30 June), **Last financial year** or **All time** — or change the **From** / **To** dates for any period (the preset switches to *Custom dates*). The totals and the table update together.

## Totals

For the chosen period you'll see:

- **Money received** (everything except contra).
- **By method:** a chip for each of Stripe, EFTPOS, Cash, Direct deposit and Contra with its total and count.
- **Refund due**, if any duplicate card payments are waiting to be refunded.
- **Over the counter vs Remote:**
  - **Over the counter** = Cash + EFTPOS.
  - **Remote** = Stripe (online card) + Direct deposit.
  - **Contra** is shown separately because no money changes hands.

Press **Export CSV** to download exactly what's on screen (period, filter and search) for your bookkeeper — including the over-the-counter/remote column, payer name and bank reference.

If some Stripe payments were taken on the platform's Stripe account (before your own Stripe was connected), the ledger says so and marks those rows — that money is **not** in your Stripe balance.

## Recording a payment someone made outside Stripe

Open the order → **Payments** card (right-hand side) → **Record payment**:

1. **Method:** EFTPOS, Cash, Direct deposit or Contra.
2. **Amount:** what was actually received. It starts at the deposit owing but you can change it — for example $150 for an order of 8 hams.
3. **Date received:** the day the money arrived (for a bank transfer, the date on the bank statement).
4. For **Direct deposit**, also enter:
   - **Payer name** — exactly as it appears on your bank statement.
   - **Bank reference** — the description/reference on the transfer.
   These let you trace the payment quickly in your bank account if there's ever a dispute.
5. Optional staff notes.
6. Leave **Send the customer their order** ticked to text/email them their order straight away (it shows the deposit paid, and they can print it to bring in). Press **Record payment**.

Their order page now shows the deposit as paid.

## Correcting or voiding a manual payment

Typed $50 instead of $150? Recorded it on the wrong order? Open the order → **Payments** card → the payment → **Correct** (change method, amount, date, payer, reference, notes — and say why) or **Void** (it stops counting; the record stays). The order's deposit updates, and every change is logged in the order's History with who did it.

Stripe payments can't be edited here — refunds are done in your Stripe account.

## "Why doesn't Stripe show the same total?"

Because most deposits don't go through Stripe. Stripe only holds **online card payments**. Money taken by EFTPOS at the counter, cash, direct deposit and contra is recorded here but never touches Stripe. Compare the **Stripe** line in the totals with your Stripe account, not the grand total.

Also:
- Online card payments land in **your shop's own Stripe account** (see **Stripe Connect**).
- **Pending** Stripe rows are checkouts a customer started but didn't finish — no money moved.

## FAQ

**The accountant can't find a payment in the bank.** Search the ledger for the customer or amount, open it and check the payer name and bank reference.

**A customer paid twice by card.** Refund one in your Stripe account; the duplicate is marked so it isn't counted twice.
