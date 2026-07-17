'use strict';

const { listFoundations, selectFoundationCandidates } = require('../../lib/theme-studio/foundations');
const { requireThemeStudioActor, json, readBody } = require('../../lib/theme-studio/http-access');

module.exports = async function themeStudioFoundations(req, res) {
  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  if (req.method === 'GET') {
    const foundations = listFoundations().map((f) => ({
      id: f.id,
      name: f.name,
      category: f.category,
      supportedIndustries: f.supportedIndustries,
      visualStyles: f.visualStyles,
      conversionStyle: f.conversionStyle,
      defaultLayoutId: f.defaultLayoutId,
      status: f.status,
      version: f.version
    }));
    return json(res, 200, { ok: true, foundations });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const candidates = selectFoundationCandidates(body.brief || body, { limit: body.limit || 5 });
    return json(res, 200, { ok: true, candidates });
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
