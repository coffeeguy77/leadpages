'use strict';

/**
 * Special prices history (staff): GET ?site_id=…[&q=text][&customer_id=…][&phone=…][&from=YYYY-MM-DD][&to=YYYY-MM-DD]
 *   → { rows }
 * Every special price set / changed / removed on an order line (order_price_overrides, append-only),
 * newest first. `q` matches customer name, phone, email, order number or product name.
 * Rules: lib/order/price-override.js
 */

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function norm(s) {
  return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function digits(s) {
  return String(s || '').replace(/\D/g, '');
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const q = req.query || {};
    const access = await assertSiteAccess(user, q.site_id);
    if (!access.ok) return json(res, access.code, { error: access.error });

    const { data, error } = await getAdmin()
      .from('order_price_overrides')
      .select('*')
      .eq('site_id', q.site_id)
      .order('created_at', { ascending: false })
      .limit(5000);
    if (error) throw error;

    const text = norm(q.q);
    const phone = digits(q.phone);
    const from = DATE.test(q.from || '') ? q.from : null;
    const to = DATE.test(q.to || '') ? q.to : null;
    const rows = (data || []).filter(function (r) {
      if (q.customer_id || phone) {
        const byId = q.customer_id && r.customer_id === q.customer_id;
        const byPhone = phone && phone.length >= 6 && digits(r.customer_phone) === phone;
        if (!byId && !byPhone) return false;
      }
      const day = String(r.created_at || '').slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!text) return true;
      const blob = norm([r.customer_name, r.customer_phone, r.customer_email, r.order_number, r.product_name, r.reason].join(' '));
      return text.split(' ').every(function (w) { return blob.indexOf(w) >= 0 || (digits(w).length >= 4 && digits(blob).indexOf(digits(w)) >= 0); });
    });
    return json(res, 200, { rows: rows });
  } catch (e) {
    console.error('order/special-prices', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
