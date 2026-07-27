// api/lead-notify-style.js — super-admin CRUD + preview for lead notification email styles.

const { createClient } = require('@supabase/supabase-js');
const { buildLeadNotifyEmail } = require('../lib/lead-notify-email');
const {
  DEFAULT_STYLE,
  normalizeStyle,
  resolveLeadNotifyStyle
} = require('../lib/lead-notify-style');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function json(res, code, body) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
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
    let raw = '';
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

async function getUser(req) {
  const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  try {
    const ur = await fetch(process.env.SUPABASE_URL + '/auth/v1/user', {
      headers: {
        apikey: process.env.SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + token
      }
    });
    const user = await ur.json();
    if (!user || !user.id) return null;
    return user;
  } catch (_e) {
    return null;
  }
}

async function isSuperAdmin(user) {
  if (!user || !user.id) return false;
  const list = (process.env.SUPER_ADMIN_EMAILS || '')
    .toLowerCase()
    .split(/[,\s]+/)
    .filter(Boolean);
  if (user.email && list.includes(String(user.email).toLowerCase())) return true;
  try {
    const r = await sb
      .from('profiles')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle();
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
    json(res, 403, { ok: false, error: 'super_admin_only' });
    return null;
  }
  return user;
}

const SAMPLE_LEAD = {
  name: 'Shaun Test',
  phone: '0414631460',
  email: 'shaun@example.com'
};

const SAMPLE_DETAILS = {
  job: 'Birthday party',
  suburb: 'Canberra',
  detail: 'Testing the form\nDoes drop a line work\nOr does it come out as one long sentence.'
};

function previewPayload(body) {
  const style = normalizeStyle(body.style || DEFAULT_STYLE);
  const business = String(body.business || 'Bean Culture').trim().slice(0, 160);
  const slug = String(body.slug || 'beanculture').trim().slice(0, 80);
  const mail = buildLeadNotifyEmail({
    business,
    slug,
    lead: body.lead || SAMPLE_LEAD,
    details: body.details || SAMPLE_DETAILS,
    style
  });
  return { style, mail };
}

async function ensureGlobalDefault(user) {
  const existing = await sb
    .from('lead_notify_email_styles')
    .select('id')
    .is('site_id', null)
    .eq('is_global_default', true)
    .maybeSingle();
  if (existing.data) return existing.data.id;

  const ins = await sb
    .from('lead_notify_email_styles')
    .insert({
      site_id: null,
      name: 'Global default',
      is_active: false,
      is_global_default: true,
      style: DEFAULT_STYLE,
      created_by: user.id,
      updated_at: new Date().toISOString()
    })
    .select('id')
    .maybeSingle();
  return ins.data && ins.data.id;
}

async function listPresets(siteId) {
  const global = await sb
    .from('lead_notify_email_styles')
    .select('id,site_id,name,is_active,is_global_default,style,updated_at')
    .is('site_id', null)
    .order('updated_at', { ascending: false });

  let site = { data: [] };
  if (siteId) {
    site = await sb
      .from('lead_notify_email_styles')
      .select('id,site_id,name,is_active,is_global_default,style,updated_at')
      .eq('site_id', siteId)
      .order('updated_at', { ascending: false });
  }

  return {
    global: global.data || [],
    site: site.data || [],
    globalError: global.error ? global.error.message : null,
    siteError: site.error ? site.error.message : null
  };
}

module.exports = async (req, res) => {
  const user = await requireSuper(req, res);
  if (!user) return;

  if (req.method === 'GET') {
    const q = req.query || {};
    const action = String(q.action || 'list').toLowerCase();
    const siteId = q.siteId ? String(q.siteId).trim() : '';

    if (action === 'defaults') {
      return json(res, 200, { ok: true, defaults: DEFAULT_STYLE });
    }

    if (action === 'resolve') {
      const resolved = await resolveLeadNotifyStyle(sb, siteId || null);
      return json(res, 200, { ok: true, resolved });
    }

    if (action === 'preview') {
      const style = normalizeStyle(q.style ? JSON.parse(q.style) : DEFAULT_STYLE);
      const mail = buildLeadNotifyEmail({
        business: q.business || 'Bean Culture',
        slug: q.slug || 'beanculture',
        lead: SAMPLE_LEAD,
        details: SAMPLE_DETAILS,
        style
      });
      return json(res, 200, { ok: true, html: mail.html, subject: mail.subject, style });
    }

    await ensureGlobalDefault(user);
    const lists = await listPresets(siteId || null);
    return json(res, 200, { ok: true, defaults: DEFAULT_STYLE, ...lists });
  }

  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const action = String(body.action || '').toLowerCase();

  if (action === 'preview') {
    const { style, mail } = previewPayload(body);
    return json(res, 200, { ok: true, html: mail.html, subject: mail.subject, style });
  }

  if (action === 'save_global') {
    const style = normalizeStyle(body.style || DEFAULT_STYLE);
    const name = String(body.name || 'Global default').trim().slice(0, 120) || 'Global default';
    const setDefault = body.setDefault !== false;

    if (setDefault) {
      await sb
        .from('lead_notify_email_styles')
        .update({ is_global_default: false, updated_at: new Date().toISOString() })
        .is('site_id', null)
        .eq('is_global_default', true);
    }

    const row = {
      site_id: null,
      name,
      style,
      is_global_default: setDefault,
      is_active: false,
      created_by: user.id,
      updated_at: new Date().toISOString()
    };

    const ins = await sb.from('lead_notify_email_styles').insert(row).select('*').single();
    if (ins.error) {
      return json(res, 500, { ok: false, error: ins.error.message });
    }
    return json(res, 200, { ok: true, preset: ins.data });
  }

  if (action === 'save_site') {
    const siteId = String(body.siteId || '').trim();
    if (!siteId) return json(res, 400, { ok: false, error: 'siteId_required' });

    const style = normalizeStyle(body.style || DEFAULT_STYLE);
    const name = String(body.name || 'Custom').trim().slice(0, 120) || 'Custom';
    const setActive = body.setActive !== false;

    if (setActive) {
      await sb
        .from('lead_notify_email_styles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('site_id', siteId)
        .eq('is_active', true);
    }

    const row = {
      site_id: siteId,
      name,
      style,
      is_active: setActive,
      is_global_default: false,
      created_by: user.id,
      updated_at: new Date().toISOString()
    };

    const ins = await sb.from('lead_notify_email_styles').insert(row).select('*').single();
    if (ins.error) {
      return json(res, 500, { ok: false, error: ins.error.message });
    }
    return json(res, 200, { ok: true, preset: ins.data });
  }

  if (action === 'activate') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { ok: false, error: 'id_required' });

    const got = await sb
      .from('lead_notify_email_styles')
      .select('id,site_id,is_global_default')
      .eq('id', id)
      .maybeSingle();
    if (!got.data) return json(res, 404, { ok: false, error: 'not_found' });

    const row = got.data;
    if (row.site_id) {
      await sb
        .from('lead_notify_email_styles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('site_id', row.site_id)
        .eq('is_active', true);
      await sb
        .from('lead_notify_email_styles')
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq('id', id);
    } else {
      await sb
        .from('lead_notify_email_styles')
        .update({ is_global_default: false, updated_at: new Date().toISOString() })
        .is('site_id', null)
        .eq('is_global_default', true);
      await sb
        .from('lead_notify_email_styles')
        .update({ is_global_default: true, updated_at: new Date().toISOString() })
        .eq('id', id);
    }

    const fresh = await sb.from('lead_notify_email_styles').select('*').eq('id', id).maybeSingle();
    return json(res, 200, { ok: true, preset: fresh.data });
  }

  if (action === 'clear_site') {
    const siteId = String(body.siteId || '').trim();
    if (!siteId) return json(res, 400, { ok: false, error: 'siteId_required' });

    const up = await sb
      .from('lead_notify_email_styles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('site_id', siteId)
      .eq('is_active', true);
    if (up.error) return json(res, 500, { ok: false, error: up.error.message });
    return json(res, 200, { ok: true });
  }

  if (action === 'delete') {
    const id = String(body.id || '').trim();
    if (!id) return json(res, 400, { ok: false, error: 'id_required' });

    const got = await sb
      .from('lead_notify_email_styles')
      .select('id,is_global_default,site_id')
      .eq('id', id)
      .maybeSingle();
    if (!got.data) return json(res, 404, { ok: false, error: 'not_found' });
    if (got.data.is_global_default) {
      return json(res, 400, { ok: false, error: 'cannot_delete_active_global' });
    }

    const del = await sb.from('lead_notify_email_styles').delete().eq('id', id);
    if (del.error) return json(res, 500, { ok: false, error: del.error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 400, { ok: false, error: 'unknown_action' });
};
