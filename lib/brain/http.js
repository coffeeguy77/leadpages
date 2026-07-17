'use strict';

/**
 * Shared HTTP helpers for Brain API routes (auth, site access, body parsing).
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
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
    req.on('data', (c) => {
      raw += c;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (_e) {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(
      SUPABASE_URL,
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
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
  return !!(data && data.is_super_admin);
}

async function partnerIdForUser(userId) {
  const { data } = await admin.from('partners').select('id,status').eq('user_id', userId).maybeSingle();
  if (!data || data.status !== 'active') return null;
  return data.id;
}

async function assertSiteAccess(user, siteId) {
  const { data: site, error } = await admin
    .from('sites')
    .select(
      'id,slug,business_name,custom_domain,config,owner_user_id,servicing_partner_id,referring_partner_id,template'
    )
    .eq('id', siteId)
    .maybeSingle();
  if (error || !site) return { ok: false, code: 404, error: 'site_not_found' };
  if (await isSuperAdmin(user.id)) return { ok: true, site, role: 'super' };
  if (site.owner_user_id && site.owner_user_id === user.id) {
    return { ok: true, site, role: 'client' };
  }
  const partnerId = await partnerIdForUser(user.id);
  if (
    partnerId &&
    (site.servicing_partner_id === partnerId || site.referring_partner_id === partnerId)
  ) {
    return { ok: true, site, role: 'partner', partnerId };
  }
  if (!site.owner_user_id) return { ok: true, site, role: 'client' };
  return { ok: false, code: 403, error: 'not_your_site' };
}

module.exports = {
  admin,
  json,
  readBody,
  requireUser,
  isSuperAdmin,
  partnerIdForUser,
  assertSiteAccess
};
