/**
 * LeadPages first-party session attribution (gclid / gbraid / wbraid / UTMs).
 * Loads before trackEvent; exposes window.LPAttribution.
 */
(function (w) {
  'use strict';
  if (w.LPAttribution) return;

  var VID_KEY = 'lp_vid';
  var SID_KEY = 'lp_sid';
  var ATTR_KEY = 'lp_attr';
  var SESSION_MS = 30 * 60 * 1000;

  function uid(prefix) {
    return (prefix || 'x') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function readStore(k) {
    try { return w.localStorage.getItem(k); } catch (e) { return null; }
  }
  function writeStore(k, v) {
    try { w.localStorage.setItem(k, v); } catch (e) {}
  }

  function qs() {
    try { return new URLSearchParams(w.location.search || ''); } catch (e) { return new URLSearchParams(); }
  }

  function deviceType() {
    var ua = (w.navigator && w.navigator.userAgent) || '';
    if (/Mobi|Android|iPhone|iPod/i.test(ua)) return 'mobile';
    if (/iPad|Tablet/i.test(ua)) return 'tablet';
    return 'desktop';
  }

  function deriveTrafficSource(a) {
    if (a.gclid || a.gbraid || a.wbraid) return 'google_ads';
    var src = String(a.utm_source || '').toLowerCase();
    var med = String(a.utm_medium || '').toLowerCase();
    if (src === 'google' && (med === 'cpc' || med === 'ppc' || med === 'paid')) return 'google_ads';
    if (med === 'organic') return 'organic';
    if (med === 'social' || /facebook|instagram|linkedin|tiktok|twitter/.test(src)) return 'social';
    if (src || med === 'referral') return 'referral';
    return 'direct';
  }

  function pageMeta() {
    var cfg = w.SITE_CONFIG || {};
    var path = (w.location && (w.location.pathname + w.location.search)) || '/';
    var pageType = cfg.pageType || (cfg.pageId ? 'landing_page' : 'main');
    return {
      page_id: cfg.pageId || null,
      page_type: pageType,
      page_url: path
    };
  }

  function loadAttr() {
    try {
      var raw = readStore(ATTR_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function saveAttr(a) {
    try { writeStore(ATTR_KEY, JSON.stringify(a)); } catch (e) {}
  }

  function ensureIds() {
    var vid = readStore(VID_KEY);
    if (!vid) { vid = uid('visitor'); writeStore(VID_KEY, vid); }
    var sid = readStore(SID_KEY);
    var last = 0;
    try { last = parseInt(readStore('lp_sid_at') || '0', 10) || 0; } catch (e) {}
    if (!sid || (Date.now() - last) > SESSION_MS) {
      sid = uid('session');
      writeStore(SID_KEY, sid);
    }
    try { writeStore('lp_sid_at', String(Date.now())); } catch (e) {}
    return { visitor_id: vid, session_id: sid };
  }

  function captureFromUrl(existing) {
    var p = qs();
    var next = existing ? Object.assign({}, existing) : {};
    var keys = ['gclid', 'gbraid', 'wbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
    var touched = false;
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = p.get(k);
      if (v && String(v).trim()) {
        // First-touch for click ids / UTMs within a session blob
        if (!next[k]) { next[k] = String(v).trim().slice(0, 500); touched = true; }
      }
    }
    if (!next.landing_page_url) {
      next.landing_page_url = (w.location && (w.location.pathname + w.location.search)) || '/';
      touched = true;
    }
    if (!next.first_visited_at) {
      next.first_visited_at = new Date().toISOString();
      touched = true;
    }
    next.last_activity_at = new Date().toISOString();
    next.device_type = deviceType();
    next.traffic_source = deriveTrafficSource(next);
    if (touched || !existing) saveAttr(next);
    else saveAttr(next);
    return next;
  }

  function getSession() {
    var ids = ensureIds();
    var attr = captureFromUrl(loadAttr() || {});
    var meta = pageMeta();
    return {
      session_id: ids.session_id,
      visitor_id: ids.visitor_id,
      page_id: meta.page_id,
      page_type: meta.page_type,
      page_url: meta.page_url,
      landing_page_url: attr.landing_page_url || meta.page_url,
      gclid: attr.gclid || null,
      gbraid: attr.gbraid || null,
      wbraid: attr.wbraid || null,
      utm_source: attr.utm_source || null,
      utm_medium: attr.utm_medium || null,
      utm_campaign: attr.utm_campaign || null,
      utm_content: attr.utm_content || null,
      utm_term: attr.utm_term || null,
      device_type: attr.device_type || deviceType(),
      traffic_source: attr.traffic_source || deriveTrafficSource(attr),
      first_visited_at: attr.first_visited_at || null,
      last_activity_at: new Date().toISOString()
    };
  }

  /** Merge session fields into an event props object (snake_case). */
  function enrichProps(props) {
    var s = getSession();
    var out = props && typeof props === 'object' ? Object.assign({}, props) : {};
    Object.keys(s).forEach(function (k) {
      if (s[k] != null && s[k] !== '' && (out[k] == null || out[k] === '')) out[k] = s[k];
    });
    return out;
  }

  /** Fields to send alongside /api/leads body. */
  function leadFields() {
    return getSession();
  }

  // Warm session on load
  try { getSession(); } catch (e) {}

  w.LPAttribution = {
    getSession: getSession,
    enrichProps: enrichProps,
    leadFields: leadFields
  };
})(typeof window !== 'undefined' ? window : this);
