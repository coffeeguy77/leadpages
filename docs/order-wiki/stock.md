---
title: Stock (hams, turkeys and other pieces)
section: Order operations
order: 40
summary: Receive hams, turkeys and other one-off pieces with their real weight, give each to an order, and sell only what's left.
---

# Stock

The Stock screen is for items you receive one at a time with their own weight — whole hams, half hams, whole turkeys. You record each piece as it arrives, give each piece to an order, and the shop then only sells what's genuinely left.

Find it under **Order Operations → Stock**.

## The big idea

1. **Receive** — type in the weights as the delivery comes off the truck.
2. **Give** — each waiting order gets a real piece. Giving a piece *is* weighing: the order line gets the exact weight and final price.
3. **Sell what's left** — once every existing order for a size has its piece, the spare pieces go on sale in the shop, each shown with its exact weight and price.

## Switching stock control on (per category)

At the top of the Stock screen choose a category (for example *Turkey*) and press **Switch on**.

- **Off:** ordering for that category works as normal (customers choose a size and an approximate weight). You can still receive stock and give pieces to orders while it's off.
- **On:** the shop and New Order only offer the pieces you've received. Sizes with nothing to sell show **Sold out**.

> **It's the whole category.** Switching on *Turkey* covers every product in the Turkey category — rolls, fillets, buffs and Marylands as well as whole birds. If only some products should be limited (for example whole birds), put them in their own category first, such as **Whole Turkeys**, and switch that one on.

**Tip:** receive the delivery first, give pieces to the waiting orders, *then* switch on. That way the shop never shows sold out while you're unpacking.

## Receiving stock

1. Open the product (for example *TURKEY – Whole 5–5.8 kg*).
2. In **Receive stock**, type the weights separated by commas, spaces or new lines: `5.10, 5.44, 5.72` (you can add "kg" — it's ignored).
3. Optional: **First tag #** — type a starting number (for example 20) and the pieces are tagged 20, 21, 22… Write the tag on the bag so you can find the piece later.
4. Press **Add to stock**.

If you mistype (for example "five"), nothing is saved and you're told which value was wrong.

## Orders waiting

Under each product you'll see **Orders waiting**: open orders for that size that don't have their piece yet, earliest pickup first. Each shows the order, customer, pickup day and how many pieces it needs (an order for 2 hams needs 2 pieces).

### Give a piece to one order

1. Choose a piece from the dropdown on the order's row.
2. Press **Give**.

The order line now shows the exact weight and final price (weight × the line's $/kg, plus any paid options like glaze).

You can choose a piece from a different size in the same category — you'll be asked to confirm, and the order keeps its own $/kg.

### Suggest matches (do them all at once)

1. Press **Suggest matches**.
2. The system pairs every waiting order with the closest-weight piece in its size — earliest pickup first. For a "4–4.8 kg" size it aims for about 4.4 kg; if the customer asked for a weight, it aims for that.
3. Untick any pairs you don't want.
4. Press **Give selected pieces**. Nothing is saved until you press this.

## Fixing mistakes

| Problem | What to do |
|---|---|
| Wrong weight typed | **Edit** on the piece and type the right weight. If it's already given to an order, that order's price updates. |
| Piece damaged or entered twice | **Write off** (only for pieces in stock — release it first if it's given to an order). **Undo** puts it back. |
| Gave the wrong piece | **Release** on the "Given to orders" row puts it back in stock and returns the order line to its estimate. |

## The rules that protect your customers

- **Protect pre-orders.** A size only goes on sale in the shop once *every* existing open order for it has its piece. Until then it shows Sold out to customers. This stops new customers buying the hams your pre-order customers are waiting for.
- **One piece per line.** Customers and staff pick an actual piece. Want two? Pick two.
- **Pieces are locked when the order is placed**, not while they sit in a cart. If two customers go for the same bird, the first to check out gets it; the second is told it's just gone and nothing is charged.
- **Cancelling puts it back.** Voiding/cancelling an order, removing a line, or a customer removing it in Make changes returns the piece to stock.

## Counts at the top

**Received · Given to orders · In stock · Orders waiting** for the category, and for each product: received, given, in stock, waiting, and what the shop shows (*Shop: 3 for sale*, *Shop: held for 2 waiting*, *Shop: sold out*, or *Shop not limited* when switched off).

## Good to know

- **Order again** (customers re-ordering last year's order) skips stock-controlled items and asks the customer to choose them from what's in stock.
- Lines added from an order's detail screen without a piece, and imported orders, show as **waiting** — give them a piece here. Waiting lines hold back that size in the shop.
- A **restored** (un-voided) order does not get its old piece back automatically — give it one again.
- Customers see each piece as, for example, **5.44 kg · $117.23**. The price is exact, so it isn't marked "estimated".
- Stock control uses each product's main category.

## FAQ

**Why does the shop say Sold out when I have hams in stock?** Some pre-orders for that size are still waiting for their piece. Give them their pieces (Suggest matches is quickest) and the spare ones go on sale.

**A customer wants to swap their ham.** In the order, Release the piece and give them another — or the customer can remove it and add a different one in Make changes before their lock time.

**Is this the same as Product Allocation?** No. Product Allocation is the packing checklist. Stock is about real received pieces.
