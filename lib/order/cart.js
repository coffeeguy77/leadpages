'use strict';

const { getAdmin } = require('./supabase');
const { priceLineAtOrder, computeOrderTotals } = require('./pricing');
const { earliestPickupDate } = require('./cutoff');
const { createStaffOrder } = require('./service');
const {
  resolveRequestedWeightKg,
  optionExtrasPerUnitCents,
  isPackSize,
  packLabel
} = require('./product-options');

async function loadProductQuestions(productId) {
  const admin = getAdmin();
  const { data } = await admin
    .from('order_product_questions')
    .select('*')
    .eq('product_id', productId)
    .order('sort_order');
  return (data || []).filter(function (q) {
    return !q.staff_only;
  });
}

function priceWithOptions(product, qty, weight, answers, questions) {
  const extras = optionExtrasPerUnitCents(questions || [], answers || {});
  const priced = priceLineAtOrder(product, qty, weight, extras.extra_cents);
  return { priced: priced, extras: extras };
}

function recalcCartTotals(items) {
  const totals = computeOrderTotals(
    (items || []).map(function (it) {
      return {
        price_status: it.price_status,
        line_known_cents: it.line_known_cents,
        line_final_cents: null
      };
    })
  );
  var qtySum = 0;
  (items || []).forEach(function (it) {
    qtySum += Number(it.quantity) || 0;
  });
  return {
    known_subtotal_cents: totals.known_subtotal_cents,
    has_unknown_prices: totals.has_unknown_prices,
    item_count: qtySum || (items || []).length,
    estimated_subtotal_cents: totals.estimated_subtotal_cents
  };
}

async function getCart(cartId) {
  const admin = getAdmin();
  const { data: cart, error } = await admin.from('order_carts').select('*').eq('id', cartId).maybeSingle();
  if (error) throw error;
  if (!cart) return null;
  const { data: items } = await admin
    .from('order_cart_items')
    .select('*')
    .eq('cart_id', cartId)
    .order('sort_order');
  return { cart: cart, items: items || [] };
}

async function touchCart(cartId, patch) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('order_carts')
    .update(
      Object.assign(
        {
          last_activity_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        patch || {}
      )
    )
    .eq('id', cartId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

async function createCart(system, siteId, guest) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('order_carts')
    .insert({
      order_system_id: system.id,
      site_id: siteId,
      guest_name: (guest && guest.name) || null,
      guest_phone: (guest && guest.phone) || null,
      guest_email: (guest && guest.email) || null,
      status: 'active',
      last_activity_at: new Date().toISOString()
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

function answersKey(answers) {
  try {
    return JSON.stringify(answers || {});
  } catch (_e) {
    return '{}';
  }
}

function sameWeight(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(Number(a) - Number(b)) < 0.0001;
}

async function addOrUpdateItem(cart, product, opts) {
  const admin = getAdmin();
  const qtyIn = opts.quantity != null ? Number(opts.quantity) : 1;
  const qtyAdd = Number.isFinite(qtyIn) && qtyIn > 0 ? qtyIn : 1;
  const answers = opts.answers || {};
  const notes = opts.notes || null;
  const questions = opts.questions || (await loadProductQuestions(product.id));
  const weight = resolveRequestedWeightKg(
    product,
    qtyAdd,
    opts.requested_weight_kg != null ? Number(opts.requested_weight_kg) : null
  );
  const snapshot = {
    id: product.id,
    name: product.name,
    sku: product.sku,
    pricing_method: product.pricing_method,
    price_cents: product.price_cents,
    price_per_kg_cents: product.price_per_kg_cents,
    image_url: product.image_url || null,
    unit_label: product.unit_label,
    cutoff_mode: product.cutoff_mode,
    lead_time_mode: product.lead_time_mode,
    lead_time_value: product.lead_time_value,
    weight_required: product.weight_required,
    options: product.options || {},
    pack_label: packLabel(product) || null,
    is_pack_size: isPackSize(product)
  };

  if (opts.cart_item_id) {
    const { priced, extras } = priceWithOptions(product, qtyAdd, weight, answers, questions);
    const { data, error } = await admin
      .from('order_cart_items')
      .update({
        quantity: qtyAdd,
        requested_weight_kg: weight,
        unit_price_cents: priced.unitPriceCents,
        line_known_cents: priced.lineKnownCents,
        price_status: priced.priceStatus,
        answers: answers,
        notes: notes,
        product_snapshot: Object.assign({}, snapshot, { selected_options: extras.selected }),
        updated_at: new Date().toISOString()
      })
      .eq('id', opts.cart_item_id)
      .eq('cart_id', cart.id)
      .select('*')
      .single();
    if (error) throw error;
    await syncCartTotals(cart.id);
    return data;
  }

  // Merge with an existing line for the same product + weight + notes + answers
  // so repeated "Add" taps bump qty instead of creating duplicate rows.
  const packed = await getCart(cart.id);
  const existing = (packed && packed.items ? packed.items : []).find(function (it) {
    if (it.product_id !== product.id) return false;
    if (String(it.notes || '') !== String(notes || '')) return false;
    if (answersKey(it.answers) !== answersKey(answers)) return false;
    if (isPackSize(product)) return true;
    return sameWeight(it.requested_weight_kg, weight);
  });

  if (existing) {
    const newQty = Number(existing.quantity || 0) + qtyAdd;
    const newWeight = resolveRequestedWeightKg(product, newQty, weight);
    const { priced, extras } = priceWithOptions(product, newQty, newWeight, answers, questions);
    const { data, error } = await admin
      .from('order_cart_items')
      .update({
        quantity: newQty,
        requested_weight_kg: newWeight,
        unit_price_cents: priced.unitPriceCents,
        line_known_cents: priced.lineKnownCents,
        price_status: priced.priceStatus,
        answers: answers,
        notes: notes,
        product_snapshot: Object.assign({}, snapshot, { selected_options: extras.selected }),
        updated_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .eq('cart_id', cart.id)
      .select('*')
      .single();
    if (error) throw error;
    await syncCartTotals(cart.id);
    return data;
  }

  const { priced, extras } = priceWithOptions(product, qtyAdd, weight, answers, questions);
  const { data, error } = await admin
    .from('order_cart_items')
    .insert({
      cart_id: cart.id,
      site_id: cart.site_id,
      product_id: product.id,
      product_snapshot: Object.assign({}, snapshot, { selected_options: extras.selected }),
      quantity: qtyAdd,
      requested_weight_kg: weight,
      unit_price_cents: priced.unitPriceCents,
      line_known_cents: priced.lineKnownCents,
      price_status: priced.priceStatus,
      answers: answers,
      notes: notes,
      sort_order: opts.sort_order || 0
    })
    .select('*')
    .single();
  if (error) throw error;
  await syncCartTotals(cart.id);
  return data;
}

async function removeItem(cartId, itemId) {
  const admin = getAdmin();
  await admin.from('order_cart_items').delete().eq('id', itemId).eq('cart_id', cartId);
  await syncCartTotals(cartId);
}

/**
 * Fast path for "Order again": insert many lines into an empty/new cart
 * with one product batch fetch upstream + one insert + one totals sync.
 * Skips per-line getCart/merge/question loads (reorder has no option answers).
 */
async function addReorderLines(cart, lines) {
  const admin = getAdmin();
  const rows = [];
  for (var i = 0; i < (lines || []).length; i++) {
    var line = lines[i];
    var product = line.product;
    if (!product) continue;
    var qtyIn = line.quantity != null ? Number(line.quantity) : 1;
    var qty = Number.isFinite(qtyIn) && qtyIn > 0 ? qtyIn : 1;
    var weight = resolveRequestedWeightKg(
      product,
      qty,
      line.requested_weight_kg != null ? Number(line.requested_weight_kg) : null
    );
    var { priced, extras } = priceWithOptions(product, qty, weight, {}, []);
    var snapshot = {
      id: product.id,
      name: product.name,
      sku: product.sku,
      pricing_method: product.pricing_method,
      price_cents: product.price_cents,
      price_per_kg_cents: product.price_per_kg_cents,
      image_url: product.image_url || null,
      unit_label: product.unit_label,
      cutoff_mode: product.cutoff_mode,
      lead_time_mode: product.lead_time_mode,
      lead_time_value: product.lead_time_value,
      weight_required: product.weight_required,
      options: product.options || {},
      pack_label: packLabel(product) || null,
      is_pack_size: isPackSize(product),
      selected_options: extras.selected || [],
      reordered: true
    };
    rows.push({
      cart_id: cart.id,
      site_id: cart.site_id,
      product_id: product.id,
      product_snapshot: snapshot,
      quantity: qty,
      requested_weight_kg: weight,
      unit_price_cents: priced.unitPriceCents,
      line_known_cents: priced.lineKnownCents,
      price_status: priced.priceStatus,
      answers: {},
      notes: line.notes || null,
      sort_order: line.sort_order != null ? line.sort_order : i
    });
  }
  if (!rows.length) return getCart(cart.id);
  const { error } = await admin.from('order_cart_items').insert(rows);
  if (error) throw error;
  await syncCartTotals(cart.id);
  return getCart(cart.id);
}

async function syncCartTotals(cartId) {
  const packed = await getCart(cartId);
  if (!packed) return null;
  const totals = recalcCartTotals(packed.items);
  return touchCart(cartId, {
    known_subtotal_cents: totals.known_subtotal_cents,
    has_unknown_prices: totals.has_unknown_prices,
    item_count: totals.item_count,
    status: packed.cart.status === 'abandoned' ? 'active' : packed.cart.status
  });
}

async function convertCartToOrder(opts) {
  const packed = await getCart(opts.cartId);
  if (!packed || !packed.cart) throw Object.assign(new Error('cart_not_found'), { code: 404 });
  const cart = packed.cart;
  if (cart.status === 'converted') throw Object.assign(new Error('cart_already_converted'), { code: 400 });
  if (!packed.items.length) throw Object.assign(new Error('cart_empty'), { code: 400 });

  const body = {
    customer_name: opts.customer_name || cart.guest_name,
    customer_phone: opts.customer_phone || cart.guest_phone,
    customer_email: opts.customer_email || cart.guest_email,
    fulfilment_type: opts.fulfilment_type || 'pickup',
    pickup_date: opts.pickup_date,
    pickup_time: opts.pickup_time,
    pickup_window_start: opts.pickup_window_start,
    pickup_window_end: opts.pickup_window_end,
    pickup_location: opts.pickup_location,
    delivery_address: opts.delivery_address,
    customer_notes: opts.customer_notes,
    source: 'online',
    items: packed.items.map(function (it) {
      return {
        product_id: it.product_id,
        product_name: (it.product_snapshot && it.product_snapshot.name) || 'Item',
        quantity: it.quantity,
        requested_weight_kg: it.requested_weight_kg,
        notes: it.notes,
        answers: it.answers
      };
    })
  };

  const created = await createStaffOrder({
    system: opts.system,
    site: opts.site,
    actor: opts.actor || { label: 'online' },
    body: body
  });

  const admin = getAdmin();
  await admin
    .from('order_carts')
    .update({
      status: 'converted',
      converted_order_id: created.order.id,
      guest_name: body.customer_name,
      guest_phone: body.customer_phone,
      guest_email: body.customer_email,
      updated_at: new Date().toISOString()
    })
    .eq('id', cart.id);

  await admin
    .from('order_orders')
    .update({ cart_id: cart.id, updated_at: new Date().toISOString() })
    .eq('id', created.order.id);

  return Object.assign({}, created, { cart_id: cart.id });
}

function earliestPickupForCart(system, items) {
  const products = (items || []).map(function (it) {
    return it.product_snapshot || {};
  });
  return earliestPickupDate(system.timezone || 'Australia/Sydney', products);
}

module.exports = {
  getCart,
  createCart,
  addOrUpdateItem,
  addReorderLines,
  removeItem,
  syncCartTotals,
  touchCart,
  convertCartToOrder,
  earliestPickupForCart,
  recalcCartTotals
};
