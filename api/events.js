// api/events.js — receives analytics pings from tenant pages and stores them.
//
// The trade/broker templates fire fetch('/api/events', …) for page_view,
// call_click (the money metric) and lead_submit. Until now this endpoint did
// not exist, so every ping 404'd and the events table stayed empty — which is
// why the stats panel in /manage showed nothing. This stores each event against
// its site so the analytics in manage.html light up.
//
// Payload (from the templates):
//   { site: "<business name>", event: "page_view"|"call_click"|"lead_submit",
//     props: { …, ts }, siteId?: "<uuid>", slug?: "<slug>" }
//
// Always returns fast (204) and never throws back at the page — a tracking
// hiccup must never disrupt a real visitor.

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// In-process cache so we don't hit the DB to resolve the same site on every
// page_view. Serverless instances are short-lived, so this is just a cheap win.
const siteCache = new Map(); // key -> { id, ts }
const CACHE_MS = 5 * 60 * 1000;

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function resolveSiteId({ siteId, slug, site }) {
  // 1) explicit id is best
  if (siteId) return siteId;

  const cacheKey = slug ? 's:' + slug : (site ? 'b:' + site : null);
  if (cacheKey) {
    const hit = siteCache.get(cacheKey);
    if (hit && (Date.now() - hit.ts) < CACHE_MS) return hit.id;
  }

  let row = null;
  if (slug) {
    const r = await supabase.from('sites').select('id').eq('slug', slug).maybeSingle();
    row = r.data;
  }
  if (!row && site) {
    // business_name match (case-insensitive); pick the first if duplicated
    const r = await supabase.from('sites').select('id').ilike('business_name', site).limit(1);
    row = (r.data && r.data[0]) || null;
  }

  const id = row ? row.id : null;
  if (cacheKey && id) siteCache.set(cacheKey, { id, ts: Date.now() });
  return id;
}

module.exports = async (req, res) => {
  // Be permissive about method so a misconfigured call still no-ops cleanly.
  if (req.method !== 'POST') { res.statusCode = 204; return res.end(); }

  try {
    const body = await readBody(req);
    const event = (body.event || '').toString().slice(0, 64);
    if (!event) { res.statusCode = 204; return res.end(); }

    const site_id = await resolveSiteId({
      siteId: body.siteId,
      slug: body.slug,
      site: body.site
    });

    // If we can't resolve the site we still 204 (never error back at the page).
    if (!site_id) { res.statusCode = 204; return res.end(); }

    const props = (body.props && typeof body.props === 'object') ? body.props : {};

    await supabase.from('events').insert({
      site_id,
      event,
      props
    });

    res.statusCode = 204;
    return res.end();
  } catch (e) {
    // Swallow everything — analytics must never break the page.
    console.error('events error:', e && e.message);
    res.statusCode = 204;
    return res.end();
  }
};
