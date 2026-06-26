// api/billing/portal.js — opens the Stripe Customer Portal so a client can update
// their card, view invoices/receipts, and clear an overdue balance (which reactivates
// their sites via the webhook).  POST { returnUrl? } -> { url }

const { sb, stripe, getUser, isAdminEmail, json } = require('./_stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!process.env.STRIPE_SECRET_KEY) return json(res, 500, { error: 'Payments are not configured yet.' });
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // Self-serve uses the caller's own customer; an admin may pass ?ownerId / body.ownerId.
  let ownerId = user.id;
  if (body.ownerId && isAdminEmail(user.email)) ownerId = body.ownerId;

  const { data: bc } = await sb.from('billing_customers').select('stripe_customer_id').eq('owner_user_id', ownerId).maybeSingle();
  if (!bc || !bc.stripe_customer_id) return json(res, 404, { error: 'no billing account yet' });

  const base = (body.returnUrl || ('https://' + (req.headers.host || 'leadpages.com.au'))).replace(/\/+$/, '');
  try {
    const sess = await stripe('billing_portal/sessions', 'POST', {
      customer: bc.stripe_customer_id,
      return_url: base + '/manage',
    });
    return json(res, 200, { url: sess.url });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
