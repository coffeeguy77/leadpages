'use strict';

/**
 * Abandoned cart recovery cron.
 * Auth: Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
 *
 * Rules:
 * - Only systems with abandoned_cart_enabled = true (re-checked before each send)
 * - Per-customer cap (settings.abandoned_cart.max_per_customer) in lookback window
 * - Up to 2 stages per cart when messages_per_cart = 2 (separate templates)
 */

const { createClient } = require('@supabase/supabase-js');
const { notifyEvent, shopUrl } = require('../../lib/order/notify');
const { parseAbandonedCartSettings, secondDelayMs, templateCategoryForStage } = require('../../lib/order/abandoned-cart-settings');
const {
  cartContactPhone,
  cartStage,
  lastMessageAt,
  customerUnderMessageCap
} = require('../../lib/order/abandoned-cart-recovery');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function countPriorEvents(cartId) {
  var { count } = await admin
    .from('order_abandoned_events')
    .select('id', { count: 'exact', head: true })
    .eq('cart_id', cartId)
    .eq('status', 'sent');
  return count || 0;
}

async function processCartReminder(opts) {
  var system = opts.system;
  var site = opts.site;
  var cart = opts.cart;
  var stage = opts.stage;
  var settings = opts.settings;

  if (!settings.enabled) {
    return { cart_id: cart.id, skipped: true, reason: 'disabled' };
  }

  var cap = await customerUnderMessageCap(admin, system.id, cart, settings);
  if (!cap.ok) {
    return { cart_id: cart.id, skipped: true, reason: cap.reason, phone: cap.phone };
  }

  var channels = settings.channels.length ? settings.channels : ['email'];
  var checkout = shopUrl(site.slug, cart.id);
  var channelStr = Array.isArray(channels) ? channels.join(',') : String(channels);
  var channelPref =
    channels.indexOf('sms') >= 0 && channels.indexOf('email') >= 0
      ? 'both'
      : channels.indexOf('sms') >= 0
        ? 'sms'
        : 'email';

  var { data: evt } = await admin
    .from('order_abandoned_events')
    .insert({
      cart_id: cart.id,
      site_id: site.id,
      stage: stage,
      channel: channelStr,
      scheduled_for: new Date().toISOString(),
      status: 'scheduled'
    })
    .select('*')
    .single();

  var sent = await notifyEvent({
    event_type: 'abandoned_cart',
    template_category: templateCategoryForStage(stage),
    system: system,
    site: site,
    cart: cart,
    checkout_link: checkout,
    channel: channelPref,
    source: 'system'
  });

  var messageId = sent && sent.sent && sent.sent[0] && sent.sent[0].id ? sent.sent[0].id : null;

  if (evt) {
    await admin
      .from('order_abandoned_events')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        message_id: messageId
      })
      .eq('id', evt.id);
  }

  var nowIso = new Date().toISOString();
  await admin
    .from('order_carts')
    .update({
      status: 'abandoned',
      recovery_state: Object.assign({}, cart.recovery_state || {}, {
        stage: stage,
        reminder_sent: true,
        last_message_at: nowIso,
        checkout_link: checkout
      }),
      updated_at: nowIso
    })
    .eq('id', cart.id);

  return { cart_id: cart.id, site_id: site.id, stage: stage, sent: true };
}

module.exports = async function (req, res) {
  const json = function (code, obj) {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };

  const secret = process.env.CRON_SECRET;
  if (secret) {
    const h = req.headers.authorization || '';
    if (h !== 'Bearer ' + secret) return json(401, { ok: false, error: 'unauthorized' });
  }

  try {
    const { data: systems, error } = await admin
      .from('order_systems')
      .select('*')
      .eq('enabled', true)
      .eq('abandoned_cart_enabled', true)
      .limit(100);
    if (error) throw error;

    const results = [];
    const skipped = [];
    const now = Date.now();

    for (const system of systems || []) {
      const settings = parseAbandonedCartSettings(system);
      if (!settings.enabled) continue;

      const { data: site } = await admin
        .from('sites')
        .select('id,slug,business_name')
        .eq('id', system.site_id)
        .maybeSingle();
      if (!site) continue;

      const firstDelayMs = Math.max(5, settings.delay_minutes) * 60 * 1000;
      const firstCutoffIso = new Date(now - firstDelayMs).toISOString();

      // Stage 1 — idle active carts
      const { data: stage1Carts } = await admin
        .from('order_carts')
        .select('*')
        .eq('order_system_id', system.id)
        .eq('status', 'active')
        .gt('item_count', 0)
        .lt('last_activity_at', firstCutoffIso)
        .limit(40);

      for (const cart of stage1Carts || []) {
        if (cartStage(cart) >= 1) {
          skipped.push({ cart_id: cart.id, reason: 'already_stage_1' });
          continue;
        }
        var prior = await countPriorEvents(cart.id);
        if (prior > 0) {
          skipped.push({ cart_id: cart.id, reason: 'already_reminded' });
          await admin
            .from('order_carts')
            .update({
              recovery_state: Object.assign({}, cart.recovery_state || {}, {
                reminder_sent: true,
                stage: Math.max(1, cartStage(cart))
              }),
              updated_at: new Date().toISOString()
            })
            .eq('id', cart.id);
          continue;
        }

        var r1 = await processCartReminder({ system: system, site: site, cart: cart, stage: 1, settings: settings });
        if (r1.skipped) skipped.push(r1);
        else results.push(r1);
      }

      if (settings.messages_per_cart < 2) continue;

      const secondMs = secondDelayMs(settings);
      const { data: stage2Carts } = await admin
        .from('order_carts')
        .select('*')
        .eq('order_system_id', system.id)
        .in('status', ['active', 'abandoned'])
        .gt('item_count', 0)
        .limit(60);

      for (const cart of stage2Carts || []) {
        if (cartStage(cart) !== 1) continue;
        var sentAt = lastMessageAt(cart);
        if (!sentAt) continue;
        if (now - new Date(sentAt).getTime() < secondMs) continue;

        var { count: stage2Count } = await admin
          .from('order_abandoned_events')
          .select('id', { count: 'exact', head: true })
          .eq('cart_id', cart.id)
          .eq('stage', 2)
          .eq('status', 'sent');
        if ((stage2Count || 0) > 0) {
          skipped.push({ cart_id: cart.id, reason: 'already_stage_2' });
          continue;
        }

        var r2 = await processCartReminder({ system: system, site: site, cart: cart, stage: 2, settings: settings });
        if (r2.skipped) skipped.push(r2);
        else results.push(r2);
      }
    }

    return json(200, {
      ok: true,
      processed: results.length,
      skipped: skipped.length,
      results: results,
      skipped_detail: skipped.slice(0, 40)
    });
  } catch (e) {
    console.error('cron/order-abandoned', e);
    return json(500, { ok: false, error: String((e && e.message) || e) });
  }
};
