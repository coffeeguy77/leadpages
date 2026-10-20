'use strict';

/**
 * Connect a shop's own Stripe account (Stripe Connect — Standard account, direct charges).
 *
 *   GET  ?site_id=…                         → { status } for the shop's connected account
 *   POST { site_id, action: 'start', email } → creates the shop's Stripe account if it has none,
 *                                              saves it, returns { url } for Stripe onboarding
 *
 * Standard accounts: the shop owns its Stripe account and dashboard — deposits, Stripe fees,
 * refunds and disputes are theirs. Requires Connect to be enabled on the platform Stripe account.
 */

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { writeAudit } = require('../../lib/order/audit');
const { stripeApi, paymentSettings, connectStatus } = require('../../lib/order/stripe-pay');

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');

function stripeError(r, fallback) {
  const msg = r && r.data && r.data.error && r.data.error.message;
  if (msg && /signed up for connect|connect.*not.*enabled|platform profile/i.test(msg)) {
    return 'Stripe Connect isn’t switched on for the LeadPages Stripe account yet. In Stripe: Connect → Get started, then try again. (' + msg + ')';
  }
  return msg || fallback;
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST'])) return;
    if (!process.env.STRIPE_SECRET_KEY) return json(res, 500, { error: 'payments_not_configured' });
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const body = req.method === 'GET' ? {} : await readBody(req);
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);
    const pay = paymentSettings(system);

    if (req.method === 'GET') {
      const status = await connectStatus(pay.stripe_connect_account_id);
      return json(res, 200, { status: status });
    }

    if (body.action !== 'start') return json(res, 400, { error: 'unknown_action' });

    const admin = getAdmin();
    let accountId = pay.stripe_connect_account_id;
    if (accountId) {
      const st = await connectStatus(accountId);
      if (!st.connected) accountId = '';
    }
    if (!accountId) {
      const email = String(body.email || '').trim() || user.email || '';
      const created = await stripeApi('POST', 'accounts', {
        type: 'standard',
        country: 'AU',
        email: email,
        'business_profile[name]': (access.site && access.site.business_name) || undefined,
        'metadata[site_id]': siteId,
        'metadata[order_system_id]': system.id,
        'metadata[created_by]': user.email || user.id
      });
      if (!created.ok || !created.data || !created.data.id) {
        return json(res, 502, { error: 'stripe_account_failed', message: stripeError(created, 'Stripe could not create the account.') });
      }
      accountId = created.data.id;
      const settings = Object.assign({}, system.settings || {});
      settings.payments = Object.assign({}, settings.payments || {}, {
        provider: 'stripe',
        stripe_connect_account_id: accountId,
        stripe_charge_mode: 'direct',
        stripe_connected_via: 'leadpages_connect',
        stripe_connected_at: new Date().toISOString()
      });
      const { error: uErr } = await admin
        .from('order_systems')
        .update({ settings: settings, updated_at: new Date().toISOString() })
        .eq('id', system.id);
      if (uErr) throw uErr;
      await writeAudit({
        order_system_id: system.id,
        site_id: siteId,
        event_type: 'stripe_account_created',
        actor_user_id: user.id,
        actor_label: user.email || null,
        source: 'admin',
        payload: { stripe_account: accountId, email: email }
      });
    }

    const back = PUBLIC_BASE + '/orders?site_id=' + encodeURIComponent(siteId);
    const link = await stripeApi('POST', 'account_links', {
      account: accountId,
      type: 'account_onboarding',
      refresh_url: back + '&stripe_connect=refresh#settings-payments',
      return_url: back + '&stripe_connect=return#settings-payments'
    });
    if (!link.ok || !link.data || !link.data.url) {
      return json(res, 502, { error: 'stripe_link_failed', message: stripeError(link, 'Stripe could not start onboarding.') });
    }
    return json(res, 200, { url: link.data.url, account_id: accountId });
  } catch (e) {
    console.error('order/stripe-connect', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
