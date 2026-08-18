'use strict';

/**
 * AI message draft generator for Order Engine templates.
 * Uses LeadPages Brain when available; otherwise returns curated industry templates.
 * NEVER auto-publishes — admin must approve/save.
 */

const { readBody, json, methodOk, clean } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');

const FALLBACK = {
  butcher: {
    abandoned_cart: [
      "Don't leave your steaks hanging, {{first_name}}. Your butcher order is still waiting: {{checkout_link}}",
      'Santa checked his list. Apparently your ham is still sitting in your cart: {{checkout_link}}',
      '{{first_name}}, your cuts are reserved in spirit only — finish checkout: {{checkout_link}}'
    ],
    deposit_required: [
      'Hi {{first_name}}, pay your ${{deposit_amount}} deposit for order {{order_number}}: {{deposit_link}}'
    ],
    order_locked: [
      'Order {{order_number}} is locked and being prepared. Pickup {{pickup_date}}. Call us if you need a hand.'
    ]
  },
  bakery: {
    abandoned_cart: [
      'Your cart is getting a little stale, {{first_name}}. Come back before the croissants judge you: {{checkout_link}}'
    ]
  },
  beer_supplies: {
    abandoned_cart: [
      "Your beer's getting warm, {{first_name}}. Your cart is still sitting here waiting for you: {{checkout_link}}"
    ]
  }
};

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['POST'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const body = await readBody(req);
    const siteId = body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);

    const industry = clean(body.industry || system.industry_preset || 'custom', 40);
    const topic = clean(body.topic || 'General', 60);
    const tone = clean(body.tone || 'Friendly', 40);
    const category = clean(body.category || 'abandoned_cart', 60);
    const channel = body.channel === 'email' ? 'email' : 'sms';

    let options = [];

    // Prefer Brain when available
    try {
      if (typeof require('../../lib/brain/gateway').getPlatformBrain === 'function' || true) {
        let brain;
        try {
          brain = require('../../lib/brain/gateway');
        } catch (_e) {
          brain = null;
        }
        if (brain && typeof brain.getPlatformBrain === 'function') {
          const b = await brain.getPlatformBrain();
          if (b && typeof b.generate === 'function') {
            const prompt =
              'Generate 4 short ' +
              channel +
              ' messages for a ' +
              industry +
              ' business. Category: ' +
              category +
              '. Topic: ' +
              topic +
              '. Tone: ' +
              tone +
              '. Use variables like {{first_name}}, {{business_name}}, {{checkout_link}}, {{order_number}}, {{pickup_date}}, {{deposit_amount}}, {{deposit_link}} where useful. Return JSON array of strings only. Do not invent payment URLs.';
            const out = await b.generate({
              taskId: 'orders.message_draft',
              prompt: prompt,
              maxTokens: 600
            });
            const text = (out && (out.text || out.content || '')) || '';
            const m = text.match(/\[[\s\S]*\]/);
            if (m) {
              try {
                options = JSON.parse(m[0]);
              } catch (_e) {}
            }
          }
        }
      }
    } catch (_brainErr) {
      // fall through to curated
    }

    if (!options.length) {
      const pack = FALLBACK[industry] || FALLBACK.butcher;
      options = (pack && pack[category]) || (FALLBACK.butcher.abandoned_cart || []).slice();
      if (topic && /christmas/i.test(topic) && industry === 'butcher') {
        options = [
          'Santa checked his list. Apparently your ham is still sitting in your cart: {{checkout_link}}'
        ].concat(options);
      }
    }

    options = options
      .map(function (s) {
        return String(s || '').trim();
      })
      .filter(Boolean)
      .slice(0, 5);

    return json(res, 200, {
      options: options,
      meta: { industry: industry, topic: topic, tone: tone, category: category, channel: channel },
      note: 'Review and edit before saving. Nothing is sent automatically.'
    });
  } catch (e) {
    console.error('order/message-ai', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
