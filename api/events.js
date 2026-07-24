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
const {
  STANDARD_EVENTS,
  normalizeEventName,
  isAllowedEvent
} = require('../lib/tracking/events-contract');

const clean = (s, n = 120) => (s == null ? '' : String(s)).trim().slice(0, n);
const ALLOWED = STANDARD_EVENTS;

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
    const rawEvent = clean(b.event, 40);
    const event = normalizeEventName(rawEvent) || rawEvent;
    if (!event || !isAllowedEvent(rawEvent)) return ok(); // ignore unknown/empty events quietly
    const isTest = !!(b.test || (b.props && b.props.test) || (b.props && b.props.isTest));

    const site_id = await resolveSiteId({ siteId: clean(b.siteId, 64), slug: clean(b.slug, 120), site: clean(b.site, 160) });

    // Keep props small + JSON-safe.
    let props = {};
    if (b.props && typeof b.props === 'object') {
      try { props = JSON.parse(JSON.stringify(b.props)); } catch { props = {}; }
    }
    if (isTest) props.isTest = true;
    if (b.eventId || props.eventId) props.eventId = clean(b.eventId || props.eventId, 80);

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
    // Also store legacy alias for dashboards that still query call_click / lead_submit
    if (rawEvent && rawEvent !== event && ALLOWED.indexOf(rawEvent) >= 0) {
      try {
        await admin.from('events').insert({
          site_id: site_id || null,
          event: rawEvent,
          props: Object.assign({}, props, { aliasedTo: event }),
          site: clean(b.site, 160) || null
        });
      } catch (_e) { /* ignore */ }
    }

    if (isTest) return ok(); // test conversions never upload to Google Ads

    // Call-click / phone_click → Google Ads conversion
    if ((event === 'call_click' || event === 'phone_click') && site_id) {
      try {
        await deliverConversion(admin, {
          siteId: site_id,
          eventKey: 'call_click',
          internalEvent: event,
          attr,
          occurredAt: new Date().toISOString()
        });
      } catch (e) {
        console.error('call_click conversion:', e && e.message);
      }
    }

    if ((event === 'form_submit' || event === 'lead_submit' || event === 'generate_lead') && site_id) {
      try {
        await deliverConversion(admin, {
          siteId: site_id,
          eventKey: 'form_submission',
          internalEvent: event,
          attr,
          occurredAt: new Date().toISOString()
        });
      } catch (_e) { /* ignore */ }
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
