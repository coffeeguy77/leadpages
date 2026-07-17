'use strict';

const {
  requireThemeStudioActor,
  assertDraftAccess,
  json,
  readBody
} = require('../../lib/theme-studio/http-access');
const { getDraft, getVersion } = require('../../lib/theme-studio/store');
const { signPreviewToken, verifyPreviewToken } = require('../../lib/theme-studio/preview-token');
const { renderDraftPreviewHtml } = require('../../lib/theme-studio/render-preview');

function sendHtml(res, html) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(html);
}

module.exports = async function themeStudioPreview(req, res) {
  const url = new URL(req.url || '/', 'http://localhost');
  const token = url.searchParams.get('token') || '';
  const mode = url.searchParams.get('mode') === 'mobile' ? 'mobile' : 'desktop';

  // Signed token path (iframe-friendly, short-lived)
  if (req.method === 'GET' && token) {
    const verified = verifyPreviewToken(token);
    if (!verified.ok) return json(res, 401, { ok: false, error: verified.error });
    const ver = await getVersion(verified.payload.versionId);
    if (!ver.ok || ver.version.draft_id !== verified.payload.draftId) {
      return json(res, 404, { ok: false, error: 'version_not_found' });
    }
    const html = renderDraftPreviewHtml(ver.version.draft_config_json || {}, { mode });
    return sendHtml(res, html);
  }

  // Authenticated mint + optional immediate HTML
  if (req.method === 'POST') {
    const gate = await requireThemeStudioActor(req);
    if (!gate.ok) return json(res, gate.code, { ok: false, error: gate.error, message: gate.message });
    const body = await readBody(req);
    const draftId = String(body.draftId || '').trim();
    const versionId = String(body.versionId || '').trim();
    if (!draftId || !versionId) {
      return json(res, 400, { ok: false, error: 'draftId and versionId required' });
    }
    const got = await getDraft(draftId);
    if (!got.ok) return json(res, 404, { ok: false, error: got.error });
    const access = assertDraftAccess(got.draft, gate.actor);
    if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
    const ver = await getVersion(versionId);
    if (!ver.ok || ver.version.draft_id !== draftId) {
      return json(res, 404, { ok: false, error: 'version_not_found' });
    }

    const signed = signPreviewToken({
      draftId,
      versionId,
      userId: gate.actor.userId
    });
    const previewMode = body.mode === 'mobile' ? 'mobile' : 'desktop';
    if (body.render === true) {
      const html = renderDraftPreviewHtml(ver.version.draft_config_json || {}, { mode: previewMode });
      return sendHtml(res, html);
    }
    return json(res, 200, {
      ok: true,
      token: signed,
      url: '/api/theme-studio/preview?token=' + encodeURIComponent(signed) + '&mode=' + previewMode,
      expiresInSec: 15 * 60,
      notice: 'Signed preview — noindex, forms/tracking disabled, draft config only.'
    });
  }

  if (req.method === 'GET') {
    return json(res, 400, {
      ok: false,
      error: 'token_required',
      message: 'POST to mint a signed preview token, or GET with ?token='
    });
  }

  return json(res, 405, { ok: false, error: 'method_not_allowed' });
};
