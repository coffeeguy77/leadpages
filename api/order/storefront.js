'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { getAdmin } = require('../../lib/order/supabase');
const { getOrderSystemForSite } = require('../../lib/order/auth');
const { formatAud } = require('../../lib/order/money');
const { earliestPickupDate } = require('../../lib/order/cutoff');
const { resolvePaymentRule, computeDepositRequired } = require('../../lib/order/deposit');
const { isDateAvailable } = require('../../lib/order/capacity');
const { listWindows, buildPickupSlots } = require('../../lib/order/fulfilment-windows');

async function resolveSite(slug, siteId) {
  const admin = getAdmin();
  if (siteId) {
    const { data } = await admin
      .from('sites')
      .select('id,slug,business_name,config')
      .eq('id', siteId)
      .maybeSingle();
    return data;
  }
  if (!slug) return null;
  const { data } = await admin
    .from('sites')
    .select('id,slug,business_name,config')
    .eq('slug', slug)
    .maybeSingle();
  return data;
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET'])) return;
    const slug = (req.query && req.query.slug) || '';
    const siteId = (req.query && req.query.site_id) || '';
    const site = await resolveSite(slug, siteId);
    if (!site) return json(res, 404, { error: 'site_not_found' });

    const system = await getOrderSystemForSite(site.id);
    if (!system || !system.enabled) {
      return json(res, 404, { error: 'ordering_disabled' });
    }

    const admin = getAdmin();
    const { data: categories } = await admin
      .from('order_categories')
      .select('id,name,slug,description,sort_order')
      .eq('order_system_id', system.id)
      .eq('active', true)
      .order('sort_order');

    const { data: products } = await admin
      .from('order_products')
      .select(
        'id,category_id,name,slug,short_description,description,image_url,gallery,sku,pricing_method,price_cents,price_per_kg_cents,price_label,weight_required,unit_label,stock_method,cutoff_mode,cutoff_value,lead_time_mode,lead_time_value,featured,tags,active,options'
      )
      .eq('order_system_id', system.id)
      .eq('active', true)
      .order('sort_order');

    const productIds = (products || []).map(function (p) {
      return p.id;
    });
    let questions = [];
    let relationships = [];
    if (productIds.length) {
      const q = await admin
        .from('order_product_questions')
        .select('*')
        .in('product_id', productIds)
        .eq('staff_only', false)
        .order('sort_order');
      questions = q.data || [];
      const r = await admin
        .from('order_product_relationships')
        .select('*')
        .in('product_id', productIds)
        .order('sort_order');
      relationships = r.data || [];
    }

    const payRule = resolvePaymentRule({ system: system });
    const depositPreview = computeDepositRequired(payRule, {
      known_subtotal_cents: 0,
      has_unknown_prices: true
    });

    const earliest = earliestPickupDate(system.timezone || 'Australia/Sydney', products || []);
    const windows = await listWindows(system.id);
    const pickup_slots = buildPickupSlots(windows, earliest, 28);
    const paySettings = (system.settings && system.settings.payments) || {};
    const storefrontSettings = Object.assign(
      {
        show_all_categories: false,
        default_category_id: null,
        default_category_slug: null,
        shop_mode: 'traditional',
        appearance: {}
      },
      (system.settings && system.settings.storefront) || {}
    );
    if (storefrontSettings.shop_mode !== 'fast') storefrontSettings.shop_mode = 'traditional';

    const { packLabel, isPackSize, quantityPrompt } = require('../../lib/order/product-options');
    const displayProducts = (products || []).map(function (p) {
      return Object.assign({}, p, {
        pack_label: packLabel(p) || null,
        is_pack_size: isPackSize(p),
        quantity_prompt: quantityPrompt(p) || null,
        display_price:
          p.pricing_method === 'price_tbc' || p.pricing_method === 'quote_required'
            ? 'Price TBC'
            : p.price_label
              ? p.price_label
              : p.pricing_method === 'per_weight'
                ? formatAud(p.price_per_kg_cents) + '/kg'
                : p.pricing_method === 'from_price'
                  ? 'From ' + formatAud(p.price_cents)
                  : p.pricing_method === 'estimated'
                    ? 'Approx. ' + formatAud(p.price_cents)
                    : formatAud(p.price_cents),
        questions: questions.filter(function (q) {
          return q.product_id === p.id;
        }),
        related: relationships.filter(function (r) {
          return r.product_id === p.id;
        })
      });
    });

    // Only expose categories that have at least one active product.
    const productCatIds = {};
    displayProducts.forEach(function (p) {
      if (p.category_id) productCatIds[p.category_id] = true;
    });
    const visibleCategories = (categories || []).filter(function (c) {
      return productCatIds[c.id];
    });

    return json(res, 200, {
      site: { id: site.id, slug: site.slug, business_name: site.business_name },
      system: {
        id: system.id,
        enabled: system.enabled,
        industry_preset: system.industry_preset,
        currency: system.currency,
        timezone: system.timezone,
        pickup_enabled: system.pickup_enabled,
        delivery_enabled: system.delivery_enabled,
        storefront_display_mode: system.storefront_display_mode,
        cross_sell_heading: system.cross_sell_heading,
        payment_rule: system.payment_rule,
        deposit_amount_cents: system.deposit_amount_cents,
        deposit_scope: system.deposit_scope,
        balance_settlement: system.balance_settlement,
        capacity_enabled: system.capacity_enabled,
        capacity_per_day: system.capacity_per_day,
        customer_editing_enabled: system.customer_editing_enabled,
        has_pickup_windows: pickup_slots.length > 0,
        storefront: storefrontSettings,
        payments: {
          provider: paySettings.provider || 'stripe',
          stripe_connected: !!(paySettings.stripe_connect_account_id || '').trim(),
          paypal_configured: !!(paySettings.paypal_client_id || '').trim()
        }
      },
      categories: visibleCategories,
      products: displayProducts,
      deposit: {
        rule: payRule,
        preview_cents: depositPreview.deposit_required_cents,
        preview_label: formatAud(depositPreview.deposit_required_cents),
        cta:
          depositPreview.deposit_required_cents > 0
            ? 'Review & pay deposit'
            : 'CONFIRM ORDER'
      },
      earliest_pickup_date: earliest,
      pickup_slots: pickup_slots,
      capacity: system.capacity_enabled
        ? await isDateAvailable(system, earliest)
        : { ok: true }
    });
  } catch (e) {
    console.error('order/storefront', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
