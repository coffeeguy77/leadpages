'use strict';

/**
 * Abandoned cart recovery cron.
 * Auth: Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set.
 *
 * Rules:
 * - Only systems with abandoned_cart_enabled = true
 * - At most ONE reminder message per cart (ever), even if the cart is reactivated
 */

const { createClient } = require('@supabase/supabase-js');
const { notifyEvent, shopUrl } = require('../../lib/order/notify');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

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
      const delayMs = Math.max(5, Number(system.abandoned_cart_delay_minutes) || 60) * 60 * 1000;
      const cutoffIso = new Date(now - delayMs).toISOString();

      const { data: carts } = await admin
        .from('order_carts')
        .select('*')
        .eq('order_system_id', system.id)
        .eq('status', 'active')
        .gt('item_count', 0)
        .lt('last_activity_at', cutoffIso)
        .limit(40);

      const { data: site } = await admin
        .from('sites')
        .select('id,slug,business_name')
        .eq('id', system.site_id)
        .maybeSingle();
      if (!site) continue;

      for (const cart of carts || []) {
        // Mark abandoned even if we will not message again.
        await admin
          .from('order_carts')
          .update({ status: 'abandoned', updated_at: new Date().toISOString() })
          .eq('id', cart.id)
          .eq('status', 'active');

        const alreadyReminded =
          !!(cart.recovery_state && (cart.recovery_state.reminder_sent || cart.recovery_state.stage >= 1));

        var priorCount = 0;
        if (!alreadyReminded) {
          var { count } = await admin
            .from('order_abandoned_events')
            .select('id', { count: 'exact', head: true })
            .eq('cart_id', cart.id);
          priorCount = count || 0;
        }

        if (alreadyReminded || priorCount > 0) {
          skipped.push({ cart_id: cart.id, reason: 'already_reminded' });
          await admin
            .from('order_carts')
            .update({
              recovery_state: Object.assign({}, cart.recovery_state || {}, {
                reminder_sent: true,
                stage: Math.max(1, (cart.recovery_state && cart.recovery_state.stage) || 1)
              }),
              updated_at: new Date().toISOString()
            })
            .eq('id', cart.id);
          continue;
        }

        const stage = 1;
        const channels = system.abandoned_cart_channels || ['email'];
        const checkout = shopUrl(site.slug, cart.id);
        const channelStr = Array.isArray(channels) ? channels.join(',') : String(channels);

        const { data: evt } = await admin
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

        const channelPref =
          Array.isArray(channels) && channels.indexOf('sms') >= 0 && channels.indexOf('email') >= 0
            ? 'both'
            : Array.isArray(channels) && channels.indexOf('sms') >= 0
              ? 'sms'
              : 'email';

        const sent = await notifyEvent({
          event_type: 'abandoned_cart',
          system: system,
          site: site,
          cart: cart,
          checkout_link: checkout,
          channel: channelPref,
          source: 'system'
        });

        const messageId =
          sent && sent.sent && sent.sent[0] && sent.sent[0].id ? sent.sent[0].id : null;

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

        await admin
          .from('order_carts')
          .update({
            recovery_state: Object.assign({}, cart.recovery_state || {}, {
              stage: stage,
              reminder_sent: true,
              last_message_at: new Date().toISOString(),
              checkout_link: checkout
            }),
            updated_at: new Date().toISOString()
          })
          .eq('id', cart.id);

        results.push({ cart_id: cart.id, site_id: site.id, stage: stage });
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
