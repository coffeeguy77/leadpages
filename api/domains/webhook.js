// api/domains/webhook.js — Stripe webhook. Fulfils a paid domain order.
//
// On checkout.session.completed we, for each order in the group, idempotently:
//   1) skip if already completed / already registered at Dreamscape
//   2) re-check the reserve balance (hold, don't fail, if low)
//   3) ensure a Dreamscape customer for this user
//   4) create a registrant from the stored snapshot
//   5) register the domain (privacy + .au eligibility) — full request/response
//      is written to domain_events so the sandbox tells us the exact fields
//   6) store the domain row and mark the order completed
// A failure marks the order 'failed_requires_review' (payment is already taken —
// see the admin note) and never silently double-registers.
//
// This is NOT Next.js, so req is the raw stream — we read it ourselves for the
// signature check. Env: STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY, SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY, DREAMSCAPE_API_TOKEN, DREAMSCAPE_API_BASE_URL.

const ds = require('../../dreamscape');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function readRaw(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body);
  const chunks = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

function verifyStripe(raw, header, secret) {
  if (!header || !secret) return false;
  const parts = {};
  header.split(',').forEach(kv => { const i = kv.indexOf('='); if (i > 0) parts[kv.slice(0, i)] = kv.slice(i + 1); });
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(parts.t)) > 300) return false; // 5-min tolerance
  const expected = crypto.createHmac('sha256', secret).update(parts.t + '.' + raw.toString('utf8')).digest('hex');
  const a = Buffer.from(expected), b = Buffer.from(parts.v1);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function tldOf(d) { const i = String(d).indexOf('.'); return i < 0 ? '' : String(d).slice(i + 1); }
const isAu = d => /\.au$/i.test(String(d));

async function logEvent(domainId, userId, type, message, status, metadata) {
  try { await sb.from('domain_events').insert({ domain_id: domainId || null, user_id: userId || null, event_type: type, message: message || null, status: status || null, metadata: metadata || null }); }
  catch (e) { /* never let logging break fulfilment */ }
}

// Build the .au eligibility array. NOTE: field names confirmed via sandbox.
// The register call logs the full response, so a wrong field surfaces as a
// validation error in domain_events rather than a bad live registration.
function auEligibility(reg) {
  const out = [];
  if (reg.business_name) out.push({ name: 'registrant_name', value: reg.business_name });
  if (reg.business_number) out.push({ name: 'registrant_id', value: reg.business_number });
  out.push({ name: 'registrant_id_type', value: (reg.business_number_type || 'ABN') });
  out.push({ name: 'eligibility_type', value: reg.eligibility_type || 'Company' });
  return out;
}

async function ensureCustomer(userId, reg, email) {
  const existing = await sb.from('domain_customers').select('*').eq('user_id', userId).maybeSingle();
  if (existing.data && existing.data.dreamscape_customer_id) return existing.data.dreamscape_customer_id;
  const payload = {
    username: ('lp_' + userId).slice(0, 32),
    password: crypto.randomBytes(12).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 16) + 'A1!',
    first_name: reg.first_name, last_name: reg.last_name,
    address: reg.address, city: reg.city, country: reg.country || 'AU', state: reg.state, post_code: reg.post_code,
    country_code: Number(reg.country_code || 61), phone: String(reg.phone || ''), mobile: String(reg.mobile || reg.phone || ''),
    email: email || reg.email, account_type: reg.account_type || 'individual'
  };
  if (String(reg.account_type).toLowerCase() === 'business') {
    payload.business_name = reg.business_name; payload.business_number_type = reg.business_number_type || 'ABN'; payload.business_number = reg.business_number;
  }
  const r = await ds.createCustomer(payload);
  await logEvent(null, userId, 'customer.create', r.error || 'ok', r.ok ? 'ok' : 'error', { status: r.status, response: r.data });
  const id = r.data && r.data.data && r.data.data.id;
  if (!r.ok || !id) throw new Error('customer_create_failed: ' + (r.error || r.status));
  await sb.from('domain_customers').upsert({ user_id: userId, dreamscape_customer_id: String(id), email: payload.email, first_name: reg.first_name, last_name: reg.last_name, business_name: reg.business_name || null, phone: payload.phone }, { onConflict: 'user_id' });
  return String(id);
}

async function createRegistrant(userId, reg) {
  const payload = {
    first_name: reg.first_name, last_name: reg.last_name, address: reg.address, city: reg.city,
    country: reg.country || 'AU', state: reg.state, post_code: reg.post_code,
    country_code: Number(reg.country_code || 61), phone: String(reg.phone || ''), email: reg.email,
    account_type: reg.account_type || 'individual'
  };
  if (String(reg.account_type).toLowerCase() === 'business') {
    payload.business_name = reg.business_name; payload.business_number_type = reg.business_number_type || 'ABN'; payload.business_number = reg.business_number;
  }
  const r = await ds.createRegistrant(payload);
  await logEvent(null, userId, 'registrant.create', r.error || 'ok', r.ok ? 'ok' : 'error', { status: r.status, response: r.data });
  const id = r.data && r.data.data && r.data.data.id;
  if (!r.ok || !id) throw new Error('registrant_create_failed: ' + (r.error || r.status));
  await sb.from('domain_registrants').insert({ user_id: userId, dreamscape_registrant_id: String(id), account_type: reg.account_type, business_name: reg.business_name || null, abn_acn: reg.business_number || null, contact_name: (reg.first_name + ' ' + reg.last_name), email: reg.email, phone: String(reg.phone || ''), address_line_1: reg.address, city: reg.city, state: reg.state, postcode: reg.post_code, country: reg.country || 'AU', raw_payload: payload });
  return String(id);
}

async function fulfilOrder(order, paymentIntent) {
  const userId = order.user_id;
  const reg = (order.raw_payload && order.raw_payload.registrant) || {};
  const domain = order.domain_name;

  // 1) already done?
  if (order.status === 'completed') return;
  const dom = await sb.from('domains').select('id,dreamscape_domain_id').eq('user_id', userId).eq('domain_name', domain).maybeSingle();
  if (dom.data && dom.data.dreamscape_domain_id) {
    await sb.from('domain_orders').update({ status: 'completed', domain_id: dom.data.id, payment_status: 'paid', payment_reference: paymentIntent }).eq('id', order.id);
    return;
  }

  await sb.from('domain_orders').update({ status: 'registering', payment_status: 'paid', payment_reference: paymentIntent }).eq('id', order.id);

  // 2) reserve guard (hold rather than fail — admin tops up and we retry)
  const bal = await ds.getBalance(); const parsed = ds.readBalance(bal);
  if (parsed && ds.evaluateBalance(parsed.balance, Number(order.estimated_cost || 0)).decision === 'block') {
    await sb.from('domain_orders').update({ status: 'requires_admin_balance', error_message: 'reserve_balance' }).eq('id', order.id);
    await logEvent(null, userId, 'order.hold', 'reserve balance too low', 'hold', { domain, balance: parsed.balance });
    return;
  }

  try {
    // 3 + 4) customer + registrant
    const customerId = await ensureCustomer(userId, reg, order.raw_payload && order.raw_payload.email);
    const registrantId = await createRegistrant(userId, reg);

    // 5) register the domain
    const regBody = { customer_id: Number(customerId), registrant_id: Number(registrantId), domain_name: domain, period: 12, privacy: !!order.privacy_selected };
    if (isAu(domain)) regBody.eligibility_data = auEligibility(reg);
    const r = await ds.registerDomain(regBody);
    await logEvent(null, userId, 'domain.register', r.error || 'ok', r.ok ? 'ok' : 'error', { domain, request: regBody, status: r.status, response: r.data });
    const data = r.data && r.data.data;
    if (!r.ok || !data || !data.id) throw new Error('register_failed: ' + (r.error || (r.data && JSON.stringify(r.data.validation_errors || r.data)) || r.status));

    // 6) store the domain + complete the order
    const domIns = await sb.from('domains').insert({
      user_id: userId, site_id: (order.raw_payload && order.raw_payload.site_id) || null,
      dreamscape_domain_id: String(data.id), dreamscape_customer_id: String(customerId), dreamscape_registrant_id: String(registrantId),
      domain_name: domain, tld: tldOf(domain), status: 'active', registration_period_years: 1,
      expiry_date: data.expiry_date ? new Date(data.expiry_date.replace(' ', 'T')).toISOString() : null,
      privacy_enabled: !!data.privacy, privacy_status: data.privacy ? 'enabled' : 'not_enabled',
      raw_dreamscape_payload: data
    }).select('id').single();
    const domainId = domIns.data && domIns.data.id;
    await sb.from('domain_orders').update({ status: 'completed', domain_id: domainId || null, dreamscape_response_id: String(data.id), error_message: null }).eq('id', order.id);
    await logEvent(domainId, userId, 'order.completed', domain + ' registered', 'ok', { domain });
  } catch (err) {
    await sb.from('domain_orders').update({ status: 'failed_requires_review', error_message: String(err.message || err).slice(0, 500) }).eq('id', order.id);
    await logEvent(null, userId, 'order.failed', String(err.message || err).slice(0, 500), 'error', { domain });
  }
}

module.exports = async (req, res) => {
  let raw;
  try { raw = await readRaw(req); } catch (e) { return res.status(400).send('no body'); }
  if (!verifyStripe(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET)) {
    return res.status(400).send('bad signature');
  }
  let event; try { event = JSON.parse(raw.toString('utf8')); } catch (e) { return res.status(400).send('bad json'); }

  // Acknowledge fast for events we don't act on.
  if (event.type !== 'checkout.session.completed') return res.status(200).json({ received: true });

  try {
    const session = event.data.object;
    const group = (session.metadata && session.metadata.order_group) || session.client_reference_id;
    const paymentIntent = session.payment_intent || null;
    if (!group) return res.status(200).json({ received: true });

    const { data: orders } = await sb.from('domain_orders').select('*').eq('order_group', group);
    for (const order of (orders || [])) {
      if (order.status === 'completed') continue;
      await fulfilOrder(order, paymentIntent);
    }
    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('webhook fulfil error:', e);
    // 200 so Stripe doesn't hammer retries; the order rows capture the failure.
    return res.status(200).json({ received: true, note: 'logged' });
  }
};
