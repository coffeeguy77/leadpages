// api/billing/webhook.js — Stripe events for hosting subscriptions.
// Configure a SEPARATE Stripe webhook endpoint pointing here, and put its signing
// secret in STRIPE_BILLING_WEBHOOK_SECRET (falls back to STRIPE_WEBHOOK_SECRET).
//
// Events handled:
//   checkout.session.completed     -> link customer+subscription, activate the site
//   invoice.payment_succeeded      -> active; reactivate any suspended sites (Stripe emails the receipt)
//   invoice.payment_failed         -> past_due (warning only — Stripe keeps retrying)
//   customer.subscription.updated  -> active / past_due (grace) / unpaid|canceled -> suspend
//   customer.subscription.deleted  -> suspend
//
// Per the chosen policy, a site is only SUSPENDED once Stripe's retry period is
// exhausted (status unpaid/canceled), not on the first failed charge.

const { sb, stripe, rawBody, verifyStripeSig, json } = require('./_stripe');

// status mapping for a subscription -> a site's billing_status
function siteStatusFor(subStatus) {
  if (subStatus === 'active' || subStatus === 'trialing') return 'active';
  if (subStatus === 'past_due') return 'past_due';        // grace: still live, warned
  if (subStatus === 'unpaid' || subStatus === 'canceled' || subStatus === 'incomplete_expired') return 'suspended';
  return null; // incomplete / paused etc. — leave as-is
}

async function ownerForCustomer(customerId) {
  if (!customerId) return null;
  const { data } = await sb.from('billing_customers').select('owner_user_id').eq('stripe_customer_id', customerId).maybeSingle();
  return data ? data.owner_user_id : null;
}

async function setSitesStatusForOwner(ownerId, status) {
  if (!ownerId || !status) return;
  const patch = { billing_status: status };
  if (status === 'suspended') patch.suspended_at = new Date().toISOString();
  if (status === 'active') { patch.suspended_at = null; patch.delete_flagged_at = null; }
  // Only touch sites that are actually being billed (have a plan / item).
  await sb.from('sites').update(patch).eq('owner_user_id', ownerId).not('plan_key', 'is', null);
  await sb.from('billing_customers').update({ status, updated_at: new Date().toISOString() }).eq('owner_user_id', ownerId);
}

// ---- Partner commissions (Phase 3) -----------------------------------------
// Build = 50% of the one-off setup fee; Recurring = 20% of each paid monthly
// subscription charge. Driven by actual PAID invoices, attributed to the site's
// referring partner. Idempotent (unique indexes on the table back this up).
const BUILD_RATE = Number(process.env.PARTNER_BUILD_RATE || 0.50);
const RECUR_RATE = Number(process.env.PARTNER_RECUR_RATE || 0.20);

async function siteForInvoice(inv) {
  const cols = 'id, referring_partner_id, commission_partner_id, recurring_commission_active, plan_key';
  const lines = (inv.lines && inv.lines.data) || [];
  // a) explicit per-line site_id metadata (set on added-mode setup items / subs)
  for (const l of lines) { if (l.metadata && l.metadata.site_id) {
    const r = await sb.from('sites').select(cols).eq('id', l.metadata.site_id).maybeSingle();
    if (r.data) return r.data;
  }}
  // b) subscription metadata
  const subId = inv.subscription || lines.map(l => l.subscription).find(Boolean);
  if (subId) {
    try { const sub = await stripe('subscriptions/' + subId, 'GET');
      const sid = sub && sub.metadata && sub.metadata.site_id;
      if (sid) { const r = await sb.from('sites').select(cols).eq('id', sid).maybeSingle(); if (r.data) return r.data; }
    } catch (e) {}
  }
  // c) by subscription item -> sites.stripe_item_id
  const itemId = lines.map(l => l.subscription_item).find(Boolean);
  if (itemId) { const r = await sb.from('sites').select(cols).eq('stripe_item_id', itemId).maybeSingle(); if (r.data) return r.data; }
  // d) owner's single billed site
  const ownerId = await ownerForCustomer(inv.customer);
  if (ownerId) { const r = await sb.from('sites').select(cols).eq('owner_user_id', ownerId).not('plan_key', 'is', null);
    if (r.data && r.data.length === 1) return r.data[0]; }
  return null;
}

async function createCommission(o) {
  const commission = (o.commissionOverride != null) ? Math.round(o.commissionOverride) : Math.round(o.gross * o.rate);
  if (commission <= 0) return;
  // dedupe (the unique indexes are the hard backstop)
  if (o.type === 'build') {
    const ex = await sb.from('partner_commissions').select('id').eq('site_id', o.siteId).eq('type', 'build').maybeSingle();
    if (ex.data) return;
  } else {
    const ex = await sb.from('partner_commissions').select('id').eq('stripe_invoice_id', o.invoiceId).eq('site_id', o.siteId).eq('type', 'recurring').maybeSingle();
    if (ex.data) return;
  }
  const exp = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  try {
    await sb.from('partner_commissions').insert({
      partner_id: o.partnerId, site_id: o.siteId, type: o.type, rate: o.rate,
      gross_amount: o.gross, commission_amount: commission,
      status: o.partnerActive ? 'pending' : 'held',
      period_start: o.periodStart || null, period_end: o.periodEnd || null,
      stripe_invoice_id: o.invoiceId || null, expected_payment_date: exp,
    });
  } catch (e) { /* unique index race — already recorded */ }
}

async function partnerIsActive(pid) {
  if (!pid) return false;
  const r = await sb.from('partners').select('status').eq('id', pid).maybeSingle();
  return !!(r.data && r.data.status === 'active');
}
// Partner's build/sale share: LeadPages keeps max($750, half); the partner gets
// the rest, less a flat 10% if the partner is NOT registered for GST.
function lpSplitCents(price, gstReg) {
  const p = Math.max(0, Math.round(price || 0));
  let lp = Math.max(75000, Math.floor(p / 2)); if (lp > p) lp = p;
  let partner = p - lp;
  if (!gstReg) partner = partner - Math.round(partner * 0.10);
  return partner < 0 ? 0 : partner;
}
async function partnerGst(pid) {
  if (!pid) return false;
  const r = await sb.from('partner_profiles').select('gst_registered').eq('partner_id', pid).maybeSingle();
  return !!(r.data && r.data.gst_registered);
}
// Find or create the Supabase auth user for a buyer's email (service role), so a
// self-signup client can magic-link in to manage the site they just bought.
async function ensureAuthUser(email) {
  email = String(email || '').trim().toLowerCase(); if (!email) return null;
  const base = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  try {
    const r = await fetch(base + '/auth/v1/admin/users', { method: 'POST', headers: h, body: JSON.stringify({ email: email, email_confirm: true }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok && j && j.id) return j.id;
  } catch (e) {}
  // Already registered — page through and match by email.
  for (let page = 1; page <= 5; page++) {
    try {
      const lr = await fetch(base + '/auth/v1/admin/users?per_page=200&page=' + page, { headers: { apikey: key, Authorization: 'Bearer ' + key } });
      const lj = await lr.json().catch(() => ({}));
      const users = (lj && lj.users) || [];
      const hit = users.find((u) => String(u.email || '').toLowerCase() === email);
      if (hit) return hit.id;
      if (users.length < 200) break;
    } catch (e) { break; }
  }
  return null;
}
async function accrueCommissions(inv) {
  const site = await siteForInvoice(inv);
  if (!site) return;
  const toISO = u => (u ? new Date(u * 1000).toISOString() : null);
  let recurGross = 0, recurPS = null, recurPE = null, buildGross = 0;
  for (const l of ((inv.lines && inv.lines.data) || [])) {
    const amt = Number(l.amount || 0); if (amt <= 0) continue;
    const recurring = !!(l.price && l.price.recurring) || l.type === 'subscription';
    if (recurring) { recurGross += amt; if (l.period) { if (recurPS == null) recurPS = l.period.start; recurPE = l.period.end || recurPE; } }
    else buildGross += amt;
  }
  // BUILD/SALE follows lead ATTRIBUTION — the partner who generated the client.
  // Their share is the lpSplit of the one-off sale (NOT a flat 50%): LeadPages
  // keeps max($750, half); the partner gets the rest, less 10% if not GST-registered.
  // (Deduped by site+type, so booking here OR at checkout completion is safe.)
  if (buildGross > 0 && site.referring_partner_id) {
    const gstReg = await partnerGst(site.referring_partner_id);
    const partnerShare = lpSplitCents(buildGross, gstReg);
    const effRate = buildGross > 0 ? Number((partnerShare / buildGross).toFixed(4)) : 0;
    await createCommission({ partnerId: site.referring_partner_id, siteId: site.id, type: 'build', rate: effRate, gross: buildGross, commissionOverride: partnerShare, periodStart: toISO(inv.created), invoiceId: inv.id, partnerActive: await partnerIsActive(site.referring_partner_id) });
  }
  // RECURRING (20%) follows commission ELIGIBILITY — the current earner, and only
  // while recurring is switched on for this client (transfers can redirect or stop it).
  const recurPartner = site.commission_partner_id || site.referring_partner_id;
  if (recurGross > 0 && recurPartner && site.recurring_commission_active !== false) {
    await createCommission({ partnerId: recurPartner, siteId: site.id, type: 'recurring', rate: RECUR_RATE, gross: recurGross, periodStart: toISO(recurPS), periodEnd: toISO(recurPE), invoiceId: inv.id, partnerActive: await partnerIsActive(recurPartner) });
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  const secret = process.env.STRIPE_BILLING_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_SECRET;
  const raw = await rawBody(req);
  const sig = req.headers['stripe-signature'];
  if (!verifyStripeSig(raw, sig, secret)) return json(res, 400, { error: 'bad signature' });

  let event;
  try { event = JSON.parse(raw.toString('utf8')); } catch (e) { return json(res, 400, { error: 'bad json' }); }
  const obj = (event.data && event.data.object) || {};

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode !== 'subscription') break;
        const customerId = obj.customer;
        const subId = obj.subscription;
        const md = obj.metadata || {};
        // --- Client self-signup: a demo was purchased from its preview ---
        if (md.purchase === 'site' && md.site_id) {
          const email = (obj.customer_details && obj.customer_details.email) || obj.customer_email || md.email || null;
          const buyerId = email ? await ensureAuthUser(email) : null;
          const cur = (await sb.from('sites').select('servicing_partner_id, referring_partner_id, commission_partner_id').eq('id', md.site_id).maybeSingle()).data || {};
          const partnerId = md.partner_id || cur.referring_partner_id || cur.servicing_partner_id || null;
          let monthly = null;
          if (md.plan_key) { const pl = (await sb.from('billing_plans').select('monthly_amount').eq('key', md.plan_key).maybeSingle()).data; monthly = pl ? pl.monthly_amount : null; }
          let itemId = null;
          try { const subFull = await stripe('subscriptions/' + subId, 'GET'); itemId = subFull.items && subFull.items.data && subFull.items.data[0] && subFull.items.data[0].id; } catch (e) {}
          const patch = {
            is_mockup: false, show_on_showcase: false, status: 'live',
            billing_status: 'active', setup_paid: true,
            plan_key: md.plan_key || undefined, monthly_amount: (monthly != null ? monthly : undefined),
            stripe_item_id: itemId || undefined, suspended_at: null, delete_flagged_at: null,
            servicing_status: 'partner_serviced', recurring_commission_active: true,
            updated_at: new Date().toISOString(),
          };
          if (email) patch.owner_email = email;
          if (buyerId) patch.owner_user_id = buyerId;
          if (partnerId) { patch.referring_partner_id = partnerId; patch.servicing_partner_id = cur.servicing_partner_id || partnerId; patch.commission_partner_id = cur.commission_partner_id || partnerId; }
          await sb.from('sites').update(patch).eq('id', md.site_id);
          if (buyerId) {
            await sb.from('billing_customers').upsert({
              owner_user_id: buyerId, stripe_customer_id: customerId, stripe_subscription_id: subId,
              status: 'active', updated_at: new Date().toISOString(),
            }, { onConflict: 'owner_user_id' });
          }
          // Book the partner's sale commission now (authoritative attribution +
          // timing). Deduped by site+type so the invoice path won't double it.
          const salePrice = Math.round(Number(md.sale_price) || 0);
          if (partnerId && salePrice > 0) {
            const gstReg = await partnerGst(partnerId);
            const share = lpSplitCents(salePrice, gstReg);
            const effRate = salePrice > 0 ? Number((share / salePrice).toFixed(4)) : 0;
            await createCommission({ partnerId: partnerId, siteId: md.site_id, type: 'build', rate: effRate, gross: salePrice, commissionOverride: share, periodStart: new Date().toISOString(), invoiceId: obj.invoice || null, partnerActive: await partnerIsActive(partnerId) });
          }
          // From a quote? Relabel the site to the client's details and mark it paid.
          if (md.quote_id) {
            const q = (await sb.from('partner_quotes').select('*').eq('id', md.quote_id).maybeSingle()).data;
            if (q) {
              const upd = { updated_at: new Date().toISOString() };
              if (q.business_name) upd.business_name = q.business_name;
              const cfgRow = (await sb.from('sites').select('config').eq('id', md.site_id).maybeSingle()).data;
              const cfg = (cfgRow && cfgRow.config && typeof cfgRow.config === 'object') ? cfgRow.config : {};
              cfg._intake = Object.assign({}, cfg._intake, {
                contactName: q.contact_person || null, address: q.address || null,
                phones: q.phones || [], email: q.email || null, fromQuote: q.id,
              });
              upd.config = cfg;
              await sb.from('sites').update(upd).eq('id', md.site_id);
              await sb.from('partner_quotes').update({ status: 'paid', paid_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', md.quote_id);
            }
          }
          break; // sale handled
        }
        const ownerId = md.owner_user_id || (await ownerForCustomer(customerId));
        if (ownerId) {
          await sb.from('billing_customers').upsert({
            owner_user_id: ownerId, stripe_customer_id: customerId, stripe_subscription_id: subId,
            status: 'active', updated_at: new Date().toISOString(),
          }, { onConflict: 'owner_user_id' });
        }
        // Map the subscription's recurring item to the site and mark active.
        if (md.site_id) {
          let itemId = null;
          try { const subFull = await stripe('subscriptions/' + subId, 'GET'); itemId = subFull.items && subFull.items.data && subFull.items.data[0] && subFull.items.data[0].id; } catch (e) {}
          await sb.from('sites').update({ billing_status: 'active', setup_paid: true, stripe_item_id: itemId || undefined, suspended_at: null, delete_flagged_at: null }).eq('id', md.site_id);
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const ownerId = await ownerForCustomer(obj.customer);
        await setSitesStatusForOwner(ownerId, 'active'); // Stripe emails the receipt automatically
        try { await accrueCommissions(obj); } catch (e) { console.error('commission accrue error:', e && e.message); }
        break;
      }

      case 'invoice.payment_failed': {
        const ownerId = await ownerForCustomer(obj.customer);
        // Warning only — Stripe will keep retrying. Don't suspend yet.
        await setSitesStatusForOwner(ownerId, 'past_due');
        break;
      }

      case 'customer.subscription.updated': {
        const ownerId = await ownerForCustomer(obj.customer);
        const st = siteStatusFor(obj.status);
        if (ownerId && st) await setSitesStatusForOwner(ownerId, st);
        break;
      }

      case 'customer.subscription.deleted': {
        const ownerId = await ownerForCustomer(obj.customer);
        await setSitesStatusForOwner(ownerId, 'suspended');
        break;
      }

      default: break;
    }
  } catch (e) {
    // 200 anyway so Stripe doesn't hammer retries on a transient DB hiccup;
    // log for debugging.
    console.error('billing webhook error:', e && e.message);
  }

  return json(res, 200, { received: true });
};
