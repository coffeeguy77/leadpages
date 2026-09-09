'use strict';

const {
  sendJson,
  requireUser,
  admin,
} = require('../../lib/layout-composer/http');
const {
  positioningLayoutToPresetBlueprint,
} = require('../../lib/layout-composer/preset-adapter');

/** GET /api/layout-composer/presets — Themes rows as read-only preset blueprints. */
module.exports = async function layoutComposerPresets(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'GET, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET only' });

  const user = await requireUser(req);
  if (!user) {
    return sendJson(res, 200, {
      ok: true,
      presets: [],
      signedIn: false,
      hint: 'Sign in to load Themes presets, or use Start from scratch.',
    });
  }

  try {
    const { data, error } = await admin
      .from('positioning_layouts')
      .select('*')
      .eq('enabled', true)
      .in('visibility', ['partners', 'public'])
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      if (/positioning_layouts|does not exist|schema cache/i.test(error.message || '')) {
        return sendJson(res, 200, {
          ok: true,
          presets: [],
          setupRequired: true,
          hint: 'Run db/positioning_layouts.sql to enable Themes presets.',
        });
      }
      throw error;
    }

    const presets = (data || []).map(function (row) {
      return positioningLayoutToPresetBlueprint(row);
    });
    return sendJson(res, 200, { ok: true, presets: presets });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String(e.message || e) });
  }
};
