'use strict';

/**
 * Rank observation jobs for tracked keywords.
 * Uses provider gateway (mock until DataForSEO configured).
 */

const { createGateway } = require('./providers/gateway');

function hoursAgo(h) {
  return new Date(Date.now() - h * 3600 * 1000).toISOString();
}

function cadenceDueSince(cadence) {
  if (cadence === 'daily') return hoursAgo(20);
  if (cadence === 'weekly') return hoursAgo(24 * 6);
  return null; // event = manual only
}

async function meterUsage(admin, siteId, units, meta) {
  const { meterUsage: shared } = require('./usage');
  return shared(admin, siteId, 'rank_check', units, meta);
}

/**
 * Load active tracked keywords, optionally only those due for cadence.
 */
async function loadDueTracked(admin, opts) {
  const o = opts || {};
  let q = admin
    .from('si_tracked_keywords')
    .select('id,site_id,keyword_id,device,geo,cadence,priority,active,meta')
    .eq('active', true);
  if (o.siteId) q = q.eq('site_id', o.siteId);
  if (o.trackedId) q = q.eq('id', o.trackedId);
  const { data, error } = await q.limit(o.limit || 200);
  if (error) {
    if (/relation|does not exist/i.test(String(error.message || ''))) {
      const err = new Error('schema_pending');
      err.code = 'schema_pending';
      throw err;
    }
    throw new Error(error.message);
  }

  const rows = data || [];
  if (!rows.length) return [];

  const keywordIds = Array.from(new Set(rows.map(function (r) { return r.keyword_id; }).filter(Boolean)));
  const kwMap = {};
  if (keywordIds.length) {
    const { data: kws } = await admin.from('si_keywords').select('id,keyword,normalised').in('id', keywordIds);
    (kws || []).forEach(function (k) {
      kwMap[k.id] = k;
    });
  }

  // Latest observation per tracked_keyword_id
  const trackedIds = rows.map(function (r) { return r.id; });
  const lastByTracked = {};
  if (trackedIds.length) {
    const { data: obs } = await admin
      .from('si_rank_observations')
      .select('tracked_keyword_id,fetched_at,position')
      .in('tracked_keyword_id', trackedIds)
      .order('fetched_at', { ascending: false })
      .limit(500);
    (obs || []).forEach(function (oRow) {
      if (!oRow.tracked_keyword_id) return;
      if (!lastByTracked[oRow.tracked_keyword_id]) {
        lastByTracked[oRow.tracked_keyword_id] = oRow;
      }
    });
  }

  const force = !!o.force;
  return rows
    .map(function (r) {
      const kw = kwMap[r.keyword_id] || {};
      const last = lastByTracked[r.id] || null;
      return {
        id: r.id,
        siteId: r.site_id,
        keywordId: r.keyword_id,
        keyword: kw.keyword || kw.normalised || null,
        device: r.device || 'mobile',
        geo: r.geo || null,
        cadence: r.cadence || 'weekly',
        priority: r.priority || 0,
        lastFetchedAt: last ? last.fetched_at : null,
        lastPosition: last && last.position != null ? Number(last.position) : null
      };
    })
    .filter(function (r) {
      if (!r.keyword) return false;
      if (force) return true;
      if (o.ignoreCadence) return true;
      const since = cadenceDueSince(r.cadence);
      if (!since) return false; // event cadence — skip in scheduled runs
      if (!r.lastFetchedAt) return true;
      return r.lastFetchedAt < since;
    })
    .sort(function (a, b) {
      return b.priority - a.priority;
    });
}

async function resolveSiteTargetUrl(admin, siteId) {
  const { data: site } = await admin
    .from('sites')
    .select('id,slug,custom_domain')
    .eq('id', siteId)
    .maybeSingle();
  if (!site) return null;
  const domain = String(site.custom_domain || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '');
  if (domain) return 'https://' + domain + '/';
  const { data: gsc } = await admin
    .from('si_connections')
    .select('property_id')
    .eq('site_id', siteId)
    .eq('provider', 'search_console')
    .maybeSingle();
  if (gsc && gsc.property_id) return String(gsc.property_id);
  return null;
}

/**
 * Run rank checks for due tracked keywords.
 */
async function runRankJobs(admin, opts) {
  const o = opts || {};
  const due = await loadDueTracked(admin, o);
  const max = Math.max(1, Math.min(100, o.max || 40));
  const batch = due.slice(0, max);
  const provider = o.provider || process.env.SI_PROVIDER || 'mock';
  const gw = createGateway({ provider: provider });

  const results = [];
  const targetCache = {};

  for (const item of batch) {
    try {
      if (!targetCache[item.siteId]) {
        targetCache[item.siteId] = await resolveSiteTargetUrl(admin, item.siteId);
      }
      const targetUrl = o.url || targetCache[item.siteId] || null;
      const check = await gw.rankCheck({
        keyword: item.keyword,
        device: item.device,
        geo: item.geo || undefined,
        url: targetUrl
      });

      if (!check || !check.ok || !check.observation) {
        results.push({
          ok: false,
          trackedId: item.id,
          siteId: item.siteId,
          keyword: item.keyword,
          error: (check && check.error) || 'rank_check_failed',
          message: (check && check.message) || null
        });
        continue;
      }

      const obs = check.observation;
      const row = {
        site_id: item.siteId,
        tracked_keyword_id: item.id,
        keyword_id: item.keywordId,
        url: obs.url || targetUrl,
        position: obs.position,
        device: item.device,
        geo: item.geo,
        provider: obs.provider || check.provider || provider,
        label_class: obs.labelClass || 'estimated',
        features: obs.features || [],
        fetched_at: obs.fetchedAt || new Date().toISOString()
      };

      const { data: inserted, error: insErr } = await admin
        .from('si_rank_observations')
        .insert(row)
        .select('id,position,fetched_at')
        .single();
      if (insErr) {
        if (/relation|does not exist/i.test(String(insErr.message || ''))) {
          const err = new Error('schema_pending');
          err.code = 'schema_pending';
          throw err;
        }
        throw new Error(insErr.message);
      }

      await meterUsage(admin, item.siteId, 1, {
        provider: row.provider,
        trackedKeywordId: item.id,
        keyword: item.keyword
      });

      // Stash last check on tracked meta (best-effort merge)
      try {
        const { data: cur } = await admin
          .from('si_tracked_keywords')
          .select('meta')
          .eq('id', item.id)
          .maybeSingle();
        const prevMeta = (cur && cur.meta) || {};
        await admin
          .from('si_tracked_keywords')
          .update({
            meta: Object.assign({}, prevMeta, {
              lastRankCheckAt: row.fetched_at,
              lastPosition: row.position,
              lastProvider: row.provider
            })
          })
          .eq('id', item.id);
      } catch (_e) {
        /* ignore */
      }

      results.push({
        ok: true,
        trackedId: item.id,
        siteId: item.siteId,
        keyword: item.keyword,
        observationId: inserted.id,
        position: inserted.position,
        fetchedAt: inserted.fetched_at,
        previousPosition: item.lastPosition,
        provider: row.provider,
        labelClass: row.label_class
      });
    } catch (e) {
      if (e.code === 'schema_pending') throw e;
      results.push({
        ok: false,
        trackedId: item.id,
        siteId: item.siteId,
        keyword: item.keyword,
        error: 'job_failed',
        message: String((e && e.message) || e)
      });
    }
  }

  return {
    ok: true,
    due: due.length,
    ran: batch.length,
    provider: provider,
    results: results
  };
}

/**
 * Latest rank observations for a site (for Command Centre).
 */
async function loadLatestRanks(admin, siteId, opts) {
  const o = opts || {};
  const empty = { available: false, items: [], count: 0 };
  if (!admin || !siteId) return empty;
  try {
    const { data: tracked, error } = await admin
      .from('si_tracked_keywords')
      .select('id,keyword_id,device,geo,cadence,active')
      .eq('site_id', siteId)
      .eq('active', true)
      .limit(o.limit || 100);
    if (error) return empty;
    if (!(tracked || []).length) return { available: true, items: [], count: 0 };

    const ids = tracked.map(function (t) { return t.id; });
    const kwIds = tracked.map(function (t) { return t.keyword_id; });
    const kwMap = {};
    const { data: kws } = await admin.from('si_keywords').select('id,keyword,normalised').in('id', kwIds);
    (kws || []).forEach(function (k) {
      kwMap[k.id] = k;
    });

    const { data: obs } = await admin
      .from('si_rank_observations')
      .select('id,tracked_keyword_id,position,url,device,geo,provider,label_class,fetched_at,features')
      .eq('site_id', siteId)
      .in('tracked_keyword_id', ids)
      .order('fetched_at', { ascending: false })
      .limit(400);

    const latest = {};
    (obs || []).forEach(function (row) {
      if (!row.tracked_keyword_id || latest[row.tracked_keyword_id]) return;
      latest[row.tracked_keyword_id] = row;
    });

    // Second-latest for delta
    const second = {};
    (obs || []).forEach(function (row) {
      if (!row.tracked_keyword_id) return;
      if (!latest[row.tracked_keyword_id] || latest[row.tracked_keyword_id].id === row.id) return;
      if (!second[row.tracked_keyword_id]) second[row.tracked_keyword_id] = row;
    });

    const items = tracked.map(function (t) {
      const k = kwMap[t.keyword_id] || {};
      const cur = latest[t.id] || null;
      const prev = second[t.id] || null;
      const pos = cur && cur.position != null ? Number(cur.position) : null;
      const prevPos = prev && prev.position != null ? Number(prev.position) : null;
      let delta = null;
      if (pos != null && prevPos != null) delta = prevPos - pos; // positive = improved
      return {
        trackedId: t.id,
        keyword: k.keyword || k.normalised || null,
        device: t.device,
        geo: t.geo,
        cadence: t.cadence,
        position: pos,
        previousPosition: prevPos,
        delta: delta,
        url: cur ? cur.url : null,
        provider: cur ? cur.provider : null,
        labelClass: cur ? cur.label_class : null,
        fetchedAt: cur ? cur.fetched_at : null
      };
    });

    return { available: true, items: items, count: items.length };
  } catch (_e) {
    return empty;
  }
}

module.exports = {
  hoursAgo: hoursAgo,
  cadenceDueSince: cadenceDueSince,
  loadDueTracked: loadDueTracked,
  runRankJobs: runRankJobs,
  loadLatestRanks: loadLatestRanks,
  resolveSiteTargetUrl: resolveSiteTargetUrl
};
