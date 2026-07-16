/**
 * Load partner showcase demo/client sites for the public Culture page.
 * Includes sites marked show_on_showcase, plus any explicitly picked in
 * websiteProfile.industryShowcase.tabs (even if not mockups).
 */
const { websiteProfileFromRow } = require('./profile-store');

function configuredSiteIds(prof) {
  const wp = websiteProfileFromRow(prof) || {};
  const ids = [];
  const seen = {};
  function pushId(id) {
    const s = String(id || '').trim();
    if (!s || seen[s]) return;
    seen[s] = true;
    ids.push(s);
  }
  const tabs = (wp.industryShowcase && wp.industryShowcase.tabs) || [];
  tabs.forEach(function(t) {
    if (!t || t.enabled === false) return;
    pushId(t.siteId);
  });
  const hs = wp.heroShowcase || {};
  pushId(hs.siteId);
  (hs.siteIds || []).forEach(pushId);
  return ids;
}

async function fetchPartnerShowcaseSites(supabase, partnerId, prof) {
  if (!partnerId || !supabase) return [];
  const SITE_COLS = 'id,slug,business_name,config,preview_password,is_mockup,show_on_showcase';
  const orPartner = 'servicing_partner_id.eq.' + partnerId
    + ',referring_partner_id.eq.' + partnerId;

  const flagged = (await supabase.from('sites')
    .select(SITE_COLS)
    .eq('show_on_showcase', true)
    .or(orPartner)
    .limit(48)).data || [];

  const ids = configuredSiteIds(prof);
  let picked = [];
  if (ids.length) {
    picked = (await supabase.from('sites')
      .select(SITE_COLS)
      .in('id', ids)
      .limit(24)).data || [];
  }

  const byId = {};
  flagged.concat(picked).forEach(function(row) {
    if (!row || !row.id) return;
    byId[row.id] = row;
  });
  return Object.keys(byId).map(function(k) { return byId[k]; });
}

module.exports = {
  configuredSiteIds,
  fetchPartnerShowcaseSites
};
