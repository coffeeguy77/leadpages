'use strict';

/**
 * Normalize existing order_customers (+ optional cart guest names) to
 * "Given Surname" title case. Safe to re-run.
 */

const { getAdmin } = require('./supabase');
const { displayFullName } = require('./customer-name');

async function backfillCustomerNames(opts) {
  opts = opts || {};
  const admin = getAdmin();
  const siteId = opts.site_id || null;
  const systemId = opts.order_system_id || null;
  const limit = Math.min(5000, Math.max(1, parseInt(opts.limit, 10) || 2000));

  var query = admin.from('order_customers').select('id, name, site_id, order_system_id').limit(limit);
  if (siteId) query = query.eq('site_id', siteId);
  if (systemId) query = query.eq('order_system_id', systemId);

  var { data: customers, error } = await query;
  if (error) throw error;

  var updated = 0;
  var skipped = 0;
  var errors = [];

  for (var i = 0; i < (customers || []).length; i++) {
    var c = customers[i];
    var next = displayFullName(c.name);
    if (!next || next === c.name) {
      skipped += 1;
      continue;
    }
    var { error: uErr } = await admin
      .from('order_customers')
      .update({ name: next, updated_at: new Date().toISOString() })
      .eq('id', c.id);
    if (uErr) {
      errors.push({ id: c.id, error: String(uErr.message || uErr) });
      if (errors.length > 40) break;
    } else {
      updated += 1;
    }
  }

  // Active / abandoned carts: fix guest_name shown at checkout
  var cartQ = admin
    .from('order_carts')
    .select('id, guest_name')
    .in('status', ['active', 'abandoned'])
    .not('guest_name', 'is', null)
    .limit(limit);
  if (siteId) cartQ = cartQ.eq('site_id', siteId);
  if (systemId) cartQ = cartQ.eq('order_system_id', systemId);
  var { data: carts } = await cartQ;
  var cartsUpdated = 0;
  for (var j = 0; j < (carts || []).length; j++) {
    var cart = carts[j];
    var gNext = displayFullName(cart.guest_name);
    if (!gNext || gNext === cart.guest_name) continue;
    var { error: cErr } = await admin
      .from('order_carts')
      .update({ guest_name: gNext, updated_at: new Date().toISOString() })
      .eq('id', cart.id);
    if (!cErr) cartsUpdated += 1;
  }

  return {
    customers_updated: updated,
    customers_skipped: skipped,
    carts_updated: cartsUpdated,
    errors: errors
  };
}

module.exports = { backfillCustomerNames };
