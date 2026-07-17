/**
 * Shared first-party attribution helpers for events + leads ingest.
 * Keeps gclid / UTMs / session ids normalised and derives traffic_source.
 */

const clean = (s, n = 400) => (s == null ? '' : String(s)).trim().slice(0, n);

const ATTR_KEYS = [
  'session_id', 'visitor_id', 'page_id', 'page_type', 'page_url', 'landing_page_url',
  'gclid', 'gbraid', 'wbraid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
  'device_type', 'traffic_source', 'first_visited_at', 'last_activity_at'
];

function pickAttribution(src) {
  const out = {};
  if (!src || typeof src !== 'object') return out;
  for (let i = 0; i < ATTR_KEYS.length; i++) {
    const k = ATTR_KEYS[i];
    const v = src[k] != null ? src[k] : src[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())];
    if (v == null || v === '') continue;
    out[k] = clean(v, k.indexOf('url') >= 0 ? 800 : 240);
  }
  // camelCase aliases from client
  const aliases = {
    sessionId: 'session_id', visitorId: 'visitor_id', pageId: 'page_id', pageType: 'page_type',
    pageUrl: 'page_url', landingPageUrl: 'landing_page_url',
    utmSource: 'utm_source', utmMedium: 'utm_medium', utmCampaign: 'utm_campaign',
    utmContent: 'utm_content', utmTerm: 'utm_term', deviceType: 'device_type',
    trafficSource: 'traffic_source', firstVisitedAt: 'first_visited_at', lastActivityAt: 'last_activity_at'
  };
  Object.keys(aliases).forEach((ck) => {
    if (out[aliases[ck]]) return;
    if (src[ck] != null && src[ck] !== '') out[aliases[ck]] = clean(src[ck], 800);
  });
  if (!out.traffic_source) out.traffic_source = deriveTrafficSource(out);
  return out;
}

function deriveTrafficSource(a) {
  if (a.gclid || a.gbraid || a.wbraid) return 'google_ads';
  const src = (a.utm_source || '').toLowerCase();
  const med = (a.utm_medium || '').toLowerCase();
  if (src === 'google' && (med === 'cpc' || med === 'ppc' || med === 'paid')) return 'google_ads';
  if (med === 'organic' || src === 'google' || src === 'bing') return 'organic';
  if (med === 'social' || /facebook|instagram|linkedin|tiktok|twitter|x\.com/.test(src)) return 'social';
  if (med === 'referral' || src) return src ? 'referral' : 'direct';
  if (!src && !med) return 'direct';
  return 'other';
}

/**
 * Upsert visitor_sessions. Never throws to callers — returns null on failure.
 */
async function upsertVisitorSession(admin, siteId, attr) {
  if (!admin || !siteId || !attr || !attr.session_id || !attr.visitor_id) return null;
  const now = new Date().toISOString();
  const row = {
    site_id: siteId,
    session_id: attr.session_id,
    visitor_id: attr.visitor_id,
    page_id: attr.page_id || null,
    page_type: attr.page_type || null,
    page_url: attr.page_url || null,
    landing_page_url: attr.landing_page_url || null,
    gclid: attr.gclid || null,
    gbraid: attr.gbraid || null,
    wbraid: attr.wbraid || null,
    utm_source: attr.utm_source || null,
    utm_medium: attr.utm_medium || null,
    utm_campaign: attr.utm_campaign || null,
    utm_content: attr.utm_content || null,
    utm_term: attr.utm_term || null,
    device_type: attr.device_type || null,
    traffic_source: attr.traffic_source || deriveTrafficSource(attr),
    last_activity_at: attr.last_activity_at || now
  };
  try {
    const { data: existing } = await admin
      .from('visitor_sessions')
      .select('id, gclid, gbraid, wbraid, utm_source, utm_campaign, landing_page_url, first_visited_at')
      .eq('site_id', siteId)
      .eq('session_id', attr.session_id)
      .maybeSingle();

    if (existing && existing.id) {
      // First-touch: do not overwrite click ids / landing URL / UTMs once set
      const patch = {
        last_activity_at: row.last_activity_at,
        page_id: row.page_id || undefined,
        page_type: row.page_type || undefined,
        page_url: row.page_url || undefined,
        device_type: row.device_type || undefined
      };
      if (!existing.gclid && row.gclid) patch.gclid = row.gclid;
      if (!existing.gbraid && row.gbraid) patch.gbraid = row.gbraid;
      if (!existing.wbraid && row.wbraid) patch.wbraid = row.wbraid;
      if (!existing.utm_source && row.utm_source) {
        patch.utm_source = row.utm_source;
        patch.utm_medium = row.utm_medium;
        patch.utm_campaign = row.utm_campaign;
        patch.utm_content = row.utm_content;
        patch.utm_term = row.utm_term;
        patch.traffic_source = row.traffic_source;
      }
      if (!existing.landing_page_url && row.landing_page_url) patch.landing_page_url = row.landing_page_url;
      Object.keys(patch).forEach((k) => { if (patch[k] === undefined) delete patch[k]; });
      await admin.from('visitor_sessions').update(patch).eq('id', existing.id);
      return Object.assign({}, existing, patch);
    }

    row.first_visited_at = attr.first_visited_at || now;
    const ins = await admin.from('visitor_sessions').insert(row).select('*').maybeSingle();
    return ins.data || row;
  } catch (e) {
    console.error('upsertVisitorSession:', e && e.message);
    return null;
  }
}

function attributionForLeadInsert(attr) {
  if (!attr) return {};
  return {
    session_id: attr.session_id || null,
    visitor_id: attr.visitor_id || null,
    page_id: attr.page_id || null,
    landing_page_url: attr.landing_page_url || null,
    gclid: attr.gclid || null,
    gbraid: attr.gbraid || null,
    wbraid: attr.wbraid || null,
    utm_source: attr.utm_source || null,
    utm_medium: attr.utm_medium || null,
    utm_campaign: attr.utm_campaign || null,
    utm_content: attr.utm_content || null,
    utm_term: attr.utm_term || null,
    traffic_source: attr.traffic_source || deriveTrafficSource(attr)
  };
}

function mergeAttributionIntoProps(props, attr) {
  const out = props && typeof props === 'object' ? Object.assign({}, props) : {};
  if (!attr) return out;
  ATTR_KEYS.forEach((k) => {
    if (attr[k] != null && attr[k] !== '' && out[k] == null) out[k] = attr[k];
  });
  return out;
}

module.exports = {
  ATTR_KEYS,
  clean,
  pickAttribution,
  deriveTrafficSource,
  upsertVisitorSession,
  attributionForLeadInsert,
  mergeAttributionIntoProps
};
