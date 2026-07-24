'use strict';

/**
 * DataForSEO Maps-grid SERP sampling for Local Growth.
 * Samples a small lat/lng grid around a site region — never Semrush.
 */

const { createGateway } = require('./providers/gateway');
const { areasFromSite } = require('./local-opportunity');
const { meterUsage } = require('./usage');

/** Rough AU city centres for modelled grids when no lat/lng on site. */
const CITY_COORDS = Object.freeze({
  canberra: { lat: -35.2809, lng: 149.1300 },
  sydney: { lat: -33.8688, lng: 151.2093 },
  melbourne: { lat: -37.8136, lng: 144.9631 },
  brisbane: { lat: -27.4698, lng: 153.0251 },
  adelaide: { lat: -34.9285, lng: 138.6007 },
  perth: { lat: -31.9505, lng: 115.8605 },
  hobart: { lat: -42.8821, lng: 147.3272 },
  darwin: { lat: -12.4634, lng: 130.8456 },
  australia: { lat: -35.2809, lng: 149.1300 }
});

function centreForSite(site) {
  const cfg = (site && site.config) || {};
  if (cfg.geo && cfg.geo.lat != null && cfg.geo.lng != null) {
    return { lat: Number(cfg.geo.lat), lng: Number(cfg.geo.lng), source: 'config.geo' };
  }
  const region = String(cfg.region || areasFromSite(site)[0] || 'Australia').toLowerCase();
  const key = Object.keys(CITY_COORDS).find(function (k) {
    return region.indexOf(k) >= 0;
  });
  const c = CITY_COORDS[key || 'australia'];
  return { lat: c.lat, lng: c.lng, source: key ? 'city_lookup' : 'default_au' };
}

/**
 * Build N×N grid points around centre. stepDeg ~5–6 km at AU latitudes.
 */
function buildGridPoints(centre, size, stepDeg) {
  const n = Math.max(1, Math.min(5, Number(size) || 3));
  const step = stepDeg != null ? Number(stepDeg) : 0.04;
  const half = (n - 1) / 2;
  const points = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      points.push({
        lat: Number((centre.lat + (i - half) * step).toFixed(5)),
        lng: Number((centre.lng + (j - half) * step).toFixed(5)),
        row: i,
        col: j
      });
    }
  }
  return points;
}

function hostFromUrl(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, '').toLowerCase();
  } catch (_e) {
    return String(u || '')
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .toLowerCase();
  }
}

function siteHosts(site) {
  const hosts = [];
  if (site && site.custom_domain) hosts.push(hostFromUrl(site.custom_domain));
  if (site && site.slug) hosts.push(String(site.slug).toLowerCase() + '.leadpages.com.au');
  const cfg = (site && site.config) || {};
  if (cfg.domain) hosts.push(hostFromUrl(cfg.domain));
  return Array.from(new Set(hosts.filter(Boolean)));
}

function businessTokens(site) {
  const name = String((site && site.business_name) || (site && site.config && site.config.name) || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim();
  if (!name) return [];
  return name.split(/\s+/).filter(function (w) {
    return w.length >= 3;
  });
}

function presenceInMapsResults(results, site) {
  const hosts = siteHosts(site);
  const tokens = businessTokens(site);
  let found = false;
  const matches = [];
  (results || []).forEach(function (r) {
    if (String(r.type || '') !== 'maps' && String(r.type || '') !== 'local_pack') return;
    const domain = String(r.domain || hostFromUrl(r.url) || '').toLowerCase();
    const title = String(r.title || '').toLowerCase();
    const hostHit = hosts.some(function (h) {
      return h && (domain === h || domain.indexOf(h) >= 0 || title.indexOf(h) >= 0);
    });
    const nameHit =
      tokens.length >= 1 &&
      tokens.every(function (t) {
        return title.indexOf(t) >= 0;
      });
    if (hostHit || nameHit) {
      found = true;
      matches.push({ rank: r.rank, title: r.title, domain: r.domain || domain });
    }
  });
  return { found: found, matches: matches };
}

function defaultKeyword(site) {
  const cfg = (site && site.config) || {};
  const tokens = (cfg.sections && cfg.sections.seoTokens) || {};
  const trade = String(tokens.trade || cfg.trade || cfg.industry || '').trim();
  const region = String(
    tokens.suburb || tokens.city || tokens.location || cfg.region || areasFromSite(site)[0] || ''
  ).trim();
  if (trade && region) return (trade + ' ' + region).toLowerCase();
  if (trade) return trade.toLowerCase();
  const biz = String((site && site.business_name) || '').trim();
  if (biz && region) return (biz + ' ' + region).toLowerCase();
  if (areasFromSite(site)[0]) return 'near me ' + areasFromSite(site)[0];
  return 'near me';
}

/**
 * Sample Maps SERP across a grid. Uses gateway mapsGrid (mock or DataForSEO).
 * @returns {Promise<object>}
 */
async function sampleMapsGrid(site, opts) {
  const o = opts || {};
  const centre = centreForSite(site);
  const size = Math.max(1, Math.min(5, Number(o.gridSize) || 3));
  const points = buildGridPoints(centre, size, o.stepDeg);
  const keyword = String(o.keyword || defaultKeyword(site)).trim();
  const gw = createGateway({ provider: o.provider || undefined });
  const cells = [];
  let presentCount = 0;
  let provider = gw.preferred;
  let labelClass = 'estimated';

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const res = await gw.mapsGrid({
      keyword: keyword,
      lat: p.lat,
      lng: p.lng,
      location: o.location || (site && site.config && site.config.region) || 'Australia',
      device: o.device || 'mobile',
      depth: o.depth || 20
    });
    provider = (res && res.provider) || provider;
    if (!res || !res.ok) {
      cells.push({
        lat: p.lat,
        lng: p.lng,
        row: p.row,
        col: p.col,
        ok: false,
        error: (res && (res.error || res.message)) || 'maps_grid_failed',
        present: false,
        features: [],
        topResults: []
      });
      continue;
    }
    labelClass = (res.snapshot && res.snapshot.labelClass) || labelClass;
    const snap = res.snapshot || {};
    const presence = presenceInMapsResults(snap.results, site);
    if (presence.found) presentCount += 1;
    cells.push({
      lat: p.lat,
      lng: p.lng,
      row: p.row,
      col: p.col,
      ok: true,
      present: presence.found,
      matches: presence.matches,
      features: snap.features || [],
      topResults: (snap.results || []).filter(function (r) {
        return r.type === 'maps' || r.type === 'local_pack';
      }).slice(0, 5)
    });
  }

  const coverage = points.length ? presentCount / points.length : 0;
  const absent = cells.filter(function (c) {
    return c.ok && !c.present;
  });

  const findings = [];
  if (absent.length >= Math.ceil(points.length / 2)) {
    findings.push({
      id: 'maps:pack_absent:' + keyword.replace(/\s+/g, '_').slice(0, 40),
      code: 'maps_pack_absent',
      recipeId: 'maps_pack_absent',
      title: 'Missing from Maps pack for “' + keyword + '”',
      plainLanguage:
        'You appear in ' +
        presentCount +
        ' of ' +
        points.length +
        ' sampled map points. Strengthen GBP, NAP and local pages for this query.',
      severity: 'high',
      status: 'open',
      actions: ['create_task', 'page_optimiser'],
      autoFixAllowed: false,
      evidence: {
        source: 'maps_grid',
        keyword: keyword,
        presentCount: presentCount,
        pointCount: points.length,
        coverage: coverage
      },
      labelClass: labelClass
    });
  }

  return {
    ok: true,
    siteId: site && site.id,
    keyword: keyword,
    centre: centre,
    gridSize: size,
    pointCount: points.length,
    presentCount: presentCount,
    coverage: coverage,
    mapsVisibilityScore: Math.max(0.1, Math.min(0.95, coverage || 0.15)),
    cells: cells,
    findings: findings,
    provider: provider,
    labelClass: labelClass,
    safeguards: {
      note:
        'Maps grid uses DataForSEO (or mock). Cap grid size to control spend. GBP connection is separate and optional.'
    },
    sampledAt: new Date().toISOString()
  };
}

async function persistSerpSnapshots(admin, siteId, sample) {
  if (!admin || !siteId || !sample) return { ok: false, skipped: 'missing' };
  // si_serp_snapshots requires keyword_id FK — Maps grid stores a summary annotation until
  // tracked keyword linkage lands. Soft-skip warehouse insert to avoid hard failures.
  try {
    const { error } = await admin.from('si_annotations').insert({
      site_id: siteId,
      annotation_type: 'maps_grid_sample',
      title: 'Maps grid — ' + (sample.keyword || 'query'),
      detail: {
        keyword: sample.keyword,
        coverage: sample.coverage,
        presentCount: sample.presentCount,
        pointCount: sample.pointCount,
        gridSize: sample.gridSize,
        provider: sample.provider,
        centre: sample.centre,
        findings: (sample.findings || []).map(function (f) {
          return { code: f.code, title: f.title };
        }),
        cells: (sample.cells || []).map(function (c) {
          return {
            lat: c.lat,
            lng: c.lng,
            present: c.present,
            ok: c.ok
          };
        })
      }
    });
    if (error) {
      if (/relation|does not exist/i.test(String(error.message || ''))) {
        return { ok: false, skipped: 'schema_pending' };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true, stored: 'annotation' };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
}

async function runAndMeter(admin, site, opts) {
  const sample = await sampleMapsGrid(site, opts);
  if (admin && site && site.id) {
    await meterUsage(admin, site.id, 'maps_grid', sample.pointCount || 1, {
      provider: sample.provider,
      keyword: sample.keyword,
      gridSize: sample.gridSize
    });
    sample.persist = await persistSerpSnapshots(admin, site.id, sample);
  }
  return sample;
}

module.exports = {
  CITY_COORDS: CITY_COORDS,
  centreForSite: centreForSite,
  buildGridPoints: buildGridPoints,
  presenceInMapsResults: presenceInMapsResults,
  defaultKeyword: defaultKeyword,
  sampleMapsGrid: sampleMapsGrid,
  persistSerpSnapshots: persistSerpSnapshots,
  runAndMeter: runAndMeter
};
