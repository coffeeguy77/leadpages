'use strict';

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody,
  admin
} = require('../../lib/theme-studio/http-access');
const { getDraft, updateDraft, getVersion, createVersion } = require('../../lib/theme-studio/store');
const {
  isThemeStudioLiveApplyEnabled
} = require('../../lib/theme-studio/flag');
const { PROTECTED_FIELDS, WRITABLE_CONFIG_PATHS } = require('../../lib/theme-studio/constants');

const SCOPES = new Set([
  'colours',
  'theme+type',
  'layouts+styling',
  'complete',
  'new_site',
  'demo',
  'my_template'
]);

function pickScopedConfig(draftConfig, scope) {
  const cfg = draftConfig || {};
  if (scope === 'colours') {
    return { theme: cfg.theme || {} };
  }
  if (scope === 'theme+type') {
    return {
      theme: cfg.theme || {},
      name: cfg.name,
      trade: cfg.trade
    };
  }
  if (scope === 'layouts+styling') {
    return {
      theme: cfg.theme || {},
      layout: cfg.layout,
      sectionOrder: cfg.sectionOrder,
      logo: cfg.logo,
      name: cfg.name,
      trade: cfg.trade
    };
  }
  // complete / new_site / demo / my_template — full draft snapshot minus protected
  const out = JSON.parse(JSON.stringify(cfg));
  for (const key of PROTECTED_FIELDS) delete out[key];
  return out;
}

module.exports = async function themeStudioApply(req, res) {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });

  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const body = await readBody(req);
  const draftId = String(body.draftId || '').trim();
  const versionId = String(body.versionId || '').trim();
  const scope = String(body.scope || 'demo');
  const confirm = body.confirm === true;

  if (!draftId || !versionId) {
    return json(res, 400, { ok: false, error: 'draftId and versionId required' });
  }
  if (!SCOPES.has(scope)) {
    return json(res, 400, { ok: false, error: 'invalid_scope', scopes: [...SCOPES] });
  }
  if (!confirm) {
    return json(res, 400, {
      ok: false,
      error: 'confirm_required',
      message: 'Set confirm:true after reviewing the preserve/replace summary.',
      allowlist: WRITABLE_CONFIG_PATHS,
      protectedFields: PROTECTED_FIELDS
    });
  }

  const got = await getDraft(draftId);
  if (!got.ok) return json(res, 404, { ok: false, error: got.error });
  const access = assertDraftAccess(got.draft, gate.actor);
  if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

  const ver = await getVersion(versionId);
  if (!ver.ok || ver.version.draft_id !== draftId) {
    return json(res, 404, { ok: false, error: 'version_not_found' });
  }

  const scoped = pickScopedConfig(ver.version.draft_config_json, scope);

  // Always persist applied snapshot on the draft workspace
  const updated = await updateDraft(draftId, {
    selected_concept_id: ver.version.concept_id,
    selected_version_id: versionId,
    applied_config: scoped,
    status: scope === 'demo' || scope === 'new_site' || scope === 'complete' ? 'applied' : got.draft.status
  });
  if (!updated.ok) return json(res, 500, { ok: false, error: updated.error });

  await createVersion({
    draft_id: draftId,
    concept_id: ver.version.concept_id,
    kind: 'apply',
    concept_json: ver.version.concept_json,
    draft_config_json: scoped,
    adapter_warnings: [{ code: 'apply_scope', message: 'Applied scope: ' + scope }],
    created_by: gate.actor.userId
  });

  let targetSite = null;
  let liveWrite = false;

  if (scope === 'demo' || scope === 'new_site') {
    // Create a non-live demo/draft site — never status=live
    const concept = ver.version.concept_json || {};
    const bp = concept.businessProfile || {};
    const baseSlug =
      String(bp.businessName || 'theme-studio')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 40) || 'theme-studio';
    const slug = (baseSlug + '-ts-' + String(Date.now()).slice(-6)).slice(0, 60);
    const row = {
      slug,
      business_name: bp.businessName || scoped.name || 'Theme Studio Draft',
      template: 'trade',
      vertical: 'trade',
      status: 'draft',
      is_demo: scope === 'demo',
      is_mockup: true,
      owner_user_id: gate.actor.userId,
      servicing_partner_id: gate.actor.partnerId || null,
      config: scoped
    };
    const { data, error } = await admin.from('sites').insert(row).select('id,slug,status,is_demo').single();
    if (error) {
      // Still success for draft apply if site insert fails (e.g. local/test)
      return json(res, 200, {
        ok: true,
        appliedTo: 'draft_workspace',
        draft: updated.draft,
        siteError: error.message,
        notice: 'Concept stored on draft. Site row not created: ' + error.message,
        liveWrite: false
      });
    }
    targetSite = data;
    await updateDraft(draftId, { target_site_id: data.id });
  } else if (body.applyToSource === true && got.draft.source_site_id) {
    if (!isThemeStudioLiveApplyEnabled()) {
      return json(res, 403, {
        ok: false,
        error: 'live_apply_disabled',
        message:
          'Live site apply is disabled. Applied to draft workspace only. Set THEME_STUDIO_ALLOW_LIVE_APPLY=1 to enable controlled live writes.',
        draft: updated.draft,
        liveWrite: false
      });
    }
    const siteGate = await requireThemeStudioActor(req, { siteId: got.draft.source_site_id });
    if (!siteGate.ok) {
      return json(res, siteGate.code, { ok: false, error: siteGate.error });
    }
    const site = siteGate.siteAccess.site;
    if (site.status === 'live' && body.confirmLive !== true) {
      return json(res, 400, {
        ok: false,
        error: 'confirm_live_required',
        message: 'Live site apply requires confirmLive:true'
      });
    }
    const merged = { ...(site.config || {}) };
    for (const key of Object.keys(scoped)) {
      if (PROTECTED_FIELDS.includes(key)) continue;
      merged[key] = scoped[key];
    }
    const { error } = await admin
      .from('sites')
      .update({ config: merged, updated_at: new Date().toISOString() })
      .eq('id', site.id);
    if (error) return json(res, 500, { ok: false, error: error.message });
    liveWrite = true;
    targetSite = { id: site.id, slug: site.slug, status: site.status };
  }

  return json(res, 200, {
    ok: true,
    scope,
    appliedTo: targetSite ? 'site' : 'draft_workspace',
    targetSite,
    draft: updated.draft,
    liveWrite,
    preserved: PROTECTED_FIELDS,
    notice: liveWrite
      ? 'Scoped fields written to site. Protected operational fields preserved.'
      : 'Applied to Theme Studio draft workspace (and optional non-live demo site). Live production sites unchanged.'
  });
};
