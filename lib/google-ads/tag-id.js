'use strict';

/**
 * Google tag (AW-…) helpers for LeadPages site injection + health.
 */

const { searchStream, resolveLoginCustomerId, digits } = require('./client');

function normalizeAdsTagId(raw) {
  let s = String(raw || '')
    .trim()
    .replace(/\s+/g, '');
  if (!s) return '';
  const aw = s.match(/\b(AW-\d+)\b/i);
  if (aw) return aw[1].toUpperCase().replace(/^AW-/i, 'AW-');
  const digitsOnly = s.replace(/\D+/g, '');
  if (digitsOnly && digitsOnly.length >= 6) return 'AW-' + digitsOnly;
  return '';
}

/**
 * Read conversion_tracking_id from the Ads customer and return AW-…
 * @returns {Promise<string>} empty when unavailable
 */
async function fetchAdsTagIdFromCustomer(accessToken, conn) {
  if (!conn || !conn.customer_id) return '';
  const cid = digits(conn.customer_id);
  const login = resolveLoginCustomerId(conn);
  try {
    const rows = await searchStream(
      accessToken,
      cid,
      `SELECT
        customer.id,
        customer.conversion_tracking_setting.conversion_tracking_id,
        customer.conversion_tracking_setting.cross_account_conversion_tracking_id,
        customer.conversion_tracking_setting.conversion_tracking_status
      FROM customer
      LIMIT 1`,
      login
    );
    const c = rows[0] && rows[0].customer;
    const setting = (c && (c.conversionTrackingSetting || c.conversion_tracking_setting)) || {};
    const id =
      setting.crossAccountConversionTrackingId ||
      setting.cross_account_conversion_tracking_id ||
      setting.conversionTrackingId ||
      setting.conversion_tracking_id ||
      null;
    return normalizeAdsTagId(id);
  } catch (_e) {
    return '';
  }
}

/**
 * Ensure connection.tag_id is populated (fetch from Ads when missing).
 * Does not overwrite a manually set tag unless opts.force.
 */
async function ensureConnectionTagId(admin, conn, accessToken, opts) {
  const o = opts || {};
  if (!admin || !conn || !conn.site_id) return { tagId: null, updated: false };
  const existing = normalizeAdsTagId(conn.tag_id);
  if (existing && !o.force) return { tagId: existing, updated: false, source: 'stored' };
  const fetched = await fetchAdsTagIdFromCustomer(accessToken, conn);
  if (!fetched) return { tagId: existing || null, updated: false, source: existing ? 'stored' : 'missing' };
  if (fetched === existing) return { tagId: fetched, updated: false, source: 'stored' };
  await admin
    .from('google_ads_connections')
    .update({ tag_id: fetched, updated_at: new Date().toISOString() })
    .eq('site_id', conn.site_id);
  conn.tag_id = fetched;
  return { tagId: fetched, updated: true, source: 'ads_api' };
}

module.exports = {
  normalizeAdsTagId,
  fetchAdsTagIdFromCustomer,
  ensureConnectionTagId
};
