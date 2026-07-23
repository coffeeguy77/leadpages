'use strict';

/**
 * Partner portfolio rollup — sites for a partner with Search Intelligence health.
 */

async function loadPartnerPortfolio(admin, partnerId) {
  if (!admin || !partnerId) {
    return { ok: true, partnerId: partnerId || null, sites: [] };
  }

  const { data: sites, error } = await admin
    .from('sites')
    .select('id,slug,business_name,status,custom_domain,servicing_partner_id,referring_partner_id')
    .or('servicing_partner_id.eq.' + partnerId + ',referring_partner_id.eq.' + partnerId)
    .order('business_name', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);

  const siteIds = (sites || []).map(function (s) { return s.id; });
  const connBySite = {};
  if (siteIds.length) {
    try {
      const { data: conns } = await admin
        .from('si_connections')
        .select('site_id,provider,connection_status,property_id,last_sync_at,last_sync_error')
        .in('site_id', siteIds);
      (conns || []).forEach(function (c) {
        if (!connBySite[c.site_id]) connBySite[c.site_id] = {};
        connBySite[c.site_id][c.provider] = c;
      });
    } catch (_e) {
      /* schema may be missing */
    }
  }

  const trackedCounts = {};
  if (siteIds.length) {
    try {
      const { data: tracked } = await admin
        .from('si_tracked_keywords')
        .select('site_id')
        .in('site_id', siteIds)
        .eq('active', true);
      (tracked || []).forEach(function (t) {
        trackedCounts[t.site_id] = (trackedCounts[t.site_id] || 0) + 1;
      });
    } catch (_e) {
      /* ignore */
    }
  }

  const rows = (sites || []).map(function (s) {
    const c = connBySite[s.id] || {};
    const gsc = c.search_console;
    const ga4 = c.ga4;
    return {
      siteId: s.id,
      slug: s.slug,
      businessName: s.business_name,
      status: s.status,
      customDomain: s.custom_domain,
      relationship:
        s.servicing_partner_id === partnerId
          ? 'servicing'
          : s.referring_partner_id === partnerId
            ? 'referring'
            : 'related',
      gsc: gsc
        ? {
            status: gsc.connection_status,
            hasProperty: !!gsc.property_id,
            lastSyncAt: gsc.last_sync_at,
            lastError: gsc.last_sync_error
          }
        : { status: 'not_connected', hasProperty: false },
      ga4: ga4
        ? {
            status: ga4.connection_status,
            hasProperty: !!ga4.property_id,
            lastSyncAt: ga4.last_sync_at
          }
        : { status: 'not_connected', hasProperty: false },
      trackedKeywords: trackedCounts[s.id] || 0,
      health:
        gsc && gsc.connection_status === 'connected' && gsc.property_id
          ? ga4 && ga4.connection_status === 'connected'
            ? 'good'
            : 'partial'
          : 'needs_setup'
    };
  });

  const summary = {
    total: rows.length,
    good: rows.filter(function (r) { return r.health === 'good'; }).length,
    partial: rows.filter(function (r) { return r.health === 'partial'; }).length,
    needsSetup: rows.filter(function (r) { return r.health === 'needs_setup'; }).length
  };

  return { ok: true, partnerId: partnerId, summary: summary, sites: rows };
}

module.exports = {
  loadPartnerPortfolio: loadPartnerPortfolio
};
