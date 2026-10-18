'use strict';

/**
 * POST /api/lead-files/sign
 * Body: { siteId, files: [{ name, type, size }] }
 *
 * Public (website visitors). Checks the site has Quote form → File uploads switched on,
 * the file count / types / sizes and the storage caps, then returns one-time signed
 * upload URLs for the private "lead-files" bucket. Files go straight from the browser
 * to Supabase Storage (never through Vercel). See lib/lead-files.js.
 *
 * Response: { ok, uploadId, month, uploads: [{ name, type, size, path, url }] }
 *        or { ok:false, error, message } (message is shown to the visitor).
 */

const { createClient } = require('@supabase/supabase-js');
const { limited } = require('../_rate-limit');
const LF = require('../../lib/lead-files');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 20000) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function send(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'method', message: 'POST only' });
  if (limited(req, { key: 'lead-files-sign', max: 8, windowMs: 10 * 60000 })) {
    return send(res, 429, { ok: false, error: 'rate', message: 'Too many uploads just now — please send your enquiry without files and we’ll ask for them.' });
  }
  try {
    const body = await readBody(req);
    const siteId = String(body.siteId || '').trim();
    const site = await admin.from('sites').select('id,status,config').eq('id', siteId).maybeSingle();
    if (site.error || !site.data || site.data.status !== 'live') {
      return send(res, 404, { ok: false, error: 'site', message: 'File uploads aren’t available on this form.' });
    }
    const settings = LF.uploadSettings(site.data.config);
    let usage = { site_month_bytes: 0, total_bytes: 0 };
    const u = await admin.rpc('lead_files_usage', { p_site: siteId });
    if (u.error) {
      console.error('lead-files usage:', u.error.message);
      return send(res, 503, { ok: false, error: 'usage', message: 'File uploads aren’t available right now — please send your enquiry without files.' });
    }
    if (Array.isArray(u.data) && u.data[0]) usage = u.data[0];

    const plan = LF.planUpload(siteId, body.files, settings, usage);
    if (!plan.ok) return send(res, 400, plan);

    const uploads = [];
    for (const f of plan.files) {
      const s = await admin.storage.from(LF.BUCKET).createSignedUploadUrl(f.path);
      if (s.error || !s.data) {
        console.error('lead-files sign:', s.error && s.error.message);
        return send(res, 503, { ok: false, error: 'sign', message: 'File uploads aren’t available right now — please send your enquiry without files.' });
      }
      uploads.push({ name: f.name, type: f.type, size: f.size, path: f.path, url: s.data.signedUrl });
    }
    return send(res, 200, { ok: true, uploadId: plan.uploadId, month: plan.month, uploads });
  } catch (e) {
    console.error('lead-files sign error:', e && e.message);
    return send(res, 500, { ok: false, error: 'server', message: 'File uploads aren’t available right now — please send your enquiry without files.' });
  }
};
