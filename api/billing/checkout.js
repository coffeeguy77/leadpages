// api/billing/checkout.js — start (or extend) a client's hosting subscription.
//   POST { siteId, planKey, returnUrl? }
// Auth: the site's owner (self-serve) OR a SUPER_ADMIN_EMAILS user (admin-initiated;
// returns a payment link to send the customer).
//
// First site for a customer  -> Stripe Checkout Session (customer enters card)  -> { url }
// Customer already subscribed -> add a subscription item + one-off setup invoice item
//                                using the saved card                            -> { mode:'added' }

const { sb, stripe, getUser, isAdminEmail, json } = require('./_stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!process.env.STRIPE_SECRET_KEY) return json(res, 500, { error: 'Payments are not configured yet.' });
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const siteId = body.siteId, planKey = body.planKey;
  if (!siteId || !planKey) return json(res, 400, { error: 'siteId and planKey are required' });

  const { data: site } = await sb.from('sites').select('id,slug,business_name,owner_user_id,owner_email,plan_key,stripe_item_id,billing_status').eq('id', siteId).maybeSingle();
  if (!site) return json(res, 404, { error: 'site not found' });

  const admin = isAdminEmail(user.email);
  if (!admin && site.owner_user_id && site.owner_user_id !== user.id) return json(res, 403, { error: 'not your site' });

  const ownerId = site.owner_user_id || (admin ? null : user.id);
  const ownerEmail = site.owner_email || user.email;
  if (!ownerId && !ownerEmail) return json(res, 400, { error: 'site has no owner — assign a client login first' });

  const { data: plan } = await sb.from('billing_plans').select('*').eq('key', planKey).eq('active', true).maybeSingle();
  if (!plan) return json(res, 400, { error: 'plan not found' });

  // Free plan: no Stripe, never billed or auto-suspended — admin-assigned only (friends & family).
  if (plan.is_free) {
    if (!admin) return json(res, 403, { error: 'the Free plan is assigned by the team' });
    await sb.from('sites').update({ plan_key: planKey, monthly_amount: 0, billing_status: 'active', setup_paid: true, suspended_at: null, delete_flagged_at: null }).eq('id', site.id);
    return json(res, 200, { mode: 'free' });
  }
  // Use a real Stripe price only if one was actually configured; otherwise we build the
  // price inline from the dollar amount, so no Stripe price objects are required.
  const validPrice = (x) => typeof x === 'string' && /^price_/.test(x);

  try {
    let bc = null;
    if (ownerId) ({ data: bc } = await sb.from('billing_customers').select('*').eq('owner_user_id', ownerId).maybeSingle());
    let customerId = bc && bc.stripe_customer_id;
    if (!customerId) {
      const cust = await stripe('customers', 'POST', {
        email: ownerEmail || undefined,
        name: site.business_name || undefined,
        metadata: { owner_user_id: ownerId || '', owner_email: ownerEmail || '' },
      });
      customerId = cust.id;
      if (ownerId) await sb.from('billing_customers').upsert({ owner_user_id: ownerId, owner_email: ownerEmail, stripe_customer_id: customerId, updated_at: new Date().toISOString() }, { onConflict: 'owner_user_id' });
    }

    const subId = bc && bc.stripe_subscription_id;
    let liveSub = null;
    if (subId) { try { liveSub = await stripe('subscriptions/' + subId, 'GET'); } catch (e) { liveSub = null; } }

    if (liveSub && ['active', 'trialing', 'past_due'].includes(liveSub.status)) {
      let priceId = plan.stripe_price_id;
      if (!validPrice(priceId)) {
        const np = await stripe('prices', 'POST', {
          unit_amount: plan.monthly_amount, currency: plan.currency || 'aud',
          recurring: { interval: 'month' }, product_data: { name: plan.name || ('Hosting \u2014 ' + plan.key) },
        });
        priceId = np.id;
      }
      const item = await stripe('subscription_items', 'POST', {
        subscription: subId, price: priceId, quantity: 1,
        proration_behavior: 'create_prorations', metadata: { site_id: site.id },
      });
      if (plan.setup_amount && plan.setup_amount > 0) {
        await stripe('invoiceitems', 'POST', {
          customer: customerId, amount: plan.setup_amount, currency: plan.currency || 'aud',
          description: 'Setup fee — ' + (site.business_name || site.slug), metadata: { site_id: site.id },
        });
      }
      await sb.from('sites').update({
        plan_key: planKey, stripe_item_id: item.id, monthly_amount: plan.monthly_amount,
        billing_status: 'active', setup_paid: true,
      }).eq('id', site.id);
      return json(res, 200, { mode: 'added', subscriptionItem: item.id });
    }

    const base = (body.returnUrl || ('https://' + (req.headers.host || 'leadpages.com.au'))).replace(/\/+$/, '');
    const params = {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][quantity]': 1,
      allow_promotion_codes: true,
      success_url: base + '/manage?billing=success',
      cancel_url: base + '/manage?billing=cancelled',
      'subscription_data[metadata][site_id]': site.id,
      'subscription_data[metadata][owner_user_id]': ownerId || '',
      'subscription_data[metadata][plan_key]': planKey,
      'metadata[site_id]': site.id,
      'metadata[owner_user_id]': ownerId || '',
      'metadata[plan_key]': planKey,
    };
    if (validPrice(plan.stripe_price_id)) {
      params['line_items[0][price]'] = plan.stripe_price_id;
    } else {
      params['line_items[0][price_data][currency]'] = plan.currency || 'aud';
      params['line_items[0][price_data][product_data][name]'] = plan.name || ('Hosting \u2014 ' + plan.key);
      params['line_items[0][price_data][unit_amount]'] = plan.monthly_amount;
      params['line_items[0][price_data][recurring][interval]'] = 'month';
    }
    if (validPrice(plan.stripe_setup_price_id)) {
      params['line_items[1][price]'] = plan.stripe_setup_price_id;
      params['line_items[1][quantity]'] = 1;
    } else if (plan.setup_amount > 0) {
      params['subscription_data[add_invoice_items][0][price_data][currency]'] = plan.currency || 'aud';
      params['subscription_data[add_invoice_items][0][price_data][product_data][name]'] = 'Setup fee';
      params['subscription_data[add_invoice_items][0][price_data][unit_amount]'] = plan.setup_amount;
      params['subscription_data[add_invoice_items][0][quantity]'] = 1;
    }

    const sess = await stripe('checkout/sessions', 'POST', params);
    await sb.from('sites').update({ plan_key: planKey, monthly_amount: plan.monthly_amount }).eq('id', site.id);
    return json(res, 200, { mode: 'checkout', url: sess.url });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
