'use strict';

const { getAdmin } = require('./supabase');

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
    .select('id,slug,owner_user_id,servicing_partner_id,referring_partner_id,business_name')
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

async function getOrderSystemForSite(siteId) {
  const admin = getAdmin();
  const { data } = await admin.from('order_systems').select('*').eq('site_id', siteId).maybeSingle();
  return data || null;
}

async function ensureOrderSystem(siteId, opts) {
  const existing = await getOrderSystemForSite(siteId);
  if (existing) return existing;
  const admin = getAdmin();
  const row = Object.assign(
    {
      site_id: siteId,
      enabled: true,
      industry_preset: (opts && opts.preset) || 'custom'
    },
    (opts && opts.defaults) || {}
  );
  const { data, error } = await admin.from('order_systems').insert(row).select('*').single();
  if (error) throw error;
  return data;
}

module.exports = {
  requireUser,
  isSuperAdmin,
  partnerIdForUser,
  assertSiteAccess,
  getOrderSystemForSite,
  ensureOrderSystem
};
