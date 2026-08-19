'use strict';

const { json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { formatAud } = require('../../lib/order/money');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const siteId = req.query && req.query.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    await ensureOrderSystem(siteId);
    const admin = getAdmin();

    let q = admin
      .from('order_payments')
      .select('*')
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (req.query.status) q = q.eq('status', req.query.status);
    if (req.query.order_id) q = q.eq('order_id', req.query.order_id);
    const { data, error } = await q;
    if (error) throw error;

    const paid = (data || []).filter(function (p) {
      return p.status === 'paid';
    });
    const totalPaid = paid.reduce(function (s, p) {
      return s + (Number(p.amount_cents) || 0);
    }, 0);

    return json(res, 200, {
      payments: data || [],
      summary: {
        count: (data || []).length,
        paid_count: paid.length,
        paid_total_cents: totalPaid,
        paid_total: formatAud(totalPaid)
      }
    });
  } catch (e) {
    console.error('order/payments', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
