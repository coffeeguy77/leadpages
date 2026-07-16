/**
 * Super-admin gate for billing accounting APIs.
 * Accepts SUPER_ADMIN_EMAILS or profiles.is_super_admin.
 */
const { sb, getUser, isAdminEmail, json } = require('./_stripe');

async function isSuperAdmin(user) {
  if (!user || !user.id) return false;
  if (isAdminEmail(user.email)) return true;
  try {
    const r = await sb.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch (_e) {
    return false;
  }
}

async function requireSuper(req, res) {
  const user = await getUser(req);
  if (!user) {
    json(res, 401, { ok: false, error: 'unauthorized' });
    return null;
  }
  if (!(await isSuperAdmin(user))) {
    json(res, 403, { ok: false, error: 'admins only' });
    return null;
  }
  return user;
}

function readBody(req) {
  return new Promise(function(resolve) {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch (_e) { return resolve({}); }
      }
      return resolve(req.body);
    }
    var raw = '';
    req.on('data', function(c) { raw += c; });
    req.on('end', function() {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (_e) { resolve({}); }
    });
    req.on('error', function() { resolve({}); });
  });
}

function monthKey(d) {
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return null;
  return x.getUTCFullYear() + '-' + String(x.getUTCMonth() + 1).padStart(2, '0');
}

function lastNMonths(n) {
  const out = [];
  const now = new Date();
  for (var i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    out.push(monthKey(d));
  }
  return out;
}

module.exports = {
  sb,
  getUser,
  isAdminEmail,
  isSuperAdmin,
  requireSuper,
  readBody,
  json,
  monthKey,
  lastNMonths
};
