// api/site/email-dns.js — email DNS (MX / SPF / DKIM / DMARC) for a site's custom
// domain when the domain uses Vercel nameservers. LeadPages never hosts mail; this
// points the domain at the customer's provider (Google, Outlook or any other).
//
// GET  ?siteId=<uuid>                                   -> nameserver check + current setup + last change
// POST { siteId, action:'preview', input }              -> planned changes (nothing written)
// POST { siteId, action:'apply',   input }              -> apply (adds first, then removals; rolls back on failure)
// POST { siteId, action:'undo' }                         -> undo the last applied change
//
// Auth: super-admin, or the site's owner (sites.owner_user_id). Not partners,
// and not "anyone" for ownerless sites — this moves where a business's mail goes.
// input: see lib/email-dns.js desired().

const { createClient } = require('@supabase/supabase-js');
const vercel = require('../vercel/_client');
const E = require('../../lib/email-dns');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const TTL = 3600;

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 64 * 1024) req.destroy(); });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(SUPABASE_URL, process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: 'Bearer ' + token } },
    });
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch { return null; }
}

async function isSuperAdmin(user) {
  const list = String(process.env.SUPER_ADMIN_EMAILS || '').toLowerCase().split(/[,\s]+/).filter(Boolean);
  if (user.email && list.includes(String(user.email).toLowerCase())) return true;
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  return !!(data && data.is_super_admin);
}

async function siteAccess(user, siteId) {
  if (!/^[0-9a-f-]{36}$/i.test(String(siteId || ''))) return { ok: false, code: 400, error: 'siteId required' };
  const { data: site, error } = await admin.from('sites')
    .select('id,slug,custom_domain,owner_user_id')
    .eq('id', siteId).maybeSingle();
  if (error || !site) return { ok: false, code: 404, error: 'site_not_found' };
  const sup = await isSuperAdmin(user);
  if (sup || (site.owner_user_id && site.owner_user_id === user.id)) return { ok: true, site, isSuper: sup };
  return { ok: false, code: 403, error: 'not_your_site' };
}

function normDomain(raw) {
  return String(raw || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '').replace(/\.$/, '');
}

const isVercelNs = (ns) => /(^|\.)vercel-dns\.com\.?$/i.test(String(ns || ''));

/** Can we manage this domain's DNS in Vercel, and is it live (on Vercel nameservers)? */
async function domainState(domain) {
  if (!domain) return { canManage: false, reason: 'no_domain' };
  if (!vercel.isConfigured()) return { canManage: false, reason: 'vercel_not_configured' };
  const info = await vercel.getDomainInfo(domain);
  if (!info) return { canManage: false, reason: 'not_in_vercel' };
  const d = info.domain || info;
  const nameservers = d.nameservers || [];
  const intended = d.intendedNameservers || [];
  const onVercel = nameservers.length > 0 && nameservers.every(isVercelNs);
  return { canManage: true, onVercelNs: onVercel, nameservers, intendedNameservers: intended };
}

async function lastChange(siteId) {
  const { data } = await admin.from('email_dns_changes')
    .select('id,provider,status,created_at,undone_at,added,removed')
    .eq('site_id', siteId).neq('provider', 'undo')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (!data) return null;
  return {
    id: data.id, provider: data.provider, status: data.status, created_at: data.created_at,
    undone: !!data.undone_at, canUndo: data.status === 'done' && !data.undone_at,
    added: (data.added || []).length, removed: (data.removed || []).length,
  };
}

function bodyFor(a) {
  const b = { type: a.type, name: a.name || '', value: a.value, ttl: TTL, comment: 'Email (LeadPages)' };
  if (a.type === 'MX') b.mxPriority = a.mxPriority;
  return b;
}

/** Add first (so mail keeps a route), then remove. Any add failure rolls back. */
async function applyPlan(domain, p) {
  const added = [];
  try {
    for (const a of p.add) {
      const r = await vercel.createDnsRecord(domain, bodyFor(a));
      added.push(Object.assign({}, a, { id: (r && (r.uid || r.id)) || null }));
    }
  } catch (e) {
    for (const a of added) { if (a.id) { try { await vercel.deleteDnsRecord(domain, a.id); } catch (_e) { /* best effort */ } } }
    const err = new Error('Could not add ' + (p.add[added.length] ? p.add[added.length].type : 'a') + ' record: ' + (e.message || 'Vercel error') + '. Nothing was changed.');
    err.rolledBack = true;
    throw err;
  }
  const removed = [];
  const failedRemovals = [];
  for (const r of p.remove) {
    try { await vercel.deleteDnsRecord(domain, r.id); removed.push(r); } catch (e) { failedRemovals.push({ record: r, error: e.message }); }
  }
  return { added, removed, failedRemovals };
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify(obj));
  };

  const user = await requireUser(req);
  if (!user) return json(401, { ok: false, error: 'auth' });

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, 'https://x');
      const access = await siteAccess(user, url.searchParams.get('siteId'));
      if (!access.ok) return json(access.code, { ok: false, error: access.error });
      const domain = normDomain(access.site.custom_domain);
      const state = await domainState(domain);
      let current = null;
      if (state.canManage) current = E.inspect(await vercel.listDnsRecords(domain), domain);
      return json(200, { ok: true, domain, state, current, last: await lastChange(access.site.id), isSuper: access.isSuper });
    }

    if (req.method !== 'POST') return json(405, { ok: false, error: 'method' });

    const body = await readBody(req);
    const action = String(body.action || '');
    const access = await siteAccess(user, body.siteId);
    if (!access.ok) return json(access.code, { ok: false, error: access.error });
    const domain = normDomain(access.site.custom_domain);
    const state = await domainState(domain);
    if (!state.canManage) return json(400, { ok: false, error: state.reason });

    if (action === 'preview' || action === 'apply') {
      const d = E.desired(body.input || {}, domain);
      if (d.errors) return json(400, { ok: false, error: 'invalid', errors: d.errors });
      const records = await vercel.listDnsRecords(domain);
      const p = E.plan(records, domain, d.want);
      const strip = (r) => ({ type: r.type, name: r.name, value: r.value, priority: r.priority != null ? r.priority : r.mxPriority });
      const view = { add: p.add.map(strip), remove: p.remove.map(strip), unchanged: p.unchanged.map(strip), notes: p.notes };
      if (action === 'preview') return json(200, { ok: true, domain, onVercelNs: state.onVercelNs, plan: view });

      if (!p.add.length && !p.remove.length) return json(200, { ok: true, nothingToDo: true, plan: view });
      const opts = { spf: !!(body.input && body.input.spf), dkim: !!(body.input && body.input.dkim), dmarc: !!(body.input && body.input.dmarc) };
      const ins = await admin.from('email_dns_changes').insert({
        site_id: access.site.id, domain, actor_user_id: user.id, provider: d.want.provider, options: opts, status: 'pending',
      }).select('id').single();
      if (ins.error) return json(500, { ok: false, error: 'Could not start the change log: ' + ins.error.message });
      const logId = ins.data.id;
      try {
        const out = await applyPlan(domain, p);
        await admin.from('email_dns_changes').update({
          status: 'done', added: out.added, removed: out.removed,
          error: out.failedRemovals.length ? ('Could not remove: ' + out.failedRemovals.map((f) => f.record.type + ' ' + (f.record.name || '@') + ' (' + f.error + ')').join('; ')) : null,
        }).eq('id', logId);
        const after = E.inspect(await vercel.listDnsRecords(domain), domain);
        return json(200, { ok: true, applied: { added: out.added.length, removed: out.removed.length }, failedRemovals: out.failedRemovals.length, current: after, last: await lastChange(access.site.id) });
      } catch (e) {
        await admin.from('email_dns_changes').update({ status: e.rolledBack ? 'rolled_back' : 'failed', error: e.message }).eq('id', logId);
        return json(502, { ok: false, error: e.message });
      }
    }

    if (action === 'undo') {
      const { data: row } = await admin.from('email_dns_changes')
        .select('*').eq('site_id', access.site.id).neq('provider', 'undo')
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!row || row.status !== 'done' || row.undone_at) return json(400, { ok: false, error: 'Nothing to undo.' });
      if (normDomain(row.domain) !== domain) return json(400, { ok: false, error: 'The site’s domain has changed since that change.' });
      // Recreate what was removed first, then delete what was added.
      const p = { add: (row.removed || []).map(E.recreateBody), remove: (row.added || []).filter((a) => a.id) };
      const ins = await admin.from('email_dns_changes').insert({
        site_id: access.site.id, domain, actor_user_id: user.id, provider: 'undo', undo_of: row.id, status: 'pending',
      }).select('id').single();
      const logId = ins.data && ins.data.id;
      try {
        const out = await applyPlan(domain, p);
        await admin.from('email_dns_changes').update({ undone_at: new Date().toISOString() }).eq('id', row.id);
        if (logId) await admin.from('email_dns_changes').update({ status: 'done', added: out.added, removed: out.removed }).eq('id', logId);
        const after = E.inspect(await vercel.listDnsRecords(domain), domain);
        return json(200, { ok: true, undone: true, current: after, last: await lastChange(access.site.id) });
      } catch (e) {
        if (logId) await admin.from('email_dns_changes').update({ status: e.rolledBack ? 'rolled_back' : 'failed', error: e.message }).eq('id', logId);
        return json(502, { ok: false, error: e.message });
      }
    }

    return json(400, { ok: false, error: 'unknown_action' });
  } catch (e) {
    console.error('email-dns error:', e && e.message);
    const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
    return json(status, { ok: false, error: e.message || 'server' });
  }
};

module.exports._test = { normDomain, isVercelNs, bodyFor };
