#!/usr/bin/env node
/**
 * Build marketplace sell-templates.json and playground-default-configs.json
 * from marketplace/app-content.json + manage.html trade defaults.
 *
 * Usage: node scripts/build-marketplace-content.js
 */
const fs = require('fs');
const path = require('path');
const pp = require('../lib/playground-preset');
const mv = require('../lib/marketplace-visuals');

const ROOT = path.join(__dirname, '..');
const MANAGE = path.join(ROOT, 'manage.html');
const CONTENT = path.join(ROOT, 'marketplace', 'app-content.json');
const OUT_SELL = path.join(ROOT, 'marketplace', 'sell-templates.json');
const OUT_DEFAULTS = path.join(ROOT, 'marketplace', 'playground-default-configs.json');

const SKIP_SECTIONS = new Set(['header', 'footer', 'emerg', 'seoTokens']);

function extractFromManage(name, endMarker) {
  const mg = fs.readFileSync(MANAGE, 'utf8');
  const start = mg.indexOf('const ' + name + '=');
  const end = mg.indexOf(endMarker, start);
  let chunk = mg.slice(start, end).replace('const ' + name + '=', '').trim();
  if (chunk.endsWith(';')) chunk = chunk.slice(0, -1);
  return eval('(' + chunk + ')');
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}

function buildFlatSample(sectionKey, tradeSections, tradeLists, meta) {
  const def = tradeSections[sectionKey] || {};
  const flat = {
    business: meta.business || 'Ace Plumbing Co.',
    trade: meta.trade || 'plumber',
    phone: meta.phone || '0261000000',
    theme: clone(meta.theme || { pipe: '#1f7bb8' })
  };
  const sec = { on: true };
  Object.keys(def).forEach(function(k) {
    if (k === 'on' || k === 'cta') return;
    if (def[k] && typeof def[k] === 'object' && !Array.isArray(def[k])) return;
    sec[k] = def[k];
  });
  Object.keys(tradeLists).forEach(function(lk) {
    const parts = lk.split('.');
    if (parts[0] !== sectionKey) return;
    sec[parts[1]] = clone(tradeLists[lk]);
  });
  if (meta.sampleOverrides) {
    Object.keys(meta.sampleOverrides).forEach(function(k) {
      if (k === sectionKey && typeof meta.sampleOverrides[k] === 'object') {
        Object.assign(sec, meta.sampleOverrides[k]);
      } else {
        flat[k] = clone(meta.sampleOverrides[k]);
      }
    });
  }
  flat[sectionKey] = sec;
  return flat;
}

function buildSellTemplate(key, meta) {
  const hero = mv.getCategoryHero(key, meta);
  const blocks = [
    {
      block_type: 'rich_text',
      payload: {
        heading: meta.pitchHeading || meta.name,
        text: meta.pitch
      }
    }
  ];
  const shotBlock = mv.screenshotBlock(key, meta, meta.name);
  if (shotBlock) blocks.push(shotBlock);
  blocks.push(
    {
      block_type: 'benefits',
      payload: {
        heading: meta.featuresHeading || 'Key features',
        items: meta.features || []
      }
    },
    {
      block_type: 'benefits',
      payload: {
        heading: meta.partnerHeading || 'Why partners sell it',
        items: meta.partnerBenefits || []
      }
    },
    {
      block_type: 'playground',
      payload: {
        section_key: key,
        presets: meta.presets || ['default']
      }
    }
  );
  return {
    name: meta.name,
    tagline: meta.tagline,
    summary: meta.summary,
    hero_image_url: hero ? hero.url : null,
    blocks
  };
}

function main() {
  if (!fs.existsSync(CONTENT)) {
    console.error('Missing', CONTENT);
    process.exit(1);
  }
  const appContent = JSON.parse(fs.readFileSync(CONTENT, 'utf8'));
  const tradeSections = extractFromManage('DEFAULT_TRADE_SECTIONS', 'const TRADE_PRESETS');
  const tradeLists = extractFromManage('DEFAULT_TRADE_LISTS', 'function _hslValidColor');

  const sellTemplates = {};
  const defaultConfigs = {};
  const sectionKeys = Object.keys(appContent).sort();

  sectionKeys.forEach(function(key) {
    const meta = appContent[key];
    if (!meta || !meta.name) {
      console.warn('skip (no meta):', key);
      return;
    }
    sellTemplates[key] = buildSellTemplate(key, meta);
    defaultConfigs[key] = buildFlatSample(key, tradeSections, tradeLists, meta);
  });

  const marketplaceKeys = Object.keys(tradeSections).filter(function(k) {
    return !SKIP_SECTIONS.has(k);
  });
  const missing = marketplaceKeys.filter(function(k) { return !appContent[k]; });
  if (missing.length) {
    console.warn('WARNING: app-content.json missing keys:', missing.join(', '));
  }

  fs.writeFileSync(OUT_SELL, JSON.stringify(sellTemplates, null, 2) + '\n');
  fs.writeFileSync(OUT_DEFAULTS, JSON.stringify(defaultConfigs, null, 2) + '\n');
  console.log('Wrote', sectionKeys.length, 'sell templates →', path.relative(ROOT, OUT_SELL));
  console.log('Wrote', sectionKeys.length, 'default configs →', path.relative(ROOT, OUT_DEFAULTS));
}

main();
