'use strict';

/**
 * Lead file downloads. The bucket is private; every open makes a 5-minute storage link.
 *
 *   GET  /api/lead-files/open?t=<token>
 *        Email link (lib/lead-files.js signToken). Redirects to the file.
 *
 *   POST /api/lead-files/open   { leadId }   Authorization: Bearer <supabase session>
 *        Editor (Captured Leads). Same access rule as site backups: super admin, the
 *        site owner or its active partner. Returns { ok, files:[{ name, size, url }] }.
 */

const { createClient } = require('@supabase/supabase-js');
const LF = require('../../lib/lead-files');
const { assertSiteAccess } = require('../../lib/site-backups/service');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const LINK_SECONDS = 300;

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
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

function page(res, code, msg) {
  res.statusCode = code;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>File</title>' +
    '<body style="font-family:system-ui,sans-serif;max-width:520px;margin:15vh auto;padding:0 20px;color:#222">' +
    '<h1 style="font-size:20px">' + msg + '</h1><p style="color:#666">Files sent with a website enquiry are kept for ' + LF.LIMITS.keepDays +
    ' days. Ask the customer to send it again if you still need it.</p></body>');
}

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data ? null : data.user;
  } catch (e) { return null; }
}

async function leadFiles(leadId) {
  const r = await admin.from('leads').select('id,site_id,details').eq('id', leadId).maybeSingle();
  if (r.error || !r.data) return null;
  const det = r.data.details || {};
  return { lead: r.data, files: Array.isArray(det.files) ? det.files : [], expired: det.filesExpired === true };
}

async function signedUrl(path, name) {
  const s = await admin.storage.from(LF.BUCKET).createSignedUrl(path, LINK_SECONDS, { download: name || true });
  return s.error || !s.data ? '' : s.data.signedUrl;
}

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://x');
      const tok = LF.readToken(url.searchParams.get('t'));
      if (!tok) return page(res, 410, 'This file link has expired.');
      const found = await leadFiles(tok.leadId);
      const f = found && found.files[tok.index];
      if (!f || found.expired) return page(res, 410, 'This file is no longer available.');
      const link = await signedUrl(f.path, f.name);
      if (!link) return page(res, 410, 'This file is no longer available.');
      res.statusCode = 302;
      res.setHeader('location', link);
      res.setHeader('cache-control', 'no-store');
      return res.end();
    }

    if (req.method === 'POST') {
      const user = await requireUser(req);
      if (!user) return send(res, 401, { ok: false, error: 'auth', message: 'Sign in to open files.' });
      const body = await readBody(req);
      const found = await leadFiles(String(body.leadId || ''));
      if (!found) return send(res, 404, { ok: false, error: 'lead', message: 'Lead not found.' });
      const access = await assertSiteAccess(admin, user, found.lead.site_id);
      if (!access.ok) return send(res, access.code, { ok: false, error: access.error, message: access.message });
      if (found.expired) return send(res, 200, { ok: true, expired: true, files: [] });
      const files = [];
      for (const f of found.files.slice(0, LF.LIMITS.maxFiles)) {
        files.push({ name: f.name, size: f.size, url: await signedUrl(f.path, f.name) });
      }
      return send(res, 200, { ok: true, files });
    }

    return send(res, 405, { ok: false, error: 'method' });
  } catch (e) {
    console.error('lead-files open error:', e && e.message);
    return send(res, 500, { ok: false, error: 'server' });
  }
};
