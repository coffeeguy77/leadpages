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
const { packCartResponse } = require('../../lib/order/cart-pack');
const { effectiveOrderCutoff } = require('../../lib/order/cutoff');
const { isDateAvailable } = require('../../lib/order/capacity');
const { createAccessToken } = require('../../lib/order/tokens');
const { notifyEvent, portalUrl, PUBLIC_BASE } = require('../../lib/order/notify');
const {
  listWindows,
  buildPickupSlots,
  findMatchingSlot
} = require('../../lib/order/fulfilment-windows');

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
      return json(res, 200, await packCartResponse(system, packed));
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
        return json(res, 200, await packCartResponse(system, out));
      }

      if (action === 'remove_item') {
        if (!body.cart_id || !body.cart_item_id) return json(res, 400, { error: 'cart_and_item_required' });
        const packed = await getCart(body.cart_id);
        if (!packed || packed.cart.site_id !== site.id) return json(res, 404, { error: 'cart_not_found' });
        await removeItem(body.cart_id, body.cart_item_id);
        return json(res, 200, await packCartResponse(system, await getCart(body.cart_id)));
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

        const windows = await listWindows(system.id);
        const slots = buildPickupSlots(windows, earliest, 28);
        let pickup_window_start = body.pickup_window_start || null;
        let pickup_window_end = body.pickup_window_end || null;
        let pickup_time = body.pickup_time || null;
        if (slots.length) {
          const slot =
            (body.pickup_slot_id &&
              slots.find(function (s) {
                return s.id === body.pickup_slot_id;
              })) ||
            findMatchingSlot(slots, body.pickup_date, pickup_window_start, pickup_window_end);
          if (!slot) {
            return json(res, 400, { error: 'pickup_slot_required', pickup_slots: slots });
          }
          pickup_window_start = slot.window_start;
          pickup_window_end = slot.window_end;
          pickup_time = String(slot.window_start).slice(0, 5);
          body.pickup_date = slot.date;
        }

        const created = await convertCartToOrder({
          cartId: body.cart_id,
          system: system,
          site: site,
          customer_name: body.customer_name,
          customer_phone: body.customer_phone,
          customer_email: body.customer_email,
          fulfilment_type: body.fulfilment_type,
          pickup_date: body.pickup_date,
          pickup_time: pickup_time,
          pickup_window_start: pickup_window_start,
          pickup_window_end: pickup_window_end,
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
        // Keep slug on portal URL so SMS sign-in still works if the token is lost.
        var portalWithSlug = portal;
        if (site.slug && portalWithSlug.indexOf('slug=') < 0) {
          portalWithSlug += (portalWithSlug.indexOf('?') >= 0 ? '&' : '?') + 'slug=' + encodeURIComponent(site.slug);
        }
        await notifyEvent({
          event_type:
            created.order.status === 'awaiting_deposit' ? 'deposit_required' : 'order_confirmed',
          system: system,
          site: site,
          order: created.order,
          portal_link: portalWithSlug,
          channel: 'both',
          source: 'system'
        });

        // Do NOT auto-append pay=1 — customer reviews the order confirmation first.
        return json(res, 200, {
          order: created.order,
          items: created.items,
          portal_token: created.portal_token,
          portal_url: portalWithSlug,
          checkout_url: null,
          deposit_token: created.deposit_token,
          needs_deposit:
            created.order.status === 'awaiting_deposit' &&
            Number(created.order.deposit_required_cents) > 0
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
