#!/usr/bin/env node
/**
 * Icon library build (stroke icons only).
 *
 *  icons.js (loaded by every site) — keeps its curated Lucide set and gains:
 *    - any icon the emoji map points at that it lacks,
 *    - window.LP_EMOJI_ICONS: emoji → stroke icon name (lib/emoji-icon-map.json), with each emoji
 *      also registered as an alias key in LP_ICONS so every renderer draws the stroke icon,
 *    - window.LP_registerIcons(lib): adds a site's own icons (config.iconLib) after checking the
 *      markup is plain SVG shapes.
 *  icons-more.js (editor only) — every other Lucide icon (window.LP_ICONS_MORE) and search tags
 *    for all of them (window.LP_ICON_TAGS). Picking one of these saves it into the site's
 *    config.iconLib, so sites only carry the icons they use.
 *
 * Usage: node scripts/build-icon-library.js <path to an unpacked lucide-static package>
 *   (npm pack lucide-static && tar xzf lucide-static-*.tgz → ./package)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const pkg = process.argv[2];
if (!pkg || !fs.existsSync(path.join(pkg, 'icons'))) { console.error('Pass the lucide-static package folder'); process.exit(1); }
const version = JSON.parse(fs.readFileSync(path.join(pkg, 'package.json'), 'utf8')).version;

function bodyOf(file) {
  const svg = fs.readFileSync(file, 'utf8');
  const m = svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  return m ? m[1].replace(/\s*\n\s*/g, ' ').trim() : '';
}
const all = {};
fs.readdirSync(path.join(pkg, 'icons')).filter((f) => f.endsWith('.svg')).forEach((f) => {
  const b = bodyOf(path.join(pkg, 'icons', f)); if (b) all[f.slice(0, -4)] = b;
});
const tags = JSON.parse(fs.readFileSync(path.join(pkg, 'tags.json'), 'utf8'));

// Current curated set
const iconsPath = path.join(ROOT, 'icons.js');
let src = fs.readFileSync(iconsPath, 'utf8');
const MARK = '/* @lp-icon-library */';
if (src.indexOf(MARK) >= 0) src = src.slice(0, src.indexOf(MARK)).trimEnd() + '\n';
global.window = {};
new Function('window', src)(global.window);
const core = global.window.LP_ICONS;

const emoji = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/emoji-icon-map.json'), 'utf8'));
const addCore = {};
Object.keys(emoji).forEach((e) => {
  const n = emoji[e];
  if (!core[n]) { if (!all[n]) throw new Error('Lucide has no icon "' + n + '" (emoji ' + e + ')'); addCore[n] = all[n]; }
});
// Keep only real names in the picker search (emoji aliases are not shown).
src = src.replace('Object.keys(I).forEach(function(k){ if(cat&&catOf[k]!==cat) return;', 'Object.keys(I).forEach(function(k){ if(!/^[a-z0-9-]+$/.test(k)) return; if(cat&&catOf[k]!==cat) return;');

const block = MARK + '\n' +
  '/* Added by scripts/build-icon-library.js from lucide-static ' + version + ' (ISC). */\n' +
  '(function(){\n' +
  '  var I=window.LP_ICONS; if(!I) return;\n' +
  '  var ADD=' + JSON.stringify(addCore) + ';\n' +
  '  for(var a in ADD){ if(!I[a]) I[a]=ADD[a]; }\n' +
  '  /* Emoji used as icons in older content → stroke icons (coloured emoji are not used as icons). */\n' +
  '  window.LP_EMOJI_ICONS=' + JSON.stringify(emoji) + ';\n' +
  '  for(var e in window.LP_EMOJI_ICONS){ var n=window.LP_EMOJI_ICONS[e]; if(!I[e]&&I[n]) I[e]=I[n]; }\n' +
  '  /** Plain SVG shapes only — no scripts, events, links or styles. */\n' +
  '  window.LP_iconBodyOk=function(b){ b=String(b||\'\'); if(!b||b.length>6000) return false; if(/<(?!\\/?(path|circle|rect|line|polyline|polygon|ellipse|g)\\b)[a-z]/i.test(b)) return false; return !/\\son[a-z]+\\s*=|javascript:|href|style\\s*=|url\\(/i.test(b); };\n' +
  '  /** A site\'s own icons (config.iconLib: { name: svg shapes }), e.g. picked from the full library or online. */\n' +
  '  window.LP_registerIcons=function(lib){ if(!lib||typeof lib!==\'object\') return; for(var k in lib){ if(/^[a-z0-9-]+$/.test(k)&&!I[k]&&window.LP_iconBodyOk(lib[k])) I[k]=lib[k]; } };\n' +
  '})();\n';
fs.writeFileSync(iconsPath, src.trimEnd() + '\n\n' + block);

const more = {};
Object.keys(all).sort().forEach((n) => { if (!core[n] && !addCore[n]) more[n] = all[n]; });
const tagOut = {};
Object.keys(all).forEach((n) => { if (tags[n] && tags[n].length) tagOut[n] = tags[n]; });
fs.writeFileSync(path.join(ROOT, 'icons-more.js'),
  '/* LeadPages full stroke icon library for the editor — Lucide ' + version + ' (ISC). Built by scripts/build-icon-library.js.\n' +
  '   Not loaded on sites: a picked icon is saved into the site (config.iconLib). */\n' +
  'window.LP_ICONS_MORE=' + JSON.stringify(more) + ';\n' +
  'window.LP_ICON_TAGS=' + JSON.stringify(tagOut) + ';\n');
console.log('core +' + Object.keys(addCore).length + ', more ' + Object.keys(more).length + ', tags ' + Object.keys(tagOut).length + ' (lucide ' + version + ')');
