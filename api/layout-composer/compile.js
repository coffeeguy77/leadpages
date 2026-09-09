'use strict';

const { sendJson, readBody, requireUser } = require('../../lib/layout-composer/http');
const { compileBlueprintToConfig } = require('../../lib/layout-composer/compile');
const { scratchBlueprint } = require('../../lib/layout-composer/section-catalogue');
const { customisePresetBlueprint } = require('../../lib/layout-composer/preset-adapter');

/**
 * POST /api/layout-composer/compile
 * Body: { blueprint, identity?, baseConfig?, confirm? }
 * Compiles a confirmed blueprint into a sites.config skeleton.
 */
module.exports = async function layoutComposerCompile(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('allow', 'POST, OPTIONS');
    return sendJson(res, 204, {});
  }
  if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'POST only' });

  const user = await requireUser(req);
  if (!user) return sendJson(res, 401, { ok: false, error: 'Sign in required' });

  const body = await readBody(req);
  let blueprint = body.blueprint;
  if (!blueprint && body.scratch) {
    blueprint = scratchBlueprint(body.name || 'Scratch layout');
  }
  if (!blueprint && body.customisePreset) {
    blueprint = customisePresetBlueprint(body.customisePreset, { userId: user.id });
  }
  if (!blueprint || typeof blueprint !== 'object') {
    return sendJson(res, 400, { ok: false, error: 'blueprint is required' });
  }
  if (body.confirm !== true && body.requireConfirm !== false) {
    // Soft gate: client should set confirm:true after user confirms structure
    if (body.requireConfirm === true) {
      return sendJson(res, 400, {
        ok: false,
        needsConfirmation: true,
        error: 'Confirm the layout before compiling.',
      });
    }
  }

  try {
    const result = compileBlueprintToConfig(blueprint, {
      baseConfig: body.baseConfig || null,
      identity: body.identity || {},
      confirmedAt: body.confirm ? new Date().toISOString() : null,
      disableMissing: body.disableMissing !== false,
    });
    return sendJson(res, 200, {
      ok: true,
      config: result.config,
      sectionOrder: result.sectionOrder,
      enabledKeys: result.enabledKeys,
      warnings: result.warnings,
      blueprint: blueprint,
    });
  } catch (e) {
    return sendJson(res, 500, { ok: false, error: String(e.message || e) });
  }
};
