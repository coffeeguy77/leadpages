'use strict';

const { getAdmin } = require('../order/supabase');

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = require('@supabase/supabase-js').createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: 'Bearer ' + token } } }
    );
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch (_e) {
    return null;
  }
}

async function isSuperAdmin(userId) {
  const admin = getAdmin();
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
  return !!(data && data.is_super_admin);
}

async function partnerIdForUser(userId) {
  const admin = getAdmin();
  const { data } = await admin.from('partners').select('id,status').eq('user_id', userId).maybeSingle();
  if (!data || data.status !== 'active') return null;
  return data.id;
}

async function assertSiteAccess(user, siteId) {
  if (!siteId) return { ok: false, code: 400, error: 'no_site' };
  const admin = getAdmin();
  const { data: site, error } = await admin
    .from('sites')
    .select('id,slug,owner_user_id,servicing_partner_id,referring_partner_id,business_name,config')
    .eq('id', siteId)
    .maybeSingle();
  if (error || !site) return { ok: false, code: 404, error: 'site_not_found' };

  if (user) {
    if (await isSuperAdmin(user.id)) return { ok: true, site, role: 'admin', isSuper: true };
    if (site.owner_user_id && site.owner_user_id === user.id) {
      return { ok: true, site, role: 'manager', isSuper: false };
    }
    const partnerId = await partnerIdForUser(user.id);
    if (partnerId && (site.servicing_partner_id === partnerId || site.referring_partner_id === partnerId)) {
      return { ok: true, site, role: 'staff', isSuper: false };
    }
    return { ok: false, code: 403, error: 'not_your_site' };
  }
  return { ok: false, code: 401, error: 'auth' };
}

function isMissingSchemaError(err) {
  const msg = String((err && err.message) || err || '');
  const code = String((err && err.code) || '');
  return (
    code === 'PGRST205' ||
    /Could not find the table/i.test(msg) ||
    /relation ["']?booking_/i.test(msg) ||
    /does not exist/i.test(msg)
  );
}

async function getBookingSystemForSite(siteId) {
  const admin = getAdmin();
  const { data, error } = await admin.from('booking_systems').select('*').eq('site_id', siteId).maybeSingle();
  if (error && isMissingSchemaError(error)) {
    const e = new Error('bookings_schema_missing');
    e.code = 'schema_missing';
    e.cause = error;
    throw e;
  }
  if (error) throw error;
  return data || null;
}

async function ensureBookingSystem(siteId, opts) {
  const existing = await getBookingSystemForSite(siteId);
  if (existing) return existing;
  const admin = getAdmin();
  const site = opts && opts.site;
  const cfg = (site && site.config) || {};
  const contact = cfg.contact || {};
  const row = Object.assign(
    {
      site_id: siteId,
      enabled: false,
      onboarding_step: 'types',
      business_name: (site && site.business_name) || '',
      phone: contact.phone || '',
      email: contact.email || '',
      timezone: 'Australia/Sydney',
      currency: 'AUD'
    },
    (opts && opts.defaults) || {}
  );
  const { data, error } = await admin.from('booking_systems').insert(row).select('*').single();
  if (error && isMissingSchemaError(error)) {
    const e = new Error('bookings_schema_missing');
    e.code = 'schema_missing';
    e.cause = error;
    throw e;
  }
  if (error) throw error;
  return data;
}

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve) {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch (_e) { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', function (c) { raw += c; });
    req.on('end', function () {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (_e) { resolve({}); }
    });
    req.on('error', function () { resolve({}); });
  });
}

module.exports = {
  getAdmin,
  requireUser,
  assertSiteAccess,
  getBookingSystemForSite,
  ensureBookingSystem,
  isMissingSchemaError,
  json,
  readBody,
  isSuperAdmin
};
