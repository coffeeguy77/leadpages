'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { supplyForDate } = require('../../lib/order/service');
const { getAdmin } = require('../../lib/order/supabase');
const { formatAud } = require('../../lib/order/money');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const siteId = req.query && req.query.site_id;
    const pickupDate = req.query && req.query.pickup_date;
    if (!pickupDate) return json(res, 400, { error: 'pickup_date_required' });
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);
    const supply = await supplyForDate(system.id, siteId, pickupDate);

    const admin = getAdmin();
    const { data: orders } = await admin
      .from('order_orders')
      .select('id, known_subtotal_cents, deposit_paid_cents, final_subtotal_cents, status, editing_state')
      .eq('order_system_id', system.id)
      .eq('pickup_date', pickupDate)
      .not('status', 'in', '("draft","cancelled","refunded")');

    let known = 0;
    let deposits = 0;
    (orders || []).forEach(function (o) {
      known += Number(o.final_subtotal_cents != null ? o.final_subtotal_cents : o.known_subtotal_cents) || 0;
      deposits += Number(o.deposit_paid_cents) || 0;
    });

    const { data: dateLock } = await admin
      .from('order_date_locks')
      .select('*')
      .eq('order_system_id', system.id)
      .eq('pickup_date', pickupDate)
      .maybeSingle();

    return json(res, 200, {
      pickup_date: pickupDate,
      order_count: supply.order_count,
      known_value_cents: known,
      known_value_label: formatAud(known),
      deposits_collected_cents: deposits,
      deposits_collected_label: formatAud(deposits),
      editing: dateLock ? 'locked' : 'open',
      date_lock: dateLock || null,
      lines: supply.lines,
      allocations: supply.allocations || [],
      allocation_totals: supply.allocation_totals || { lines: 0, packed: 0, quantity: 0 }
    });
  } catch (e) {
    console.error('order/supply', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
