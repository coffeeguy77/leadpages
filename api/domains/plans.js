// api/domains/plans.js — discover the sellable add-on plans (Premium DNS, Email
// Hosting, Email Exchange) at runtime and return your reseller COST alongside the
// SELL price. No plan_ids are hardcoded: we read /products/types, match the add-ons
// we resell by name, then list /products/plans?type_id= for each and normalise.
//
// Pricing knobs (env, all optional):
//   DREAMSCAPE_ADDON_MARKUP   multiplier over wholesale cost      (default 2.2)
//   DREAMSCAPE_ADDON_PERIOD   preferred term in months           (default 12)
//   ADDON_DNS_SELL            flat AUD/yr override for Premium DNS
//   ADDON_EMAIL_SELL          flat AUD/yr override for Email Hosting
//   ADDON_EXCHANGE_SELL       flat AUD/yr override for Email Exchange
// A flat *_SELL override always wins; otherwise sell = ceil(cost * markup) - 0.05.

const ds = require('../../dreamscape');
const { createClient } = require('@supabase/supabase-js');

const DOMAINS_ENABLED = String(process.env.DOMAINS_FEATURE_ENABLED || 'true') !== 'false';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const ADDONS = [
  { key: 'dns_hosting',    match: 'dns hosting',    label: 'Premium DNS',    sellEnv: 'ADDON_DNS_SELL' },
  { key: 'email_hosting',  match: 'email hosting',  label: 'Email Hosting',  sellEnv: 'ADDON_EMAIL_SELL' },
  { key: 'email_exchange', match: 'email exchange', label: 'Email Exchange', sellEnv: 'ADDON_EXCHANGE_SELL' }
];
const MARKUP = Number(process.env.DREAMSCAPE_ADDON_MARKUP || 2.2);
const PREFERRED_PERIOD = Number(process.env.DREAMSCAPE_ADDON_PERIOD || 12);

function num(n) { const v = Number(n); return isFinite(v) ? v : null; }
function sellFrom(cost, envKey) {
  const override = Number(process.env[envKey]);
  if (isFinite(override) && override > 0) return override;
  if (!isFinite(cost)) return null;
  return Math.ceil(cost * MARKUP) - 0.05; // e.g. cost 9.50 → 20.95
}
function pickPeriod(periods) {
  if (!Array.isArray(periods) || !periods.length) return null;
  return periods.find(p => Number(p.period) === PREFERRED_PERIOD) || periods[0];
}

module.exports = async (req, res) => {
  try {
    if (!DOMAINS_ENABLED) return res.status(404).json({ error: 'Domain feature disabled' });

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ error: 'Please sign in.' });
    const { data: { user } = {}, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !user) return res.status(401).json({ error: 'Your session has expired — please sign in again.' });

    const typesResp = await ds.listProductTypes({ limit: 100 });
    if (!typesResp.ok) return res.status(502).json({ error: typesResp.error || 'Could not load product types.' });
    const types = (typesResp.data && typesResp.data.data) || [];

    const addons = [];
    for (const addon of ADDONS) {
      const type = types.find(t => String(t.name || '').toLowerCase().includes(addon.match));
      if (!type) continue;
      const plansResp = await ds.listPlans({ type_id: type.id, limit: 100 });
      const plans = (plansResp.ok && plansResp.data && plansResp.data.data) || [];
      const tiers = plans.map(p => {
        const per = pickPeriod(p.periods);
        const cost = per ? num(per.price && per.price.wholesale) : null;
        return { plan_id: p.id, name: p.name, period: per ? per.period : PREFERRED_PERIOD, cost, sell: sellFrom(cost, addon.sellEnv) };
      }).filter(t => t.cost != null && t.sell != null);
      if (!tiers.length) continue;
      tiers.sort((a, b) => a.cost - b.cost);
      addons.push({ key: addon.key, label: addon.label, type_id: type.id, default_plan_id: tiers[0].plan_id, tiers });
    }

    return res.status(200).json({ ok: true, markup: MARKUP, period: PREFERRED_PERIOD, addons });
  } catch (e) {
    console.error('plans endpoint error:', e);
    return res.status(500).json({ error: 'Server error' });
  }
};
