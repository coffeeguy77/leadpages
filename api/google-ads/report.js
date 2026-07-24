// GET /api/google-ads/report?siteId=&days=&view=campaigns|landing_pages|leads|alerts
const { createClient } = require('@supabase/supabase-js');
const { matchFinalUrl } = require('../../lib/google-ads/match-url');
const { digits } = require('../../lib/google-ads/metrics-scope');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function authUser(req) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function daysAgoIso(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

async function loadConnCustomerId(siteId) {
  const { data: conn } = await admin
    .from('google_ads_connections')
    .select('customer_id')
    .eq('site_id', siteId)
    .maybeSingle();
  return digits(conn && conn.customer_id);
}

async function loadSiteMetrics(siteId, sinceDay, customerId) {
  let q = admin.from('ads_metrics_daily').select('*').eq('site_id', siteId).gte('day', sinceDay);
  if (customerId) q = q.eq('customer_id', customerId);
  else q = q.eq('customer_id', '__none__');
  const { data } = await q;
  return data || [];
}

module.exports = async (req, res) => {
  const json = (code, obj) => {
    res.statusCode = code;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(obj));
  };
  if (req.method !== 'GET') return json(405, { error: 'method' });
  if (!authUser(req)) return json(401, { error: 'auth' });

  try {
    const siteId = String((req.query && (req.query.siteId || req.query.site_id)) || '').trim();
    const view = String((req.query && req.query.view) || 'landing_pages');
    const days = Math.max(1, Math.min(90, parseInt((req.query && req.query.days) || '30', 10) || 30));
    if (!siteId) return json(400, { error: 'missing_siteId' });

    const since = daysAgoIso(days);
    const sinceDay = since.slice(0, 10);

    const { data: site } = await admin.from('sites').select('id,slug,business_name,config').eq('id', siteId).maybeSingle();
    if (!site) return json(404, { error: 'site_not_found' });

    const customerId = await loadConnCustomerId(siteId);

    if (view === 'campaigns') {
      const metrics = await loadSiteMetrics(siteId, sinceDay, customerId);

      const byCamp = new Map();
      (metrics || []).forEach((m) => {
        const key = m.campaign_id || 'unknown';
        const row = byCamp.get(key) || {
          campaignId: m.campaign_id,
          campaignName: m.campaign_name || m.campaign_id || 'Campaign',
          spend: 0, clicks: 0, impressions: 0, conversions: 0
        };
        row.spend += Number(m.cost_micros || 0) / 1e6;
        row.clicks += Number(m.clicks || 0);
        row.impressions += Number(m.impressions || 0);
        row.conversions += Number(m.conversions || 0);
        byCamp.set(key, row);
      });

      // Attach internal call/form counts by campaign utm when available
      const { data: events } = await admin
        .from('events')
        .select('event,props')
        .eq('site_id', siteId)
        .gte('created_at', since)
        .in('event', ['call_click', 'lead_submit', 'page_view']);

      const campExtra = new Map();
      (events || []).forEach((ev) => {
        const p = ev.props || {};
        const name = p.utm_campaign || '';
        if (!name) return;
        const ex = campExtra.get(name) || { visitors: 0, callClicks: 0, forms: 0, sessions: new Set() };
        if (ev.event === 'page_view') ex.visitors++;
        if (ev.event === 'call_click') { ex.callClicks++; if (p.session_id) ex.sessions.add(p.session_id); }
        if (ev.event === 'lead_submit') { ex.forms++; if (p.session_id) ex.sessions.add(p.session_id); }
        campExtra.set(name, ex);
      });

      const rows = Array.from(byCamp.values()).map((r) => {
        const ex = campExtra.get(r.campaignName) || { visitors: 0, callClicks: 0, forms: 0, sessions: new Set() };
        const unique = ex.sessions.size;
        return Object.assign({}, r, {
          visitors: ex.visitors,
          callClicks: ex.callClicks,
          forms: ex.forms,
          uniqueConversions: unique,
          costPerConversion: unique ? r.spend / unique : null
        });
      }).sort((a, b) => b.spend - a.spend);

      return json(200, {
        ok: true,
        view,
        days,
        customerId: customerId || null,
        rows,
        note: !customerId
          ? 'Select a Google Ads account first.'
          : rows.length
            ? null
            : 'No synced campaigns for this Ads account yet. Empty accounts show zero until you run ads and Sync now.'
      });
    }

    if (view === 'landing_pages') {
      const pages = Array.isArray(site.config && site.config.pages) ? site.config.pages : [];
      const metrics = await loadSiteMetrics(siteId, sinceDay, customerId);

      const byPage = new Map();
      // Seed published pages
      pages.forEach((p) => {
        if (!p || !p.id) return;
        byPage.set(p.id, {
          pageId: p.id,
          title: p.title || p.slug || p.id,
          slug: p.slug || '',
          url: '/' + (p.slug || ''),
          status: p.status || 'draft',
          spend: 0, adClicks: 0, impressions: 0,
          visitors: 0, callClicks: 0, forms: 0,
          sessions: new Set()
        });
      });
      // Main site bucket
      byPage.set('__main__', {
        pageId: null, title: 'Homepage', slug: '', url: '/', status: 'published',
        spend: 0, adClicks: 0, impressions: 0, visitors: 0, callClicks: 0, forms: 0, sessions: new Set()
      });

      (metrics || []).forEach((m) => {
        let key = m.page_id;
        if (!key) {
          if (m.final_url) {
            const matched = matchFinalUrl(site, m.final_url);
            if (matched && matched.pageId) key = matched.pageId;
            else key = '__main__';
          } else key = '__main__';
        }
        if (!byPage.has(key)) {
          byPage.set(key, {
            pageId: key === '__main__' ? null : key,
            title: m.final_url || key,
            slug: '',
            url: m.final_url || '',
            status: 'unknown',
            spend: 0, adClicks: 0, impressions: 0, visitors: 0, callClicks: 0, forms: 0, sessions: new Set()
          });
        }
        const row = byPage.get(key);
        row.spend += Number(m.cost_micros || 0) / 1e6;
        row.adClicks += Number(m.clicks || 0);
        row.impressions += Number(m.impressions || 0);
      });

      const { data: events } = await admin
        .from('events')
        .select('event,props')
        .eq('site_id', siteId)
        .gte('created_at', since)
        .in('event', ['page_view', 'call_click', 'lead_submit']);

      (events || []).forEach((ev) => {
        const p = ev.props || {};
        let key = p.page_id || (p.page_type === 'main' || !p.page_id ? '__main__' : p.page_id);
        if (!byPage.has(key)) {
          byPage.set(key, {
            pageId: key === '__main__' ? null : key,
            title: p.page_url || key,
            slug: '',
            url: p.page_url || '',
            status: 'unknown',
            spend: 0, adClicks: 0, impressions: 0, visitors: 0, callClicks: 0, forms: 0, sessions: new Set()
          });
        }
        const row = byPage.get(key);
        if (ev.event === 'page_view') row.visitors++;
        if (ev.event === 'call_click') {
          row.callClicks++;
          if (p.session_id) row.sessions.add(p.session_id);
        }
        if (ev.event === 'lead_submit') {
          row.forms++;
          if (p.session_id) row.sessions.add(p.session_id);
        }
      });

      const rows = Array.from(byPage.values()).map((r) => {
        const unique = r.sessions.size;
        const totalActions = r.callClicks + r.forms;
        return {
          pageId: r.pageId,
          title: r.title,
          slug: r.slug,
          url: r.url,
          status: r.status,
          spend: r.spend,
          adClicks: r.adClicks,
          impressions: r.impressions,
          visitors: r.visitors,
          callClicks: r.callClicks,
          forms: r.forms,
          totalActions,
          uniqueConversions: unique,
          visitorConversionRate: r.visitors ? totalActions / r.visitors : null,
          adClickToLeadRate: r.adClicks ? totalActions / r.adClicks : null,
          costPerForm: r.forms ? r.spend / r.forms : null,
          costPerCallClick: r.callClicks ? r.spend / r.callClicks : null,
          costPerLeadAction: unique ? r.spend / unique : null
        };
      }).filter((r) => r.spend > 0 || r.visitors > 0 || r.adClicks > 0 || r.forms > 0 || r.callClicks > 0)
        .sort((a, b) => b.spend - a.spend || b.visitors - a.visitors);

      return json(200, { ok: true, view, days, rows });
    }

    if (view === 'leads') {
      const { data: leads } = await admin
        .from('leads')
        .select('id,name,email,phone,status,created_at,page_id,landing_page_url,utm_source,utm_medium,utm_campaign,traffic_source,gclid,session_id')
        .eq('site_id', siteId)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200);

      const pages = Array.isArray(site.config && site.config.pages) ? site.config.pages : [];
      const pageTitle = {};
      pages.forEach((p) => { if (p && p.id) pageTitle[p.id] = p.title || p.slug; });

      const rows = (leads || []).map((l) => ({
        id: l.id,
        name: l.name,
        date: l.created_at,
        pageId: l.page_id,
        page: l.page_id ? (pageTitle[l.page_id] || l.landing_page_url || l.page_id) : (l.landing_page_url || 'Homepage'),
        source: l.traffic_source === 'google_ads' ? 'Google Ads' : (l.utm_source || l.traffic_source || 'Direct'),
        campaign: l.utm_campaign || '',
        conversion: 'Form',
        hasGclid: !!l.gclid,
        status: l.status
      }));

      return json(200, { ok: true, view, days, rows });
    }

    if (view === 'alerts') {
      // Lightweight insight rules
      const alerts = [];
      const reportRes = await (async () => {
        // reuse landing page aggregation via internal call pattern — inline minimal
        req.query.view = 'landing_pages';
        return null;
      })();
      void reportRes;

      const metrics = await loadSiteMetrics(siteId, sinceDay, customerId);
      const spendByPage = new Map();
      (metrics || []).forEach((m) => {
        const key = m.page_id || '__main__';
        spendByPage.set(key, (spendByPage.get(key) || 0) + Number(m.cost_micros || 0) / 1e6);
      });

      const { data: events } = await admin.from('events').select('event,props,created_at').eq('site_id', siteId).gte('created_at', since).in('event', ['call_click', 'lead_submit', 'page_view']);
      const formsByPage = new Map();
      const callsByPage = new Map();
      const visitorsByPage = new Map();
      const mobileVisitors = { ads: 0, conv: 0 };
      const desktopVisitors = { ads: 0, conv: 0 };

      (events || []).forEach((ev) => {
        const p = ev.props || {};
        const key = p.page_id || '__main__';
        const isAds = !!(p.gclid || p.traffic_source === 'google_ads');
        if (ev.event === 'page_view') {
          visitorsByPage.set(key, (visitorsByPage.get(key) || 0) + 1);
          if (isAds) {
            if (p.device_type === 'mobile') mobileVisitors.ads++;
            else desktopVisitors.ads++;
          }
        }
        if (ev.event === 'lead_submit') {
          formsByPage.set(key, (formsByPage.get(key) || 0) + 1);
          if (isAds) {
            if (p.device_type === 'mobile') mobileVisitors.conv++;
            else desktopVisitors.conv++;
          }
        }
        if (ev.event === 'call_click') {
          callsByPage.set(key, (callsByPage.get(key) || 0) + 1);
          if (isAds) {
            if (p.device_type === 'mobile') mobileVisitors.conv++;
            else desktopVisitors.conv++;
          }
        }
      });

      const pages = Array.isArray(site.config && site.config.pages) ? site.config.pages : [];
      const pageMeta = {};
      pages.forEach((p) => { if (p && p.id) pageMeta[p.id] = p; });

      spendByPage.forEach((spend, key) => {
        const forms = formsByPage.get(key) || 0;
        const calls = callsByPage.get(key) || 0;
        const visitors = visitorsByPage.get(key) || 0;
        const title = key === '__main__' ? 'Homepage' : ((pageMeta[key] && (pageMeta[key].title || pageMeta[key].slug)) || key);
        if (spend >= 50 && forms === 0 && calls === 0) {
          alerts.push({
            type: 'high_spend_no_conversions',
            severity: 'warn',
            title: 'High spend, no conversions',
            body: `${title} spent $${spend.toFixed(0)} over ${days} days without a call click or form submission.`,
            pageId: key === '__main__' ? null : key
          });
        }
        if (key === '__main__' && spend >= 20) {
          alerts.push({
            type: 'homepage_mismatch',
            severity: 'info',
            title: 'Landing-page mismatch',
            body: `Google Ads is sending traffic ($${spend.toFixed(0)}) to your homepage instead of a dedicated landing page.`,
            pageId: null
          });
        }
        const p = pageMeta[key];
        if (p && p.status !== 'published' && spend > 0) {
          alerts.push({
            type: 'unpublished_page',
            severity: 'critical',
            title: 'Advertising to an unpublished page',
            body: `${title} received ad spend but is not currently published.`,
            pageId: key
          });
        }
        if (visitors >= 40 && forms === 0) {
          alerts.push({
            type: 'form_problem',
            severity: 'warn',
            title: 'Form problem',
            body: `${title} received ${visitors} visitors but no successful form submissions in ${days} days.`,
            pageId: key === '__main__' ? null : key
          });
        }
      });

      if (mobileVisitors.ads >= 20) {
        const mRate = mobileVisitors.ads ? mobileVisitors.conv / mobileVisitors.ads : 0;
        const dRate = desktopVisitors.ads ? desktopVisitors.conv / desktopVisitors.ads : 0;
        const mobileShare = mobileVisitors.ads / (mobileVisitors.ads + desktopVisitors.ads || 1);
        if (mobileShare >= 0.7 && dRate > 0 && mRate < dRate * 0.5) {
          alerts.push({
            type: 'mobile_issue',
            severity: 'warn',
            title: 'Mobile issue',
            body: `${Math.round(mobileShare * 100)}% of advertising visits are mobile, but mobile conversion is considerably below desktop.`,
            pageId: null
          });
        }
      }

      const { data: unmatched } = await admin.from('ads_unmatched_urls').select('final_url,clicks').eq('site_id', siteId).limit(10);
      (unmatched || []).forEach((u) => {
        if (Number(u.clicks || 0) >= 5) {
          alerts.push({
            type: 'unmatched_url',
            severity: 'info',
            title: 'Unmatched advertising URL',
            body: `${u.final_url} received ${u.clicks} clicks but does not match a LeadPages page.`,
            pageId: null
          });
        }
      });

      return json(200, { ok: true, view, days, alerts });
    }

    return json(400, { error: 'unknown_view' });
  } catch (e) {
    console.error('google-ads report:', e && e.message);
    return json(500, { error: (e && e.message) || 'report_failed' });
  }
};
