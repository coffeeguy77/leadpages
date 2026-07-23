// api/public-demos.js — public Theme Demo library for leadpages.com.au/demos
// No auth. Lists enabled positioning_layouts with visibility=public.
//
// GET              -> { ok, demos:[{...card}] }
// GET ?slug=x      -> { ok, demo:{...card, detail} }

'use strict';

const { createClient } = require('@supabase/supabase-js');
const { publicDemoCard } = require('../lib/theme-demos');

const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'public, max-age=60, s-maxage=120');
  res.setHeader('access-control-allow-origin', '*');
  res.end(JSON.stringify(obj));
}

function tableMissing(err) {
  const m = String((err && err.message) || err || '');
  return /positioning_layouts|does not exist|schema cache|demo_site_id|features/i.test(m);
}

module.exports = async function publicDemos(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-methods', 'GET,OPTIONS');
    return res.end('');
  }
  if (req.method !== 'GET') return json(res, 405, { ok: false, error: 'GET only' });

  try {
    const url = new URL(req.url, 'https://x');
    const slug = (url.searchParams.get('slug') || '').trim();

    // Prefer selecting new columns; fall back if migration not run yet.
    let select =
      'id,slug,name,description,theme_image_url,layout_image_url,apps,industry_tags,features,benefits,promo_headline,promo_body,demo_brand_name,demo_site_id,updated_at,sort_order';
    let q = admin
      .from('positioning_layouts')
      .select(select)
      .eq('enabled', true)
      .eq('visibility', 'public')
      .order('sort_order', { ascending: true })
      .order('updated_at', { ascending: false });

    if (slug) q = q.eq('slug', slug).limit(1);
    else q = q.limit(60);

    let { data, error } = await q;
    if (error && tableMissing(error)) {
      select =
        'id,slug,name,description,theme_image_url,layout_image_url,apps,industry_tags,updated_at,sort_order';
      q = admin
        .from('positioning_layouts')
        .select(select)
        .eq('enabled', true)
        .eq('visibility', 'public')
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false });
      if (slug) q = q.eq('slug', slug).limit(1);
      else q = q.limit(60);
      ({ data, error } = await q);
    }
    if (error) {
      if (tableMissing(error)) return json(res, 200, { ok: true, demos: [], setup_required: true });
      throw error;
    }

    const rows = data || [];
    const siteIds = rows.map(function (r) {
      return r.demo_site_id;
    }).filter(Boolean);
    let sitesById = {};
    if (siteIds.length) {
      const { data: sites } = await admin
        .from('sites')
        .select('id,slug,business_name,status,is_demo')
        .in('id', siteIds);
      (sites || []).forEach(function (s) {
        sitesById[s.id] = s;
      });
    }

    const demos = rows.map(function (r) {
      return publicDemoCard(r, { demoSite: sitesById[r.demo_site_id] || null });
    });

    if (slug) {
      if (!demos.length) return json(res, 404, { ok: false, error: 'not_found' });
      return json(res, 200, { ok: true, demo: demos[0] });
    }
    return json(res, 200, { ok: true, demos: demos });
  } catch (e) {
    return json(res, 500, { ok: false, error: String(e.message || e) });
  }
};
