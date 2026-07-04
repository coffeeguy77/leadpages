// api/billing/app-cancel.js
// POST { siteId, appId }
// Cancels an app subscription at period end (Stripe) and marks it cancelled
// in site_app_subscriptions. Access continues until access_until.

const { sb, stripe, getUser, isAdminEmail, json } = require('./_stripe');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const user = await getUser(req);
  if (!user) return json(res, 401, { error: 'unauthorized' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const { siteId, appId } = body;
  if (!siteId || !appId) return json(res, 400, { error: 'siteId and appId required' });

  try {
    const { data: site } = await sb.from('sites')
      .select('id,owner_user_id').eq('id', siteId).maybeSingle();
    if (!site) return json(res, 404, { error: 'site not found' });
    const admin = isAdminEmail(user.email);
    if (!admin && site.owner_user_id !== user.id) return json(res, 403, { error: 'not your site' });

    const { data: sub } = await sb.from('site_app_subscriptions')
      .select('*').eq('site_id', siteId).eq('app_id', appId).maybeSingle();
    if (!sub) return json(res, 404, { error: 'no subscription found' });
    if (sub.status === 'cancelled') return json(res, 200, { ok: true, note: 'already cancelled' });

    // Cancel the Stripe subscription item at period end
    if (sub.stripe_subscription_item_id) {
      try {
        await stripe('subscription_items/' + sub.stripe_subscription_item_id, 'DELETE', {
          proration_behavior: 'none',
        });
      } catch (e) { /* item may already be gone */ }
    }

    const now = new Date().toISOString();
    await sb.from('site_app_subscriptions').update({
      status: 'cancelled', cancelled_at: now,
      access_until: sub.current_period_end || now,
      updated_at: now,
    }).eq('site_id', siteId).eq('app_id', appId);

    return json(res, 200, { ok: true, access_until: sub.current_period_end || now });
  } catch (e) {
    return json(res, 500, { error: String(e.message || e) });
  }
};
