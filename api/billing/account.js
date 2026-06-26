// api/billing/account.js — reads a client's live billing detail from Stripe so the
// in-app Billing tab can show it natively (current subscription, payment method on file,
// billing information, invoice history) instead of sending them to the Stripe portal.
// Read-only. Card changes still go through Stripe (collecting cards requires Stripe).
//
//   GET                  -> the caller's own billing detail
//   GET ?siteId= / ?ownerId=  -> a client's detail (admins only)

const { sb, stripe, getUser, isAdminEmail, json } = require('./_stripe');

async function resolveOwner(user, admin, siteId, ownerId) {
  if (admin) {
    if (ownerId) return ownerId;
    if (siteId) {
      const { data: st } = await sb.from('sites').select('owner_user_id').eq('id', siteId).maybeSingle();
      return st && st.owner_user_id ? st.owner_user_id : null;
    }
  }
  return user.id;
}

module.exports = async (req, res) => {
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });
  const admin = isAdminEmail(user.email);

  let siteId = null, ownerId = null;
  try { const u = new URL(req.url, 'http://x'); siteId = u.searchParams.get('siteId'); ownerId = u.searchParams.get('ownerId'); } catch (e) {}
  const owner = await resolveOwner(user, admin, siteId, ownerId);
  if (!owner) return json(res, 200, { hasStripe: false });

  const { data: bc } = await sb.from('billing_customers').select('stripe_customer_id,stripe_subscription_id').eq('owner_user_id', owner).maybeSingle();
  if (!bc || !bc.stripe_customer_id) return json(res, 200, { hasStripe: false });

  const out = { hasStripe: true, customer: {}, items: [], invoices: [], payment_method: null, currency: 'aud' };
  try {
    const cust = await stripe('customers/' + bc.stripe_customer_id + '?expand[]=invoice_settings.default_payment_method', 'GET');
    out.customer = { name: cust.name || null, email: cust.email || null };
    let pm = cust.invoice_settings && cust.invoice_settings.default_payment_method;

    if (bc.stripe_subscription_id) {
      let sub = null;
      try { sub = await stripe('subscriptions/' + bc.stripe_subscription_id + '?expand[]=default_payment_method&expand[]=items.data.price.product', 'GET'); } catch (e) { sub = null; }
      if (sub) {
        out.status = sub.status;
        out.current_period_end = sub.current_period_end;
        out.cancel_at_period_end = sub.cancel_at_period_end;
        const data = (sub.items && sub.items.data) || [];
        if (data[0] && data[0].price && data[0].price.currency) out.currency = data[0].price.currency;
        out.items = data.map((it) => {
          const pr = it.price || {};
          const prod = pr.product;
          return { name: (prod && prod.name) || 'Hosting', amount: pr.unit_amount || 0, interval: (pr.recurring && pr.recurring.interval) || 'month', quantity: it.quantity || 1 };
        });
        out.total_monthly = out.items.reduce((n, i) => n + (i.amount * (i.quantity || 1)), 0);
        if (sub.default_payment_method && typeof sub.default_payment_method === 'object') pm = sub.default_payment_method;
      }
    }

    if (pm && typeof pm === 'object' && pm.card) {
      out.payment_method = { brand: pm.card.brand, last4: pm.card.last4, exp_month: pm.card.exp_month, exp_year: pm.card.exp_year };
    }

    const inv = await stripe('invoices?customer=' + bc.stripe_customer_id + '&limit=12', 'GET');
    out.invoices = ((inv && inv.data) || []).map((v) => {
      const lines = (v.lines && v.lines.data) || [];
      let desc = (lines[0] && (lines[0].description || (lines[0].price && lines[0].price.nickname))) || v.description || 'Subscription';
      if (lines.length > 1) desc += ' (+' + (lines.length - 1) + ' more)';
      return {
        date: v.created, amount: v.total, currency: v.currency, status: v.status, paid: !!v.paid,
        description: desc, url: v.hosted_invoice_url || null, pdf: v.invoice_pdf || null, number: v.number || null,
        subtotal: v.subtotal, tax: v.tax || 0, total: v.total,
        lines: lines.map((l) => ({ description: l.description || (l.price && l.price.nickname) || 'Item', amount: l.amount, currency: l.currency || v.currency })),
      };
    });
  } catch (e) { out.error = String(e.message || e); }

  return json(res, 200, out);
};
