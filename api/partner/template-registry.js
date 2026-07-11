// GET /api/partner/template-registry — list partner page design templates
const { PARTNER_TEMPLATES } = require('../../lib/partner-templates/registry');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({ ok: true, templates: PARTNER_TEMPLATES });
};
