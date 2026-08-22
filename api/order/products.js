'use strict';

const { readBody, json, methodOk, clean } = require('../../lib/order/http');
const { requireUser, assertSiteAccess, ensureOrderSystem } = require('../../lib/order/auth');
const { getAdmin } = require('../../lib/order/supabase');
const { slugify } = require('../../lib/order/service');
const { writeAudit } = require('../../lib/order/audit');
const { buildProductOptionsPatch, slugKey, normaliseChoice } = require('../../lib/order/product-options');

async function syncProductQuestions(admin, siteId, productId, questionsIn) {
  if (!Array.isArray(questionsIn)) return [];
  const { data: existing } = await admin
    .from('order_product_questions')
    .select('id,key')
    .eq('product_id', productId);
  const keepKeys = {};
  const saved = [];
  for (var i = 0; i < questionsIn.length; i++) {
    var q = questionsIn[i] || {};
    var label = clean(q.label, 120);
    if (!label) continue;
    var fieldType = q.field_type === 'checkboxes' ? 'checkboxes' : q.field_type === 'dropdown' ? 'dropdown' : 'radio';
    var key = clean(q.key, 60) || slugKey(label, 'opt_' + (i + 1));
    keepKeys[key] = true;
    var choices = (Array.isArray(q.options) ? q.options : [])
      .map(normaliseChoice)
      .filter(Boolean);
    var row = {
      product_id: productId,
      site_id: siteId,
      key: key,
      label: label,
      field_type: fieldType,
      required: !!q.required,
      options: choices,
      sort_order: q.sort_order != null ? Number(q.sort_order) : i,
      staff_only: !!q.staff_only
    };
    var prior = (existing || []).find(function (e) {
      return e.key === key;
    });
    if (prior) {
      var u = await admin
        .from('order_product_questions')
        .update(row)
        .eq('id', prior.id)
        .select('*')
        .single();
      if (u.error) throw u.error;
      saved.push(u.data);
    } else {
      var ins = await admin.from('order_product_questions').insert(row).select('*').single();
      if (ins.error) throw ins.error;
      saved.push(ins.data);
    }
  }
  for (var j = 0; j < (existing || []).length; j++) {
    if (!keepKeys[existing[j].key]) {
      await admin.from('order_product_questions').delete().eq('id', existing[j].id);
    }
  }
  return saved;
}

module.exports = async function (req, res) {
  try {
    if (!methodOk(req, res, ['GET', 'POST', 'PATCH', 'DELETE'])) return;
    const user = await requireUser(req);
    if (!user) return json(res, 401, { error: 'auth' });
    const body = req.method === 'GET' || req.method === 'DELETE' ? {} : await readBody(req);
    const siteId = (req.query && req.query.site_id) || body.site_id;
    const access = await assertSiteAccess(user, siteId);
    if (!access.ok) return json(res, access.code, { error: access.error });
    const system = await ensureOrderSystem(siteId);
    const admin = getAdmin();

    if (req.method === 'GET') {
      const id = req.query && req.query.id;
      if (id) {
        const { data, error } = await admin.from('order_products').select('*').eq('id', id).eq('site_id', siteId).maybeSingle();
        if (error) throw error;
        if (!data) return json(res, 404, { error: 'not_found' });
        const { data: questions } = await admin
          .from('order_product_questions')
          .select('*')
          .eq('product_id', id)
          .order('sort_order');
        const { data: rels } = await admin
          .from('order_product_relationships')
          .select('*')
          .eq('product_id', id);
        return json(res, 200, { product: data, questions: questions || [], relationships: rels || [] });
      }
      let q = admin
        .from('order_products')
        .select('*')
        .eq('order_system_id', system.id)
        .order('sort_order')
        .order('name');
      if (req.query && req.query.active === '1') q = q.eq('active', true);
      if (req.query && req.query.q) q = q.ilike('name', '%' + String(req.query.q).slice(0, 80) + '%');
      const { data, error } = await q;
      if (error) throw error;
      const { data: categories } = await admin
        .from('order_categories')
        .select('*')
        .eq('order_system_id', system.id)
        .order('sort_order');
      return json(res, 200, { products: data || [], categories: categories || [] });
    }

    if (req.method === 'POST' && body.action === 'upsert_category') {
      const name = clean(body.name, 120);
      if (!name) return json(res, 400, { error: 'name_required' });
      const row = {
        order_system_id: system.id,
        site_id: siteId,
        name: name,
        slug: body.slug ? clean(body.slug, 80) : slugify(name),
        description: body.description || null,
        sort_order: body.sort_order || 0,
        active: body.active !== false
      };
      let data;
      if (body.id) {
        const r = await admin.from('order_categories').update(row).eq('id', body.id).eq('site_id', siteId).select('*').single();
        if (r.error) throw r.error;
        data = r.data;
      } else {
        const r = await admin.from('order_categories').insert(row).select('*').single();
        if (r.error) throw r.error;
        data = r.data;
      }
      return json(res, 200, { category: data });
    }

    if (req.method === 'POST' && body.action === 'auto_categorise') {
      const { autoCategoriseProducts } = require('../../lib/order/butcher-categories');
      const result = await autoCategoriseProducts(admin, system, access.site, {
        onlyUncategorised: body.only_uncategorised !== false
      });
      await writeAudit({
        order_system_id: system.id,
        site_id: siteId,
        event_type: 'products_auto_categorised',
        actor_user_id: user.id,
        source: 'admin',
        payload: result.stats
      });
      return json(res, 200, { ok: true, stats: result.stats });
    }

    if (req.method === 'POST' && body.action === 'assign_additional_by_match') {
      const { assignAdditionalCategoryByNameMatch } = require('../../lib/order/product-categories');
      const result = await assignAdditionalCategoryByNameMatch(admin, system, access.site, {
        category_name: body.category_name || 'Pies',
        name_contains: body.name_contains || 'pie',
        slug: body.slug || 'pies'
      });
      await writeAudit({
        order_system_id: system.id,
        site_id: siteId,
        event_type: 'products_additional_category_assigned',
        actor_user_id: user.id,
        source: 'admin',
        payload: result.stats
      });
      return json(res, 200, { ok: true, category: result.category, stats: result.stats });
    }

    if (req.method === 'POST' && body.action === 'migrate_weight_settings') {
      const { backfillProductWeightSettings } = require('../../lib/order/backfill-product-weight');
      const stats = await backfillProductWeightSettings({
        site_id: siteId,
        order_system_id: system.id,
        dry_run: !!body.dry_run
      });
      if (!body.dry_run) {
        await writeAudit({
          order_system_id: system.id,
          site_id: siteId,
          event_type: 'products_weight_settings_migrated',
          actor_user_id: user.id,
          source: 'admin',
          payload: stats
        });
      }
      return json(res, 200, { ok: true, stats: stats });
    }

    if (req.method === 'POST' && body.action === 'deactivate_unsized_hams') {
      const { deactivateUnsizedHamProducts } = require('../../lib/order/deactivate-unsized-hams');
      const stats = await deactivateUnsizedHamProducts({
        site_id: siteId,
        order_system_id: system.id,
        dry_run: !!body.dry_run
      });
      if (!body.dry_run) {
        await writeAudit({
          order_system_id: system.id,
          site_id: siteId,
          event_type: 'products_unsized_hams_deactivated',
          actor_user_id: user.id,
          source: 'admin',
          payload: stats
        });
      }
      return json(res, 200, { ok: true, stats: stats });
    }

    if (req.method === 'POST') {
      const name = clean(body.name, 200);
      if (!name) return json(res, 400, { error: 'name_required' });
      const options = buildProductOptionsPatch(body);
      const sizePack = options.size_mode === 'pack';
      const sizeEach = options.size_mode === 'each';
      const row = {
        order_system_id: system.id,
        site_id: siteId,
        category_id: body.category_id || null,
        name: name,
        slug: body.slug ? clean(body.slug, 80) : slugify(name),
        description: body.description || null,
        short_description: body.short_description || null,
        sku: body.sku || null,
        image_url: body.image_url || null,
        gallery: Array.isArray(body.gallery) ? body.gallery : [],
        tags: Array.isArray(body.tags) ? body.tags : [],
        active: body.active !== false,
        featured: !!body.featured,
        sort_order: body.sort_order || 0,
        pricing_method: body.pricing_method || 'fixed',
        price_cents: body.price_cents != null ? body.price_cents : null,
        price_per_kg_cents: body.price_per_kg_cents != null ? body.price_per_kg_cents : null,
        price_label: body.price_label || null,
        stock_method: body.stock_method || system.default_stock_method || 'unlimited',
        stock_qty: body.stock_qty != null ? body.stock_qty : null,
        stock_low_threshold: body.stock_low_threshold != null ? body.stock_low_threshold : null,
        allow_backorder: !!body.allow_backorder,
        max_per_order: body.max_per_order != null ? body.max_per_order : null,
        allocation_qty: body.allocation_qty != null ? body.allocation_qty : null,
        cutoff_mode: body.cutoff_mode || 'store_default',
        cutoff_value: body.cutoff_value != null ? body.cutoff_value : null,
        cutoff_at: body.cutoff_at || null,
        lead_time_mode: body.lead_time_mode || 'none',
        lead_time_value: body.lead_time_value || 0,
        payment_rule: body.payment_rule || null,
        deposit_amount_cents: body.deposit_amount_cents != null ? body.deposit_amount_cents : null,
        deposit_percent_bps: body.deposit_percent_bps != null ? body.deposit_percent_bps : null,
        unit_label: body.unit_label || null,
        weight_required: sizePack || sizeEach ? false : !!body.weight_required,
        options: options
      };
      const { data, error } = await admin.from('order_products').insert(row).select('*').single();
      if (error) throw error;
      let questions = [];
      if (Array.isArray(body.questions)) {
        questions = await syncProductQuestions(admin, siteId, data.id, body.questions);
      }
      await writeAudit({
        order_system_id: system.id,
        site_id: siteId,
        event_type: 'product_created',
        actor_user_id: user.id,
        source: 'admin',
        payload: { product_id: data.id, name: data.name }
      });
      return json(res, 200, { product: data, questions: questions });
    }

    if (req.method === 'PATCH') {
      const id = body.id || (req.query && req.query.id);
      if (!id) return json(res, 400, { error: 'id_required' });
      const patch = { updated_at: new Date().toISOString() };
      [
        'category_id', 'name', 'slug', 'description', 'short_description', 'sku', 'image_url', 'gallery', 'tags',
        'active', 'featured', 'sort_order', 'pricing_method', 'price_cents', 'price_per_kg_cents', 'price_label',
        'stock_method', 'stock_qty', 'stock_low_threshold', 'allow_backorder', 'max_per_order', 'allocation_qty',
        'cutoff_mode', 'cutoff_value', 'cutoff_at', 'lead_time_mode', 'lead_time_value',
        'payment_rule', 'deposit_amount_cents', 'deposit_percent_bps', 'unit_label', 'weight_required', 'options'
      ].forEach(function (k) {
        if (body[k] !== undefined) patch[k] = body[k];
      });
      if (
        body.size_mode !== undefined ||
        body.pack_weight_kg !== undefined ||
        body.pack_label !== undefined ||
        body.minimum_kg !== undefined ||
        body.quantity_prompt !== undefined ||
        body.additional_category_ids !== undefined ||
        body.options !== undefined
      ) {
        const { data: cur } = await admin
          .from('order_products')
          .select('options')
          .eq('id', id)
          .eq('site_id', siteId)
          .maybeSingle();
        patch.options = buildProductOptionsPatch(
          Object.assign({}, cur && cur.options, body, {
            options: body.options || (cur && cur.options) || {},
            category_id: body.category_id !== undefined ? body.category_id : patch.category_id
          })
        );
        if (patch.options.size_mode === 'pack' || patch.options.size_mode === 'each') {
          patch.weight_required = false;
        }
      } else if (body.minimum_kg !== undefined) {
        const { data: cur } = await admin
          .from('order_products')
          .select('options')
          .eq('id', id)
          .eq('site_id', siteId)
          .maybeSingle();
        patch.options = buildProductOptionsPatch(
          Object.assign({}, cur && cur.options, body, {
            options: (cur && cur.options) || {}
          })
        );
      } else if (body.category_id !== undefined && body.additional_category_ids === undefined) {
        // Primary category changed alone — drop it from additional list if present
        const { data: cur } = await admin
          .from('order_products')
          .select('options')
          .eq('id', id)
          .eq('site_id', siteId)
          .maybeSingle();
        if (cur && cur.options) {
          const { applyAdditionalCategoriesToOptions } = require('../../lib/order/product-categories');
          patch.options = applyAdditionalCategoriesToOptions(cur.options, {
            category_id: body.category_id,
            additional_category_ids: (cur.options.additional_category_ids || []).slice()
          });
        }
      }
      const { data, error } = await admin
        .from('order_products')
        .update(patch)
        .eq('id', id)
        .eq('site_id', siteId)
        .select('*')
        .single();
      if (error) throw error;
      let questions;
      if (Array.isArray(body.questions)) {
        questions = await syncProductQuestions(admin, siteId, data.id, body.questions);
      }
      return json(res, 200, { product: data, questions: questions });
    }

    if (req.method === 'DELETE') {
      const id = req.query && req.query.id;
      if (!id) return json(res, 400, { error: 'id_required' });
      const { error } = await admin
        .from('order_products')
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('site_id', siteId);
      if (error) throw error;
      return json(res, 200, { ok: true });
    }
  } catch (e) {
    console.error('order/products', e);
    return json(res, 500, { error: String((e && e.message) || e) });
  }
};
