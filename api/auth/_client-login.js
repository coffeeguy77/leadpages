'use strict';

const { createClient } = require('@supabase/supabase-js');

const BASE = process.env.SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = process.env.SUPABASE_ANON_KEY;

let _sb = null;
function getSb() {
  if (_sb) return _sb;
  if (!BASE || !SVC) throw new Error('supabaseUrl is required.');
  _sb = createClient(BASE, SVC);
  return _sb;
}

function authHeaders() {
  return { apikey: SVC, Authorization: 'Bearer ' + SVC, 'Content-Type': 'application/json' };
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(BASE + '/auth/v1/user', {
      headers: { apikey: ANON, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    return await r.json();
  } catch (_e) {
    return null;
  }
}

function isAdminEmail(email) {
  const list = (process.env.SUPER_ADMIN_EMAILS || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  return !!email && list.includes(String(email || '').toLowerCase());
}

async function isSuperAdmin(user) {
  if (!user || !user.id) return false;
  if (isAdminEmail(user.email)) return true;
  try {
    const r = await getSb().from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch (_e) {
    return false;
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

async function findUserByEmail(email) {
  email = normalizeEmail(email);
  if (!email || !BASE || !SVC) return null;
  const AHEAD = authHeaders();
  for (let page = 1; page <= 12; page++) {
    let r;
    try {
      r = await fetch(BASE + '/auth/v1/admin/users?page=' + page + '&per_page=200', { headers: AHEAD });
    } catch (_e) {
      return null;
    }
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    const users = j.users || (Array.isArray(j) ? j : []);
    const hit = users.find((u) => normalizeEmail(u.email) === email);
    if (hit) return hit;
    if (!users.length || users.length < 200) break;
  }
  return null;
}

async function createUser(email, password) {
  email = normalizeEmail(email);
  if (!email || !BASE || !SVC) return null;
  const body = { email: email, email_confirm: true };
  if (password) body.password = String(password);
  let r;
  try {
    r = await fetch(BASE + '/auth/v1/admin/users', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body)
    });
  } catch (_e) {
    return null;
  }
  const j = await r.json().catch(() => ({}));
  if (r.ok && j && j.id) return j;
  return null;
}

async function findOrCreateUser(email, password) {
  email = normalizeEmail(email);
  let user = await findUserByEmail(email);
  if (user) return { user: user, created: false };
  user = await createUser(email, password);
  if (user) return { user: user, created: true };
  user = await findUserByEmail(email);
  return user ? { user: user, created: false } : null;
}

async function setUserPassword(userId, password) {
  if (!userId || !password || !BASE || !SVC) return { ok: false, error: 'missing params' };
  let r;
  try {
    r = await fetch(BASE + '/auth/v1/admin/users/' + encodeURIComponent(userId), {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ password: String(password) })
    });
  } catch (e) {
    return { ok: false, error: String(e.message || e) };
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { ok: false, error: (j && j.msg) || (j && j.error) || ('HTTP ' + r.status) };
  return { ok: true, user: j };
}

async function stampSiteOwner(siteId, email, userId) {
  email = normalizeEmail(email);
  const patch = { owner_email: email || null, owner_user_id: userId || null };
  const { error } = await getSb().from('sites').update(patch).eq('id', siteId);
  if (error) return { ok: false, error: error.message };
  if (email && userId) {
    await getSb().from('sites').update({ owner_user_id: userId }).eq('owner_email', email).is('owner_user_id', null);
  }
  return { ok: true };
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body) {
      if (typeof req.body === 'string') {
        try {
          return resolve(JSON.parse(req.body));
        } catch (_e) {
          return resolve({});
        }
      }
      return resolve(req.body);
    }
    var raw = '';
    req.on('data', function (c) {
      raw += c;
    });
    req.on('end', function () {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_e) {
        resolve({});
      }
    });
    req.on('error', function () {
      resolve({});
    });
  });
}

module.exports = {
  getSb,
  json,
  getUser,
  isAdminEmail,
  isSuperAdmin,
  normalizeEmail,
  findUserByEmail,
  createUser,
  findOrCreateUser,
  setUserPassword,
  stampSiteOwner,
  readBody
};
