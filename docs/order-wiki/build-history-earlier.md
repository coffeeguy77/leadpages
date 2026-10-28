---
title: Build history — August & September 2026
section: Build history
order: 20
summary: How the ordering system was built — from the first release on 19 August 2026 through September.
---

# Build history — August & September 2026

The ordering system was built in August 2026 with the butcher setup first, then refined through September. Newest first; numbers are release (pull request) numbers.

## September 2026

- **15 Sep — Hide and delete unused product categories (#751).**
- **7 Sep — Product search sheet upgrades (#740, #741, #742).** Autocomplete, live sortable results, results from today onwards, and "contains" search so typing *Ham* or *Turkey* finds every match.
- **7 Sep — Shop colours match the website (#737, #738).** Catalogue and cart colours follow the site's theme; live preview and smooth colour dragging fixed (#736).
- **2 Sep — Customers can edit their orders until lockout (#732, #733).** The order page gained editing (later moved behind Make changes), mobile layout improvements, a category filter when adding items (#735) and a fix for duplicate options (#734).
- **2 Sep — Butcher product search sheet (#731).**

## 26 August 2026

- **New Order polish (#710, #711, #712).** Single-line product rows, wrapped categories, visible Add button, Client sidebar cart and QTY labels on unit products.

## 25 August 2026 — Order Operations

- **Phase 1: pickup schedules, Pickup Day View, checkout date + hours, important flags (#693, #694).**
- **Phase 2: Product Allocation packing checklist (#696).**
- **Phase 3: Labels & stickers with QR codes to the customer's order (#697).**
- **Phase 4: daily capacity, timezone-correct locks, cutoff rules merged (#698).**
- **Phase 5: print snapshots and "changes since print" (#699).**
- **Phase 6: exceptions filters, procurement checklist, richer importance (#700, #701).**
- **New Order workspace:** draft cart, three steps down the left, customer card and cart steppers (#704, #705, #706, #708, #709).
- **Product editor** fullscreen/embedded/mobile, polished extra-category tiles (#702, #707).
- **Faster back office:** warm cache, prefetch, **Copy order to new** (#692).
- **Collect email after SMS sign-in when missing (#695).**
- Hotfix: Orders sign-in restored (#703).

## 24 August 2026

- **Shop countdown, cart disclaimer and schedule settings (#688).**
- **Settings reorganised:** Menu Layouts, schedule hours, master lock, store/GST fixes (#687); flat menu routes with settings sections and Payments (#686); accordion sidebar (#684, #685); menu reorganised and SMS usage tracking fixed (#682).
- **Fast Order layout is the default** for staff and customers (#680).
- **Faster add-to-cart** for customers (#690).
- Fixes: edit-order Add product after searching (#689), Chrome loading spinner (#691), archived orders left out of the dashboard (#683), sign-out removed from the cart sidebar (#681), embedded layout (#679).

## 23 August 2026

- **Staff order operations (#663):** edit orders, void, record in-house payments (cash, EFTPOS, direct deposit, contra), storefront-style New Order.
- **Dashboard KPI filters, deposit reminders and lock countdowns (#665).**
- **Staff fast New Order** with qty and weight on one page (#666), option chips and kg defaults (#669), collapsible Notes/Options (#670), customer search and long pickup date lists (#671), sidebar cart (#672, #673, #674).
- **Edit order: add product search and remove lines (#667).**
- **Deposit SMS shows the order before the Stripe checkout (#668).**
- Fixes to the embedded back office theme and payment panel (#664, #675).

## 22 August 2026

- **Printing:** order print/PDF, AirPrint, day run and prep summary (#659); print order numbers (#660).
- **Pickup windows:** date range, closed days, custom hours per date (#658).
- **Abandoned cart SMS:** per-customer cap, two-stage timing, manual open-cart blast (#657, #652).
- **Products:** minimum kg and turkey sizes (#655), additional categories and Pies from titles (#654), quantity prompt (#653), "KG (MIN X KG)" labels and unsized ham clean-up (#656), product delete lock and GST categories (#660).
- **Shop:** name casing, 2/3 layout (#652), faster Order again and status banner (#651).
- **Customer accounts in the shop:** SMS login modal, Browse / My orders, first-name greeting (#649, #650).
- **Order page phone matching and safe CSV re-import** (skip duplicates, multi-line weights) (#648).
- Twilio sender setting (#647).

## 21 August 2026

- **Weight-only vs qty-only shop fields; sign-in codes via Twilio Verify (#646).**
- **Premium steppers, pack sizes and paid product extras (#645).**
- **Fast one-page order layout with expandable notes (#644).**
- **One-page shop with live cart (#639)**; shop cart qty, pickup windows, confirm before Stripe, Connect groundwork (#638).
- **Butcher products matched to meat-type categories (#641).**
- Fixes: storefront UX and SMS sign-in (#643), back office typography and pickup (#642), CSV import timeouts (#640).

## 19–20 August 2026 — the beginning

- **19 Aug — Order Engine Phase 1 (#627).** A universal ordering system for LeadPages sites, with the butcher preset first: products, orders, deposits, cutoffs, customer order page.
- **19 Aug — Order Engine Phase 2 (#628).** Customer storefront and carts, staff order operations, abandoned-cart automation.
- **20 Aug — Orders tab, styled storefront section and dashboard widget (#632).**
- **20 Aug — CSV import, SMS meter and broadcast, phone sign-in history (#633).**
- **20 Aug — Order history imported and archived; type scale and nav counts (#636).**
- **20 Aug — Storefront placed in the website theme with SMS sign-in (#637).**
