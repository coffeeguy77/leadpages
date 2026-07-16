// POST /api/billing/hosting-account — create a hosting client account (super-admin).
// Body: { businessName, ownerEmail, contactName?, phone?, planKey?, monthlyAmount?,
//         partnerId?, salePrice?, notes?, createCheckout? }
const { sb, requireSuper, readBody, json } = require('./_admin-auth');
const { stripe } = require('./_stripe');

function clean(s, n) {
  return String(s == null ? '' : s).trim().slice(0, n || 200);
}

function slugify(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'site';
}

async function uniqueSlug(base) {
  var slug = base;
  var i = 1;
  for (;;) {
    var r = await sb.from('sites').select('id').eq('slug', slug).maybeSingle();
    if (!r.data) return slug;
    i += 1;
    slug = base + '-' + i;
    if (i > 50) return base + '-' + Date.now().toString(36);
  }
}

module.exports = async function(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  const user = await requireSuper(req, res);
  if (!user) return;

  const b = await readBody(req);
  const businessName = clean(b.businessName, 160);
  const ownerEmail = clean(b.ownerEmail || b.customerEmail, 200).toLowerCase();
  if (!businessName) return json(res, 400, { ok: false, error: 'Business name is required.' });
  if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
    return json(res, 400, { ok: false, error: 'A valid client billing email is required.' });
  }

  const planKey = clean(b.planKey, 40) || null;
  let monthly = b.monthlyAmount != null ? Math.round(Number(b.monthlyAmount)) : null;
  let setup = b.setupAmount != null ? Math.round(Number(b.setupAmount)) : null;
  let plan = null;
  if (planKey) {
    const pl = await sb.from('billing_plans').select('*').eq('key', planKey).maybeSingle();
    plan = pl.data;
    if (plan && monthly == null) monthly = plan.monthly_amount;
    if (plan && setup == null) setup = plan.setup_amount;
  }

  const partnerId = clean(b.partnerId, 40) || null;
  if (partnerId) {
    const pr = await sb.from('partners').select('id,status').eq('id', partnerId).maybeSingle();
    if (!pr.data) return json(res, 400, { ok: false, error: 'Partner not found.' });
  }

  const slug = await uniqueSlug(slugify(businessName));
  const now = new Date().toISOString();
  const salePrice = b.salePrice != null ? Math.round(Number(b.salePrice)) : null;

  const siteRow = {
    slug: slug,
    business_name: businessName,
    owner_email: ownerEmail,
    plan_key: planKey,
    monthly_amount: monthly || 0,
    billing_status: (monthly && monthly > 0) ? 'none' : (plan && plan.is_free ? 'active' : 'none'),
    referring_partner_id: partnerId,
    servicing_partner_id: partnerId,
    commission_partner_id: partnerId,
    recurring_commission_active: !!partnerId,
    sale_price: salePrice,
    is_mockup: false,
    is_partner_home: false,
    config: {
      business: businessName,
      email: ownerEmail,
      phone: clean(b.phone, 40) || '',
      contactName: clean(b.contactName, 120) || '',
      billingNotes: clean(b.notes, 600) || '',
      industry: clean(b.industry, 80) || ''
    },
    created_at: now,
    updated_at: now
  };

  const ins = await sb.from('sites').insert(siteRow).select('*').single();
  if (ins.error || !ins.data) {
    return json(res, 500, { ok: false, error: (ins.error && ins.error.message) || 'Could not create site.' });
  }
  const site = ins.data;

  // Optionally create / attach a Stripe customer stub for the billing email.
  let stripeCustomerId = null;
  try {
    if (process.env.STRIPE_SECRET_KEY) {
      const existing = await sb.from('billing_customers')
        .select('*')
        .ilike('owner_email', ownerEmail)
        .maybeSingle();
      if (existing.data && existing.data.stripe_customer_id) {
        stripeCustomerId = existing.data.stripe_customer_id;
      } else {
        const cust = await stripe('customers', 'POST', {
          email: ownerEmail,
          name: businessName,
          metadata: {
            site_id: site.id,
            source: 'billing-admin'
          }
        });
        stripeCustomerId = cust.id;
        if (existing.data) {
          await sb.from('billing_customers').update({
            stripe_customer_id: stripeCustomerId,
            updated_at: now
          }).eq('owner_user_id', existing.data.owner_user_id);
        }
        // Without owner_user_id yet we still record email for ops visibility via site.owner_email.
      }
    }
  } catch (e) {
    console.error('hosting-account stripe customer:', e && e.message);
  }

  let checkoutUrl = null;
  if (b.createCheckout && plan && plan.stripe_price_id && process.env.STRIPE_SECRET_KEY) {
    try {
      const base = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/$/, '');
      const session = await stripe('checkout/sessions', 'POST', {
        mode: 'subscription',
        customer: stripeCustomerId || undefined,
        customer_email: stripeCustomerId ? undefined : ownerEmail,
        success_url: base + '/billing?session=success',
        cancel_url: base + '/billing-admin?tab=clients',
        allow_promotion_codes: true,
        line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
        metadata: {
          site_id: site.id,
          plan_key: planKey || '',
          partner_id: partnerId || ''
        },
        subscription_data: {
          metadata: {
            site_id: site.id,
            plan_key: planKey || '',
            partner_id: partnerId || ''
          }
        }
      });
      checkoutUrl = session.url || null;
    } catch (e) {
      console.error('hosting-account checkout:', e && e.message);
    }
  }

  return json(res, 200, {
    ok: true,
    site: site,
    stripe_customer_id: stripeCustomerId,
    checkout_url: checkoutUrl
  });
};
