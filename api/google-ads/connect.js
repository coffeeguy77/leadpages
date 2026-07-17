// GET /api/google-ads/connect?siteId=&slug= — start Google Ads OAuth
const { createClient } = require('@supabase/supabase-js');
const cfg = require('../../lib/google-ads/config');
const { makeState, authorizeUrl } = require('../../lib/google-ads/oauth');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

module.exports = async (req, res) => {
  try {
    if (!cfg.configured()) {
      res.statusCode = 503;
      res.setHeader('content-type', 'text/plain; charset=utf-8');
      return res.end('Google Ads is not configured on this platform yet.');
    }
    const q = req.query || {};
    const siteId = String(q.siteId || q.site_id || '').trim();
    let slug = String(q.slug || '').trim();
    if (!siteId && !slug) {
      res.statusCode = 400;
      return res.end('Missing siteId or slug.');
    }
    if (siteId && !slug) {
      const { data } = await admin.from('sites').select('slug').eq('id', siteId).maybeSingle();
      slug = (data && data.slug) || '';
    }
    const state = makeState({ siteId, slug });
    const url = authorizeUrl(state);
    res.setHeader('cache-control', 'no-store');
    res.writeHead(302, { Location: url });
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.end('Could not start Google Ads connection: ' + String(e && e.message || e));
  }
};
