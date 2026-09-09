'use strict';

/**
 * GET /api/layout-composer/presets
 *
 * Preset Designs = live Themes Builder rows (`positioning_layouts`).
 * Same source as manage Themes / partner apply — cafe, landscaper, mechanic,
 * and every future layout created in Themes.
 *
 * Read-only catalogue: no auth required (service role). Filter matches the
 * partner Themes list: enabled + visibility in partners|public.
 * Customise is always a client-side copy; this endpoint never mutates Themes.
 */

const { sendJson, requireUser, admin } = require('../../lib/layout-composer/http');
const {
  positioningLayoutToPresetBlueprint,
} = require('../../lib/layout-composer/preset-adapter');

function tableMissing(err) {
  const m = String((err && err.message) || err || '');
  return /positioning_layouts|does not exist|schema cache/i.test(m);
}

module.exports = async function layoutComposerPresets(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'GET, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'GET') return sendJson(res, 405, { ok: false, error: 'GET only' });

  // Optional: only used for signedIn flag in the response.
  const user = await requireUser(req);

  try {
    // Same query shape as GET /api/api-positioning-layouts for partners.
    let q = admin
      .from('positioning_layouts')
      .select('*')
      .eq('enabled', true)
      .in('visibility', ['partners', 'public'])
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    let { data, error } = await q;

    // Fallback order if created_at unavailable (public-demos uses updated_at).
    if (error && /created_at/i.test(String(error.message || ''))) {
      q = admin
        .from('positioning_layouts')
        .select('*')
        .eq('enabled', true)
        .in('visibility', ['partners', 'public'])
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false });
      ({ data, error } = await q);
    }

    if (error) {
      if (tableMissing(error)) {
        return sendJson(res, 200, {
          ok: true,
          presets: [],
          setupRequired: true,
          signedIn: !!user,
          source: 'positioning_layouts',
          hint: 'Run db/positioning_layouts.sql to enable Themes presets.',
        });
      }
      throw error;
    }

    const presets = (data || []).map(function (row) {
      return positioningLayoutToPresetBlueprint(row);
    });

    return sendJson(res, 200, {
      ok: true,
      presets: presets,
      signedIn: !!user,
      source: 'positioning_layouts',
      hint: presets.length
        ? null
        : 'No Themes presets yet. Create layouts in Themes Builder (cafe, landscaper, mechanic, …) — they appear here automatically.',
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String(e.message || e) });
  }
};
