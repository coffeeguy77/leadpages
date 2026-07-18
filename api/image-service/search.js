'use strict';

/**
 * POST /api/image-service/search
 * Server-side Pexels (or mock) search for Website Studio image replacement.
 * Never returns API keys.
 */

const { requireThemeStudioActor, json, readBody } = require('../../lib/theme-studio/http-access');
const { resolveImageBrief, assertAiImageAccess, createImageBrief } = require('../../lib/image-service');

module.exports = async function imageServiceSearch(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  if (body.provider === 'ai-images' || body.forceAi) {
    const aiGate = assertAiImageAccess(gate.actor);
    if (!aiGate.ok) return json(res, aiGate.code, { ok: false, error: aiGate.error, message: aiGate.message });
  }

  const brief = createImageBrief(body.brief || body);
  if (body.query) brief.subject = String(body.query);

  const resolved = await resolveImageBrief(brief, {
    actor: gate.actor,
    allowMock: true,
    preferProvider: body.provider,
    forceAi: !!body.forceAi,
    ownedCloudinaryAssets: Array.isArray(body.ownedCloudinaryAssets) ? body.ownedCloudinaryAssets : []
  });

  return json(res, resolved.ok ? 200 : 422, {
    ok: resolved.ok,
    selection: resolved.selection,
    alternates: resolved.alternates || [],
    diagnostics: {
      queriesUsed: resolved.diagnostics && resolved.diagnostics.queriesUsed,
      selectedProvider: resolved.diagnostics && resolved.diagnostics.selectedProvider,
      selectedAssetId: resolved.diagnostics && resolved.diagnostics.selectedAssetId,
      rejectedCount: resolved.diagnostics && resolved.diagnostics.rejected
        ? resolved.diagnostics.rejected.length
        : 0
    },
    placeholder: !!resolved.placeholder,
    error: resolved.error,
    message: resolved.message
  });
};
