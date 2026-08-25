'use strict';

const { getAdmin } = require('./supabase');
const { supplyForDate } = require('./service');
const {
  SNAPSHOT_FORMATS,
  isSnapshotFormat,
  buildPrintFingerprint
} = require('./print-fingerprint');
const { writeAudit } = require('./audit');

async function loadOrdersForDate(systemId, siteId, pickupDate) {
  const admin = getAdmin();
  const { data: orders, error } = await admin
    .from('order_orders')
    .select('*')
    .eq('order_system_id', systemId)
    .eq('site_id', siteId)
    .eq('pickup_date', pickupDate)
    .not('status', 'in', '("draft","cancelled","refunded")');
  if (error) throw error;
  const ids = (orders || []).map(function (o) {
    return o.id;
  });
  if (!ids.length) return [];
  const { data: items } = await admin.from('order_items').select('*').in('order_id', ids).order('sort_order');
  const byOrder = {};
  (orders || []).forEach(function (o) {
    byOrder[o.id] = Object.assign({}, o, { items: [] });
  });
  (items || []).forEach(function (it) {
    if (byOrder[it.order_id]) byOrder[it.order_id].items.push(it);
  });
  return Object.keys(byOrder).map(function (k) {
    return byOrder[k];
  });
}

async function currentFingerprint(systemId, siteId, pickupDate, format) {
  const orders = await loadOrdersForDate(systemId, siteId, pickupDate);
  let supply = null;
  if (format === 'prep' || format === 'procurement' || format === 'allocation') {
    supply = await supplyForDate(systemId, siteId, pickupDate);
  }
  return buildPrintFingerprint(format, { orders: orders, supply: supply || {} });
}

async function latestSnapshot(systemId, pickupDate, format) {
  const admin = getAdmin();
  const { data, error } = await admin
    .from('order_print_snapshots')
    .select('*')
    .eq('order_system_id', systemId)
    .eq('pickup_date', pickupDate)
    .eq('format', format)
    .order('printed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function recordPrintSnapshot(opts) {
  const format = String(opts.format || '');
  if (!isSnapshotFormat(format)) {
    throw Object.assign(new Error('invalid_format'), { code: 400 });
  }
  const fp = await currentFingerprint(opts.system.id, opts.site_id, opts.pickup_date, format);
  const admin = getAdmin();
  const row = {
    order_system_id: opts.system.id,
    site_id: opts.site_id,
    pickup_date: opts.pickup_date,
    format: format,
    fingerprint: fp.fingerprint,
    order_count: fp.order_count,
    line_count: fp.line_count,
    payload_summary: fp.payload_summary,
    printed_by: (opts.actor && opts.actor.user_id) || null,
    printed_at: new Date().toISOString()
  };
  const { data, error } = await admin.from('order_print_snapshots').insert(row).select('*').single();
  if (error) throw error;

  try {
    await writeAudit({
      order_system_id: opts.system.id,
      site_id: opts.site_id,
      event_type: 'print_snapshot',
      actor_user_id: (opts.actor && opts.actor.user_id) || null,
      actor_label: (opts.actor && opts.actor.label) || null,
      source: 'admin',
      payload: {
        pickup_date: opts.pickup_date,
        format: format,
        fingerprint: fp.fingerprint,
        order_count: fp.order_count
      }
    });
  } catch (_e) {
    /* best-effort */
  }

  return { snapshot: data, fingerprint: fp.fingerprint, changed: false };
}

async function statusForFormats(opts) {
  const formats = (opts.formats || []).filter(isSnapshotFormat);
  const out = {};
  for (var i = 0; i < formats.length; i++) {
    const format = formats[i];
    const current = await currentFingerprint(opts.system.id, opts.site_id, opts.pickup_date, format);
    const last = await latestSnapshot(opts.system.id, opts.pickup_date, format);
    const changed = !last || last.fingerprint !== current.fingerprint;
    out[format] = {
      format: format,
      changed: changed,
      never_printed: !last,
      last_printed_at: last ? last.printed_at : null,
      last_order_count: last ? last.order_count : null,
      current_order_count: current.order_count,
      current_line_count: current.line_count,
      last_fingerprint: last ? last.fingerprint : null,
      current_fingerprint: current.fingerprint
    };
  }
  return { pickup_date: opts.pickup_date, formats: out };
}

module.exports = {
  SNAPSHOT_FORMATS,
  isSnapshotFormat,
  loadOrdersForDate,
  currentFingerprint,
  latestSnapshot,
  recordPrintSnapshot,
  statusForFormats
};
