'use strict';

const { readBody, json, methodOk } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem, getOrderSystemForSite } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { listPresets, getPreset } = require('../../lib/order/presets');
const { writeAudit } = require('../../lib/order/audit');
const { slugify } = require('../../lib/order/service');
const { mergeStorefront, normalizeCutoffMode } = require('../../lib/order/storefront-appearance');

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST', 'PATCH'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });

    if (req.method === 'GET' && (req.query && req.query.presets === '1')) {
      return json(res, 200, { presets: listPresets() });
    }

    const body = req.method === 'GET' ? {} : await readBody(req);
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });

    if (req.method === 'GET') {
      let system = await getOrderSystemForSite(siteId);
      if (!system) system = await ensureOrderSystem(siteId, { preset: 'custom' });
      return json(res, 200, { system: system, site: access.site, role: access.role });
    }

    if (req.method === 'POST' && body.action === 'apply_preset') {
      const preset = getPreset(body.preset || 'butcher');
      const defaults = Object.assign({}, preset.defaults, { industry_preset: preset.industry_preset });
      let system = await getOrderSystemForSite(siteId);
      const admin = getAdmin();
      if (!system) {
        system = await ensureOrderSystem(siteId, { preset: preset.industry_preset, defaults: defaults });
      } else {
        const { data, error } = await admin
          .from('order_systems')
          .update(Object.assign({}, defaults, { updated_at: new Date().toISOString() }))
          .eq('id', system.id)
          .select('*')
          .single();
        if (error) throw error;
        system = data;
      }

      // Seed sample categories/products for butcher (only if empty)
      const { count } = await admin
        .from('order_products')
        .select('id', { count: 'exact', head: true })
        .eq('order_system_id', system.id);
      if ((!count || count === 0) && Array.isArray(preset.sample_categories)) {
        const catMap = {};
        for (const c of preset.sample_categories) {
          const { data: cat } = await admin
            .from('order_categories')
            .insert({
              order_system_id: system.id,
              site_id: siteId,
              name: c.name,
              slug: c.slug || slugify(c.name)
            })
            .select('*')
            .single();
          if (cat) catMap[c.slug] = cat.id;
        }
        for (const p of preset.sample_products || []) {
          await admin.from('order_products').insert({
            order_system_id: system.id,
            site_id: siteId,
            category_id: catMap[p.category_slug] || null,
            name: p.name,
            slug: p.slug || slugify(p.name),
            short_description: p.short_description || null,
            pricing_method: p.pricing_method,
            price_cents: p.price_cents != null ? p.price_cents : null,
            price_per_kg_cents: p.price_per_kg_cents != null ? p.price_per_kg_cents : null,
            weight_required: !!p.weight_required,
            stock_method: p.stock_method || 'made_to_order',
            cutoff_mode: p.cutoff_mode || 'store_default',
            cutoff_value: p.cutoff_value != null ? p.cutoff_value : null,
            lead_time_mode: p.lead_time_mode || 'none',
            lead_time_value: p.lead_time_value || 0,
            unit_label: p.unit_label || null,
            active: true
          });
        }
        for (const t of preset.sample_templates || []) {
          await admin.from('order_message_templates').insert({
            order_system_id: system.id,
            site_id: siteId,
            category: t.category,
            name: t.name,
            channel: t.channel || 'sms',
            body: t.body,
            industry: preset.industry_preset,
            active: true
          });
        }
      }

      await writeAudit({
        order_system_id: system.id,
        site_id: siteId,
        event_type: 'preset_applied',
        actor_user_id: user.id,
        actor_label: user.email,
        source: 'admin',
        payload: { preset: preset.industry_preset }
      });
      return json(res, 200, { system: system, preset: preset.industry_preset });
    }

    if (req.method === 'POST' && body.action === 'save_storefront') {
      let system = await getOrderSystemForSite(siteId);
      if (!system) system = await ensureOrderSystem(siteId, { preset: 'custom' });
      const existing = (system.settings && typeof system.settings === 'object') ? system.settings : {};
      const patchStorefront = body.storefront && typeof body.storefront === 'object' ? body.storefront : {};
      const settings = Object.assign({}, existing, {
        storefront: mergeStorefront(existing.storefront, patchStorefront)
      });
      const admin = getAdmin();
      const { data, error } = await admin
        .from('order_systems')
        .update({ settings: settings, updated_at: new Date().toISOString() })
        .eq('id', system.id)
        .select('*')
        .single();
      if (error) throw error;
      return json(res, 200, { system: data });
    }

    // PATCH / update settings
    const system = await getOrderSystemForSite(siteId);
    if (!system) return json(res, 404, { error: 'no_system' });
    const allowed = [
      'enabled', 'order_prefix', 'timezone', 'currency',
      'pickup_enabled', 'delivery_enabled',
      'customer_editing_enabled', 'change_mode',
      'default_cutoff_mode', 'default_cutoff_value', 'default_cutoff_time', 'default_cutoff_weekday',
      'payment_rule', 'deposit_amount_cents', 'deposit_percent_bps', 'deposit_scope', 'balance_settlement',
      'default_stock_method',
      'abandoned_cart_enabled', 'abandoned_cart_delay_minutes', 'abandoned_cart_channels',
      'storefront_display_mode', 'cross_sell_heading',
      'capacity_enabled', 'capacity_per_day', 'settings', 'industry_preset'
    ];
    const patch = { updated_at: new Date().toISOString() };
    allowed.forEach(function (k) {
      if (body[k] !== undefined) patch[k] = body[k];
    });
    if (patch.default_cutoff_mode !== undefined) {
      patch.default_cutoff_mode = normalizeCutoffMode(patch.default_cutoff_mode);
    }
    if (body.settings && typeof body.settings === 'object') {
      const prev = (system.settings && typeof system.settings === 'object') ? system.settings : {};
      const next = Object.assign({}, prev, body.settings);
      if (body.settings.storefront && typeof body.settings.storefront === 'object') {
        next.storefront = mergeStorefront(prev.storefront, body.settings.storefront);
      }
      patch.settings = next;
    }
    const admin = getAdmin();
    const { data, error } = await admin
      .from('order_systems')
      .update(patch)
      .eq('id', system.id)
      .select('*')
      .single();
    if (error) throw error;
    return json(res, 200, { system: data });
  } catch (e) {
    console.error('order/system', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
