// api/billing/app-checkout.js
// POST { siteId, appId, cycle:'monthly'|'annual', returnUrl? }
// Creates or modifies an app subscription using the site owner's existing
// Stripe customer (same billing_customers row as hosting). If no Stripe
// customer exists yet, creates one. Uses existing subscription where possible
// (adds a subscription item), otherwise creates a new Checkout Session.
//
// Response:
//   { mode:'checkout', url }   -> redirect client to Stripe Checkout
//   { mode:'added' }           -> added to existing sub; no redirect needed
//   { mode:'upgraded' }        -> cycle changed (monthly -> annual or vice versa)
//   { mode:'reactivated' }     -> cancelled sub reactivated within access window

const { sb, stripe, getUser, isAdminEmail, json } = require('./_stripe');

const validPrice = (x) => typeof x === 'string' && /^price_/.test(x);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!process.env.STRIPE_SECRET_KEY) return json(res, 500, { error: 'Payments not configured.' });
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const { siteId, appId, cycle } = body;
  if (!siteId || !appId || !cycle) return json(res, 400, { error: 'siteId, appId and cycle required' });
  if (!['monthly', 'annual'].includes(cycle)) return json(res, 400, { error: 'cycle must be monthly or annual' });

  try {
    // Load site
    const { data: site } = await sb.from('sites')
      .select('id,slug,business_name,owner_user_id,owner_email,billing_status')
      .eq('id', siteId).maybeSingle();
    if (!site) return json(res, 404, { error: 'site not found' });

    const admin = isAdminEmail(user.email);
    if (!admin && site.owner_user_id && site.owner_user_id !== user.id)
      return json(res, 403, { error: 'not your site' });

    // Load app
    const { data: app } = await sb.from('app_registry')
      .select('id,slug,name,tier,price_monthly_aud,price_annual_aud,stripe_price_id_monthly,stripe_price_id_annual')
      .eq('id', appId).maybeSingle();
    if (!app) return json(res, 404, { error: 'app not found' });
    if (app.tier !== 'paid' && app.tier !== 'metered')
      return json(res, 400, { error: 'this app does not require a subscription' });

    // Check for existing sub
    const { data: existingSub } = await sb.from('site_app_subscriptions')
      .select('*').eq('site_id', siteId).eq('app_id', appId).maybeSingle();

    // Reactivation: cancelled but still within access_until
    if (existingSub && existingSub.status === 'cancelled' && existingSub.access_until) {
      if (new Date(existingSub.access_until) > new Date()) {
        await sb.from('site_app_subscriptions')
          .update({ status: 'active', cancelled_at: null, billing_cycle: cycle,
                    updated_at: new Date().toISOString() })
          .eq('site_id', siteId).eq('app_id', appId);
        return json(res, 200, { mode: 'reactivated' });
      }
    }

    const ownerId = site.owner_user_id || (admin ? null : user.id);
    const ownerEmail = site.owner_email || user.email;

    // Get or create Stripe customer
    let { data: bc } = await sb.from('billing_customers')
      .select('*').eq('owner_user_id', ownerId).maybeSingle();
    let customerId = bc && bc.stripe_customer_id;
    if (!customerId) {
      const cust = await stripe('customers', 'POST', {
        email: ownerEmail || undefined,
        name: site.business_name || undefined,
        metadata: { owner_user_id: ownerId || '', owner_email: ownerEmail || '' },
      });
      customerId = cust.id;
      if (ownerId) {
        await sb.from('billing_customers').upsert(
          { owner_user_id: ownerId, owner_email: ownerEmail, stripe_customer_id: customerId,
            updated_at: new Date().toISOString() },
          { onConflict: 'owner_user_id' });
      }
    }

    // Resolve price
    const isAnnual = cycle === 'annual';
    const priceIdField = isAnnual ? 'stripe_price_id_annual' : 'stripe_price_id_monthly';
    const amountCents = isAnnual
      ? Math.round((app.price_annual_aud || 0) * 100)
      : Math.round((app.price_monthly_aud || 0) * 100);
    let priceId = app[priceIdField];

    // If no stored Stripe price, create one inline
    if (!validPrice(priceId)) {
      const np = await stripe('prices', 'POST', {
        unit_amount: amountCents,
        currency: 'aud',
        recurring: isAnnual ? { interval: 'year' } : { interval: 'month' },
        product_data: { name: app.name + (isAnnual ? ' (annual)' : ' (monthly)') },
      });
      priceId = np.id;
      // Save it for next time
      await sb.from('app_registry').update({ [priceIdField]: priceId }).eq('id', appId);
    }

    // Try to add to existing hosting subscription
    const subId = bc && bc.stripe_subscription_id;
    if (subId) {
      let liveSub = null;
      try { liveSub = await stripe('subscriptions/' + subId, 'GET'); } catch (e) {}
      if (liveSub && ['active', 'trialing', 'past_due'].includes(liveSub.status)) {
        // Check: already has this app as an item? (upgrade cycle case)
        const items = (liveSub.items && liveSub.items.data) || [];
        const existing = items.find((it) => it.metadata && it.metadata.app_id === appId);
        if (existing) {
          // Upgrade/downgrade cycle — swap price
          await stripe('subscription_items/' + existing.id, 'POST', {
            price: priceId, quantity: 1, proration_behavior: 'create_prorations',
          });
          await sb.from('site_app_subscriptions').update({
            billing_cycle: cycle, price_aud: isAnnual ? (app.price_annual_aud || 0) : (app.price_monthly_aud || 0),
            stripe_subscription_item_id: existing.id, updated_at: new Date().toISOString(),
          }).eq('site_id', siteId).eq('app_id', appId);
          return json(res, 200, { mode: 'upgraded' });
        }
        // Add as new item to existing sub
        const item = await stripe('subscription_items', 'POST', {
          subscription: subId, price: priceId, quantity: 1,
          proration_behavior: 'create_prorations',
          metadata: { site_id: siteId, app_id: appId },
        });
        const now = new Date().toISOString();
        const periodEnd = new Date();
        if (isAnnual) periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        else periodEnd.setMonth(periodEnd.getMonth() + 1);
        await sb.from('site_app_subscriptions').upsert({
          site_id: siteId, app_id: appId, billing_cycle: cycle,
          price_aud: isAnnual ? (app.price_annual_aud || 0) : (app.price_monthly_aud || 0),
          status: 'active', started_at: now, current_period_start: now,
          current_period_end: periodEnd.toISOString(),
          access_until: periodEnd.toISOString(),
          stripe_subscription_item_id: item.id, stripe_customer_id: customerId,
          updated_at: now,
        }, { onConflict: 'site_id,app_id' });
        return json(res, 200, { mode: 'added' });
      }
    }

    // No active subscription — create Checkout Session
    const base = (body.returnUrl || ('https://' + (req.headers.host || 'leadpages.com.au'))).replace(/\/+$/, '');
    const params = {
      mode: 'subscription',
      customer: customerId,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': 1,
      allow_promotion_codes: true,
      success_url: base + '/billing?site=' + encodeURIComponent(site.slug) + '&success=app',
      cancel_url:  base + '/billing?site=' + encodeURIComponent(site.slug),
      'subscription_data[metadata][site_id]': siteId,
      'subscription_data[metadata][app_id]': appId,
      'subscription_data[metadata][owner_user_id]': ownerId || '',
      'subscription_data[metadata][billing_type]': 'app',
      'subscription_data[metadata][billing_cycle]': cycle,
      'metadata[billing_type]': 'app',
      'metadata[site_id]': siteId,
      'metadata[app_id]': appId,
    };
    const sess = await stripe('checkout/sessions', 'POST', params);
    return json(res, 200, { mode: 'checkout', url: sess.url });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
