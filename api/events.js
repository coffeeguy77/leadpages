// api/events.js — receives the analytics beacons the public pages fire
// (page_view, call_click, lead_submit) and stores them in the events table,
// which powers the Visitors / Calls / Forms / Conversion stats in /manage.
//
// Payload (from the site template's trackEvent):
//   { site: "<business name>", siteId?: "<uuid>", slug?: "<slug>",
//     event: "page_view"|"call_click"|"lead_submit"|..., props: {...} }
//
// Public endpoint (no auth — it's called from every visitor's browser).
// Uses the service-role key to write. Always returns 200 so a hiccup never
// throws errors into a visitor's page.

const { createClient } = require('@supabase/supabase-js');
const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { limited } = require('./_rate-limit');
const {
  pickAttribution,
  upsertVisitorSession,
  mergeAttributionIntoProps
} = require('../lib/attribution');
const { deliverConversion } = require('../lib/google-ads/conversions');

const clean = (s, n = 120) => (s == null ? '' : String(s)).trim().slice(0, n);
const ALLOWED = [
  'page_view',
  'call_click',
  'lead_submit',
  'quote_open',
  'cta_click',
  'email_click',
  'directions_click',
  'gallery_impression',
  'gallery_filter',
  'gallery_category',
  'gallery_album',
  'gallery_image_click',
  'gallery_lightbox',
  'gallery_zoom',
  'gallery_nav',
  'gallery_load_more',
  'gallery_slideshow',
  'gallery_download',
  'gallery_share'
];

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = ''; req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function resolveSiteId({ siteId, slug, site }) {
  if (siteId) return siteId; // trust the id the template was rendered with
  try {
    if (slug) { const r = await admin.from('sites').select('id').eq('slug', slug).maybeSingle(); if (r.data) return r.data.id; }
    if (site) { const r = await admin.from('sites').select('id').ilike('business_name', site).limit(1); if (r.data && r.data[0]) return r.data[0].id; }
  } catch { /* ignore */ }
  return null;
}

module.exports = async (req, res) => {
  const ok = () => { res.statusCode = 200; res.setHeader('content-type', 'application/json'); res.end('{"ok":true}'); };
  if (req.method !== 'POST') return ok();
  // Soft rate limit: drop spam without erroring visitor pages (always 200).
  if (limited(req, { key: 'events', max: 120, windowMs: 60000 })) return ok();

  try {
    const b = await readBody(req);
    const event = clean(b.event, 40);
    if (!event || ALLOWED.indexOf(event) < 0) return ok(); // ignore unknown/empty events quietly

    const site_id = await resolveSiteId({ siteId: clean(b.siteId, 64), slug: clean(b.slug, 120), site: clean(b.site, 160) });

    // Keep props small + JSON-safe.
    let props = {};
    if (b.props && typeof b.props === 'object') {
      try { props = JSON.parse(JSON.stringify(b.props)); } catch { props = {}; }
    }

    // Attribution may arrive in props or top-level body fields
    const attr = pickAttribution(Object.assign({}, b, props));
    props = mergeAttributionIntoProps(props, attr);

    if (site_id && attr.session_id && attr.visitor_id) {
      await upsertVisitorSession(admin, site_id, attr);
    }

    await admin.from('events').insert({
      site_id: site_id || null,
      event,
      props,
      site: clean(b.site, 160) || null
    });

    // Call-click → Google Ads conversion (after internal success). Never blocks response.
    if (event === 'call_click' && site_id) {
      try {
        await deliverConversion(admin, {
          siteId: site_id,
          eventKey: 'call_click',
          internalEvent: 'call_click',
          attr,
          occurredAt: new Date().toISOString()
        });
      } catch (e) {
        console.error('call_click conversion:', e && e.message);
      }
    }

    // Secondary CTA conversions when roles allow
    if ((event === 'cta_click' || event === 'email_click' || event === 'directions_click') && site_id) {
      const map = { cta_click: 'cta_click', email_click: 'email_click', directions_click: 'directions_click' };
      try {
        await deliverConversion(admin, {
          siteId: site_id,
          eventKey: map[event],
          internalEvent: event,
          attr,
          occurredAt: new Date().toISOString()
        });
      } catch (e) { /* ignore */ }
    }
  } catch (e) {
    console.error('events error:', e && e.message);
  }
  return ok();
};
