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
  const commission = Math.round(o.gross * o.rate);
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
  // BUILD (50%) follows lead ATTRIBUTION — always the partner who generated the client.
  if (buildGross > 0 && site.referring_partner_id) {
    await createCommission({ partnerId: site.referring_partner_id, siteId: site.id, type: 'build', rate: BUILD_RATE, gross: buildGross, periodStart: toISO(inv.created), invoiceId: inv.id, partnerActive: await partnerIsActive(site.referring_partner_id) });
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
