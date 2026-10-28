---
title: Import
section: Settings
order: 80
summary: Upload a CSV of past orders, customers or products and map the columns.
---

# Import

## How to

1. **Import type:** Order history, Customers or Products.
2. **Preset:** *Butchery line items (no header)* for past Griffith-style exports, or *Custom mapping*.
3. Choose the **CSV file**.
4. **Preview mapping** — check every column lands in the right field.
5. **Commit import.**

## Good to know

- Rows with the same order number become one order with several lines.
- Re-importing the same file **skips** orders that already exist — no duplicates.
- Rows with a blank order number can't be checked for duplicates and create new orders.
- Imported history is **Archived** — it powers **Order again** but stays out of the live queue.
- Imported lines for stock-controlled items (hams, turkeys) show as **waiting** on the Stock screen.

## FAQ

**The import timed out.** Split the file into smaller parts and import each.
