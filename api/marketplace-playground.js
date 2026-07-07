// api/marketplace-playground.js
// GET  ?section_key=featuredProjects  -> { contract_version, field_defs, presets[], sell_template }
// POST { action:'sync_site'|'save_preset'|'export_file_preset', ... }  (super admin)
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const pp = require('../lib/playground-preset');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const ROOT = path.join(__dirname, '..');
const PLAYGROUND_DIR = path.join(ROOT, 'playground');

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
  });
}

async function requireSuperAdmin(req) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token) return null;
  const userClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: 'Bearer ' + token } }
  });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return null;
  const { data: prof } = await sb.from('profiles').select('is_super_admin').eq('id', user.id).maybeSingle();
  if (!prof || !prof.is_super_admin) return null;
  return user;
}

function loadJson(rel) {
  try {
    return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
  } catch {
    return null;
  }
}

function buildDefaultPreset(sectionKey) {
  if (!sectionKey) return null;
  const defaults = loadJson('marketplace/playground-default-configs.json') || {};
  const flat = defaults[sectionKey];
  if (!flat) return null;
  const sellTemplates = loadJson('marketplace/sell-templates.json') || {};
  const appName = (sellTemplates[sectionKey] && sellTemplates[sectionKey].name) || sectionKey;
  const siteConfig = pp.flatDemoToSiteConfig(flat, sectionKey);
  return pp.normalizePreset(
    pp.dbConfigFromSiteConfig(sectionKey, siteConfig),
    { slug: 'default', label: appName + ' (sample)', source: 'default', section_key: sectionKey }
  );
}

function listFilePresets(sectionKey) {
  if (!fs.existsSync(PLAYGROUND_DIR)) return [];
  return fs.readdirSync(PLAYGROUND_DIR)
    .filter((f) => f.endsWith('.json'))
    .map((f) => {
      try {
        const raw = JSON.parse(fs.readFileSync(path.join(PLAYGROUND_DIR, f), 'utf8'));
        const slug = f.replace(/\.json$/, '');
        const preset = pp.normalizePreset(raw, { slug, source: 'file', section_key: sectionKey || raw.section_key || raw.section });
        if (sectionKey && preset.section_key && preset.section_key !== sectionKey) return null;
        // Generic empty default.json applies to no specific section — use built-in sample instead.
        if (sectionKey && slug === 'default' && !preset.section_key) return null;
        return preset;
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function normalizeDbPreset(row) {
  return pp.normalizePreset(row.config || {}, {
    slug: row.slug,
    label: row.label,
    source: 'db',
    section_key: (row.config && row.config.section_key) || null
  });
}

async function getPlaygroundMeta(sectionKey) {
  const fieldDefs = loadJson('marketplace/playground-field-defs.json') || {};
  const sellTemplates = loadJson('marketplace/sell-templates.json') || {};
  const filePresets = listFilePresets(sectionKey);
  let dbPresets = [];

  if (sectionKey) {
    const { data: app } = await sb.from('app_registry')
      .select('id,slug,name,section_key')
      .eq('section_key', sectionKey)
      .maybeSingle();
    if (app) {
      const { data: rows } = await sb.from('app_presets')
        .select('slug,label,description,config,sort_order,is_live')
        .eq('app_id', app.id)
        .eq('is_live', true)
        .order('sort_order', { ascending: true });
      dbPresets = (rows || []).map(normalizeDbPreset);
    }
  }

  const seen = {};
  const presets = [];
  dbPresets.forEach((p) => { if (!seen[p.slug]) { seen[p.slug] = 1; presets.push(p); } });
  filePresets.forEach((p) => { if (!seen[p.slug]) { seen[p.slug] = 1; presets.push(p); } });
  if (sectionKey) {
    const built = buildDefaultPreset(sectionKey);
    if (built && !seen[built.slug]) {
      seen[built.slug] = 1;
      presets.push(built);
    }
  }

  return {
    contract_version: pp.CONTRACT_VERSION,
    section_key: sectionKey || null,
    field_defs: sectionKey ? (fieldDefs[sectionKey] || []) : fieldDefs,
    presets,
    sell_template: sectionKey ? (sellTemplates[sectionKey] || null) : null
  };
}

function extractSiteConfig(siteConfig, sectionKey) {
  const cfg = siteConfig || {};
  const sec = (cfg.sections && cfg.sections[sectionKey]) || cfg[sectionKey] || {};
  return pp.flatDemoToSiteConfig(
    Object.assign({}, cfg, { sections: { [sectionKey]: Object.assign({ on: true }, sec) } }),
    sectionKey
  );
}

module.exports = async (req, res) => {
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const sectionKey = ((req.query && req.query.section_key) || '').trim();
      const slug = ((req.query && req.query.slug) || '').trim();
      if (slug) {
        const filePath = path.join(PLAYGROUND_DIR, slug + '.json');
        if (fs.existsSync(filePath)) {
          const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          const preset = pp.normalizePreset(raw, { slug, source: 'file', section_key: sectionKey });
          return res.status(200).json(preset);
        }
        if (sectionKey) {
          const meta = await getPlaygroundMeta(sectionKey);
          const found = (meta.presets || []).find((p) => p.slug === slug);
          if (found) return res.status(200).json(found);
          if (slug === 'default') {
            const built = buildDefaultPreset(sectionKey);
            if (built) return res.status(200).json(built);
          }
        }
        return res.status(404).json({ error: 'preset_not_found' });
      }
      const meta = await getPlaygroundMeta(sectionKey);
      return res.status(200).json(meta);
    }

    if (req.method === 'POST') {
      const user = await requireSuperAdmin(req);
      if (!user) return res.status(403).json({ error: 'super_admin_required' });

      const body = await readBody(req);
      const action = (body.action || '').trim();

      if (action === 'sync_site') {
        const siteSlug = (body.site_slug || '').trim().toLowerCase();
        const sectionKey = (body.section_key || '').trim();
        const presetSlug = (body.preset_slug || 'live-sync').trim();
        const label = (body.label || 'Live site sync').trim();
        if (!siteSlug || !sectionKey) {
          return res.status(400).json({ error: 'site_slug and section_key required' });
        }

        const { data: site, error: siteErr } = await sb.from('sites')
          .select('id,slug,business_name,config')
          .eq('slug', siteSlug)
          .maybeSingle();
        if (siteErr) return res.status(500).json({ error: siteErr.message });
        if (!site) return res.status(404).json({ error: 'site_not_found' });

        const siteConfig = extractSiteConfig(site.config, sectionKey);
        const dbConfig = pp.dbConfigFromSiteConfig(sectionKey, siteConfig);
        const preset = pp.normalizePreset(dbConfig, { slug: presetSlug, label, source: 'db', section_key: sectionKey });

        const { data: app } = await sb.from('app_registry')
          .select('id,slug,name')
          .eq('section_key', sectionKey)
          .maybeSingle();

        if (!app) {
          return res.status(200).json({
            ok: true,
            saved: false,
            message: 'No app_registry row for this section_key — returning extracted preset only.',
            preset,
            site: { slug: site.slug, business_name: site.business_name }
          });
        }

        const row = {
          app_id: app.id,
          slug: presetSlug,
          label,
          description: 'Synced from live site ' + site.slug,
          config: dbConfig,
          sort_order: 0,
          is_live: true,
          updated_at: new Date().toISOString()
        };

        const { data: existing } = await sb.from('app_presets')
          .select('id')
          .eq('app_id', app.id)
          .eq('slug', presetSlug)
          .maybeSingle();

        const r = existing
          ? await sb.from('app_presets').update(row).eq('id', existing.id)
          : await sb.from('app_presets').insert(row);

        if (r.error) return res.status(500).json({ error: r.error.message });
        return res.status(200).json({
          ok: true,
          saved: true,
          app: app.slug,
          preset,
          site: { slug: site.slug, business_name: site.business_name }
        });
      }

      if (action === 'save_preset') {
        const sectionKey = (body.section_key || '').trim();
        const presetSlug = (body.preset_slug || '').trim();
        const label = (body.label || presetSlug).trim();
        const siteConfig = body.site_config;
        if (!sectionKey || !presetSlug || !siteConfig) {
          return res.status(400).json({ error: 'section_key, preset_slug, and site_config required' });
        }
        const dbConfig = pp.dbConfigFromSiteConfig(sectionKey, siteConfig);
        const preset = pp.normalizePreset(dbConfig, { slug: presetSlug, label, source: 'db', section_key: sectionKey });

        const { data: app } = await sb.from('app_registry')
          .select('id,slug')
          .eq('section_key', sectionKey)
          .maybeSingle();
        if (!app) return res.status(404).json({ error: 'app_not_found' });

        const row = {
          app_id: app.id,
          slug: presetSlug,
          label,
          description: body.description || 'Saved via marketplace playground API',
          config: dbConfig,
          sort_order: parseInt(body.sort_order, 10) || 0,
          is_live: body.is_live !== false,
          updated_at: new Date().toISOString()
        };

        const { data: existing } = await sb.from('app_presets')
          .select('id')
          .eq('app_id', app.id)
          .eq('slug', presetSlug)
          .maybeSingle();

        const r = existing
          ? await sb.from('app_presets').update(row).eq('id', existing.id)
          : await sb.from('app_presets').insert(row);

        if (r.error) return res.status(500).json({ error: r.error.message });
        return res.status(200).json({ ok: true, preset });
      }

      if (action === 'export_file_preset') {
        const sectionKey = (body.section_key || '').trim();
        const presetSlug = (body.preset_slug || '').trim();
        const siteConfig = body.site_config;
        if (!sectionKey || !presetSlug || !siteConfig) {
          return res.status(400).json({ error: 'section_key, preset_slug, and site_config required' });
        }
        const preset = pp.normalizePreset(
          pp.dbConfigFromSiteConfig(sectionKey, siteConfig),
          { slug: presetSlug, label: body.label || presetSlug, source: 'file', section_key: sectionKey }
        );
        return res.status(200).json({ ok: true, preset: pp.fileJsonFromPreset(preset) });
      }

      return res.status(400).json({ error: 'unknown_action' });
    }

    return res.status(405).json({ error: 'method_not_allowed' });
  } catch (e) {
    return res.status(500).json({ error: String((e && e.message) || e) });
  }
};
