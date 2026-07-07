#!/usr/bin/env node
/**
 * Migrate playground/*.json and optionally app_presets rows to contract v1.
 * Usage:
 *   node scripts/migrate-playground-presets.js           # migrate JSON files only
 *   node scripts/migrate-playground-presets.js --db      # also upsert app_presets (needs env)
 */
const fs = require('fs');
const path = require('path');
const pp = require('../lib/playground-preset');

const PLAYGROUND_DIR = path.join(__dirname, '../playground');

function migrateFiles() {
  if (!fs.existsSync(PLAYGROUND_DIR)) {
    console.log('No playground/ directory');
    return 0;
  }
  let count = 0;
  fs.readdirSync(PLAYGROUND_DIR).filter((f) => f.endsWith('.json')).forEach((f) => {
    const slug = f.replace(/\.json$/, '');
    const raw = JSON.parse(fs.readFileSync(path.join(PLAYGROUND_DIR, f), 'utf8'));
    if (raw.contract_version === pp.CONTRACT_VERSION && raw.site_config) {
      console.log('skip (already v1):', f);
      return;
    }
    const preset = pp.normalizePreset(raw, { slug, source: 'file' });
    const out = pp.fileJsonFromPreset(preset);
    fs.writeFileSync(path.join(PLAYGROUND_DIR, f), JSON.stringify(out, null, 1) + '\n');
    console.log('migrated:', f, '→', preset.section_key || '(no section)');
    count++;
  });
  return count;
}

async function migrateDb() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for --db');
    process.exit(1);
  }
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rows, error } = await sb.from('app_presets').select('id,slug,label,config,app_id');
  if (error) throw error;
  let count = 0;
  for (const row of rows || []) {
    const cfg = row.config || {};
    if (cfg.contract_version === pp.CONTRACT_VERSION && cfg.site_config) continue;
    const sectionKey = cfg.section_key || null;
    let siteConfig;
    if (cfg.demo_config) {
      siteConfig = pp.legacyDbToSiteConfig(cfg);
    } else {
      siteConfig = pp.flatDemoToSiteConfig(cfg, sectionKey);
    }
    const next = pp.dbConfigFromSiteConfig(sectionKey || '', siteConfig);
    const { error: upErr } = await sb.from('app_presets').update({ config: next }).eq('id', row.id);
    if (upErr) console.error('failed', row.id, upErr.message);
    else { console.log('db migrated:', row.slug); count++; }
  }
  return count;
}

(async function main() {
  const fileCount = migrateFiles();
  console.log('Files migrated:', fileCount);
  if (process.argv.includes('--db')) {
    const dbCount = await migrateDb();
    console.log('DB rows migrated:', dbCount);
  }
})();
