// api/domains/point-at-site.js — Point a purchased domain at LeadPages.
// 1) Ensure Dreamscape DNS A/CNAME for Vercel (unless skip_dns)
// 2) Attach apex + www to the shared Vercel project
// 3) Optionally set sites.custom_domain when site_id is known
//
// Auth: domain owner or super-admin (same rules as api/domains/dns.js).
// Partial success is ok:true with per-step statuses so DNS can succeed even
// if Vercel env is missing.

const ds = require('../../dreamscape');
const { createClient } = require('@supabase/supabase-js');
const vercel = require('../vercel/_client');
const {
  normalizeApex,
  attachHostsToProject
} = require('../../lib/vercel-project-domain');

const DOMAINS_ENABLED = String(process.env.DOMAINS_FEATURE_ENABLED || 'true') !== 'false';
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const APEX_A = String(process.env.VERCEL_APEX_A_RECORD || '76.76.21.21').trim() || '76.76.21.21';
const WWW_CNAME = String(process.env.VERCEL_WWW_CNAME || 'cname.vercel-dns.com').trim() || 'cname.vercel-dns.com';

async function isSuper(userId) {
  try {
    const r = await sb.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
    return !!(r.data && r.data.is_super_admin);
  } catch {
    return false;
  }
}

async function ownedDomain(ourId, user) {
  const r = await sb
    .from('domains')
    .select('id, user_id, domain_name, dreamscape_domain_id, site_id')
    .eq('id', ourId)
    .maybeSingle();
  const row = r.data;
  if (!row) return { error: 'not_found' };
  if (String(row.user_id) !== String(user.id) && !(await isSuper(user.id))) {
    return { error: 'forbidden' };
  }
  return { row, dsId: row.dreamscape_domain_id || null };
}

async function canAttachSite(user, site) {
  if (!user || !site) return false;
  if (await isSuper(user.id)) return true;
  if (site.owner_user_id && String(site.owner_user_id) === String(user.id)) return true;
  return false;
}

async function ensureDnsRecord(dsId, record) {
  const r = await ds.addDomainDns(dsId, record);
  if (r.ok) return { status: 'ok' };
  const err = String(r.error || '').toLowerCase();
  // Dreamscape often rejects duplicates — treat as fine for idempotent clicks.
  if (/exist|already|duplicate|conflict/i.test(err)) return { status: 'skipped', error: r.error };
  return { status: 'error', error: r.error || 'dns_failed' };
}

module.exports = async (req, res) => {
  try {
    if (!DOMAINS_ENABLED) return res.status(404).json({ ok: false, error: 'Domain feature disabled' });
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method' });

    const auth = req.headers.authorization || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return res.status(401).json({ ok: false, error: 'Please sign in.' });
    const { data: { user } = {}, error: uErr } = await sb.auth.getUser(token);
    if (uErr || !user) {
      return res.status(401).json({ ok: false, error: 'Your session has expired — please sign in again.' });
    }

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    let domainName = '';
    let dsId = null;
    let ourRow = null;

    if (body.dreamscape_id) {
      if (!(await isSuper(user.id))) {
        return res.status(403).json({ ok: false, error: 'Only administrators can manage by Dreamscape ID.' });
      }
      dsId = body.dreamscape_id;
      domainName = normalizeApex(body.domain_name || '');
      if (!domainName) return res.status(400).json({ ok: false, error: 'domain_name is required with dreamscape_id.' });
    } else {
      const ourId = body.domain_id;
      if (!ourId) return res.status(400).json({ ok: false, error: 'domain_id is required.' });
      const own = await ownedDomain(ourId, user);
      if (own.error === 'not_found') return res.status(404).json({ ok: false, error: 'Domain not found.' });
      if (own.error === 'forbidden') {
        return res.status(403).json({ ok: false, error: "That domain isn't on your account." });
      }
      ourRow = own.row;
      dsId = own.dsId;
      domainName = normalizeApex(own.row.domain_name);
    }

    if (!domainName) return res.status(400).json({ ok: false, error: 'Could not resolve domain name.' });

    const skipDns = !!body.skip_dns;
    const dns = { apex: { status: 'skipped' }, www: { status: 'skipped' } };

    if (!skipDns) {
      if (!dsId) {
        dns.apex = { status: 'error', error: 'no_dreamscape_id' };
        dns.www = { status: 'error', error: 'no_dreamscape_id' };
      } else {
        dns.apex = await ensureDnsRecord(dsId, {
          type: 'A',
          subdomain: '@',
          content: APEX_A
        });
        dns.www = await ensureDnsRecord(dsId, {
          type: 'CNAME',
          subdomain: 'www',
          content: WWW_CNAME
        });
      }
    }

    let vercelResult = {
      configured: vercel.projectConfigured(),
      apex: { status: 'skipped', code: 'not_configured' },
      www: { status: 'skipped', code: 'not_configured' }
    };

    if (vercel.projectConfigured()) {
      const attached = await attachHostsToProject(vercel, domainName, { includeWww: true });
      vercelResult = {
        configured: true,
        apex: attached.apex,
        www: attached.www
      };
    }

    const siteIdIn =
      (body.site_id && String(body.site_id).trim()) ||
      (ourRow && ourRow.site_id) ||
      '';

    let customDomain = { set: false, value: null, error: null, skipped: 'no_site_id' };

    if (siteIdIn) {
      const siteRes = await sb
        .from('sites')
        .select('id, slug, business_name, custom_domain, owner_user_id')
        .eq('id', siteIdIn)
        .maybeSingle();
      const site = siteRes.data;
      if (!site) {
        customDomain = { set: false, value: null, error: 'site_not_found' };
      } else if (!(await canAttachSite(user, site))) {
        customDomain = { set: false, value: null, error: 'forbidden' };
      } else {
        const up = await sb
          .from('sites')
          .update({
            custom_domain: domainName,
            updated_at: new Date().toISOString()
          })
          .eq('id', site.id)
          .select('id, custom_domain')
          .maybeSingle();
        if (up.error) {
          const msg = String(up.error.message || '');
          customDomain = {
            set: false,
            value: null,
            error: /unique|duplicate/i.test(msg) ? 'domain_taken' : up.error.message
          };
        } else {
          customDomain = { set: true, value: domainName, error: null };
          if (ourRow && ourRow.id) {
            try {
              await sb.from('domains').update({ site_id: site.id }).eq('id', ourRow.id);
            } catch (_) { /* non-fatal */ }
          }
        }
      }
    }

    const vercelOk =
      !vercelResult.configured ||
      ['added', 'pending', 'already_exists'].includes(vercelResult.apex && vercelResult.apex.status);

    return res.status(200).json({
      ok: true,
      domain: domainName,
      dns,
      vercel: vercelResult,
      custom_domain: customDomain,
      vercel_ok: !!vercelOk,
      hint: !vercelResult.configured
        ? 'Set VERCEL_TOKEN (or VERCEL_ACCESS_TOKEN) + VERCEL_PROJECT_ID to auto-attach hostnames to the project.'
        : !siteIdIn
          ? 'Vercel attach done. Set this hostname as the site custom domain in Manage → Site details if routing is not linked yet.'
          : null
    });
  } catch (e) {
    console.error('point-at-site', e && e.message);
    return res.status(500).json({ ok: false, error: 'server' });
  }
};
