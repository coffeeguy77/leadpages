'use strict';

/**
 * Tracked keywords — persist seed terms against si_keywords + si_tracked_keywords.
 * Plan limit via SI_TRACKED_KEYWORD_LIMIT (default 25, hard cap 100).
 */

function normalizeKeyword(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

function planLimit() {
  const n = parseInt(process.env.SI_TRACKED_KEYWORD_LIMIT || '25', 10);
  if (!Number.isFinite(n) || n < 1) return 25;
  return Math.min(100, n);
}

function findKeywordQuery(admin, normalised, language, country, locationKey) {
  let q = admin
    .from('si_keywords')
    .select('id,keyword,normalised')
    .eq('normalised', normalised)
    .eq('language', language)
    .eq('country', country);
  if (locationKey) q = q.eq('location_key', locationKey);
  else q = q.is('location_key', null);
  return q.maybeSingle();
}

async function countActive(admin, siteId) {
  if (!admin || !siteId) return 0;
  const { count, error } = await admin
    .from('si_tracked_keywords')
    .select('id', { count: 'exact', head: true })
    .eq('site_id', siteId)
    .eq('active', true);
  if (error) {
    if (/relation|does not exist/i.test(String(error.message || ''))) {
      const err = new Error('schema_pending');
      err.code = 'schema_pending';
      throw err;
    }
    throw new Error(error.message);
  }
  return count || 0;
}

async function ensureKeywordRow(admin, keyword, opts) {
  const o = opts || {};
  const normalised = normalizeKeyword(keyword);
  if (!normalised) throw new Error('empty_keyword');
  const language = o.language || 'en';
  const country = o.country || 'AU';
  const locationKey = o.locationKey || o.geo || null;

  const { data: existing, error: findErr } = await findKeywordQuery(
    admin,
    normalised,
    language,
    country,
    locationKey
  );
  if (findErr && /relation|does not exist/i.test(String(findErr.message || ''))) {
    const err = new Error('schema_pending');
    err.code = 'schema_pending';
    throw err;
  }
  if (existing && existing.id) return existing;

  const insert = {
    keyword: String(keyword).trim().slice(0, 200),
    normalised: normalised,
    language: language,
    country: country,
    location_key: locationKey,
    meta: o.meta || {}
  };
  const { data, error } = await admin.from('si_keywords').insert(insert).select('id,keyword,normalised').single();
  if (error) {
    if (/duplicate|unique/i.test(String(error.message || ''))) {
      const { data: again } = await findKeywordQuery(admin, normalised, language, country, locationKey);
      if (again) return again;
    }
    throw new Error(error.message || 'keyword_insert_failed');
  }
  return data;
}

async function listTracked(admin, siteId) {
  if (!admin || !siteId) return { ok: true, items: [], limit: planLimit(), count: 0 };
  try {
    const { data: rows, error } = await admin
      .from('si_tracked_keywords')
      .select('id,device,geo,cadence,priority,active,created_at,keyword_id')
      .eq('site_id', siteId)
      .eq('active', true)
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) {
      if (/relation|does not exist|column|permission/i.test(String(error.message || ''))) {
        return { ok: false, error: 'schema_pending', items: [], limit: planLimit(), count: 0 };
      }
      return { ok: false, error: String(error.message || 'list_failed'), items: [], limit: planLimit(), count: 0 };
    }

    const ids = (rows || []).map(function (r) { return r.keyword_id; }).filter(Boolean);
    const kwMap = {};
    if (ids.length) {
      const { data: kws } = await admin.from('si_keywords').select('id,keyword,normalised').in('id', ids);
      (kws || []).forEach(function (k) {
        kwMap[k.id] = k;
      });
    }

    const items = (rows || []).map(function (r) {
      const k = kwMap[r.keyword_id] || {};
      return {
        id: r.id,
        keywordId: r.keyword_id,
        keyword: k.keyword || null,
        normalised: k.normalised || null,
        device: r.device,
        geo: r.geo,
        cadence: r.cadence,
        priority: r.priority,
        active: r.active,
        createdAt: r.created_at
      };
    });
    return { ok: true, items: items, limit: planLimit(), count: items.length };
  } catch (e) {
    if (e.code === 'schema_pending' || String(e.message) === 'schema_pending') {
      return { ok: false, error: 'schema_pending', items: [], limit: planLimit(), count: 0 };
    }
    return { ok: false, error: String(e.message || e), items: [], limit: planLimit(), count: 0 };
  }
}

async function trackKeyword(admin, siteId, opts) {
  const o = opts || {};
  const keyword = String(o.keyword || '').trim();
  if (!keyword) throw new Error('keyword_required');
  const device = o.device === 'desktop' ? 'desktop' : 'mobile';
  const geo = o.geo ? String(o.geo).trim().slice(0, 120) : null;
  const cadence = ['daily', 'weekly', 'event'].indexOf(o.cadence) >= 0 ? o.cadence : 'weekly';

  const limit = planLimit();
  const active = await countActive(admin, siteId);
  if (active >= limit) {
    const err = new Error('plan_limit');
    err.code = 'plan_limit';
    err.limit = limit;
    err.count = active;
    throw err;
  }

  const kw = await ensureKeywordRow(admin, keyword, {
    language: o.language,
    country: o.country,
    locationKey: geo,
    meta: o.meta || {}
  });

  let existingQ = admin
    .from('si_tracked_keywords')
    .select('id,active')
    .eq('site_id', siteId)
    .eq('keyword_id', kw.id)
    .eq('device', device);
  existingQ = geo ? existingQ.eq('geo', geo) : existingQ.is('geo', null);
  const { data: existing } = await existingQ.maybeSingle();

  if (existing && existing.id) {
    if (existing.active) {
      return {
        ok: true,
        id: existing.id,
        keywordId: kw.id,
        keyword: kw.keyword,
        reactivated: false,
        alreadyTracked: true
      };
    }
    const { error: upErr } = await admin
      .from('si_tracked_keywords')
      .update({ active: true, cadence: cadence, priority: o.priority || 0, meta: o.meta || {} })
      .eq('id', existing.id);
    if (upErr) throw new Error(upErr.message);
    return { ok: true, id: existing.id, keywordId: kw.id, keyword: kw.keyword, reactivated: true };
  }

  const { data: row, error } = await admin
    .from('si_tracked_keywords')
    .insert({
      site_id: siteId,
      keyword_id: kw.id,
      device: device,
      geo: geo,
      cadence: cadence,
      priority: o.priority || 0,
      active: true,
      meta: o.meta || {}
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { ok: true, id: row.id, keywordId: kw.id, keyword: kw.keyword, created: true };
}

async function untrackKeyword(admin, siteId, trackedId) {
  if (!trackedId) throw new Error('missing_id');
  const { data, error } = await admin
    .from('si_tracked_keywords')
    .update({ active: false })
    .eq('id', trackedId)
    .eq('site_id', siteId)
    .select('id')
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error('not_found');
  return { ok: true, id: data.id, active: false };
}

module.exports = {
  normalizeKeyword: normalizeKeyword,
  planLimit: planLimit,
  countActive: countActive,
  ensureKeywordRow: ensureKeywordRow,
  listTracked: listTracked,
  trackKeyword: trackKeyword,
  untrackKeyword: untrackKeyword
};
