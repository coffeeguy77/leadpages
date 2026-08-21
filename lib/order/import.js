'use strict';

/**
 * CSV import commit — customers / products / order history.
 * Parsing/mapping lives in import-parse.js (unit-testable without Supabase).
 */

const { normaliseAuPhone } = require('./phone');
const { getAdmin } = require('./supabase');
const { priceLineAtOrder, computeOrderTotals } = require('./pricing');
const { resolvePaymentRule, computeDepositRequired } = require('./deposit');
const parse = require('./import-parse');
const { guessButcherCategorySlug, ensureButcherCategories } = require('./butcher-categories');

const {
  CUSTOMER_FIELDS,
  PRODUCT_FIELDS,
  ORDER_HISTORY_FIELDS,
  PRESET_BUTCHER_LINE_ITEMS,
  parseCsv,
  parseAuDate,
  parseMoneyToCents,
  parseQty,
  cleanOrderNumber,
  mapRow,
  fullName,
  fieldsForKind,
  previewImport,
  groupOrderHistoryRows
} = parse;

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'item';
}

function rememberCustomer(cache, customer) {
  if (!cache || !customer) return customer;
  if (customer.phone_e164) cache.byPhone[customer.phone_e164] = customer;
  if (customer.id) cache.byId[customer.id] = customer;
  return customer;
}

function rememberProduct(cache, product) {
  if (!cache || !product) return product;
  var key = String(product.name || '')
    .trim()
    .toLowerCase();
  if (key) cache.byName[key] = product;
  if (product.slug) cache.bySlug[product.slug] = product;
  return product;
}

async function loadImportCaches(admin, system, site) {
  var cache = {
    byPhone: Object.create(null),
    byId: Object.create(null),
    byName: Object.create(null),
    bySlug: Object.create(null),
    categoryBySlug: Object.create(null)
  };
  var { data: customers } = await admin
    .from('order_customers')
    .select('*')
    .eq('order_system_id', system.id)
    .limit(20000);
  (customers || []).forEach(function (c) {
    rememberCustomer(cache, c);
  });
  var { data: products } = await admin
    .from('order_products')
    .select('*')
    .eq('order_system_id', system.id)
    .limit(10000);
  (products || []).forEach(function (p) {
    rememberProduct(cache, p);
  });
  if (site) {
    try {
      cache.categoryBySlug = await ensureButcherCategories(admin, system, site);
    } catch (_e) {
      cache.categoryBySlug = Object.create(null);
    }
  }
  return cache;
}

function resolveCategoryId(cache, productName, mappedCategory) {
  if (mappedCategory && cache && cache.categoryBySlug) {
    var want = String(mappedCategory)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-');
    if (cache.categoryBySlug[want]) return cache.categoryBySlug[want].id;
    var keys = Object.keys(cache.categoryBySlug);
    for (var i = 0; i < keys.length; i++) {
      var row = cache.categoryBySlug[keys[i]];
      if (row && String(row.name || '').toLowerCase() === String(mappedCategory).trim().toLowerCase()) {
        return row.id;
      }
    }
  }
  var slug = guessButcherCategorySlug(productName);
  if (slug && cache && cache.categoryBySlug && cache.categoryBySlug[slug]) {
    return cache.categoryBySlug[slug].id;
  }
  return null;
}

function importBudgetMs() {
  var n = parseInt(process.env.ORDER_IMPORT_BUDGET_MS, 10);
  if (isFinite(n) && n >= 5000 && n <= 55000) return n;
  // Leave headroom under Vercel maxDuration (60s) / gateway 504.
  return 40000;
}

async function upsertCustomer(admin, system, site, mapped, cache) {
  var name = fullName(mapped);
  var phone = mapped.phone || '';
  var e164 = normaliseAuPhone(phone);
  if (!name && !e164) return { skipped: true, reason: 'no_name_or_phone' };

  if (e164) {
    var existing = cache && cache.byPhone[e164] ? cache.byPhone[e164] : null;
    if (!existing) {
      var found = await admin
        .from('order_customers')
        .select('*')
        .eq('order_system_id', system.id)
        .eq('phone_e164', e164)
        .maybeSingle();
      existing = found.data || null;
      if (existing) rememberCustomer(cache, existing);
    }
    if (existing) {
      var patch = {
        updated_at: new Date().toISOString()
      };
      if (name && name !== existing.name) patch.name = name;
      if (phone) patch.phone = phone;
      if (mapped.email) patch.email = mapped.email;
      if (mapped.notes) patch.notes = mapped.notes;
      if (mapped.external_ref) patch.external_ref = mapped.external_ref;
      var needsUpdate = Object.keys(patch).length > 1;
      if (!needsUpdate) return { customer: existing, created: false };
      var { data: updated, error } = await admin
        .from('order_customers')
        .update(patch)
        .eq('id', existing.id)
        .select('*')
        .single();
      if (error) throw error;
      rememberCustomer(cache, updated);
      return { customer: updated, created: false };
    }
  }

  var insert = {
    order_system_id: system.id,
    site_id: site.id,
    name: name || 'Customer',
    phone: phone || null,
    phone_e164: e164 || null,
    email: mapped.email || null,
    notes: mapped.notes || null,
    external_ref: mapped.external_ref || null,
    sms_opt_in: true
  };
  var { data: created, error: cErr } = await admin.from('order_customers').insert(insert).select('*').single();
  if (cErr) throw cErr;
  rememberCustomer(cache, created);
  return { customer: created, created: true };
}

async function upsertProduct(admin, system, site, mapped, createMissing, cache) {
  var name = String(mapped.name || mapped.product_name || '').trim();
  if (!name) return { skipped: true, reason: 'no_name' };
  var slug = slugify(name);
  var nameKey = name.toLowerCase();
  var existing =
    (cache && (cache.byName[nameKey] || cache.bySlug[slug])) || null;
  if (!existing) {
    var { data: existingList } = await admin
      .from('order_products')
      .select('*')
      .eq('order_system_id', system.id)
      .ilike('name', name)
      .limit(1);
    existing = (existingList && existingList[0]) || null;
    if (!existing) {
      var { data: bySlug } = await admin
        .from('order_products')
        .select('*')
        .eq('order_system_id', system.id)
        .eq('slug', slug)
        .maybeSingle();
      existing = bySlug || null;
    }
    if (existing) rememberProduct(cache, existing);
  }
  if (existing) {
    // Backfill category on imported products that were created before categorisation.
    if (!existing.category_id) {
      var backfillId = resolveCategoryId(cache, name, mapped.category);
      if (backfillId) {
        var { data: patched } = await admin
          .from('order_products')
          .update({ category_id: backfillId, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select('*')
          .single();
        if (patched) {
          existing = patched;
          rememberProduct(cache, existing);
        }
      }
    }
    return { product: existing, created: false };
  }

  if (createMissing === false) return { skipped: true, reason: 'product_not_found', name: name };

  var priceCents = parseMoneyToCents(mapped.price_cents);
  var perKg = parseMoneyToCents(mapped.price_per_kg_cents);
  var method = String(mapped.pricing_method || '').trim();
  if (method === 'per_kg' || method === 'per_weight') method = 'per_weight';
  else if (method === 'tbc' || method === 'price_tbc') method = 'price_tbc';
  else if (method === 'quote' || method === 'quote_required') method = 'quote_required';
  else if (method === 'fixed' || method === 'per_unit' || method === 'estimated' || method === 'from_price') {
    /* keep */
  } else {
    method = perKg != null ? 'per_weight' : priceCents != null ? 'fixed' : 'price_tbc';
  }

  var insert = {
    order_system_id: system.id,
    site_id: site.id,
    category_id: resolveCategoryId(cache, name, mapped.category),
    name: name,
    slug: slug,
    sku: mapped.sku || null,
    short_description: mapped.short_description || mapped.size_weight || null,
    pricing_method: method,
    price_cents: priceCents,
    price_per_kg_cents: perKg,
    active: true,
    sort_order: 0
  };
  var { data: created, error } = await admin.from('order_products').insert(insert).select('*').single();
  if (error) {
    insert.slug = slug + '-' + Date.now().toString(36).slice(-4);
    var retry = await admin.from('order_products').insert(insert).select('*').single();
    if (retry.error) throw retry.error;
    rememberProduct(cache, retry.data);
    return { product: retry.data, created: true };
  }
  rememberProduct(cache, created);
  return { product: created, created: true };
}

async function commitCustomers(opts) {
  var admin = getAdmin();
  var system = opts.system;
  var site = opts.site;
  var rows = opts.rows;
  var mapping = opts.mapping;
  var hasHeader = !!opts.has_header;
  var start = hasHeader ? 1 : 0;
  var offset = Math.max(0, parseInt(opts.offset, 10) || 0);
  var limit = parseInt(opts.limit, 10);
  if (!isFinite(limit) || limit <= 0) limit = rows.length;
  limit = Math.min(limit, 150);
  var from = start + offset;
  var to = Math.min(rows.length, from + limit);
  var stats = { created: 0, updated: 0, skipped: 0, errors: [] };
  var cache = await loadImportCaches(admin, system, site);
  var deadline = Date.now() + importBudgetMs();
  var processed = 0;
  for (var i = from; i < to; i++) {
    if (Date.now() > deadline) break;
    try {
      var mapped = mapRow(rows[i], mapping);
      var res = await upsertCustomer(admin, system, site, mapped, cache);
      if (res.skipped) stats.skipped += 1;
      else if (res.created) stats.created += 1;
      else stats.updated += 1;
    } catch (e) {
      stats.errors.push({ row: i + 1, error: String((e && e.message) || e) });
      if (stats.errors.length > 50) break;
    }
    processed += 1;
  }
  var nextOffset = offset + processed;
  var dataEnd = Math.max(0, rows.length - start);
  return {
    stats: stats,
    next_offset: nextOffset,
    done: nextOffset >= dataEnd,
    progress: { processed: Math.min(nextOffset, dataEnd), total: dataEnd }
  };
}

async function commitProducts(opts) {
  var admin = getAdmin();
  var system = opts.system;
  var site = opts.site;
  var rows = opts.rows;
  var mapping = opts.mapping;
  var hasHeader = !!opts.has_header;
  var start = hasHeader ? 1 : 0;
  var offset = Math.max(0, parseInt(opts.offset, 10) || 0);
  var limit = parseInt(opts.limit, 10);
  if (!isFinite(limit) || limit <= 0) limit = rows.length;
  limit = Math.min(limit, 150);
  var from = start + offset;
  var to = Math.min(rows.length, from + limit);
  var stats = { created: 0, updated: 0, skipped: 0, errors: [] };
  var cache = await loadImportCaches(admin, system, site);
  var deadline = Date.now() + importBudgetMs();
  var processed = 0;
  for (var i = from; i < to; i++) {
    if (Date.now() > deadline) break;
    try {
      var mapped = mapRow(rows[i], mapping);
      if (!mapped.name && mapped.product_name) mapped.name = mapped.product_name;
      var res = await upsertProduct(admin, system, site, mapped, true, cache);
      if (res.skipped) stats.skipped += 1;
      else if (res.created) stats.created += 1;
      else stats.updated += 1;
    } catch (e) {
      stats.errors.push({ row: i + 1, error: String((e && e.message) || e) });
      if (stats.errors.length > 50) break;
    }
    processed += 1;
  }
  var nextOffset = offset + processed;
  var dataEnd = Math.max(0, rows.length - start);
  return {
    stats: stats,
    next_offset: nextOffset,
    done: nextOffset >= dataEnd,
    progress: { processed: Math.min(nextOffset, dataEnd), total: dataEnd }
  };
}

async function commitOrderHistory(opts) {
  var admin = getAdmin();
  var system = opts.system;
  var site = opts.site;
  var rows = opts.rows;
  var mapping = opts.mapping;
  var hasHeader = !!opts.has_header;
  var createMissingProducts = opts.create_missing_products !== false;
  var offset = Math.max(0, parseInt(opts.offset, 10) || 0);
  var limit = parseInt(opts.limit, 10);
  if (!isFinite(limit) || limit <= 0) limit = 12;
  // Small batches: each order does many sequential Supabase calls.
  limit = Math.min(limit, 20);

  var stats = {
    orders_created: 0,
    orders_skipped: 0,
    customers_created: 0,
    customers_updated: 0,
    products_created: 0,
    lines: 0,
    errors: []
  };

  var grouped = groupOrderHistoryRows(rows, mapping, hasHeader, normaliseAuPhone);
  var groups = grouped.groups;
  var keys = grouped.keys;
  var slice = keys.slice(offset, offset + limit);
  var cache = await loadImportCaches(admin, system, site);
  var deadline = Date.now() + importBudgetMs();
  var processed = 0;

  for (var g = 0; g < slice.length; g++) {
    if (Date.now() > deadline) break;
    var group = groups[slice[g]];
    var meta = group.mappedMeta;
    try {
      var custRes = await upsertCustomer(admin, system, site, meta, cache);
      if (custRes.skipped) {
        stats.errors.push({ order: cleanOrderNumber(meta.order_number), error: 'customer_skipped' });
        stats.orders_skipped += 1;
        processed += 1;
        continue;
      }
      if (custRes.created) stats.customers_created += 1;
      else stats.customers_updated += 1;
      var customer = custRes.customer;

      var externalNumber = cleanOrderNumber(meta.order_number);
      if (externalNumber) {
        var { data: existingOrder } = await admin
          .from('order_orders')
          .select('id')
          .eq('order_system_id', system.id)
          .eq('external_order_number', externalNumber)
          .maybeSingle();
        if (existingOrder) {
          stats.orders_skipped += 1;
          processed += 1;
          continue;
        }
      }

      var itemRows = [];
      for (var li = 0; li < group.lines.length; li++) {
        var line = group.lines[li];
        var pname = String(line.product_name || '').trim();
        if (!pname) continue;
        var prodRes = await upsertProduct(
          admin,
          system,
          site,
          {
            name: pname,
            short_description: line.size_weight || '',
            pricing_method: 'price_tbc'
          },
          createMissingProducts,
          cache
        );
        if (prodRes.skipped) continue;
        if (prodRes.created) stats.products_created += 1;
        var product = prodRes.product;
        var qty = parseQty(line.quantity);
        var noteParts = [line.size_weight, line.line_notes].filter(Boolean);
        var priced = priceLineAtOrder(product, qty, null);
        itemRows.push({
          site_id: site.id,
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku || null,
          product_snapshot: {
            id: product.id,
            name: product.name,
            sku: product.sku,
            pricing_method: product.pricing_method,
            imported: true
          },
          pricing_method: product.pricing_method || 'price_tbc',
          unit_label: product.unit_label || null,
          quantity: qty,
          requested_weight_kg: null,
          unit_price_cents: priced.unitPriceCents,
          line_known_cents: priced.lineKnownCents,
          price_status: priced.priceStatus,
          options_snapshot: {},
          notes: noteParts.join(' — ') || null,
          sort_order: li
        });
        stats.lines += 1;
      }

      if (!itemRows.length) {
        stats.orders_skipped += 1;
        processed += 1;
        continue;
      }

      var totals = computeOrderTotals(itemRows);
      var pickup = parseAuDate(meta.pickup_date);
      var createdDay = parseAuDate(meta.order_date) || pickup;
      var depositPaid = parseMoneyToCents(meta.deposit);
      var payRule = resolvePaymentRule({ system: system });
      var deposit = computeDepositRequired(payRule, totals);
      var stamp = createdDay ? createdDay + 'T12:00:00.000Z' : new Date().toISOString();
      var doneAt = pickup ? pickup + 'T12:00:00.000Z' : stamp;

      var orderInsert = {
        order_system_id: system.id,
        site_id: site.id,
        customer_id: customer.id,
        order_number: externalNumber || null,
        external_order_number: externalNumber || null,
        source: 'system',
        // Historical imports are archived: not in the active queue, still reorderable.
        status: 'archived',
        editing_state: 'locked',
        customer_name: customer.name,
        customer_phone: customer.phone,
        customer_email: customer.email,
        pickup_date: pickup,
        known_subtotal_cents: totals.known_subtotal_cents,
        estimated_subtotal_cents: totals.estimated_subtotal_cents,
        final_subtotal_cents: totals.final_subtotal_cents,
        has_unknown_prices: totals.has_unknown_prices,
        price_status: totals.price_status,
        payment_rule_snapshot: payRule || {},
        deposit_required_cents: deposit.deposit_required_cents || 0,
        deposit_paid_cents: depositPaid != null ? depositPaid : 0,
        balance_cents: null,
        internal_notes: 'Imported order history (archived)',
        created_at: stamp,
        confirmed_at: stamp,
        collected_at: doneAt,
        completed_at: doneAt,
        updated_at: new Date().toISOString()
      };

      if (!orderInsert.order_number) {
        var { allocateOrderNumber } = require('./tokens');
        orderInsert.order_number = await allocateOrderNumber(system);
      }

      var { data: order, error: oErr } = await admin.from('order_orders').insert(orderInsert).select('*').single();
      if (oErr) {
        // Fallback if archived status not migrated yet
        if (/archived|status_check|check constraint/i.test(String(oErr.message || oErr))) {
          orderInsert.status = 'completed';
          var retry = await admin.from('order_orders').insert(orderInsert).select('*').single();
          if (retry.error) throw retry.error;
          order = retry.data;
        } else {
          throw oErr;
        }
      }

      var linesWithOrder = itemRows.map(function (r) {
        return Object.assign({}, r, { order_id: order.id });
      });
      var { error: iErr } = await admin.from('order_items').insert(linesWithOrder);
      if (iErr) throw iErr;

      if (depositPaid && depositPaid > 0) {
        await admin.from('order_payments').insert({
          order_id: order.id,
          site_id: site.id,
          kind: 'deposit',
          status: 'paid',
          amount_cents: depositPaid,
          provider: 'import',
          meta: { imported: true, external_order_number: externalNumber || null },
          paid_at: orderInsert.confirmed_at
        });
      }

      var nextCount = (customer.order_count || 0) + 1;
      await admin
        .from('order_customers')
        .update({
          order_count: nextCount,
          last_order_at: orderInsert.created_at,
          updated_at: new Date().toISOString()
        })
        .eq('id', customer.id);
      customer.order_count = nextCount;
      customer.last_order_at = orderInsert.created_at;
      rememberCustomer(cache, customer);

      stats.orders_created += 1;
    } catch (e) {
      stats.errors.push({
        order: cleanOrderNumber(meta.order_number),
        rows: group.rowIndexes.slice(0, 5),
        error: String((e && e.message) || e)
      });
      stats.orders_skipped += 1;
      if (stats.errors.length > 80) {
        processed += 1;
        break;
      }
    }
    processed += 1;
  }

  var nextOffset = offset + processed;
  return {
    stats: stats,
    next_offset: nextOffset,
    done: nextOffset >= keys.length,
    progress: { processed: Math.min(nextOffset, keys.length), total: keys.length }
  };
}

async function commitImport(opts) {
  var kind = opts.kind;
  var rows = Array.isArray(opts.rows) ? opts.rows : parseCsv(opts.csv_text || '');
  var payload = Object.assign({}, opts, { rows: rows });
  var result;
  if (kind === 'customers') result = await commitCustomers(payload);
  else if (kind === 'products') result = await commitProducts(payload);
  else result = await commitOrderHistory(payload);

  var stats = result.stats || result;
  var done = result.done !== false;
  var writeRun = opts.finalize === true || (opts.finalize !== false && done && opts.offset == null && opts.limit == null);

  if (writeRun) {
    var admin = getAdmin();
    await admin.from('order_import_runs').insert({
      order_system_id: opts.system.id,
      site_id: opts.site.id,
      kind: kind,
      filename: opts.filename || null,
      mapping: opts.mapping || {},
      stats: stats,
      status: 'committed',
      created_by: opts.actor_id || null,
      committed_at: new Date().toISOString()
    });
  }

  return {
    stats: stats,
    next_offset: result.next_offset != null ? result.next_offset : null,
    done: done,
    progress: result.progress || null
  };
}

async function finalizeImportRun(opts) {
  var admin = getAdmin();
  await admin.from('order_import_runs').insert({
    order_system_id: opts.system.id,
    site_id: opts.site.id,
    kind: opts.kind,
    filename: opts.filename || null,
    mapping: opts.mapping || {},
    stats: opts.stats || {},
    status: 'committed',
    created_by: opts.actor_id || null,
    committed_at: new Date().toISOString()
  });
  return { ok: true };
}

module.exports = Object.assign({}, parse, {
  commitImport,
  finalizeImportRun,
  upsertCustomer,
  upsertProduct,
  groupOrderHistoryRows,
  importBudgetMs
});
