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
