'use strict';

/**
 * GA4 Data API — landing page report.
 */

async function fetchLandingPageReport(accessToken, propertyId, opts) {
  const o = opts || {};
  const id = String(propertyId || '').replace(/^properties\//, '');
  if (!id) throw new Error('missing_ga4_property');

  const startDate = o.startDate; // YYYY-MM-DD
  const endDate = o.endDate;
  if (!startDate || !endDate) throw new Error('missing_date_range');

  const body = {
    dateRanges: [{ startDate: startDate, endDate: endDate }],
    dimensions: [{ name: 'landingPage' }],
    metrics: [
      { name: 'sessions' },
      { name: 'engagedSessions' },
      { name: 'conversions' },
      { name: 'bounceRate' }
    ],
    limit: String(Math.min(10000, Math.max(1, o.rowLimit || 1000)))
  };

  const r = await fetch(
    'https://analyticsdata.googleapis.com/v1beta/properties/' + encodeURIComponent(id) + ':runReport',
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
    const msg =
      (j.error && (j.error.message || j.error.status)) || 'ga4_run_report_failed';
    const err = new Error(msg);
    err.status = r.status;
    err.details = j;
    throw err;
  }

  const rows = Array.isArray(j.rows) ? j.rows : [];
  return rows.map(function (row) {
    const dims = row.dimensionValues || [];
    const mets = row.metricValues || [];
    return {
      landingPage: String((dims[0] && dims[0].value) || ''),
      sessions: Number((mets[0] && mets[0].value) || 0),
      engagedSessions: Number((mets[1] && mets[1].value) || 0),
      conversions: Number((mets[2] && mets[2].value) || 0),
      bounceRate: mets[3] && mets[3].value != null ? Number(mets[3].value) : null
    };
  });
}

module.exports = {
  fetchLandingPageReport: fetchLandingPageReport
};
