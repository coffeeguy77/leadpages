/**
 * Headless audit: every marketplace demo preview + editor surface.
 * Usage: node scripts/audit-marketplace-apps.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer-core';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BASE = process.env.MP_AUDIT_BASE || 'http://127.0.0.1:8765';
const CHROME = process.env.CHROME_PATH || '/usr/local/bin/google-chrome';

const content = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/app-content.json'), 'utf8'));
const fieldDefs = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-field-defs.json'), 'utf8'));
const defaults = JSON.parse(fs.readFileSync(path.join(root, 'marketplace/playground-default-configs.json'), 'utf8'));
const PLATFORM = new Set(['seoCommand', 'advertising']);

function kebab(sk) {
  return sk.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/_/g, '-').toLowerCase();
}

const sectionKeys = Object.keys(content).filter((k) => !PLATFORM.has(k)).sort();

async function auditDemo(page, sk) {
  const url = `${BASE}/marketplace/demos/demo-${sk}.html`;
  const row = {
    sk,
    slug: kebab(sk),
    demoUrl: url,
    demoHttp: 0,
    hasDataSec: false,
    display: '',
    textLen: 0,
    childCount: 0,
    imgCount: 0,
    fieldDefs: (fieldDefs[sk] || []).length,
    hasDefaults: !!defaults[sk],
    dedicatedEditor: sk === 'trustBar',
    compactEditor: true, // Trust Bar dedicated OR shared LPMarketplaceCompactEditor
    v2Json: sk === 'trustBar',
    previewOk: false,
    editorOk: false,
    notes: []
  };

  const res = await page.goto(url, { waitUntil: 'networkidle0', timeout: 45000 }).catch((e) => {
    row.notes.push('goto: ' + e.message);
    return null;
  });
  if (!res) return row;
  row.demoHttp = res.status();

  // Inject defaults (flat → sections) + force section on, then re-apply
  await page.evaluate((sectionKey, defCfg) => {
    const base = window.SITE_CONFIG || {};
    const flat = defCfg || {};
    const SCALAR = new Set(['theme', 'business', 'trade', 'phone', 'phoneText', 'layout', 'sectionOrder', 'logo', 'pages', 'services']);
    const nested = { sections: Object.assign({}, base.sections || {}) };
    Object.keys(flat).forEach((k) => {
      if (SCALAR.has(k)) nested[k] = flat[k];
      else if (k === 'sections' && flat.sections) Object.assign(nested.sections, flat.sections);
      else nested.sections[k] = Object.assign({}, nested.sections[k] || {}, flat[k] || {});
    });
    nested.theme = Object.assign({}, flat.theme || {}, base.theme || {}, nested.theme || {});
    if (base.sections) {
      Object.keys(base.sections).forEach((k) => {
        nested.sections[k] = Object.assign({}, nested.sections[k] || {}, base.sections[k] || {});
      });
    }
    if (!nested.sections[sectionKey]) nested.sections[sectionKey] = {};
    nested.sections[sectionKey].on = true;
    if (sectionKey === 'serviceAreaMap' && nested.sections.serviceAreas) {
      nested.sections.serviceAreas.on = true;
    }
    window.SITE_CONFIG = Object.assign({}, base, nested);
    if (typeof window.__applyTradeConfig === 'function') window.__applyTradeConfig(window.SITE_CONFIG);
  }, sk, defaults[sk] || null).catch((e) => row.notes.push('inject: ' + e.message));

  // Wait a tick for render
  await new Promise((r) => setTimeout(r, 300));

  const metrics = await page.evaluate((sectionKey) => {
    const node = document.querySelector(`[data-sec="${sectionKey}"]`) || document.querySelector('main section');
    if (!node) return { hasDataSec: false };
    const style = window.getComputedStyle(node);
    const text = (node.textContent || '').replace(/\s+/g, ' ').trim();
    return {
      hasDataSec: !!document.querySelector(`[data-sec="${sectionKey}"]`),
      display: node.style.display || style.display,
      visibility: style.visibility,
      textLen: text.length,
      childCount: node.querySelectorAll('*').length,
      imgCount: node.querySelectorAll('img').length,
      innerLen: (node.innerHTML || '').length,
      sample: text.slice(0, 80)
    };
  }, sk);

  Object.assign(row, metrics);
  const hidden = row.display === 'none' || row.visibility === 'hidden';
  row.previewOk = !hidden && (row.textLen > 15 || row.imgCount > 0 || row.innerLen > 100);
  if (!row.previewOk) {
    row.notes.push(hidden ? 'section-hidden' : 'section-empty');
  }

  // Editor: Trust Bar = manage-parity; others = compact shared editor (Items|Style)
  row.editorOk = row.fieldDefs >= 3 || row.dedicatedEditor;
  if (row.fieldDefs < 3) row.notes.push('thin-editor');
  if (row.dedicatedEditor) row.notes.push('trustbar-manage-parity-editor');
  else row.notes.push('compact-shared-editor');

  return row;
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage']
  });
  const page = await browser.newPage();
  page.setDefaultTimeout(45000);

  const results = [];
  for (const sk of sectionKeys) {
    process.stderr.write(`auditing ${sk}...\n`);
    results.push(await auditDemo(page, sk));
  }

  // Platform explainers — page shell only
  for (const sk of [...PLATFORM]) {
    results.push({
      sk,
      slug: kebab(sk),
      demoUrl: null,
      demoHttp: null,
      previewOk: null,
      editorOk: null,
      fieldDefs: 0,
      dedicatedEditor: false,
      notes: ['platform-explainer-no-playground'],
      platform: true
    });
  }

  await browser.close();

  const outDir = path.join(root, '/opt/cursor/artifacts');
  try { fs.mkdirSync(outDir, { recursive: true }); } catch (_) {}
  // also write under workspace
  const outPath = path.join(root, 'tmp-marketplace-audit.json');
  fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2));

  const previewFail = results.filter((r) => r.previewOk === false);
  const previewPass = results.filter((r) => r.previewOk === true);
  const generic = results.filter((r) => !r.platform && !r.dedicatedEditor);

  console.log(JSON.stringify({
    summary: {
      sectionApps: sectionKeys.length,
      previewPass: previewPass.length,
      previewFail: previewFail.length,
      dedicatedEditors: results.filter((r) => r.dedicatedEditor).length,
      genericEditors: generic.length,
      platformExplainers: PLATFORM.size,
      trustBarParityReady: results.filter((r) => r.dedicatedEditor && r.previewOk).map((r) => r.sk)
    },
    previewFailures: previewFail.map((r) => ({ sk: r.sk, notes: r.notes, display: r.display, textLen: r.textLen })),
    all: results.map((r) => ({
      sk: r.sk,
      previewOk: r.previewOk,
      editor: r.dedicatedEditor ? 'trustbar-manage-parity' : (r.platform ? 'none-platform' : 'compact-shared'),
      fieldDefs: r.fieldDefs,
      notes: r.notes
    }))
  }, null, 2));
  console.error('Wrote', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
