#!/usr/bin/env node
/**
 * Add the empty Map & Hours (mapHours) and CTA Banner (ctaBanner) app sections to the
 * trade template. Both are drawn by /assets/lp-layouts.js from sections.mapHours /
 * sections.ctaBanner and stay hidden until switched on. Safe to run more than once.
 * Run: node scripts/patch-maphours-ctabanner-sections.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const TPL = path.join(__dirname, '../trade.template.json');
const MARKUP =
  '  <!-- MAP & HOURS APP (drawn by /assets/lp-layouts.js) -->\n'
  + '  <section data-sec="mapHours" class="section" id="mapHours" style="display:none"></section>\n\n'
  + '  <!-- CTA BANNER APP (drawn by /assets/lp-layouts.js) -->\n'
  + '  <section data-sec="ctaBanner" class="section" id="ctaBanner" style="display:none"></section>\n\n';
const ANCHOR = '  <!-- ABOUT US APP -->';

const tpl = JSON.parse(fs.readFileSync(TPL, 'utf8'));
if (tpl.html.indexOf('data-sec="mapHours"') >= 0) {
  console.log('trade.template.json already has the Map & Hours / CTA Banner sections');
  process.exit(0);
}
const at = tpl.html.indexOf(ANCHOR);
if (at < 0) { console.error('About Us anchor not found'); process.exit(1); }
tpl.html = tpl.html.slice(0, at) + MARKUP + tpl.html.slice(at);
fs.writeFileSync(TPL, JSON.stringify(tpl));
console.log('Added Map & Hours + CTA Banner sections to trade.template.json');
