'use strict';

const { randomUUID } = require('crypto');
const httpAccess = require('../../lib/theme-studio/http-access');
const store = require('../../lib/theme-studio/store');
const previewToken = require('../../lib/theme-studio/preview-token');
const renderPreview = require('../../lib/theme-studio/render-preview');

function sendHtml(res, html) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.end(html);
}

function fail(res, status, payload) {
  const body = Object.assign({ ok: false, diagnosticId: randomUUID() }, payload || {});
  if (!body.message && body.error) body.message = String(body.error);
  return httpAccess.json(res, status, body);
}

module.exports = async function themeStudioPreview(req, res) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const token = url.searchParams.get('token') || '';
    const mode = url.searchParams.get('mode') === 'mobile' ? 'mobile' : 'desktop';

    // Signed token path (iframe-friendly, short-lived)
    if (req.method === 'GET' && token) {
      const verified = previewToken.verifyPreviewToken(token);
      if (!verified.ok) return fail(res, 401, { error: verified.error });
      const ver = await store.getVersion(verified.payload.versionId);
      if (!ver.ok || ver.version.draft_id !== verified.payload.draftId) {
        return fail(res, 404, { error: 'version_not_found' });
      }
      const html = renderPreview.renderDraftPreviewHtml(ver.version.draft_config_json || {}, {
        mode
      });
      return sendHtml(res, html);
    }

    // Authenticated mint + optional immediate HTML
    if (req.method === 'POST') {
      const gate = await httpAccess.requireThemeStudioActor(req);
      if (!gate.ok) {
        return fail(res, gate.code, {
          error: gate.error,
          message: gate.message || gate.error
        });
      }
      const body = await httpAccess.readBody(req);
      const draftId = String(body.draftId || '').trim();
      const versionId = String(body.versionId || '').trim();
      if (!draftId || !versionId) {
        return fail(res, 400, { error: 'draftId and versionId required' });
      }
      const got = await store.getDraft(draftId);
      if (!got.ok) return fail(res, 404, { error: got.error });
      const access = httpAccess.assertDraftAccess(got.draft, gate.actor);
      if (!access.ok) return fail(res, access.code, { error: access.error });
      const ver = await store.getVersion(versionId);
      if (!ver.ok || ver.version.draft_id !== draftId) {
        return fail(res, 404, { error: 'version_not_found' });
      }

      const signed = previewToken.signPreviewToken({
        draftId,
        versionId,
        userId: gate.actor.userId
      });
      const previewMode = body.mode === 'mobile' ? 'mobile' : 'desktop';
      if (body.render === true) {
        const html = renderPreview.renderDraftPreviewHtml(ver.version.draft_config_json || {}, {
          mode: previewMode
        });
        return sendHtml(res, html);
      }
      return httpAccess.json(res, 200, {
        ok: true,
        token: signed,
        url:
          '/api/theme-studio/preview?token=' +
          encodeURIComponent(signed) +
          '&mode=' +
          previewMode,
        expiresInSec: 15 * 60,
        notice: 'Signed preview — noindex, forms/tracking disabled, draft config only.'
      });
    }

    if (req.method === 'GET') {
      return fail(res, 400, {
        error: 'token_required',
        message: 'POST to mint a signed preview token, or GET with ?token='
      });
    }

    return fail(res, 405, { error: 'method_not_allowed' });
  } catch (err) {
    const diagnosticId = randomUUID();
    console.error('[theme-studio/preview]', diagnosticId, err && err.stack ? err.stack : err);
    return httpAccess.json(res, 500, {
      ok: false,
      diagnosticId,
      error: 'preview_exception',
      message: (err && err.message) || 'Preview render failed'
    });
  }
};
