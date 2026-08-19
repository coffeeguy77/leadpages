'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { getAdmin } = require('../../lib/order/supabase');
const { getOrderSystemForSite } = require('../../lib/order/auth');
const {
  getCart,
  createCart,
  addOrUpdateItem,
  removeItem,
  touchCart,
  convertCartToOrder,
  earliestPickupForCart
} = require('../../lib/order/cart');
const { resolvePaymentRule, computeDepositRequired } = require('../../lib/order/deposit');
const { effectiveOrderCutoff } = require('../../lib/order/cutoff');
const { isDateAvailable } = require('../../lib/order/capacity');
const { formatAud } = require('../../lib/order/money');
const { createAccessToken } = require('../../lib/order/tokens');
const { notifyEvent, portalUrl, PUBLIC_BASE } = require('../../lib/order/notify');

async function siteBySlugOrId(slug, siteId) {
  const admin = getAdmin();
  if (siteId) {
    const { data } = await admin.from('sites').select('id,slug,business_name').eq('id', siteId).maybeSingle();
    return data;
  }
  const { data } = await admin.from('sites').select('id,slug,business_name').eq('slug', slug).maybeSingle();
  return data;
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const q = req.query || {};
    const site = await siteBySlugOrId(q.slug || body.slug, q.site_id || body.site_id);
    if (!site) return json(res, 404, { error: 'site_not_found' });
    const system = await getOrderSystemForSite(site.id);
    if (!system || !system.enabled) return json(res, 404, { error: 'ordering_disabled' });
    const admin = getAdmin();

    if (req.method === 'GET') {
      const cartId = q.cart_id || q.cart;
      if (!cartId) return json(res, 400, { error: 'cart_id_required' });
      const packed = await getCart(cartId);
      if (!packed || packed.cart.site_id !== site.id) return json(res, 404, { error: 'cart_not_found' });
      const payRule = resolvePaymentRule({ system: system });
      const totals = {
        known_subtotal_cents: packed.cart.known_subtotal_cents,
        has_unknown_prices: packed.cart.has_unknown_prices
      };
      const deposit = computeDepositRequired(payRule, totals);
      return json(res, 200, {
        cart: packed.cart,
        items: packed.items,
        earliest_pickup_date: earliestPickupForCart(system, packed.items),
        deposit: deposit,
        display: {
          known_subtotal: formatAud(packed.cart.known_subtotal_cents),
          deposit: formatAud(deposit.deposit_required_cents),
          cta:
            deposit.deposit_required_cents > 0
              ? 'PAY ' + formatAud(deposit.deposit_required_cents) + ' DEPOSIT & CONFIRM ORDER'
              : 'CONFIRM ORDER'
        }
      });
    }

    if (req.method === 'POST') {
      const action = body.action || 'create';

      if (action === 'create') {
        const cart = await createCart(system, site.id, {
          name: body.guest_name,
          phone: body.guest_phone,
          email: body.guest_email
        });
        return json(res, 200, { cart: cart, items: [] });
      }

      if (action === 'add_item' || action === 'update_item') {
        if (!body.cart_id) return json(res, 400, { error: 'cart_id_required' });
        const packed = await getCart(body.cart_id);
        if (!packed || packed.cart.site_id !== site.id) return json(res, 404, { error: 'cart_not_found' });
        if (!body.product_id) return json(res, 400, { error: 'product_id_required' });
        const { data: product } = await admin
          .from('order_products')
          .select('*')
          .eq('id', body.product_id)
          .eq('site_id', site.id)
          .eq('active', true)
          .maybeSingle();
        if (!product) return json(res, 404, { error: 'product_not_found' });
        await addOrUpdateItem(packed.cart, product, {
          cart_item_id: body.cart_item_id,
          quantity: body.quantity,
          requested_weight_kg: body.requested_weight_kg,
          answers: body.answers,
          notes: body.notes
        });
        if (body.guest_name || body.guest_phone || body.guest_email) {
          await touchCart(packed.cart.id, {
            guest_name: body.guest_name || packed.cart.guest_name,
            guest_phone: body.guest_phone || packed.cart.guest_phone,
            guest_email: body.guest_email || packed.cart.guest_email
          });
        }
        const out = await getCart(packed.cart.id);
        return json(res, 200, out);
      }

      if (action === 'remove_item') {
        if (!body.cart_id || !body.cart_item_id) return json(res, 400, { error: 'cart_and_item_required' });
        const packed = await getCart(body.cart_id);
        if (!packed || packed.cart.site_id !== site.id) return json(res, 404, { error: 'cart_not_found' });
        await removeItem(body.cart_id, body.cart_item_id);
        return json(res, 200, await getCart(body.cart_id));
      }

      if (action === 'checkout') {
        if (!body.cart_id) return json(res, 400, { error: 'cart_id_required' });
        if (!String(body.customer_name || '').trim()) return json(res, 400, { error: 'customer_name_required' });
        if (!body.pickup_date && system.pickup_enabled) {
          return json(res, 400, { error: 'pickup_date_required' });
        }

        const packed = await getCart(body.cart_id);
        if (!packed || packed.cart.site_id !== site.id) return json(res, 404, { error: 'cart_not_found' });

        const products = packed.items.map(function (it) {
          return it.product_snapshot || {};
        });
        const earliest = earliestPickupForCart(system, packed.items);
        if (body.pickup_date && earliest && body.pickup_date < earliest) {
          return json(res, 400, { error: 'pickup_too_soon', earliest_pickup_date: earliest });
        }
        const cap = await isDateAvailable(system, body.pickup_date);
        if (!cap.ok) return json(res, 400, { error: 'date_at_capacity', capacity: cap });

        const created = await convertCartToOrder({
          cartId: body.cart_id,
          system: system,
          site: site,
          customer_name: body.customer_name,
          customer_phone: body.customer_phone,
          customer_email: body.customer_email,
          fulfilment_type: body.fulfilment_type,
          pickup_date: body.pickup_date,
          pickup_time: body.pickup_time,
          customer_notes: body.customer_notes,
          actor: { label: 'customer_storefront' }
        });

        // Recompute cutoff with live products for audit accuracy
        const { data: liveProducts } = await admin
          .from('order_products')
          .select('*')
          .in(
            'id',
            packed.items.map(function (i) {
              return i.product_id;
            }).filter(Boolean)
          );
        const cutoff = effectiveOrderCutoff(liveProducts || products, system, body.pickup_date);
        if (cutoff.effective_cutoff_at) {
          await admin
            .from('order_orders')
            .update({
              effective_cutoff_at: cutoff.effective_cutoff_at,
              cutoff_reason: cutoff.cutoff_reason,
              updated_at: new Date().toISOString()
            })
            .eq('id', created.order.id);
          created.order.effective_cutoff_at = cutoff.effective_cutoff_at;
          created.order.cutoff_reason = cutoff.cutoff_reason;
        }

        const portal = created.portal_token
          ? portalUrl(created.portal_token)
          : PUBLIC_BASE + '/order-portal';
        await notifyEvent({
          event_type:
            created.order.status === 'awaiting_deposit' ? 'deposit_required' : 'order_confirmed',
          system: system,
          site: site,
          order: created.order,
          portal_link: portal,
          channel: 'both',
          source: 'system'
        });

        let checkout_url = null;
        if (created.order.status === 'awaiting_deposit' && created.order.deposit_required_cents > 0) {
          // Client should call checkout-deposit with portal token
          checkout_url = portal + (portal.indexOf('?') >= 0 ? '&' : '?') + 'pay=1';
        }

        return json(res, 200, {
          order: created.order,
          items: created.items,
          portal_token: created.portal_token,
          portal_url: portal,
          checkout_url: checkout_url,
          deposit_token: created.deposit_token
        });
      }

      return json(res, 400, { error: 'unknown_action' });
    }

    if (req.method === 'PATCH') {
      if (!body.cart_id) return json(res, 400, { error: 'cart_id_required' });
      const packed = await getCart(body.cart_id);
      if (!packed || packed.cart.site_id !== site.id) return json(res, 404, { error: 'cart_not_found' });
      const cart = await touchCart(body.cart_id, {
        guest_name: body.guest_name,
        guest_phone: body.guest_phone,
        guest_email: body.guest_email
      });
      return json(res, 200, { cart: cart });
    }

    if (req.method === 'DELETE') {
      const cartId = q.cart_id || body.cart_id;
      const itemId = q.cart_item_id || body.cart_item_id;
      if (!cartId || !itemId) return json(res, 400, { error: 'cart_and_item_required' });
      const packed = await getCart(cartId);
      if (!packed || packed.cart.site_id !== site.id) return json(res, 404, { error: 'cart_not_found' });
      await removeItem(cartId, itemId);
      return json(res, 200, await getCart(cartId));
    }
  } catch (e) {
    console.error('order/cart', e);
    const code = e && e.code === 400 ? 400 : e && e.code === 404 ? 404 : 500;
    return json(res, code, { error: String((e && e.message) || e) });
  }
};
