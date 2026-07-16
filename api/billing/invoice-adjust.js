// GET/POST /api/billing/invoice-adjust — list/create/update local invoice adjustments.
const { sb, requireSuper, readBody, json } = require('./_admin-auth');

function clean(s, n) {
  return String(s == null ? '' : s).trim().slice(0, n || 400);
}

module.exports = async function(req, res) {
  const user = await requireSuper(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const siteId = clean((req.query && req.query.site_id) || '', 40);
    const invId = clean((req.query && req.query.stripe_invoice_id) || '', 80);
    let q = sb.from('billing_invoice_adjustments').select('*').order('created_at', { ascending: false }).limit(200);
    if (siteId) q = q.eq('site_id', siteId);
    if (invId) q = q.eq('stripe_invoice_id', invId);
    const r = await q;
    if (r.error) {
      return json(res, 200, {
        ok: true,
        adjustments: [],
        warning: 'Run db/billing_accounting.sql to enable invoice adjustments.'
      });
    }
    return json(res, 200, { ok: true, adjustments: r.data || [] });
  }

  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'GET or POST only' });
  const b = await readBody(req);
  const action = clean(b.action || 'upsert', 20);

  if (action === 'void' && b.id) {
    const up = await sb.from('billing_invoice_adjustments')
      .update({ status: 'void', updated_at: new Date().toISOString() })
      .eq('id', b.id)
      .select('*')
      .single();
    if (up.error) return json(res, 500, { ok: false, error: up.error.message });
    return json(res, 200, { ok: true, adjustment: up.data });
  }

  const stripeInvoiceId = clean(b.stripe_invoice_id || b.stripeInvoiceId, 80) || null;
  const siteId = clean(b.site_id || b.siteId, 40) || null;
  const coupon = clean(b.coupon_code || b.couponCode, 60) || null;
  const discount = Math.max(0, Math.round(Number(b.discount_cents != null ? b.discount_cents : b.discountCents) || 0));
  const original = b.original_amount_cents != null ? Math.round(Number(b.original_amount_cents)) : (b.originalAmountCents != null ? Math.round(Number(b.originalAmountCents)) : null);
  let adjusted = b.adjusted_amount_cents != null ? Math.round(Number(b.adjusted_amount_cents)) : (b.adjustedAmountCents != null ? Math.round(Number(b.adjustedAmountCents)) : null);
  if (adjusted == null && original != null) adjusted = Math.max(0, original - discount);
  const reason = clean(b.reason, 200) || (coupon ? ('Coupon ' + coupon) : 'Manual adjustment');
  const notes = clean(b.notes, 800) || null;
  const status = ['draft', 'applied', 'void'].indexOf(b.status) >= 0 ? b.status : 'applied';

  if (!stripeInvoiceId && !siteId) {
    return json(res, 400, { ok: false, error: 'Provide a Stripe invoice id and/or site id.' });
  }
  if (adjusted == null && discount <= 0) {
    return json(res, 400, { ok: false, error: 'Provide a discount or adjusted amount.' });
  }

  const now = new Date().toISOString();
  const row = {
    stripe_invoice_id: stripeInvoiceId,
    site_id: siteId,
    owner_user_id: clean(b.owner_user_id || '', 40) || null,
    coupon_code: coupon,
    discount_cents: discount,
    original_amount_cents: original,
    adjusted_amount_cents: adjusted,
    reason: reason,
    status: status,
    notes: notes,
    created_by: user.id,
    updated_at: now
  };

  if (b.id) {
    const up = await sb.from('billing_invoice_adjustments').update(row).eq('id', b.id).select('*').single();
    if (up.error) return json(res, 500, { ok: false, error: up.error.message });
    return json(res, 200, { ok: true, adjustment: up.data });
  }

  row.created_at = now;
  const ins = await sb.from('billing_invoice_adjustments').insert(row).select('*').single();
  if (ins.error) {
    return json(res, 500, {
      ok: false,
      error: ins.error.message || 'Could not save adjustment. Run db/billing_accounting.sql first.'
    });
  }
  return json(res, 200, { ok: true, adjustment: ins.data });
};
