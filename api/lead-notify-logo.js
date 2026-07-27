// api/lead-notify-logo.js — dual-tint LeadPages lockup PNG for enquiry emails.
// Tint1 (accent): circles + "more leads"
// Tint2 (ink): "leadpages" + "smart sites" + cursor
// Public GET — email clients must be able to fetch without auth.

const { renderDualTintPng, hexOr } = require('../lib/lead-notify-logo');

module.exports = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: 'GET only' }));
  }

  const q = req.query || {};
  const accent = hexOr(q.accent || q.t1 || q.logoTint, '#ffffff');
  const ink = hexOr(q.ink || q.t2 || q.logoTint2, '#ffffff');
  const height = Math.max(24, Math.min(240, parseInt(q.h || q.height || '84', 10) || 84));

  try {
    const png = await renderDualTintPng({ accent, ink, height });
    res.statusCode = 200;
    res.setHeader('content-type', 'image/png');
    res.setHeader('cache-control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('access-control-allow-origin', '*');
    if (req.method === 'HEAD') return res.end();
    return res.end(png);
  } catch (e) {
    console.error('lead-notify-logo', e && e.message);
    res.statusCode = e && e.code === 'sharp_unavailable' ? 503 : 500;
    res.setHeader('content-type', 'application/json');
    return res.end(JSON.stringify({ error: (e && e.message) || 'render_failed' }));
  }
};
