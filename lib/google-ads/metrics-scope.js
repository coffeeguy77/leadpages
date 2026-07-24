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
      } catch (_e) {}
      await admin.from('ads_unmatched_urls').delete().eq('site_id', siteId);
      return { ok: true, mode: 'all' };
    }
    // Delete other customers' metrics for this site
    await admin.from('ads_metrics_daily').delete().eq('site_id', siteId).neq('customer_id', keep);
    await admin.from('ads_keyword_daily').delete().eq('site_id', siteId).neq('customer_id', keep);
    try {
      await admin.from('ads_campaign_maps').delete().eq('site_id', siteId).neq('customer_id', keep);
    } catch (_e) {}
    return { ok: true, mode: 'other_customers', keep: keep };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

module.exports = { digits, purgeStaleAdsMetrics };
