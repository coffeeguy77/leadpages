---
title: Messaging (SMS & email)
section: Settings
order: 60
summary: Order texts and emails, placeholders, SMS usage and credits, broadcasts and AI drafts.
---

# Messaging

## Message templates

Texts and emails go out for events such as order confirmed, deposit required, deposit reminder and receipt. Edit the wording under **Messaging**.

### Placeholders

Type these in a message and they're filled in for each customer:

| Placeholder | Becomes |
|---|---|
| `{{first_name}}` | Customer's first name |
| `{{order_number}}` | ORD-2026-00047 |
| `{{portal_link}}` | Link to their order page |
| `{{deposit_amount}}` | $50.00 |
| `{{business_name}}` | Your shop name |
| `{{pickup_date}}` | Their pickup date |

> **Money placeholders already include the $.** Write `Pay your {{deposit_amount}} deposit`, not `${{deposit_amount}}`. (If you do type a $ in front, it's dropped so texts never say "$$50.00".)

Example: `Hi {{first_name}} thanks for placing your Christmas order with Griffith Butchery. You can view your order here {{portal_link}}`

## SMS usage

Shows billable SMS segments (sign-in codes, broadcasts, order texts). Long messages use more than one segment.

## SMS broadcast and open-cart reminders

- **SMS broadcast to CRM** — text every customer with a phone on file (who opted in).
- **Remind open carts (manual)** — one text to shoppers who left items in a cart (most recent cart per phone).

## AI templates

Generate draft wording with AI. Drafts must be saved by staff before anything is sent.

## Sign-in codes

Customers sign in with a 6-digit SMS code. To save credits, a new code can only be sent once every **60 seconds** per phone number.

## FAQ

**A customer didn't get their text.** Check the phone number on the order. Then use **Send order** on the order screen to resend their link.
