'use strict';

/**
 * First-party organic attribution rollup for SEO Command Centre.
 * Uses events props + visitor_sessions.traffic_source (call-clicks + forms).
 */

function daysAgoIso(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

function isOrganicProps(p) {
  if (!p || typeof p !== 'object') return false;
  if (p.gclid || p.gbraid || p.wbraid) return false;
  if (p.traffic_source === 'google_ads') return false;
  if (p.traffic_source === 'organic') return true;
  const src = String(p.utm_source || '').toLowerCase();
  const med = String(p.utm_medium || '').toLowerCase();
  if (med === 'organic') return true;
  if ((src === 'google' || src === 'bing') && med !== 'cpc' && med !== 'ppc' && med !== 'paid') return true;
  return false;
}

/**
 * @param {object} admin
 * @param {string} siteId
 * @param {{ days?: number }} [opts]
 */
async function loadOrganicLeadSummary(admin, siteId, opts) {
  const o = opts || {};
  const days = Math.max(1, Math.min(90, o.days || 28));
  const since = daysAgoIso(days);
  const empty = {
    days: days,
    since: since,
    callClicks: 0,
    forms: 0,
    organicCallClicks: 0,
    organicForms: 0,
    organicLeads: 0,
    modelledOrganicLeads: 0,
    confidence: 'low',
    labelClass: 'modelled',
    available: false
  };
  if (!admin || !siteId) return empty;

  try {
    const { data: events, error } = await admin
      .from('events')
      .select('event,props,created_at')
      .eq('site_id', siteId)
      .gte('created_at', since)
      .in('event', ['call_click', 'lead_submit']);
    if (error) return empty;

    const sessionIds = new Set();
    (events || []).forEach(function (ev) {
      const p = ev.props || {};
      if (p.session_id) sessionIds.add(p.session_id);
    });

    const sessionOrganic = new Map();
    if (sessionIds.size) {
      const ids = Array.from(sessionIds).slice(0, 2000);
      const { data: sessions } = await admin
        .from('visitor_sessions')
        .select('session_id,traffic_source')
        .eq('site_id', siteId)
        .in('session_id', ids);
      (sessions || []).forEach(function (s) {
        sessionOrganic.set(s.session_id, s.traffic_source === 'organic');
      });
    }

    let callClicks = 0;
    let forms = 0;
    let organicCallClicks = 0;
    let organicForms = 0;

    (events || []).forEach(function (ev) {
      const p = ev.props || {};
      const fromSession = p.session_id ? sessionOrganic.get(p.session_id) : null;
      const organic = fromSession === true || (fromSession == null && isOrganicProps(p));
      if (ev.event === 'call_click') {
        callClicks++;
        if (organic) organicCallClicks++;
      }
      if (ev.event === 'lead_submit') {
        forms++;
        if (organic) organicForms++;
      }
    });

    const organicLeads = organicCallClicks + organicForms;
    const matchedSessions = Array.from(sessionOrganic.values()).filter(Boolean).length;
    const confidence = matchedSessions > 0 ? 'medium' : organicLeads > 0 ? 'low' : 'none';

    return {
      days: days,
      since: since,
      callClicks: callClicks,
      forms: forms,
      organicCallClicks: organicCallClicks,
      organicForms: organicForms,
      organicLeads: organicLeads,
      modelledOrganicLeads: organicLeads,
      confidence: confidence,
      labelClass: matchedSessions > 0 ? 'measured' : 'modelled',
      available: true,
      note:
        'Organic = visitor_sessions.traffic_source=organic or UTM medium=organic on the event (excludes Ads click ids).'
    };
  } catch (_e) {
    return empty;
  }
}

module.exports = {
  loadOrganicLeadSummary: loadOrganicLeadSummary,
  isOrganicProps: isOrganicProps
};
