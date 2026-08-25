'use strict';

/**
 * Pickup-day exception classification — important, notes, unpaid, price/weight TBC.
 */

var IMPORTANT_TYPES = [
  { id: 'staff_attention', label: 'Staff attention' },
  { id: 'vip', label: 'VIP' },
  { id: 'allergy', label: 'Allergy / dietary' },
  { id: 'special_request', label: 'Special request' },
  { id: 'fragile', label: 'Fragile / handle with care' },
  { id: 'other', label: 'Other' }
];

var IMPORTANT_COLOURS = [
  { id: 'amber', label: 'Amber', hex: '#c47a00' },
  { id: 'red', label: 'Red', hex: '#b42318' },
  { id: 'blue', label: 'Blue', hex: '#175cd3' },
  { id: 'green', label: 'Green', hex: '#1f5c3a' },
  { id: 'purple', label: 'Purple', hex: '#6941c6' }
];

function importantMeta(order) {
  return order && order.important_meta && typeof order.important_meta === 'object'
    ? order.important_meta
    : {};
}

function importantTypeLabel(order) {
  var meta = importantMeta(order);
  var id = meta.type || 'staff_attention';
  var hit = IMPORTANT_TYPES.filter(function (t) {
    return t.id === id;
  })[0];
  return hit ? hit.label : id;
}

function importantColourHex(order) {
  var meta = importantMeta(order);
  var id = meta.colour || 'amber';
  if (/^#[0-9a-fA-F]{6}$/.test(String(meta.colour || ''))) return meta.colour;
  var hit = IMPORTANT_COLOURS.filter(function (c) {
    return c.id === id;
  })[0];
  return hit ? hit.hex : '#c47a00';
}

function orderNeedsWeight(order) {
  return (order.items || []).some(function (it) {
    if (!it) return false;
    var method = it.pricing_method || (it.product_snapshot && it.product_snapshot.pricing_method);
    var pending =
      it.price_status === 'tbc' ||
      it.price_status === 'pending_weight' ||
      it.price_status === 'quote_required' ||
      method === 'per_weight' ||
      method === 'price_tbc';
    if (!pending) return false;
    return it.actual_weight_kg == null && it.price_status !== 'finalised' && it.price_status !== 'final';
  });
}

function orderUnpaid(order) {
  var depReq = Number(order.deposit_required_cents) || 0;
  var depPaid = Number(order.deposit_paid_cents) || 0;
  if (depReq > 0 && depPaid < depReq) return true;
  if (order.status === 'awaiting_deposit') return true;
  return false;
}

function orderPriceTbc(order) {
  if (order.has_unknown_prices) return true;
  return (order.items || []).some(function (it) {
    return (
      it &&
      (it.price_status === 'tbc' ||
        it.price_status === 'quote_required' ||
        it.pricing_method === 'price_tbc')
    );
  });
}

/**
 * @returns {{ flags: string[], reasons: string[] }}
 */
function classifyOrderExceptions(order) {
  var flags = [];
  var reasons = [];
  if (!order || order.status === 'cancelled' || order.status === 'refunded') {
    return { flags: flags, reasons: reasons };
  }
  if (order.is_important) {
    flags.push('important');
    reasons.push(importantTypeLabel(order) + (importantMeta(order).reason ? ': ' + importantMeta(order).reason : ''));
  }
  if (order.customer_notes) {
    flags.push('notes');
    reasons.push('Customer notes');
  }
  if (orderUnpaid(order)) {
    flags.push('unpaid');
    reasons.push('Unpaid deposit');
  }
  if (orderPriceTbc(order)) {
    flags.push('price_tbc');
    reasons.push('Price TBC');
  }
  if (orderNeedsWeight(order)) {
    flags.push('weight_tbc');
    reasons.push('Weight / finalise pending');
  }
  return { flags: flags, reasons: reasons };
}

function orderIsException(order) {
  return classifyOrderExceptions(order).flags.length > 0;
}

function filterExceptionOrders(orders, filter) {
  filter = filter || 'all';
  return (orders || []).filter(function (o) {
    if (o.status === 'cancelled' || o.status === 'refunded') return false;
    if (filter === 'all') return true;
    if (filter === 'exceptions') return orderIsException(o);
    var c = classifyOrderExceptions(o);
    return c.flags.indexOf(filter) >= 0;
  });
}

module.exports = {
  IMPORTANT_TYPES,
  IMPORTANT_COLOURS,
  importantMeta,
  importantTypeLabel,
  importantColourHex,
  orderNeedsWeight,
  orderUnpaid,
  orderPriceTbc,
  classifyOrderExceptions,
  orderIsException,
  filterExceptionOrders
};
