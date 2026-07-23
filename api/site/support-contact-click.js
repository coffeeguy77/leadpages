// api/site/support-contact-click.js — log client clicks on the support contact badge.
// Editing login is separate from billing; this records which client account clicked
// Message / Call so the servicing partner can see it under their account.
//
// POST { siteId, button: 'message'|'call'|'dismiss', note? }
// Auth: site owner (owner_email / owner_user_id) or super-admin.

'use strict';

const { createClient } = require('@supabase/supabase-js');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const r = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: { apikey: process.env.SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token }
    });
    if (!r.ok) return null;
    const u = await r.json();
    if (!u || !u.id) return null;
    return { id: u.id, email: String(u.email || '').toLowerCase() };
  } catch (_e) {
    return null;
  }
}

async function isSuper(userId) {
  try {
    const r = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch (_e) {
    return false;
  }
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

module.exports = async function supportContactClick(req, res) {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: 'POST only' }));
  }

  const user = await getUser(req);
  if (!user) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: 'unauthorized' }));
  }

  const body = await readBody(req);
  const siteId = String((body && body.siteId) || '').trim();
  const button = String((body && body.button) || '').trim().toLowerCase();
  if (!siteId) {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'siteId required' }));
  }
  if (button !== 'message' && button !== 'call' && button !== 'dismiss') {
    res.statusCode = 400;
    return res.end(JSON.stringify({ ok: false, error: 'button must be message, call, or dismiss' }));
  }

  try {
    const { data: site } = await admin
      .from('sites')
      .select('id,slug,business_name,owner_email,owner_user_id,servicing_partner_id')
      .eq('id', siteId)
      .maybeSingle();
    if (!site) {
      res.statusCode = 404;
      return res.end(JSON.stringify({ ok: false, error: 'site not found' }));
    }

    const superAdmin = await isSuper(user.id);
    const isOwner =
      (site.owner_user_id && String(site.owner_user_id) === String(user.id)) ||
      (site.owner_email && String(site.owner_email).toLowerCase() === user.email);
    if (!superAdmin && !isOwner) {
      res.statusCode = 403;
      return res.end(JSON.stringify({ ok: false, error: 'owners only' }));
    }
    if (!site.servicing_partner_id) {
      res.statusCode = 200;
      return res.end(JSON.stringify({ ok: true, logged: false, reason: 'no_servicing_partner' }));
    }

    const label = button === 'message' ? 'Message' : button === 'call' ? 'Call' : 'Dismiss';
    const note =
      String((body && body.note) || '').trim() ||
      (label +
        ' clicked on support contact badge by ' +
        (user.email || 'client') +
        ' for ' +
        (site.business_name || site.slug || site.id));

    const row = {
      actor_id: user.id,
      actor_email: user.email || null,
      action: 'support_contact_' + button,
      partner_id: site.servicing_partner_id,
      site_id: site.id,
      detail: {
        button: button,
        note: note,
        site_slug: site.slug || null,
        business_name: site.business_name || null,
        owner_email: site.owner_email || user.email || null,
        client_user_id: user.id,
        at: new Date().toISOString()
      }
    };

    const { error } = await admin.from('partner_audit_logs').insert(row);
    if (error) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ ok: false, error: error.message }));
    }

    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: true, logged: true, action: row.action, note: note }));
  } catch (e) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
  }
};
