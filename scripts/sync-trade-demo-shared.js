#!/usr/bin/env node
/**
 * Sync marketplace/demos/demo-shared.js IIFE into trade.template.json embedded script.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const tplPath = path.join(ROOT, 'trade.template.json');
const dsPath = path.join(ROOT, 'marketplace/demos/demo-shared.js');

const rawTpl = fs.readFileSync(tplPath, 'utf8');
if (rawTpl.indexOf('}\n{') !== -1) {
  console.error('trade.template.json looks concatenated (invalid JSON merge). Fix before syncing.');
  process.exit(1);
}
const tpl = JSON.parse(rawTpl);
let html = tpl.html;

const ds = fs.readFileSync(dsPath, 'utf8').trim().replace(/^\/\/[^\n]*\n/, '');
if (!ds.startsWith('(function(){') || !ds.endsWith('})();')) {
  console.error('demo-shared.js must be a single IIFE');
  process.exit(1);
}

const anchor = 'const SITE_CONFIG = __SITE_CONFIG__;\n';
const scriptPos = html.indexOf(anchor);
if (scriptPos < 0) {
  console.error('Could not find SITE_CONFIG anchor in trade.template.json');
  process.exit(1);
}

const iifeStart = html.indexOf('(function(){', scriptPos);
const scriptEnd = html.indexOf('</script>', scriptPos);
const scriptBlock = html.slice(scriptPos, scriptEnd);
const relEnd = scriptBlock.lastIndexOf('})();');
if (iifeStart < 0 || relEnd < 0) {
  console.error('Could not find applyCfg IIFE in trade.template.json');
  process.exit(1);
}
const iifeEnd = scriptPos + relEnd + 5;

html = html.slice(0, iifeStart) + ds + html.slice(iifeEnd);
tpl.html = html;
const out = JSON.stringify(tpl);
// Guard against merge corruption that previously broke /api/render (require of invalid JSON).
JSON.parse(out);
if (out.indexOf('}\n{') !== -1) {
  console.error('Refusing to write concatenated trade.template.json');
  process.exit(1);
}
fs.writeFileSync(tplPath, out);
console.log('Synced demo-shared.js into trade.template.json (' + ds.length + ' chars)');
