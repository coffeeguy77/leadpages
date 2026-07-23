const { ensureAccessToken, searchStream, digits } = require('./client');
const { matchFinalUrl } = require('./match-url');

function dateStr(d) {
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return dateStr(d);
}

/**
 * Sync campaign + landing page metrics for one connected site.
 */
async function syncSiteMetrics(admin, site, conn, { fromDay, toDay } = {}) {
  const from = fromDay || daysAgo(7);
  const to = toDay || daysAgo(0);
  const access = await ensureAccessToken(admin, conn);
  const cid = digits(conn.customer_id);
  const login = conn.login_customer_id || cid;

  const query =
    `SELECT
      segments.date,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      segments.device,
      landing_page_view.unexpanded_final_url,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions,
      metrics.ctr,
      metrics.average_cpc
    FROM landing_page_view
    WHERE segments.date BETWEEN '${from}' AND '${to}'`;

  let rows = [];
  try {
    rows = await searchStream(access, cid, query, login);
  } catch (e) {
    // Fallback: campaign-level only if landing_page_view is unavailable
    const q2 =
      `SELECT
        segments.date,
        campaign.id,
        campaign.name,
        segments.device,
        metrics.impressions,
        metrics.clicks,
        metrics.cost_micros,
        metrics.conversions,
        metrics.ctr,
        metrics.average_cpc
      FROM campaign
      WHERE segments.date BETWEEN '${from}' AND '${to}'
        AND campaign.status != 'REMOVED'`;
    rows = await searchStream(access, cid, q2, login);
  }

  const upserts = [];
  const unmatched = new Map();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const seg = r.segments || {};
    const camp = r.campaign || {};
    const ag = r.adGroup || r.ad_group || {};
    const lp = r.landingPageView || r.landing_page_view || {};
    const met = r.metrics || {};
    const finalUrl = lp.unexpandedFinalUrl || lp.unexpanded_final_url || null;
    const day = seg.date || null;
    if (!day) continue;

    let pageId = null;
    if (finalUrl) {
      const m = matchFinalUrl(site, finalUrl);
      if (m && m.pageId) pageId = m.pageId;
      else if (m && m.pageType === 'main') pageId = null;
      else {
        const prev = unmatched.get(finalUrl) || { clicks: 0 };
        prev.clicks += Number(met.clicks || 0);
        unmatched.set(finalUrl, prev);
      }
    }

    upserts.push({
      site_id: site.id,
      customer_id: cid,
      day,
      campaign_id: camp.id != null ? String(camp.id) : null,
      campaign_name: camp.name || null,
      ad_group_id: ag.id != null ? String(ag.id) : null,
      ad_group_name: ag.name || null,
      device: seg.device || null,
      final_url: finalUrl,
      page_id: pageId,
      impressions: Number(met.impressions || 0),
      clicks: Number(met.clicks || 0),
      cost_micros: Number(met.costMicros != null ? met.costMicros : (met.cost_micros || 0)),
      conversions: Number(met.conversions || 0),
      ctr: met.ctr != null ? Number(met.ctr) : null,
      average_cpc_micros: met.averageCpc != null ? Number(met.averageCpc) : (met.average_cpc != null ? Number(met.average_cpc) : null),
      updated_at: new Date().toISOString()
    });
  }

  // Upsert in chunks
  for (let i = 0; i < upserts.length; i += 100) {
    const chunk = upserts.slice(i, i + 100);
    const { error } = await admin.from('ads_metrics_daily').upsert(chunk, {
      onConflict: 'site_id,day,campaign_id,ad_group_id,device,final_url'
    });
    if (error) console.error('ads_metrics_daily upsert:', error.message);
  }

  for (const [url, info] of unmatched.entries()) {
    await admin.from('ads_unmatched_urls').upsert({
      site_id: site.id,
      final_url: url,
      last_seen_at: new Date().toISOString(),
      clicks: info.clicks || 0
    }, { onConflict: 'site_id,final_url' });
  }

  let keywordRows = 0;
  try {
    keywordRows = await syncKeywordMetrics(admin, site, access, cid, login, from, to);
  } catch (e) {
    console.error('ads_keyword_daily sync soft-fail:', String((e && e.message) || e).slice(0, 200));
  }

  await admin.from('google_ads_connections').update({
    last_sync_at: new Date().toISOString(),
    last_sync_error: null,
    updated_at: new Date().toISOString()
  }).eq('site_id', site.id);

  return { rows: upserts.length, unmatched: unmatched.size, keywords: keywordRows, from, to };
}

/**
 * Soft-fail keyword_view import for Search Intelligence SEO↔PPC matrix.
 */
async function syncKeywordMetrics(admin, site, access, cid, login, from, to) {
  const query =
    `SELECT
      segments.date,
      campaign.id,
      campaign.name,
      ad_group.id,
      ad_group.name,
      ad_group_criterion.criterion_id,
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM keyword_view
    WHERE segments.date BETWEEN '${from}' AND '${to}'
      AND ad_group_criterion.status != 'REMOVED'`;

  let rows = [];
  try {
    rows = await searchStream(access, cid, query, login);
  } catch (_e) {
    return 0;
  }

  const upserts = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const seg = r.segments || {};
    const camp = r.campaign || {};
    const ag = r.adGroup || r.ad_group || {};
    const crit = r.adGroupCriterion || r.ad_group_criterion || {};
    const kw = crit.keyword || {};
    const met = r.metrics || {};
    const day = seg.date || null;
    const text = kw.text || crit.keywordText || null;
    if (!day || !text) continue;
    upserts.push({
      site_id: site.id,
      customer_id: cid,
      day: day,
      campaign_id: camp.id != null ? String(camp.id) : null,
      campaign_name: camp.name || null,
      ad_group_id: ag.id != null ? String(ag.id) : null,
      ad_group_name: ag.name || null,
      criterion_id: crit.criterionId != null ? String(crit.criterionId) : crit.criterion_id != null ? String(crit.criterion_id) : null,
      keyword_text: String(text),
      match_type: kw.matchType || kw.match_type || null,
      impressions: Number(met.impressions || 0),
      clicks: Number(met.clicks || 0),
      cost_micros: Number(met.costMicros != null ? met.costMicros : met.cost_micros || 0),
      conversions: Number(met.conversions || 0),
      updated_at: new Date().toISOString()
    });
  }

  for (let i = 0; i < upserts.length; i += 100) {
    const chunk = upserts.slice(i, i + 100);
    const { error } = await admin.from('ads_keyword_daily').upsert(chunk, {
      onConflict: 'site_id,day,campaign_id,ad_group_id,criterion_id,keyword_text'
    });
    if (error) {
      if (/relation|does not exist/i.test(String(error.message || ''))) return 0;
      console.error('ads_keyword_daily upsert:', error.message);
    }
  }
  return upserts.length;
}

async function syncAllConnected(admin, opts) {
  // Include legacy rows where connection_status was never set (treat as connected).
  const { data: conns, error } = await admin
    .from('google_ads_connections')
    .select('*')
    .eq('enabled', true)
    .not('customer_id', 'is', null)
    .not('refresh_token', 'is', null);
  if (error) throw error;
  const eligible = (conns || []).filter((c) => {
    const st = c.connection_status;
    return !st || st === 'connected';
  });
  const results = [];
  for (let i = 0; i < eligible.length; i++) {
    const conn = eligible[i];
    try {
      const { data: site } = await admin.from('sites').select('id, slug, business_name, config').eq('id', conn.site_id).maybeSingle();
      if (!site) continue;
      const r = await syncSiteMetrics(admin, site, conn, opts);
      results.push({ site_id: site.id, ok: true, ...r });
    } catch (e) {
      const msg = String((e && e.message) || 'sync_failed').slice(0, 240);
      console.error('sync site', conn.site_id, msg);
      await admin.from('google_ads_connections').update({
        last_sync_error: msg,
        updated_at: new Date().toISOString()
      }).eq('site_id', conn.site_id);
      results.push({ site_id: conn.site_id, ok: false, error: msg });
    }
  }
  return results;
}

module.exports = {
  syncSiteMetrics,
  syncKeywordMetrics,
  syncAllConnected,
  daysAgo,
  dateStr
};
