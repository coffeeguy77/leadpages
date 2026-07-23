'use strict';

/**
 * Google Analytics Admin API helpers (GA4 property list).
 */

async function listProperties(accessToken) {
  const r = await fetch('https://analyticsadmin.googleapis.com/v1beta/accountSummaries', {
    headers: { Authorization: 'Bearer ' + accessToken }
  });
  const j = await r.json().catch(function () { return {}; });
  if (!r.ok) {
    const err = new Error(j.error && j.error.message ? j.error.message : 'ga4_list_properties_failed');
    err.status = r.status;
    err.details = j;
    throw err;
  }
  const out = [];
  const accounts = Array.isArray(j.accountSummaries) ? j.accountSummaries : [];
  accounts.forEach(function (acct) {
    const props = Array.isArray(acct.propertySummaries) ? acct.propertySummaries : [];
    props.forEach(function (p) {
      const propertyName = String(p.property || '');
      const id = propertyName.replace(/^properties\//, '');
      out.push({
        propertyId: id || propertyName,
        propertyResource: propertyName,
        label: (p.displayName || id || propertyName) + (acct.displayName ? ' · ' + acct.displayName : ''),
        displayName: p.displayName || null,
        accountDisplayName: acct.displayName || null,
        propertyType: p.propertyType || null
      });
    });
  });
  return out;
}

module.exports = {
  listProperties: listProperties
};
