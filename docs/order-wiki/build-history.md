---
title: Build history — October 2026
section: Build history
order: 10
summary: Every change to the ordering system in October 2026, newest first — stock, payments, the docket, Stripe Connect, specials and more.
---

# Build history — October 2026

A dated record of what changed in the ordering system and why, newest first. Numbers like **#873** are the release (pull request) numbers, so support can look up the exact change.

Earlier months are in **Build history — August & September 2026**.

## 29 October 2026

- **Same product, different options (staff New Order).** After pressing **Add**, a product row shows **+ Another**. That keeps the line in the order and gives a fresh row for the next one — e.g. two whole chickens, one Apricot and one Italian stuffing, both boned and rolled. Each line shows in the cart and can be removed on its own (#878). *Why: staff couldn't add a second chicken with a different stuffing — the row just said "Added".* The customer shop already allowed this.
- **Options shown once.** The staff order screen listed every option twice (e.g. "porchetta seasoning · seasoned: porchetta seasoning"). Now one line per item: *Seasoned: porchetta seasoning* (#879). A choice named like its question (e.g. *Boned and Rolled*) shows once everywhere.
- **Customer copy.** **Print customer copy** on every order (Send & print) prints the customer's own order page to hand over the counter — on A4 or an 80mm receipt printer. Shows pickup, items with options, $/kg, prices, what's been paid, the total or balance, and a QR code to open the order online.
- **Kg prices only setting.** Settings → Tax & Payments → **Weighed item prices**. Choose *Kg price only* and items sold by the kg show just their $/kg (e.g. $19.70/kg · priced when weighed) instead of an estimate, in the shop, on the customer's order page, on prints and on staff screens. Display only: deposits and totals don't change.
- **Catalogue.** Stuffing (Apricot / Traditional / Italian) added to chicken breast and thigh fillets, turkey buffs and turkey fillets. *HAM - Whole 10* glaze renamed from "Gazing" to **Glazing** and charged +$9.75 like the other hams.

## 28 October 2026

### Evening releases

- **Cooking rate.** A shop-wide **Cooking rate** ($9.50/kg, GST included) in Settings → Tax & Payments. Tick **Charge cooking rate** on any product option (e.g. *Cooked*) and that choice is charged per kg. Before weighing, customers and staff see a range (a 3–4 kg ham: cooking $28.50–$38.00); once weighed it's exact (3.6 kg = $34.20). Items with a size in their name (e.g. *Half 3.5-4*) now show a full price range until weighed.
- **Fix: option charges kept when weighing.** Weighing a line used to drop flat option charges (e.g. +$9.75 glaze). They now stay on the final price.
- **Order Operations menu icon** restored (#876).
- **Dark themes:** the new order screen, Payments ledger, Stock and wiki are readable in every staff theme (#875).

### Payments, order screen and wiki (#874)

- **Payments ledger.** Payments rebuilt as a ledger: Date, Customer, Order, Amount, Method, Status. Click any heading to sort, search box, date range (Today, This week, This month, Last month, This financial year or any dates), totals per method, **Over the counter** (Cash + EFTPOS) vs **Remote** (Stripe + Direct deposit), Contra shown separately, and CSV export for the period. *Why: the accounts person couldn't reconcile the ~$2,500 recorded with the Stripe account — most deposits were EFTPOS, cash or direct deposit, not Stripe.*
- **Record payment upgraded.** Enter the real amount (not just the $50 default), the date received, and for direct deposits the payer name as it appears on the bank statement and the bank reference — so payments can be traced if there's a dispute. Manual payments can be corrected or voided, and every change is logged.
- **Send order button.** Text and/or email the customer a link to their order docket at any time, so phone customers (especially older customers) get a printable copy showing their deposit is paid.
- **Pickup "Other date…".** Staff can pick any date as well as the normal pickup days, in New Order and on the order screen. Changing a pickup date recalculates when the order locks, and the calendar and production lists pick it up.
- **Order screen redesign.** The narrow order pop-up becomes a full-width page: the customer's docket on the left (items editable in place), and sidebar cards on the right for status, customer, pickup, payments, send & print, importance, staff notes and history. No buttons removed — just reorganised.
- **New add-product picker** on the order screen, matching New Order (categories, search, steppers, options, stock pieces).
- **Help & Wiki** under Settings — this wiki.
- **Data fix:** ORD-2026-00012 corrected to a $150 direct deposit received 14 October, with pickup Monday 7 December 2026 (lock Friday 4 December, 5pm).

### Released

- **Stock pieces (#873).** New **Stock** screen: receive hams and turkeys with their real weights, give each piece to an order (sets the exact weight and final price), Suggest matches, release, edit, write off. Switched on per category. The shop, New Order and Make changes offer only the actual pieces left, each with its exact price; sizes go on sale only once every pre-order has its piece; checkout locks the piece so two customers can never buy the same bird; cancelling puts pieces back.
- **Full product names in the order summary (#872).** The slim shop was shortening "TURKEY – Whole 4–4.8 kg" to "Whole 4–4.8 kg" in the cart, search and Specials. Short names now only appear under their own category heading.

## 22 October 2026

- **Slim shop everywhere; SMS sign-in saves credits (#871).** Old `/order-shop` links forward to the designed shop page. After "Send code" only **Verify** shows, 6 digits sign in automatically, and **Resend** is locked for 60 seconds (also enforced by the server).
- **Sign-in and Order again land on the designed shop page (#870)**, keeping the cart and category.
- **My orders: View order on every order (#869)**, opening the docket, with readable dates.
- **Send code button visible on portrait phones (#868).**
- **Order page tab shows the shop's name, not LeadPages (#867).**
- **Order links on the shop's own domain (#866).** Texts, emails, deposit links, QR codes and Stripe returns use e.g. www.griffithbutchery.com.au once the domain is live.
- **Paper-docket layout (#865).** The customer order page now looks like the paper order docket (logo, pick-up date, surname/first name, $/kg table, total payable). Quantity-only per-kg items (e.g. half hams by count) are priced when weighed instead of assuming 1 kg — existing lines were repaired. Staff screens split names into First / Last.
- **Order page as an invoice (#864).** Orders open as a clean invoice; **Make changes** is a quiet button at the bottom, only before the lock. Checkout asks for first and last name. Messages never print "$$".

## 20 October 2026

- **Deposits go to the shop's own Stripe account (#863).** Connect Stripe button (Standard account), online deposits refused until the shop's account can take charges, payments recorded reliably from Stripe (webhook, page return and a 10-minute check), and duplicate charges flagged. *Why: early deposits had been charged on the platform account and not recorded on orders.*

## 17–18 October 2026

- **Specials (#862).** Set price or % off per product, ongoing / until a date / scheduled, Specials tab and Special badge in the shop; price locked in when ordered.
- **Back office stays signed in (#861).** Fixed "auth" errors when opening products — the app now uses the renewed sign-in on every request.
- **Readable order dialogs (#858)** — solid, not see-through.
- **Shop loads faster; category links reach the shop page (#851).**
- **Storefront info tabs (#849)** — extra tabs (e.g. store hours, Christmas brochure) beside Browse menu / My orders, with items that link to products.
- **Moved to the Sydney database (#857)**; **emails sent only from leadpages.com.au (#859)**; **public pages on leadpages.com.au (#860).**

## 12–14 October 2026

- **Trust bar can open a shop category in place (#828).**
- **Editorial (slim) order shop and order page banner (#820).**
- **Built-in /order page for sites with the Order app (#819)** with an "Order shop" menu link.
- **Header order button never covers the logo (#837).**
