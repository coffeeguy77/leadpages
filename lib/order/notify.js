'use strict';

const { getAdmin } = require('./supabase');
const { loadTemplate, renderTemplate, queueAndSend } = require('./messaging');
const { formatAud } = require('./money');
const { displayGivenName, displayFullName } = require('./customer-name');

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://leadpages.com.au').replace(/\/+$/, '');

async function buildVars(ctx) {
  const order = ctx.order || {};
  const cart = ctx.cart || {};
  const site = ctx.site || {};
  const system = ctx.system || {};
  const rawName = order.customer_name || cart.guest_name || '';
  const first = displayGivenName(rawName) || 'there';
  return {
    first_name: first,
    customer_name: displayFullName(rawName) || rawName || '',
    business_name: site.business_name || 'us',
    cart_total: cart.known_subtotal_cents != null ? formatAud(cart.known_subtotal_cents) : '',
    known_cart_total: cart.known_subtotal_cents != null ? formatAud(cart.known_subtotal_cents) : '',
    checkout_link: ctx.checkout_link || '',
    order_number: order.order_number || '',
    pickup_date: order.pickup_date || '',
    pickup_time: order.pickup_time || '',
    cutoff_time: order.effective_cutoff_at || '',
    deposit_amount: order.deposit_required_cents != null ? formatAud(order.deposit_required_cents) : '',
    portal_link: ctx.portal_link || '',
    deposit_link: ctx.portal_link || ctx.checkout_link || '',
    order_prefix: system.order_prefix || 'ORD'
  };
}

/**
 * Fire a notification event. Channels: email, sms, or both (based on contact + system).
 */
async function notifyEvent(opts) {
  const admin = getAdmin();
  const eventType = opts.event_type;
  const system = opts.system;
  const site = opts.site;
  const order = opts.order || null;
  const cart = opts.cart || null;

  const email = (order && order.customer_email) || (cart && cart.guest_email) || opts.email;
  const phone = (order && order.customer_phone) || (cart && cart.guest_phone) || opts.phone;

  const channels = [];
  if (opts.channel === 'email' || opts.channel === 'both' || !opts.channel) {
    if (email) channels.push('email');
  }
  if (opts.channel === 'sms' || opts.channel === 'both') {
    if (phone) channels.push('sms');
  }
  if (!channels.length && phone) channels.push('sms');
  if (!channels.length && email) channels.push('email');
  if (!channels.length) return { sent: [], skipped: 'no_destination' };

  const categoryMap = {
    order_created: 'order_confirmed',
    deposit_required: 'deposit_required',
    deposit_received: 'deposit_received',
    order_confirmed: 'order_confirmed',
    changes_closing_soon: 'changes_closing_soon',
    order_locked: 'order_locked',
    price_finalised: 'price_finalised',
    pickup_reminder: 'pickup_reminder',
    ready_for_collection: 'ready_for_collection',
    order_completed: 'order_completed',
    abandoned_cart: 'abandoned_cart',
    abandoned_cart_2: 'abandoned_cart_2',
    deposit_reminder: 'deposit_reminder',
    deposit_reminder_day_before: 'deposit_reminder'
  };
  const category = opts.template_category || categoryMap[eventType] || 'custom';

  const vars = await buildVars({
    order: order,
    cart: cart,
    site: site,
    system: system,
    checkout_link: opts.checkout_link,
    portal_link: opts.portal_link
  });

  const results = [];
  for (const ch of channels) {
    const tpl = await loadTemplate(system.id, category, ch);
    let body =
      (tpl && tpl.body) ||
      opts.fallback_body ||
      defaultBody(opts.template_category || category, vars);
    let subject = (tpl && tpl.subject) || opts.subject || defaultSubject(eventType, vars);
    body = renderTemplate(body, vars);
    subject = renderTemplate(subject, vars);
    const dest = ch === 'email' ? email : phone;
    const sent = await queueAndSend({
      order_system_id: system.id,
      site_id: site.id,
      order_id: order && order.id,
      cart_id: cart && cart.id,
      customer_id: (order && order.customer_id) || (cart && cart.customer_id) || null,
      channel: ch,
      event_type: eventType,
      destination: dest,
      subject: subject,
      body: body,
      template_id: tpl && tpl.id
    });
    results.push(sent);
  }

  await admin.from('order_audit_events').insert({
    order_system_id: system.id,
    site_id: site.id,
    order_id: order && order.id,
    event_type: 'customer_notified',
    source: opts.source || 'system',
    payload: { event: eventType, channels: channels }
  });

  return { sent: results };
}

function defaultSubject(event, vars) {
  if (event === 'abandoned_cart' || event === 'abandoned_cart_2') {
    return 'Your order is still waiting — ' + (vars.business_name || '');
  }
  if (event === 'deposit_required') return 'Deposit for ' + (vars.order_number || 'your order');
  if (event === 'ready_for_collection') return 'Ready for pickup — ' + (vars.order_number || '');
  return 'Update on ' + (vars.order_number || 'your order');
}

function defaultBody(event, vars) {
  if (event === 'abandoned_cart') {
    return (
      'Hi ' +
      vars.first_name +
      ', your cart with ' +
      (vars.business_name || 'us') +
      ' is still waiting. Continue here: ' +
      vars.checkout_link
    );
  }
  if (event === 'abandoned_cart_2') {
    return (
      'Hi ' +
      vars.first_name +
      ', friendly reminder — your order with ' +
      (vars.business_name || 'us') +
      ' is still open: ' +
      vars.checkout_link
    );
  }
  if (event === 'deposit_required' || event === 'deposit_reminder') {
    return (
      'Hi ' +
      vars.first_name +
      ', pay your deposit of ' +
      vars.deposit_amount +
      ' for order ' +
      vars.order_number +
      ': ' +
      (vars.portal_link || vars.checkout_link)
    );
  }
  return 'Hi ' + vars.first_name + ', update for order ' + vars.order_number + ': ' + (vars.portal_link || '');
}

function portalUrl(token) {
  return PUBLIC_BASE + '/order-portal?t=' + encodeURIComponent(token);
}

function shopUrl(slug, cartId) {
  let u = PUBLIC_BASE + '/order-shop?slug=' + encodeURIComponent(slug || '');
  if (cartId) u += '&cart=' + encodeURIComponent(cartId);
  return u;
}

module.exports = {
  notifyEvent,
  portalUrl,
  shopUrl,
  buildVars,
  PUBLIC_BASE
};
