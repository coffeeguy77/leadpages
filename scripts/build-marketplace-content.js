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

const SAMPLE_IMAGES = {
  project: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&h=800&fit=crop',
  deck: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&h=800&fit=crop',
  bathroom: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=1200&h=800&fit=crop',
  before: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=600&fit=crop',
  after: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=600&fit=crop',
  crew: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&h=400&fit=crop&crop=faces',
  instagram: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&h=600&fit=crop',
  hero: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1920&h=1080&fit=crop',
  generic: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=1200&h=800&fit=crop'
};

const DEFAULT_SERVICES = [
  { on: true, icon: 'droplet', title: 'Blocked Drains', body: 'Same-day drain clearing for blocked sinks, toilets and outdoor drains.' },
  { on: true, icon: 'flame', title: 'Hot Water Systems', body: 'Supply and install gas, electric and heat pump hot water systems.' },
  { on: true, icon: 'wrench', title: 'Leak Repairs', body: 'Fast leak detection and repair — no damage, no mess.' },
  { on: true, icon: 'home', title: 'Bathroom Renovations', body: 'Complete bathroom fit-outs from design to final fixture.' }
];

function pickSampleImage(key, ctx) {
  if (/before/i.test(key) || /before/i.test(ctx)) return SAMPLE_IMAGES.before;
  if (/after/i.test(key) || /after/i.test(ctx)) return SAMPLE_IMAGES.after;
  if (/photo|crew|member|avatar/i.test(key)) return SAMPLE_IMAGES.crew;
  if (/insta|ig|social|permalink/i.test(key)) return SAMPLE_IMAGES.instagram;
  if (/slide|hero|banner|cover/i.test(key)) return SAMPLE_IMAGES.hero;
  if (/deck|landscape/i.test(ctx)) return SAMPLE_IMAGES.deck;
  if (/bath|ensuite/i.test(ctx)) return SAMPLE_IMAGES.bathroom;
  if (/project|portfolio|feed|gallery|thumb/i.test(key)) return SAMPLE_IMAGES.project;
  return SAMPLE_IMAGES.generic;
}

function fillEmptyImages(obj, ctx) {
  if (!obj || typeof obj !== 'object') return;
  if (Array.isArray(obj)) {
    obj.forEach(function(item, i) { fillEmptyImages(item, ctx + '.' + i); });
    return;
  }
  Object.keys(obj).forEach(function(k) {
    const v = obj[k];
    if ((k === 'image' || k === 'photo' || k === 'img' || k === 'imageUrl' || k === 'beforeImage' || k === 'afterImage' || k === 'logo' || k === 'permalink') &&
        typeof v === 'string' && !v.trim()) {
      obj[k] = pickSampleImage(k, ctx + '.' + k);
    } else if (v && typeof v === 'object') {
      fillEmptyImages(v, ctx + '.' + k);
    }
  });
}

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
  if (sectionKey === 'services' && !flat.services) {
    flat.services = clone(DEFAULT_SERVICES);
  }
  fillEmptyImages(flat, sectionKey);
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
