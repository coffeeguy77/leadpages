'use strict';

/**
 * Google Search Console API helpers (read-only).
 */

async function listSites(accessToken) {
  const r = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const err = new Error(j.error && j.error.message ? j.error.message : 'gsc_list_sites_failed');
    err.status = r.status;
    err.details = j;
    throw err;
  }
  const entries = Array.isArray(j.siteEntry) ? j.siteEntry : [];
  return entries.map(function (e) {
    return {
      propertyId: e.siteUrl,
      label: e.siteUrl,
      permissionLevel: e.permissionLevel || null,
      siteUrl: e.siteUrl
    };
  });
}

/**
 * Query search analytics (query × page).
 * @param {string} accessToken
 * @param {string} siteUrl GSC property URL (must be encoded in path)
 * @param {{ startDate: string, endDate: string, rowLimit?: number }} opts
 */
async function fetchSearchAnalytics(accessToken, siteUrl, opts) {
  const o = opts || {};
  const startDate = o.startDate;
  const endDate = o.endDate;
  if (!startDate || !endDate) throw new Error('missing_date_range');
  const encoded = encodeURIComponent(siteUrl);
  const body = {
    startDate: startDate,
    endDate: endDate,
    dimensions: ['query', 'page'],
    rowLimit: Math.min(25000, Math.max(1, o.rowLimit || 1000)),
    startRow: o.startRow || 0
  };
  const r = await fetch(
    'https://www.googleapis.com/webmasters/v3/sites/' + encoded + '/searchAnalytics/query',
    {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    }
  );
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const err = new Error(j.error && j.error.message ? j.error.message : 'gsc_search_analytics_failed');
    err.status = r.status;
    err.details = j;
    throw err;
  }
  const rows = Array.isArray(j.rows) ? j.rows : [];
  return rows.map(function (row) {
    const keys = row.keys || [];
    return {
      query: String(keys[0] || ''),
      pageUrl: String(keys[1] || ''),
      clicks: Number(row.clicks || 0),
      impressions: Number(row.impressions || 0),
      ctr: row.ctr != null ? Number(row.ctr) : null,
      position: row.position != null ? Number(row.position) : null
    };
  });
}

module.exports = {
  listSites: listSites,
  fetchSearchAnalytics: fetchSearchAnalytics
};
