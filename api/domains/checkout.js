// api/domains/checkout.js — creates a Stripe Checkout session for a domain cart.
//
// Flow: verify the logged-in customer → re-check availability + price on the
// SERVER (never trust the browser) → balance guard → write one domain_orders
// row per domain (status 'pending', shared order_group) → create a Stripe
// Checkout session → return its URL. Fulfilment happens in webhook.js after
// Stripe confirms payment, so a closed tab can never half-finish a purchase.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY,
//      PUBLIC_BASE_URL (e.g. https://leadpages.com.au), DREAMSCAPE_API_TOKEN,
//      DREAMSCAPE_API_BASE_URL (set to the sandbox while testing).

const ds = require('../../dreamscape');
const { loadRetailMap } = require('../../pricing-store');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');
const PRIVACY_RESELLER_COST = Number(process.env.DREAMSCAPE_PRIVACY_COST || 5); // for the balance guard only

function tldOf(d) { const i = String(d).indexOf('.'); return i < 0 ? '' : String(d).slice(i + 1); }

async function stripe(path, params) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) body.append(k, String(v));
  const r = await fetch('https://api.stripe.com/v1/' + path, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + (process.env.STRIPE_SECRET_KEY || ''), 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  let j = null; try { j = await r.json(); } catch (e) { j = null; }
  return { ok: r.ok, status: r.status, data: j };
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    if (!process.env.STRIPE_SECRET_KEY) return res.status(500).json({ error: 'Payments are not configured yet.' });

    // ---- auth: the buyer must be a signed-in LeadPages user ----
    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please sign in to buy a domain.' });
    const { data: { user } = {}, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: 'Your session has expired — please sign in again.' });

    // ---- parse body ----
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
    body = body || {};
    const wanted = Array.isArray(body.domains) ? body.domains.slice(0, 10) : [];
    const privacy = !!body.privacy;
    const registrant = body.registrant || {};
    const siteId = body.site_id || null;
    if (!wanted.length) return res.status(400).json({ error: 'Your cart is empty.' });

    // ---- minimal registrant validation (legal owner of the domain) ----
    const reqFields = ['account_type', 'first_name', 'last_name', 'email', 'phone', 'address', 'city', 'state', 'post_code'];
    for (const f of reqFields) if (!String(registrant[f] || '').trim()) return res.status(400).json({ error: 'Please complete the registrant details (' + f.replace(/_/g, ' ') + ').' });
    const isBusiness = String(registrant.account_type).toLowerCase() === 'business';
    if (isBusiness && !String(registrant.business_number || '').trim())
      return res.status(400).json({ error: 'An ABN/ACN is required for business registrations (needed for .au domains).' });

    // ---- re-check availability + true price on the server ----
    const names = wanted.map(d => String(d.domain || '').toLowerCase().trim()).filter(Boolean);
    const avail = await ds.checkAvailability(names);
    if (!avail.ok) return res.status(502).json({ error: 'Could not verify the domains right now. Please try again shortly.' });
    const rows = Array.isArray(avail.data && avail.data.data) ? avail.data.data : [avail.data && avail.data.data].filter(Boolean);
    const byName = {};
    for (const r of rows) if (r && r.domain_name) byName[String(r.domain_name).toLowerCase()] = r;

    const items = [];
    let resellerCost = 0;
    const retailMap = await loadRetailMap(sb);   // same overrides availability shows
    for (const name of names) {
      const info = byName[name];
      if (!info || info.is_available !== true) return res.status(409).json({ error: name + ' is no longer available. Please remove it and search again.' });
      const tld = tldOf(name);
      const dsReg = Number(info.register_price || 0);
      const sell = (retailMap[tld] != null) ? retailMap[tld] : ds.resolveSell(tld, dsReg);
      resellerCost += dsReg + (privacy ? PRIVACY_RESELLER_COST : 0);
      items.push({ domain: name, tld, sell, register_price: dsReg });
    }

    // ---- balance guard: never take money we can't fulfil from reseller balance ----
    const bal = await ds.getBalance();
    const parsed = ds.readBalance(bal);
    if (parsed) {
      const verdict = ds.evaluateBalance(parsed.balance, resellerCost);
      if (verdict.decision === 'block')
        return res.status(409).json({ error: 'Domain registration is briefly unavailable. Please try again later.', code: 'reserve' });
    }

    // ---- write one order row per domain, sharing an order_group ----
    const group = crypto.randomUUID();
    const orderRows = items.map(it => ({
      user_id: user.id,
      idempotency_key: group + ':' + it.domain,
      order_group: group,
      domain_name: it.domain,
      order_type: 'register',
      status: 'pending',
      registration_period_years: 1,
      privacy_selected: privacy,
      estimated_cost: it.register_price + (privacy ? PRIVACY_RESELLER_COST : 0),
      sell_price: it.sell + (privacy ? ds.PRIVACY_PRICE : 0),
      currency: 'AUD',
      raw_payload: { registrant, site_id: siteId, tld: it.tld }
    }));
    const ins = await sb.from('domain_orders').insert(orderRows);
    if (ins.error) return res.status(500).json({ error: 'Could not start your order. Please try again.' });

    // ---- Stripe Checkout session ----
    const params = {
      mode: 'payment',
      success_url: PUBLIC_BASE + '/domains?status=success&group=' + group,
      cancel_url: PUBLIC_BASE + '/domains?status=cancelled',
      customer_email: user.email || registrant.email,
      client_reference_id: group,
      'metadata[order_group]': group,
      'metadata[user_id]': user.id
    };
    let i = 0;
    for (const it of items) {
      params[`line_items[${i}][price_data][currency]`] = 'aud';
      params[`line_items[${i}][price_data][product_data][name]`] = it.domain + ' — 1 year registration';
      params[`line_items[${i}][price_data][unit_amount]`] = Math.round(it.sell * 100);
      params[`line_items[${i}][quantity]`] = 1;
      i++;
      if (privacy) {
        params[`line_items[${i}][price_data][currency]`] = 'aud';
        params[`line_items[${i}][price_data][product_data][name]`] = 'Private registration — ' + it.domain;
        params[`line_items[${i}][price_data][unit_amount]`] = Math.round(ds.PRIVACY_PRICE * 100);
        params[`line_items[${i}][quantity]`] = 1;
        i++;
      }
    }

    const session = await stripe('checkout/sessions', params);
    if (!session.ok || !session.data || !session.data.url) {
      await sb.from('domain_orders').update({ status: 'failed_requires_review', error_message: 'stripe_session_failed' }).eq('order_group', group);
      return res.status(502).json({ error: 'Could not start secure checkout. Please try again.' });
    }
    await sb.from('domain_orders').update({ stripe_session_id: session.data.id }).eq('order_group', group);

    return res.status(200).json({ url: session.data.url });
  } catch (e) {
    console.error('checkout error:', e);
    return res.status(500).json({ error: 'Something went wrong starting checkout.' });
  }
};
