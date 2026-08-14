#!/usr/bin/env node
/**
 * Sync marketplace/demos/demo-shared.js IIFE into trade + landing shell templates.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const dsPath = path.join(ROOT, 'marketplace/demos/demo-shared.js');
const targets = [
  'trade.template.json',
  'landing-shell-neutral-v1.template.json'
];

const ds = fs.readFileSync(dsPath, 'utf8').trim().replace(/^\/\/[^\n]*\n/, '');
if (!ds.startsWith('(function(){') || !ds.endsWith('})();')) {
  console.error('demo-shared.js must be a single IIFE');
  process.exit(1);
}

function syncOne(rel) {
  const tplPath = path.join(ROOT, rel);
  const rawTpl = fs.readFileSync(tplPath, 'utf8');
  if (rawTpl.indexOf('}\n{') !== -1) {
    console.error(rel + ' looks concatenated (invalid JSON merge). Fix before syncing.');
    process.exit(1);
  }
  const tpl = JSON.parse(rawTpl);
  let html = tpl.html;

  const anchor = 'const SITE_CONFIG = __SITE_CONFIG__;\n';
  const scriptPos = html.indexOf(anchor);
  if (scriptPos < 0) {
    console.error('Could not find SITE_CONFIG anchor in ' + rel);
    process.exit(1);
  }

  const iifeStart = html.indexOf('(function(){', scriptPos);
  const scriptEnd = html.indexOf('</script>', scriptPos);
  const scriptBlock = html.slice(scriptPos, scriptEnd);
  const relEnd = scriptBlock.lastIndexOf('})();');
  if (iifeStart < 0 || relEnd < 0) {
    console.error('Could not find applyCfg IIFE in ' + rel);
    process.exit(1);
  }
  const iifeEnd = scriptPos + relEnd + 5;

  html = html.slice(0, iifeStart) + ds + html.slice(iifeEnd);
  tpl.html = html;
  const out = JSON.stringify(tpl);
  JSON.parse(out);
  if (out.indexOf('}\n{') !== -1) {
    console.error('Refusing to write concatenated ' + rel);
    process.exit(1);
  }
  fs.writeFileSync(tplPath, out);
  console.log('Synced demo-shared.js into ' + rel + ' (' + ds.length + ' chars)');
}

targets.forEach(syncOne);
