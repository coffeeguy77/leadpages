// GET /api/partner/template-registry — partner page designs (+ their design-text fields) and Culture colour presets
const { PARTNER_TEMPLATES } = require('../../lib/partner-templates/registry');
const { culturePresetPublicList } = require('../../lib/partner-website/webculture-color-presets');
const { SLOTS } = require('../../lib/partner-templates/studio-family');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' });
  res.setHeader('cache-control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).json({
    ok: true,
    // slots: the editable "design text" fields of each Studio-family design (empty for Culture).
    templates: PARTNER_TEMPLATES.map(function(t) { return Object.assign({}, t, { slots: SLOTS[t.id] || [] }); }),
    cultureColorPresets: culturePresetPublicList()
  });
};
