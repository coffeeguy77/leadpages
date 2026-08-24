'use strict';

const { getAdmin } = require('./supabase');
const { estimateSegments, normalizeSmsKind } = require('./sms-kind');

/**
 * Record a billable (or skipped) SMS for client invoicing.
 */
async function recordSmsUsage(opts) {
  const admin = getAdmin();
  if (!opts || !opts.order_system_id || !opts.site_id || !opts.destination) return null;
  var row = {
    order_system_id: opts.order_system_id,
    site_id: opts.site_id,
    customer_id: opts.customer_id || null,
    order_id: opts.order_id || null,
    message_id: opts.message_id || null,
    kind: normalizeSmsKind(opts.kind),
    destination: String(opts.destination),
    segments: Math.max(1, Number(opts.segments) || estimateSegments(opts.body || '')),
    billable: opts.billable !== false && opts.status === 'sent',
    provider_id: opts.provider_id || null,
    status: opts.status || 'sent',
    meta: opts.meta || {}
  };
  var { data, error } = await admin.from('order_sms_usage').insert(row).select('*').single();
  if (error) {
    console.error('order_sms_usage', error);
    return null;
  }
  return data;
}

/**
 * Backfill usage rows from sent order_messages missing in order_sms_usage.
 * Idempotent via message_id — repairs historical sends before kind normalization fix.
 */
async function backfillSmsUsageFromMessages(systemId, siteId, opts) {
  const admin = getAdmin();
  opts = opts || {};
  var limit = opts.limit || 2000;
  var { data: messages, error } = await admin
    .from('order_messages')
    .select(
      'id, order_system_id, site_id, customer_id, order_id, event_type, destination, body, status, provider_id'
    )
    .eq('order_system_id', systemId)
    .eq('site_id', siteId)
    .eq('channel', 'sms')
    .eq('status', 'sent')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!messages || !messages.length) return 0;

  var ids = messages.map(function (m) {
    return m.id;
  });
  var { data: existing, error: exErr } = await admin
    .from('order_sms_usage')
    .select('message_id')
    .in('message_id', ids);
  if (exErr) throw exErr;
  var have = Object.create(null);
  (existing || []).forEach(function (r) {
    if (r.message_id) have[r.message_id] = true;
  });

  var inserted = 0;
  for (var i = 0; i < messages.length; i++) {
    var m = messages[i];
    if (have[m.id]) continue;
    var row = await recordSmsUsage({
      order_system_id: m.order_system_id,
      site_id: m.site_id,
      customer_id: m.customer_id || null,
      order_id: m.order_id || null,
      message_id: m.id,
      kind: normalizeSmsKind(m.event_type),
      destination: m.destination,
      segments: estimateSegments(m.body),
      body: m.body,
      provider_id: m.provider_id || null,
      status: 'sent',
      billable: true,
      meta: { backfilled: true, event_type: m.event_type }
    });
    if (row) inserted += 1;
  }
  return inserted;
}

async function smsUsageSummary(systemId, siteId, opts) {
  const admin = getAdmin();
  opts = opts || {};
  if (opts.backfill !== false) {
    try {
      await backfillSmsUsageFromMessages(systemId, siteId, { limit: opts.backfill_limit || 2000 });
    } catch (e) {
      console.error('order_sms_usage backfill', e);
    }
  }
  var since = opts.since || null;
  var q = admin
    .from('order_sms_usage')
    .select('id, kind, segments, billable, status, created_at')
    .eq('order_system_id', systemId)
    .eq('site_id', siteId)
    .order('created_at', { ascending: false })
    .limit(opts.limit || 5000);
  if (since) q = q.gte('created_at', since);
  var { data, error } = await q;
  if (error) throw error;
  var rows = data || [];
  var byKind = {};
  var billableSegments = 0;
  var sent = 0;
  var failed = 0;
  rows.forEach(function (r) {
    byKind[r.kind] = (byKind[r.kind] || 0) + (r.billable ? r.segments : 0);
    if (r.billable) billableSegments += r.segments || 0;
    if (r.status === 'sent') sent += 1;
    if (r.status === 'failed') failed += 1;
  });
  return {
    count: rows.length,
    sent: sent,
    failed: failed,
    billable_segments: billableSegments,
    by_kind: byKind,
    recent: rows.slice(0, opts.recent || 25)
  };
}

module.exports = {
  estimateSegments,
  normalizeSmsKind,
  recordSmsUsage,
  backfillSmsUsageFromMessages,
  smsUsageSummary
};
