// GET  /api/api-positioning-layouts          -> list layouts (partners see enabled)
// GET  /api/api-positioning-layouts?id=      -> one layout
// POST /api/api-positioning-layouts
//   action: save | delete | apply | capture
// Auth: Bearer JWT (same pattern as site-backups)

const { createClient } = require('@supabase/supabase-js');
const {
  applyPositioningLayout,
  captureLayoutFromConfig
} = require('../lib/positioning-layouts');
const { pinTrustBarUnderHero } = require('../lib/section-order');
const {
  scrubDemoPacks,
  aiRegenDemoPacks,
  syncLiveDemoSite,
  demoBrandFor,
  defaultFeatures,
  defaultBenefits
} = require('../lib/theme-demos');

const SUPABASE_URL = process.env.SUPABASE_URL;
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function readBody(req) {
  return new Promise((resolve) => {
    if (req.body) {
      if (typeof req.body === 'string') {
        try { return resolve(JSON.parse(req.body)); } catch { return resolve({}); }
      }
      return resolve(req.body);
    }
    let raw = '';
    req.on('data', (c) => { raw += c; });
    req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}

async function requireUser(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const userClient = createClient(
      SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
      { global: { headers: { Authorization: 'Bearer ' + token } } }
    );
    const { data, error } = await userClient.auth.getUser(token);
    if (error || !data || !data.user) return null;
    return data.user;
  } catch {
    return null;
  }
}

async function isSuperAdmin(userId) {
  const { data } = await admin.from('profiles').select('is_super_admin').eq('id', userId).maybeSingle();
  return !!(data && data.is_super_admin);
}

async function partnerIdForUser(userId) {
  const { data } = await admin.from('partners').select('id,status').eq('user_id', userId).maybeSingle();
  if (!data || data.status !== 'active') return null;
  return data.id;
}

async function assertSiteAccess(user, siteId) {
  if (!siteId) return { ok: false, code: 400, error: 'no_site' };
  const { data: site, error } = await admin.from('sites')
    .select('id,owner_user_id,servicing_partner_id,referring_partner_id,config,slug,business_name')
    .eq('id', siteId)
    .maybeSingle();
  if (error || !site) return { ok: false, code: 404, error: 'site_not_found' };
  if (await isSuperAdmin(user.id)) return { ok: true, site };
  if (site.owner_user_id && site.owner_user_id === user.id) return { ok: true, site };
  const partnerId = await partnerIdForUser(user.id);
  if (partnerId && (site.servicing_partner_id === partnerId || site.referring_partner_id === partnerId)) {
    return { ok: true, site };
  }
  if (!site.owner_user_id) return { ok: true, site };
  return { ok: false, code: 403, error: 'not_your_site' };
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || ('layout-' + Date.now());
}

function json(res, code, obj) {
  res.statusCode = code;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify(obj));
}

function tableMissing(err) {
  const m = String((err && err.message) || err || '');
  return /positioning_layouts|does not exist|schema cache/i.test(m);
}

module.exports = async (req, res) => {
  const user = await requireUser(req);
  if (!user) return json(res, 401, { ok: false, error: 'auth' });

  const superAdmin = await isSuperAdmin(user.id);

  try {
    const url = new URL(req.url, 'https://x');

    if (req.method === 'GET') {
      const id = (url.searchParams.get('id') || '').trim();
      const includeDisabled = url.searchParams.get('all') === '1' && superAdmin;

      if (id) {
        const { data, error } = await admin.from('positioning_layouts').select('*').eq('id', id).maybeSingle();
        if (error) {
          if (tableMissing(error)) {
            return json(res, 200, { ok: true, layout: null, setup_required: true });
          }
          throw error;
        }
        if (!data) return json(res, 404, { ok: false, error: 'not_found' });
        if (!superAdmin && (!data.enabled || data.visibility === 'admin')) {
          return json(res, 403, { ok: false, error: 'forbidden' });
        }
        return json(res, 200, { ok: true, layout: data });
      }

      let q = admin.from('positioning_layouts').select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
      if (!includeDisabled) {
        q = q.eq('enabled', true).in('visibility', ['partners', 'public']);
      }
      const { data, error } = await q;
      if (error) {
        if (tableMissing(error)) {
          return json(res, 200, {
            ok: true,
            layouts: [],
            setup_required: true,
            hint: 'Run db/positioning_layouts.sql in Supabase to enable Themes.'
          });
        }
        throw error;
      }
      return json(res, 200, { ok: true, layouts: data || [] });
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const action = String(body.action || '').trim();

      if (action === 'capture') {
        if (!superAdmin) return json(res, 403, { ok: false, error: 'super_only' });
        const siteId = (body.site_id || body.siteId || '').trim();
        const access = await assertSiteAccess(user, siteId);
        if (!access.ok) return json(res, access.code, { ok: false, error: access.error });
        const payload = captureLayoutFromConfig(access.site.config || {}, {
          name: body.name,
          slug: body.slug,
          description: body.description,
          theme_image_url: body.theme_image_url || body.themeImageUrl,
          layout_image_url: body.layout_image_url || body.layoutImageUrl,
          industry_tags: body.industry_tags || body.industryTags,
          visibility: body.visibility || 'partners',
          includeDemoPacks: !!body.include_demo_packs || !!body.includeDemoPacks,
          packKeys: body.pack_keys || body.packKeys
        });
        return json(res, 200, { ok: true, draft: payload });
      }

      if (action === 'save') {
        if (!superAdmin) return json(res, 403, { ok: false, error: 'super_only' });
        const name = String(body.name || '').trim();
        if (!name) return json(res, 400, { ok: false, error: 'name_required' });
        const slug = slugify(body.slug || name);
        let sectionOrder = Array.isArray(body.section_order)
          ? body.section_order
          : (Array.isArray(body.sectionOrder) ? body.sectionOrder : []);
        sectionOrder = pinTrustBarUnderHero(sectionOrder);

        const row = {
          slug,
          name,
          description: body.description || null,
          theme_image_url: body.theme_image_url || body.themeImageUrl || null,
          layout_image_url: body.layout_image_url || body.layoutImageUrl || null,
          section_order: sectionOrder,
          apps: Array.isArray(body.apps) ? body.apps : [],
          demo_packs: (body.demo_packs && typeof body.demo_packs === 'object')
            ? body.demo_packs
            : ((body.demoPacks && typeof body.demoPacks === 'object') ? body.demoPacks : {}),
          industry_tags: Array.isArray(body.industry_tags)
            ? body.industry_tags
            : (Array.isArray(body.industryTags) ? body.industryTags : []),
          visibility: body.visibility || 'partners',
          sort_order: body.sort_order != null ? Number(body.sort_order) : 0,
          enabled: body.enabled !== false,
          created_by: user.id,
          updated_at: new Date().toISOString()
        };
        if (Array.isArray(body.features)) row.features = body.features;
        if (Array.isArray(body.benefits)) row.benefits = body.benefits;
        if (body.promo_headline != null || body.promoHeadline != null) {
          row.promo_headline = body.promo_headline || body.promoHeadline || null;
        }
        if (body.promo_body != null || body.promoBody != null) {
          row.promo_body = body.promo_body || body.promoBody || null;
        }
        if (body.demo_brand_name != null || body.demoBrandName != null) {
          row.demo_brand_name = body.demo_brand_name || body.demoBrandName || null;
        }
        if (body.demo_site_id != null || body.demoSiteId != null) {
          row.demo_site_id = body.demo_site_id || body.demoSiteId || null;
        }

        const layoutId = (body.id || body.layout_id || '').trim();
        let result;
        if (layoutId) {
          delete row.created_by;
          result = await admin.from('positioning_layouts').update(row).eq('id', layoutId).select('*').maybeSingle();
        } else {
          result = await admin.from('positioning_layouts').insert(row).select('*').maybeSingle();
        }
        if (result.error) {
          if (tableMissing(result.error)) {
            return json(res, 503, {
              ok: false,
              error: 'setup_required',
              hint: 'Run db/positioning_layouts.sql in Supabase first.'
            });
          }
          // Retry without expansion columns if migration not applied yet
          if (/features|benefits|promo_|demo_site|demo_brand/i.test(result.error.message || '')) {
            delete row.features;
            delete row.benefits;
            delete row.promo_headline;
            delete row.promo_body;
            delete row.demo_brand_name;
            delete row.demo_site_id;
            if (layoutId) {
              result = await admin.from('positioning_layouts').update(row).eq('id', layoutId).select('*').maybeSingle();
            } else {
              result = await admin.from('positioning_layouts').insert(row).select('*').maybeSingle();
            }
          }
          if (result.error) throw result.error;
        }

        let demoSync = null;
        const wantLive = !!body.publish_live_demo || !!body.publishLiveDemo;
        if (wantLive && result.data) {
          demoSync = await syncLiveDemoSite(admin, result.data, {});
          if (demoSync && demoSync.ok && demoSync.site) {
            const { data: refreshed } = await admin
              .from('positioning_layouts')
              .select('*')
              .eq('id', result.data.id)
              .maybeSingle();
            if (refreshed) result.data = refreshed;
          }
        }

        return json(res, 200, { ok: true, layout: result.data, demo: demoSync });
      }

      if (action === 'publish_demo') {
        if (!superAdmin) return json(res, 403, { ok: false, error: 'super_only' });
        const layoutId = (body.id || body.layout_id || '').trim();
        if (!layoutId) return json(res, 400, { ok: false, error: 'id_required' });
        const { data: layout, error: le } = await admin.from('positioning_layouts').select('*').eq('id', layoutId).maybeSingle();
        if (le) throw le;
        if (!layout) return json(res, 404, { ok: false, error: 'not_found' });
        const patch = {
          visibility: body.visibility || 'public',
          enabled: body.enabled !== false,
          updated_at: new Date().toISOString()
        };
        if (!Array.isArray(layout.features) || !layout.features.length) patch.features = defaultFeatures(layout);
        if (!Array.isArray(layout.benefits) || !layout.benefits.length) patch.benefits = defaultBenefits(layout);
        if (!layout.demo_brand_name) patch.demo_brand_name = demoBrandFor(layout);
        const { data: saved, error: se } = await admin
          .from('positioning_layouts')
          .update(patch)
          .eq('id', layoutId)
          .select('*')
          .maybeSingle();
        if (se && /features|benefits|demo_brand/i.test(se.message || '')) {
          delete patch.features;
          delete patch.benefits;
          delete patch.demo_brand_name;
          const retry = await admin.from('positioning_layouts').update(patch).eq('id', layoutId).select('*').maybeSingle();
          if (retry.error) throw retry.error;
          const demo = await syncLiveDemoSite(admin, retry.data || layout, {});
          return json(res, 200, { ok: true, layout: retry.data, demo: demo, hint: 'Run db/theme_demos_expansion.sql for promo fields.' });
        }
        if (se) throw se;
        const demo = await syncLiveDemoSite(admin, saved || layout, {});
        return json(res, 200, { ok: true, layout: saved, demo: demo });
      }

      if (action === 'update_demo') {
        if (!superAdmin) return json(res, 403, { ok: false, error: 'super_only' });
        const layoutId = (body.id || body.layout_id || '').trim();
        if (!layoutId) return json(res, 400, { ok: false, error: 'id_required' });
        const { data: layout, error: le } = await admin.from('positioning_layouts').select('*').eq('id', layoutId).maybeSingle();
        if (le) throw le;
        if (!layout) return json(res, 404, { ok: false, error: 'not_found' });

        const scrubbed = scrubDemoPacks(layout.demo_packs || {}, layout);
        const regen = await aiRegenDemoPacks(scrubbed, layout);
        const brand = body.demo_brand_name || body.demoBrandName || demoBrandFor(layout);
        const patch = {
          demo_packs: regen.packs,
          demo_brand_name: brand,
          updated_at: new Date().toISOString()
        };
        if (body.visibility) patch.visibility = body.visibility;
        const { data: saved, error: se } = await admin
          .from('positioning_layouts')
          .update(patch)
          .eq('id', layoutId)
          .select('*')
          .maybeSingle();
        if (se && /demo_brand/i.test(se.message || '')) {
          delete patch.demo_brand_name;
          const retry = await admin.from('positioning_layouts').update(patch).eq('id', layoutId).select('*').maybeSingle();
          if (retry.error) throw retry.error;
          const demo = await syncLiveDemoSite(admin, Object.assign({}, retry.data || layout, { demo_brand_name: brand }), {});
          return json(res, 200, {
            ok: true,
            layout: retry.data,
            demo: demo,
            regen_via: regen.via,
            scrubbed: true
          });
        }
        if (se) throw se;
        const demo = await syncLiveDemoSite(admin, saved || layout, {});
        return json(res, 200, {
          ok: true,
          layout: saved,
          demo: demo,
          regen_via: regen.via,
          scrubbed: true
        });
      }

      if (action === 'delete') {
        if (!superAdmin) return json(res, 403, { ok: false, error: 'super_only' });
        const layoutId = (body.id || body.layout_id || '').trim();
        if (!layoutId) return json(res, 400, { ok: false, error: 'id_required' });
        const { error } = await admin.from('positioning_layouts').delete().eq('id', layoutId);
        if (error) throw error;
        return json(res, 200, { ok: true });
      }

      if (action === 'apply') {
        const layoutId = (body.id || body.layout_id || '').trim();
        const siteId = (body.site_id || body.siteId || '').trim();
        const mode = String(body.mode || 'structure').trim();
        if (!layoutId || !siteId) {
          return json(res, 400, { ok: false, error: 'layout_id_and_site_id_required' });
        }
        const access = await assertSiteAccess(user, siteId);
        if (!access.ok) return json(res, access.code, { ok: false, error: access.error });

        const { data: layout, error: le } = await admin.from('positioning_layouts')
          .select('*').eq('id', layoutId).maybeSingle();
        if (le) {
          if (tableMissing(le)) {
            return json(res, 503, { ok: false, error: 'setup_required' });
          }
          throw le;
        }
        if (!layout) return json(res, 404, { ok: false, error: 'layout_not_found' });
        if (!superAdmin && (!layout.enabled || layout.visibility === 'admin')) {
          return json(res, 403, { ok: false, error: 'forbidden' });
        }

        // Auto-backup before any content-touching apply
        let backupId = null;
        if (mode === 'demo_replace' || mode === 'fill_empty' || mode === 'visual' || body.backup !== false) {
          try {
            const label = 'Before theme: ' + (layout.name || 'layout').slice(0, 80);
            const cfg = access.site.config || {};
            const sizeBytes = JSON.stringify(cfg).length;
            const { data: bk } = await admin.from('site_backups').insert({
              site_id: siteId,
              label,
              config: cfg,
              size_bytes: sizeBytes
            }).select('id').maybeSingle();
            backupId = bk && bk.id;
          } catch (be) {
            console.warn('positioning-layouts backup failed:', be && be.message);
          }
        }

        const applied = applyPositioningLayout(access.site.config || {}, layout, { mode });
        const { error: ue } = await admin.from('sites').update({
          config: applied.config,
          updated_at: new Date().toISOString()
        }).eq('id', siteId);
        if (ue) throw ue;

        return json(res, 200, {
          ok: true,
          mode: applied.mode,
          changedSections: applied.changedSections,
          notes: applied.notes,
          backupId,
          config: applied.config
        });
      }

      return json(res, 400, { ok: false, error: 'unknown_action' });
    }

    return json(res, 405, { ok: false, error: 'method' });
  } catch (e) {
    console.error('api-positioning-layouts:', e && e.message);
    return json(res, 500, { ok: false, error: 'server', message: (e && e.message) || 'error' });
  }
};
