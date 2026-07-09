// api/partner/buy-site.js — PUBLIC client self-signup checkout (no auth).
// A client viewing a partner's demo clicks "Get this site". We create a Stripe
// Checkout Session in subscription mode with two line items:
//   [0] the hosting plan (recurring) — the partner's default, or the client's pick
//   [1] the one-off SALE PRICE the partner set on this demo (a one-time line)
// On payment the billing webhook (checkout.session.completed, metadata.purchase
// === 'site') converts the demo into a live client site, creates the buyer's
// account, links billing, and books the partner's commission via lpSplit.
//
// No Stripe Connect: LeadPages collects the full payment and books the partner's
// share in the commission ledger (paid out separately).

const { sb, stripe, json, rawBody } = require('../billing/_stripe');
const { effectiveDemoSalePrice } = require('../../lib/partner-demo-pricing');

function validPrice(p) { return typeof p === 'string' && /^price_/.test(p); }

async function readBody(req) {
  let body = req.body;
  if (body && typeof body === 'object') return body;
  if (typeof body === 'string') { try { return JSON.parse(body); } catch (e) {} }
  try { const raw = await rawBody(req); return JSON.parse(raw.toString('utf8') || '{}'); } catch (e) { return {}; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  try {
    const body = await readBody(req);
    let siteId = String(body.siteId || '').trim();
    let email = String(body.email || '').trim().toLowerCase();
    let planKey = String(body.planKey || '').trim();

    // A quote link carries everything: resolve it to the demo + price + plan + email.
    let quoteId = null, quotePrice = null;
    const quoteToken = String(body.quoteToken || '').trim();
    if (quoteToken) {
      const { data: q } = await sb.from('partner_quotes').select('*').eq('token', quoteToken).maybeSingle();
      if (!q) return json(res, 404, { error: 'This quote could not be found.' });
      if (q.status === 'paid') return json(res, 409, { error: 'This quote has already been accepted and paid.' });
      if (!q.site_id) return json(res, 400, { error: 'This quote is not linked to a site.' });
      quoteId = q.id; quotePrice = Math.round(Number(q.price) || 0);
      siteId = q.site_id;
      if (!email) email = String(q.email || '').trim().toLowerCase();
      if (!planKey) planKey = String(q.plan_key || '').trim();
    }
    if (!siteId) return json(res, 400, { error: 'Missing siteId.' });

    // Load the demo. It must have a sale price and a partner behind it.
    const { data: site, error: se } = await sb.from('sites')
      .select('id, slug, business_name, sale_price, is_mockup, status, servicing_partner_id, referring_partner_id, plan_key, custom_domain')
      .eq('id', siteId).maybeSingle();
    if (se) return json(res, 500, { error: 'Could not load this site: ' + se.message });
    if (!site) return json(res, 404, { error: 'This site no longer exists.' });

    const partnerId = site.servicing_partner_id || site.referring_partner_id;
    if (!partnerId) return json(res, 400, { error: 'This demo is not set up for purchase yet.' });
    const salePrice = effectiveDemoSalePrice(site, quotePrice);
    if (salePrice <= 0) return json(res, 400, { error: 'This demo does not have a price set yet. Ask your provider to set one.' });
    if (site.is_mockup === false && site.status === 'live') return json(res, 409, { error: 'This site has already been purchased.' });

    // Resolve the hosting plan: the client's pick, else the demo's, else the
    // partner's default. Must resolve to a real, active plan.
    if (!planKey) planKey = site.plan_key || '';
    if (!planKey) {
      const pp = (await sb.from('partner_profiles').select('default_plan_key').eq('partner_id', partnerId).maybeSingle()).data;
      planKey = (pp && pp.default_plan_key) || '';
    }
    const { data: plan } = planKey
      ? await sb.from('billing_plans').select('*').eq('key', planKey).eq('active', true).maybeSingle()
      : { data: null };
    if (!plan) return json(res, 400, { error: 'No valid hosting plan was selected.' });

    const host = (req.headers['x-forwarded-host'] || req.headers.host || 'leadpages.com.au').split(',')[0].trim();
    const base = 'https://' + host.replace(/\/+$/, '');
    const cur = (plan.currency || 'aud').toLowerCase();

    // One-off sale price as its own Stripe price (one-time, no recurring).
    const saleProduct = 'Website build \u2014 ' + (site.business_name || site.slug);
    const salePrice_ = await stripe('prices', 'POST', {
      unit_amount: salePrice, currency: cur, product_data: { name: saleProduct },
    });

    const params = {
      mode: 'subscription',
      allow_promotion_codes: true,
      'line_items[0][quantity]': 1,
      'line_items[1][quantity]': 1,
      'line_items[1][price]': salePrice_.id,
      success_url: base + '/' + encodeURIComponent(site.slug) + '?purchased=1',
      cancel_url: base + '/' + encodeURIComponent(site.slug) + '?preview=1',
      'metadata[purchase]': 'site',
      'metadata[site_id]': site.id,
      'metadata[plan_key]': planKey,
      'metadata[sale_price]': String(salePrice),
      'metadata[partner_id]': partnerId,
      'metadata[quote_id]': quoteId || '',
      'subscription_data[metadata][purchase]': 'site',
      'subscription_data[metadata][site_id]': site.id,
      'subscription_data[metadata][plan_key]': planKey,
      'subscription_data[metadata][sale_price]': String(salePrice),
      'subscription_data[metadata][partner_id]': partnerId,
      'subscription_data[metadata][quote_id]': quoteId || '',
    };
    if (email) params.customer_email = email;

    // Hosting (recurring) line.
    if (validPrice(plan.stripe_price_id)) {
      params['line_items[0][price]'] = plan.stripe_price_id;
    } else {
      params['line_items[0][price_data][currency]'] = cur;
      params['line_items[0][price_data][product_data][name]'] = plan.name || ('Hosting \u2014 ' + plan.key);
      params['line_items[0][price_data][unit_amount]'] = plan.monthly_amount;
      params['line_items[0][price_data][recurring][interval]'] = 'month';
    }

    const sess = await stripe('checkout/sessions', 'POST', params);
    return json(res, 200, { url: sess.url });
  } catch (e) {
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
