'use strict';

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody,
  admin
} = require('../../lib/theme-studio/http-access');
const {
  createDraft,
  getDraft,
  updateDraft,
  listDraftsForOwner,
  listVersions
} = require('../../lib/theme-studio/store');
const { normalizeBrief } = require('../../lib/theme-studio/generate');
const { PROTECTED_FIELDS } = require('../../lib/theme-studio/constants');

function omitProtectedConfig(config) {
  if (!config || typeof config !== 'object') return {};
  const out = JSON.parse(JSON.stringify(config));
  for (const key of PROTECTED_FIELDS) delete out[key];
  return out;
}

module.exports = async function themeStudioDrafts(req, res) {
  const gate = await requireThemeStudioActor(req);
  if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });

  const url = new URL(req.url || '/', 'http://localhost');
  const draftId = url.searchParams.get('id') || '';

  if (req.method === 'GET' && !draftId) {
    const listed = await listDraftsForOwner(gate.actor.userId, 30);
    if (!listed.ok) return json(res, 500, { ok: false, error: listed.error });
    return json(res, 200, { ok: true, drafts: listed.drafts });
  }

  if (req.method === 'GET' && draftId) {
    const got = await getDraft(draftId);
    if (!got.ok) return json(res, 404, { ok: false, error: got.error });
    const access = assertDraftAccess(got.draft, gate.actor);
    if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
    const versions = await listVersions(draftId);
    return json(res, 200, {
      ok: true,
      draft: got.draft,
      versions: versions.ok ? versions.versions : []
    });
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const mode = String(body.mode || 'new');
    const brief = normalizeBrief(body.brief || body);
    if (!brief.businessName || !brief.industry) {
      return json(res, 400, {
        ok: false,
        error: 'brief_incomplete',
        message: 'businessName and industry are required'
      });
    }

    let sourceSnapshot = null;
    const sourceSiteId = body.sourceSiteId ? String(body.sourceSiteId) : null;
    if (sourceSiteId) {
      const siteGate = await requireThemeStudioActor(req, { siteId: sourceSiteId });
      if (!siteGate.ok) {
        return json(res, siteGate.code, { ok: false, error: siteGate.error, message: siteGate.message });
      }
      sourceSnapshot = omitProtectedConfig(siteGate.siteAccess.site.config || {});
    }

    const created = await createDraft({
      owner_user_id: gate.actor.userId,
      partner_id: gate.actor.partnerId || null,
      mode,
      source_site_id: sourceSiteId,
      foundation_id: body.foundationId || null,
      brief,
      meta: {
        sourceSnapshot,
        desiredStyle: brief.desiredStyle
      }
    });
    if (!created.ok) return json(res, 500, { ok: false, error: created.error });
    return json(res, 200, {
      ok: true,
      draft: created.draft,
      store: created.store,
      notice: created.notice || null
    });
  }

  if (req.method === 'PATCH' && draftId) {
    const body = await readBody(req);
    const got = await getDraft(draftId);
    if (!got.ok) return json(res, 404, { ok: false, error: got.error });
    const access = assertDraftAccess(got.draft, gate.actor);
    if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

    const patch = {};
    if (body.brief) patch.brief = normalizeBrief(body.brief);
    if (body.foundationId != null) patch.foundation_id = body.foundationId || null;
    if (body.status === 'cancelled') patch.status = 'cancelled';

    const updated = await updateDraft(draftId, patch);
    if (!updated.ok) return json(res, 500, { ok: false, error: updated.error });
    return json(res, 200, { ok: true, draft: updated.draft });
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
