'use strict';

/**
 * Deterministic keyword clustering for Search Intelligence Phase 2.
 * Groups tracked keywords by service head (location tokens stripped).
 */

const STOP = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'at', 'near', 'best',
  'top', 'local', 'with', 'from', 'by', 'vs', 'your', 'my'
]);

const AU_LOCATIONS = new Set([
  'australia', 'au', 'nsw', 'vic', 'qld', 'sa', 'wa', 'tas', 'act', 'nt',
  'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'hobart', 'darwin',
  'canberra', 'newcastle', 'wollongong', 'geelong', 'gold', 'coast', 'sunshine',
  'central', 'coast', 'townsville', 'cairns', 'toowoomba', 'ballarat', 'bendigo',
  'albury', 'wagga', 'orange', 'bathurst', 'dubbo', 'tamworth', 'port', 'macquarie'
]);

function normalizeKeyword(raw) {
  return String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, 200);
}

function locationHintsFromSite(site) {
  const hints = new Set(AU_LOCATIONS);
  const cfg = (site && site.config) || {};
  const region = String(cfg.region || '').toLowerCase();
  region.split(/[\s,/|-]+/).forEach(function (t) {
    if (t.length > 2) hints.add(t);
  });
  const areas =
    (cfg.sections &&
      cfg.sections.serviceAreas &&
      Array.isArray(cfg.sections.serviceAreas.areas) &&
      cfg.sections.serviceAreas.areas) ||
    [];
  areas.forEach(function (a) {
    const name = typeof a === 'string' ? a : (a && (a.name || a.suburb || a.slug)) || '';
    String(name)
      .toLowerCase()
      .split(/[\s,/|-]+/)
      .forEach(function (t) {
        if (t.length > 2) hints.add(t);
      });
  });
  return hints;
}

/**
 * @returns {{ contentTokens: string[], locationTokens: string[], head: string, key: string }}
 */
function analyseKeyword(keyword, locationHints) {
  const norm = normalizeKeyword(keyword);
  const rawTokens = norm.split(' ').filter(Boolean);
  const contentTokens = [];
  const locationTokens = [];
  rawTokens.forEach(function (t) {
    if (STOP.has(t)) return;
    if (locationHints.has(t)) {
      locationTokens.push(t);
      return;
    }
    contentTokens.push(t);
  });
  const head = contentTokens.length
    ? contentTokens[contentTokens.length - 1]
    : 'general';
  // Prefer service noun (last content token) so "emergency plumber" joins "plumber".
  const key = head;
  return {
    contentTokens: contentTokens,
    locationTokens: locationTokens,
    head: head,
    key: key,
    normalised: norm
  };
}

/**
 * Pure cluster builder from keyword rows.
 * @param {Array<{ id?: string, keyword: string, keywordId?: string, trackedId?: string }>} keywords
 * @param {{ locationHints?: Set<string>, businessName?: string }} [opts]
 */
function buildClustersFromKeywords(keywords, opts) {
  const o = opts || {};
  const hints = o.locationHints || AU_LOCATIONS;
  const buckets = new Map();

  (keywords || []).forEach(function (row) {
    const kw = row.keyword || row.normalised || '';
    if (!kw) return;
    const a = analyseKeyword(kw, hints);
    if (!buckets.has(a.key)) {
      buckets.set(a.key, {
        key: a.key,
        head: a.head,
        members: [],
        locationCounts: {}
      });
    }
    const b = buckets.get(a.key);
    b.members.push({
      keyword: String(kw).trim(),
      normalised: a.normalised,
      keywordId: row.keywordId || row.keyword_id || row.id || null,
      trackedId: row.trackedId || row.tracked_id || null,
      contentTokens: a.contentTokens,
      locationTokens: a.locationTokens
    });
    a.locationTokens.forEach(function (lt) {
      b.locationCounts[lt] = (b.locationCounts[lt] || 0) + 1;
    });
  });

  const clusters = [];
  buckets.forEach(function (b) {
    const members = b.members.slice().sort(function (x, y) {
      return y.contentTokens.length - x.contentTokens.length ||
        String(x.keyword).localeCompare(String(y.keyword));
    });
    const primary = members[0];
    let topLoc = null;
    let topLocN = 0;
    Object.keys(b.locationCounts).forEach(function (lt) {
      if (b.locationCounts[lt] > topLocN) {
        topLocN = b.locationCounts[lt];
        topLoc = lt;
      }
    });
    const titleCase = b.head.charAt(0).toUpperCase() + b.head.slice(1);
    const locLabel = topLoc
      ? topLoc.charAt(0).toUpperCase() + topLoc.slice(1)
      : null;
    const name = locLabel ? titleCase + ' · ' + locLabel : titleCase;
    clusters.push({
      name: name,
      key: b.key,
      head: b.head,
      intent: 'transactional',
      primaryKeyword: primary ? primary.keyword : b.key,
      primaryKeywordId: primary ? primary.keywordId : null,
      secondaryKeywords: members.slice(1, 8).map(function (m) { return m.keyword; }),
      location: locLabel,
      memberCount: members.length,
      members: members,
      labelClass: 'modelled'
    });
  });

  clusters.sort(function (a, b) {
    return b.memberCount - a.memberCount || String(a.name).localeCompare(String(b.name));
  });

  return clusters;
}

async function listClusters(admin, siteId) {
  if (!admin || !siteId) return { ok: true, siteId: siteId, clusters: [], available: false };
  try {
    const { data, error } = await admin
      .from('si_keyword_clusters')
      .select('id,name,primary_keyword_id,intent,meta,updated_at,created_at')
      .eq('site_id', siteId)
      .order('updated_at', { ascending: false })
      .limit(100);
    if (error) {
      if (/relation|does not exist/i.test(String(error.message || ''))) {
        return { ok: true, siteId: siteId, clusters: [], available: false, schemaPending: true };
      }
      throw new Error(error.message);
    }
    const clusters = (data || []).map(function (c) {
      const meta = c.meta || {};
      return {
        id: c.id,
        name: c.name,
        intent: c.intent,
        primaryKeywordId: c.primary_keyword_id,
        primaryKeyword: meta.primaryKeyword || null,
        secondaryKeywords: meta.secondaryKeywords || [],
        location: meta.location || null,
        memberCount: meta.memberCount || (meta.members && meta.members.length) || 0,
        members: meta.members || [],
        updatedAt: c.updated_at,
        labelClass: meta.labelClass || 'modelled'
      };
    });
    return { ok: true, siteId: siteId, clusters: clusters, available: true };
  } catch (e) {
    throw e;
  }
}

/**
 * Rebuild clusters from active tracked keywords and persist.
 */
async function rebuildClusters(admin, site, opts) {
  const o = opts || {};
  const siteId = site && site.id;
  if (!admin || !siteId) throw new Error('missing_site');

  const { data: tracked, error } = await admin
    .from('si_tracked_keywords')
    .select('id,keyword_id,active')
    .eq('site_id', siteId)
    .eq('active', true)
    .limit(o.limit || 200);
  if (error) {
    if (/relation|does not exist/i.test(String(error.message || ''))) {
      const err = new Error('schema_pending');
      err.code = 'schema_pending';
      throw err;
    }
    throw new Error(error.message);
  }

  const rows = tracked || [];
  const keywordIds = Array.from(new Set(rows.map(function (r) { return r.keyword_id; }).filter(Boolean)));
  const kwMap = {};
  if (keywordIds.length) {
    const { data: kws } = await admin
      .from('si_keywords')
      .select('id,keyword,normalised')
      .in('id', keywordIds);
    (kws || []).forEach(function (k) {
      kwMap[k.id] = k;
    });
  }

  const input = rows.map(function (t) {
    const k = kwMap[t.keyword_id] || {};
    return {
      trackedId: t.id,
      keywordId: t.keyword_id,
      keyword: k.keyword || k.normalised || ''
    };
  }).filter(function (r) { return r.keyword; });

  const built = buildClustersFromKeywords(input, {
    locationHints: locationHintsFromSite(site),
    businessName: site.business_name
  });

  // Replace site clusters (simple Phase 2 approach)
  await admin.from('si_keyword_clusters').delete().eq('site_id', siteId);

  const saved = [];
  for (const c of built) {
    const meta = {
      key: c.key,
      head: c.head,
      primaryKeyword: c.primaryKeyword,
      secondaryKeywords: c.secondaryKeywords,
      location: c.location,
      memberCount: c.memberCount,
      members: c.members.map(function (m) {
        return {
          keyword: m.keyword,
          keywordId: m.keywordId,
          trackedId: m.trackedId
        };
      }),
      labelClass: 'modelled'
    };
    const { data: row, error: insErr } = await admin
      .from('si_keyword_clusters')
      .insert({
        site_id: siteId,
        name: c.name,
        primary_keyword_id: c.primaryKeywordId,
        intent: c.intent,
        meta: meta,
        updated_at: new Date().toISOString()
      })
      .select('id,name')
      .single();
    if (insErr) throw new Error(insErr.message);
    saved.push(Object.assign({}, c, { id: row.id }));

    // Link tracked keywords to cluster
    const trackedIds = c.members.map(function (m) { return m.trackedId; }).filter(Boolean);
    if (trackedIds.length) {
      await admin
        .from('si_tracked_keywords')
        .update({ cluster_id: row.id })
        .in('id', trackedIds);
    }
  }

  return {
    ok: true,
    siteId: siteId,
    count: saved.length,
    clusters: saved,
    labelClass: 'modelled'
  };
}

module.exports = {
  STOP: STOP,
  normalizeKeyword: normalizeKeyword,
  analyseKeyword: analyseKeyword,
  locationHintsFromSite: locationHintsFromSite,
  buildClustersFromKeywords: buildClustersFromKeywords,
  listClusters: listClusters,
  rebuildClusters: rebuildClusters
};
