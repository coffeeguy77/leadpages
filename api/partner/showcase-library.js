// /api/partner/showcase-library — the "Built on LeadPages" library partners can show (Nov 2026).
//
// GET                 signed-in partner (or super admin): the library sites partners can pick
//                     from, newest first. { ok, ready, items:[card], max }
// GET ?scope=admin    super admin: the library with its settings. { ok, ready, siteIds, items }
// POST {site_id, on}  super admin: add (on:true) or remove (on:false) a site.
// POST {action:'update', site_id, image_url?, image_pid?, auto_scroll?, featured?}
// POST {action:'reorder', order:[site_id,…]}
//
// Only sites on the platform owner's own account can be added: no other partner may be the
// site's servicing or referring partner, and partner homepages / system sites are refused.
const { admin, getUser, isSuper } = require('../../lib/partner/resolve-actor');
const { fetchLibraryCards, MAX } = require('../../lib/partner-website/showcase-library');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE = String(process.env.SHOWCASE_BASES || 'leadpages.com.au').split(',')[0].trim() || 'leadpages.com.au';

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); } }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

function tableMissing(err) {
  return /does not exist|42P01|schema cache/i.test(String((err && (err.message || err.code)) || ''));
}

const NOT_READY = {
  ok: false,
  error: 'library_not_set_up',
  message: 'The showcase library table has not been created yet. Run db/migrations/20261107_partner_showcase_library.sql in Supabase.'
};

async function ownPartnerId(userId) {
  try {
    const r = await admin.from('partners').select('id').eq('user_id', userId).maybeSingle();
    return (r.data && r.data.id) || null;
  } catch (_e) { return null; }
}

/** Why a site can't join the library, or '' when it can. */
async function eligibility(siteId, userId) {
  const r = await admin.from('sites')
    .select('id,servicing_partner_id,referring_partner_id,is_partner_home,is_system')
    .eq('id', siteId).maybeSingle();
  const s = r.data;
  if (!s) return 'Site not found.';
  if (s.is_partner_home) return 'Partner homepages can’t be added.';
  if (s.is_system) return 'System sites can’t be added.';
  const mine = await ownPartnerId(userId);
  const other = [s.servicing_partner_id, s.referring_partner_id].filter(function(p) { return p && String(p) !== String(mine || ''); });
  if (other.length) return 'This site belongs to another partner, so it can’t be shared.';
  return '';
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  const user = await getUser(req);
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  const superAdmin = await isSuper(user.id);

  if (req.method === 'GET') {
    const scope = String((req.query && req.query.scope) || '');
    if (scope === 'admin') {
      if (!superAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });
      const r = await admin.from('partner_showcase_library').select('site_id').limit(1000);
      if (r.error) {
        if (tableMissing(r.error)) return res.status(200).json({ ok: true, ready: false, siteIds: [] });
        return res.status(500).json({ ok: false, error: 'Could not load the library.' });
      }
      const full = await fetchLibraryCards(admin, BASE, { includeUnpublished: true });
      return res.status(200).json({ ok: true, ready: true, siteIds: (r.data || []).map(function(x) { return x.site_id; }), items: full.cards });
    }
    if (!superAdmin) {
      const pid = await ownPartnerId(user.id);
      if (!pid) return res.status(403).json({ ok: false, error: 'not a partner' });
    }
    const lib = await fetchLibraryCards(admin, BASE);
    return res.status(200).json({ ok: true, ready: lib.ready, items: lib.cards, max: MAX });
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'GET or POST only' });
  if (!superAdmin) return res.status(403).json({ ok: false, error: 'forbidden' });

  const body = await readBody(req);
  if (body.action === 'reorder') {
    const order = (Array.isArray(body.order) ? body.order : []).map(String).filter(function(x) { return UUID.test(x); }).slice(0, 300);
    if (!order.length) return res.status(400).json({ ok: false, error: 'order required' });
    for (let i = 0; i < order.length; i++) {
      const r = await admin.from('partner_showcase_library').update({ sort_order: i + 1 }).eq('site_id', order[i]);
      if (r.error) return res.status(500).json({ ok: false, error: 'Could not save the order.' });
    }
    return res.status(200).json({ ok: true });
  }
  const siteId = String(body.site_id || body.siteId || '').trim();
  if (!UUID.test(siteId)) return res.status(400).json({ ok: false, error: 'site_id required' });
  const action = String(body.action || 'toggle');

  if (action === 'update') {
    const patch = {};
    if ('image_url' in body) {
      const u = String(body.image_url || '').trim();
      if (u && !/^https:\/\/[^\s"'<>]{4,600}$/i.test(u)) return res.status(400).json({ ok: false, error: 'Picture must be an https link.' });
      patch.image_url = u || null;
      patch.image_pid = u ? (String(body.image_pid || '').trim().slice(0, 300) || null) : null;
    }
    if ('auto_scroll' in body) patch.auto_scroll = !!body.auto_scroll;
    if ('featured' in body) patch.featured = !!body.featured;
    if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: 'Nothing to change.' });
    const up = await admin.from('partner_showcase_library').update(patch).eq('site_id', siteId).select('site_id');
    if (up.error) {
      if (tableMissing(up.error)) return res.status(409).json(NOT_READY);
      return res.status(500).json({ ok: false, error: 'Could not save.' });
    }
    if (!(up.data || []).length) return res.status(404).json({ ok: false, error: 'That site is not in the showcase.' });
    return res.status(200).json({ ok: true, site_id: siteId });
  }

  const on = body.on !== false;

  if (!on) {
    const del = await admin.from('partner_showcase_library').delete().eq('site_id', siteId);
    if (del.error) {
      if (tableMissing(del.error)) return res.status(409).json(NOT_READY);
      return res.status(500).json({ ok: false, error: 'Could not update the library.' });
    }
    return res.status(200).json({ ok: true, site_id: siteId, on: false });
  }

  const why = await eligibility(siteId, user.id);
  if (why) return res.status(400).json({ ok: false, error: 'not_eligible', message: why });
  const ins = await admin.from('partner_showcase_library')
    .upsert({ site_id: siteId, added_by: user.id }, { onConflict: 'site_id', ignoreDuplicates: true });
  if (ins.error) {
    if (tableMissing(ins.error)) return res.status(409).json(NOT_READY);
    return res.status(500).json({ ok: false, error: 'Could not update the library.' });
  }
  return res.status(200).json({ ok: true, site_id: siteId, on: true });
};
