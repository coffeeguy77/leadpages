// api/ig-media.js — PUBLIC: returns a site's recent Instagram posts for the gallery.
// GET /api/ig-media?slug=<site-slug>   (or ?siteId=<uuid>)   [&limit=12]
//
// Reads the EXISTING ig_connections table (keyed by slug). Never returns the token.
// - Uses graph.instagram.com (Instagram Login flow) — the /me/media edge.
// - Caches shaped media in ig_cache for 10 minutes (public pages hit this on every load).
// - Auto-refreshes the 60-day token when it's within 7 days of expiry.
// - Degrades gracefully if the gallery columns (ig_cache etc.) aren't added yet.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const CACHE_MS = 10 * 60 * 1000;
const MEDIA_FIELDS = 'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp';

function shape(m) {
  const isVideo = m.media_type === 'VIDEO';
  return {
    id: m.id,
    type: m.media_type,
    image: isVideo ? (m.thumbnail_url || m.media_url) : m.media_url,
    link: m.permalink,
    caption: m.caption || '',
    timestamp: m.timestamp
  };
}

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  try {
    const q = req.query || {};
    let slug = (q.slug || '').trim();
    const siteId = (q.siteId || '').trim();
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 12, 1), 25);

    // Resolve slug from siteId if only the id was given.
    if (!slug && siteId) {
      const { data: s } = await supabase.from('sites').select('slug').eq('id', siteId).maybeSingle();
      if (s) slug = s.slug;
    }
    if (!slug) return res.status(200).json({ connected: false, media: [] });

    const { data: conn } = await supabase.from('ig_connections').select('*').eq('slug', slug).maybeSingle();
    if (!conn || !conn.access_token) return res.status(200).json({ connected: false, media: [] });

    // Fresh cache -> serve it (only if the cache columns exist).
    if (conn.ig_cache && conn.ig_cache_at && (Date.now() - new Date(conn.ig_cache_at).getTime() < CACHE_MS)) {
      return res.status(200).json({ connected: true, username: conn.ig_username || null, cached: true, media: conn.ig_cache.slice(0, limit) });
    }

    let token = conn.access_token;

    // Refresh the long-lived token if it's within 7 days of expiry (needs a still-valid token).
    try {
      if (conn.token_expires_at && (new Date(conn.token_expires_at).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000)) {
        const rRes = await fetch('https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=' + encodeURIComponent(token));
        const rJson = await rRes.json().catch(() => ({}));
        if (rRes.ok && rJson.access_token) {
          token = rJson.access_token;
          const exp = new Date(Date.now() + (Number(rJson.expires_in || 5184000) * 1000)).toISOString();
          try { await supabase.from('ig_connections').update({ access_token: token, token_expires_at: exp }).eq('slug', slug); } catch (_) {}
        }
      }
    } catch (_) {}

    // Fetch recent media from the Instagram Login endpoint.
    const url = 'https://graph.instagram.com/me/media?fields=' + encodeURIComponent(MEDIA_FIELDS)
      + '&limit=25&access_token=' + encodeURIComponent(token);
    const mRes = await fetch(url);
    const mJson = await mRes.json().catch(() => ({}));

    if (!mRes.ok || !Array.isArray(mJson.data)) {
      // Serve stale cache if we have it; otherwise report the error but stay 200 for the page.
      if (conn.ig_cache) return res.status(200).json({ connected: true, username: conn.ig_username || null, stale: true, media: conn.ig_cache.slice(0, limit) });
      const emsg = (mJson && mJson.error && mJson.error.message) || 'fetch failed';
      return res.status(200).json({ connected: true, username: conn.ig_username || null, error: emsg, media: [] });
    }

    const media = mJson.data.map(shape).filter(x => x.image);

    // Write cache (ignored if the gallery columns aren't present yet).
    try { await supabase.from('ig_connections').update({ ig_cache: media, ig_cache_at: new Date().toISOString() }).eq('slug', slug); } catch (_) {}

    return res.status(200).json({ connected: true, username: conn.ig_username || null, media: media.slice(0, limit) });
  } catch (e) {
    return res.status(200).json({ connected: false, media: [], error: String((e && e.message) || e) });
  }
};
