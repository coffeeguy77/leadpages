'use strict';

const { getAdmin } = require('./supabase');

/** Rough GSM-7 segment count for billing (160 / 153). */
function estimateSegments(body) {
  var len = String(body || '').length;
  if (len <= 160) return 1;
  return Math.ceil(len / 153);
}

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
    kind: opts.kind || 'transactional',
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

async function smsUsageSummary(systemId, siteId, opts) {
  const admin = getAdmin();
  opts = opts || {};
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
  recordSmsUsage,
  smsUsageSummary
};
