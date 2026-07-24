'use strict';

/**
 * Keep Advertising Overview/Campaigns scoped to the connected Ads customer.
 */

function digits(id) {
  return String(id || '').replace(/\D+/g, '');
}

/**
 * Delete synced Ads rows for this site that belong to a different customer
 * (or all customers when customerId is null/empty).
 * Also drops null/blank customer_id rows — PostgREST `.neq` does not match NULL.
 */
async function purgeStaleAdsMetrics(admin, siteId, keepCustomerId) {
  if (!admin || !siteId) return { ok: false };
  const keep = digits(keepCustomerId);
  try {
    if (!keep) {
      await admin.from('ads_metrics_daily').delete().eq('site_id', siteId);
      await admin.from('ads_keyword_daily').delete().eq('site_id', siteId);
      try {
        await admin.from('ads_campaign_maps').delete().eq('site_id', siteId);
      } catch (_e) { /* optional table */ }
      await admin.from('ads_unmatched_urls').delete().eq('site_id', siteId);
      return { ok: true, mode: 'all' };
    }
    // Other customers' metrics for this site
    await admin.from('ads_metrics_daily').delete().eq('site_id', siteId).neq('customer_id', keep);
    await admin.from('ads_keyword_daily').delete().eq('site_id', siteId).neq('customer_id', keep);
    // NULL / blank customer_id (legacy) — `.neq` does not remove these
    await admin.from('ads_metrics_daily').delete().eq('site_id', siteId).is('customer_id', null);
    await admin.from('ads_keyword_daily').delete().eq('site_id', siteId).is('customer_id', null);
    await admin.from('ads_metrics_daily').delete().eq('site_id', siteId).eq('customer_id', '');
    await admin.from('ads_keyword_daily').delete().eq('site_id', siteId).eq('customer_id', '');
    try {
      await admin.from('ads_campaign_maps').delete().eq('site_id', siteId).neq('customer_id', keep);
      await admin.from('ads_campaign_maps').delete().eq('site_id', siteId).is('customer_id', null);
    } catch (_e) { /* optional table */ }
    return { ok: true, mode: 'other_customers', keep: keep };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

/**
 * When Google returns zero metric rows for the sync window, drop this
 * customer's cached rows in that window (removed campaigns / empty account).
 * Upsert alone never deletes, so Overview would keep showing Coffee Sales etc.
 */
async function clearCustomerMetricsInRange(admin, siteId, customerId, fromDay, toDay) {
  if (!admin || !siteId || !fromDay || !toDay) return { ok: false };
  const cid = digits(customerId);
  if (!cid) return { ok: false };
  try {
    await admin
      .from('ads_metrics_daily')
      .delete()
      .eq('site_id', siteId)
      .eq('customer_id', cid)
      .gte('day', fromDay)
      .lte('day', toDay);
    await admin
      .from('ads_keyword_daily')
      .delete()
      .eq('site_id', siteId)
      .eq('customer_id', cid)
      .gte('day', fromDay)
      .lte('day', toDay);
    return { ok: true, customerId: cid, from: fromDay, to: toDay };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

module.exports = { digits, purgeStaleAdsMetrics, clearCustomerMetricsInRange };
