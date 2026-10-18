'use strict';

/**
 * Lead file uploads (Quote form → "File uploads"). Shared by:
 *   api/lead-files/sign.js   — hands out one-time upload URLs
 *   api/leads.js             — attaches the uploaded files to the lead
 *   api/lead-files/open.js   — download links (email token or signed-in editor)
 *   api/cron/lead-files-cleanup.js
 *
 * Files live in the private Supabase bucket "lead-files" (db/lead_files.sql) at
 *   <siteId>/<yyyymm>/<uploadId>/<n>-<safe-name>
 * Supabase Free has 1 GB of storage for the whole org, so the limits below keep
 * lead files well inside it.
 */

const crypto = require('crypto');

const BUCKET = 'lead-files';
const LIMITS = {
  maxFiles: 5,
  maxFileBytes: 10 * 1024 * 1024,
  siteMonthBytes: 100 * 1024 * 1024,
  totalBytes: 500 * 1024 * 1024,
  keepDays: 90,
  orphanHours: 24
};
const TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf'
};
const EXT_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', pdf: 'application/pdf' };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UPLOAD_RE = /^[a-z0-9]{16,40}$/;

/** Quote form settings for uploads. Off unless sections.quote.uploadsOn === true. */
function uploadSettings(config) {
  const q = (config && config.sections && config.sections.quote) || {};
  const max = Math.max(1, Math.min(LIMITS.maxFiles, parseInt(q.uploadsMax, 10) || 3));
  return { on: q.uploadsOn === true, maxFiles: max };
}

/** Allowed content type for a file, from its declared type or its extension; '' when not allowed. */
function typeFor(name, type) {
  const t = String(type || '').toLowerCase().trim();
  if (TYPES[t]) return t;
  const ext = String(name || '').toLowerCase().split('.').pop();
  return EXT_TYPES[ext] || '';
}

/** A storage-safe file name that keeps the extension readable. */
function safeName(name, type) {
  let base = String(name || 'file').normalize('NFKD').replace(/[̀-ͯ]/g, '');
  base = base.replace(/\.[A-Za-z0-9]{1,5}$/, '');
  base = base.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'file';
  return base + '.' + (TYPES[type] || 'bin');
}

function monthKey(d) {
  d = d || new Date();
  return d.getUTCFullYear() + String(d.getUTCMonth() + 1).padStart(2, '0');
}

function newUploadId() {
  return crypto.randomBytes(12).toString('hex');
}

function folderFor(siteId, uploadId, month) {
  return siteId + '/' + (month || monthKey()) + '/' + uploadId;
}

/**
 * Check a requested set of files. Returns { ok, files:[{name,type,size,path}] } or { ok:false, error, message }.
 * @param {{name:string,type:string,size:number}[]} files
 */
function planUpload(siteId, files, settings, usage, opts) {
  opts = opts || {};
  if (!UUID_RE.test(String(siteId || ''))) return { ok: false, error: 'bad_site', message: 'Unknown site.' };
  if (!settings || !settings.on) return { ok: false, error: 'off', message: 'File uploads are not switched on for this form.' };
  const list = Array.isArray(files) ? files : [];
  if (!list.length) return { ok: false, error: 'no_files', message: 'No files to upload.' };
  if (list.length > settings.maxFiles) {
    return { ok: false, error: 'too_many', message: 'You can attach up to ' + settings.maxFiles + ' file' + (settings.maxFiles === 1 ? '' : 's') + '.' };
  }
  let total = 0;
  const out = [];
  const uploadId = opts.uploadId || newUploadId();
  const month = opts.month || monthKey();
  const folder = folderFor(siteId, uploadId, month);
  for (let i = 0; i < list.length; i++) {
    const f = list[i] || {};
    const type = typeFor(f.name, f.type);
    if (!type) return { ok: false, error: 'type', message: '"' + String(f.name || 'file').slice(0, 60) + '" isn’t a photo or PDF.' };
    const size = Math.round(Number(f.size));
    if (!(size > 0)) return { ok: false, error: 'size', message: 'One of the files is empty.' };
    if (size > LIMITS.maxFileBytes) return { ok: false, error: 'too_big', message: '"' + String(f.name || 'file').slice(0, 60) + '" is over 10 MB.' };
    total += size;
    out.push({ name: String(f.name || 'file').slice(0, 120), type, size, path: folder + '/' + (i + 1) + '-' + safeName(f.name, type) });
  }
  usage = usage || {};
  if ((Number(usage.total_bytes) || 0) + total > LIMITS.totalBytes ||
      (Number(usage.site_month_bytes) || 0) + total > LIMITS.siteMonthBytes) {
    return { ok: false, error: 'quota', message: 'File uploads are full at the moment — please send your enquiry without files and we’ll ask for them.' };
  }
  return { ok: true, uploadId, month, folder, files: out };
}

/**
 * Check the files a lead claims against what is really in storage.
 * @param {object} admin service-role client
 * @returns {Promise<{name,path,size,type}[]>} only files that exist in this site's upload folder
 */
async function verifyLeadFiles(admin, siteId, files) {
  if (!files || typeof files !== 'object') return [];
  const uploadId = String(files.uploadId || '');
  const month = String(files.month || '');
  if (!UUID_RE.test(String(siteId || '')) || !UPLOAD_RE.test(uploadId) || !/^\d{6}$/.test(month)) return [];
  const folder = folderFor(siteId, uploadId, month);
  const claimed = (Array.isArray(files.items) ? files.items : []).slice(0, LIMITS.maxFiles);
  const listed = await admin.storage.from(BUCKET).list(folder, { limit: 20 });
  if (listed.error || !Array.isArray(listed.data)) return [];
  const real = {};
  listed.data.forEach(function (o) { if (o && o.name) real[o.name] = o; });
  const out = [];
  claimed.forEach(function (c) {
    if (!c) return;
    const path = String(c.path || '');
    if (path.indexOf(folder + '/') !== 0) return;
    const leaf = path.slice(folder.length + 1);
    const o = real[leaf];
    if (!o) return;
    const meta = o.metadata || {};
    out.push({
      name: String(c.name || leaf).slice(0, 120),
      path,
      size: Number(meta.size) || Number(c.size) || 0,
      type: String(meta.mimetype || c.type || '')
    });
  });
  return out;
}

/* ---------- Download tokens (email links) ----------
 * HMAC over "<leadId>.<index>.<expiry>" with LEAD_FILES_SECRET (or the service key).
 * A link works until the file's retention ends; each open makes a 5-minute storage URL. */
function secret() {
  return String(process.env.LEAD_FILES_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '');
}
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function signToken(leadId, index, expiresAtMs) {
  const s = secret();
  if (!s) return '';
  const exp = Math.floor((expiresAtMs || (Date.now() + LIMITS.keepDays * 86400000)) / 1000);
  const payload = String(leadId) + '.' + Number(index) + '.' + exp;
  const mac = b64url(crypto.createHmac('sha256', s).update(payload).digest()).slice(0, 32);
  return b64url(payload) + '.' + mac;
}
function readToken(token) {
  const s = secret();
  const parts = String(token || '').split('.');
  if (!s || parts.length !== 2) return null;
  let payload;
  try { payload = Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } catch (e) { return null; }
  const want = b64url(crypto.createHmac('sha256', s).update(payload).digest()).slice(0, 32);
  if (want.length !== parts[1].length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(parts[1]))) return null;
  const m = /^([0-9a-f-]{36})\.(\d{1,2})\.(\d{9,11})$/i.exec(payload);
  if (!m) return null;
  if (Number(m[3]) * 1000 < Date.now()) return null;
  return { leadId: m[1], index: Number(m[2]) };
}

function publicBase() {
  return String(process.env.BASE_URL || process.env.PUBLIC_SITE_URL || 'https://www.leadpages.com.au').trim().replace(/\/+$/, '');
}

/** Email-ready links for a stored lead's files: [{ name, size, url }]. */
function emailLinks(leadId, files, createdAtMs) {
  if (!leadId || !Array.isArray(files)) return [];
  const exp = (createdAtMs || Date.now()) + LIMITS.keepDays * 86400000;
  return files.map(function (f, i) {
    const t = signToken(leadId, i, exp);
    return t ? { name: f.name, size: f.size, url: publicBase() + '/api/lead-files/open?t=' + encodeURIComponent(t) } : null;
  }).filter(Boolean);
}

function prettySize(n) {
  n = Number(n) || 0;
  if (n >= 1048576) return (n / 1048576).toFixed(1) + ' MB';
  if (n >= 1024) return Math.round(n / 1024) + ' KB';
  return n + ' B';
}

module.exports = {
  BUCKET,
  LIMITS,
  TYPES,
  uploadSettings,
  typeFor,
  safeName,
  monthKey,
  newUploadId,
  folderFor,
  planUpload,
  verifyLeadFiles,
  signToken,
  readToken,
  emailLinks,
  prettySize
};
