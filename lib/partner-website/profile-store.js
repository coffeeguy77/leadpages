/**
 * Load/save website_profile with graceful fallback when DB column is not migrated yet.
 */

const SC_SELECT_BASE = 'partner_id,showcase_slug,showcase_domain,showcase_enabled,showcase_headline,showcase_config,support_email,support_phone,support_name,region,bio';
const SC_SELECT_FULL = SC_SELECT_BASE + ',website_profile';

function isMissingWebsiteProfileColumn(err) {
  const msg = String((err && err.message) || err || '');
  return /website_profile/i.test(msg) && (/column|schema cache|does not exist/i.test(msg));
}

function websiteProfileFromRow(row) {
  if (!row) return null;
  if (row.website_profile != null) return row.website_profile;
  const cfg = row.showcase_config || {};
  return cfg.websiteProfile || null;
}

function attachWebsiteProfile(row) {
  if (!row) return row;
  if (row.website_profile == null) {
    row.website_profile = websiteProfileFromRow(row);
  }
  return row;
}

async function selectPartnerProfile(supabase, queryFn, selectCols) {
  const r = await queryFn(selectCols);
  if (!r.error) {
    attachWebsiteProfile(r.data);
    return r.data;
  }
  if (!isMissingWebsiteProfileColumn(r.error) || selectCols === SC_SELECT_BASE) return null;
  const fallback = await queryFn(SC_SELECT_BASE);
  if (fallback.error) return null;
  attachWebsiteProfile(fallback.data);
  return fallback.data;
}

async function fetchPartnerProfileBySlug(supabase, slug) {
  return selectPartnerProfile(supabase, function(cols) {
    return supabase.from('partner_profiles').select(cols).ilike('showcase_slug', slug).maybeSingle();
  }, SC_SELECT_FULL);
}

async function fetchPartnerProfileByDomain(supabase, hosts) {
  return selectPartnerProfile(supabase, function(cols) {
    return supabase.from('partner_profiles').select(cols).in('showcase_domain', hosts).maybeSingle();
  }, SC_SELECT_FULL);
}

async function fetchPartnerProfileByPartnerId(supabase, partnerId) {
  return selectPartnerProfile(supabase, function(cols) {
    return supabase.from('partner_profiles').select(cols).eq('partner_id', partnerId).maybeSingle();
  }, SC_SELECT_FULL);
}

async function saveWebsiteProfile(supabase, partnerId, validated, now) {
  const patch = {
    website_profile: validated,
    website_profile_updated_at: now,
    updated_at: now
  };
  const up = await supabase.from('partner_profiles').update(patch).eq('partner_id', partnerId).select('*').single();
  if (!up.error) {
    attachWebsiteProfile(up.data);
    return { ok: true, profile: up.data };
  }
  if (!isMissingWebsiteProfileColumn(up.error)) {
    return { ok: false, error: up.error };
  }
  const cur = await supabase.from('partner_profiles').select('showcase_config').eq('partner_id', partnerId).maybeSingle();
  const cfg = Object.assign({}, (cur.data && cur.data.showcase_config) || {}, { websiteProfile: validated });
  const up2 = await supabase.from('partner_profiles').update({ showcase_config: cfg, updated_at: now }).eq('partner_id', partnerId).select('*').single();
  if (up2.error) return { ok: false, error: up2.error };
  up2.data.website_profile = validated;
  return { ok: true, profile: up2.data, storedInShowcaseConfig: true };
}

module.exports = {
  SC_SELECT_BASE,
  SC_SELECT_FULL,
  isMissingWebsiteProfileColumn,
  websiteProfileFromRow,
  attachWebsiteProfile,
  fetchPartnerProfileBySlug,
  fetchPartnerProfileByDomain,
  fetchPartnerProfileByPartnerId,
  saveWebsiteProfile
};
