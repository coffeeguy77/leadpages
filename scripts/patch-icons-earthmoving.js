#!/usr/bin/env node
/**
 * Add earthmoving / mechanical / computer icons + curated categories to icons.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const iconsPath = path.join(__dirname, '..', 'icons.js');
const src = fs.readFileSync(iconsPath, 'utf8');
const ctx = { window: {} };
vm.runInNewContext(src, ctx);
const W = ctx.window;

const NEW_ICONS = {
  // —— Earthmoving & civil (custom Lucide-style 24×24 strokes) ——
  excavator:
    '<path d="M3 19h8" /><path d="M5 19V11h5l2 3h2" /><circle cx="7" cy="19" r="2" /><circle cx="15" cy="19" r="2" /><path d="M14 14l5-7 2 1-4 7" /><path d="M19 7l2-3" /><path d="M21 4h-3l-1 2" />',
  bulldozer:
    '<path d="M3 17h11" /><path d="M4 17V10h7l2 3h3v4" /><circle cx="7" cy="17" r="2" /><circle cx="14" cy="17" r="2" /><path d="M18 9v8h3V11l-3-2z" /><path d="M4 10H2" />',
  dozer:
    '<path d="M3 17h11" /><path d="M4 17V10h7l2 3h3v4" /><circle cx="7" cy="17" r="2" /><circle cx="14" cy="17" r="2" /><path d="M18 9v8h3V11l-3-2z" /><path d="M4 10H2" />',
  'dump-truck':
    '<path d="M1 17h10" /><path d="M3 17V9h6v8" /><path d="M9 12h5l3 3v2h-8" /><circle cx="5" cy="17" r="2" /><circle cx="15" cy="17" r="2" /><path d="M14 9l5-5h3v8h-3" />',
  tipper:
    '<path d="M2 18h9" /><path d="M4 18V10h5v8" /><path d="M9 13h5l2 2v3H9" /><circle cx="6" cy="18" r="2" /><circle cx="14" cy="18" r="2" /><path d="M12 10l4-5 3 1-3 6" />',
  'wheel-loader':
    '<path d="M3 18h8" /><path d="M5 18v-6h5l1.5 3H14v3" /><circle cx="7" cy="18" r="2" /><circle cx="14" cy="18" r="2" /><path d="M14 12l4-4h3v3l-2 3h-5" /><path d="M18 8V5" />',
  loader:
    '<path d="M3 18h8" /><path d="M5 18v-6h5l1.5 3H14v3" /><circle cx="7" cy="18" r="2" /><circle cx="14" cy="18" r="2" /><path d="M14 12l4-4h3v3l-2 3h-5" /><path d="M18 8V5" />',
  'road-roller':
    '<path d="M4 16h9" /><path d="M6 16V9h6v7" /><circle cx="8" cy="16" r="2" /><path d="M15 16a3 3 0 1 0 6 0V9a3 3 0 0 0-6 0z" /><path d="M9 9V6h4" />',
  grader:
    '<path d="M2 17h14" /><path d="M4 17V11h8l2 3h2v3" /><circle cx="7" cy="17" r="2" /><circle cx="14" cy="17" r="2" /><path d="M3 14h16" /><path d="M18 14l3 3" />',
  backhoe:
    '<path d="M2 18h9" /><path d="M4 18v-7h5v7" /><circle cx="6.5" cy="18" r="2" /><circle cx="14" cy="18" r="2" /><path d="M9 13h4v5" /><path d="M13 13l5-5 2 1-3 6" /><path d="M18 8l2-3h-3" />',
  'tower-crane':
    '<path d="M6 22V8" /><path d="M6 8H3" /><path d="M6 10h14" /><path d="M18 10V6l3 1" /><path d="M14 10v5" /><path d="M12 15h4" /><path d="M4 22h4" /><path d="M6 5V3" />',
  'cement-mixer':
    '<path d="M3 18h8" /><path d="M5 18v-7h6v7" /><circle cx="7" cy="18" r="2" /><circle cx="15" cy="18" r="2" /><path d="M11 13h4l3 3v2h-4" /><path d="M14 8l4-2 2 4-4 3z" />',
  'skid-steer':
    '<path d="M4 17h10" /><path d="M6 17v-5h7v5" /><circle cx="8" cy="17" r="2" /><circle cx="13" cy="17" r="2" /><path d="M13 12l4-3h2v4l-3 2h-3" /><path d="M7 12V9h5" />',
  digger:
    '<path d="M3 19h8" /><path d="M5 19V11h5l2 3h2" /><circle cx="7" cy="19" r="2" /><circle cx="15" cy="19" r="2" /><path d="M14 14l5-7 2 1-4 7" /><path d="M19 7l2-3" /><path d="M21 4h-3l-1 2" />',
  'civil-works':
    '<path d="M3 21h18" /><path d="M5 21V10l7-5 7 5v11" /><path d="M9 21v-6h6v6" /><path d="M2 10h20" />',
  'road-works':
    '<rect x="2" y="6" width="20" height="8" rx="1" /><path d="M17 14v7" /><path d="M7 14v7" /><path d="M17 3v3" /><path d="M7 3v3" /><path d="M10 14 2.3 6.3" /><path d="m14 6 7.7 7.7" /><path d="m8 6 8 8" />',

  // —— Computers ——
  pc:
    '<rect x="6" y="3" width="12" height="16" rx="1" /><path d="M9 7h6" /><path d="M9 10h6" /><path d="M9 13h4" /><path d="M10 19v2" /><path d="M14 19v2" /><path d="M8 21h8" />',
  desktop:
    '<rect x="6" y="3" width="12" height="16" rx="1" /><path d="M9 7h6" /><path d="M9 10h6" /><path d="M9 13h4" /><path d="M10 19v2" /><path d="M14 19v2" /><path d="M8 21h8" />',
  computer:
    '<rect x="2" y="3" width="12" height="10" rx="1" /><path d="M6 17h4" /><path d="M8 13v4" /><rect x="15" y="5" width="7" height="12" rx="1" /><path d="M17 8h3" /><path d="M17 11h3" /><path d="M17 14h2" />',
  gpu:
    '<rect x="2" y="7" width="20" height="10" rx="2" /><circle cx="8" cy="12" r="2.5" /><circle cx="15" cy="12" r="2.5" /><path d="M6 7V5" /><path d="M10 7V5" /><path d="M14 17v2" /><path d="M18 17v2" />',
  'computer-speaker':
    '<rect x="5" y="3" width="14" height="18" rx="2" /><circle cx="12" cy="14" r="3" /><path d="M12 7h.01" />',

  // —— Mechanical ——
  engine:
    '<path d="M6 12H3l2-3h3" /><path d="M8 9V6h4v3" /><path d="M12 9h4l2 3h3" /><path d="M5 12v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" /><path d="M9 18v2" /><path d="M15 18v2" /><circle cx="9" cy="13.5" r="1" /><circle cx="15" cy="13.5" r="1" />',
  piston:
    '<path d="M9 3h6v4H9z" /><path d="M10 7v4" /><path d="M14 7v4" /><rect x="7" y="11" width="10" height="6" rx="1" /><path d="M12 17v4" /><path d="M9 21h6" />',
  gearbox:
    '<circle cx="12" cy="12" r="3" /><path d="M12 2v3" /><path d="M12 19v3" /><path d="m4.9 4.9 2.1 2.1" /><path d="m17 17 2.1 2.1" /><path d="M2 12h3" /><path d="M19 12h3" /><path d="m4.9 19.1 2.1-2.1" /><path d="m17 7 2.1-2.1" /><circle cx="12" cy="12" r="7" />',
  'oil-can':
    '<path d="M4 14h9l3-4h4" /><path d="M16 10V7l3-2" /><path d="M4 14v4a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2v-1" /><path d="M8 10V8" />',
  'bearing':
    '<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" /><path d="M12 3v2" /><path d="M12 19v2" /><path d="m4.2 6.2 1.5 1.5" /><path d="m18.3 16.3 1.5 1.5" />'
};

Object.assign(W.LP_ICONS, NEW_ICONS);

const EARTH = [
  'excavator', 'digger', 'bulldozer', 'dozer', 'dump-truck', 'tipper', 'wheel-loader', 'loader',
  'road-roller', 'grader', 'backhoe', 'tower-crane', 'cement-mixer', 'skid-steer', 'civil-works',
  'road-works', 'tractor', 'truck', 'forklift', 'container', 'hard-hat', 'construction',
  'traffic-cone', 'shovel', 'pickaxe', 'factory', 'fuel', 'map-pin', 'route'
].filter((k) => W.LP_ICONS[k]);

const MECHANICAL = [
  'wrench', 'wrench-off', 'hammer', 'drill', 'cog', 'settings', 'settings-2', 'nut', 'bolt',
  'anvil', 'toolbox', 'gauge', 'engine', 'piston', 'gearbox', 'oil-can', 'bearing', 'fuel',
  'axe', 'pickaxe', 'shovel', 'construction', 'hard-hat', 'factory', 'cable', 'plug', 'unplug'
].filter((k) => W.LP_ICONS[k]);

const COMPUTERS = [
  'laptop', 'laptop-2', 'laptop-minimal', 'laptop-minimal-check', 'pc', 'desktop', 'computer',
  'monitor', 'monitor-check', 'monitor-cog', 'monitor-smartphone', 'cpu', 'gpu', 'keyboard',
  'mouse', 'server', 'server-cog', 'hard-drive', 'memory-stick', 'microchip', 'circuit-board',
  'computer-speaker', 'printer', 'tablet', 'usb', 'webcam', 'database', 'wifi', 'router',
  'app-window', 'terminal', 'code', 'bluetooth'
].filter((k) => W.LP_ICONS[k]);

function upsertCat(name, keys) {
  const i = W.LP_ICON_CATS.findIndex((c) => c[0] === name);
  if (i >= 0) W.LP_ICON_CATS[i][1] = keys;
  else W.LP_ICON_CATS.splice(4, 0, [name, keys]);
}

upsertCat('Earthmoving & Civil', EARTH);
upsertCat('Mechanical', MECHANICAL);
upsertCat('Computers & IT', COMPUTERS);

// Prefer Computers & IT category name — keep old IT cat but point keys uniqueness is fine across cats
const itIdx = W.LP_ICON_CATS.findIndex((c) => c[0] === 'IT, computer & web');
if (itIdx >= 0) {
  // Merge any missing into Computers & IT already done; rename for discoverability
  W.LP_ICON_CATS[itIdx][0] = 'IT, web & code';
}

const extraTerms = {
  excavator: ['excavator', 'digger', 'backhoe', 'earthmoving', 'civil'],
  digger: ['excavator', 'digger', 'earthmoving'],
  bulldozer: ['bulldozer', 'dozer', 'earthmoving', 'civil'],
  dozer: ['bulldozer', 'dozer', 'earthmoving'],
  'dump-truck': ['dump-truck', 'tipper', 'truck', 'earthmoving'],
  tipper: ['tipper', 'dump-truck', 'truck'],
  'wheel-loader': ['loader', 'wheel-loader', 'earthmoving'],
  loader: ['loader', 'wheel-loader'],
  'road-roller': ['roller', 'road-roller', 'civil'],
  grader: ['grader', 'civil', 'road'],
  backhoe: ['backhoe', 'excavator', 'earthmoving'],
  'tower-crane': ['crane', 'tower-crane', 'civil', 'construction'],
  'cement-mixer': ['concrete', 'cement-mixer', 'civil'],
  'skid-steer': ['skid-steer', 'bobcat', 'loader'],
  'civil-works': ['civil', 'earthmoving', 'construction'],
  'road-works': ['road', 'civil', 'construction', 'barrier'],
  earthmoving: ['excavator', 'bulldozer', 'dump-truck', 'wheel-loader', 'grader', 'road-roller', 'backhoe', 'digger', 'dozer'],
  civil: ['civil-works', 'excavator', 'grader', 'road-roller', 'tower-crane', 'hard-hat', 'traffic-cone'],
  diesel: ['engine', 'fuel', 'gauge', 'truck', 'excavator', 'bulldozer'],
  mechanical: ['wrench', 'cog', 'engine', 'piston', 'gearbox', 'gauge', 'nut', 'bolt', 'drill', 'hammer', 'oil-can', 'bearing'],
  computer: ['computer', 'pc', 'desktop', 'laptop', 'monitor', 'cpu', 'keyboard', 'mouse'],
  laptop: ['laptop', 'laptop-minimal', 'computer', 'monitor'],
  pc: ['pc', 'desktop', 'computer', 'monitor', 'cpu'],
  desktop: ['desktop', 'pc', 'computer', 'monitor']
};

Object.keys(extraTerms).forEach((k) => {
  const list = extraTerms[k].filter((id) => W.LP_ICONS[id]);
  if (!list.length) return;
  W.LP_ICON_TERMS[k] = Array.from(new Set([...(W.LP_ICON_TERMS[k] || []), ...list]));
});

['excavator', 'bulldozer', 'laptop', 'pc', 'wrench', 'engine', 'cpu'].forEach((k) => {
  if (W.LP_ICONS[k] && !W.LP_ICON_POPULAR.includes(k)) W.LP_ICON_POPULAR.push(k);
});

function esc(s) {
  return JSON.stringify(s);
}

let out = '/* LeadPages outline icon sprite — Lucide (ISC). Self-hosted; loaded by manage + trade template. */\n';
out += 'window.LP_ICONS=' + JSON.stringify(W.LP_ICONS) + ';\n';
out += 'window.LP_ICON_CATS=' + JSON.stringify(W.LP_ICON_CATS) + ';\n';
out += `\n/* Search aliases — map domain words → likely icons so e.g. "quote" finds clipboard/phone */\n(function () {\n  window.LP_ICON_POPULAR=${JSON.stringify(W.LP_ICON_POPULAR)};\n  window.LP_ICON_TERMS=${JSON.stringify(W.LP_ICON_TERMS)};\n  /* reverse index: icon → search terms that mention it (for LP_searchIcons) */\n  window.__LP_TERMIDX=(function(){ var m={},T=window.LP_ICON_TERMS; for(var t in T){ T[t].forEach(function(k){ (m[k]=m[k]||[]).push(t); }); } return m; })();\n})();\n\n(function(){\n  var I=window.LP_ICONS, C=window.LP_ICON_CATS;\n  window.__LP_CATOF={}; C.forEach(function(pair){ var cat=pair[0], keys=pair[1]||[]; keys.forEach(function(k){ if(!window.__LP_CATOF[k]) window.__LP_CATOF[k]=cat; }); });\n  window.LP_iconHtml=function(name,cls){ var p=I[name]; if(!p) return ''; return '<svg class="'+(cls||'lp-ic')+'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+p+'</svg>'; };\n  window.LP_popularIcons=function(){ return (window.LP_ICON_POPULAR||[]).slice(); };\n  window.LP_searchIcons=function(q,cat){ q=String(q||"").trim().toLowerCase(); var catOf=window.__LP_CATOF,idx=window.__LP_TERMIDX,out=[]; var curated=(q&&window.LP_ICON_TERMS[q])?window.LP_ICON_TERMS[q].filter(function(k){return I[k];}):[]; Object.keys(I).forEach(function(k){ if(cat&&catOf[k]!==cat) return; if(q){ var s=(k+" "+(catOf[k]||"")+" "+((idx[k]||[]).join(" "))).toLowerCase().replace(/-/g," "); if(s.indexOf(q)<0&&curated.indexOf(k)<0) return; } out.push(k); }); if(curated.length){ var seen={}; curated.forEach(function(k){seen[k]=1;}); out=curated.concat(out.filter(function(k){return !seen[k];})); } return out; };\n})();\n`;

fs.writeFileSync(iconsPath, out);
console.log('Patched icons.js');
console.log(' New icons:', Object.keys(NEW_ICONS).join(', '));
console.log(' Earthmoving & Civil:', EARTH.length);
console.log(' Mechanical:', MECHANICAL.length);
console.log(' Computers & IT:', COMPUTERS.length);

// Sync marketplace-feature.html inline icons if present
const mf = path.join(__dirname, '..', 'marketplace-feature.html');
if (fs.existsSync(mf)) {
  let html = fs.readFileSync(mf, 'utf8');
  const start = html.indexOf('<script>window.LP_ICONS=');
  if (start >= 0) {
    const end = html.indexOf('</script>', start);
    if (end > start) {
      // Keep search helpers from icons.js but without outer comment — embed full file body
      const body = out.replace(/^\/\*[\s\S]*?\*\/\n/, '');
      html = html.slice(0, start) + '<script>' + body + html.slice(end);
      fs.writeFileSync(mf, html);
      console.log('Synced marketplace-feature.html inline icons');
    }
  }
}
